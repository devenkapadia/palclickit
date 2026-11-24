import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, Check, MessageCircle, Phone, Plus, Trash2, Pencil, ArrowRightLeft, StickyNote, PhoneCall } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtTime, inr, telLink, todayStr, waLink, addDays } from '@/lib/format';
import { EVENT_TYPES, INQUIRY_SOURCES, INQUIRY_STATUSES, LOG_KINDS, PACKAGE_CODES, PAYMENT_METHODS } from '@shared/constants';
import { Badge, Button, Drawer, Field, Input, Modal, Select, Spinner, Textarea, useUi } from '@/components/ui';
import { useAction, num } from './hooks';
import { useAdmin, type Row } from './ctx';

/* ---------------- Inquiry add / edit ---------------- */
export function InquiryFormModal({ open, onClose, inquiry }: { open: boolean; onClose: () => void; inquiry?: Row | null }) {
  const act = useAction();
  const editing = !!inquiry?.id;
  const blank = { customer_name: '', phone: '', whatsapp: '', event_type: 'Wedding', event_date: '', start_time: '', duration_hours: '4', venue_name: '', location: '', guest_count: '', package_code: 'Not Sure', quoted_price: '', source: 'Phone Call', inquiry_date: todayStr(), status: 'New', notes: '' };
  const [f, setF] = useState<Row>(blank);
  const [fuDate, setFuDate] = useState('');
  const { data: pkgs } = useQuery({ queryKey: ['packages'], queryFn: () => api.get<Row[]>('/admin/content/packages'), enabled: open });

  useEffect(() => {
    if (!open) return;
    setFuDate('');
    setF(inquiry ? Object.fromEntries(Object.keys(blank).map((k) => [k, inquiry[k] ?? ''])) : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inquiry]);

  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const pickPackage = (code: string) => {
    const price = pkgs?.find((p) => p.code === code)?.price;
    setF((p) => ({ ...p, package_code: code, quoted_price: price && !p.quoted_price ? String(price) : p.quoted_price }));
  };

  const save = async () => {
    const body = { ...f, duration_hours: num(f.duration_hours), guest_count: num(f.guest_count), quoted_price: num(f.quoted_price) };
    const r = await act(async () => {
      if (editing) return api.patch(`/admin/inquiries/${inquiry!.id}`, body);
      const created = await api.post<Row>('/admin/inquiries', body);
      if (fuDate) await api.post('/admin/followups', { inquiry_id: created.id, due_date: fuDate, note: 'Initial follow-up' });
      return created;
    }, editing ? 'Inquiry updated' : 'Inquiry added');
    if (r) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? `Edit inquiry #${inquiry!.id}` : 'Add inquiry'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!f.customer_name || !f.phone}>{editing ? 'Save changes' : 'Add inquiry'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name" required><Input value={f.customer_name} onChange={set('customer_name')} autoFocus /></Field>
        <Field label="Phone" required><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="WhatsApp (if different)"><Input type="tel" value={f.whatsapp} onChange={set('whatsapp')} /></Field>
        <Field label="Source"><Select value={f.source} onChange={set('source')}>{INQUIRY_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Event type"><Select value={f.event_type} onChange={set('event_type')}>{EVENT_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Event date"><Input type="date" value={f.event_date} onChange={set('event_date')} /></Field>
        <Field label="Start time"><Input type="time" value={f.start_time} onChange={set('start_time')} /></Field>
        <Field label="Duration (hours)"><Input type="number" step="0.5" min="0" value={f.duration_hours} onChange={set('duration_hours')} /></Field>
        <Field label="Guests"><Input type="number" min="0" value={f.guest_count} onChange={set('guest_count')} /></Field>
        <Field label="Venue name"><Input value={f.venue_name} onChange={set('venue_name')} placeholder="e.g. Torino Social" /></Field>
        <Field label="Venue address"><Input value={f.location} onChange={set('location')} placeholder="Behind Bombay Kitchen, Besides Khanpur, Vadodara" /></Field>
        <Field label="Package interested in"><Select value={f.package_code} onChange={(e) => pickPackage(e.target.value)}>{PACKAGE_CODES.filter((p) => p !== 'Custom').concat('Custom' as any).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Quoted price (₹)"><Input type="number" min="0" value={f.quoted_price} onChange={set('quoted_price')} /></Field>
        <Field label="Status"><Select value={f.status} onChange={set('status')}>{INQUIRY_STATUSES.filter((s) => s !== 'Completed' || f.status === 'Completed').map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Inquiry date"><Input type="date" value={f.inquiry_date} onChange={set('inquiry_date')} /></Field>
        {!editing && <Field label="Schedule follow-up" hint="Optional"><Input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} /></Field>}
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

/* ---------------- Follow-up dialog ---------------- */
export function FollowupModal({ open, onClose, inquiryId, followup }: { open: boolean; onClose: () => void; inquiryId?: number; followup?: Row | null }) {
  const act = useAction();
  const [date, setDate] = useState(addDays(todayStr(), 1));
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!open) return;
    setDate(followup?.due_date ?? addDays(todayStr(), 1));
    setTime(followup?.due_time ?? '');
    setNote(followup?.note ?? '');
  }, [open, followup]);
  const save = async () => {
    const r = await act(() => followup
      ? api.patch(`/admin/followups/${followup.id}`, { due_date: date, due_time: time, note })
      : api.post('/admin/followups', { inquiry_id: inquiryId, due_date: date, due_time: time, note }), followup ? 'Follow-up rescheduled' : 'Follow-up scheduled');
    if (r) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={followup ? 'Reschedule follow-up' : 'Schedule follow-up'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!date}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time (optional)"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([l, n]) => <Button key={l as string} size="sm" variant="soft" onClick={() => setDate(addDays(todayStr(), n as number))}>{l}</Button>)}
        </div>
        <Field label="Note" className="sm:col-span-2"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What to discuss…" /></Field>
      </div>
    </Modal>
  );
}

/* ---------------- Convert to booking ---------------- */
export function ConvertModal({ open, onClose, inquiry }: { open: boolean; onClose: () => void; inquiry: Row }) {
  const act = useAction();
  const { openEvent } = useAdmin();
  const [f, setF] = useState<Row>({});
  useEffect(() => {
    if (open) setF({ final_amount: inquiry.quoted_price ?? '', advance_paid: '', advance_method: 'UPI', event_date: inquiry.event_date ?? '', start_time: inquiry.start_time ?? '', duration_hours: inquiry.duration_hours ?? 4, venue_name: inquiry.venue_name ?? '', location: inquiry.location ?? '' });
  }, [open, inquiry]);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    const ev = await act(() => api.post<Row>(`/admin/inquiries/${inquiry.id}/convert`, {
      ...f, final_amount: Number(f.final_amount), advance_paid: num(f.advance_paid ?? ''), duration_hours: num(String(f.duration_hours ?? '')),
    }), 'Booking created');
    if (ev) { onClose(); openEvent(ev.id); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Convert to booking"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={f.final_amount === '' || !f.event_date}>Confirm booking</Button></>}>
      <p className="mb-3 text-sm text-slate-500">Creates a confirmed booking for <b>{inquiry.customer_name}</b> and marks the inquiry as Confirmed.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Final booking amount (₹)" required><Input type="number" min="0" value={f.final_amount ?? ''} onChange={set('final_amount')} autoFocus /></Field>
        <Field label="Advance received (₹)" hint="Recorded as cash received"><Input type="number" min="0" value={f.advance_paid ?? ''} onChange={set('advance_paid')} /></Field>
        <Field label="Advance method"><Select value={f.advance_method ?? 'UPI'} onChange={set('advance_method')}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Event date" required><Input type="date" value={f.event_date ?? ''} onChange={set('event_date')} /></Field>
        <Field label="Start time"><Input type="time" value={f.start_time ?? ''} onChange={set('start_time')} /></Field>
        <Field label="Duration (hours)"><Input type="number" step="0.5" value={f.duration_hours ?? ''} onChange={set('duration_hours')} /></Field>
        <Field label="Venue name"><Input value={f.venue_name ?? ''} onChange={set('venue_name')} placeholder="e.g. Torino Social" /></Field>
        <Field label="Venue address" className="sm:col-span-2"><Input value={f.location ?? ''} onChange={set('location')} placeholder="Behind Bombay Kitchen, Besides Khanpur, Vadodara" /></Field>
      </div>
    </Modal>
  );
}

/* ---------------- Inquiry detail drawer ---------------- */
export function InquiryDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['inquiry', id], queryFn: () => api.get<Row>(`/admin/inquiries/${id}`), enabled: !!id });
  const act = useAction();
  const { confirm } = useUi();
  const { openEvent } = useAdmin();
  const [edit, setEdit] = useState(false);
  const [fu, setFu] = useState<{ open: boolean; row?: Row | null }>({ open: false });
  const [conv, setConv] = useState(false);
  const [kind, setKind] = useState<string>('note');
  const [body, setBody] = useState('');
  const i = data?.inquiry;
  const wa = i ? (i.whatsapp || i.phone) : '';

  const addLog = async () => {
    if (!body.trim()) return;
    const r = await act(() => api.post(`/admin/inquiries/${id}/logs`, { kind, body }), 'Note added');
    if (r) setBody('');
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete inquiry?', body: `${i!.customer_name}'s inquiry, notes and follow-ups will be deleted.${data!.event ? ' The linked booking and its finances are kept.' : ''}` }))) return;
    if (await act(() => api.del(`/admin/inquiries/${id}`), 'Inquiry deleted')) onClose();
  };

  return (
    <Drawer open={!!id} onClose={onClose} title={i ? <span>{i.customer_name} <span className="text-sm font-medium text-slate-400">#{i.id}</span></span> : 'Inquiry'}>
      {isLoading || !i ? <Spinner /> : (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={i.status} className="!w-auto font-semibold" onChange={(e) => act(() => api.patch(`/admin/inquiries/${i.id}`, { status: e.target.value }), 'Status updated')}>
              {INQUIRY_STATUSES.filter((s) => s !== 'Completed' || i.status === 'Completed').map((s) => <option key={s}>{s}</option>)}
            </Select>
            <a href={telLink(i.phone)}><Button size="sm" variant="outline"><Phone className="size-4" /> Call</Button></a>
            <a href={waLink(wa)} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline"><MessageCircle className="size-4 text-good" /> WhatsApp</Button></a>
            <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>
            <Button size="sm" variant="ghost" onClick={del} aria-label="Delete inquiry"><Trash2 className="size-4 text-bad" /></Button>
          </div>

          {data.event ? (
            <button onClick={() => openEvent(data.event.id)} className="flex w-full items-center justify-between rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-left text-sm font-semibold text-good">
              <span>Booking #{data.event.id} · {fmtDate(data.event.event_date)} · {data.event.payment_status}</span><span>Open →</span>
            </button>
          ) : (
            i.status !== 'Lost' && <Button variant="dark" className="w-full" onClick={() => setConv(true)}><ArrowRightLeft className="size-4" /> Convert to booking</Button>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
            {([
              ['Phone', i.phone], ['WhatsApp', i.whatsapp || '—'], ['Event', i.event_type], ['Event date', `${fmtDate(i.event_date)} ${fmtTime(i.start_time)}`],
              ['Duration', i.duration_hours ? `${i.duration_hours} hrs` : '—'], ['Guests', i.guest_count ?? '—'],
              ['Venue name', i.venue_name || '—'], ['Venue address', i.location || '—'],
              ['Package', i.package_code], ['Quoted', inr(i.quoted_price)], ['Source', i.source], ['Inquiry date', fmtDate(i.inquiry_date)], ['Updated', fmtDateTime(i.updated_at)],
            ] as [string, any][]).map(([k, v]) => <div key={k}><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          {i.notes && <div className="rounded-xl border border-slate-200 p-3 text-sm whitespace-pre-wrap"><div className="mb-1 text-xs font-semibold text-slate-500">Notes</div>{i.notes}</div>}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display font-bold">Follow-ups</h3>
              <Button size="sm" variant="soft" onClick={() => setFu({ open: true, row: null })}><CalendarPlus className="size-4" /> Schedule</Button>
            </div>
            {data.followups.length === 0 ? <p className="text-sm text-slate-500">No follow-ups yet.</p> : (
              <ul className="space-y-2">
                {data.followups.map((f: Row) => {
                  const overdue = f.status === 'Pending' && f.due_date < todayStr();
                  return (
                    <li key={f.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${overdue ? 'border-bad/40 bg-bad/5' : 'border-slate-200'}`}>
                      <div className={f.status === 'Completed' ? 'text-slate-400 line-through' : ''}>
                        <div className="font-semibold">{fmtDate(f.due_date)} {fmtTime(f.due_time)} {overdue && <Badge tone="Cancelled" className="ml-1">Overdue</Badge>}</div>
                        {f.note && <div className="text-xs text-slate-500">{f.note}</div>}
                      </div>
                      {f.status === 'Pending' ? (
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="soft" onClick={() => setFu({ open: true, row: f })}><CalendarClock className="size-4" /></Button>
                          <Button size="sm" variant="primary" onClick={() => act(() => api.post(`/admin/followups/${f.id}/complete`), 'Follow-up done')}><Check className="size-4" /> Done</Button>
                        </div>
                      ) : <Badge tone="Completed">Done</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-display font-bold">Activity & notes</h3>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {LOG_KINDS.map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${kind === k ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'}`}>{k}</button>
                ))}
              </div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note or log a call / chat…" rows={2} />
              <div className="mt-2 flex justify-end"><Button size="sm" onClick={addLog} disabled={!body.trim()}><Plus className="size-4" /> Add</Button></div>
            </div>
            <ul className="mt-3 space-y-2">
              {data.logs.map((l: Row) => (
                <li key={l.id} className="flex gap-2 text-sm">
                  <span className="mt-0.5 text-slate-400">{l.kind === 'call' ? <PhoneCall className="size-4" /> : l.kind === 'whatsapp' ? <MessageCircle className="size-4" /> : <StickyNote className="size-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className={l.kind === 'system' ? 'text-slate-500 italic' : ''}>{l.body}</div>
                    <div className="text-xs text-slate-400">{fmtDateTime(l.created_at)}{l.kind !== 'system' && ` · ${l.kind}`}</div>
                  </div>
                  {l.kind !== 'system' && <button aria-label="Delete note" className="text-slate-300 hover:text-bad" onClick={() => act(() => api.del(`/admin/inquiries/${id}/logs/${l.id}`))}><Trash2 className="size-4" /></button>}
                </li>
              ))}
            </ul>
          </section>

          <InquiryFormModal open={edit} onClose={() => setEdit(false)} inquiry={i} />
          <FollowupModal open={fu.open} onClose={() => setFu({ open: false })} inquiryId={i.id} followup={fu.row} />
          <ConvertModal open={conv} onClose={() => setConv(false)} inquiry={i} />
        </div>
      )}
    </Drawer>
  );
}
