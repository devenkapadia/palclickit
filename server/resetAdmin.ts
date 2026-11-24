import { closeDb, col, connectDb, exists } from './db.ts';
import { createAdminUser, hashPassword } from './auth.ts';

// Usage: npm run reset-admin -- you@example.com NewPassword123
const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run reset-admin -- <email> <password (min 8 chars)>');
  process.exit(1);
}
await connectDb();
if (await exists('admin_users', {})) {
  const u = await col('admin_users').findOne({}, { sort: { _id: 1 } });
  await col('admin_users').updateOne({ _id: u!._id }, { $set: { email: email.toLowerCase(), password_hash: hashPassword(password) } });
} else {
  await createAdminUser(email, password);
}
await col('sessions').deleteMany({});
console.log(`Admin credentials set for ${email}. All sessions were signed out.`);
await closeDb();
