import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { byId, col, exists, insert, list, logActivity, nextOrder, nowIso, one, patch } from '../db.ts';
import { dirs } from '../config.ts';
import { HttpError, escapeRegex, idParam, optStr, pick, reqStr } from '../util.ts';

export const contentRouter = Router();

const IMG: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const makeUpload = (dir: string, maxMb: number, files = 1) =>
  multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_r, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (IMG[f.mimetype] ?? '')),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files },
    fileFilter: (_r, f, cb) => cb(null, f.mimetype in IMG),
  });
const galleryUpload = makeUpload(dirs.gallery, 15, 20);
const siteUpload = makeUpload(dirs.site, 10);

const VIDEO: Record<string, string> = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const reelUpload = multer({
  storage: multer.diskStorage({
    destination: dirs.reels,
    filename: (_r, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (VIDEO[f.mimetype] ?? '')),
  }),
  limits: { fileSize: 150 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => cb(null, f.mimetype in VIDEO),
});

function removeUploaded(url: string | null | undefined) {
  if (!url?.startsWith('/uploads/')) return;
  const base = path.resolve(dirs.gallery, '..');
  const full = path.resolve(base, url.replace('/uploads/', ''));
  if (full.startsWith(base + path.sep)) fs.rm(full, { force: true }, () => {});
}

// ---- settings -------------------------------------------------------------------
export const SETTING_KEYS = [
  'brand_name', 'tagline', 'hero_title', 'hero_subtitle', 'hero_image', 'about_text', 'whatsapp_number', 'phone', 'email',
  'instagram_handle', 'instagram_url', 'city', 'service_area', 'whatsapp_greeting', 'show_samples', 'events_cta_text',
  'seo_title', 'seo_description', 'footer_text',
] as const;

export async function readSettings(): Promise<Record<string, string>> {
  return Object.fromEntries((await col('settings').find().toArray()).map((r) => [r._id as unknown as string, r.value as string]));
}

contentRouter.get('/settings', async (_req, res) => res.json(await readSettings()));
contentRouter.put('/settings', async (req, res) => {
  const d = z.record(z.string(), z.string().max(5000)).parse(req.body);
  const ops = Object.entries(d)
    .filter(([k]) => (SETTING_KEYS as readonly string[]).includes(k))
    .map(([k, v]) => ({ updateOne: { filter: { _id: k as any }, update: { $set: { value: v.trim() } }, upsert: true } }));
  if (ops.length) await col('settings').bulkWrite(ops);
  await logActivity('content', 'Website settings updated');
  res.json(await readSettings());
});

contentRouter.post('/site-image', siteUpload.single('image'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'Please upload a JPG, PNG, WebP or GIF image');
  res.status(201).json({ url: `/uploads/site/${req.file.filename}` });
});

// ---- packages -------------------------------------------------------------------
const pkgSchema = z.object({
  code: reqStr(30),
  name: reqStr(60),
  price: z.coerce.number().min(0),
  duration_hours: z.coerce.number().positive().default(4),
  tagline: optStr(200),
  features: z.array(z.string().trim().min(1).max(200)).max(20),
  highlighted: z.coerce.boolean().default(false),
  cta_label: optStr(80),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});
const PKG_COLS = ['code', 'name', 'price', 'duration_hours', 'tagline', 'features', 'highlighted', 'cta_label', 'active', 'sort_order'];

contentRouter.get('/packages', async (_req, res) => res.json(await list('packages', {}, { sort_order: 1, _id: 1 })));

contentRouter.post('/packages', async (req, res) => {
  const d = pkgSchema.parse(req.body);
  if (await exists('packages', { code: d.code })) throw new HttpError(409, 'A package with this code already exists');
  const id = await insert('packages', { ...d, tagline: d.tagline ?? null, cta_label: d.cta_label ?? null });
  res.status(201).json(await byId('packages', id));
});
contentRouter.patch('/packages/:id', async (req, res) => {
  const id = idParam(req.params.id);
  if (!(await exists('packages', { _id: id }))) throw new HttpError(404, 'Package not found');
  const d = pkgSchema.partial().parse(req.body);
  await patch('packages', id, pick(d, PKG_COLS));
  const row = await byId('packages', id);
  await logActivity('content', `Package updated: ${row!.name}`);
  res.json(row);
});
contentRouter.delete('/packages/:id', async (req, res) => {
  await col('packages').deleteOne({ _id: idParam(req.params.id) as any });
  res.json({ ok: true });
});

