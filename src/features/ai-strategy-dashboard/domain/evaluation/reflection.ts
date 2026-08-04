import type { EvidenceProfile } from './evidence';
import type { FrameworkId } from './framework';

/**
 * F1 — CMCAITF Reflection Framework, and F4 — Narrative Identity & Personal
 * Branding.
 *
 * The two frameworks that need a language model, and the section architecture
 * the Applicant Portrait page renders from.
 *
 * ─── THE SIX SECTIONS COME FROM THE DESIGN, THE CONTENT FROM THREE PLACES ────
 *
 * The portrait mockup has six tabs. They are not six AI outputs:
 *
 *   Core identity        F1  narrative
 *   Driving force        F1  narrative
 *   Emerging themes      F1  narrative   ← new field, see below
 *   Signature pattern    F4  narrative
 *   Personal positioning F4  narrative
 *   Proof of me          F3  derived from the student's own achievements
 *
 * "Proof of me" is the one that matters most and costs nothing: it is the
 * evidence hierarchy, built by counting and sorting what the student entered.
 * The mockup labels it "POOR OF ME", which is a typo for PROOF — reading it any
 * other way produces a section no framework in the spec describes.
 *
 * ─── EMERGING THEMES IS A NEW FIELD ──────────────────────────────────────────
 *
 * Five of the six map onto columns that already existed on `applicant_analyses`.
 * `emergingThemes` did not exist in any form — nothing generated it and nothing
 * stored it. It is added as a real column and a real prompt field rather than
 * faked from `growthAreas`, which is a different thing entirely: growth areas
 * are what is missing, themes are the patterns that recur across what is
 * already there. Labelling one as the other would put a wrong claim under a
 * heading the student was told to trust.
 *
 * ─── WHERE growthAreas WENT ──────────────────────────────────────────────────
 *
 * The design has no tab for it, and it is too useful to drop — it is the honest
 * counterweight to five sections of strengths. It renders inside Core Identity
 * under its own heading rather than as a seventh tab, so the tab bar matches
 * the design and no data is lost.
 */

export type NarrativeProfile = {
  /** Two or three sentences on who this applicant is. */
  coreIdentity: string | null;
  /**
   * Kept as two lists rather than one bag of traits, because they are two
   * different claims and the columns behind them are separate: how someone
   * prefers to learn is not the same as what they are good at, and merging them
   * would make "Works well in groups" and "Strong at calculus" indistinguishable
   * in the one place a student looks to check we understood them.
   */
  learningStyle: string[];
  academicStrengths: string[];
  /** What actually drives them. */
  drivingForce: string | null;
  /** F4: the thing only this applicant can claim. */
  signaturePattern: string[];
  /** F1: patterns recurring across their record. NEW — see the header. */
  emergingThemes: string[];
  /** F4: how they should present themselves. */
  personalPositioning: string | null;
  /** Honest counterweight. Rendered inside Core Identity. */
  growthAreas: string[];
  /** 0-100 self-presentation strength. Never an admission probability. */
  overallRating: number | null;
};

export const EMPTY_NARRATIVE: NarrativeProfile = {
  coreIdentity: null,
  learningStyle: [],
  academicStrengths: [],
  drivingForce: null,
  signaturePattern: [],
  emergingThemes: [],
  personalPositioning: null,
  growthAreas: [],
  overallRating: null,
};

export type PortraitSectionKey =
  | 'core-identity'
  | 'driving-force'
  | 'signature-pattern'
  | 'emerging-themes'
  | 'personal-positioning'
  | 'proof-of-me';

export type PortraitSectionMeta = {
  key: PortraitSectionKey;
  framework: FrameworkId;
  /** Tab label, as drawn. */
  label: string;
  /** One line under the section heading. */
  blurb: string;
};

/** Tab order, left to right, as drawn in the mockup. */
export const PORTRAIT_SECTIONS: readonly PortraitSectionMeta[] = [
  {
    key: 'core-identity',
    framework: 'F1',
    label: 'Core identity',
    blurb: 'Who you are on paper, before any one course is considered.',
  },
  {
    key: 'driving-force',
    framework: 'F1',
    label: 'Driving force',
    blurb: 'What is actually pushing you towards this subject.',
  },
  {
    key: 'signature-pattern',
    framework: 'F4',
    label: 'Signature pattern',
    blurb: 'The combination only you can claim — your USP.',
  },
  {
    key: 'emerging-themes',
    framework: 'F1',
    label: 'Emerging themes',
    blurb: 'Patterns that keep recurring across what you have done.',
  },
  {
    key: 'personal-positioning',
    framework: 'F4',
    label: 'Personal positioning',
    blurb: 'How to present all of this to an admissions reader.',
  },
  {
    key: 'proof-of-me',
    framework: 'F3',
    label: 'Proof of me',
    blurb: 'What you can actually evidence, strongest first.',
  },
];

/**
 * Whether a section has anything to say yet.
 *
 * Sections are hidden rather than shown empty. An "Emerging themes" tab that
 * opens onto nothing tells the student the report is broken; one that is absent
 * until there is something to put in it tells them there is more to do. The
 * page states how many sections are waiting on more input, so nothing
 * disappears silently.
 */
export function sectionHasContent(
  key: PortraitSectionKey,
  narrative: NarrativeProfile,
  evidence: EvidenceProfile,
): boolean {
  switch (key) {
    case 'core-identity':
      return (
        Boolean(narrative.coreIdentity) ||
        narrative.academicStrengths.length > 0 ||
        narrative.learningStyle.length > 0
      );
    case 'driving-force':
      return Boolean(narrative.drivingForce);
    case 'signature-pattern':
      return narrative.signaturePattern.length > 0;
    case 'emerging-themes':
      return narrative.emergingThemes.length > 0;
    case 'personal-positioning':
      return Boolean(narrative.personalPositioning);
    case 'proof-of-me':
      return evidence.items.length > 0;
  }
}

export function availablePortraitSections(
  narrative: NarrativeProfile,
  evidence: EvidenceProfile,
): PortraitSectionMeta[] {
  return PORTRAIT_SECTIONS.filter((section) =>
    sectionHasContent(section.key, narrative, evidence),
  );
}
