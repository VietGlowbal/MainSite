import { confidenceFromCoverage, type Confidence } from './framework';

/**
 * F6 — Vagueness Gate.
 *
 * Reads the student's own free text and says which of it is solid enough to
 * build an analysis on. Sits between Intake and Reflection in the pipeline, so
 * the frameworks downstream know which inputs they can lean on.
 *
 * ─── IT GRADES, IT DOES NOT BLOCK ────────────────────────────────────────────
 *
 * "Gate" is the spec's name and the pipeline position is real, but it does not
 * refuse to run. A student who writes three vague sentences and is told "come
 * back when you write better" has been given the one piece of advice they
 * cannot act on — the whole reason their answers are thin is that nobody has
 * shown them what a good one looks like. So the gate marks each field, the
 * engine lowers its confidence accordingly, and the report says plainly which
 * answers are holding it back. `verdict === 'insufficient'` is available for a
 * caller that genuinely must stop, and nothing in the report path uses it.
 *
 * ─── WHY HEURISTICS AND NOT A MODEL ──────────────────────────────────────────
 *
 * Asking a model "is this vague?" costs a call, varies between runs, and gives
 * an answer nobody can predict or test. Every signal below is a property of the
 * text that a person can check by looking — which means a student who disagrees
 * with the verdict can see exactly what triggered it. See framework.ts.
 *
 * ─── THE SIGNALS ─────────────────────────────────────────────────────────────
 *
 * Deliberately few, because each false positive tells a student their honest
 * answer is bad:
 *
 *   missing          nothing written
 *   too_short        below the length any real answer needs
 *   generic_opening  starts with the stock phrases that carry no information
 *   no_specifics     no number, no proper noun, no date — nothing a reader
 *                    could picture or check
 *
 * `no_specifics` never fires on its own for a long answer. Prose can be
 * specific without containing a digit, and flagging a considered paragraph as
 * empty is the failure mode that would make students distrust the whole report.
 */

export type VaguenessReason = 'missing' | 'too_short' | 'generic_opening' | 'no_specifics';

export type VaguenessSeverity = 'ok' | 'weak' | 'empty';

export type VaguenessFinding = {
  /** The intake field this refers to, e.g. `careerGoals`. */
  field: string;
  /** Human label for the report, e.g. "Career goals". */
  label: string;
  severity: VaguenessSeverity;
  reasons: VaguenessReason[];
};

export type VaguenessReport = {
  findings: VaguenessFinding[];
  /** Fields solid enough for the narrative frameworks to quote. */
  usableFields: string[];
  /** `insufficient` when nothing usable was written. Advisory — see the header. */
  verdict: 'sufficient' | 'thin' | 'insufficient';
  confidence: Confidence;
};

/** Below this, an answer cannot contain a reason as well as a claim. */
const MIN_USEFUL_LENGTH = 60;
/** Above this, prose is credited as specific even with no digits in it. */
const SUBSTANTIAL_LENGTH = 220;

/**
 * Openers that consume a sentence without saying anything. Matched only at the
 * START of the text: "I have always wanted to work in public health because of
 * the two summers I spent at…" is a real answer that happens to begin with a
 * stock phrase, so the opener alone is never enough to mark a field weak — it
 * has to coincide with another signal (see `severityFor`).
 */
const GENERIC_OPENINGS = [
  /^i(?:'m| am)? ?(?:always )?(?:been )?(?:very |really |so )?passionate about/i,
  /^i have always (?:wanted|dreamed|loved|been)/i,
  /^(?:ever )?since i was (?:a )?(?:young|little|a child|small)/i,
  /^from a young age/i,
  /^i(?:'ve| have) always been interested in/i,
  /^my dream (?:is|has always been)/i,
];

/** A number, a year, a capitalised name mid-sentence, or a percentage. */
function hasSpecifics(text: string): boolean {
  if (/\d/.test(text)) return true;
  // A capitalised word that is not the first word of a sentence — a place, an
  // organisation, a named programme.
  if (/[.!?]\s+[A-Z]|(?:^|\s)(?!I\b)[A-Z][a-z]{2,}/.test(text.slice(1))) return true;
  return false;
}

function reasonsFor(raw: string | null | undefined): VaguenessReason[] {
  const text = (raw ?? '').trim();
  if (text.length === 0) return ['missing'];

  const reasons: VaguenessReason[] = [];
  if (text.length < MIN_USEFUL_LENGTH) reasons.push('too_short');

  const genericOpening = GENERIC_OPENINGS.some((pattern) => pattern.test(text));
  if (genericOpening) reasons.push('generic_opening');

  /**
   * Long prose earns the benefit of the doubt on specifics — UNLESS it also
   * opened with a stock phrase. That pairing is the one reliable signature of
   * an answer that runs for a paragraph without ever landing on anything, and
   * treating length alone as evidence of substance let exactly that through.
   */
  const earnsLengthCredit = text.length >= SUBSTANTIAL_LENGTH && !genericOpening;
  if (!hasSpecifics(text) && !earnsLengthCredit) reasons.push('no_specifics');

  return reasons;
}

/**
 * `missing` is its own severity because it is not the student writing badly —
 * it is a question they have not reached. The report treats the two
 * differently: one is a prompt to continue, the other is a prompt to revise.
 */
function severityFor(reasons: readonly VaguenessReason[]): VaguenessSeverity {
  if (reasons.includes('missing')) return 'empty';
  // A stock opening on an otherwise substantial answer is a style note, not a
  // reason to call the answer weak. See GENERIC_OPENINGS.
  const substantive = reasons.filter((reason) => reason !== 'generic_opening');
  return substantive.length > 0 ? 'weak' : 'ok';
}

export const VAGUENESS_REASON_LABEL: Record<VaguenessReason, string> = {
  missing: 'Nothing written yet',
  too_short: 'Too short to show your reasoning',
  generic_opening: 'Opens with a stock phrase',
  no_specifics: 'No names, numbers or dates a reader could picture',
};

export type VaguenessField = {
  field: string;
  label: string;
  value: string | null | undefined;
};

export function runVaguenessGate(fields: readonly VaguenessField[]): VaguenessReport {
  const findings: VaguenessFinding[] = fields.map(({ field, label, value }) => {
    const reasons = reasonsFor(value);
    return { field, label, severity: severityFor(reasons), reasons };
  });

  const usableFields = findings.filter((f) => f.severity === 'ok').map((f) => f.field);

  const verdict: VaguenessReport['verdict'] =
    usableFields.length === 0 ? 'insufficient' : usableFields.length < fields.length / 2 ? 'thin' : 'sufficient';

  return {
    findings,
    usableFields,
    verdict,
    confidence: confidenceFromCoverage(usableFields.length, fields.length),
  };
}
