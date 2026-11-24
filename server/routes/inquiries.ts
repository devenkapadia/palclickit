import { Router } from 'express';
import { z } from 'zod';
import { byId, col, exists, insert, list, logActivity, nowIso, patch, one } from '../db.ts';
import { enrichInquiries, getEvent } from '../domain.ts';
import { EVENT_TYPES, INQUIRY_SOURCES, INQUIRY_STATUSES, LOG_KINDS, PACKAGE_CODES, PENDING_STATUS } from '../../shared/constants.ts';
import {
  HttpError, addHoursToTime, compareBy, idParam, optDate, optInt, optNum, optStr, optTime, phoneStr, pick, reqStr, searchFilter, today,
} from '../util.ts';

export const inquiriesRouter = Router();

const inquirySchema = z.object({
  customer_name: reqStr(120),
  phone: phoneStr,
  whatsapp: optStr(20),
  event_type: z.enum(EVENT_TYPES).default('Other'),
  event_date: optDate,
  start_time: optTime,
  duration_hours: optNum,
  venue_name: optStr(200),
  location: optStr(300),
  guest_count: optInt,
  package_code: z.enum(PACKAGE_CODES).default('Not Sure'),
  quoted_price: optNum,
  source: z.enum(INQUIRY_SOURCES).default('Other'),
  inquiry_date: optDate,
  status: z.enum(INQUIRY_STATUSES).default('New'),
  notes: optStr(5000),
});

const COLS = [
  'customer_name', 'phone', 'whatsapp', 'event_type', 'event_date', 'start_time', 'duration_hours', 'venue_name', 'location',
  'guest_count', 'package_code', 'quoted_price', 'source', 'inquiry_date', 'status', 'notes',
];

const SORT_KEYS: Record<string, (r: any) => string | number | null | undefined> = {
  event_date: (r) => r.event_date,
  inquiry_date: (r) => r.inquiry_date,
  followup_date: (r) => r.next_followup_key,
  quoted_price: (r) => r.quoted_price,
  customer_name: (r) => r.customer_name,
  status: (r) => r.status,
  created_at: (r) => r.created_at,
};

inquiriesRouter.get('/', async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const f: Record<string, any> = {};
  const and: any[] = [];
  if (q.search) and.push(searchFilter(q.search, ['customer_name', 'phone', 'whatsapp', 'venue_name', 'location']));
  for (const [key, field] of [['status', 'status'], ['event_type', 'event_type'], ['source', 'source'], ['package', 'package_code']] as const) {
    if (q[key]) f[field] = q[key];
  }
  const range = (field: string, from?: string, to?: string) => {
    if (from || to) f[field] = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  };
  range('event_date', q.event_from, q.event_to);
  range('inquiry_date', q.inquiry_from, q.inquiry_to);
  if (q.open === '1') f.status = 'New';
  // Completed inquiries (event done) are history: hidden unless the Completed status is explicitly filtered
  // or the caller (pipeline view) asks for them with include_completed=1.
  // Website requests still awaiting approval are never listed here — they live in /pending.
  else if (!q.status) f.status = { $nin: q.include_completed === '1' ? [PENDING_STATUS] : ['Completed', PENDING_STATUS] };
  else if (q.status === PENDING_STATUS) f.status = { $nin: [PENDING_STATUS] };
  if (and.length) f.$and = and;

  let rows = await enrichInquiries(await list('inquiries', f));
  if (q.overdue === '1') rows = rows.filter((r) => r.next_followup_date && r.next_followup_date < today());
  const keyFn = SORT_KEYS[q.sort ?? ''] ?? SORT_KEYS.created_at;
  rows.sort(compareBy(keyFn, q.dir === 'asc' ? 'asc' : 'desc'));
  res.json(rows);
});

// ---- website requests awaiting approval ---------------------------------------
inquiriesRouter.get('/pending', async (_req, res) => {
  res.json(await list('inquiries', { status: PENDING_STATUS }, { created_at: -1 }));
});

