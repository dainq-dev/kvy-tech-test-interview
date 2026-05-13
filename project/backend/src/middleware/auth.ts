import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';

export type AuthPayload = {
  userId: string;
  email: string;
  role: 'seller' | 'admin';
};

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthPayload;
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthPayload;
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});

export const requireRole = (role: 'seller' | 'admin') =>
  createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (user?.role !== role) return c.json({ error: 'Forbidden' }, 403);
    await next();
  });
