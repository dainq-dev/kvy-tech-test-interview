import { Worker } from 'bullmq';
import { connection } from '../services/queueService';

export function startMockWebhookWorker() {
  const worker = new Worker(
    'mock-webhook',
    async (job) => {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      const res = await fetch(`${backendUrl}/webhook/verification-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job.data),
      });
      if (!res.ok) {
        throw new Error(`Webhook delivery failed: ${res.status}`);
      }
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error(`[mock-webhook] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
