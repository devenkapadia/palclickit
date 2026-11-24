import { useQuery } from '@tanstack/react-query';
import { Check, MapPin, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtTime, inr, timeAgo } from '@/lib/format';
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, useUi } from '@/components/ui';
import { useAction } from '../hooks';
import { useAdmin, type Row } from '../ctx';
import { ContactButtons } from './shared';

/** Website form submissions wait here. Approving turns one into a normal inquiry; discarding deletes it. */
export default function WebsiteRequests() {
  const { data, error, isLoading } = useQuery({ queryKey: ['pending-requests'], queryFn: () => api.get<Row[]>('/admin/inquiries/pending') });
  const { openInquiry } = useAdmin();
  const act = useAction();
  const { confirm } = useUi();

  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;

  const approve = async (r: Row) => {
    if (await act(() => api.post(`/admin/inquiries/${r.id}/approve`), `${r.customer_name} added to Inquiries`)) openInquiry(r.id);
  };
  const discard = async (r: Row) => {
    if (!(await confirm({ title: 'Discard this request?', body: `${r.customer_name}'s website request will be deleted. Use this for spam or test submissions.` }))) return;
    act(() => api.del(`/admin/inquiries/${r.id}/reject`), 'Request discarded');
  };

  return (
    <>
      <PageHeader title="Website requests" sub={data.length ? `${data.length} waiting for your approval` : 'Submissions from the website form land here first.'} />
      {data.length === 0 ? (
        <Card><Empty title="No requests waiting" hint="New website form submissions appear here. Approve the real ones to move them into Inquiries." /></Card>
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-base font-bold">{r.customer_name}</span>
                  <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
                </div>
                <div className="mt-0.5 text-sm text-slate-600">
                  {r.event_type}{r.event_date ? ` · ${fmtDate(r.event_date)}` : ''}{r.start_time ? ` ${fmtTime(r.start_time)}` : ''}
                  {r.guest_count ? ` · ${r.guest_count} guests` : ''} · {r.package_code}{r.quoted_price != null ? ` (${inr(r.quoted_price)})` : ''}
                </div>
                {(r.venue_name || r.location) && <div className="mt-0.5 flex items-center gap-1 text-sm text-slate-600"><MapPin className="size-3.5 text-slate-400" />{[r.venue_name, r.location].filter(Boolean).join(', ')}</div>}
                <div className="mt-0.5 text-sm text-slate-600">{r.phone}</div>
                {r.notes && <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-700">{r.notes}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ContactButtons phone={r.phone} whatsapp={r.whatsapp} size="md" />
                <Button size="sm" onClick={() => approve(r)}><Check className="size-4" /> Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => discard(r)} aria-label="Discard request"><Trash2 className="size-4 text-bad" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
