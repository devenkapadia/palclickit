import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Tabs, TempStorageNote, Textarea, Toggle, useUi } from '@/components/ui';
import { useAction } from '../hooks';
import { type Row } from '../ctx';

type Tab = 'hero' | 'contact' | 'packages' | 'events' | 'faqs';

export default function WebsiteContent() {
  const [tab, setTab] = useState<Tab>('hero');
  return (
    <>
      <PageHeader title="Website Content" sub="Everything here updates the public website immediately — no code changes needed."
        actions={<a href="/" target="_blank" rel="noopener noreferrer"><Button variant="outline">View website ↗</Button></a>} />
      <div className="mb-5 overflow-x-auto">
        <Tabs value={tab} onChange={setTab} options={[
          { value: 'hero', label: 'Hero & text' }, { value: 'contact', label: 'Contact & social' }, { value: 'packages', label: 'Packages' },
          { value: 'events', label: 'Events we cover' }, { value: 'faqs', label: 'FAQs' },
        ]} />
      </div>
      {tab === 'hero' && <SettingsForm title="Hero & brand text" fields={[
        { key: 'hero_title', label: 'Hero headline', hint: 'Shown large at the top of the homepage' },
        { key: 'hero_subtitle', label: 'Hero supporting text', area: true },
        { key: 'tagline', label: 'Tagline' },
        { key: 'events_cta_text', label: 'Events section call-to-action' },
        { key: 'about_text', label: 'Footer / brand description', area: true },
        { key: 'footer_text', label: 'Footer note' },
        { key: 'seo_title', label: 'Browser tab title (SEO)' },
        { key: 'seo_description', label: 'Search description (SEO)', area: true },
      ]} image />}
      {tab === 'contact' && <SettingsForm title="Contact details" intro="Leave a field empty to hide it from the website. The WhatsApp number powers every WhatsApp button and the inquiry hand-off." fields={[
        { key: 'whatsapp_number', label: 'WhatsApp number', hint: 'Include country code, e.g. 919876543210' },
        { key: 'phone', label: 'Phone number' },
        { key: 'email', label: 'Email address' },
        { key: 'instagram_handle', label: 'Instagram handle', hint: 'Without the @ — e.g. palclickit' },
        { key: 'instagram_url', label: 'Instagram URL' },
        { key: 'city', label: 'City' },
        { key: 'service_area', label: 'Service area / travel note' },
        { key: 'whatsapp_greeting', label: 'WhatsApp opening line', hint: 'First line of the prefilled WhatsApp message' },
      ]} />}
      {tab === 'packages' && <Packages />}
      {tab === 'events' && <EventCards />}
      {tab === 'faqs' && <Faqs />}
    </>
  );
}

