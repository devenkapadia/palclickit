import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { monthRange, yearRange } from '@/lib/format';
import { Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Spinner, Tabs } from '@/components/ui';
import { Td, Th } from './shared';

const REPORTS = [
  { key: 'inquiries', title: 'Inquiries', desc: 'Every inquiry with status, source, quote and next follow-up. Filtered by inquiry date.' },
  { key: 'bookings', title: 'Confirmed bookings', desc: 'All non-cancelled bookings with payment status. Filtered by event date.' },
  { key: 'completed', title: 'Completed events', desc: 'Completed events with realized profit. Filtered by event date.' },
  { key: 'expenses', title: 'Expenses', desc: 'Every expense with category, event and payment method. Filtered by spend date.' },
  { key: 'outstanding', title: 'Outstanding payments', desc: 'Bookings with an unpaid balance. Filtered by event date.' },
  { key: 'event-breakdown', title: 'Event-wise breakdown', desc: 'Per-event revenue, cash received, expenses and profit.' },
  { key: 'monthly-finance', title: 'Monthly revenue & profit', desc: 'Booked, received, expenses and profit by month.' },
] as const;

type Preset = 'all' | 'month' | 'last' | 'year' | 'custom';

export default function Reports() {
  const [preset, setPreset] = useState<Preset>('year');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [active, setActive] = useState<string>(REPORTS[0].key);
  const range = preset === 'month' ? monthRange(0) : preset === 'last' ? monthRange(-1) : preset === 'year' ? yearRange() : preset === 'custom' ? custom : { from: '', to: '' };
  const { data, error, isLoading } = useQuery({
    queryKey: ['report', active, range],
    queryFn: () => api.get<{ columns: [string, string][]; rows: Record<string, any>[] }>(`/admin/reports/${active}${qs(range)}`),
    placeholderData: (p) => p,
  });
  const csv = `/api/admin/reports/${active}${qs({ ...range, format: 'csv' })}`;
  const meta = REPORTS.find((r) => r.key === active)!;

  return (
    <>
      <PageHeader title="Reports" sub="Preview any report, then download it as CSV (opens in Excel / Google Sheets)."
        actions={<a href={csv}><Button><Download className="size-4" /> Download CSV</Button></a>} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs value={preset} onChange={setPreset} options={[{ value: 'month', label: 'This month' }, { value: 'last', label: 'Last month' }, { value: 'year', label: 'This year' }, { value: 'all', label: 'All time' }, { value: 'custom', label: 'Custom' }]} />
        {preset === 'custom' && <>
          <Field label="From"><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
        </>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {REPORTS.map((r) => (
            <button key={r.key} onClick={() => setActive(r.key)}
              className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition ${active === r.key ? 'border-ink bg-sun' : 'border-slate-200 bg-white hover:border-navy/40'}`}>
              {r.title}
            </button>
          ))}
        </div>

        <Card className="min-w-0">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="font-display font-bold">{meta.title}</h3>
            <p className="text-xs text-slate-500">{meta.desc}{data ? ` · ${data.rows.length} rows` : ''}</p>
          </div>
          {error ? <div className="p-4"><ErrorBox error={error} /></div> : isLoading || !data ? <Spinner /> : data.rows.length === 0 ? <Empty title="No rows for this period" /> : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-max">
                <thead className="sticky top-0 border-b border-slate-100 bg-slate-50"><tr>{data.columns.map(([k, label]) => <Th key={k} label={label} />)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.slice(0, 200).map((r, i) => <tr key={i}>{data.columns.map(([k]) => <Td key={k} className="whitespace-nowrap">{r[k] ?? ''}</Td>)}</tr>)}
                </tbody>
              </table>
              {data.rows.length > 200 && <p className="p-3 text-center text-xs text-slate-500">Showing the first 200 rows — download the CSV for everything.</p>}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
