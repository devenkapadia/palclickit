// Starts the production server against a throwaway in-memory MongoDB so you can click around
// the whole app without an Atlas account. Data is discarded on exit (Ctrl+C).
// Usage: node scripts/serve-demo.mjs   → http://localhost:4200  (owner@pal.test / TestPass123)
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = process.env.PORT ?? '4200';
const DATA_DIR = 'data-demo';
const mongo = await MongoMemoryServer.create();
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, MONGODB_URI: mongo.getUri(), MONGODB_DB: 'pal_demo', ADMIN_EMAIL: 'owner@pal.test', ADMIN_PASSWORD: 'TestPass123', DATA_DIR, PORT },
});
const stop = async () => { server.kill(); await mongo.stop(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('close', stop);
