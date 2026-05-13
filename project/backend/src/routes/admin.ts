import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAuditLog } from '../services/auditService';
import { notificationQueue, verificationQueue } from '../services/queueService';

const admin = new Hono();

const VALID_STATUSES = ['pending', 'processing', 'approved', 'rejected', 'under_review', 'failed'];

admin.get('/documents', requireAuth, requireRole('admin'), async (c) => {
  const status = c.req.query('status');
  const statusFilter = typeof status === 'string' && VALID_STATUSES.includes(status) ? status : null;

  const result = await db.query(
    `SELECT d.id, d.file_name, d.file_size_bytes, d.status,
            d.submitted_at, d.decided_at, d.decision_reason,
            u.email AS seller_email, u.name AS seller_name,
            d.current_reviewer_id, r.name AS reviewer_name
     FROM documents d
     JOIN users u ON u.id = d.seller_id
     LEFT JOIN users r ON r.id = d.current_reviewer_id
     ${statusFilter ? 'WHERE d.status = $1' : ''}
     ORDER BY d.submitted_at ASC`,
    statusFilter ? [statusFilter] : []
  );

  return c.json(result.rows);
});

admin.get('/documents/:id', requireAuth, requireRole('admin'), async (c) => {
  const docResult = await db.query(
    `SELECT d.*, u.email AS seller_email, u.name AS seller_name
     FROM documents d JOIN users u ON u.id = d.seller_id WHERE d.id = $1`,
    [c.req.param('id')]
  );
  if (!docResult.rows[0]) return c.json({ error: 'Document not found' }, 404);

  const auditResult = await db.query(
    `SELECT al.action, al.from_status, al.to_status, al.metadata, al.created_at,
            u.name AS actor_name, u.email AS actor_email
     FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
     WHERE al.document_id = $1 ORDER BY al.created_at ASC`,
    [c.req.param('id')]
  );

  return c.json({ ...docResult.rows[0], history: auditResult.rows });
});

admin.post('/documents/:id/claim', requireAuth, requireRole('admin'), async (c) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const docResult = await client.query(
      'SELECT id, status, current_reviewer_id FROM documents WHERE id = $1 FOR UPDATE',
      [c.req.param('id')]
    );
    const doc = docResult.rows[0];

    if (!doc) { await client.query('ROLLBACK'); return c.json({ error: 'Document not found' }, 404); }
    if (doc.status !== 'under_review') { await client.query('ROLLBACK'); return c.json({ error: `Document is in status '${doc.status}', cannot claim` }, 409); }
    if (doc.current_reviewer_id && doc.current_reviewer_id !== c.get('user').userId) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Document is already being reviewed by another admin' }, 409);
    }

    await client.query(
      'UPDATE documents SET current_reviewer_id = $1, review_claimed_at = now() WHERE id = $2',
      [c.get('user').userId, doc.id]
    );
    await writeAuditLog(client, {
      documentId: doc.id, actorId: c.get('user').userId,
      action: 'review_claimed', fromStatus: 'under_review', toStatus: 'under_review',
    });

    await client.query('COMMIT');
    return c.json({ message: 'Document claimed for review' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const decideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().max(500).optional(),
});

admin.post('/documents/:id/decide', requireAuth, requireRole('admin'), async (c) => {
  const parsed = decideSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);

  const { decision, reason } = parsed.data;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const docResult = await client.query(
      'SELECT id, status, current_reviewer_id, seller_id FROM documents WHERE id = $1 FOR UPDATE',
      [c.req.param('id')]
    );
    const doc = docResult.rows[0];

    if (!doc) { await client.query('ROLLBACK'); return c.json({ error: 'Document not found' }, 404); }
    if (doc.status !== 'under_review') { await client.query('ROLLBACK'); return c.json({ error: 'Document is not under review' }, 409); }
    if (doc.current_reviewer_id !== c.get('user').userId) {
      await client.query('ROLLBACK');
      return c.json({ error: 'You have not claimed this document for review' }, 403);
    }

    await client.query(
      `UPDATE documents SET status = $1, decided_at = now(), decision_reason = $2,
       current_reviewer_id = NULL, review_claimed_at = NULL WHERE id = $3`,
      [decision, reason ?? null, doc.id]
    );
    await writeAuditLog(client, {
      documentId: doc.id, actorId: c.get('user').userId,
      action: decision === 'approved' ? 'admin_approved' : 'admin_rejected',
      fromStatus: 'under_review', toStatus: decision,
      metadata: { reason: reason ?? null },
    });

    await client.query('COMMIT');

    await notificationQueue.add('notify-seller', {
      sellerId: doc.seller_id, documentId: doc.id, status: decision, reason: reason ?? null,
    });

    return c.json({ message: 'Decision recorded', status: decision });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /admin/stats — đếm document theo từng trạng thái
admin.get('/stats', requireAuth, requireRole('admin'), async (c) => {
  const result = await db.query(
    `SELECT status, COUNT(*)::int AS count FROM documents GROUP BY status`
  );
  const stats: Record<string, number> = {};
  for (const row of result.rows) stats[row.status] = row.count;
  return c.json(stats);
});

// POST /admin/documents/:id/retry — re-queue document bị failed
admin.post('/documents/:id/retry', requireAuth, requireRole('admin'), async (c) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const docResult = await client.query(
      'SELECT id, status, file_url FROM documents WHERE id = $1 FOR UPDATE',
      [c.req.param('id')]
    );
    const doc = docResult.rows[0];

    if (!doc) { await client.query('ROLLBACK'); return c.json({ error: 'Document not found' }, 404); }
    if (doc.status !== 'failed') { await client.query('ROLLBACK'); return c.json({ error: 'Only failed documents can be retried' }, 409); }

    await client.query(
      `UPDATE documents SET status = 'pending', external_ref_id = NULL WHERE id = $1`,
      [doc.id]
    );
    await writeAuditLog(client, {
      documentId: doc.id, actorId: c.get('user').userId,
      action: 'submitted', fromStatus: 'failed', toStatus: 'pending',
      metadata: { note: 'manual retry by admin' },
    });

    await client.query('COMMIT');

    await verificationQueue.add(
      'verify-document',
      { documentId: doc.id, fileUrl: `${process.env.BACKEND_URL}${doc.file_url}` },
      { attempts: 5, backoff: { type: 'exponential', delay: 1000 } }
    );

    return c.json({ message: 'Document re-queued for verification' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export default admin;
