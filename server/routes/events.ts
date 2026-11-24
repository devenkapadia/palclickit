import { Router } from 'express';
import { z } from 'zod';
import { byId, col, exists, insert, list, logActivity, nowIso, patch } from '../db.ts';
import { getEvent, listEvents, syncInquiryWithBooking } from '../domain.ts';
import { generateInvoicePdf } from '../invoice.ts';
import { BOOKING_STATUSES, EVENT_TYPES, PACKAGE_CODES, PAYMENT_METHODS, PAYMENT_TYPES } from '../../shared/constants.ts';
import {
  HttpError, addHoursToTime, dateStr, idParam, optInt, optNum, optStr, optTime, phoneStr, pick, reqStr, searchFilter, today,
} from '../util.ts';

export const eventsRouter = Router();

const eventSchema = z.object({
  client_name: reqStr(120),
  phone: phoneStr,
  event_type: z.enum(EVENT_TYPES).default('Other'),
  event_date: dateStr,
  start_time: optTime,
  end_time: optTime,
  duration_hours: optNum,
  venue_name: optStr(200),
  location: optStr(300),
  guest_count: optInt,
  package_code: z.enum(PACKAGE_CODES).default('Custom'),
  final_amount: z.coerce.number().min(0),
  booking_status: z.enum(BOOKING_STATUSES).default('Confirmed'),
  event_notes: optStr(5000),
  operational_notes: optStr(5000),
  booth: optStr(100),
  staff: optStr(200),
  setup_time: optTime,
});

const COLS = [
  'client_name', 'phone', 'event_type', 'event_date', 'start_time', 'end_time', 'duration_hours', 'venue_name', 'location', 'guest_count',
  'package_code', 'final_amount', 'booking_status', 'event_notes', 'operational_notes', 'booth', 'staff', 'setup_time', 'completed_at',
];

eventsRouter.get('/', async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const f: Record<string, any> = {};
  const and: any[] = [];
  if (q.search) and.push(searchFilter(q.search, ['client_name', 'phone', 'venue_name', 'location']));
  if (q.status) f.booking_status = q.status;
  if (q.event_type) f.event_type = q.event_type;
  if (q.from || q.to) f.event_date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.scope === 'upcoming') {
    and.push({ event_date: { $gte: today() } }, { booking_status: { $nin: ['Completed', 'Cancelled'] } });
  }
  if (q.scope === 'past') and.push({ $or: [{ event_date: { $lt: today() } }, { booking_status: 'Completed' }] });
  if (and.length) f.$and = and;
  let rows = await listEvents(f, q.scope === 'past' ? { event_date: -1 } : { event_date: 1, start_time: 1 });
  if (q.payment_status) rows = rows.filter((r) => r.payment_status === q.payment_status);
  res.json(rows);
});

eventsRouter.post('/', async (req, res) => {
  const d = eventSchema.parse(req.body);
  const now = nowIso();
  const id = await insert('events', {
    inquiry_id: null, client_name: d.client_name, phone: d.phone, event_type: d.event_type, event_date: d.event_date,
    start_time: d.start_time ?? null, end_time: d.end_time ?? addHoursToTime(d.start_time, d.duration_hours),
    duration_hours: d.duration_hours ?? null, venue_name: d.venue_name ?? null, location: d.location ?? null, guest_count: d.guest_count ?? null,
    package_code: d.package_code, final_amount: d.final_amount, booking_status: d.booking_status,
    event_notes: d.event_notes ?? null, operational_notes: d.operational_notes ?? null, booth: d.booth ?? null,
    staff: d.staff ?? null, setup_time: d.setup_time ?? null,
    completed_at: d.booking_status === 'Completed' ? now : null, created_at: now, updated_at: now,
  });
  await logActivity('booking', `Booking added: ${d.client_name} on ${d.event_date}`, 'event', id);
  res.status(201).json(await getEvent(id));
});

