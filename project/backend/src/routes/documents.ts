import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { db } from '../db/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { verificationQueue } from '../services/queueService';
import { writeAuditLog } from '../services/auditService';

const documents = new Hono();

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

documents.post('/', requireAuth, requireRole('seller'), async (c) => {
  const body = await c.req.parseBody();
  const file = body['document'];

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: `File exceeds ${process.env.MAX_FILE_SIZE_MB || 10}MB limit` }, 413);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'Only PDF, JPG, and PNG files are allowed' }, 400);
  }

  const ext = path.extname(file.name);
  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await Bun.write(filePath, file);

  const fileUrl = `/uploads/${filename}`;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const docResult = await client.query(
      `INSERT INTO documents (seller_id, file_url, file_name, file_size_bytes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [c.get('user').userId, fileUrl, file.name, file.size]
    );

    const doc = docResult.rows[0];

    await writeAuditLog(client, {
      documentId: doc.id,
      actorId: c.get('user').userId,
      action: 'submitted',
      fromStatus: null,
      toStatus: 'pending',
    });

    await client.query('COMMIT');

    await verificationQueue.add(
      'verify-document',
      { documentId: doc.id, fileUrl: `${process.env.BACKEND_URL}${fileUrl}` },
      { attempts: 5, backoff: { type: 'exponential', delay: 1000 } }
    );

    return c.json(doc, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

documents.get('/', requireAuth, requireRole('seller'), async (c) => {
  const result = await db.query(
    `SELECT id, file_name, file_size_bytes, status, submitted_at, decided_at, decision_reason
     FROM documents WHERE seller_id = $1 ORDER BY submitted_at DESC`,
    [c.get('user').userId]
  );
  return c.json(result.rows);
});

documents.get('/:id', requireAuth, requireRole('seller'), async (c) => {
  const result = await db.query(
    `SELECT d.id, d.file_name, d.file_size_bytes, d.status, d.submitted_at, d.decided_at, d.decision_reason,
            json_agg(json_build_object(
              'action', al.action, 'from_status', al.from_status,
              'to_status', al.to_status, 'created_at', al.created_at
            ) ORDER BY al.created_at) AS history
     FROM documents d
     LEFT JOIN audit_logs al ON al.document_id = d.id
     WHERE d.id = $1 AND d.seller_id = $2
     GROUP BY d.id`,
    [c.req.param('id'), c.get('user').userId]
  );

  if (!result.rows[0]) return c.json({ error: 'Document not found' }, 404);
  return c.json(result.rows[0]);
});

export default documents;
