import { confidenceFromCoverage, type Confidence } from './types';

/**
 * F6 — Specificity / Vagueness Gate.
 *
 * Runs first in the pipeline (Intake → F6 → F1 → F2 → F3 → F4 → F5). Reads a
 * student's own free text and says which of it is specific enough for the
 * narrative frameworks (F1, F4) to build on. Everything downstream that reads
 * prose depends on this having run — see engine.ts.
 *
 * ─── IT GRADES, IT DOES NOT BLOCK ────────────────────────────────────────────
 *
 * "Gate" is the framework's name; it does not refuse to run. A student who
 * writes three vague sentences and is told "come back when you write better"
 * has been given the one piece of advice they cannot act on. So this grades
 * each field, the engine lowers confidence accordingly, and — where the
 * product supports it — a targeted clarification question is generated
 * instead of a fabricated answer. `verdict === 'insufficient'` is available
 * for a caller that genuinely must stop; nothing in this engine's own path
 * treats it as a hard stop.
 *
 * ─── WHY HEURISTICS, NOT A MODEL ─────────────────────────────────────────────
 *
 * Asking a model "is this vague?" costs a call, varies between runs, and
 * produces an answer nobody can predict or test. Every signal here is a
 * property of the text a person can verify by reading it — core principle 8:
 * deterministic logic stays deterministic.
 *
 * ─── THE SIGNALS ─────────────────────────────────────────────────────────────
 *
 *   missing                nothing written
 *   too_short               below the length any real answer needs
 *   generic_opening         starts with a stock phrase that carries no information
 *   no_concrete_actors      no named person/organisation a reader could check
 *   no_concrete_actions     no verb describing something the student actually did
 *   no_concrete_outcomes    no result, number, or change described
 *
 * `no_concrete_actors` / `no_concrete_actions` / `no_concrete_outcomes` never
 * fire together on a long, substantial answer purely for lacking digits —
 * prose can be specific without a number in it, and flagging a considered
 * paragraph as empty is the failure mode that would make students distrust
 * the whole report.
 */

export type VaguenessReason =
  | 'missing'
  | 'too_short'
  | 'generic_opening'
  | 'no_concrete_actors'
  | 'no_concrete_actions'
  | 'no_concrete_outcomes';

export type VaguenessSeverity = 'ok' | 'weak' | 'empty';

export type VaguenessFinding = {
  /** The intake field this refers to, e.g. `careerGoals`. */
  field: string;
  /** Human label for the report, e.g. "Career goals". */
  label: string;
  severity: VaguenessSeverity;
  reasons: VaguenessReason[];
  /**
   * A question that would get the student to be specific, generated only
   * where the field is weak or empty. Never an invented answer — see the
   * module header. `null` when the field is already usable.
   */
  clarificationPrompt: string | null;
};

export type VaguenessReport = {
  findings: VaguenessFinding[];
  /** Fields solid enough for F1/F4 to build a narrative from. */
  usableFields: string[];
  /** `insufficient` when nothing usable was written. Advisory — see the header. */
  verdict: 'sufficient' | 'thin' | 'insufficient';
  confidence: Confidence;
};

export type VaguenessField = {
  field: string;
  label: string;
  value: string | null | undefined;
};

/** Below this, an answer cannot contain a reason as well as a claim. */
const MIN_USEFUL_LENGTH = 60;
/** Above this, prose is credited as specific even with no digits in it. */
const SUBSTANTIAL_LENGTH = 220;

/**
 * Openers that consume a sentence without saying anything. Matched only at
 * the START of the text — a real answer can legitimately begin this way and
 * go on to say something, so the opener alone never determines severity on
 * its own (see `severityFor`).
 */
