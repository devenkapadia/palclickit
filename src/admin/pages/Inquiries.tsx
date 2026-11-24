import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { fmtDate, inr } from '@/lib/format';
import { EVENT_TYPES, INQUIRY_SOURCES, INQUIRY_STATUSES, PACKAGE_CODES } from '@shared/constants';
import { Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner, STATUS_DOT } from '@/components/ui';
import { useAction } from '../hooks';
import { useAdmin, type Row } from '../ctx';
import { ContactButtons, FilterBar, MiniLabel, useDebounced } from './shared';

const FILTER_KEYS = ['search', 'status', 'event_type', 'source', 'package', 'event_from', 'event_to', 'inquiry_from', 'inquiry_to'] as const;

export default function Inquiries() {
  const [sp, setSp] = useSearchParams();
  const { addInquiry, openInquiry } = useAdmin();
  const act = useAction();
  const [overdueOnly, setOverdueOnly] = useState(false);

  const get = (k: string) => sp.get(k) ?? '';
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };
  const active = FILTER_KEYS.some((k) => get(k));
  const search = useDebounced(get('search'));

  const params = {
    search, status: get('status'), event_type: get('event_type'), source: get('source'), package: get('package'),
    event_from: get('event_from'), event_to: get('event_to'), inquiry_from: get('inquiry_from'), inquiry_to: get('inquiry_to'),
    overdue: overdueOnly ? 1 : '', sort: 'event_date', dir: 'asc', include_completed: 1,
  };
  const { data, error, isLoading } = useQuery({ queryKey: ['inquiries', params], queryFn: () => api.get<Row[]>(`/admin/inquiries${qs(params)}`), placeholderData: (p) => p });

  const move = (r: Row, status: string) => r.status !== status && act(() => api.patch(`/admin/inquiries/${r.id}`, { status }), `${r.customer_name} → ${status}`);

  return (
    <>
      <PageHeader title="Inquiries" sub={data ? `${data.length} shown` : undefined}
        actions={<Button onClick={() => addInquiry()}><Plus className="size-4" /> Add Inquiry</Button>} />

      <FilterBar>
        <div className="sm:col-span-2">
          <MiniLabel>Search name or phone</MiniLabel>
          <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-8" placeholder="Search…" value={get('search')} onChange={(e) => set('search', e.target.value)} /></div>
        </div>
        <div><MiniLabel>Status</MiniLabel><Select value={get('status')} onChange={(e) => set('status', e.target.value)}><option value="">All</option>{INQUIRY_STATUSES.filter((s) => s !== 'Completed').map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div><MiniLabel>Event type</MiniLabel><Select value={get('event_type')} onChange={(e) => set('event_type', e.target.value)}><option value="">All</option>{EVENT_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div><MiniLabel>Source</MiniLabel><Select value={get('source')} onChange={(e) => set('source', e.target.value)}><option value="">All</option>{INQUIRY_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div><MiniLabel>Package</MiniLabel><Select value={get('package')} onChange={(e) => set('package', e.target.value)}><option value="">All</option>{PACKAGE_CODES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div><MiniLabel>Event date from</MiniLabel><Input type="date" value={get('event_from')} onChange={(e) => set('event_from', e.target.value)} /></div>
        <div><MiniLabel>Event date to</MiniLabel><Input type="date" value={get('event_to')} onChange={(e) => set('event_to', e.target.value)} /></div>
        <div><MiniLabel>Inquired from</MiniLabel><Input type="date" value={get('inquiry_from')} onChange={(e) => set('inquiry_from', e.target.value)} /></div>
        <div><MiniLabel>Inquired to</MiniLabel><Input type="date" value={get('inquiry_to')} onChange={(e) => set('inquiry_to', e.target.value)} /></div>
        <div className="flex items-end gap-2 sm:col-span-2">
          <label className="flex items-center gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue follow-up</label>
          {(active || overdueOnly) && <Button size="sm" variant="ghost" onClick={() => { setSp({}, { replace: true }); setOverdueOnly(false); }}><X className="size-4" /> Clear</Button>}
        </div>
      </FilterBar>

      {error ? <ErrorBox error={error} /> : isLoading || !data ? <Spinner /> : data.length === 0 ? (
        <Card><Empty title={active ? 'No inquiries match these filters' : 'No inquiries yet'} hint={active ? undefined : 'Add one manually, or wait for website enquiries to arrive.'} action={!active && <Button onClick={() => addInquiry()}><Plus className="size-4" /> Add Inquiry</Button>} /></Card>
      ) : (
        <Kanban rows={data} onMove={move} onOpen={openInquiry} />
      )}
    </>
  );
}

function Kanban({ rows, onMove, onOpen }: { rows: Row[]; onMove: (r: Row, s: string) => void; onOpen: (id: number) => void }) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {INQUIRY_STATUSES.map((s) => {
        const items = rows.filter((r) => r.status === s);
        return (
          <div key={s}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }}
            onDragLeave={() => setOver((o) => (o === s ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); const r = rows.find((x) => x.id === Number(e.dataTransfer.getData('text/plain'))); if (r) onMove(r, s); }}
            className={`w-64 shrink-0 rounded-xl border bg-slate-100/70 p-2 transition ${over === s ? 'border-navy bg-sky/30' : 'border-transparent'}`}>
            <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
              <span className="flex items-center gap-2 text-sm font-bold"><span className="size-2.5 rounded-full" style={{ background: STATUS_DOT[s] }} />{s}</span>
              <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((r) => (
                <div key={r.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(r.id))} onClick={() => onOpen(r.id)}
                  className="cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm hover:border-navy/40 active:cursor-grabbing">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="truncate text-sm font-semibold">{r.customer_name}</div><div className="text-xs text-slate-500">{r.event_type} · {fmtDate(r.event_date, false)}</div></div>
                    <ContactButtons phone={r.phone} whatsapp={r.whatsapp} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                    <span>{r.package_code}{r.quoted_price != null && ` · ${inr(r.quoted_price)}`}</span>
                  </div>
                  {/* Touch-friendly alternative to dragging. */}
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    <Select value={r.status} onChange={(e) => onMove(r, e.target.value)} className="!py-1 !text-xs" aria-label="Move to stage">
                      {INQUIRY_STATUSES.filter((x) => x !== 'Completed' || x === r.status).map((x) => <option key={x}>{x}</option>)}
                    </Select>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 px-2 py-6 text-center text-xs text-slate-400">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
