import { Router } from 'express';
import { list } from '../db.ts';
import { listEvents } from '../domain.ts';
import { computeFinance } from '../finance.ts';
import { withInquiry } from './followups.ts';
import { INQUIRY_STATUSES } from '../../shared/constants.ts';
import { today } from '../util.ts';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req, res) => {
  const t = today();
  const [inquiries, pendingAll, events, fin, recent] = await Promise.all([
    list<{ status: string; inquiry_date: string }>('inquiries'),
    list('followups', { status: 'Pending', due_date: { $lte: t } }),
    listEvents(),
    computeFinance(),
    list('activity_log', {}, { _id: -1 }, 15),
  ]);
  const byStatus = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s, inquiries.filter((i) => i.status === s).length]));

  const key = (f: any) => `${f.due_date} ${f.due_time ?? '99:99'}`;
  const pending = (await withInquiry(pendingAll)).sort((a, b) => key(a).localeCompare(key(b)));
  const dueToday = pending.filter((f) => f.due_date === t);
  const overdue = pending.filter((f) => f.due_date < t);

  const active = events.filter((e) => e.booking_status !== 'Cancelled');
  const upcoming = active.filter((e) => e.event_date >= t && e.booking_status !== 'Completed');
  const completed = active.filter((e) => e.booking_status === 'Completed');
  const weekAgo = today(-7);

  res.json({
    metrics: {
      total_inquiries: inquiries.length - byStatus['Completed'],
      new_inquiries: byStatus['New'],
      new_this_week: inquiries.filter((i) => i.inquiry_date >= weekAgo && i.status !== 'Completed').length,
      followups_due: dueToday.length + overdue.length,
      followups_overdue: overdue.length,
      confirmed_bookings: active.filter((e) => ['Confirmed', 'Upcoming', 'In Progress'].includes(e.booking_status)).length,
      upcoming_events: upcoming.length,
      completed_events: completed.length,
      total_revenue: fin.summary.booked_revenue,
      cash_received: fin.summary.cash_received,
      outstanding: fin.summary.outstanding,
      total_expenses: fin.summary.total_expenses,
      net_profit: fin.summary.net_profit,
    },
    pipeline: INQUIRY_STATUSES.map((s) => ({ status: s, count: byStatus[s] })),
    monthly: fin.monthly,
    upcoming: upcoming.slice(0, 6),
    followups: { today: dueToday, overdue },
    recent,
  });
});

export const financeRouter = Router();
financeRouter.get('/', async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(await computeFinance(from || undefined, to || undefined));
});

// ---- Calendar feed ---------------------------------------------------------------
export const calendarRouter = Router();
calendarRouter.get('/', async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const range = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const evFilter = Object.keys(range).length ? { event_date: range } : {};
  const fuFilter = Object.keys(range).length ? { status: 'Pending', due_date: range } : { status: 'Pending' };
  const [events, followups] = await Promise.all([listEvents(evFilter), list('followups', fuFilter).then(withInquiry)]);
  res.json([
    ...events.map((e) => ({
      kind: 'event' as const, id: e.id, date: e.event_date, time: e.start_time, title: e.client_name,
      subtitle: `${e.event_type}${e.location ? ' · ' + e.location : ''}`, status: e.booking_status,
    })),
    ...followups.map((f) => ({
      kind: 'followup' as const, id: f.id, inquiry_id: f.inquiry_id, date: f.due_date, time: f.due_time,
      title: f.customer_name, subtitle: f.note ?? 'Follow-up', status: 'Pending',
    })),
  ]);
});
