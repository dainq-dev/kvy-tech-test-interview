import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { HTTPException } from 'hono/http-exception';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

import auth from './routes/auth';
import documents from './routes/documents';
import admin from './routes/admin';
import webhook from './routes/webhook';
import mock from './mock/verificationService';
import { startVerificationWorker } from './workers/verificationWorker';
import { startNotificationWorker } from './workers/notificationWorker';
import { startMockWebhookWorker } from './workers/mockWebhookWorker';

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const app = new Hono();

app.use('*', cors());

// Static file serving for uploads
app.use('/uploads/*', serveStatic({ root: './' }));

// Routes
app.route('/auth', auth);
app.route('/documents', documents);
app.route('/admin', admin);
app.route('/webhook', webhook);
app.route('/mock', mock);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Global error handler — never leak internals
app.onError((err, c) => {
  console.error('[error]', err.message);
  if (err instanceof HTTPException) return err.getResponse();
  return c.json({ error: 'Internal server error' }, 500);
});

// Start BullMQ workers
startVerificationWorker();
startNotificationWorker();
startMockWebhookWorker();

const PORT = parseInt(process.env.PORT || '4000');
console.log(`Backend running on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
