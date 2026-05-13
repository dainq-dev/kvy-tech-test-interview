import { Hono } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { mockWebhookQueue } from '../services/queueService';

const mock = new Hono();

const requestSchema = z.object({
  documentId: z.string().uuid(),
  fileUrl: z.string().url(),
});

type VerificationResult = 'verified' | 'rejected' | 'inconclusive';

function pickResult(): VerificationResult {
  const rand = Math.random();
  if (rand < 0.4) return 'verified';
  if (rand < 0.7) return 'rejected';
  return 'inconclusive';
}

mock.post('/verify', async (c) => {
  const parsed = requestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

  const { documentId, fileUrl: _fileUrl } = parsed.data;
  const externalRefId = `mock-${uuidv4()}`;
  const result = pickResult();
  const confidence = result === 'inconclusive'
    ? Math.random() * 0.3 + 0.3
    : Math.random() * 0.3 + 0.7;

  const minDelay = parseInt(process.env.MOCK_MIN_DELAY_MS || '3000');
  const maxDelay = parseInt(process.env.MOCK_MAX_DELAY_MS || '8000');
  const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

  await mockWebhookQueue.add(
    'deliver-webhook',
    {
      documentId,
      externalRefId,
      result,
      confidence: parseFloat(confidence.toFixed(2)),
      reason: result === 'rejected' ? 'Document appears invalid or expired' : undefined,
    },
    { delay }
  );

  return c.json({ externalRefId, message: 'Verification started', estimatedDelay: delay });
});

export default mock;