async function detail(id: number) {
  const event = await getEvent(id);
  if (!event) throw new HttpError(404, 'Booking not found');
  const [payments, expenses] = await Promise.all([
    list('event_payments', { event_id: id }, { paid_on: 1, _id: 1 }),
    list('expenses', { event_id: id }, { spent_on: -1, _id: -1 }),
  ]);
  return { event, payments, expenses };
}

eventsRouter.get('/:id', async (req, res) => res.json(await detail(idParam(req.params.id))));

eventsRouter.get('/:id/invoice', async (req, res) => {
  const id = idParam(req.params.id);
  const { buffer, filename } = await generateInvoicePdf(id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

eventsRouter.patch('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const before = await byId('events', id);
  if (!before) throw new HttpError(404, 'Booking not found');
  const d = eventSchema.partial().parse(req.body);
  const data: Record<string, unknown> = { ...d };
  // Keep end time in sync when start/duration change but end time wasn't explicitly provided.
  if (!('end_time' in d) && ('start_time' in d || 'duration_hours' in d)) {
    data.end_time = addHoursToTime(d.start_time ?? before.start_time, d.duration_hours ?? before.duration_hours);
  }
  if (d.booking_status === 'Completed' && before.booking_status !== 'Completed') data.completed_at = nowIso();
  if (d.booking_status && d.booking_status !== 'Completed') data.completed_at = null;
  await patch('events', id, { ...pick(data, COLS), updated_at: nowIso() });
  if (d.booking_status && d.booking_status !== before.booking_status) {
    await syncInquiryWithBooking(before.inquiry_id, d.booking_status);
    await logActivity('booking', `${before.client_name}: booking ${before.booking_status} → ${d.booking_status}`, 'event', id);
  }
  res.json(await detail(id));
});

eventsRouter.delete('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const ev = await byId('events', id);
  if (!ev) throw new HttpError(404, 'Booking not found');
  await col('event_payments').deleteMany({ event_id: id });
  await col('expenses').updateMany({ event_id: id }, { $set: { event_id: null } }); // expenses are kept as business-wide
  await col('events').deleteOne({ _id: id as any });
  await logActivity('booking', `Booking deleted: ${ev.client_name} (${ev.event_date})`);
  res.json({ ok: true });
});

// ---- payments -----------------------------------------------------------------
const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paid_on: dateStr.optional(),
  type: z.enum(PAYMENT_TYPES).default('Partial'),
  method: z.enum(PAYMENT_METHODS).nullable().optional(),
  note: optStr(500),
});

eventsRouter.post('/:id/payments', async (req, res) => {
  const id = idParam(req.params.id);
  const ev = await getEvent(id);
  if (!ev) throw new HttpError(404, 'Booking not found');
  const d = paymentSchema.parse(req.body);
  await insert('event_payments', {
    event_id: id, amount: d.amount, paid_on: d.paid_on ?? today(), type: d.type, method: d.method ?? null,
    note: d.note ?? null, created_at: nowIso(),
  });
  await logActivity('payment', `₹${d.amount.toLocaleString('en-IN')} received from ${ev.client_name}`, 'event', id);
  res.status(201).json(await detail(id));
});

eventsRouter.patch('/:id/payments/:pid', async (req, res) => {
  const id = idParam(req.params.id);
  const pid = idParam(req.params.pid);
  if (!(await exists('event_payments', { _id: pid, event_id: id }))) throw new HttpError(404, 'Payment not found');
  await patch('event_payments', pid, pick(paymentSchema.partial().parse(req.body), ['amount', 'paid_on', 'type', 'method', 'note']));
  res.json(await detail(id));
});

eventsRouter.delete('/:id/payments/:pid', async (req, res) => {
  const id = idParam(req.params.id);
  await col('event_payments').deleteOne({ _id: idParam(req.params.pid) as any, event_id: id });
  res.json(await detail(id));
});
