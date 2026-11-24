import fs from 'node:fs';
import path from 'node:path';
import { col, exists, insert, nowIso } from './db.ts';
import { dirs } from './config.ts';
import { DEFAULT_GALLERY_CATEGORIES } from '../shared/constants.ts';
import { fill } from '../shared/fill.ts';
import content from '../shared/content.json' with { type: 'json' };

const BLUE = '#A4D7EB', INK = '#171717', YELLOW = '#FFDE59', NAVY = '#153B50', CREAM = '#FFF9E8', SOFT = '#EAF6FC';

/** Brand-styled illustrated placeholder (clearly flagged as sample; replace from Admin → Gallery). */
function sampleArt(seed: number, label: string, palette: [string, string, string], w = 800, h = 1000): string {
  const [bg, fg, accent] = palette;
  const r = (n: number) => (Math.sin(seed * 999 + n * 77) + 1) / 2;
  const frames = [0, 1, 2, 3].map((i) => {
    const y = 90 + i * 200;
    const faceX = 400 + (r(i) - 0.5) * 60;
    const hue = [CREAM, SOFT, '#fff', YELLOW][(i + seed) % 4];
    return `<rect x="230" y="${y}" width="340" height="170" rx="10" fill="${hue}" stroke="${INK}" stroke-width="4"/>
    <circle cx="${faceX - 55}" cy="${y + 85}" r="34" fill="${accent}" stroke="${INK}" stroke-width="4"/>
    <circle cx="${faceX + 50}" cy="${y + 90}" r="30" fill="${fg}" stroke="${INK}" stroke-width="4"/>
    <path d="M${faceX - 75} ${y + 160} q20 -50 40 0 z" fill="${accent}" stroke="${INK}" stroke-width="4"/>
    <path d="M${faceX + 28} ${y + 160} q22 -45 44 0 z" fill="${fg}" stroke="${INK}" stroke-width="4"/>`;
  }).join('');
  const dots = Array.from({ length: 14 }, (_, i) =>
    `<circle cx="${r(i + 3) * w}" cy="${r(i + 9) * h}" r="${6 + r(i) * 14}" fill="${i % 2 ? YELLOW : '#fff'}" opacity=".55"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="${bg}"/>${dots}
<g transform="rotate(${(r(1) - 0.5) * 8} 400 500)">
<rect x="215" y="74" width="370" height="830" rx="14" fill="#000" opacity=".18" transform="translate(14 14)"/>
<rect x="205" y="64" width="390" height="850" rx="14" fill="#fff" stroke="${INK}" stroke-width="5"/>${frames}
<text x="400" y="890" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="30" fill="${INK}">${content.brand.stripCaption}</text></g>
<text x="40" y="${h - 36}" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="${INK}" opacity=".7">${fill(content.gallerySamples_data.artCaption, { label })}</text>
</svg>`;
}

const PALETTES: [string, string, string][] = [
  [BLUE, '#F2A65A', '#E76F51'], [YELLOW, BLUE, '#E76F51'], [NAVY, YELLOW, BLUE], [CREAM, BLUE, '#F2A65A'],
  ['#F2A65A', CREAM, NAVY], [SOFT, YELLOW, '#3B8C69'],
];

/** Idempotent first-run content. Never overwrites anything the owner has edited. */
export async function seed() {
  // First-run text comes from shared/content.json ("settings"). {brand} is filled in here.
  const defaults: Record<string, string> = Object.fromEntries(
    Object.entries(content.settings).map(([k, v]) => [k, fill(v, { brand: content.brand.name })]),
  );
  await col('settings').bulkWrite(
    Object.entries(defaults).map(([k, v]) => ({ updateOne: { filter: { _id: k as any }, update: { $setOnInsert: { value: v } }, upsert: true } })),
  );

  if (!(await exists('packages', {}))) {
    for (const [i, p] of content.packages_data.entries()) {
      await insert('packages', {
        code: p.code, name: p.name, price: p.price, duration_hours: 4, tagline: p.tagline, features: [...p.features],
        highlighted: p.highlighted, cta_label: p.cta_label, active: true, sort_order: i,
      });
    }
  }

  if (!(await exists('faqs', {}))) {
    for (const [i, f] of content.faqs_data.entries()) await insert('faqs', { question: f.question, answer: f.answer, visible: true, sort_order: i });
  }

  if (!(await exists('gallery_categories', {}))) {
    for (const [i, c] of DEFAULT_GALLERY_CATEGORIES.entries()) await insert('gallery_categories', { name: c, sort_order: i });
  }
  if (!(await exists('gallery_images', {}))) {
    const items = content.gallerySamples_data.items;
    const heights = [1000, 800, 900, 1000, 850, 1000, 800, 920, 1000];
    for (const [i, { category: cat, label }] of items.entries()) {
      const file = `sample-${i + 1}.svg`;
      fs.writeFileSync(path.join(dirs.gallery, file), sampleArt(i + 1, label, PALETTES[i % PALETTES.length], 800, heights[i]));
      await insert('gallery_images', {
        title: label, category: cat, url: `/uploads/gallery/${file}`, is_sample: true, visible: true, sort_order: i, created_at: nowIso(),
      });
    }
  }

  if (!(await exists('event_cards', {}))) {
    for (const [i, c] of content.eventCards_data.entries()) {
      await insert('event_cards', { title: c.title, description: c.description, image_url: c.image, visible: true, sort_order: i });
    }
  } else {
    // One-time upgrade: swap untouched sample artwork (/uploads/site/event-N.svg) for the real photos in /public/imgs.
    const sample = { image_url: { $regex: '^/uploads/site/event-\\d+\\.svg$' } };
    for (const c of content.eventCards_data) {
      await col('event_cards').updateOne({ title: c.title, ...sample }, { $set: { image_url: c.image } });
    }
    await col('event_cards').deleteMany({ title: { $in: ['Brand Activations', 'Private Parties'] }, $or: [sample, { image_url: '/imgs/photobooth.png' }] });
  }
}
