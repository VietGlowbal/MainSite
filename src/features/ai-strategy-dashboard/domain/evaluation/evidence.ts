import { confidenceFromCoverage, type Confidence } from './framework';

/**
 * F3 — Evidence Hierarchy Framework.
 *
 * Ranks what a student has actually got behind their claims. This is the
 * framework behind the Applicant Portrait's "Proof of Me" section.
 *
 * ─── NO AI HERE, ON PURPOSE ──────────────────────────────────────────────────
 *
 * Every input is something the student typed into the Achievements form or
 * attached a file to. Asking a model to rank facts the student already gave us
 * would add latency, cost and the possibility of a wrong answer to a problem
 * that is sorting. See framework.ts on the ai/derived split.
 *
 * ─── THE TWO AXES ────────────────────────────────────────────────────────────
 *
 * TIER — can anyone other than the student confirm this?
 *
 *   verified      a document is attached
 *   attributable  no document, but a named external body is on it (a
 *                 competition, an organisation), so an admissions officer
 *                 could in principle check it
 *   stated        the student's word and nothing else
 *
 * REACH — how far the thing carried: international → national → provincial →
 * district → school.
 *
 * They are separate because they fail differently. A school prize with a
 * certificate is *verified* but low reach. An international olympiad medal with
 * nothing attached is high reach but *stated*. Collapsing them into one number
 * would hide which of the two a student needs to fix, and "get the certificate"
 * and "aim higher next time" are very different pieces of advice.
 *
 * ─── ACTIVITIES CANNOT BE VERIFIED, AND THAT IS A SCHEMA FACT ────────────────
 *
 * `student_achievements` has an `evidence_key`; `student_activities` does not.
 * So an activity can never reach the `verified` tier no matter what the student
 * does. That is a real gap in the product, not a rule worth defending — it is
 * recorded in `ACTIVITY_EVIDENCE_UNSUPPORTED` and reported by the engine, so
 * the UI can say "activities cannot take an attachment yet" rather than
 * silently rating every activity as weak evidence and leaving the student
 * trying to fix something the form will not let them fix.
 */

export const ACTIVITY_EVIDENCE_UNSUPPORTED = true;

export type EvidenceTier = 'verified' | 'attributable' | 'stated';
export type EvidenceReach = 'international' | 'national' | 'provincial' | 'district' | 'school' | 'unknown';

export type EvidenceInput = {
  id: string;
  kind: 'achievement' | 'activity';
  title: string;
  category: string;
  /** Awarding or running body. */
  organisation: string | null;
  /** The competition or programme, achievements only. */
  competition: string | null;
  /** Free text — award levels do not generalise, so this is parsed, not enumerated. */
  level: string | null;
  /** Achievements carry a year; activities carry a free-text period. */
  when: string | null;
  /** True when an `evidence_key` is set. Always false for activities. */
  hasDocument: boolean;
};

export type EvidenceItem = EvidenceInput & {
  tier: EvidenceTier;
  reach: EvidenceReach;
  /** Sort key: higher is stronger. Tier dominates reach — see `rank`. */
  strength: number;
};

export type EvidenceProfile = {
  items: EvidenceItem[];
  counts: Record<EvidenceTier, number>;
  /** Items an admissions officer could check. The portrait leads with these. */
  strongest: EvidenceItem[];
  /**
   * Achievements resting on the student's word alone. These are the actionable
   * ones — a document would move each of them up a tier today.
   */
  needsProof: EvidenceItem[];
  confidence: Confidence;
};

const REACH_ORDER: Record<EvidenceReach, number> = {
  international: 5,
  national: 4,
  provincial: 3,
  district: 2,
  school: 1,
  unknown: 0,
};

const TIER_ORDER: Record<EvidenceTier, number> = {
  verified: 3,
  attributable: 2,
  stated: 1,
};

export const EVIDENCE_TIER_LABEL: Record<EvidenceTier, string> = {
  verified: 'Verified',
  attributable: 'Checkable',
  stated: 'Self-reported',
};

/**
 * Every label carries "level" — for consistency across the band, and because a
 * bare "School" is already a UI string meaning the institution a student
 * attends. These are English keys into the translation dictionary, so a
 * collision there is a mistranslation here.
 */
export const EVIDENCE_REACH_LABEL: Record<EvidenceReach, string> = {
  international: 'International level',
  national: 'National level',
  provincial: 'Provincial level',
  district: 'District level',
  school: 'School level',
  unknown: 'Unstated level',
};

/**
 * Read a free-text level into a reach band.
 *
 * BILINGUAL BY NECESSITY, not for completeness. `level` is free text typed by
 * a Vietnamese student, so "Quốc gia" is at least as likely as "National" and a
 * matcher that only knew English would drop most real entries to `unknown` —
 * which reads to the student as "we ignored your award".
 */
export function parseReach(level: string | null): EvidenceReach {
  if (!level) return 'unknown';
  const text = level
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

  if (/(international|quoc te|toan cau|global|world)/.test(text)) return 'international';
  if (/(national|quoc gia|toan quoc)/.test(text)) return 'national';
  if (/(provinc|tinh|thanh pho|city|regional|khu vuc)/.test(text)) return 'provincial';
  if (/(district|quan|huyen)/.test(text)) return 'district';
  if (/(school|truong|lop|class)/.test(text)) return 'school';
  return 'unknown';
}

/**
 * Which tier an item sits in.
 *
 * `attributable` requires a named body, not merely a non-empty string: an
 * organisation of "my school" is not something anyone can write to. Length is a
 * poor proxy for that, so the test is only that the field was filled — the
 * Vagueness Gate (F6) is where thin text gets challenged, and doing it in two
 * places would mean two answers.
 */
export function tierFor(input: EvidenceInput): EvidenceTier {
  if (input.hasDocument) return 'verified';
  if (input.organisation?.trim() || input.competition?.trim()) return 'attributable';
  return 'stated';
}

/**
 * Tier outranks reach: 100 per tier step against 1 per reach step, so no
 * amount of reach promotes an unevidenced claim above an evidenced one. That is
 * the hierarchy the framework is named for — a checkable school prize is worth
 * more to an application than an unverifiable claim of an international one.
 */
function rank(tier: EvidenceTier, reach: EvidenceReach): number {
  return TIER_ORDER[tier] * 100 + REACH_ORDER[reach];
}

export function buildEvidenceProfile(inputs: readonly EvidenceInput[]): EvidenceProfile {
  const items: EvidenceItem[] = inputs
    .map((input) => {
      const tier = tierFor(input);
      const reach = parseReach(input.level);
      return { ...input, tier, reach, strength: rank(tier, reach) };
    })
    .sort((a, b) => b.strength - a.strength || a.title.localeCompare(b.title));

  const counts: Record<EvidenceTier, number> = { verified: 0, attributable: 0, stated: 0 };
  for (const item of items) counts[item.tier] += 1;

  return {
    items,
    counts,
    strongest: items.filter((item) => item.tier !== 'stated').slice(0, 5),
    // Activities are excluded: they cannot take an attachment (see the header),
    // so listing them under "needs proof" would be an instruction the student
    // has no way to follow.
    needsProof: items.filter((item) => item.tier === 'stated' && item.kind === 'achievement'),
    confidence: confidenceFromCoverage(counts.verified + counts.attributable, items.length),
  };
}