// ---- faqs ------------------------------------------------------------------------
const faqSchema = z.object({
  question: reqStr(300), answer: reqStr(3000),
  visible: z.coerce.boolean().default(true), sort_order: z.coerce.number().int().default(0),
});

contentRouter.get('/faqs', async (_req, res) => res.json(await list('faqs', {}, { sort_order: 1, _id: 1 })));
contentRouter.post('/faqs', async (req, res) => {
  const d = faqSchema.parse(req.body);
  const id = await insert('faqs', { ...d, sort_order: await nextOrder('faqs') });
  res.status(201).json(await byId('faqs', id));
});
contentRouter.patch('/faqs/:id', async (req, res) => {
  const id = idParam(req.params.id);
  await patch('faqs', id, pick(faqSchema.partial().parse(req.body), ['question', 'answer', 'visible', 'sort_order']));
  res.json(await byId('faqs', id));
});
contentRouter.delete('/faqs/:id', async (req, res) => {
  await col('faqs').deleteOne({ _id: idParam(req.params.id) as any });
  res.json({ ok: true });
});

// ---- event cards ("Events we cover") ---------------------------------------------
const cardSchema = z.object({
  title: reqStr(80), description: optStr(400), image_url: optStr(500),
  visible: z.coerce.boolean().default(true), sort_order: z.coerce.number().int().default(0),
});
contentRouter.get('/event-cards', async (_req, res) => res.json(await list('event_cards', {}, { sort_order: 1, _id: 1 })));
contentRouter.post('/event-cards', async (req, res) => {
  const d = cardSchema.parse(req.body);
  const id = await insert('event_cards', { ...d, description: d.description ?? null, image_url: d.image_url ?? null, sort_order: await nextOrder('event_cards') });
  res.status(201).json(await byId('event_cards', id));
});
contentRouter.patch('/event-cards/:id', async (req, res) => {
  const id = idParam(req.params.id);
  await patch('event_cards', id, pick(cardSchema.partial().parse(req.body), ['title', 'description', 'image_url', 'visible', 'sort_order']));
  res.json(await byId('event_cards', id));
});
contentRouter.delete('/event-cards/:id', async (req, res) => {
  await col('event_cards').deleteOne({ _id: idParam(req.params.id) as any });
  res.json({ ok: true });
});
// ---- social posts (Instagram reels & posts shown on the public site) ---------------
// Matches instagram.com/reel/CODE, /reels/CODE, /p/CODE, /tv/CODE and /username/reel/CODE (query strings are ignored).
const IG_RX = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]+)/i;
const socialSchema = z.object({
  url: reqStr(500), caption: optStr(120),
  visible: z.coerce.boolean().default(true), sort_order: z.coerce.number().int().default(0),
});
contentRouter.get('/social-posts', async (_req, res) => res.json(await list('social_posts', {}, { sort_order: 1, _id: 1 })));
contentRouter.post('/social-posts', async (req, res) => {
  const d = socialSchema.parse(req.body);
  const m = IG_RX.exec(d.url);
  if (!m) throw new HttpError(400, 'Paste a link to an Instagram reel or post, e.g. https://www.instagram.com/reel/XXXXXXXX/');
  const kind = m[1].toLowerCase() === 'p' ? 'post' : 'reel';
  const code = m[2];
  if (await exists('social_posts', { code })) throw new HttpError(409, 'This reel/post is already added');
  const id = await insert('social_posts', { kind, code, caption: d.caption ?? null, visible: d.visible, sort_order: await nextOrder('social_posts'), created_at: nowIso() });
  await logActivity('content', `Instagram ${kind} added`);
  res.status(201).json(await byId('social_posts', id));
});
contentRouter.patch('/social-posts/:id', async (req, res) => {
  const id = idParam(req.params.id);
  if (!(await exists('social_posts', { _id: id }))) throw new HttpError(404, 'Not found');
  await patch('social_posts', id, pick(socialSchema.omit({ url: true }).partial().parse(req.body), ['caption', 'visible', 'sort_order']));
  res.json(await byId('social_posts', id));
});
contentRouter.post('/social-posts/video', reelUpload.single('video'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Please upload an MP4, WebM or MOV video (max 150 MB)');
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 120) || null : null;
  const id = await insert('social_posts', {
    kind: 'video', code: null, video_url: `/uploads/reels/${req.file.filename}`, caption, visible: true,
    sort_order: await nextOrder('social_posts'), created_at: nowIso(),
  });
  await logActivity('content', 'Reel video uploaded');
  res.status(201).json(await byId('social_posts', id));
});
contentRouter.delete('/social-posts/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const row = await byId('social_posts', id);
  await col('social_posts').deleteOne({ _id: id as any });
  if (row?.video_url) removeUploaded(row.video_url);
  res.json({ ok: true });
});



