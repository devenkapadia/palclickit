import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, MessageCircle, Phone } from 'lucide-react';
import clsx from 'clsx';
import { telLink, waLink } from '@/lib/format';

/** Call + WhatsApp quick actions. Stops propagation so it can sit inside clickable rows. */
export function ContactButtons({ phone, whatsapp, text, size = 'sm' }: { phone?: string | null; whatsapp?: string | null; text?: string; size?: 'sm' | 'md' }) {
  if (!phone && !whatsapp) return null;
  const cls = clsx('inline-flex items-center justify-center rounded-lg transition', size === 'sm' ? 'size-8' : 'size-9');
  return (
    <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
      {phone && <a href={telLink(phone)} title={`Call ${phone}`} aria-label="Call" className={clsx(cls, 'bg-soft text-navy hover:bg-sky/60')}><Phone className="size-4" /></a>}
      <a href={waLink(whatsapp || phone, text)} target="_blank" rel="noopener noreferrer" title="Open WhatsApp" aria-label="WhatsApp" className={clsx(cls, 'bg-good/15 text-good hover:bg-good/25')}><MessageCircle className="size-4" /></a>
    </span>
  );
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Clickable, sortable table header cell. */
export function Th({ label, sortKey, sort, dir, onSort, className }: { label: string; sortKey?: string; sort?: string; dir?: 'asc' | 'desc'; onSort?: (k: string) => void; className?: string }) {
  const active = sortKey && sort === sortKey;
  return (
    <th className={clsx('whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', className)}>
      {sortKey && onSort ? (
        <button onClick={() => onSort(sortKey)} className={clsx('inline-flex items-center gap-1 uppercase hover:text-ink', active && 'text-ink')}>
          {label}
          {active && (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      ) : label}
    </th>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={clsx('px-3 py-2.5 align-middle text-sm', className)}>{children}</td>;

/** Filter bar wrapper. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{children}</div>;
}

export function MiniLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</span>;
}

export const CHART_COLORS = { sky: '#7cc3e0', sun: '#FFDE59', ink: '#171717', navy: '#153B50', good: '#3B8C69', warn: '#F2A65A', bad: '#E76F51' };
