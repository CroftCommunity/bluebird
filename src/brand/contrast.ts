// WCAG 2.x relative-luminance + contrast-ratio. Pure and dependency-free; used
// by the brand token contrast tests (and available at runtime if ever needed).

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance of an #rrggbb (or #rgb) hex color. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** AA thresholds: 4.5 for body text, 3.0 for large text / meaningful graphics. */
export const AA = { body: 4.5, large: 3.0 } as const;

export function passesAA(a: string, b: string, size: keyof typeof AA): boolean {
  return contrastRatio(a, b) >= AA[size];
}
