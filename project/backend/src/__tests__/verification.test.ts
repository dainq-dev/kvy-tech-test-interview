import { describe, it, expect, mock } from 'bun:test';

const mockClient = {
  query: mock(async () => ({ rows: [] as any[], rowCount: 0 })),
  release: mock(() => {}),
};
const mockDb = {
  query: mock(async () => ({ rows: [] as any[], rowCount: 0 })),
  connect: mock(async () => mockClient),
};

mock.module('../db/client', () => ({ db: mockDb }));
mock.module('../services/queueService', () => ({
  verificationQueue: { add: mock(async () => {}) },
  notificationQueue: { add: mock(async () => {}) },
  mockWebhookQueue: { add: mock(async () => {}) },
  connection: {},
}));
mock.module('../workers/verificationWorker', () => ({ startVerificationWorker: mock(() => {}) }));
mock.module('../workers/notificationWorker', () => ({ startNotificationWorker: mock(() => {}) }));
mock.module('../workers/mockWebhookWorker', () => ({ startMockWebhookWorker: mock(() => {}) }));

const { default: server } = await import('../index');

async function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  const res = await server.fetch(new Request(`http://localhost${path}`, init));
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}

describe('GET /health', () => {
  it('returns ok', async () => {
    const { status, body } = await req('GET', '/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

describe('POST /auth/login', () => {
  it('returns 400 for invalid email', async () => {
    const { status, body } = await req('POST', '/auth/login', { email: 'not-email', password: '' });
    expect(status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 401 for unknown user', async () => {
    mockDb.query.mockImplementationOnce(async () => ({ rows: [], rowCount: 0 }));
    const { status, body } = await req('POST', '/auth/login', { email: 'nobody@test.com', password: 'pass' });
    expect(status).toBe(401);
    expect(body.error).toBe('Invalid credentials');
  });
});

describe('POST /webhook/verification-result', () => {
  it('returns 400 for invalid payload', async () => {
    const { status } = await req('POST', '/webhook/verification-result', {
      documentId: 'not-a-uuid', result: 'bad',
    });
    expect(status).toBe(400);
  });

  it('returns 404 when document not found', async () => {
    mockClient.query
      .mockImplementationOnce(async () => ({ rows: [], rowCount: 0 })) // BEGIN
      .mockImplementationOnce(async () => ({ rows: [], rowCount: 0 })) // SELECT — not found
      .mockImplementationOnce(async () => ({ rows: [], rowCount: 0 })); // ROLLBACK

    const { status } = await req('POST', '/webhook/verification-result', {
      documentId: '00000000-0000-0000-0000-000000000001',
      externalRefId: 'mock-123',
      result: 'verified',
    });
    expect(status).toBe(404);
  });
});
