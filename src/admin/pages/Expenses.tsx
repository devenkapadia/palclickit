import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, Plus, Search, X } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { fmtDate, inr } from '@/lib/format';
import { EXPENSE_CATEGORIES } from '@shared/constants';
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Input, PageHeader, Select, Spinner, Stat } from '@/components/ui';
import { useAdmin, type Row } from '../ctx';
import { FilterBar, MiniLabel, Td, Th, useDebounced } from './shared';

export default function Expenses() {
  const { addExpense, editExpense, openEvent } = useAdmin();
  const [f, setF] = useState({ search: '', category: '', event_id: '', month: '', from: '', to: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const search = useDebounced(f.search);
  const params = { ...f, search };
  const active = Object.values(f).some(Boolean);

  const { data, error, isLoading } = useQuery({ queryKey: ['expenses', params], queryFn: () => api.get<Row>(`/admin/expenses${qs(params)}`), placeholderData: (p) => p });
  const { data: events } = useQuery({ queryKey: ['events', 'all-min'], queryFn: () => api.get<Row[]>('/admin/events') });
  const [sort, setSort] = useState('spent_on');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const onSort = (k: string) => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('desc'); } };

  const rows: Row[] = data ? [...data.rows].sort((a, b) => {
    const x = a[sort] ?? '', y = b[sort] ?? '';
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return dir === 'asc' ? c : -c;
  }) : [];
  const cats = data ? Object.entries(data.byCategory as Record<string, number>).sort((a, b) => b[1] - a[1]) : [];

  return (
    <>
      <PageHeader title="Expenses" sub="Event costs and general business spending."
        actions={<Button onClick={() => addExpense()}><Plus className="size-4" /> Add expense</Button>} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total expenses" value={data ? inr(data.total) : '…'} sub={active ? 'Matching current filters' : 'All time'} />
        <Stat label="Event-wise" value={data ? inr(data.eventWise) : '…'} sub="Linked to a booking" />
        <Stat label="Business-wide" value={data ? inr(data.businessWide) : '…'} sub="General overheads" />
      </div>

      <FilterBar>
        <div className="sm:col-span-2"><MiniLabel>Search</MiniLabel>
          <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-8" value={f.search} onChange={set('search')} placeholder="Description or notes…" /></div></div>
        <div><MiniLabel>Category</MiniLabel><Select value={f.category} onChange={set('category')}><option value="">All</option>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
        <div><MiniLabel>Event</MiniLabel>
          <Select value={f.event_id} onChange={set('event_id')}><option value="">All</option><option value="none">General only</option>{events?.map((e) => <option key={e.id} value={e.id}>{e.client_name} · {fmtDate(e.event_date, false)}</option>)}</Select></div>
        <div><MiniLabel>Month</MiniLabel><Input type="month" value={f.month} onChange={set('month')} /></div>
        <div><MiniLabel>From</MiniLabel><Input type="date" value={f.from} onChange={set('from')} /></div>
        <div><MiniLabel>To</MiniLabel><Input type="date" value={f.to} onChange={set('to')} /></div>
        {active && <div className="flex items-end"><Button size="sm" variant="ghost" onClick={() => setF({ search: '', category: '', event_id: '', month: '', from: '', to: '' })}><X className="size-4" /> Clear</Button></div>}
      </FilterBar>

      {error ? <ErrorBox error={error} /> : isLoading || !data ? <Spinner /> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <Card className="overflow-x-auto">
            {rows.length === 0 ? <Empty title={active ? 'No expenses match these filters' : 'No expenses recorded yet'} action={!active && <Button onClick={() => addExpense()}><Plus className="size-4" /> Add expense</Button>} /> : (
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-slate-100 bg-slate-50/70"><tr>
                  <Th label="Date" sortKey="spent_on" sort={sort} dir={dir} onSort={onSort} />
                  <Th label="Description" sortKey="name" sort={sort} dir={dir} onSort={onSort} />
                  <Th label="Category" sortKey="category" sort={sort} dir={dir} onSort={onSort} />
                  <Th label="Event" />
                  <Th label="Method" />
                  <Th label="Amount" sortKey="amount" sort={sort} dir={dir} onSort={onSort} className="text-right" />
                  <Th label="" />
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => editExpense(r)} className="cursor-pointer hover:bg-slate-50">
                      <Td className="whitespace-nowrap">{fmtDate(r.spent_on)}</Td>
                      <Td><div className="font-semibold">{r.name}</div>{r.notes && <div className="max-w-xs truncate text-xs text-slate-400">{r.notes}</div>}</Td>
                      <Td><Badge tone="x">{r.category}</Badge></Td>
                      <Td>{r.event_id ? <button className="text-left font-medium text-navy underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); openEvent(r.event_id); }}>{r.event_name}</button> : <span className="text-slate-400">General</span>}</Td>
                      <Td>{r.payment_method || '—'}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold">{inr(r.amount)}</Td>
                      <Td>{r.has_receipt && <a href={`/api/admin/expenses/${r.id}/receipt`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label="View receipt" className="text-slate-400 hover:text-navy"><Paperclip className="size-4" /></a>}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-bold"><Td className="text-right" >Total</Td><Td /><Td /><Td /><Td /><Td className="whitespace-nowrap text-right">{inr(data.total)}</Td><Td /></tr></tfoot>
              </table>
            )}
          </Card>

          <Card className="h-fit">
            <CardHeader title="By category" />
            {cats.length === 0 ? <Empty title="Nothing to show" /> : (
              <ul className="space-y-3 p-4">
                {cats.map(([c, v]) => (
                  <li key={c}>
                    <div className="mb-1 flex justify-between text-sm"><span>{c}</span><span className="font-semibold">{inr(v)}</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sun" style={{ width: `${Math.max(3, (v / (cats[0][1] || 1)) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