const GENERIC_OPENINGS = [
  /^i(?:'m| am)? ?(?:always )?(?:been )?(?:very |really |so )?passionate about/i,
  /^i have always (?:wanted|dreamed|loved|been)/i,
  /^(?:ever )?since i was (?:a )?(?:young|little|a child|small)/i,
  /^from a young age/i,
  /^i(?:'ve| have) always been interested in/i,
  /^my dream (?:is|has always been)/i,
];

/** A number, a year, a capitalised proper noun mid-sentence, or a percentage — a concrete actor or outcome a reader could check. */
function hasConcreteMarkers(text: string): boolean {
  if (/\d/.test(text)) return true;
  if (/[.!?]\s+[A-Z]|(?:^|\s)(?!I\b)[A-Z][a-z]{2,}/.test(text.slice(1))) return true;
  return false;
}

/** A past-tense or first-person action verb — evidence the student describes doing something, not just feeling something. */
const ACTION_VERB_PATTERN =
  /\b(built|led|ran|organi[sz]ed|created|founded|coordinated|designed|developed|launched|managed|taught|mentored|wrote|published|competed|volunteered|raised|analy[sz]ed|researched|presented|won|solved|fixed|improved|reduced|increased)\b/i;

function reasonsFor(raw: string | null | undefined): VaguenessReason[] {
  const text = (raw ?? '').trim();
  if (text.length === 0) return ['missing'];

  const reasons: VaguenessReason[] = [];
  if (text.length < MIN_USEFUL_LENGTH) reasons.push('too_short');

  const genericOpening = GENERIC_OPENINGS.some((pattern) => pattern.test(text));
  if (genericOpening) reasons.push('generic_opening');

  const earnsLengthCredit = text.length >= SUBSTANTIAL_LENGTH && !genericOpening;
  const concrete = hasConcreteMarkers(text);

  /*
   * All three "no concrete X" signals are gated by the SAME check: text with
   * a number, a proper noun or enough substantial length already carries
   * concrete detail, and none of the three should fire independently of that
   * — a text that names "Bach Mai Hospital" and "2024" is not vague just
   * because it happens not to use one of a fixed list of action verbs.
   */
  if (!concrete && !earnsLengthCredit) {
    reasons.push('no_concrete_actors');
    reasons.push('no_concrete_outcomes');
    if (!ACTION_VERB_PATTERN.test(text)) reasons.push('no_concrete_actions');
  }

  return reasons;
}

function severityFor(reasons: readonly VaguenessReason[]): VaguenessSeverity {
  if (reasons.includes('missing')) return 'empty';
  // A stock opening on an otherwise substantial answer is a style note, not a
  // reason to call the answer weak.
  const substantive = reasons.filter((reason) => reason !== 'generic_opening');
  return substantive.length > 0 ? 'weak' : 'ok';
}

export const VAGUENESS_REASON_LABEL: Record<VaguenessReason, string> = {
  missing: 'Nothing written yet',
  too_short: 'Too short to show your reasoning',
  generic_opening: 'Opens with a stock phrase',
  no_concrete_actors: 'No people or organisations a reader could check',
  no_concrete_actions: 'No description of something you actually did',
  no_concrete_outcomes: 'No result, number or change described',
};

/**
 * A targeted follow-up question, generated from WHICH reasons fired — never a
 * fabricated answer on the student's behalf. `null` when the field is usable
 * and needs no follow-up.
 */
function clarificationFor(label: string, reasons: readonly VaguenessReason[]): string | null {
  if (reasons.length === 0) return null;
  if (reasons.includes('missing')) {
    return `You haven't answered "${label}" yet — what would you say if a friend asked you this directly?`;
  }
  if (reasons.includes('too_short')) {
    return `Can you say more about "${label}"? A sentence or two on what happened and why it mattered would help.`;
  }
  if (reasons.includes('no_concrete_actions') && reasons.includes('no_concrete_outcomes')) {
    return `For "${label}", what did you actually do, and what changed as a result?`;
  }
  if (reasons.includes('no_concrete_actions')) {
    return `For "${label}", what specific action did you take — not just what you felt or believed?`;
  }
  if (reasons.includes('no_concrete_outcomes')) {
    return `For "${label}", what was the result? A number, a change, or something a reader could verify.`;
  }
  return null;
}

export function runVaguenessGate(fields: readonly VaguenessField[]): VaguenessReport {
  const findings: VaguenessFinding[] = fields.map(({ field, label, value }) => {
    const reasons = reasonsFor(value);
    const severity = severityFor(reasons);
    return {
      field,
      label,
      severity,
      reasons,
      clarificationPrompt: severity === 'ok' ? null : clarificationFor(label, reasons),
    };
  });

  const usableFields = findings.filter((finding) => finding.severity === 'ok').map((finding) => finding.field);

  const verdict: VaguenessReport['verdict'] =
    usableFields.length === 0
      ? 'insufficient'
      : usableFields.length < fields.length / 2
        ? 'thin'
        : 'sufficient';

  return {
    findings,
    usableFields,
    verdict,
    confidence: confidenceFromCoverage(usableFields.length, fields.length),
  };
}
