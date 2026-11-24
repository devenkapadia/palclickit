/** Replace {placeholders} in a content string, e.g. fill('Hi {name}', { name: 'Asha' }). Unknown placeholders are left as-is. */
export const fill = (text: string, vars: Record<string, string | number> = {}): string =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
