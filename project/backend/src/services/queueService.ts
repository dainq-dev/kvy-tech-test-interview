import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const verificationQueue = new Queue('verification', { connection });
export const notificationQueue = new Queue('notification', { connection });
export const mockWebhookQueue = new Queue('mock-webhook', { connection });

export { connection };
