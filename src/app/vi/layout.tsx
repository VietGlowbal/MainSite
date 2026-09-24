import type { Metadata } from 'next';
import { translations } from '@/lib/i18n-catalog';
import { primeCatalog } from '@/lib/i18n-catalog-runtime';
import { ViCatalog } from './vi-catalog';

/*
 * Server-side prime. Not a duplicate of <ViCatalog /> — the two cover different
 * halves and BOTH are required.
 *
 * `vi-catalog.tsx` is `'use client'`, so importing it here yields a client
 * reference, not the module: the server does not evaluate it until React
 * renders the element, which is *after* child server components have already
 * run. That is not theoretical — it shipped broken for one build, and
 * `/vi/about` rendered its heading in English (its copy comes from a server
 * component, unlike `/vi` and `/vi/universities`, whose text is client-side and
 * so happened to work).
 *
 * A static import in this server module evaluates at module load, strictly
 * before any route under `/vi` renders, which is the ordering guarantee the
 * client reference cannot give. It costs nothing on the wire: server imports
 * are not bundled for the browser. <ViCatalog /> still does the browser half.
 */
primeCatalog(translations);

export const metadata: Metadata = {
  openGraph: {
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export default function ViLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="vi">
      {/* Loads the full translation catalog for this subtree only — see
          ./vi-catalog.tsx. Renders nothing; the import is the point. */}
      <ViCatalog />
      {children}
    </div>
  );
}
