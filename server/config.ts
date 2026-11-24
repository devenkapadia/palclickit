import path from 'node:path';
import fs from 'node:fs';

// Load .env (if present). Real environment variables always win.
try {
  process.loadEnvFile();
} catch {
  /* no .env file — fine in production where env vars are set by the host */
}

const root = process.cwd();

export const config = {
  root,
  port: Number(process.env.PORT ?? 4000),
  isProd: process.env.NODE_ENV === 'production',
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB ?? 'pal',
  // Uploaded gallery/site images and private receipts live on disk here.
  dataDir: path.resolve(root, process.env.DATA_DIR ?? 'data'),
  timezone: process.env.APP_TIMEZONE ?? 'Asia/Kolkata',
  sessionDays: Number(process.env.SESSION_DAYS ?? 14),
  // Set COOKIE_SECURE=true when serving over HTTPS (behind a proxy also set TRUST_PROXY=1)
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  trustProxy: process.env.TRUST_PROXY ?? '',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};

export const dirs = {
  gallery: path.join(config.dataDir, 'uploads', 'gallery'),
  reels: path.join(config.dataDir, 'uploads', 'reels'),
  site: path.join(config.dataDir, 'uploads', 'site'),
  receipts: path.join(config.dataDir, 'receipts'),
};

for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
