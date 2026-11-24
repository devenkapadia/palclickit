import { MongoClient, type Collection, type Db, type Document, type Sort } from 'mongodb';
import { config } from './config.ts';

export type Doc = Record<string, any>;

let client: MongoClient;
let database: Db;

export const nowIso = () => new Date().toISOString();

/**
 * Data model: every record uses a small auto-incrementing integer as `_id`
 * (exposed to the API as `id`), so IDs stay human-friendly (Inquiry #12, PAL-0012).
 * Relationships are plain numeric references; cascades are done in application code.
 */
export async function connectDb(uri = config.mongoUri, dbName = config.dbName) {
  if (!uri) {
    console.error('\nMONGODB_URI is not set. Copy .env.example to .env and paste your MongoDB Atlas connection string.\n');
    process.exit(1);
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    database = client.db(dbName);
    await database.command({ ping: 1 });
  } catch (e) {
    console.error('\nCould not connect to MongoDB:', (e as Error).message);
    console.error('Check the connection string/password and that your IP is allowed in Atlas → Network Access.\n');
    process.exit(1);
  }
  await ensureIndexes();
  console.log(`Connected to MongoDB database "${dbName}"`);
}

export async function closeDb() {
  await client?.close();
}

export const col = (name: string): Collection<Document> => database.collection(name);

/** Mongo document → API object (`_id` → `id`). */
export function out<T = Doc>(d: Document | null | undefined): T | undefined {
  if (!d) return undefined;
  const { _id, ...rest } = d;
  return { id: _id, ...rest } as T;
}

export async function list<T = Doc>(name: string, filter: Doc = {}, sort?: Sort, limit?: number): Promise<T[]> {
  let cur = col(name).find(filter);
  if (sort) cur = cur.sort(sort);
  if (limit) cur = cur.limit(limit);
  return (await cur.toArray()).map((d) => out<T>(d)!);
}

export async function one<T = Doc>(name: string, filter: Doc): Promise<T | undefined> {
  return out<T>(await col(name).findOne(filter));
}

export const byId = <T = Doc>(name: string, id: number) => one<T>(name, { _id: id });

export async function exists(name: string, filter: Doc): Promise<boolean> {
  return (await col(name).countDocuments(filter, { limit: 1 })) > 0;
}

export async function nextId(name: string): Promise<number> {
  const r = await database
    .collection('counters')
    .findOneAndUpdate({ _id: name as any }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return r!.seq as number;
}

export async function insert(name: string, doc: Doc): Promise<number> {
  const id = await nextId(name);
  await col(name).insertOne({ _id: id as any, ...doc });
  return id;
}

export async function patch(name: string, id: number, set: Doc) {
  if (Object.keys(set).length) await col(name).updateOne({ _id: id as any }, { $set: set });
}

export async function removeWhere(name: string, filter: Doc): Promise<number> {
  return (await col(name).deleteMany(filter)).deletedCount;
}

export async function nextOrder(name: string): Promise<number> {
  const top = await col(name).find().sort({ sort_order: -1 }).limit(1).toArray();
  return ((top[0]?.sort_order as number | undefined) ?? 0) + 1;
}

async function ensureIndexes() {
  await Promise.all([
    col('admin_users').createIndex({ email: 1 }, { unique: true }),
    col('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    col('inquiries').createIndex({ status: 1 }),
    col('inquiries').createIndex({ event_date: 1 }),
    col('inquiry_logs').createIndex({ inquiry_id: 1 }),
    col('followups').createIndex({ inquiry_id: 1 }),
    col('followups').createIndex({ status: 1, due_date: 1 }),
    // One inquiry converts to at most one booking (unique only when linked).
    col('events').createIndex({ inquiry_id: 1 }, { unique: true, partialFilterExpression: { inquiry_id: { $type: 'number' } } }),
    col('events').createIndex({ event_date: 1 }),
    col('event_payments').createIndex({ event_id: 1 }),
    col('expenses').createIndex({ event_id: 1 }),
    col('expenses').createIndex({ spent_on: 1 }),
    col('packages').createIndex({ code: 1 }, { unique: true }),
    col('gallery_categories').createIndex({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } }),
  ]);
}

export async function logActivity(kind: string, message: string, refType?: string, refId?: number) {
  await insert('activity_log', { kind, message, ref_type: refType ?? null, ref_id: refId ?? null, created_at: nowIso() });
}
