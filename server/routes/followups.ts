import { Router } from 'express';
import { z } from 'zod';
import { byId, col, insert, list, logActivity, nowIso, patch } from '../db.ts';
import { HttpError, dateStr, idParam, optStr, optTime, today } from '../util.ts';

export const followupsRouter = Router();

async function withInquiry(rows: any[]) {
  if (!rows.length) return [];
  const inqs = await list('inquiries', { _id: { $in: [...new Set(rows.map((r) => r.inquiry_id))] } });
  const by = new Map(inqs.map((i) => [i.id, i]));
  return rows
    .filter((r) => by.has(r.inquiry_id))
    .map((r) => {
      const i = by.get(r.inquiry_id)!;
      return { ...r, customer_name: i.customer_name, phone: i.phone, whatsapp: i.whatsapp, inquiry_status: i.status, event_type: i.event_type, event_date: i.event_date };
    });
}
export { withInquiry };

const timeKey = (f: any) => `${f.due_date} ${f.due_time ?? '99:99'}`;

followupsRouter.get('/', async (_req, res) => {
  const t = today();
  const pending = (await withInquiry(await list('followups', { status: 'Pending' }))).sort((a, b) => timeKey(a).localeCompare(timeKey(b)));
  const completed = await withInquiry(await list('followups', { status: 'Completed' }, { completed_at: -1 }, 100));
  res.json({
    today: pending.filter((f) => f.due_date === t),
    overdue: pending.filter((f) => f.due_date < t),
    upcoming: pending.filter((f) => f.due_date > t),
    completed,
  });
});

const createSchema = z.object({
  inquiry_id: z.coerce.number().int().positive(),
  due_date: dateStr,
  due_time: optTime,
  note: optStr(1000),
});

followupsRouter.post('/', async (req, res) => {
  const d = createSchema.parse(req.body);
  const inq = await byId('inquiries', d.inquiry_id);
  if (!inq) throw new HttpError(404, 'Inquiry not found');
  const id = await insert('followups', {
    inquiry_id: d.inquiry_id, due_date: d.due_date, due_time: d.due_time ?? null, note: d.note ?? null,
    status: 'Pending', completed_at: null, created_at: nowIso(),
  });
  await logActivity('followup', `Follow-up scheduled with ${inq.customer_name} for ${d.due_date}`, 'inquiry', d.inquiry_id);
  res.status(201).json((await withInquiry([(await byId('followups', id))!]))[0]);
});

// Reschedule / edit note
followupsRouter.patch('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = createSchema.omit({ inquiry_id: true }).partial().parse(req.body);
  const cur = await byId('followups', id);
  if (!cur) throw new HttpError(404, 'Follow-up not found');
  await patch('followups', id, {
    due_date: d.due_date ?? cur.due_date,
    due_time: d.due_time === undefined ? cur.due_time : d.due_time,
    note: d.note === undefined ? cur.note : d.note,
  });
  res.json((await withInquiry([(await byId('followups', id))!]))[0]);
});

followupsRouter.post('/:id/complete', async (req, res) => {
  const id = idParam(req.params.id);
  const d = z.object({ outcome: optStr(1000) }).parse(req.body ?? {});
  const cur = await byId('followups', id);
  if (!cur) throw new HttpError(404, 'Follow-up not found');
  const inq = await byId('inquiries', cur.inquiry_id);
  const now = nowIso();
  await patch('followups', id, { status: 'Completed', completed_at: now });
  await insert('inquiry_logs', {
    inquiry_id: cur.inquiry_id, kind: 'system', created_at: now,
    body: `Follow-up completed${cur.note ? ` (${cur.note})` : ''}${d.outcome ? ` — ${d.outcome}` : ''}`,
  });
  await logActivity('followup', `Follow-up completed: ${inq?.customer_name ?? 'client'}`, 'inquiry', cur.inquiry_id);
  res.json({ ok: true });
});

followupsRouter.post('/:id/reopen', async (req, res) => {
  await patch('followups', idParam(req.params.id), { status: 'Pending', completed_at: null });
  res.json({ ok: true });
});

followupsRouter.delete('/:id', async (req, res) => {
  await col('followups').deleteOne({ _id: idParam(req.params.id) as any });
  res.json({ ok: true });
});