inquiriesRouter.post('/:id/approve', async (req, res) => {
  const id = idParam(req.params.id);
  const inq = await byId('inquiries', id);
  if (!inq || inq.status !== PENDING_STATUS) throw new HttpError(404, 'No pending request found');
  const now = nowIso();
  await patch('inquiries', id, { status: 'New', updated_at: now });
  await insert('inquiry_logs', { inquiry_id: id, kind: 'system', body: 'Website request approved', created_at: now });
  await logActivity('inquiry', `Website request approved: ${inq.customer_name}`, 'inquiry', id);
  res.json((await enrichInquiries([(await byId('inquiries', id))!]))[0]);
});

// Rejecting discards the request (spam / test / accidental) — nothing else references it yet.
inquiriesRouter.delete('/:id/reject', async (req, res) => {
  const id = idParam(req.params.id);
  const inq = await byId('inquiries', id);
  if (!inq || inq.status !== PENDING_STATUS) throw new HttpError(404, 'No pending request found');
  await col('inquiries').deleteOne({ _id: id as any });
  await logActivity('inquiry', `Website request discarded: ${inq.customer_name}`);
  res.json({ ok: true });
});

inquiriesRouter.post('/', async (req, res) => {
  const d = inquirySchema.parse(req.body);
  const now = nowIso();
  const id = await insert('inquiries', {
    customer_name: d.customer_name, phone: d.phone, whatsapp: d.whatsapp ?? null, event_type: d.event_type,
    event_date: d.event_date ?? null, start_time: d.start_time ?? null, duration_hours: d.duration_hours ?? null,
    venue_name: d.venue_name ?? null, location: d.location ?? null, guest_count: d.guest_count ?? null, package_code: d.package_code,
    quoted_price: d.quoted_price ?? null, source: d.source, inquiry_date: d.inquiry_date ?? today(), status: d.status,
    notes: d.notes ?? null, created_at: now, updated_at: now,
  });
  await logActivity('inquiry', `New inquiry from ${d.customer_name} (${d.source})`, 'inquiry', id);
  res.status(201).json((await enrichInquiries([(await byId('inquiries', id))!]))[0]);
});

async function loadDetail(id: number) {
  const base = await byId('inquiries', id);
  if (!base) throw new HttpError(404, 'Inquiry not found');
  const [inquiry] = await enrichInquiries([base]);
  const logs = await list('inquiry_logs', { inquiry_id: id }, { created_at: -1, _id: -1 });
  const followups = (await list('followups', { inquiry_id: id })).sort((a, b) =>
    (a.status === 'Completed' ? 1 : 0) - (b.status === 'Completed' ? 1 : 0) ||
    `${a.due_date} ${a.due_time ?? '99:99'}`.localeCompare(`${b.due_date} ${b.due_time ?? '99:99'}`));
  return { inquiry, logs, followups, event: inquiry.event_id ? await getEvent(inquiry.event_id) : null };
}

inquiriesRouter.get('/:id', async (req, res) => res.json(await loadDetail(idParam(req.params.id))));

inquiriesRouter.patch('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const before = await byId('inquiries', id);
  if (!before) throw new HttpError(404, 'Inquiry not found');
  const d = inquirySchema.partial().parse(req.body);
  await patch('inquiries', id, { ...pick(d, COLS), updated_at: nowIso() });
  if (d.status && d.status !== before.status) {
    await insert('inquiry_logs', { inquiry_id: id, kind: 'system', body: `Status changed: ${before.status} → ${d.status}`, created_at: nowIso() });
    await logActivity('status', `${before.customer_name}: ${before.status} → ${d.status}`, 'inquiry', id);
  }
  res.json(await loadDetail(id));
});

inquiriesRouter.delete('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const inq = await byId('inquiries', id);
  if (!inq) throw new HttpError(404, 'Inquiry not found');
  const ev = await one('events', { inquiry_id: id });
  // The booking is kept (link cleared) so financial history is never destroyed.
  if (ev) await col('events').updateOne({ _id: ev.id }, { $set: { inquiry_id: null } });
  await Promise.all([
    col('inquiry_logs').deleteMany({ inquiry_id: id }),
    col('followups').deleteMany({ inquiry_id: id }),
    col('inquiries').deleteOne({ _id: id as any }),
  ]);
  await logActivity('inquiry', `Inquiry from ${inq.customer_name} deleted${ev ? ' (booking retained)' : ''}`);
  res.json({ ok: true });
});

