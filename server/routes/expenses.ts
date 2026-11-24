import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { byId, col, exists, insert, list, logActivity, nowIso, patch } from '../db.ts';
import { dirs } from '../config.ts';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../shared/constants.ts';
import { HttpError, dateStr, idParam, optInt, optStr, pick, reqStr, searchFilter, today } from '../util.ts';

export const expensesRouter = Router();

const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: dirs.receipts,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (ALLOWED[file.mimetype] ?? '')),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED),
});

const schema = z.object({
  name: reqStr(200),
  amount: z.coerce.number().min(0),
  spent_on: dateStr.optional(),
  category: z.enum(EXPENSE_CATEGORIES).default('Miscellaneous'),
  event_id: optInt,
  payment_method: z.enum(PAYMENT_METHODS).nullable().optional(),
  notes: optStr(2000),
});
const COLS = ['name', 'amount', 'spent_on', 'category', 'event_id', 'payment_method', 'notes', 'receipt_file'];

function removeReceipt(file: string | null | undefined) {
  if (!file) return;
  fs.rm(path.join(dirs.receipts, path.basename(file)), { force: true }, () => {});
}

async function withEvent(rows: any[]) {
  const ids = [...new Set(rows.map((r) => r.event_id).filter(Boolean))];
  const evs = ids.length ? await list('events', { _id: { $in: ids } }) : [];
  const by = new Map(evs.map((e) => [e.id, e]));
  return rows.map((r) => ({
    ...r,
    has_receipt: !!r.receipt_file,
    event_name: r.event_id ? by.get(r.event_id)?.client_name ?? null : null,
    event_date: r.event_id ? by.get(r.event_id)?.event_date ?? null : null,
  }));
}

expensesRouter.get('/', async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const f: Record<string, any> = {};
  if (q.search) Object.assign(f, searchFilter(q.search, ['name', 'notes']));
  if (q.category) f.category = q.category;
  if (q.event_id === 'none') f.event_id = null;
  else if (q.event_id) f.event_id = Number(q.event_id);
  const dates: Record<string, string> = {};
  if (q.month) {
    dates.$gte = `${q.month}-01`;
    dates.$lte = `${q.month}-31`;
  }
  if (q.from) dates.$gte = q.from;
  if (q.to) dates.$lte = q.to;
  if (Object.keys(dates).length) f.spent_on = dates;

  const rows = await withEvent(await list('expenses', f, { spent_on: -1, _id: -1 }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const r of rows) byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount;
  const eventWise = rows.filter((r) => r.event_id).reduce((s, r) => s + r.amount, 0);
  res.json({ rows, total, eventWise, businessWide: total - eventWise, byCategory });
});

async function checkEvent(eventId: number | null | undefined) {
  if (eventId && !(await exists('events', { _id: eventId }))) throw new HttpError(400, 'Selected event does not exist');
}

expensesRouter.post('/', upload.single('receipt'), async (req, res) => {
  const d = schema.parse(req.body ?? {});
  await checkEvent(d.event_id);
  const now = nowIso();
  const id = await insert('expenses', {
    name: d.name, amount: d.amount, spent_on: d.spent_on ?? today(), category: d.category, event_id: d.event_id ?? null,
    payment_method: d.payment_method ?? null, notes: d.notes ?? null, receipt_file: req.file?.filename ?? null,
    created_at: now, updated_at: now,
  });
  await logActivity('expense', `Expense added: ${d.name} (₹${d.amount.toLocaleString('en-IN')})`, 'expense', id);
  res.status(201).json((await withEvent([(await byId('expenses', id))!]))[0]);
});

expensesRouter.patch('/:id', upload.single('receipt'), async (req, res) => {
  const id = idParam(req.params.id);
  const cur = await byId('expenses', id);
  if (!cur) throw new HttpError(404, 'Expense not found');
  const raw = req.body ?? {};
  const d = schema.partial().parse(raw);
  await checkEvent(d.event_id);
  const data: Record<string, unknown> = { ...d };
  if (req.file) { data.receipt_file = req.file.filename; removeReceipt(cur.receipt_file); }
  if (raw.remove_receipt === 'true' && !req.file) { data.receipt_file = null; removeReceipt(cur.receipt_file); }
  await patch('expenses', id, { ...pick(data, COLS), updated_at: nowIso() });
  res.json((await withEvent([(await byId('expenses', id))!]))[0]);
});

expensesRouter.delete('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const cur = await byId('expenses', id);
  if (!cur) throw new HttpError(404, 'Expense not found');
  await col('expenses').deleteOne({ _id: id as any });
  removeReceipt(cur.receipt_file);
  res.json({ ok: true });
});

// Receipts are private: only served to authenticated admins (this router is mounted behind requireAdmin).
expensesRouter.get('/:id/receipt', async (req, res) => {
  const cur = await byId('expenses', idParam(req.params.id));
  if (!cur?.receipt_file) throw new HttpError(404, 'No receipt');
  const file = path.join(dirs.receipts, path.basename(cur.receipt_file));
  if (!fs.existsSync(file)) throw new HttpError(404, 'File missing');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(file);
});
