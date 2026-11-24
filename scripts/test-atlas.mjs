// Runs the API smoke test against YOUR Atlas cluster, in a throwaway database that is dropped afterwards.
// Reads MONGODB_URI from .env. Never touches the real "pal" database.
// Usage: npm run test:atlas
import { MongoClient } from 'mongodb';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

process.loadEnvFile('.env');
const PORT = '4101';
const DB = 'pal_verify_' + Date.now().toString(36);
const DATA_DIR = 'data-atlas-test';

const env = { ...process.env, MONGODB_DB: DB, ADMIN_EMAIL: 'owner@pal.test', ADMIN_PASSWORD: 'TestPass123', DATA_DIR, PORT };
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

let code = 1;
try {
  let up = false;
  for (let i = 0; i < 80 && !up; i++) {
    try { up = (await fetch(`http://localhost:${PORT}/api/public/site`)).ok; } catch { /* not yet */ }
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) throw new Error('Server did not start:\n' + log);
  console.log(`Server up against Atlas (temporary database "${DB}")`);
  const smoke = spawn(process.execPath, ['scripts/smoke.mjs', `http://localhost:${PORT}`], { stdio: 'inherit' });
  code = await new Promise((res) => smoke.on('close', res));
} catch (e) {
  console.error(e.message);
} finally {
  server.kill();
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  await c.db(DB).dropDatabase();
  await c.close();
  console.log(`Temporary database "${DB}" dropped.`);
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
process.exit(code);
