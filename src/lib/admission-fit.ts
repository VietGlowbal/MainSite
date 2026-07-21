// Admission-fit grouping (Reach / Recommended / Safe).
//
// The university search page groups results into three admission buckets so a
// student can see, at a glance, where they realistically stand:
//
//   • Reach        — selective relative to the applicant's current profile.
//                    Possible, but a stretch — the kind of place where GLOWBAL's
//                    coaching / mentorship can make the difference.
//   • Recommended  — well-matched to the applicant's likely grades and CV.
//   • Safe         — the applicant comfortably exceeds the typical bar; strong
//                    backup options.
//
// The classification combines two scores:
//
//   profileStrength  (0–100)  how strong the applicant looks on paper — driven
//                             by grades, CV quality and statement-of-purpose
//                             quality (plus English, experience, achievements).
//   selectivity      (0–100)  how hard a given university is to get into —
//                             derived from acceptance rate, QS rank and the
//                             free-text admission-difficulty note.
//
// The *margin* between them (strength − selectivity) decides the bucket, and
// also yields an illustrative admission probability for the UI.
//
// Everything here is pure and dependency-free so it can run on the server (when
// the page pre-computes each university's bucket) and the client alike.

import type { StudentProfile } from './types';

export type AdmissionCategory = 'reach' | 'recommended' | 'safe';

/** Display metadata for each bucket — shared by the tab bar and the banner. */
export const ADMISSION_CATEGORY_META: Record<
  AdmissionCategory,
  { label: string; tagline: string; description: string }
> = {
  reach: {
    label: 'Reach universities',
    tagline: 'Harder to get into',
    description:
      'Ambitious choices that sit above your current profile. They’re a stretch — but realistic with the right coaching, a stronger statement and mentorship support to close the gap.',
  },
  recommended: {
    label: 'Recommended universities',
    tagline: 'Best fit for your profile',
    description:
      'The best overall fit for your profile, balancing your likely grades, your CV and your admission chances. This is where we’d focus your applications first.',
  },
  safe: {
    label: 'Safe universities',
    tagline: 'Easier to get into',
    description:
      'Strong backup options. Based on your profile you should comfortably meet the bar at these universities if you apply.',
  },
};

/** Order the buckets render in (Reach → Recommended → Safe). */
export const ADMISSION_CATEGORY_ORDER: AdmissionCategory[] = [
  'reach',
  'recommended',
  'safe',
];

// ── Signals gathered server-side and fed into the strength calculation ──────

export interface ProfileStrengthSignals {
  /** A CV / résumé document has been uploaded. */
  hasCv: boolean;
  /** A statement of purpose / personal statement exists (uploaded or drafted). */
  hasStatement: boolean;
  /** Best AI statement score on record (0–100), if the SOP has been analysed. */
  statementScore: number | null;
  /** Highest English proficiency normalised to 0–1 (e.g. IELTS 7.5 → ~0.83). */
  englishLevel: number | null;
  /** Number of recorded work / internship experiences. */
  workExperienceCount: number;
}

export interface StrengthFactor {
  key: string;
  label: string;
  /** 0–1 score within this factor. */
  score: number;
  /** Contribution weight; weights sum to 1 across factors. */
  weight: number;
  detail: string;
}

export interface ProfileStrength {
  /** Overall applicant strength, 0–100. */
  score: number;
  factors: StrengthFactor[];
}

