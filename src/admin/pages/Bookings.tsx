import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Download, Plus, Search, Table2, X } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { fmtDate, fmtTime, inr } from '@/lib/format';
import { BOOKING_STATUSES, EVENT_TYPES, PAYMENT_STATUSES } from '@shared/constants';
import { Badge, Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner, Tabs } from '@/components/ui';
import { useAdmin, type Row } from '../ctx';
import CalendarView from './CalendarView';
import { ContactButtons, FilterBar, MiniLabel, Td, Th, useDebounced } from './shared';

const KEYS = ['search', 'status', 'event_type', 'payment_status', 'scope', 'from', 'to'] as const;

export default function Bookings() {
  const [sp, setSp] = useSearchParams();
  const { openEvent, addEvent } = useAdmin();
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [sort, setSort] = useState('event_date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const get = (k: string) => sp.get(k) ?? '';
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };
  const active = KEYS.some((k) => get(k));
  const search = useDebounced(get('search'));
  const params = { search, status: get('status'), event_type: get('event_type'), payment_status: get('payment_status'), scope: get('scope'), from: get('from'), to: get('to') };
  const { data, error, isLoading } = useQuery({ queryKey: ['events', params], queryFn: () => api.get<Row[]>(`/admin/events${qs(params)}`), placeholderData: (p) => p, enabled: view === 'table' });

  const onSort = (k: string) => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('asc'); } };
  const th = { sort, dir, onSort };
  const rows = data ? [...data].sort((a, b) => {
    const x = a[sort] ?? '', y = b[sort] ?? '';
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return dir === 'asc' ? c : -c;
  }) : [];
  const totals = rows.filter((r) => r.booking_status !== 'Cancelled').reduce((t, r) => ({ amount: t.amount + r.final_amount, paid: t.paid + r.paid, remaining: t.remaining + r.remaining }), { amount: 0, paid: 0, remaining: 0 });

  return (
    <>
      <PageHeader title="Bookings / Events" sub={view === 'table' && data ? `${rows.length} shown · ${inr(totals.amount)} booked · ${inr(totals.paid)} received · ${inr(totals.remaining)} pending` : undefined}
        actions={<>
          <Tabs value={view} onChange={setView} options={[{ value: 'table', label: <span className="flex items-center gap-1.5"><Table2 className="size-4" /> Table</span> }, { value: 'calendar', label: <span className="flex items-center gap-1.5"><CalendarDays className="size-4" /> Calendar</span> }]} />
          <Button onClick={addEvent}><Plus className="size-4" /> Add booking</Button>
        </>} />

      {view === 'calendar' ? <CalendarView followups={false} /> : (
        <>
          <FilterBar>
            <div className="sm:col-span-2"><MiniLabel>Search client, phone or location</MiniLabel>
              <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-8" value={get('search')} onChange={(e) => set('search', e.target.value)} placeholder="Search…" /></div></div>
            <div><MiniLabel>When</MiniLabel><Select value={get('scope')} onChange={(e) => set('scope', e.target.value)}><option value="">All</option><option value="upcoming">Upcoming</option><option value="past">Past events</option></Select></div>
            <div><MiniLabel>Booking status</MiniLabel><Select value={get('status')} onChange={(e) => set('status', e.target.value)}><option value="">All</option>{BOOKING_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></div>
            <div><MiniLabel>Payment</MiniLabel><Select value={get('payment_status')} onChange={(e) => set('payment_status', e.target.value)}><option value="">All</option>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></div>
            <div><MiniLabel>Event type</MiniLabel><Select value={get('event_type')} onChange={(e) => set('event_type', e.target.value)}><option value="">All</option>{EVENT_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></div>
            <div><MiniLabel>Date from</MiniLabel><Input type="date" value={get('from')} onChange={(e) => set('from', e.target.value)} /></div>
            <div><MiniLabel>Date to</MiniLabel><Input type="date" value={get('to')} onChange={(e) => set('to', e.target.value)} /></div>
            {active && <div className="flex items-end"><Button size="sm" variant="ghost" onClick={() => setSp({}, { replace: true })}><X className="size-4" /> Clear</Button></div>}
          </FilterBar>

          {error ? <ErrorBox error={error} /> : isLoading || !data ? <Spinner /> : rows.length === 0 ? (
            <Card><Empty title={active ? 'No bookings match these filters' : 'No bookings yet'} hint={active ? undefined : 'Convert a confirmed inquiry into a booking, or add one directly.'} /></Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="border-b border-slate-100 bg-slate-50/70"><tr>
                  <Th label="Client" sortKey="client_name" {...th} />
                  <Th label="Event" sortKey="event_type" {...th} />
                  <Th label="Date" sortKey="event_date" {...th} />
                  <Th label="Location" />
                  <Th label="Package" />
                  <Th label="Amount" sortKey="final_amount" {...th} />
                  <Th label="Paid" sortKey="paid" {...th} />
                  <Th label="Pending" sortKey="remaining" {...th} />
                  <Th label="Payment" />
                  <Th label="Status" sortKey="booking_status" {...th} />
                  <Th label="" />
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => openEvent(r.id)} className="cursor-pointer hover:bg-slate-50">
                      <Td><div className="font-semibold">{r.client_name}</div><div className="text-xs text-slate-400">#{r.id} · {r.phone}</div></Td>
                      <Td>{r.event_type}</Td>
                      <Td className="whitespace-nowrap">{fmtDate(r.event_date)}<div className="text-xs text-slate-400">{fmtTime(r.start_time)}</div></Td>
                      <Td className="max-w-[170px] truncate"><div className="font-medium truncate">{r.venue_name || r.location || '—'}</div>{r.venue_name && r.location && <div className="text-xs text-slate-400 truncate">{r.location}</div>}</Td>
                      <Td>{r.package_code}</Td>
                      <Td className="whitespace-nowrap font-medium">{inr(r.final_amount)}</Td>
                      <Td className="whitespace-nowrap text-good">{inr(r.paid)}</Td>
                      <Td className={`whitespace-nowrap ${r.remaining > 0 && r.booking_status !== 'Cancelled' ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{inr(r.remaining)}</Td>
                      <Td><Badge tone={r.payment_status}>{r.payment_status}</Badge></Td>
                      <Td><Badge>{r.booking_status}</Badge></Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                          {['Confirmed', 'Completed'].includes(r.booking_status) && (
                            <a
                              href={`/api/admin/events/${r.id}/invoice`}
                              download
                              title="Download Invoice"
                              aria-label="Download Invoice"
                              className="inline-flex size-8 items-center justify-center rounded-lg bg-navy/10 text-navy transition hover:bg-navy/20"
                            >
                              <Download className="size-4" />
                            </a>
                          )}
                          <ContactButtons phone={r.phone} />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </>
  );
}
