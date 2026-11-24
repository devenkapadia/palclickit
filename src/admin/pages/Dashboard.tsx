import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarClock, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtMonth, fmtTime, inr, timeAgo } from '@/lib/format';
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, PageHeader, Spinner, Stat, STATUS_DOT } from '@/components/ui';
import { useAdmin, type Row } from '../ctx';
import { CHART_COLORS, ContactButtons } from './shared';

export default function Dashboard() {
  const nav = useNavigate();
  const { addInquiry, openInquiry, openEvent, user } = useAdmin();
  const { data, error, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Row>('/admin/dashboard') });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  const m = data.metrics as Record<string, number>;
  const fu: Row[] = [...data.followups.overdue, ...data.followups.today];
  const monthly = (data.monthly as Row[]).slice(-12).map((r) => ({ ...r, label: fmtMonth(r.month) }));

  return (
    <>
      <PageHeader title={`Hello, ${user.name || 'there'}`} sub="Here's where PAL stands today."
        actions={<Button onClick={() => addInquiry()}><Plus className="size-4" /> Add Inquiry</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total inquiries" value={m.total_inquiries} sub={`${m.new_this_week} this week`} onClick={() => nav('/admin/inquiries')} />
        <Stat label="New inquiries" value={m.new_inquiries} onClick={() => nav('/admin/inquiries?status=New')} />
        <Stat label="Follow-ups due" value={m.followups_due} tone={m.followups_overdue ? 'bad' : undefined} sub={m.followups_overdue ? `${m.followups_overdue} overdue` : 'today + overdue'} onClick={() => nav('/admin/followups')} />
        <Stat label="Confirmed bookings" value={m.confirmed_bookings} onClick={() => nav('/admin/bookings')} />
        <Stat label="Upcoming events" value={m.upcoming_events} onClick={() => nav('/admin/bookings?scope=upcoming')} />
        <Stat label="Completed events" value={m.completed_events} onClick={() => nav('/admin/bookings?status=Completed')} />
        <Stat label="Booked revenue" value={inr(m.total_revenue)} sub={`Received ${inr(m.cash_received)} · Pending ${inr(m.outstanding)}`} onClick={() => nav('/admin/finance')} />
        <Stat label="Total expenses" value={inr(m.total_expenses)} onClick={() => nav('/admin/expenses')} />
        <Stat label="Net profit" value={inr(m.net_profit)} tone={m.net_profit < 0 ? 'bad' : 'good'} sub="Cash received − expenses" onClick={() => nav('/admin/finance')} />
        <Stat label="Outstanding" value={inr(m.outstanding)} tone={m.outstanding > 0 ? 'warn' : undefined} sub="Still to collect" onClick={() => nav('/admin/bookings?payment_status=Unpaid')} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Follow-ups due" sub="Overdue and today" action={<Button size="sm" variant="ghost" onClick={() => nav('/admin/followups')}>View all</Button>} />
          {fu.length === 0 ? <Empty title="You're all caught up" hint="No follow-ups are due today." /> : (
            <ul className="divide-y divide-slate-100">
              {fu.slice(0, 7).map((f) => {
                const late = (data.followups.overdue as Row[]).some((o) => o.id === f.id);
                return (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button className="min-w-0 flex-1 text-left" onClick={() => openInquiry(f.inquiry_id)}>
                      <div className="truncate text-sm font-semibold">{f.customer_name}</div>
                      <div className={late ? 'text-xs font-semibold text-bad' : 'text-xs text-slate-500'}>
                        {late && <AlertTriangle className="mr-1 inline size-3" />}
                        {late ? `Overdue since ${fmtDate(f.due_date, false)}` : `Today ${fmtTime(f.due_time)}`}{f.note ? ` · ${f.note}` : ''}
                      </div>
                    </button>
                    <ContactButtons phone={f.phone} whatsapp={f.whatsapp} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming events" action={<Button size="sm" variant="ghost" onClick={() => nav('/admin/bookings?scope=upcoming')}>View all</Button>} />
          {data.upcoming.length === 0 ? <Empty title="No upcoming events" hint="Confirmed bookings will show up here." /> : (
            <ul className="divide-y divide-slate-100">
              {(data.upcoming as Row[]).map((e) => (
                <li key={e.id}>
                  <button onClick={() => openEvent(e.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                    <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-sun/70 text-center leading-none">
                      <div><div className="text-[10px] font-bold uppercase">{fmtDate(e.event_date, false).split(' ')[1]}</div><div className="font-display text-lg font-extrabold">{fmtDate(e.event_date, false).split(' ')[0]}</div></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{e.client_name} <span className="font-normal text-slate-500">· {e.event_type}</span></div>
                      <div className="truncate text-xs text-slate-500"><CalendarClock className="mr-1 inline size-3" />{fmtTime(e.start_time) || 'Time TBC'}{e.location ? ` · ${e.location}` : ''}</div>
                    </div>
                    <Badge tone={e.payment_status}>{e.payment_status}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Inquiry pipeline" sub="Click a bar to filter inquiries" />
          <div className="h-64 px-2 py-3">
            <ResponsiveContainer>
              <BarChart data={data.pipeline} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="#eee" />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="status" width={120} fontSize={12} />
                <Tooltip cursor={{ fill: '#f4f4f4' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(d: any) => nav(`/admin/inquiries?status=${encodeURIComponent(d.status)}`)}>
                  {(data.pipeline as Row[]).map((p) => <Cell key={p.status} fill={STATUS_DOT[p.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          {data.recent.length === 0 ? <Empty title="No activity yet" /> : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {(data.recent as Row[]).map((a) => (
                <li key={a.id}>
                  <button disabled={!a.ref_id} onClick={() => a.ref_type === 'inquiry' ? openInquiry(a.ref_id) : a.ref_type === 'event' && openEvent(a.ref_id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-2 text-left text-sm enabled:hover:bg-slate-50">
                    <span>{a.message}</span>
                    <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Monthly revenue" sub="Booked vs cash received" />
          <div className="h-64 px-2 py-3">
            {monthly.length === 0 ? <Empty title="No data yet" /> : (
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => inr(v, true)} width={56} />
                  <Tooltip formatter={(v) => inr(Number(v))} />
                  <Legend />
                  <Bar dataKey="booked" name="Booked" fill={CHART_COLORS.sky} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="received" name="Received" fill={CHART_COLORS.good} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Monthly profit" sub="Cash received − expenses" />
          <div className="h-64 px-2 py-3">
            {monthly.length === 0 ? <Empty title="No data yet" /> : (
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
    </>
  );
}
