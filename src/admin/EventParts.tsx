import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, CreditCard, Download, ExternalLink, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtTime, inr, telLink, todayStr, waLink } from '@/lib/format';
import { BOOKING_STATUSES, EVENT_TYPES, EXPENSE_CATEGORIES, PACKAGE_CODES, PAYMENT_METHODS, PAYMENT_TYPES } from '@shared/constants';
import { Badge, Button, Drawer, Field, Input, Modal, Select, Spinner, TempStorageNote, Textarea, useUi } from '@/components/ui';
import { useAction, num } from './hooks';
import { useAdmin, type Row } from './ctx';

/* ---------------- Booking add / edit ---------------- */
export function EventFormModal({ open, onClose, event }: { open: boolean; onClose: () => void; event?: Row | null }) {
  const act = useAction();
  const { openEvent } = useAdmin();
  const editing = !!event?.id;
  const keys = ['client_name', 'phone', 'event_type', 'event_date', 'start_time', 'end_time', 'duration_hours', 'venue_name', 'location', 'guest_count', 'package_code', 'final_amount', 'booking_status', 'booth', 'staff', 'setup_time', 'event_notes', 'operational_notes'];
  const blank: Row = { client_name: '', phone: '', event_type: 'Wedding', event_date: todayStr(), start_time: '', end_time: '', duration_hours: '4', venue_name: '', location: '', guest_count: '', package_code: 'Custom', final_amount: '', booking_status: 'Confirmed', booth: '', staff: '', setup_time: '', event_notes: '', operational_notes: '' };
  const [f, setF] = useState<Row>(blank);
  useEffect(() => {
    if (open) setF(event ? Object.fromEntries(keys.map((k) => [k, event[k] ?? ''])) : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event]);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    const body: Row = { ...f, duration_hours: num(String(f.duration_hours)), guest_count: num(String(f.guest_count)), final_amount: Number(f.final_amount || 0) };
    if (!f.end_time) delete body.end_time; // let the server derive it
    const r = await act(() => (editing ? api.patch<Row>(`/admin/events/${event!.id}`, body) : api.post<Row>('/admin/events', body)), editing ? 'Booking updated' : 'Booking added');
    if (r) { onClose(); if (!editing) openEvent((r as Row).id); }
  };
  return (
    <Modal open={open} onClose={onClose} wide title={editing ? `Edit booking #${event!.id}` : 'Add booking'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!f.client_name || !f.phone || !f.event_date}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client name" required><Input value={f.client_name} onChange={set('client_name')} /></Field>
        <Field label="Phone" required><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Event type"><Select value={f.event_type} onChange={set('event_type')}>{EVENT_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Package"><Select value={f.package_code} onChange={set('package_code')}>{PACKAGE_CODES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Event date" required><Input type="date" value={f.event_date} onChange={set('event_date')} /></Field>
        <Field label="Final amount (₹)" required><Input type="number" min="0" value={f.final_amount} onChange={set('final_amount')} /></Field>
        <Field label="Start time"><Input type="time" value={f.start_time} onChange={set('start_time')} /></Field>
        <Field label="End time" hint="Auto-calculated from duration if blank"><Input type="time" value={f.end_time} onChange={set('end_time')} /></Field>
        <Field label="Duration (hours)"><Input type="number" step="0.5" value={f.duration_hours} onChange={set('duration_hours')} /></Field>
        <Field label="Setup time"><Input type="time" value={f.setup_time} onChange={set('setup_time')} /></Field>
        <Field label="Guests"><Input type="number" min="0" value={f.guest_count} onChange={set('guest_count')} /></Field>
        <Field label="Venue name"><Input value={f.venue_name} onChange={set('venue_name')} placeholder="e.g. Torino Social" /></Field>
        <Field label="Venue address"><Input value={f.location} onChange={set('location')} placeholder="Behind Bombay Kitchen, Besides Khanpur, Vadodara" /></Field>
        <Field label="Booking status"><Select value={f.booking_status} onChange={set('booking_status')}>{BOOKING_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Assigned booth / machine"><Input value={f.booth} onChange={set('booth')} /></Field>
        <Field label="Staff / attendant"><Input value={f.staff} onChange={set('staff')} /></Field>
        <Field label="Event notes" className="sm:col-span-2"><Textarea value={f.event_notes} onChange={set('event_notes')} /></Field>
        <Field label="Operational notes" className="sm:col-span-2"><Textarea value={f.operational_notes} onChange={set('operational_notes')} placeholder="Power, setup access, contact at venue…" /></Field>
      </div>
    </Modal>
  );
}

/* ---------------- Payment dialog ---------------- */
function PaymentModal({ open, onClose, eventId, remaining }: { open: boolean; onClose: () => void; eventId: number; remaining: number }) {
  const act = useAction();
  const [f, setF] = useState<Row>({});
  useEffect(() => { if (open) setF({ amount: remaining || '', paid_on: todayStr(), type: remaining ? 'Partial' : 'Advance', method: 'UPI', note: '' }); }, [open, remaining]);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    const r = await act(() => api.post(`/admin/events/${eventId}/payments`, { ...f, amount: Number(f.amount) }), 'Payment recorded');
    if (r) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Record payment" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!(Number(f.amount) > 0)}>Save payment</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount received (₹)" required><Input type="number" min="0" value={f.amount ?? ''} onChange={set('amount')} autoFocus /></Field>
        <Field label="Date"><Input type="date" value={f.paid_on ?? ''} onChange={set('paid_on')} /></Field>
        <Field label="Type"><Select value={f.type ?? 'Partial'} onChange={set('type')}>{PAYMENT_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Method"><Select value={f.method ?? ''} onChange={set('method')}>{PAYMENT_METHODS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Note" className="sm:col-span-2"><Input value={f.note ?? ''} onChange={set('note')} /></Field>
      </div>
    </Modal>
  );
}

/* ---------------- Booking detail drawer ---------------- */
export function EventDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['event', id], queryFn: () => api.get<Row>(`/admin/events/${id}`), enabled: !!id });
  const act = useAction();
  const { confirm } = useUi();
  const { openInquiry, addExpense, editExpense } = useAdmin();
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  const e = data?.event;

  const del = async () => {
    if (!(await confirm({ title: 'Delete booking?', body: 'Payment records for this booking will be deleted. Expenses are kept as general business expenses.' }))) return;
    if (await act(() => api.del(`/admin/events/${id}`), 'Booking deleted')) onClose();
  };

  return (
    <Drawer open={!!id} onClose={onClose} title={e ? <span>{e.client_name} <span className="text-sm font-medium text-slate-400">· Booking #{e.id}</span></span> : 'Booking'}>
      {isLoading || !e ? <Spinner /> : (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={e.booking_status} className="!w-auto font-semibold" onChange={(ev) => act(() => api.patch(`/admin/events/${e.id}`, { booking_status: ev.target.value }), 'Status updated')}>
              {BOOKING_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Badge>{e.payment_status}</Badge>
            {['Confirmed', 'Completed'].includes(e.booking_status) && (
              <a href={`/api/admin/events/${e.id}/invoice`} download>
                <Button size="sm" variant="outline" className="text-navy font-semibold">
                  <Download className="size-4 text-navy" /> Download invoice
                </Button>
              </a>
            )}
            {e.booking_status !== 'Completed' && <Button size="sm" variant="primary" onClick={() => act(() => api.patch(`/admin/events/${e.id}`, { booking_status: 'Completed' }), 'Marked completed')}><Check className="size-4" /> Mark completed</Button>}
            <a href={telLink(e.phone)}><Button size="sm" variant="outline">Call</Button></a>
            <a href={waLink(e.phone)} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline">WhatsApp</Button></a>
            <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>
            <Button size="sm" variant="ghost" aria-label="Delete booking" onClick={del}><Trash2 className="size-4 text-bad" /></Button>
          </div>
          {e.inquiry_id && <button className="flex items-center gap-1 text-sm font-semibold text-navy hover:underline" onClick={() => openInquiry(e.inquiry_id)}><ExternalLink className="size-4" /> Open original inquiry</button>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
            {([
              ['Event', e.event_type], ['Date', fmtDate(e.event_date)], ['Time', `${fmtTime(e.start_time)}${e.end_time ? ' – ' + fmtTime(e.end_time) : ''}` || '—'],
              ['Duration', e.duration_hours ? `${e.duration_hours} hrs` : '—'], ['Setup', fmtTime(e.setup_time) || '—'], ['Guests', e.guest_count ?? '—'],
              ['Venue name', e.venue_name || '—'], ['Venue address', e.location || '—'],
              ['Package', e.package_code], ['Phone', e.phone], ['Booth / machine', e.booth || '—'], ['Staff', e.staff || '—'],
            ] as [string, any][]).map(([k, v]) => <div key={k}><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ['Booked', inr(e.final_amount), ''], ['Received', inr(e.paid), 'text-good'], ['Remaining', inr(e.remaining), e.remaining > 0 ? 'text-bad' : ''],
              ['Expenses', inr(e.expenses_total), ''],
            ] as [string, string, string][]).map(([k, v, c]) => <div key={k} className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-500">{k}</div><div className={`font-display text-lg font-extrabold ${c}`}>{v}</div></div>)}
            <div className="col-span-2 rounded-xl border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-500">Estimated profit (booked − expenses)</div><div className="font-display text-lg font-extrabold">{inr(e.estimated_profit)}</div></div>
            <div className="col-span-2 rounded-xl border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-500">Realized profit (received − expenses)</div>
              <div className="font-display text-lg font-extrabold">{e.realized_profit === null ? <span className="text-sm font-medium text-slate-400">After event is completed</span> : inr(e.realized_profit)}</div></div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-display font-bold">Payments</h3><Button size="sm" variant="soft" onClick={() => setPay(true)}><CreditCard className="size-4" /> Record payment</Button></div>
            {data.payments.length === 0 ? <p className="text-sm text-slate-500">No payments recorded yet.</p> : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.payments.map((p: Row) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div><div className="font-semibold">{inr(p.amount)} <span className="font-normal text-slate-500">· {p.type}{p.method ? ` · ${p.method}` : ''}</span></div><div className="text-xs text-slate-400">{fmtDate(p.paid_on)}{p.note ? ` · ${p.note}` : ''}</div></div>
                    <button aria-label="Delete payment" className="text-slate-300 hover:text-bad" onClick={() => act(() => api.del(`/admin/events/${e.id}/payments/${p.id}`), 'Payment removed')}><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-display font-bold">Event expenses</h3><Button size="sm" variant="soft" onClick={() => addExpense({ event_id: e.id })}><Plus className="size-4" /> Add expense</Button></div>
            {data.expenses.length === 0 ? <p className="text-sm text-slate-500">No expenses linked to this event.</p> : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.expenses.map((x: Row) => (
                  <li key={x.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <button className="text-left" onClick={() => editExpense(x)}><div className="font-semibold">{x.name}</div><div className="text-xs text-slate-400">{x.category} · {fmtDate(x.spent_on)}</div></button>
                    <div className="flex items-center gap-2 font-semibold">{x.receipt_file && <Receipt className="size-4 text-slate-400" />}{inr(x.amount)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(e.event_notes || e.operational_notes) && (
            <section className="grid gap-3 text-sm">
              {e.event_notes && <div className="rounded-xl border border-slate-200 p-3 whitespace-pre-wrap"><div className="mb-1 text-xs font-semibold text-slate-500">Event notes</div>{e.event_notes}</div>}
              {e.operational_notes && <div className="rounded-xl border border-slate-200 p-3 whitespace-pre-wrap"><div className="mb-1 text-xs font-semibold text-slate-500">Operational notes</div>{e.operational_notes}</div>}
            </section>
          )}

          <EventFormModal open={edit} onClose={() => setEdit(false)} event={e} />
          <PaymentModal open={pay} onClose={() => setPay(false)} eventId={e.id} remaining={e.remaining} />
        </div>
      )}
    </Drawer>
  );
}

/* ---------------- Expense add / edit ---------------- */
// The three regular per-event costs, entered together in one go.
const QUICK_LINES = [
  { name: 'Paper', category: 'Printing/Paper', hint: 'e.g. 154 strips × 11' },
  { name: 'Tempo', category: 'Transport', hint: 'e.g. Tempo / Porter' },
  { name: 'Staff', category: 'Staff/Attendant', hint: 'e.g. Booth help' },
] as const;
const blankQuick = () => Object.fromEntries(QUICK_LINES.map((l) => [l.name, { amount: '', notes: '' }])) as Record<string, { amount: string; notes: string }>;

export function ExpenseModal({ open, onClose, expense, preset }: { open: boolean; onClose: () => void; expense?: Row | null; preset?: Row }) {
  const act = useAction();
  const { confirm } = useUi();
  const { data: events } = useQuery({ queryKey: ['events', 'all-min'], queryFn: () => api.get<Row[]>('/admin/events'), enabled: open });
  const [f, setF] = useState<Row>({});
  const [file, setFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [quick, setQuick] = useState(true);
  const [lines, setLines] = useState(blankQuick);
  const editing = !!expense?.id;
  const quickMode = !editing && quick;
  useEffect(() => {
    if (!open) return;
    setFile(null); setRemoveReceipt(false); setQuick(true); setLines(blankQuick());
    setF(expense
      ? { name: expense.name, amount: expense.amount, spent_on: expense.spent_on, category: expense.category, event_id: expense.event_id ?? '', payment_method: expense.payment_method ?? '', notes: expense.notes ?? '' }
      : { name: '', amount: '', spent_on: todayStr(), category: 'Miscellaneous', event_id: preset?.event_id ?? '', payment_method: 'UPI', notes: '' });
  }, [open, expense, preset]);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const setLine = (name: string, k: 'amount' | 'notes', v: string) => setLines((p) => ({ ...p, [name]: { ...p[name], [k]: v } }));
  const filled = QUICK_LINES.filter((l) => Number(lines[l.name]?.amount) > 0);

  const saveQuick = async () => {
    const r = await act(async () => {
      for (const l of filled) {
        const fd = new FormData();
        fd.append('name', l.name);
        fd.append('amount', lines[l.name].amount);
        fd.append('category', l.category);
        if (f.spent_on) fd.append('spent_on', f.spent_on);
        if (f.event_id) fd.append('event_id', String(f.event_id));
        if (f.payment_method) fd.append('payment_method', f.payment_method);
        if (lines[l.name].notes) fd.append('notes', lines[l.name].notes);
        await api.post('/admin/expenses', fd);
      }
      return true;
    }, filled.length === 1 ? 'Expense added' : `${filled.length} expenses added`);
    if (r) onClose();
  };

  const save = async () => {
    if (quickMode) return saveQuick();
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) fd.append(k, String(v)); });
    if (editing && f.event_id === '') fd.append('event_id', '');
    if (file) fd.append('receipt', file);
    if (removeReceipt) fd.append('remove_receipt', 'true');
    const r = await act(() => (editing ? api.patch(`/admin/expenses/${expense!.id}`, fd) : api.post('/admin/expenses', fd)), editing ? 'Expense updated' : 'Expense added');
    if (r) onClose();
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete expense?', body: `${expense!.name} (${inr(expense!.amount)}) will be removed.` }))) return;
    if (await act(() => api.del(`/admin/expenses/${expense!.id}`), 'Expense deleted')) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit expense' : 'Add expense'}
      footer={<>{editing && <Button variant="ghost" className="mr-auto text-bad" onClick={del}><Trash2 className="size-4" /> Delete</Button>}<Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={quickMode ? filled.length === 0 : !f.name || f.amount === ''}>{quickMode && filled.length > 1 ? `Save ${filled.length} expenses` : 'Save'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {quickMode ? (
          <div className="space-y-2 sm:col-span-2">
            {QUICK_LINES.map((l, i) => (
              <div key={l.name} className="grid grid-cols-[5rem_8rem_1fr] items-center gap-2">
                <div className="text-sm font-semibold">{l.name}</div>
                <Input type="number" min="0" placeholder="₹ amount" value={lines[l.name].amount} onChange={(e) => setLine(l.name, 'amount', e.target.value)} autoFocus={i === 0} aria-label={`${l.name} amount`} />
                <Input placeholder={l.hint} value={lines[l.name].notes} onChange={(e) => setLine(l.name, 'notes', e.target.value)} aria-label={`${l.name} notes`} />
              </div>
            ))}
            <p className="text-xs text-slate-500">Fill only the ones that apply — each becomes its own expense. <button type="button" className="font-semibold text-navy underline" onClick={() => setQuick(false)}>Add a different expense</button></p>
          </div>
        ) : (
          <>
            <Field label="Description" required className="sm:col-span-2"><Input value={f.name ?? ''} onChange={set('name')} autoFocus /></Field>
            <Field label="Amount (₹)" required><Input type="number" min="0" value={f.amount ?? ''} onChange={set('amount')} /></Field>
          </>
        )}
        <Field label="Date"><Input type="date" value={f.spent_on ?? ''} onChange={set('spent_on')} /></Field>
        {!quickMode && <Field label="Category"><Select value={f.category ?? ''} onChange={set('category')}>{EXPENSE_CATEGORIES.map((s) => <option key={s}>{s}</option>)}</Select></Field>}
        <Field label="Payment method"><Select value={f.payment_method ?? ''} onChange={set('payment_method')}><option value="">—</option>{PAYMENT_METHODS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Associated event" className="sm:col-span-2" hint="Leave empty for a general business expense">
          <Select value={f.event_id ?? ''} onChange={set('event_id')}><option value="">General (business-wide)</option>{events?.map((ev) => <option key={ev.id} value={ev.id}>{ev.client_name} · {fmtDate(ev.event_date)}</option>)}</Select>
        </Field>
        {!quickMode && <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes ?? ''} onChange={set('notes')} rows={2} /></Field>}
        {!quickMode && <Field label="Receipt (image or PDF, max 8MB)" className="sm:col-span-2">
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-soft file:px-3 file:py-2 file:font-semibold file:text-navy" />
          <TempStorageNote className="mt-2" />
          {editing && expense!.receipt_file && !file && (
            <span className="mt-1 flex items-center gap-3 text-xs">
              <a className="font-semibold text-navy underline" href={`/api/admin/expenses/${expense!.id}/receipt`} target="_blank" rel="noopener noreferrer">View current receipt</a>
              <label className="flex items-center gap-1"><input type="checkbox" checked={removeReceipt} onChange={(e) => setRemoveReceipt(e.target.checked)} /> Remove</label>
            </span>
          )}
        </Field>}
      </div>
    </Modal>
  );
}