/* ---------------- Settings ---------------- */
function SettingsForm({ title, intro, fields, image }: { title: string; intro?: string; fields: { key: string; label: string; hint?: string; area?: boolean }[]; image?: boolean }) {
  const { data, error, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<Record<string, string>>('/admin/content/settings') });
  const act = useAction();
  const { toast } = useUi();
  const [v, setV] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (data) setV(data); }, [data]);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;

  const dirty = [...fields.map((f) => f.key), 'hero_image'].some((k) => (v[k] ?? '') !== (data[k] ?? ''));
  const save = () => act(() => api.put('/admin/content/settings', Object.fromEntries([...fields.map((f) => f.key), 'hero_image'].map((k) => [k, v[k] ?? '']))), 'Website updated');
  const upload = async (file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const r = await api.post<{ url: string }>('/admin/content/site-image', fd);
      setV((p) => ({ ...p, hero_image: r.url }));
      toast('Image uploaded — click Save to publish');
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <Card>
      <CardHeader title={title} action={<Button onClick={save} disabled={!dirty}>Save changes</Button>} />
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {intro && <p className="text-sm text-slate-500 sm:col-span-2">{intro}</p>}
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} className={f.area ? 'sm:col-span-2' : ''}>
            {f.area ? <Textarea value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} /> : <Input value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />}
          </Field>
        ))}
        {image && (
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Hero photo</span>
            <div className="flex items-center gap-4">
              {v.hero_image ? <img src={v.hero_image} alt="" className="h-24 w-32 rounded-lg border border-slate-200 object-cover" /> : <div className="grid h-24 w-32 place-items-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">Default artwork</div>}
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Upload photo</Button>
                {v.hero_image && <Button size="sm" variant="ghost" onClick={() => setV({ ...v, hero_image: '' })}>Use default artwork</Button>}
              </div>
            </div>
            <TempStorageNote className="mt-2" />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Packages ---------------- */
function Packages() {
  const { data, error, isLoading } = useQuery({ queryKey: ['packages'], queryFn: () => api.get<Row[]>('/admin/content/packages') });
  const act = useAction();
  const { confirm } = useUi();
  const [edit, setEdit] = useState<Row | null>(null);
  const [f, setF] = useState<Row>({});
  const open = (p: Row | null) => {
    setEdit(p ?? {});
    setF(p ? { ...p, features: (p.features as string[]).join('\n'), tagline: p.tagline ?? '', cta_label: p.cta_label ?? '' } : { code: '', name: '', price: '', duration_hours: 4, tagline: '', features: '', highlighted: false, cta_label: '', active: true });
  };
  const save = async () => {
    const body = { code: String(f.code).trim(), name: f.name, price: Number(f.price), duration_hours: Number(f.duration_hours) || 4, tagline: f.tagline, cta_label: f.cta_label, highlighted: !!f.highlighted, active: !!f.active, features: String(f.features).split('\n').map((s) => s.trim()).filter(Boolean), sort_order: f.sort_order };
    if (!edit?.id) delete (body as Row).sort_order;
    if (await act(() => (edit?.id ? api.patch(`/admin/content/packages/${edit.id}`, body) : api.post('/admin/content/packages', body)), 'Package saved')) setEdit(null);
  };
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => open(null)}><Plus className="size-4" /> Add package</Button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((p) => (
          <Card key={p.id} className={`flex flex-col p-4 ${p.highlighted ? 'border-ink shadow-[4px_4px_0_0_#FFDE59]' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-display text-lg font-extrabold">{p.name}</div><div className="text-xs text-slate-500">Code: {p.code}</div></div>
              <div className="flex flex-col items-end gap-1">{p.highlighted && <Badge tone="Negotiation">Recommended</Badge>}{!p.active && <Badge>Hidden</Badge>}</div>
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold">{inr(p.price)} <span className="text-sm font-medium text-slate-500">/ {p.duration_hours} hrs</span></div>
            <ul className="my-3 flex-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600">{(p.features as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>
            <div className="flex gap-2">
              <Button size="sm" variant="soft" onClick={() => open(p)}><Pencil className="size-4" /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: `Delete ${p.name}?`, body: 'Existing inquiries and bookings keep their package label.' })) act(() => api.del(`/admin/content/packages/${p.id}`), 'Package deleted'); }}><Trash2 className="size-4 text-bad" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? `Edit ${edit.name}` : 'Add package'}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!f.code || !f.name || f.price === ''}>Save</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><Input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="PAL PLUS" /></Field>
          <Field label="Code" required hint="Short code used in inquiries, e.g. PLUS"><Input value={f.code ?? ''} onChange={(e) => setF({ ...f, code: e.target.value })} disabled={!!edit?.id} /></Field>
          <Field label="Price (₹)" required><Input type="number" min="0" value={f.price ?? ''} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Duration (hours)"><Input type="number" min="1" step="0.5" value={f.duration_hours ?? 4} onChange={(e) => setF({ ...f, duration_hours: e.target.value })} /></Field>
          <Field label="Tagline" className="sm:col-span-2"><Input value={f.tagline ?? ''} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
          <Field label="Features" hint="One per line" className="sm:col-span-2"><Textarea rows={8} value={f.features ?? ''} onChange={(e) => setF({ ...f, features: e.target.value })} /></Field>
          <Field label="Button label"><Input value={f.cta_label ?? ''} onChange={(e) => setF({ ...f, cta_label: e.target.value })} placeholder="Enquire for PLUS" /></Field>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <Toggle checked={!!f.highlighted} onChange={(v) => setF({ ...f, highlighted: v })} label="Highlight as recommended" />
            <Toggle checked={!!f.active} onChange={(v) => setF({ ...f, active: v })} label="Show on website" />
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ---------------- FAQs ---------------- */
function Faqs() {
  const { data, error, isLoading } = useQuery({ queryKey: ['faqs'], queryFn: () => api.get<Row[]>('/admin/content/faqs') });
  const act = useAction();
  const { confirm } = useUi();
  const [edit, setEdit] = useState<Row | null>(null);
  const [f, setF] = useState({ question: '', answer: '' });
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;

  const swap = (i: number, d: -1 | 1) => {
    const a = data[i], b = data[i + d];
    if (!a || !b) return;
    // Give both rows distinct explicit orders so the swap is stable even if they were equal.
    return act(async () => {
      await api.patch(`/admin/content/faqs/${a.id}`, { sort_order: i + d });
      await api.patch(`/admin/content/faqs/${b.id}`, { sort_order: i });
    });
  };
  const save = async () => {
    if (await act(() => (edit?.id ? api.patch(`/admin/content/faqs/${edit.id}`, f) : api.post('/admin/content/faqs', f)), 'FAQ saved')) setEdit(null);
  };

  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => { setEdit({}); setF({ question: '', answer: '' }); }}><Plus className="size-4" /> Add FAQ</Button></div>
      <Card>
        {data.length === 0 ? <Empty title="No FAQs yet" /> : (
          <ul className="divide-y divide-slate-100">
            {data.map((q, i) => (
              <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex flex-col"><button aria-label="Move up" disabled={i === 0} onClick={() => swap(i, -1)} className="text-slate-400 hover:text-ink disabled:opacity-20"><ArrowUp className="size-4" /></button><button aria-label="Move down" disabled={i === data.length - 1} onClick={() => swap(i, 1)} className="text-slate-400 hover:text-ink disabled:opacity-20"><ArrowDown className="size-4" /></button></div>
                <div className={`min-w-0 flex-1 ${q.visible ? '' : 'opacity-50'}`}><div className="font-semibold">{q.question}</div><div className="mt-0.5 line-clamp-2 text-sm text-slate-600">{q.answer}</div></div>
                <div className="flex shrink-0">
                  <Button size="sm" variant="ghost" aria-label={q.visible ? 'Hide' : 'Show'} onClick={() => act(() => api.patch(`/admin/content/faqs/${q.id}`, { visible: !q.visible }))}>{q.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</Button>
                  <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => { setEdit(q); setF({ question: q.question, answer: q.answer }); }}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Delete" onClick={async () => { if (await confirm({ title: 'Delete FAQ?' })) act(() => api.del(`/admin/content/faqs/${q.id}`), 'FAQ deleted'); }}><Trash2 className="size-4 text-bad" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit FAQ' : 'Add FAQ'}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!f.question.trim() || !f.answer.trim()}>Save</Button></>}>
        <div className="space-y-3">
          <Field label="Question" required><Input value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} autoFocus /></Field>
          <Field label="Answer" required><Textarea rows={5} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}

/* ---------------- Event cards ---------------- */
function EventCards() {
  const { data, error, isLoading } = useQuery({ queryKey: ['event-cards'], queryFn: () => api.get<Row[]>('/admin/content/event-cards') });
  const act = useAction();
  const { confirm, toast } = useUi();
  const [edit, setEdit] = useState<Row | null>(null);
  const [f, setF] = useState({ title: '', description: '', image_url: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;

  const upload = async (file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try { const r = await api.post<{ url: string }>('/admin/content/site-image', fd); setF((p) => ({ ...p, image_url: r.url })); }
    catch (e) { toast((e as Error).message, 'err'); }
  };
  const save = async () => {
    if (await act(() => (edit?.id ? api.patch(`/admin/content/event-cards/${edit.id}`, f) : api.post('/admin/content/event-cards', f)), 'Event card saved')) setEdit(null);
  };

  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => { setEdit({}); setF({ title: '', description: '', image_url: '' }); }}><Plus className="size-4" /> Add event type</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.map((c) => (
          <Card key={c.id} className={`overflow-hidden ${c.visible ? '' : 'opacity-60'}`}>
            <div className="aspect-[4/3] bg-slate-100">{c.image_url ? <img src={c.image_url} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-xs text-slate-400">Default artwork</div>}</div>
            <div className="p-3">
              <div className="font-semibold">{c.title}</div>
              <div className="line-clamp-2 text-xs text-slate-500">{c.description}</div>
              <div className="mt-2 flex">
                <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => { setEdit(c); setF({ title: c.title, description: c.description ?? '', image_url: c.image_url ?? '' }); }}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" aria-label={c.visible ? 'Hide' : 'Show'} onClick={() => act(() => api.patch(`/admin/content/event-cards/${c.id}`, { visible: !c.visible }))}>{c.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</Button>
                <Button size="sm" variant="ghost" aria-label="Delete" onClick={async () => { if (await confirm({ title: `Delete "${c.title}"?` })) act(() => api.del(`/admin/content/event-cards/${c.id}`), 'Deleted'); }}><Trash2 className="size-4 text-bad" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit event type' : 'Add event type'}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!f.title.trim()}>Save</Button></>}>
        <div className="space-y-3">
          <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
          <Field label="Description"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Photo</span>
            <div className="flex items-center gap-3">
              {f.image_url ? <img src={f.image_url} alt="" className="h-16 w-24 rounded-lg object-cover" /> : <span className="text-xs text-slate-400">Default artwork</span>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Upload</Button>
              {f.image_url && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, image_url: '' })}>Remove</Button>}
            </div>
            <TempStorageNote className="mt-2" />
          </div>
        </div>
      </Modal>
    </>
  );
}
