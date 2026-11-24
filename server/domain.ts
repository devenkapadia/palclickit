import type { Sort } from 'mongodb';
import { col, list, byId, insert, patch, nowIso, type Doc } from './db.ts';

/**
 * Event rows enriched with money fields.
 *  paid           = sum of recorded payments (cash actually received)
 *  expenses_total = expenses linked to the event
 *  payment_status is derived, never stored, so it can't drift from the payment records.
 */
export interface EventRow extends Doc {
  id: number;
  inquiry_id: number | null;
  client_name: string;
  phone: string;
  event_type: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_hours?: number | null;
  venue_name?: string | null;
  location: string | null;
  guest_count?: number | null;
  package_code?: string;
  final_amount: number;
  booking_status: string;
  booth?: string | null;
  staff?: string | null;
  setup_time?: string | null;
  event_notes?: string | null;
  operational_notes?: string | null;
  paid: number;
  expenses_total: number;
  non_advance_payments: number;
}

async function groupSums(collection: string, ids: number[], extra: Doc = {}) {
  const rows = await col(collection)
    .aggregate([
      { $match: { event_id: { $in: ids } } },
      { $group: { _id: '$event_id', total: { $sum: '$amount' }, ...extra } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id as number, r]));
}

export async function enrichEvents(events: Doc[]): Promise<EventRow[]> {
  if (!events.length) return [];
  const ids = events.map((e) => e.id as number);
  const [pay, exp] = await Promise.all([
    groupSums('event_payments', ids, { nonAdvance: { $sum: { $cond: [{ $ne: ['$type', 'Advance'] }, 1, 0] } } }),
    groupSums('expenses', ids),
  ]);
  return events.map((e) => ({
    ...e,
    paid: pay.get(e.id)?.total ?? 0,
    non_advance_payments: pay.get(e.id)?.nonAdvance ?? 0,
    expenses_total: exp.get(e.id)?.total ?? 0,
  })) as EventRow[];
}

export function decorateEvent(e: EventRow) {
  const paid = e.paid;
  const remaining = Math.max(0, e.final_amount - paid);
  let payment_status: string;
  if (paid <= 0) payment_status = 'Unpaid';
  else if (e.final_amount > 0 && paid >= e.final_amount) payment_status = 'Fully Paid';
  else if (e.non_advance_payments > 0) payment_status = 'Partially Paid';
  else payment_status = 'Advance Paid';

  return {
    ...e,
    remaining,
    payment_status,
    // Estimated profit: what we expect to earn (booked amount − expenses).
    estimated_profit: e.final_amount - e.expenses_total,
    // Realized profit: only once the event is completed — cash actually received − expenses.
    realized_profit: e.booking_status === 'Completed' ? paid - e.expenses_total : null,
  };
}

export type DecoratedEvent = ReturnType<typeof decorateEvent>;

export async function listEvents(filter: Doc = {}, sort: Sort = { event_date: 1, start_time: 1 }): Promise<DecoratedEvent[]> {
  return (await enrichEvents(await list('events', filter, sort))).map(decorateEvent);
}

export async function getEvent(id: number): Promise<DecoratedEvent | undefined> {
  const e = await byId('events', id);
  if (!e) return undefined;
  return decorateEvent((await enrichEvents([e]))[0]);
}

/**
 * Keeps the linked inquiry in step with its booking: a Completed booking moves its inquiry to 'Completed'
 * (so it leaves the open inquiry list); un-completing the booking restores it to 'Confirmed'.
 */
export async function syncInquiryWithBooking(inquiryId: number | null | undefined, bookingStatus: string) {
  if (!inquiryId) return;
  const inq = await byId('inquiries', inquiryId);
  if (!inq) return;
  const target = bookingStatus === 'Completed' ? 'Completed' : inq.status === 'Completed' ? 'Confirmed' : null;
  if (!target || inq.status === target) return;
  const now = nowIso();
  await patch('inquiries', inquiryId, { status: target, updated_at: now });
  await insert('inquiry_logs', { inquiry_id: inquiryId, kind: 'system', body: `Status changed: ${inq.status} → ${target}`, created_at: now });
}

/** Inquiry statuses that were merged into simpler ones; migrates existing rows (safe to run repeatedly). */
const LEGACY_INQUIRY_STATUSES: Record<string, string> = {
  Contacted: 'New',
  'Follow-up Required': 'New',
  'Follow-up': 'New',
  'Awaiting Client': 'New',
  Negotiation: 'New',
  Cancelled: 'Lost',
};
export async function migrateLegacyInquiryStatuses() {
  for (const [from, to] of Object.entries(LEGACY_INQUIRY_STATUSES)) {
    await col('inquiries').updateMany({ status: from }, { $set: { status: to } });
  }
}

/** One-off catch-up for bookings that were completed before inquiries tracked this. */
export async function backfillCompletedInquiries() {
  const done = await list('events', { booking_status: 'Completed', inquiry_id: { $type: 'number' } });
  for (const e of done) await syncInquiryWithBooking(e.inquiry_id, 'Completed');
}

/** Inquiries enriched with their next pending follow-up and linked booking id. */
export async function enrichInquiries(rows: Doc[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id as number);
  const [fus, evs] = await Promise.all([
    list('followups', { status: 'Pending', inquiry_id: { $in: ids } }, { due_date: 1, due_time: 1 }),
    list('events', { inquiry_id: { $in: ids } }),
  ]);
  const key = (f: Doc) => `${f.due_date} ${f.due_time ?? '99:99'}`;
  const next = new Map<number, Doc>();
  for (const f of fus) {
    const cur = next.get(f.inquiry_id);
    if (!cur || key(f) < key(cur)) next.set(f.inquiry_id, f);
  }
  const evBy = new Map(evs.map((e) => [e.inquiry_id as number, e.id as number]));
  return rows.map((r) => {
    const f = next.get(r.id);
    return {
      ...r,
      next_followup_key: f ? key(f) : null,
      next_followup_date: f?.due_date ?? null,
      next_followup_time: f?.due_time ?? null,
      next_followup_note: f?.note ?? null,
      event_id: evBy.get(r.id) ?? null,
    };
  });
}