export interface AdmissionFit {
  category: AdmissionCategory;
  /** Illustrative admission probability 0–100 for this applicant at this uni. */
  probability: number;
  /** University selectivity 0–100 (100 = hardest to enter). */
  selectivity: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

// ── Academic-grade parsing ──────────────────────────────────────────────────
// Grades arrive as messy free text across several profile fields. We try a few
// common formats and return a normalised 0–1 strength, or null when nothing is
// recognisable (so callers can fall back to a neutral default).

const A_LEVEL_VALUE: Record<string, number> = {
  'A*': 1.0,
  A: 0.92,
  B: 0.78,
  C: 0.64,
  D: 0.5,
  E: 0.36,
};

function parseGradeText(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;

  // GPA, e.g. "3.8", "GPA 3.6/4.0", "3.9 / 4.3"
  const gpa = text.match(/(\d(?:\.\d{1,2}))\s*(?:\/\s*(\d(?:\.\d)?))?/);
  if (gpa) {
    const value = parseFloat(gpa[1] ?? "");
    const scale = gpa[2] ? parseFloat(gpa[2]) : value <= 4.0 ? 4.0 : value <= 4.3 ? 4.3 : null;
    if (scale && value <= scale) return clamp(value / scale, 0, 1);
  }

  // Percentage, e.g. "85%"
  const pct = text.match(/(\d{1,3})\s*%/);
  if (pct?.[1]) return clamp(parseInt(pct[1], 10) / 100, 0, 1);

  // IB diploma total, e.g. "IB 38", "predicted 42" (range 24–45)
  const ib = text.match(/\b(?:ib[^\d]*)?(2[4-9]|3\d|4[0-5])\b/i);
  if (ib && /ib|diploma|\/45|points/i.test(text)) {
    return clamp((parseInt(ib[1] ?? "24", 10) - 24) / (45 - 24), 0, 1);
  }

  // A-levels, e.g. "A*AA", "AAB", "A* A B". Only when the text looks like a
  // grade string (purely letters/stars) or explicitly mentions A-levels —
  // otherwise capitalised words in free text ("Bachelor of Arts") would be
  // misread as grades.
  const looksLikeGradeString = /^[A-E*\s]{2,10}$/i.test(text);
  const mentionsALevel = /a[\s-]?levels?|grades?\b/i.test(text);
  if (looksLikeGradeString || mentionsALevel) {
    const letters = text.toUpperCase().match(/A\*|[A-E](?![A-Z])/g);
    if (letters && letters.length >= 2 && letters.length <= 6) {
      const vals = letters.map((l) => A_LEVEL_VALUE[l]).filter((v) => v != null);
      if (vals.length >= 2) return clamp(vals.reduce((a, b) => a + b, 0) / vals.length, 0, 1);
    }
  }

  return null;
}

/** Best-effort academic strength (0–1) from the profile's grade-ish fields. */
export function parseAcademicStrength(profile: StudentProfile | null): number | null {
  if (!profile) return null;
  const candidates: string[] = [];
  if (profile.predicted_grades) candidates.push(profile.predicted_grades);
  if (profile.current_qualification) candidates.push(profile.current_qualification);
  if (profile.academic_background) candidates.push(profile.academic_background);
  if (profile.grades_summary) {
    for (const v of Object.values(profile.grades_summary)) {
      if (typeof v === 'string' || typeof v === 'number') candidates.push(String(v));
    }
  }
  let best: number | null = null;
  for (const c of candidates) {
    const parsed = parseGradeText(c);
    if (parsed != null) best = best == null ? parsed : Math.max(best, parsed);
  }
  return best;
}

// ── Profile strength ────────────────────────────────────────────────────────

const NEUTRAL_ACADEMIC = 0.6; // assumed when grades aren't parseable
const NEUTRAL_ENGLISH = 0.6;

/**
 * Blend the applicant's signals into a single 0–100 strength score with a
 * transparent factor breakdown (mirrors the match-score breakdown UX).
 */
export function computeProfileStrength(
  profile: StudentProfile | null,
  signals: ProfileStrengthSignals,
): ProfileStrength {
  // 1. Academic (grades) — the biggest lever.
  const academicRaw = parseAcademicStrength(profile);
  const academic = academicRaw ?? NEUTRAL_ACADEMIC;

  // 2. Statement of purpose quality.
  const statement = signals.statementScore != null
    ? clamp(signals.statementScore / 100, 0, 1)
    : signals.hasStatement
      ? 0.55 // uploaded but not yet analysed — neutral-positive
      : 0.4;

  // 3. Profile depth — English, experience, achievements, skills.
  const english = signals.englishLevel ?? NEUTRAL_ENGLISH;
  const experience = clamp(signals.workExperienceCount / 3, 0, 1);
  const achievements = clamp((profile?.achievements?.length ?? 0) / 3, 0, 1);
  const skills = clamp((profile?.skills?.length ?? 0) / 6, 0, 1);
  const depth = english * 0.4 + experience * 0.25 + achievements * 0.2 + skills * 0.15;

  // 4. CV present.
  const cv = signals.hasCv ? 1 : 0;

  const factors: StrengthFactor[] = [
    {
      key: 'academic',
      label: 'Academic grades',
      score: academic,
      weight: 0.45,
      detail: academicRaw != null
        ? 'Based on your recorded grades'
        : 'Add predicted grades to sharpen this',
    },
    {
      key: 'statement',
      label: 'Statement of purpose',
      score: statement,
      weight: 0.25,
      detail: signals.statementScore != null
        ? `AI statement score ${signals.statementScore}/100`
        : signals.hasStatement
          ? 'Uploaded — run an AI review to improve it'
          : 'Upload a statement to boost this',
    },
    {
      key: 'depth',
      label: 'Experience & profile',
      score: depth,
      weight: 0.18,
      detail: 'English, work experience, achievements & skills',
    },
    {
      key: 'cv',
      label: 'CV / résumé',
      score: cv,
      weight: 0.12,
      detail: signals.hasCv ? 'CV uploaded' : 'Upload a CV to boost this',
    },
  ];

  const score = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) * 100,
  );

  return { score: clamp(score, 0, 100), factors };
}

