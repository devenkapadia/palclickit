import raw from '@shared/content.json';
import { fill } from '@shared/fill';

/** All website text lives in shared/content.json - edit it there. */
export const content = raw;

export const brand = content.brand.name;

/** Fill {placeholders} in a content string. {brand} is always available. */
export const t = (text: string, vars: Record<string, string | number> = {}): string => fill(text, { brand, ...vars });