// ---- gallery ---------------------------------------------------------------------
contentRouter.get('/gallery', async (_req, res) => {
  res.json({
    images: await list('gallery_images', {}, { sort_order: 1, _id: -1 }),
    categories: await list('gallery_categories', {}, { sort_order: 1, _id: 1 }),
  });
});

contentRouter.post('/gallery', galleryUpload.array('images', 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw new HttpError(400, 'Please upload JPG, PNG, WebP or GIF images (max 15MB each)');
  const category = z.string().trim().min(1).parse(req.body.category);
  if (!(await exists('gallery_categories', { name: category }))) {
    files.forEach((f) => fs.rm(f.path, { force: true }, () => {}));
    throw new HttpError(400, 'Unknown category');
  }
  const title = typeof req.body.title === 'string' ? req.body.title.trim() || null : null;
  const order = -Math.floor(Date.now() / 1000); // newest first
  for (const f of files) {
    await insert('gallery_images', {
      title, category, url: `/uploads/gallery/${f.filename}`, is_sample: false, visible: true, sort_order: order, created_at: nowIso(),
    });
  }
  await logActivity('content', `${files.length} gallery image(s) added to ${category}`);
  res.status(201).json({ added: files.length });
});

contentRouter.patch('/gallery/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = z.object({ title: optStr(120), category: reqStr(60).optional(), visible: z.coerce.boolean().optional(), sort_order: z.coerce.number().int().optional() }).parse(req.body);
  if (d.category && !(await exists('gallery_categories', { name: d.category }))) throw new HttpError(400, 'Unknown category');
  await patch('gallery_images', id, pick(d, ['title', 'category', 'visible', 'sort_order']));
  res.json({ ok: true });
});
contentRouter.delete('/gallery/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const row = await byId('gallery_images', id);
  if (!row) throw new HttpError(404, 'Image not found');
  await col('gallery_images').deleteOne({ _id: id as any });
  removeUploaded(row.url);
  res.json({ ok: true });
});
contentRouter.post('/gallery/clear-samples', async (_req, res) => {
  const samples = await list('gallery_images', { is_sample: true });
  await col('gallery_images').deleteMany({ is_sample: true });
  samples.forEach((s) => removeUploaded(s.url));
  res.json({ ok: true });
});

contentRouter.post('/gallery-categories', async (req, res) => {
  const name = reqStr(40).parse(req.body.name);
  if (await one('gallery_categories', { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } })) throw new HttpError(409, 'Category already exists');
  await insert('gallery_categories', { name, sort_order: await nextOrder('gallery_categories') });
  res.status(201).json({ ok: true });
});
contentRouter.patch('/gallery-categories/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const name = reqStr(40).parse(req.body.name);
  const cur = await byId('gallery_categories', id);
  if (!cur) throw new HttpError(404, 'Category not found');
  const clash = await one('gallery_categories', { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }, _id: { $ne: id } });
  if (clash) throw new HttpError(409, 'Category already exists');
  await patch('gallery_categories', id, { name });
  await col('gallery_images').updateMany({ category: cur.name }, { $set: { category: name } });
  res.json({ ok: true });
});
contentRouter.delete('/gallery-categories/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const cur = await byId('gallery_categories', id);
  if (!cur) throw new HttpError(404, 'Category not found');
  const used = await col('gallery_images').countDocuments({ category: cur.name });
  if (used) throw new HttpError(409, `Move or delete the ${used} image(s) in "${cur.name}" first`);
  await col('gallery_categories').deleteOne({ _id: id as any });
  res.json({ ok: true });
});
