import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { writeAuditLog } from '../services/auditService';
import { notificationQueue } from '../services/queueService';

const webhook = new Hono();

const webhookSchema = z.object({
  documentId: z.string().uuid(),
  externalRefId: z.string(),
  result: z.enum(['verified', 'rejected', 'inconclusive']),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
});

webhook.post('/verification-result', async (c) => {
  const parsed = webhookSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid webhook payload' }, 400);

  const { documentId, externalRefId, result, confidence, reason } = parsed.data;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const docResult = await client.query(
      'SELECT id, status, seller_id FROM documents WHERE id = $1 FOR UPDATE',
      [documentId]
    );
    const doc = docResult.rows[0];

    if (!doc) { await client.query('ROLLBACK'); return c.json({ error: 'Document not found' }, 404); }

    if (doc.status !== 'processing') {
      await client.query('ROLLBACK');
      return c.json({ message: 'Already processed' });
    }

    const statusMap = { verified: 'approved', rejected: 'rejected', inconclusive: 'under_review' } as const;
    const actionMap = { verified: 'auto_approved', rejected: 'auto_rejected', inconclusive: 'inconclusive' } as const;
    const newStatus = statusMap[result];

    await client.query(
      `UPDATE documents SET status = $1::doc_status, external_ref_id = $2,
       decided_at = CASE WHEN $1 IN ('approved', 'rejected') THEN now() ELSE NULL END,
       decision_reason = $3 WHERE id = $4`,
      [newStatus, externalRefId, reason ?? null, documentId]
    );
    await writeAuditLog(client, {
      documentId, actorId: null,
      action: actionMap[result],
      fromStatus: 'processing', toStatus: newStatus,
      metadata: { result, confidence, reason, externalRefId },
    });

    await client.query('COMMIT');

    if (newStatus === 'approved' || newStatus === 'rejected') {
      await notificationQueue.add('notify-seller', {
        sellerId: doc.seller_id, documentId, status: newStatus, reason: reason ?? null,
      });
    }

    return c.json({ message: 'Processed' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export default webhook;
