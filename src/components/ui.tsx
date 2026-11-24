import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Loader2, X } from 'lucide-react';

/* ---------- Button ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'dark' | 'ghost' | 'outline' | 'danger' | 'soft';
  size?: 'sm' | 'md';
  loading?: boolean;
};
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        variant === 'primary' && 'bg-sun text-ink hover:brightness-95 border border-ink/80',
        variant === 'dark' && 'bg-ink text-white hover:bg-navy',
        variant === 'outline' && 'border border-slate-300 bg-white text-ink hover:bg-slate-50',
        variant === 'soft' && 'bg-soft text-navy hover:bg-sky/40',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'bg-bad text-white hover:brightness-95',
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Form controls ---------- */
const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-sky/60 disabled:bg-slate-50';

export function Field({ label, hint, required, children, className }: { label: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label} {required && <span className="text-bad">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(field, className)} />;
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={clsx(field, 'resize-y', className)} />;
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...p} className={clsx(field, 'appearance-none pr-8', className)}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/* ---------- Badge ---------- */
const TONES: Record<string, string> = {
  New: 'bg-sky/50 text-navy',
  Confirmed: 'bg-good/15 text-good',
  Lost: 'bg-slate-200 text-slate-600',
  Cancelled: 'bg-bad/15 text-bad',
  Upcoming: 'bg-sky/50 text-navy',
  'In Progress': 'bg-warn/25 text-amber-800',
  Completed: 'bg-good/15 text-good',
  Unpaid: 'bg-bad/15 text-bad',
  'Advance Paid': 'bg-warn/25 text-amber-800',
  'Partially Paid': 'bg-sun/60 text-yellow-900',
  'Fully Paid': 'bg-good/15 text-good',
  Pending: 'bg-warn/25 text-amber-800',
};
export const STATUS_DOT: Record<string, string> = {
  New: '#7cc3e0',
  Confirmed: '#3B8C69', Completed: '#1f6f4a', Lost: '#94a3b8',
};
export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const key = tone ?? String(children);
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[key] ?? 'bg-slate-100 text-slate-700', className)}>{children}</span>;
}

/* ---------- Card ---------- */
export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>;
}
export function CardHeader({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div>
        <h3 className="font-display text-base font-bold">{title}</h3>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Loader2 className="size-5 animate-spin" /> {label ?? 'Loading…'}
    </div>
  );
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {hint && <div className="max-w-sm text-sm text-slate-500">{hint}</div>}
      {action}
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return <div className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{(error as Error)?.message ?? 'Something went wrong'}</div>;
}

/* ---------- Modal / Drawer ---------- */
export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={clsx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-ink/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={clsx('absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl', width)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

/* ---------- Toasts + confirm ---------- */
type Toast = { id: number; msg: string; kind: 'ok' | 'err' };
type Ctx = { toast: (msg: string, kind?: 'ok' | 'err') => void; confirm: (o: { title: string; body?: string; confirmLabel?: string }) => Promise<boolean> };
const UiCtx = createContext<Ctx>(null as unknown as Ctx);
export const useUi = () => useContext(UiCtx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<{ title: string; body?: string; confirmLabel?: string; resolve: (v: boolean) => void } | null>(null);
  const seq = useRef(0);
  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 3000);
  }, []);
  const confirm = useCallback((o: { title: string; body?: string; confirmLabel?: string }) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };
  return (
    <UiCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.kind === 'ok' ? 'bg-ink' : 'bg-bad')}>
            {t.kind === 'ok' ? <CheckCircle2 className="size-4 text-sun" /> : <AlertTriangle className="size-4" />} {t.msg}
          </div>
        ))}
      </div>
      <Modal open={!!dlg} onClose={() => close(false)} title={dlg?.title ?? ''}
        footer={<><Button variant="outline" onClick={() => close(false)}>Cancel</Button><Button variant="danger" onClick={() => close(true)}>{dlg?.confirmLabel ?? 'Delete'}</Button></>}>
        <p className="text-sm text-slate-600">{dlg?.body ?? 'This action cannot be undone.'}</p>
      </Modal>
    </UiCtx.Provider>
  );
}

/* ---------- Misc ---------- */
export function Stat({ label, value, sub, tone, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn'; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={clsx('rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm', onClick && 'transition hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-md')}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx('mt-1 font-display text-2xl font-extrabold', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-amber-600')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Tag>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={clsx('rounded-md px-3 py-1.5 text-sm font-semibold transition', value === o.value ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Warning for features that save files to the server disk, which is wiped on restart on free hosting (e.g. Render free). */
export function TempStorageNote({ className }: { className?: string }) {
  return (
    <p className={clsx('flex items-start gap-1.5 rounded-lg bg-warn/15 px-3 py-2 text-xs font-semibold text-navy', className)}>
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>Temporary storage: files uploaded here are deleted when the server restarts or redeploys. Re-upload them afterwards, or use an Instagram link instead where possible.</span>
    </p>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        {sub && <p className="text-sm text-slate-500">{sub}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 rounded-full transition', checked ? 'bg-good' : 'bg-slate-300')}>
        <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
      {label}
    </label>
  );
}

export const DoneTick = () => <Check className="size-4 text-good" />;
