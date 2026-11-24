import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.ts';
import { col, insert, nowIso } from './db.ts';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  if (!expected.length) return false;
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export const COOKIE = 'pal_session';

export async function createSession(res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86400_000);
  // Only a hash of the token is stored. expires_at is a Date so MongoDB's TTL index purges old sessions.
  await col('sessions').insertOne({ _id: sha(token) as any, user_id: userId, expires_at: expires, created_at: nowIso() });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, expires, path: '/' });
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE];
  if (token && typeof token === 'string') await col('sessions').deleteOne({ _id: sha(token) as any });
  res.clearCookie(COOKIE, { path: '/' });
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
}

export async function currentUser(req: Request): Promise<AdminUser | undefined> {
  const token = req.cookies?.[COOKIE];
  if (!token || typeof token !== 'string') return undefined;
  const session = await col('sessions').findOne({ _id: sha(token) as any });
  if (!session) return undefined;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await col('sessions').deleteOne({ _id: session._id });
    return undefined;
  }
  const u = await col('admin_users').findOne({ _id: session.user_id });
  return u ? { id: u._id as unknown as number, email: u.email, name: u.name } : undefined;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  (req as any).user = user;
  next();
}

/** CSRF defence in depth (cookie is SameSite=Strict): reject cross-origin state-changing requests. */
export function sameOriginOnly(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin request blocked' });
    } catch {
      return res.status(403).json({ error: 'Bad origin' });
    }
  }
  next();
}

// Simple in-memory rate limiter (login + public form).
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return next();
    }
    if (++h.n > max) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    next();
  };
}

export async function createAdminUser(email: string, password: string, name = 'Owner') {
  return insert('admin_users', { email: email.toLowerCase(), name, password_hash: hashPassword(password), created_at: nowIso() });
}
