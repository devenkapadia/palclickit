import { z } from 'zod';
import { config } from './config.ts';

/** Today's date (YYYY-MM-DD) in the business timezone. */
export function today(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(d);
}

/** Add hours to HH:MM, wrapping at midnight. */
export function addHoursToTime(time: string | null | undefined, hours: number | null | undefined): string | null {
  if (!time || !hours) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const total = Math.round((h * 60 + m + hours * 60) % 1440);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ---- zod helpers -----------------------------------------------------------
export const optStr = (max = 2000) =>
  z.preprocess((v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v), z.string().max(max).nullable().optional());

export const reqStr = (max = 200) => z.string().trim().min(1, 'Required').max(max);

export const optNum = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().finite().nullable().optional(),
);

export const optInt = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().int().nullable().optional(),
);

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const optDate = z.preprocess((v) => (v === '' ? null : v), dateStr.nullable().optional());
export const optTime = z.preprocess((v) => (v === '' ? null : v), z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM').nullable().optional());

export const phoneStr = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20)
  .regex(/^[0-9+\-\s()]+$/, 'Enter a valid phone number');

/** Keep only whitelisted columns that were actually provided (for partial updates). */
export function pick(data: Record<string, unknown>, cols: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in data && data[c] !== undefined) out[c] = data[c];
  return out;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" match across several fields. */
export function searchFilter(term: string, fields: string[]) {
  const rx = { $regex: escapeRegex(term), $options: 'i' };
  return { $or: fields.map((f) => ({ [f]: rx })) };
}

export function idParam(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
}

/** Nulls last, case-insensitive for strings. */
export function compareBy<T>(key: (r: T) => string | number | null | undefined, dir: 'asc' | 'desc') {
  const m = dir === 'asc' ? 1 : -1;
  return (a: T, b: T) => {
    const x = key(a);
    const y = key(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const cmp = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, undefined, { sensitivity: 'base' }) : (x as number) - (y as number);
    return cmp * m;
  };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
