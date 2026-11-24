import { Router } from 'express';
import { list } from '../db.ts';
import { listEvents } from '../domain.ts';
import { computeFinance } from '../finance.ts';
import { HttpError } from '../util.ts';
import { PENDING_STATUS } from '../../shared/constants.ts';

export const reportsRouter = Router();

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns: [string, string][], rows: Record<string, any>[]): string {
  const head = columns.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((r) => columns.map(([k]) => csvCell(r[k])).join(','));
  return '\ufeff' + [head, ...body].join('\r\n');
}

type Report = { columns: [string, string][]; rows: (from?: string, to?: string) => Promise<Record<string, any>[]> };

const between = (col: string, from?: string, to?: string) => (r: any) => (!from || r[col] >= from) && (!to || r[col] <= to);

function bookingCols(): [string, string][] {
  return [['id', 'ID'], ['client_name', 'Client'], ['phone', 'Phone'], ['event_type', 'Event Type'], ['event_date', 'Date'],
    ['start_time', 'Start'], ['end_time', 'End'], ['location', 'Location'], ['guest_count', 'Guests'], ['package_code', 'Package'],
    ['final_amount', 'Amount'], ['paid', 'Received'], ['remaining', 'Remaining'], ['payment_status', 'Payment Status'],
    ['booking_status', 'Booking Status'], ['expenses_total', 'Expenses'], ['estimated_profit', 'Estimated Profit'],
    ['realized_profit', 'Realized Profit']];
}

const REPORTS: Record<string, Report> = {
  inquiries: {
    columns: [['id', 'ID'], ['customer_name', 'Customer'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp'], ['event_type', 'Event Type'],
      ['event_date', 'Event Date'], ['location', 'Location'], ['guest_count', 'Guests'], ['package_code', 'Package'],
      ['quoted_price', 'Quoted Price'], ['source', 'Source'], ['inquiry_date', 'Inquiry Date'], ['status', 'Status'], ['notes', 'Notes']],
    rows: async (f, t) => (await list('inquiries', { status: { $ne: PENDING_STATUS } }, { inquiry_date: -1 })).filter(between('inquiry_date', f, t)),
  },
  bookings: {
    columns: bookingCols(),
    rows: async (f, t) => (await listEvents()).filter((e) => e.booking_status !== 'Cancelled').filter(between('event_date', f, t)),
  },
  completed: {
    columns: bookingCols(),
    rows: async (f, t) => (await listEvents()).filter((e) => e.booking_status === 'Completed').filter(between('event_date', f, t)),
  },
  expenses: {
    columns: [['id', 'ID'], ['spent_on', 'Date'], ['name', 'Description'], ['category', 'Category'], ['amount', 'Amount'],
      ['event_name', 'Event'], ['payment_method', 'Method'], ['notes', 'Notes']],
    rows: async (f, t) => {
      const [exps, evs] = await Promise.all([list('expenses', {}, { spent_on: -1 }), list('events')]);
      const name = new Map(evs.map((e) => [e.id, e.client_name]));
      return exps.filter(between('spent_on', f, t)).map((x) => ({ ...x, event_name: x.event_id ? name.get(x.event_id) ?? '' : '' }));
    },
  },
  outstanding: {
    columns: [['client_name', 'Client'], ['phone', 'Phone'], ['event_date', 'Event Date'], ['booking_status', 'Booking Status'],
      ['final_amount', 'Booked'], ['paid', 'Received'], ['remaining', 'Outstanding'], ['payment_status', 'Payment Status']],
    rows: async (f, t) => (await listEvents()).filter((e) => e.booking_status !== 'Cancelled' && e.remaining > 0).filter(between('event_date', f, t)),
  },
  'event-breakdown': {
    columns: [['id', 'ID'], ['event_date', 'Date'], ['client_name', 'Client'], ['event_type', 'Type'], ['booking_status', 'Status'],
      ['booked', 'Booked'], ['received', 'Received'], ['remaining', 'Outstanding'], ['expenses', 'Expenses'],
      ['estimated_profit', 'Estimated Profit'], ['realized_profit', 'Realized Profit']],
    rows: async (f, t) => (await computeFinance(f, t)).events,
  },
  'monthly-finance': {
    columns: [['month', 'Month'], ['booked', 'Booked Revenue'], ['received', 'Cash Received'], ['expenses', 'Expenses'],
      ['profit', 'Net Profit (cash)'], ['estimated_profit', 'Estimated Profit']],
    rows: async (f, t) => (await computeFinance(f, t)).monthly,
  },
};

reportsRouter.get('/:name', async (req, res) => {
  const rep = REPORTS[req.params.name];
  if (!rep) throw new HttpError(404, 'Unknown report');
  const { from, to, format } = req.query as Record<string, string | undefined>;
  const rows = await rep.rows(from || undefined, to || undefined);
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pal-${req.params.name}-${from ?? 'all'}_${to ?? 'all'}.csv"`);
    return res.send(toCsv(rep.columns, rows));
  }
  res.json({ columns: rep.columns, rows });
});
