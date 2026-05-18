/**
 * Brand color tokens — single source of truth for inline styles
 * and gradients. CSS-side equivalents live in src/app/globals.css
 * as `--brand-*` custom properties.
 *
 * Prefer using CSS variables (var(--brand-pink)) in stylesheets and
 * Tailwind classes; use these constants only when you need a literal
 * hex (e.g. inline SVG fills, Framer Motion props, dynamic gradients).
 */

export const brand = {
  pink: '#ff4d8c',
  pinkStrong: '#FF3D9A',
  pinkLight: '#ff85b3',
  pinkHover: '#e6007e',
  cyan: '#00b4d8',
  cyanStrong: '#00C2FF',
  cyanLight: '#90e0ef',
  purple: '#7B2FBE',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  slate900: '#0f172a',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate100: '#f1f5f9',
} as const;

export const gradients = {
  /** Brand pink → cyan, used for avatars and hero accents */
  brand: `linear-gradient(135deg, ${brand.pink}, ${brand.cyan})`,
  /** Pink-only — primary CTAs */
  pink: `linear-gradient(135deg, ${brand.pink}, ${brand.pinkLight})`,
  /** Cyan-only — secondary CTAs */
  cyan: `linear-gradient(135deg, ${brand.cyanStrong}, ${brand.cyanLight})`,
} as const;
