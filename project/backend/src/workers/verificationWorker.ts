import { Worker, Job } from 'bullmq';
import { connection } from '../services/queueService';
import { db } from '../db/client';
import { writeAuditLog } from '../services/auditService';

interface VerificationJobData {
  documentId: string;
  fileUrl: string;
}

export function startVerificationWorker() {
  const worker = new Worker<VerificationJobData>(
    'verification',
    async (job: Job<VerificationJobData>) => {
      const { documentId, fileUrl } = job.data;
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const docResult = await client.query(
          'SELECT id, status FROM documents WHERE id = $1 FOR UPDATE',
          [documentId]
        );

        const doc = docResult.rows[0];
        if (!doc) throw new Error(`Document ${documentId} not found`);

        // Idempotency: already moved past pending
        if (doc.status !== 'pending') {
          await client.query('ROLLBACK');
          return;
        }

        await client.query(
          'UPDATE documents SET status = $1 WHERE id = $2',
          ['processing', documentId]
        );

        await writeAuditLog(client, {
          documentId,
          actorId: null,
          action: 'sent_to_service',
          fromStatus: 'pending',
          toStatus: 'processing',
        });

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Call mock verification service — webhook will handle the result
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/mock/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, fileUrl }),
      });

      if (!response.ok) {
        throw new Error(`Mock service responded ${response.status}`);
      }
    },
    { connection }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { documentId } = job.data;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isLastAttempt) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "UPDATE documents SET status = 'failed' WHERE id = $1 AND status = 'processing'",
          [documentId]
        );
        await writeAuditLog(client, {
          documentId,
          action: 'job_failed',
          fromStatus: 'processing',
          toStatus: 'failed',
          metadata: { error: err.message, attempts: job.attemptsMade },
        });
        await client.query('COMMIT');
      } catch {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }
  });

  console.log('[worker] Verification worker started');
  return worker;
}
