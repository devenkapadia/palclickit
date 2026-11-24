import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, qs } from '@/lib/api';
import { fmtDate, fmtMonth, inr, monthRange, yearRange } from '@/lib/format';
import { Badge, Card, CardHeader, Empty, ErrorBox, Field, Input, PageHeader, Spinner, Stat, Tabs } from '@/components/ui';
import { useAdmin, type Row } from '../ctx';
import { CHART_COLORS, Td, Th } from './shared';

type Preset = 'month' | 'last' | 'year' | 'all' | 'custom';

export default function Finance() {
  const { openEvent } = useAdmin();
  const [preset, setPreset] = useState<Preset>('year');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const range = preset === 'month' ? monthRange(0) : preset === 'last' ? monthRange(-1) : preset === 'year' ? yearRange() : preset === 'custom' ? custom : { from: '', to: '' };
  const { data, error, isLoading } = useQuery({ queryKey: ['finance', range], queryFn: () => api.get<Row>(`/admin/finance${qs(range)}`), placeholderData: (p) => p });
  const [sort, setSort] = useState('event_date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const onSort = (k: string) => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('desc'); } };

  const s = data?.summary as Record<string, number> | undefined;
  const monthly = ((data?.monthly ?? []) as Row[]).map((m) => ({ ...m, label: fmtMonth(m.month) }));
  const events: Row[] = data ? [...data.events].sort((a, b) => {
    const x = a[sort] ?? -Infinity, y = b[sort] ?? -Infinity;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return dir === 'asc' ? c : -c;
  }) : [];
  const th = { sort, dir, onSort };

  return (
    <>
      <PageHeader title="Finance" sub="Booked revenue is what you've sold; cash received is what's actually in hand."
        actions={<Tabs value={preset} onChange={setPreset} options={[{ value: 'month', label: 'This month' }, { value: 'last', label: 'Last month' }, { value: 'year', label: 'This year' }, { value: 'all', label: 'All time' }, { value: 'custom', label: 'Custom' }]} />} />

      {preset === 'custom' && (
        <div className="mb-4 flex max-w-md gap-3">
          <Field label="From" className="flex-1"><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
          <Field label="To" className="flex-1"><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
        </div>
      )}

      {error ? <ErrorBox error={error} /> : isLoading || !s ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Booked revenue" value={inr(s.booked_revenue)} sub={`${s.events} events · ${s.completed_events} completed`} />
            <Stat label="Cash received" value={inr(s.cash_received)} tone="good" sub="Payments in this period" />
            <Stat label="Outstanding" value={inr(s.outstanding)} tone={s.outstanding > 0 ? 'warn' : undefined} sub="Still to collect" />
            <Stat label="Total expenses" value={inr(s.total_expenses)} sub={`Events ${inr(s.event_expenses)} · General ${inr(s.general_expenses)}`} />
            <Stat label="Net profit (realized)" value={inr(s.net_profit)} tone={s.net_profit < 0 ? 'bad' : 'good'} sub="Cash received − expenses" />
            <Stat label="Estimated profit" value={inr(s.estimated_profit)} tone={s.estimated_profit < 0 ? 'bad' : undefined} sub="Booked − expenses" />
            <Stat label="Avg revenue / event" value={inr(Math.round(s.avg_revenue_per_event))} />
            <Stat label="Avg profit / event" value={inr(Math.round(s.avg_profit_per_event))} sub="Booked − event expenses" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Revenue vs expenses" sub="By month" />
              <div className="h-72 px-2 py-3">
                {monthly.length === 0 ? <Empty title="No data in this period" /> : (
                  <ResponsiveContainer>
                    <BarChart data={monthly}>
                      <CartesianGrid vertical={false} stroke="#eee" />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => inr(v, true)} width={56} />
                      <Tooltip formatter={(v) => inr(Number(v))} />
                      <Legend />
                      <Bar dataKey="booked" name="Booked" fill={CHART_COLORS.sky} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="received" name="Received" fill={CHART_COLORS.good} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.bad} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Profit" sub="Realized (cash) vs estimated (booked)" />
              <div className="h-72 px-2 py-3">
                {monthly.length === 0 ? <Empty title="No data in this period" /> : (
                  <ResponsiveContainer>
                    <LineChart data={monthly}>
                      <CartesianGrid vertical={false} stroke="#eee" />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => inr(v, true)} width={56} />
                      <Tooltip formatter={(v) => inr(Number(v))} />
                      <Legend />
                      <Line type="monotone" dataKey="profit" name="Net profit" stroke={CHART_COLORS.navy} strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="estimated_profit" name="Estimated" stroke={CHART_COLORS.warn} strokeDasharray="5 4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card className="mt-5 overflow-x-auto">
            <CardHeader title="Event-wise breakdown" sub="Realized profit appears once an event is marked Completed" />
            {events.length === 0 ? <Empty title="No events in this period" /> : (
              <table className="w-full min-w-[920px]">
                <thead className="border-b border-slate-100 bg-slate-50/70"><tr>
                  <Th label="Event" sortKey="client_name" {...th} />
                  <Th label="Date" sortKey="event_date" {...th} />
                  <Th label="Status" />
                  <Th label="Booked" sortKey="booked" {...th} className="text-right" />
                  <Th label="Received" sortKey="received" {...th} className="text-right" />
                  <Th label="Pending" sortKey="remaining" {...th} className="text-right" />
                  <Th label="Expenses" sortKey="expenses" {...th} className="text-right" />
                  <Th label="Est. profit" sortKey="estimated_profit" {...th} className="text-right" />
                  <Th label="Realized" sortKey="realized_profit" {...th} className="text-right" />
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((e) => (
                    <tr key={e.id} onClick={() => openEvent(e.id)} className="cursor-pointer hover:bg-slate-50">
                      <Td><div className="font-semibold">{e.client_name}</div><div className="text-xs text-slate-400">{e.event_type}</div></Td>
                      <Td className="whitespace-nowrap">{fmtDate(e.event_date)}</Td>
                      <Td><div className="flex flex-col items-start gap-1"><Badge>{e.booking_status}</Badge><Badge tone={e.payment_status}>{e.payment_status}</Badge></div></Td>
                      <Td className="text-right">{inr(e.booked)}</Td>
                      <Td className="text-right text-good">{inr(e.received)}</Td>
                      <Td className="text-right">{e.remaining > 0 ? <span className="font-semibold text-amber-700">{inr(e.remaining)}</span> : <span className="text-slate-300">—</span>}</Td>
                      <Td className="text-right">{inr(e.expenses)}</Td>
                      <Td className={`text-right font-semibold ${e.estimated_profit < 0 ? 'text-bad' : ''}`}>{inr(e.estimated_profit)}</Td>
                      <Td className={`text-right font-semibold ${e.realized_profit == null ? 'text-slate-300' : e.realized_profit < 0 ? 'text-bad' : 'text-good'}`}>{e.realized_profit == null ? '—' : inr(e.realized_profit)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {data && Object.keys(data.byCategory).length > 0 && (
            <Card className="mt-5">
              <CardHeader title="Expenses by category" />
              <div className="grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.entries(data.byCategory) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                  <div key={c} className="flex justify-between border-b border-slate-100 pb-1.5 text-sm"><span>{c}</span><span className="font-semibold">{inr(v)}</span></div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
