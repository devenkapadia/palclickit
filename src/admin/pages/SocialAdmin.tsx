import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, useUi } from '@/components/ui';
import { useAction } from '../hooks';
import { type Row } from '../ctx';

const igLink = (p: Row) => `https://www.instagram.com/${p.kind === 'post' ? 'p' : 'reel'}/${p.code}/`;
const KIND_LABEL: Record<string, string> = { post: 'Post', reel: 'Instagram reel', video: 'Video' };

export default function SocialAdmin() {
  const { data, error, isLoading } = useQuery({ queryKey: ['social-posts'], queryFn: () => api.get<Row[]>('/admin/content/social-posts') });
  const act = useAction();
  const { confirm } = useUi();
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [vidCaption, setVidCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await act(() => api.post('/admin/content/social-posts', { url, caption }), 'Added to the website')) { setUrl(''); setCaption(''); }
  };
  const uploadVideo = async (file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('video', file);
    if (vidCaption.trim()) fd.append('caption', vidCaption.trim());
    setBusy(true);
    const ok = await act(() => api.post('/admin/content/social-posts/video', fd), 'Video added to the website');
    setBusy(false);
    if (ok) setVidCaption('');
    if (fileRef.current) fileRef.current.value = '';
  };
  const swap = (i: number, d: -1 | 1) => {
    const a = data[i], b = data[i + d];
    if (!a || !b) return;
    return act(async () => {
      await api.patch(`/admin/content/social-posts/${a.id}`, { sort_order: i + d });
      await api.patch(`/admin/content/social-posts/${b.id}`, { sort_order: i });
    });
  };

  return (
    <>
      <PageHeader title="Reels & Posts" sub="Instagram reels and posts shown in the “Our work” section of the website, in this order." />

      <Card className="mb-5 p-4">
        <div className="mb-1 text-sm font-bold">Upload a reel video <span className="font-normal text-slate-500">— shows only the video, no Instagram header or footer</span></div>
        <div className="mb-1 grid items-end gap-3 sm:grid-cols-[2fr_auto]">
          <Field label="Caption (optional)"><Input value={vidCaption} onChange={(e) => setVidCaption(e.target.value)} placeholder="e.g. Navratri at UWay" maxLength={120} /></Field>
          <div>
            <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => uploadVideo(e.target.files?.[0])} />
            <Button type="button" loading={busy} onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Upload video</Button>
          </div>
        </div>
        <p className="mb-4 text-xs text-slate-500">MP4, WebM or MOV · up to 150 MB · vertical (9:16) videos look best.</p>
        <div className="mb-2 border-t border-slate-100 pt-4 text-sm font-bold">Or link an Instagram reel/post <span className="font-normal text-slate-500">— Instagram adds its own header and footer</span></div>
        <form onSubmit={add} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <Field label="Instagram link" required hint="Open the reel/post on Instagram → ⋯ → Copy link">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/XXXXXXXXXXX/" />
          </Field>
          <Field label="Caption (optional)"><Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Navratri at UWay" maxLength={120} /></Field>
          <Button disabled={!url.trim()}><Plus className="size-4" /> Add</Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">The reel or post must be public on your Instagram account, otherwise Instagram won't show it on the website. The section stays hidden until you add at least one.</p>
      </Card>

      <Card>
        {data.length === 0 ? <Empty title="No reels or posts yet" hint="Paste your first Instagram link above." /> : (
          <ul className="divide-y divide-slate-100">
            {data.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => swap(i, -1)} className="text-slate-400 hover:text-ink disabled:opacity-20"><ArrowUp className="size-4" /></button>
                  <button aria-label="Move down" disabled={i === data.length - 1} onClick={() => swap(i, 1)} className="text-slate-400 hover:text-ink disabled:opacity-20"><ArrowDown className="size-4" /></button>
                </div>
                <div className={`min-w-0 flex-1 ${p.visible ? '' : 'opacity-50'}`}>
                  <div className="flex items-center gap-2">
                    <Badge>{KIND_LABEL[p.kind] ?? 'Reel'}</Badge>
                    <span className="truncate font-semibold">{p.caption || 'No caption'}</span>
                    {!p.visible && <Badge>Hidden</Badge>}
                  </div>
                  {p.kind === 'video'
                    ? <video src={p.video_url} muted preload="metadata" className="mt-1 h-20 rounded-md bg-slate-100" />
                    : <a href={igLink(p)} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-slate-500 hover:underline">{igLink(p)} <ExternalLink className="size-3" /></a>}
                </div>
                <div className="flex shrink-0">
                  <Button size="sm" variant="ghost" aria-label={p.visible ? 'Hide' : 'Show'} onClick={() => act(() => api.patch(`/admin/content/social-posts/${p.id}`, { visible: !p.visible }))}>{p.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</Button>
                  <Button size="sm" variant="ghost" aria-label="Edit caption" onClick={() => { setEdit(p); setEditCaption(p.caption ?? ''); }}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Delete" onClick={async () => { if (await confirm({ title: 'Remove from website?', body: 'This only removes it from your website, not from Instagram.' })) act(() => api.del(`/admin/content/social-posts/${p.id}`), 'Removed'); }}><Trash2 className="size-4 text-bad" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit caption"
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={async () => { if (await act(() => api.patch(`/admin/content/social-posts/${edit!.id}`, { caption: editCaption }), 'Caption updated')) setEdit(null); }}>Save</Button></>}>
        <Field label="Caption"><Input value={editCaption} onChange={(e) => setEditCaption(e.target.value)} maxLength={120} autoFocus /></Field>
      </Modal>
    </>
  );
}
