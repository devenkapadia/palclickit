// Runs the API smoke test against a throwaway in-memory MongoDB (never touches Atlas).
// Usage: node scripts/test-local.mjs
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = '4100';
const DATA_DIR = 'data-test';
const mongo = await MongoMemoryServer.create();
console.log('In-memory MongoDB at', mongo.getUri());

const env = {
  ...process.env,
  MONGODB_URI: mongo.getUri(),
  MONGODB_DB: 'pal_test',
  ADMIN_EMAIL: 'owner@pal.test',
  ADMIN_PASSWORD: 'TestPass123',
  DATA_DIR,
  PORT,
};
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/api/public/site`);
      if (r.ok) return;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not start:\n' + log);
}

let code = 1;
try {
  await waitUp();
  const smoke = spawn(process.execPath, ['scripts/smoke.mjs', `http://localhost:${PORT}`], { stdio: 'inherit' });
  code = await new Promise((res) => smoke.on('close', res));
} catch (e) {
  console.error(e.message);
} finally {
  server.kill();
  await mongo.stop();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
process.exit(code);