// ── University selectivity ──────────────────────────────────────────────────

function parsePercent(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.match(/(\d+(?:\.\d+)?)\s*%/);
  return m?.[1] ? parseFloat(m[1]) : null;
}

/** Map a QS rank to a 0–100 selectivity contribution (piecewise, smoothed). */
function selectivityFromRank(rank: number): number {
  if (rank <= 5) return 98;
  if (rank <= 10) return 95;
  if (rank <= 25) return 92;
  if (rank <= 50) return 88;
  if (rank <= 100) return 82;
  if (rank <= 200) return 74;
  if (rank <= 400) return 65;
  if (rank <= 700) return 56;
  if (rank <= 1000) return 48;
  return 40;
}

/** Read a sentiment from the free-text admission-difficulty / accept-rate note. */
function selectivityFromDifficultyText(text: string): number | null {
  const t = text.toLowerCase();
  if (/(extremely|highly|fiercely)\s+(competitive|selective)|world.?class|ultra/.test(t)) return 93;
  if (/very\s+(competitive|selective)|hard to get/.test(t)) return 85;
  if (/competitive|selective/.test(t)) return 74;
  if (/moderate|average/.test(t)) return 55;
  if (/(high|open)\s+(acceptance|admission)|easy|accessible|less\s+competitive/.test(t)) return 38;
  return null;
}

/**
 * Selectivity (0–100, higher = harder) blending the strongest available
 * signals: acceptance rate, QS rank, then the difficulty note. Defaults to a
 * mildly-selective 58 when nothing is known, so unknown schools don't all land
 * in "safe".
 */
export function computeUniversitySelectivity(uni: {
  accept_rate?: string | null;
  qs_rank?: number | null;
  admission_difficulty?: string | null;
}): number {
  const parts: Array<{ value: number; weight: number }> = [];

  const accept = parsePercent(uni.accept_rate);
  if (accept != null) parts.push({ value: clamp(100 - accept, 0, 100), weight: 0.5 });

  if (uni.qs_rank != null) parts.push({ value: selectivityFromRank(uni.qs_rank), weight: 0.35 });

  const fromText = uni.admission_difficulty
    ? selectivityFromDifficultyText(uni.admission_difficulty)
    : null;
  if (fromText != null) parts.push({ value: fromText, weight: 0.15 });

  if (parts.length === 0) return 58;

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const weighted = parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;
  return clamp(Math.round(weighted), 0, 100);
}

// ── Classification ──────────────────────────────────────────────────────────

/** Margin (strength − selectivity) thresholds separating the three buckets. */
const REACH_MARGIN = -12;
const SAFE_MARGIN = 12;

/**
 * Classify a single university for an applicant of the given strength.
 * `selectivity` may be passed pre-computed (the page does this) or derived.
 */
export function classifyAdmissionFit(
  profileStrength: number,
  uni: { accept_rate?: string | null; qs_rank?: number | null; admission_difficulty?: string | null },
  selectivityOverride?: number,
): AdmissionFit {
  const selectivity = selectivityOverride ?? computeUniversitySelectivity(uni);
  const margin = profileStrength - selectivity;

  const category: AdmissionCategory =
    margin <= REACH_MARGIN ? 'reach' : margin >= SAFE_MARGIN ? 'safe' : 'recommended';

  const probability = clamp(Math.round(50 + margin * 1.1), 4, 96);

  return { category, probability, selectivity };
}
