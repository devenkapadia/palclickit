import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { api, qs } from '@/lib/api';
import { addDays, fmtTime, parseYmd, todayStr, ymd } from '@/lib/format';
import { Button, Spinner, Tabs } from '@/components/ui';
import { useAdmin, type Row } from '../ctx';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday-first start of week for a YYYY-MM-DD string. */
const weekStart = (s: string) => {
  const d = parseYmd(s);
  return addDays(s, -((d.getDay() + 6) % 7));
};

/**
 * Month / week calendar fed by /admin/calendar.
 * Events are dark chips, follow-ups are yellow chips (only when `followups` is true).
 */
export default function CalendarView({ followups = true }: { followups?: boolean }) {
  const { openEvent, openInquiry } = useAdmin();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [anchor, setAnchor] = useState(todayStr());
  const today = todayStr();

  const { from, to, days, label } = useMemo(() => {
    if (mode === 'week') {
      const s = weekStart(anchor);
      const e = addDays(s, 6);
      const fmt = (x: string) => parseYmd(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      return { from: s, to: e, days: Array.from({ length: 7 }, (_, i) => addDays(s, i)), label: `${fmt(s)} – ${fmt(e)} ${parseYmd(e).getFullYear()}` };
    }
    const a = parseYmd(anchor);
    const first = ymd(new Date(a.getFullYear(), a.getMonth(), 1));
    const s = weekStart(first);
    const last = ymd(new Date(a.getFullYear(), a.getMonth() + 1, 0));
    const e = addDays(weekStart(last), 6);
    const n = (parseYmd(e).getTime() - parseYmd(s).getTime()) / 86400000 + 1;
    return { from: s, to: e, days: Array.from({ length: Math.round(n) }, (_, i) => addDays(s, i)), label: a.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
  }, [anchor, mode]);

  const { data, isLoading } = useQuery({ queryKey: ['calendar', from, to], queryFn: () => api.get<Row[]>(`/admin/calendar${qs({ from, to })}`), placeholderData: (p) => p });

  const byDay = useMemo(() => {
    const m = new Map<string, Row[]>();
    (data ?? []).filter((i) => followups || i.kind === 'event').forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i]));
    m.forEach((v) => v.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')));
    return m;
  }, [data, followups]);

  const step = (dir: 1 | -1) => {
    if (mode === 'week') return setAnchor(addDays(anchor, 7 * dir));
    const a = parseYmd(anchor);
    setAnchor(ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  };
  const curMonth = parseYmd(anchor).getMonth();
  const open = (i: Row) => (i.kind === 'event' ? openEvent(i.id) : openInquiry(i.inquiry_id));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => step(1)} aria-label="Next"><ChevronRight className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>Today</Button>
          <h2 className="ml-2 font-display text-lg font-bold">{label}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-slate-600 sm:flex">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-ink" /> Event</span>
            {followups && <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-yellow-500 bg-sun" /> Follow-up</span>}
          </div>
          <Tabs value={mode} onChange={setMode} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]} />
        </div>
      </div>

      {isLoading && !data ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
              {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const items = byDay.get(d) ?? [];
                const dim = mode === 'month' && parseYmd(d).getMonth() !== curMonth;
                const cap = mode === 'week' ? 20 : 3;
                return (
                  <div key={d} className={clsx('border-b border-r border-slate-100 p-1.5', mode === 'week' ? 'min-h-[220px]' : 'min-h-[104px]', dim && 'bg-slate-50/70')}>
                    <div className={clsx('mb-1 flex size-6 items-center justify-center rounded-full text-xs font-semibold', d === today ? 'bg-ink text-white' : dim ? 'text-slate-300' : 'text-slate-600')}>{parseYmd(d).getDate()}</div>
                    <div className="space-y-1">
                      {items.slice(0, cap).map((i) => (
                        <button key={`${i.kind}${i.id}`} onClick={() => open(i)} title={`${i.title} — ${i.subtitle}`}
                          className={clsx('block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight',
                            i.kind === 'event' ? (i.status === 'Completed' ? 'bg-good text-white' : i.status === 'Cancelled' ? 'bg-slate-300 text-slate-600 line-through' : 'bg-ink text-white') : 'border border-yellow-500/60 bg-sun/80 text-ink')}>
                          {i.time && <span className="opacity-70">{fmtTime(i.time).replace(':00', '')} </span>}{i.title}
                        </button>
                      ))}
                      {items.length > cap && <div className="px-1 text-[11px] font-semibold text-slate-500">+{items.length - cap} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
