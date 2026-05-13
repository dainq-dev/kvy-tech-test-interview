import { Worker, Job } from 'bullmq';
import { connection } from '../services/queueService';
import { db } from '../db/client';
import { writeAuditLog } from '../services/auditService';

interface NotificationJobData {
  sellerId: string;
  documentId: string;
  status: 'approved' | 'rejected';
  reason: string | null;
}

export function startNotificationWorker() {
  const worker = new Worker<NotificationJobData>(
    'notification',
    async (job: Job<NotificationJobData>) => {
      const { sellerId, documentId, status, reason } = job.data;

      // In production: send email via SES/SendGrid here.
      // For now: log and write audit record as proof of notification.
      const sellerResult = await db.query(
        'SELECT email, name FROM users WHERE id = $1',
        [sellerId]
      );
      const seller = sellerResult.rows[0];
      if (!seller) throw new Error(`Seller ${sellerId} not found`);

      console.log(
        `[notification] Seller ${seller.email} — document ${documentId} is ${status}.` +
        (reason ? ` Reason: ${reason}` : '')
      );

      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await writeAuditLog(client, {
          documentId,
          actorId: null,
          action: 'notification_sent',
          metadata: { channel: 'in-app', status, reason },
        });
        await client.query('COMMIT');
      } catch {
        await client.query('ROLLBACK');
        throw new Error('Failed to write notification audit log');
      } finally {
        client.release();
      }
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error(`[notification] Job ${job?.id} failed:`, err.message);
  });

  console.log('[worker] Notification worker started');
  return worker;
}
