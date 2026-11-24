import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { z, ZodError } from 'zod';
import { config, dirs } from './config.ts';
import { col, connectDb, byId, one, patch } from './db.ts';
import { seed } from './seed.ts';
import { backfillCompletedInquiries, migrateLegacyInquiryStatuses } from './domain.ts';
import { ensureAdmin } from './bootstrap.ts';
import {
  createSession, currentUser, destroySession, hashPassword, rateLimit, requireAdmin, sameOriginOnly, verifyPassword,
} from './auth.ts';
import { HttpError } from './util.ts';
import { inquiriesRouter } from './routes/inquiries.ts';
import { followupsRouter } from './routes/followups.ts';
import { eventsRouter } from './routes/events.ts';
import { expensesRouter } from './routes/expenses.ts';
import { dashboardRouter, financeRouter, calendarRouter } from './routes/dashboard.ts';
import { reportsRouter } from './routes/reports.ts';
import { contentRouter } from './routes/content.ts';
import { publicRouter } from './routes/public.ts';

await connectDb();
await seed();
await migrateLegacyInquiryStatuses();
await backfillCompletedInquiries();
await ensureAdmin();

const app = express();
if (config.trustProxy) app.set('trust proxy', config.trustProxy === 'true' ? true : Number(config.trustProxy) || config.trustProxy);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'frame-src': ["'self'", 'https://www.instagram.com'], // Instagram reel/post embeds
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': config.cookieSecure ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---- public, read-only uploads (gallery + site images only; receipts are never here) -------------
app.use('/uploads/gallery', express.static(dirs.gallery, { maxAge: '7d', index: false, dotfiles: 'deny' }));
app.use('/uploads/reels', express.static(dirs.reels, { maxAge: '7d', index: false, dotfiles: 'deny' }));
app.use('/uploads/site', express.static(dirs.site, { maxAge: '7d', index: false, dotfiles: 'deny' }));

// ---- API -------------------------------------------------------------------------------------
const api = express.Router();
api.use(sameOriginOnly);

api.post('/public/inquiry', rateLimit(8, 10 * 60_000));
api.use('/public', publicRouter);

const loginLimiter = rateLimit(8, 15 * 60_000);
api.post('/auth/login', loginLimiter, async (req, res) => {
  const d = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }).parse(req.body);
  const user = await one<{ id: number; email: string; name: string; password_hash: string }>('admin_users', { email: d.email });
  // Always run a hash verification so response time doesn't reveal whether the email exists.
  const ok = verifyPassword(d.password, user?.password_hash ?? 'scrypt$00$00');
  if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password' });
  await createSession(res, user.id);
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});
api.post('/auth/logout', async (req, res) => { await destroySession(req, res); res.json({ ok: true }); });
api.get('/auth/me', async (req, res) => {
  res.json({ user: (await currentUser(req)) ?? null });
});

// Everything below requires a valid admin session.
const admin = express.Router();
admin.use(requireAdmin);
admin.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

admin.post('/auth/change-password', async (req, res) => {
  const d = z.object({ current: z.string().min(1), next: z.string().min(8, 'Use at least 8 characters').max(200) }).parse(req.body);
  const u = (req as any).user as { id: number };
  const row = (await byId<{ password_hash: string }>('admin_users', u.id))!;
  if (!verifyPassword(d.current, row.password_hash)) throw new HttpError(400, 'Current password is incorrect');
  await patch('admin_users', u.id, { password_hash: hashPassword(d.next) });
  await col('sessions').deleteMany({ user_id: u.id }); // sign out everywhere
  await createSession(res, u.id);
  res.json({ ok: true });
});

admin.use('/dashboard', dashboardRouter);
admin.use('/inquiries', inquiriesRouter);
admin.use('/followups', followupsRouter);
admin.use('/events', eventsRouter);
admin.use('/expenses', expensesRouter);
admin.use('/finance', financeRouter);
admin.use('/calendar', calendarRouter);
admin.use('/reports', reportsRouter);
admin.use('/content', contentRouter);
api.use('/admin', admin);

api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api', api);

// ---- Static SPA (production) ----------------------------------------------------------------
const dist = path.join(config.root, 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// ---- Errors ---------------------------------------------------------------------------------
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    return res.status(400).json({ error: `${i.path.join('.') || 'Request'}: ${i.message}`, issues: err.issues });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  const e = err as { type?: string; code?: string; message?: string };
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (e?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large' });
  if (String(e?.message).includes('FOREIGN KEY')) return res.status(400).json({ error: 'Referenced record does not exist' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(config.port, () => console.log(`PAL server running → http://localhost:${config.port}`));
