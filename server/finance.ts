import { list } from './db.ts';
import { listEvents } from './domain.ts';

/**
 * Money model
 *  - Booked revenue : final_amount of non-cancelled bookings whose EVENT DATE is in range.
 *  - Cash received  : payments whose PAID-ON date is in range (real cash flow).
 *  - Outstanding    : remaining balance (booked − paid) on non-cancelled bookings in range.
 *  - Expenses       : expenses whose SPENT-ON date is in range (event-linked + general).
 *  - Net profit     : cash received − expenses  (realized, cash basis).
 *  - Estimated profit: booked revenue − expenses.
 *  - Event profit   : per event, booked − event expenses (estimated) and, once Completed, paid − event expenses (realized).
 */
export async function computeFinance(from?: string, to?: string) {
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);

  const allEvents = await listEvents();
  const events = allEvents.filter((e) => inRange(e.event_date));
  const live = events.filter((e) => e.booking_status !== 'Cancelled');
  const liveIds = new Set(allEvents.filter((e) => e.booking_status !== 'Cancelled').map((e) => e.id));

  const payments = (await list<{ amount: number; paid_on: string; event_id: number }>('event_payments'))
    .filter((p) => liveIds.has(p.event_id) && inRange(p.paid_on));
  const expenses = (await list<{ amount: number; spent_on: string; event_id: number | null; category: string }>('expenses'))
    .filter((x) => inRange(x.spent_on));

  const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
  const booked = sum(live.map((e) => e.final_amount));
  const received = sum(payments.map((p) => p.amount));
  const outstanding = sum(live.map((e) => e.remaining));
  const totalExpenses = sum(expenses.map((x) => x.amount));
  const eventExpenses = sum(expenses.filter((x) => x.event_id).map((x) => x.amount));
  const completed = live.filter((e) => e.booking_status === 'Completed');

  const months = new Map<string, { month: string; booked: number; received: number; expenses: number }>();
  const slot = (d: string) => {
    const m = d.slice(0, 7);
    if (!months.has(m)) months.set(m, { month: m, booked: 0, received: 0, expenses: 0 });
    return months.get(m)!;
  };
  live.forEach((e) => (slot(e.event_date).booked += e.final_amount));
  payments.forEach((p) => (slot(p.paid_on).received += p.amount));
  expenses.forEach((x) => (slot(x.spent_on).expenses += x.amount));
  const monthly = [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, profit: m.received - m.expenses, estimated_profit: m.booked - m.expenses }));

  const byCategory: Record<string, number> = {};
  expenses.forEach((x) => (byCategory[x.category] = (byCategory[x.category] ?? 0) + x.amount));

  return {
    range: { from: from ?? null, to: to ?? null },
    summary: {
      events: live.length,
      completed_events: completed.length,
      booked_revenue: booked,
      cash_received: received,
      outstanding,
      total_expenses: totalExpenses,
      event_expenses: eventExpenses,
      general_expenses: totalExpenses - eventExpenses,
      net_profit: received - totalExpenses,
      estimated_profit: booked - totalExpenses,
      avg_revenue_per_event: live.length ? booked / live.length : 0,
      avg_profit_per_event: live.length ? sum(live.map((e) => e.estimated_profit)) / live.length : 0,
    },
    monthly,
    byCategory,
    events: events.map((e) => ({
      id: e.id,
      client_name: e.client_name,
      event_type: e.event_type,
      event_date: e.event_date,
      booking_status: e.booking_status,
      payment_status: e.payment_status,
      booked: e.booking_status === 'Cancelled' ? 0 : e.final_amount,
      received: e.paid,
      remaining: e.booking_status === 'Cancelled' ? 0 : e.remaining,
      expenses: e.expenses_total,
      estimated_profit: e.estimated_profit,
      realized_profit: e.realized_profit,
    })),
  };
}
