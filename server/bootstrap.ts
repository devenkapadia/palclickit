import crypto from 'node:crypto';
import { config } from './config.ts';
import { exists } from './db.ts';
import { createAdminUser } from './auth.ts';

/** Create the single owner account on first start. */
export async function ensureAdmin() {
  if (await exists('admin_users', {})) return;
  const email = (config.adminEmail ?? 'owner@palclickit.local').toLowerCase();
  const generated = !config.adminPassword;
  const password = config.adminPassword ?? crypto.randomBytes(9).toString('base64url');
  await createAdminUser(email, password);
  console.log('\n=====================================================');
  console.log(' PAL admin account created');
  console.log(`   Email:    ${email}`);
  console.log(generated ? `   Password: ${password}   (shown once — change it in Settings)` : '   Password: (from ADMIN_PASSWORD)');
  console.log('=====================================================\n');
}