// ---- interaction logs --------------------------------------------------------
inquiriesRouter.post('/:id/logs', async (req, res) => {
  const id = idParam(req.params.id);
  if (!(await exists('inquiries', { _id: id }))) throw new HttpError(404, 'Inquiry not found');
  const d = z.object({ kind: z.enum(LOG_KINDS).default('note'), body: reqStr(3000) }).parse(req.body);
  await insert('inquiry_logs', { inquiry_id: id, kind: d.kind, body: d.body, created_at: nowIso() });
  await patch('inquiries', id, { updated_at: nowIso() });
  res.status(201).json(await loadDetail(id));
});

inquiriesRouter.delete('/:id/logs/:logId', async (req, res) => {
  const id = idParam(req.params.id);
  await col('inquiry_logs').deleteOne({ _id: idParam(req.params.logId) as any, inquiry_id: id });
  res.json(await loadDetail(id));
});

// ---- convert to booking -------------------------------------------------------
const convertSchema = z.object({
  final_amount: z.coerce.number().min(0),
  advance_paid: optNum,
  advance_method: optStr(40),
  event_date: optDate,
  start_time: optTime,
  duration_hours: optNum,
  venue_name: optStr(200),
  location: optStr(300),
  package_code: z.enum(PACKAGE_CODES).optional(),
  guest_count: optInt,
});

inquiriesRouter.post('/:id/convert', async (req, res) => {
  const id = idParam(req.params.id);
  const inq = await byId('inquiries', id);
  if (!inq) throw new HttpError(404, 'Inquiry not found');
  if (inq.status === PENDING_STATUS) throw new HttpError(409, 'Approve this website request before converting it');
  if (await exists('events', { inquiry_id: id })) throw new HttpError(409, 'This inquiry is already converted to a booking');
  const d = convertSchema.parse(req.body);

  const eventDate = d.event_date ?? inq.event_date;
  if (!eventDate) throw new HttpError(400, 'An event date is required to create a booking');
  const start = d.start_time ?? inq.start_time ?? null;
  const dur = d.duration_hours ?? inq.duration_hours ?? 4;
  const now = nowIso();

  let eventId: number;
  try {
    eventId = await insert('events', {
      inquiry_id: id, client_name: inq.customer_name, phone: inq.whatsapp || inq.phone, event_type: inq.event_type,
      event_date: eventDate, start_time: start, end_time: addHoursToTime(start, dur), duration_hours: dur,
      venue_name: d.venue_name ?? inq.venue_name ?? null, location: d.location ?? inq.location, guest_count: d.guest_count ?? inq.guest_count,
      package_code: d.package_code ?? inq.package_code, final_amount: d.final_amount, booking_status: 'Confirmed',
      event_notes: inq.notes, operational_notes: null, booth: null, staff: null, setup_time: null, completed_at: null,
      created_at: now, updated_at: now,
    });
  } catch (e: any) {
    if (e?.code === 11000) throw new HttpError(409, 'This inquiry is already converted to a booking');
    throw e;
  }
  if (d.advance_paid && d.advance_paid > 0) {
    await insert('event_payments', { event_id: eventId, amount: d.advance_paid, paid_on: today(), type: 'Advance', method: d.advance_method ?? null, note: null, created_at: now });
  }
  if (inq.status !== 'Confirmed') {
    await patch('inquiries', id, { status: 'Confirmed', updated_at: now });
    await insert('inquiry_logs', { inquiry_id: id, kind: 'system', body: `Status changed: ${inq.status} → Confirmed`, created_at: now });
  }
  // Pending follow-ups are no longer needed once the booking is confirmed.
  await col('followups').updateMany({ inquiry_id: id, status: 'Pending' }, { $set: { status: 'Completed', completed_at: now } });
  await insert('inquiry_logs', { inquiry_id: id, kind: 'system', body: `Converted to booking #${eventId}`, created_at: now });
  await logActivity('booking', `Booking confirmed: ${inq.customer_name} on ${eventDate}`, 'event', eventId);
  res.status(201).json(await getEvent(eventId));
});
