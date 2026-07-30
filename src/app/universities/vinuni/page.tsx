import { permanentRedirect } from 'next/navigation';
import { VINUNI_UNIVERSITY_ID } from '@/lib/vinuni-content';

/**
 * /universities/vinuni — superseded by /universities/[id].
 *
 * VinUniversity is row 97 of `universities`, so it is served by the shared
 * detail page (Figma 375:10629) like the other 96. Its extra content did not go
 * anywhere: the colleges, the FAQ and the AACC statement analyser render as
 * VinUni's extras on that page, sourced from the same src/lib/vinuni-content.ts
 * they always were. See src/app/universities/[id]/university-extras.tsx.
 *
 * A PERMANENT redirect because the old URL was public and indexable — the 308
 * moves any accumulated search ranking to the new one instead of stranding it.
 *
 * ⚠️ `vinuni-profile-client.tsx` is deliberately still on disk. It is the
 * current home of `SopAaccSection`, which the new page imports; the rest of it
 * is dead and goes when that section is lifted into its own module. Deleting
 * the file before then removes a live feature.
 */
export default function VinUniPage() {
  permanentRedirect(`/universities/${VINUNI_UNIVERSITY_ID}`);
}
