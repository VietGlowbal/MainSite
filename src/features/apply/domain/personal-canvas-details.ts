import type { NarrativeActivity } from '@/shared/evaluation';
import type {
  CoreIdentitySection,
  DrivingForceSection,
  EmergingThemesSection,
  PersonalPositioningSection,
  ProofCard,
  ProofOfMeSection,
  ReportConfidence,
} from './personal-report';
import type { EvidenceRef } from '@/shared/evaluation';

export type EvidenceBand = 'very_strong' | 'strong' | 'consistent' | 'emerging' | 'limited';

export type CapabilityRating = {
  name: string;
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  band: EvidenceBand;
  confidence: ReportConfidence;
  evidenceCount: number;
  strongEvidenceCount: number;
  verifiedEvidenceCount: number;
  why: string;
  supportingEvidence: Array<{
    activityId: string;
    title: string;
    outcome: string | null;
    evidenceStrength: ProofCard['evidenceStrength'];
    verificationStatus: ProofCard['verificationStatus'];
  }>;
};

export type MotivationSignal = {
  label: string;
  score: number;
  evidenceCount: number;
  confidence: ReportConfidence;
};

export type SocialProofMetric = {
  key:
    | 'activities'
    | 'strongEvidence'
    | 'verifiedEvidence'
    | 'outcomes'
    | 'quantifiedOutcomes'
    | 'capabilityClaims'
    | 'metadataCoverage';
  label: string;
  value: number;
  caption: string;
};

export type GrowthPriority = {
  id: string;
  title: string;
  gap: string;
  source: 'positioning' | 'identity' | 'theme';
  impact: 'high' | 'medium';
  effort: 'low' | 'medium' | 'high';
  suggestedDirection: string;
};

export type FuturePathway = {
  label: string;
  statusLabel: string;
  confidence: ReportConfidence;
  evidenceCount: number;
  supportingExperiences: string[];
  rationale: string;
  isStatedDirection: boolean;
};

