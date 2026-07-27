/**
 * Official university websites.
 *
 * ⚠️ A hand-maintained lookup, not data. The `universities` table has no website
 * column, so anything that wants to link a student at the real institution has
 * to resolve the name here first. Coverage is therefore partial by definition —
 * callers MUST handle `null` with something that still works, never with a
 * broken or guessed link.
 *
 * Lifted verbatim from src/app/universities/detail-view.tsx so the saved list
 * and the detail view share one copy. If this grows past a page, it wants to be
 * a `website` column on the table instead.
 */
const UNIVERSITY_WEBSITES: Record<string, string> = {
  'Massachusetts Institute of Technology': 'https://mit.edu',
  'Harvard University': 'https://harvard.edu',
  'Stanford University': 'https://stanford.edu',
  'University of Oxford': 'https://ox.ac.uk',
  'University of Cambridge': 'https://cam.ac.uk',
  'Imperial College London': 'https://imperial.ac.uk',
  'University College London': 'https://ucl.ac.uk',
  'University of Toronto': 'https://utoronto.ca',
  'University of Melbourne': 'https://unimelb.edu.au',
  'National University of Singapore': 'https://nus.edu.sg',
  'ETH Zurich': 'https://ethz.ch',
  'University of Bologna': 'https://unibo.it',
  'Sapienza University of Rome': 'https://uniroma1.it',
  'Politecnico di Milano': 'https://polimi.it',
  'Bocconi University': 'https://unibocconi.it',
};

/**
 * The official site for a university name, or null when it is not in the table.
 *
 * Tries the exact name, then the name with a trailing parenthetical stripped, so
 * "Massachusetts Institute of Technology (MIT)" resolves.
 */
export function officialWebsite(name: string): string | null {
  return (
    UNIVERSITY_WEBSITES[name] ??
    UNIVERSITY_WEBSITES[name.replace(/\s*\([^)]*\)\s*$/, '').trim()] ??
    null
  );
}
