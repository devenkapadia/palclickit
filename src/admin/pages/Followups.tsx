import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CalendarDays, Check, ExternalLink, MessageCircle, Phone, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtTime, telLink, waLink } from '@/lib/format';
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Textarea, useUi } from '@/components/ui';
import { FollowupModal } from '../InquiryParts';
import { useAction } from '../hooks';
import { useAdmin, type Row } from '../ctx';
import { ContactButtons } from './shared';

export default function Followups() {
  const { data, error, isLoading } = useQuery({ queryKey: ['followups'], queryFn: () => api.get<Record<'today' | 'overdue' | 'upcoming' | 'completed', Row[]>>('/admin/followups') });
  const { openInquiry } = useAdmin();
  const act = useAction();
  const { confirm } = useUi();
  const [resched, setResched] = useState<Row | null>(null);
  const [done, setDone] = useState<Row | null>(null);
  const [outcome, setOutcome] = useState('');

  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;

  const complete = async () => {
    if (!done) return;
    if (await act(() => api.post(`/admin/followups/${done.id}/complete`, { outcome }), 'Follow-up completed')) { setDone(null); setOutcome(''); }
  };

  const Item = ({ f, tone }: { f: Row; tone?: 'overdue' | 'done' }) => (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${tone === 'overdue' ? 'bg-bad/5' : ''}`}>
      <div className="min-w-0 flex-1 basis-56">
        <button onClick={() => openInquiry(f.inquiry_id)} className="text-left">
          <span className="font-semibold hover:underline">{f.customer_name}</span>
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 text-slate-400" /><span className="font-medium">Event:</span> {f.event_date ? fmtDate(f.event_date) : 'Date not set'}{f.event_type ? ` · ${f.event_type}` : ''}</span>
          {f.phone && <a href={telLink(f.phone)} className="inline-flex items-center gap-1 hover:underline"><Phone className="size-3.5 text-slate-400" />{f.phone}</a>}
          {f.whatsapp && f.whatsapp !== f.phone && <a href={waLink(f.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline"><MessageCircle className="size-3.5 text-slate-400" />{f.whatsapp}</a>}
        </div>
        <div className={`text-sm ${tone === 'overdue' ? 'font-semibold text-bad' : 'text-slate-600'}`}>
          {tone === 'overdue' && <AlertTriangle className="mr-1 inline size-3.5" />}
          {tone === 'done' ? `Completed ${fmtDateTime(f.completed_at)}` : `${fmtDate(f.due_date)} ${fmtTime(f.due_time)}`}
          {f.note && <span className="font-normal text-slate-500"> · {f.note}</span>}
        </div>
      </div>
      <Badge>{f.inquiry_status}</Badge>
      <ContactButtons phone={f.phone} whatsapp={f.whatsapp} size="md" />
      <div className="flex gap-1">
        {tone === 'done' ? (
          <Button size="sm" variant="ghost" onClick={() => act(() => api.post(`/admin/followups/${f.id}/reopen`), 'Re-opened')}><RotateCcw className="size-4" /> Reopen</Button>
        ) : (
          <>
            <Button size="sm" onClick={() => { setDone(f); setOutcome(''); }}><Check className="size-4" /> Done</Button>
            <Button size="sm" variant="soft" onClick={() => setResched(f)} aria-label="Reschedule"><CalendarClock className="size-4" /></Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => openInquiry(f.inquiry_id)} aria-label="Open inquiry"><ExternalLink className="size-4" /></Button>
        <Button size="sm" variant="ghost" aria-label="Delete follow-up" onClick={async () => { if (await confirm({ title: 'Delete follow-up?' })) act(() => api.del(`/admin/followups/${f.id}`), 'Deleted'); }}><Trash2 className="size-4 text-bad" /></Button>
      </div>
    </li>
  );

  const Section = ({ title, rows, tone, empty }: { title: string; rows: Row[]; tone?: 'overdue' | 'done'; empty: string }) => (
    <Card className={tone === 'overdue' && rows.length ? 'border-bad/40' : ''}>
      <CardHeader title={<span className={tone === 'overdue' && rows.length ? 'text-bad' : ''}>{title} <span className="ml-1 text-sm font-medium text-slate-400">{rows.length}</span></span>} />
      {rows.length === 0 ? <Empty title={empty} /> : <ul className="divide-y divide-slate-100">{rows.map((f) => <Item key={f.id} f={f} tone={tone} />)}</ul>}
    </Card>
  );

  return (
    <>
      <PageHeader title="Follow-ups" sub="Everyone you promised to get back to." />
      <div className="space-y-5">
        <Section title="Overdue" rows={data.overdue} tone="overdue" empty="Nothing overdue — nice." />
        <Section title="Today" rows={data.today} empty="No follow-ups scheduled for today." />
        <Section title="Upcoming" rows={data.upcoming} empty="No upcoming follow-ups. Schedule them from an inquiry." />
        <Section title="Completed" rows={data.completed} tone="done" empty="Completed follow-ups will appear here." />
      </div>

      <FollowupModal open={!!resched} onClose={() => setResched(null)} followup={resched} />
      <Modal open={!!done} onClose={() => setDone(null)} title={`Complete follow-up${done ? ` — ${done.customer_name}` : ''}`}
        footer={<><Button variant="outline" onClick={() => setDone(null)}>Cancel</Button><Button onClick={complete}>Mark completed</Button></>}>
        <Field label="Outcome (saved to the inquiry's activity log)"><Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Will confirm after speaking to family" autoFocus /></Field>
        <p className="mt-2 text-xs text-slate-500">Want another reminder? Open the inquiry and schedule the next follow-up.</p>
      </Modal>
    </>
  );
}