export type PersonalCanvasDetails = {
  capabilities: CapabilityRating[];
  motivations: MotivationSignal[];
  socialProof: SocialProofMetric[];
  growthPriorities: GrowthPriority[];
  futurePathways: FuturePathway[];
};

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function confidenceFromCount(count: number): ReportConfidence {
  if (count >= 3) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

function evidenceBand(score: number): EvidenceBand {
  if (score >= 80) return 'very_strong';
  if (score >= 60) return 'strong';
  if (score >= 40) return 'consistent';
  if (score >= 20) return 'emerging';
  return 'limited';
}

function starRating(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

const STRENGTH_POINTS: Record<ProofCard['evidenceStrength'], number> = {
  strong: 20,
  moderate: 12,
  limited: 5,
};

const VERIFICATION_POINTS: Record<ProofCard['verificationStatus'], number> = {
  verified: 20,
  attributable: 12,
  stated: 5,
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Named capability scores are evidence-strength scores, not psychological or
 * admissions scores. They reward recurrence, evidence quality, verification
 * and recorded outcomes. A single activity is capped below the "strong"
 * range so one impressive anecdote cannot become a five-star capability.
 */
function buildCapabilities(
  proofOfMe: ProofOfMeSection,
  profileCapabilityClaims: readonly { label: string; evidenceRefs: EvidenceRef[] }[] = [],
): CapabilityRating[] {
  const byCapability = new Map<string, { label: string; cards: ProofCard[] }>();
  for (const card of proofOfMe.cards) {
    for (const competency of card.competenciesDemonstrated) {
      const key = normalise(competency);
      if (!key) continue;
      const current = byCapability.get(key) ?? { label: competency.trim(), cards: [] };
      if (!current.cards.some((existing) => existing.activityId === card.activityId)) current.cards.push(card);
      byCapability.set(key, current);
    }
  }

  const built = [...byCapability.values()]
    .map(({ label, cards }): CapabilityRating => {
      const count = cards.length;
      const recurrence = Math.min(40, count * 15);
      const strength = average(cards.map((card) => STRENGTH_POINTS[card.evidenceStrength]));
      const verification = average(cards.map((card) => VERIFICATION_POINTS[card.verificationStatus]));
      const outcome = Math.round((cards.filter((card) => Boolean(card.outcome?.trim())).length / Math.max(count, 1)) * 20);
      const raw = Math.round(recurrence + strength + verification + outcome);
      // Confidence floor: one activity cannot look like a fully proven recurring capability.
      const cap = count === 1 ? 59 : count === 2 ? 79 : 100;
      const score = Math.min(cap, raw);
      const strongEvidenceCount = cards.filter((card) => card.evidenceStrength === 'strong').length;
      const verifiedEvidenceCount = cards.filter((card) => card.verificationStatus === 'verified').length;

      return {
        name: label,
        score,
        stars: starRating(score),
        band: evidenceBand(score),
        confidence: confidenceFromCount(count),
        evidenceCount: count,
        strongEvidenceCount,
        verifiedEvidenceCount,
        why:
          count >= 3
            ? `Demonstrated across ${count} separate experiences, with ${strongEvidenceCount} strongly supported evidence item${strongEvidenceCount === 1 ? '' : 's'}.`
            : count === 2
              ? 'Demonstrated in two separate experiences; the pattern is becoming consistent but is not yet broad.'
              : 'Supported by one recorded experience, so this remains an emerging capability rather than a recurring pattern.',
        supportingEvidence: cards.slice(0, 4).map((card) => ({
          activityId: card.activityId,
          title: card.title,
          outcome: card.outcome,
          evidenceStrength: card.evidenceStrength,
          verificationStatus: card.verificationStatus,
        })),
      };
    })
    .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name))
    .slice(0, 6);

  const existing = new Set(built.map((capability) => normalise(capability.name)));
  const selfReported = profileCapabilityClaims
    .filter((claim) => claim.label.trim() && !existing.has(normalise(claim.label)))
    .map((claim): CapabilityRating => ({
      name: claim.label.trim(),
      score: 45,
      stars: 3,
      band: 'consistent',
      confidence: 'low',
      evidenceCount: 1,
      strongEvidenceCount: 0,
      verifiedEvidenceCount: 0,
      why: 'Self-reported in Q4; an activity or achievement must corroborate this before it is treated as a proven capability.',
      supportingEvidence: [
        {
          activityId: claim.evidenceRefs[0]?.id ?? 'profile:reflection_q4',
          title: 'Personal reflection — What You Are Proud Of',
          outcome: null,
          evidenceStrength: 'limited',
          verificationStatus: 'stated',
        },
      ],
    }));

  return [...built, ...selfReported].sort(
    (a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name),
  ).slice(0, 6);
}

function buildMotivations(
  activities: readonly NarrativeActivity[],
  repeatedProfileMotivations: readonly string[] = [],
): MotivationSignal[] {
  const grounded = [
    ...repeatedProfileMotivations.map((value) => ({ statedMotivation: value })),
    ...activities,
  ].filter((activity) => Boolean(activity.statedMotivation?.trim()));
  if (grounded.length === 0) return [];

  const grouped = new Map<string, { label: string; count: number }>();
  for (const activity of grounded) {
    const motivation = activity.statedMotivation?.trim();
    if (!motivation) continue;
    const key = normalise(motivation);
    const current = grouped.get(key) ?? { label: motivation, count: 0 };
    current.count += 1;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map(({ label, count }) => ({
      label,
      score: Math.round((count / grounded.length) * 100),
      evidenceCount: count,
      confidence: confidenceFromCount(count),
    }))
    .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount)
    .slice(0, 5);
}

function buildSocialProof(proofOfMe: ProofOfMeSection): SocialProofMetric[] {
  const cards = proofOfMe.available ? proofOfMe.cards : [];
  const strongEvidence = cards.filter((card) => card.evidenceStrength === 'strong').length;
  const verifiedEvidence = cards.filter(
    (card) => card.verificationStatus === 'verified' || card.verificationStatus === 'attributable',
  ).length;
  const outcomes = cards.filter((card) => Boolean(card.outcome?.trim())).length;
  const quantifiedOutcomes = cards.filter((card) => /\d/.test(card.outcome ?? '')).length;
  const capabilityClaims = new Set(cards.flatMap((card) => card.competenciesDemonstrated.map(normalise))).size;
  const metadataCoverage = cards.filter(
    (card) =>
      Boolean(
        card.organisation ||
          card.level ||
          card.year ||
          card.period ||
          card.competition ||
          card.evidenceKey ||
          card.sources?.length,
      ),
  ).length;

  return [
    { key: 'activities', label: 'Experiences analysed', value: cards.length, caption: 'Activities contributing evidence to this report' },
    { key: 'strongEvidence', label: 'Strong evidence items', value: strongEvidence, caption: 'Experiences with evidence, outcomes and demonstrated capability' },
    { key: 'verifiedEvidence', label: 'Checkable evidence', value: verifiedEvidence, caption: 'Verified or attributable evidence sources' },
    { key: 'outcomes', label: 'Recorded outcomes', value: outcomes, caption: 'Experiences with a stated result or change' },
    { key: 'quantifiedOutcomes', label: 'Quantified outcomes', value: quantifiedOutcomes, caption: 'Outcomes containing a measurable result' },
    { key: 'capabilityClaims', label: 'Capabilities evidenced', value: capabilityClaims, caption: 'Distinct grounded capability labels across experiences' },
    { key: 'metadataCoverage', label: 'Evidence metadata captured', value: metadataCoverage, caption: 'Experiences retaining organisation, level, period, competition or verification provenance' },
  ];
}

function effortForGap(gap: string): GrowthPriority['effort'] {
  const value = gap.toLowerCase();
  if (/attach|evidence|detail|stated intended direction|clarif/.test(value)) return 'low';
  if (/more activities|other themes|multiple activities|broader|narrow scope/.test(value)) return 'high';
  return 'medium';
}

function directionForGap(gap: string): string {
  const value = gap.toLowerCase();
  if (/evidence|linked|support|document/.test(value)) {
    return 'Add stronger supporting evidence, specific outcomes, or verification to the experiences already on your profile.';
  }
  if (/intended direction|direction/.test(value)) {
    return 'Clarify the direction you want to pursue and connect it explicitly to the experiences that already support it.';
  }
  if (/theme|activities|narrow scope|broader/.test(value)) {
    return 'Add or deepen experiences that show this pattern in another context, rather than relying on a single activity.';
  }
  return 'Strengthen this area with another specific, reflected example that shows your role, action and outcome.';
}

function titleForGap(source: GrowthPriority['source'], index: number): string {
  if (source === 'positioning') return index === 0 ? 'Stronger positioning' : 'Profile coherence';
  if (source === 'identity') return 'Identity evidence';
  return 'Theme depth';
}

function buildGrowthPriorities(args: {
  coreIdentity: CoreIdentitySection;
  emergingThemes: EmergingThemesSection;
  personalPositioning: PersonalPositioningSection;
}): GrowthPriority[] {
  const raw: Array<{ gap: string; source: GrowthPriority['source']; impact: GrowthPriority['impact'] }> = [
    ...args.personalPositioning.whatPreventsStrongerPositioning.map((gap) => ({ gap, source: 'positioning' as const, impact: 'high' as const })),
    ...args.coreIdentity.stillDeveloping.map((gap) => ({ gap, source: 'identity' as const, impact: 'high' as const })),
    ...(args.emergingThemes.available
      ? args.emergingThemes.themes
          .filter((theme) => theme.status !== 'established_theme')
          .map((theme) => ({ gap: theme.limitation, source: 'theme' as const, impact: 'medium' as const }))
      : []),
  ];

  const seen = new Set<string>();
  return raw
    .filter(({ gap }) => {
      const key = normalise(gap);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map(({ gap, source, impact }, index) => ({
      id: `${source}-${index}`,
      title: titleForGap(source, index),
      gap,
      source,
      impact,
      effort: effortForGap(gap),
      suggestedDirection: directionForGap(gap),
    }));
}

function buildFuturePathways(args: {
  emergingThemes: EmergingThemesSection;
  intendedDirection: string | null;
}): FuturePathway[] {
  const pathways: FuturePathway[] = [];
  const stated = args.intendedDirection?.trim();
  if (stated) {
    pathways.push({
      label: stated,
      statusLabel: 'Stated direction',
      confidence: 'high',
      evidenceCount: 0,
      supportingExperiences: [],
      rationale: 'This is the direction you explicitly stated, shown separately from AI-inferred emerging themes.',
      isStatedDirection: true,
    });
  }

  if (args.emergingThemes.available) {
    for (const theme of args.emergingThemes.themes) {
      if (stated && normalise(stated) === normalise(theme.theme)) continue;
      pathways.push({
        label: theme.theme,
        statusLabel: theme.statusLabel,
        confidence: theme.confidence,
        evidenceCount: theme.supportingExperiences.length,
        supportingExperiences: theme.supportingExperiences.slice(0, 4),
        rationale: theme.explanation,
        isStatedDirection: false,
      });
    }
  }

  return pathways.slice(0, 5);
}

export function buildPersonalCanvasDetails(args: {
  activities: readonly NarrativeActivity[];
  coreIdentity: CoreIdentitySection;
  drivingForce: DrivingForceSection;
  emergingThemes: EmergingThemesSection;
  personalPositioning: PersonalPositioningSection;
  proofOfMe: ProofOfMeSection;
  intendedDirection: string | null;
  profileCapabilityClaims?: readonly { label: string; evidenceRefs: EvidenceRef[] }[];
}): PersonalCanvasDetails {
  return {
    capabilities: buildCapabilities(args.proofOfMe, args.profileCapabilityClaims),
    motivations: buildMotivations(args.activities, args.drivingForce.repeatedMotivations),
    socialProof: buildSocialProof(args.proofOfMe),
    growthPriorities: buildGrowthPriorities(args),
    futurePathways: buildFuturePathways(args),
  };
}
