import { Router } from 'express';
import { z } from 'zod';
import { insert, list, logActivity, nowIso, one } from '../db.ts';
import { readSettings } from './content.ts';
import { optDate, optInt, optNum, optStr, optTime, phoneStr, reqStr, today } from '../util.ts';
import { EVENT_TYPES, PENDING_STATUS } from '../../shared/constants.ts';

export const publicRouter = Router();

/** Everything the public site needs, in one request. Only public-safe data. */
publicRouter.get('/site', async (_req, res) => {
  const settings = await readSettings();
  const showSamples = settings.show_samples !== 'false';
  const [packages, faqs, eventCards, categories, images, social] = await Promise.all([
    list('packages', { active: true }, { sort_order: 1, _id: 1 }),
    list('faqs', { visible: true }, { sort_order: 1, _id: 1 }),
    list('event_cards', { visible: true }, { sort_order: 1, _id: 1 }),
    list('gallery_categories', {}, { sort_order: 1, _id: 1 }),
    list('gallery_images', { visible: true, ...(showSamples ? {} : { is_sample: false }) }, { sort_order: 1, _id: -1 }),
    list('social_posts', { visible: true }, { sort_order: 1, _id: 1 }),
  ]);
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    settings,
    packages,
    faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    eventCards: eventCards.map((c) => ({ id: c.id, title: c.title, description: c.description, image_url: c.image_url })),
    gallery: {
      categories: categories.map((c) => c.name),
      images: images.map((i) => ({ id: i.id, title: i.title, category: i.category, url: i.url })),
    },
    social: social.map((p) => ({ id: p.id, kind: p.kind, code: p.code, video_url: p.video_url ?? null, caption: p.caption })),
  });
});

const inquirySchema = z.object({
  customer_name: reqStr(120),
  phone: phoneStr,
  event_date: optDate,
  start_time: optTime,
  duration_hours: optNum,
  venue_name: optStr(200),
  location: optStr(300),
  guest_count: optInt,
  event_type: z.enum(EVENT_TYPES),
  package_code: z.enum(['MINI', 'PLUS', 'PREMIUM', 'Not Sure']).default('Not Sure'),
  notes: optStr(2000),
  // Honeypot — real users never fill this in.
  website: z.string().max(0).optional(),
});

publicRouter.post('/inquiry', async (req, res) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: `${issue.path.join('.') || 'form'}: ${issue.message}` });
  }
  const d = parsed.data;
  const pkg = d.package_code === 'Not Sure' ? null : await one('packages', { code: d.package_code });
  const now = nowIso();
  const id = await insert('inquiries', {
    customer_name: d.customer_name, phone: d.phone, whatsapp: d.phone, event_type: d.event_type,
    event_date: d.event_date ?? null, start_time: d.start_time ?? null, duration_hours: d.duration_hours ?? null,
    venue_name: d.venue_name ?? null, location: d.location ?? null, guest_count: d.guest_count ?? null, package_code: d.package_code,
    quoted_price: pkg?.price ?? null, source: 'Website', inquiry_date: today(), status: PENDING_STATUS,
    notes: d.notes ?? null, created_at: now, updated_at: now,
  });
  await logActivity('inquiry', `New website inquiry from ${d.customer_name}`, 'inquiry', id);
  res.status(201).json({ ok: true, reference: `PAL-${String(id).padStart(4, '0')}` });
});
