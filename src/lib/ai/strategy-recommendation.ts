// ============================================================================
// F7 — Strategic Recommendation Framework ("Personalized Strategy")
// ----------------------------------------------------------------------------
// One structured-JSON OpenAI call that synthesises the Personal Report
// (NarrativeProfile, F1/F4) and the Matching Report (ProgrammeFit, F5) into a
// strategy: which direction to commit to, how to narrate it, how to
// reposition, what to build next, how to differentiate, and a roadmap. See
// `features/ai-strategy-dashboard/domain/strategy-recommendation.ts` for why
// this is a real model call (not a derived reshape) and why it validates with
// zod rather than manual normalisation.
//
// Written in English — unlike `match-insights.ts` and `applicant-analysis.ts`,
// which write Vietnamese user-facing copy, F7's report content is English by
// product decision.
// ============================================================================

import {
  strategyRecommendationSchema,
  type StrategyRecommendation,
} from '@/features/ai-strategy-dashboard/domain';
import type { PersonalReportV2, ProgrammeFit } from '@/features/apply/domain';
import { strategyReportV2Schema, type StrategyReportV2 } from '@/features/ai-strategy-dashboard/domain';
import type { MatchingReportV3 } from './matching/domain';
import { openAiJsonCompletion, defaultOpenAIModel } from './openai-client';

export const STRATEGY_RECOMMENDATION_PROMPT_VERSION = 'strategy-recommendation-f8-v2';
/** Five-section F8 payload (`report_v2`) — see strategyReportV2Schema. */
export const STRATEGY_REPORT_V2_PROMPT_VERSION = 'strategy-report-f8-v3';

export type StrategyProgrammeInput = {
  universityName: string;
  courseName: string;
  subject?: string | null;
  degreeLevel?: string | null;
  careerOutcomes?: string | null;
};

export type StrategyAchievementInput = {
  category: string;
  title: string;
  detail?: string | null;
};

export type StrategyActivityInput = {
  category: string;
  title: string;
  description?: string | null;
};

export type StrategyRecommendationInputs = {
  personalReport: PersonalReportV2;
  fit: ProgrammeFit;
  matchingReportV3?: MatchingReportV3 | null;
  programme: StrategyProgrammeInput;
  achievements: StrategyAchievementInput[];
  activities: StrategyActivityInput[];
  apiKey: string;
  model?: string;
};

function buildSystemPrompt(): string {
  return `You are a senior university admissions strategist writing a Strategic Recommendation Report for one applicant applying to one specific programme. You have their structured Personal Report (who they are: Core Identity, Driving Force, Signature Pattern, Emerging Themes, Personal Positioning, Proof of Me, Evidence Confidence) and their Matching Report (V3 University Fit and Programme Fit when present, otherwise the legacy Programme Fit shape). Your job is to synthesise these canonical facts into a high-impact strategy: what direction to commit to, how to position the profile, how to evaluate their activity portfolio, how to differentiate, and an actionable roadmap before submission.

Never calculate, estimate, or imply an admission probability, acceptance rate, or numerical chance of admission. Focus entirely on strategic positioning, fit alignment, and portfolio strengthening.

Respond with VALID JSON ONLY (no markdown, no commentary) matching exactly:
{
  "directionOptions": [
    { "name": "<a specific, ownable strategic direction, e.g. 'Business Analytics for Education'>", "identityFit": <0-10>, "evidenceStrength": <0-10>, "consistency": <0-10>, "differentiation": <0-10>, "futureAlignment": <0-10>, "scalability": <0-10>, "overall": <0-10> },
    ...2-6 candidate directions
  ],
  "chosenDirection": "<must exactly match one \\"name\\" above — the one with the strongest case>",
  "chosenDirectionWhy": "<why this direction wins over the others, referencing the six scores>",
  "narrative": "<the applicant's story told through the lens of the chosen direction — how their existing experiences build toward it>",
  "positioningBefore": "<how the applicant would currently present themselves, unfocused>",
  "positioningAfter": "<how they should present themselves once committed to the chosen direction>",
  "positioningRationale": "<why the \\"after\\" positioning is stronger for this specific programme>",
  "portfolioEvaluations": [
    { "name": "<name of a real activity/achievement OR a proposed new opportunity>", "source": "existing_activity | ai_proposed", "strategicContribution": "<how it strengthens (or doesn't) the chosen direction>", "recommendation": "highly_recommended | recommended | low_priority" },
    ...at least 2, mixing BOTH sources: every real activity/achievement provided must be evaluated (source: "existing_activity"), and at least one NEW opportunity you propose (source: "ai_proposed")
  ],
  "differentiationInsight": "<what makes this applicant's profile common vs. what other applicants for this direction typically have>",
  "differentiationProposal": "<one concrete thing that would make them stand out from that common pool>",
  "roadmap": {
    "chosenStrategy": "<one-sentence restatement of the committed direction>",
    "why": "<the single strongest reason to commit to it>",
    "prioritize": ["<concrete action to take before submitting>", ...1-8],
    "avoid": ["<thing that would dilute the positioning>", ...1-8],
    "expectedPositioning": "<how an admissions reader would describe this applicant after the roadmap is followed>",
    "longTermNarrative": "<the through-line from where they are now to where the roadmap leads>"
  }
}

FIELD NOTES (F7.1-F7.6, one JSON section per module):
- F7.1 Strategic Direction Selection ("directionOptions"/"chosenDirection"/"chosenDirectionWhy"): propose 2-6 REAL candidate directions grounded in the applicant's actual signature pattern and emerging themes — not generic majors. Score each on six 0-10 dimensions: identityFit, evidenceStrength, consistency, differentiation, futureAlignment, scalability. "overall" is your holistic score, not a plain average. Pick the strongest as "chosenDirection".
- F7.2 Narrative Strategy ("narrative"): retell their existing experiences as a coherent story that arrives at the chosen direction. Do not invent experiences — resequence and reframe only what evidence supports.
- F7.3 Positioning Strategy ("positioningBefore"/"positioningAfter"/"positioningRationale"): contrast an unfocused self-presentation against a focused one built around the chosen direction.
- F7.4 Portfolio Strategy ("portfolioEvaluations"): evaluate the applicant's PORTFOLIO of activities against the chosen direction — both what they already have (source "existing_activity", one entry per real achievement/activity given to you) and what they are missing (source "ai_proposed", opportunities you propose). Rate each highly_recommended / recommended / low_priority.
- F7.5 Differentiation Strategy ("differentiationInsight"/"differentiationProposal"): name the crowded pattern this applicant currently resembles, then propose one differentiator that breaks from it while staying consistent with the chosen direction.
- F7.6 Execution Roadmap ("roadmap"): the actionable summary — what to prioritize before submitting, what to avoid doing, expected positioning, and long-term narrative arc.

RULES:
- Base everything ONLY on the Personal Report, Matching Report, programme facts and activities/achievements provided. Do not invent facts about the applicant — you MAY propose plausible new opportunities for F7.4's "ai_proposed" entries.
- If a V3 Matching Report is supplied, treat University Fit, Programme Fit, hard requirements, strengths, gaps, positioning opportunities, Key Takeaways, scholarship alignment and evidence provenance as canonical. Do not recompute or translate V3 into an F5 score; the F5 shape is compatibility fallback only.
- Every real achievement/activity provided to you must appear as an "existing_activity" entry in "portfolioEvaluations" — do not omit any.
- Write every field in English.
- All six-dimension scores in "directionOptions" are 0-10, one decimal place is fine.
- Keep every direction's "name" short and ownable, never a generic subject name alone.
- Never use admission probability or chance percentage language.`;
}

function buildUserPrompt(
  personalReport: PersonalReportV2,
  fit: ProgrammeFit,
  programme: StrategyProgrammeInput,
  achievements: StrategyAchievementInput[],
  activities: StrategyActivityInput[],
  matchingReportV3?: MatchingReportV3 | null,
): string {
  const parts: string[] = [];

  parts.push(`TARGET PROGRAMME: ${programme.courseName} at ${programme.universityName}`);
  if (programme.degreeLevel) parts.push(`Level: ${programme.degreeLevel}`);
  if (programme.subject) parts.push(`Subject: ${programme.subject}`);
  if (programme.careerOutcomes) parts.push(`Career outcomes: ${programme.careerOutcomes}`);

  parts.push('\nCANONICAL PERSONAL REPORT (Structured identity & evidence findings):');

  // Core Identity
  const ci = personalReport.coreIdentity;
  parts.push('Core Identity:');
  if (ci.available) {
    if (ci.headline) parts.push(`- Headline: ${ci.headline}`);
    if (ci.interpretation) parts.push(`- Interpretation: ${ci.interpretation}`);
    if (ci.recurringRole) parts.push(`- Recurring Role: ${ci.recurringRole}`);
    if (ci.recurringBehaviours.length > 0) parts.push(`- Recurring Behaviours: ${ci.recurringBehaviours.join(', ')}`);
    if (ci.valueOrientation) parts.push(`- Value Orientation: ${ci.valueOrientation}`);
    if (ci.observations.length > 0) parts.push(`- Observations / Academic Strengths: ${ci.observations.join('; ')}`);
    if (ci.stillDeveloping.length > 0) parts.push(`- Developing / Growth Areas: ${ci.stillDeveloping.join('; ')}`);
  } else {
    parts.push(`- (insufficient data: ${ci.insufficientData?.reason ?? 'more evidence needed'})`);
  }

  // Driving Force
  const df = personalReport.drivingForce;
  parts.push('Driving Force:');
  if (df.available) {
    if (df.headline) parts.push(`- Headline: ${df.headline}`);
    if (df.explanation) parts.push(`- Explanation: ${df.explanation}`);
    if (df.repeatedMotivations.length > 0) parts.push(`- Repeated Motivations: ${df.repeatedMotivations.join(', ')}`);
    parts.push(`- Nature: ${df.isHypothesis ? 'Emerging hypothesis' : 'Confirmed motivation'}`);
    if (df.missingPersonalGrounding) parts.push(`- Personal Grounding: ${df.missingPersonalGrounding}`);
  } else {
    parts.push(`- (insufficient data: ${df.insufficientData?.reason ?? 'more evidence needed'})`);
  }

  // Signature Pattern
  const sp = personalReport.signaturePattern;
  parts.push('Signature Pattern:');
  if (sp.available) {
    parts.push(`- Pattern Strength: ${sp.patternStrength}`);
    if (sp.distinctiveness) parts.push(`- Distinctiveness: ${sp.distinctiveness}`);
    if (sp.steps.length > 0) {
      parts.push(`- Steps: ${sp.steps.map((s) => `${s.label}: ${s.description}`).join(' -> ')}`);
    }
  } else {
    parts.push(`- (insufficient data: ${sp.insufficientData?.reason ?? 'more evidence needed'})`);
  }

  // Emerging Themes
  const et = personalReport.emergingThemes;
  parts.push('Emerging Themes:');
  if (et.available && et.themes.length > 0) {
    for (const t of et.themes) {
      parts.push(
        `- ${t.theme} (${t.statusLabel}, supporting experiences: ${t.supportingExperiences.join(', ') || 'none'}) — ${t.explanation}`,
      );
    }
  } else {
    parts.push(`- (insufficient data: ${et.insufficientData?.reason ?? 'no themes established yet'})`);
  }

  // Personal Positioning
  const pp = personalReport.personalPositioning;
  parts.push('Personal Positioning:');
  if (pp.available) {
    if (pp.statement) parts.push(`- Statement: ${pp.statement}`);
    if (pp.whyThisFits.length > 0) parts.push(`- Why This Fits: ${pp.whyThisFits.join('; ')}`);
    if (pp.whatPreventsStrongerPositioning.length > 0) {
      parts.push(`- Limitations / Growth Areas: ${pp.whatPreventsStrongerPositioning.join('; ')}`);
    }
  } else {
    parts.push(`- (insufficient data: ${pp.insufficientData?.reason ?? 'more evidence needed'})`);
  }

  // Proof of Me key proofs
  const pom = personalReport.proofOfMe;
  if (pom.available && pom.cards.length > 0) {
    parts.push('Grounded Proof of Me (Key Evidence Cards):');
    for (const card of pom.cards.slice(0, 8)) {
      parts.push(
        `- ${card.title} [${card.verificationStatus}, ${card.evidenceStrength} strength]${card.role ? ` (Role: ${card.role})` : ''}${card.outcome ? ` (Outcome: ${card.outcome})` : ''}`,
      );
    }
  }

  parts.push(`Overall Evidence Confidence: ${personalReport.overallEvidenceConfidence}`);

  if (matchingReportV3) {
    parts.push('\nCANONICAL MATCHING REPORT V3 (the current matching source):');
    parts.push(JSON.stringify({
      overall: matchingReportV3.overall,
      universityFit: matchingReportV3.universityFit,
      programmeFit: matchingReportV3.programmeFit,
      hardRequirements: matchingReportV3.hardRequirements,
      scholarshipAlignment: matchingReportV3.scholarshipAlignment,
      strengths: matchingReportV3.strengths,
      gaps: matchingReportV3.gaps,
      positioningOpportunities: matchingReportV3.positioningOpportunities,
      keyTakeaways: matchingReportV3.keyTakeaways,
      evidenceIndex: matchingReportV3.evidenceIndex,
      targetSourceIndex: matchingReportV3.targetSourceIndex,
    }));
  } else {
    parts.push('\nCANONICAL MATCHING REPORT (Programme Fit F5 fallback):');
    parts.push(`Classification: ${fit.classification}`);
    parts.push(`Match Confidence: ${fit.confidence}%`);
    parts.push('Eligibility Status:');
    parts.push(`- Required Subjects: ${fit.eligibility.requiredSubjects}`);
    parts.push(`- Minimum Qualification: ${fit.eligibility.minimumQualification}`);
    parts.push(`- Language Requirement: ${fit.eligibility.languageRequirement}`);
    parts.push(`- Citizenship Requirement: ${fit.eligibility.citizenshipRequirement}`);
    parts.push(`- Deadline: ${fit.eligibility.deadline}`);

    parts.push('Dimensions:');
    for (const [key, dim] of Object.entries(fit.dimensions)) {
      parts.push(
        `- ${key}: ${dim.status}${dim.score !== null ? ` (${dim.score}/5)` : ''} — ${dim.summary}`,
      );
      if (dim.strengths.length > 0) parts.push(`  Strengths: ${dim.strengths.join('; ')}`);
      if (dim.gaps.length > 0) parts.push(`  Gaps: ${dim.gaps.join('; ')}`);
      if (dim.evidence.length > 0) parts.push(`  Evidence: ${dim.evidence.join('; ')}`);
      if (dim.limitation) parts.push(`  Limitation: ${dim.limitation}`);
    }

    if (fit.limitations.length > 0) {
      parts.push(`Fit Limitations: ${fit.limitations.join('; ')}`);
    }
  }

  parts.push('\nREAL ACHIEVEMENTS (must each appear as an "existing_activity" portfolio entry):');
  if (achievements.length > 0) {
    for (const a of achievements) {
      parts.push(`- [${a.category}] ${a.title}${a.detail ? `: ${a.detail.slice(0, 300)}` : ''}`);
    }
  } else {
    parts.push('(none recorded)');
  }

  parts.push('\nREAL ACTIVITIES (must each appear as an "existing_activity" portfolio entry):');
  if (activities.length > 0) {
    for (const a of activities) {
      parts.push(`- [${a.category}] ${a.title}${a.description ? `: ${a.description.slice(0, 300)}` : ''}`);
    }
  } else {
    parts.push('(none recorded)');
  }

  parts.push('\nWrite the Strategic Recommendation Report now. Respond with JSON only.');
  return parts.join('\n');
}

/**
 * Run the F7 call. Throws on a hard failure (no key, network, unparseable or
 * schema-invalid response) so the caller can surface an error — same
 * contract as `analyzeCourseMatchInsights`.
 */
export async function generateStrategyRecommendation(
  args: StrategyRecommendationInputs,
): Promise<StrategyRecommendation> {
  const {
    personalReport,
    fit,
    matchingReportV3,
    programme,
    achievements,
    activities,
    apiKey,
    model = defaultOpenAIModel(),
  } = args;

  const content = await openAiJsonCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(personalReport, fit, programme, achievements, activities, matchingReportV3) },
    ],
    temperature: 0.4,
    maxTokens: 3500,
  });

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as unknown;

  const result = strategyRecommendationSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid strategy recommendation output: ${result.error.issues[0]?.message ?? 'unknown'}`);
  }
  return result.data;
}

// ─── F8 five-section Strategy Report (report_v2) ────────────────────────────

function buildSystemPromptV2(): string {
  return `You are a senior university admissions strategist writing the five-section Strategy Report for one applicant applying to one specific programme. You have their structured Personal Report (Core Identity, Driving Force, Signature Pattern, Emerging Themes, Personal Positioning, Proof of Me, Evidence Confidence) and their Matching Report (V3 University Fit and Programme Fit when present, otherwise the legacy Programme Fit shape). Synthesise these canonical facts into an actionable strategy.

ABSOLUTE RULES:
- Never calculate, estimate, or imply an admission probability, acceptance rate, or numerical chance of admission. You are shaping strategy and positioning, never predicting outcomes.
- Never invent achievements, evidence, or facts about the applicant. Every claim must trace to the provided report content; where evidence is thin, say what is missing instead of filling the gap.
- Do not restate or recompute any fit score or classification.
- Every "key"/"phaseKey" field MUST be a short deterministic slug (lowercase letters/digits/hyphens/underscores) naming the IDEA (e.g. "quant_portfolio_depth", "ielts_7_target") — student edits and Planner tasks key on it, so it must describe meaning, not position in a list.
- Write every field in English.
- If a V3 Matching Report is supplied, use its University Fit, Programme Fit, hard requirements, strengths, gaps, positioning opportunities, Key Takeaways, scholarship alignment and evidence provenance as canonical. Do not recompute or translate it into an F5 score; use the F5 shape only as fallback.

Respond with VALID JSON ONLY matching exactly:
{
  "strategicOverview": {
    "currentPosition": { "profile": "...", "keyStrength": "...", "biggestChallenge": "..." },
    "strategicGoal": { "primaryObjective": "...", "positioning": "..." },
    "topPriorities": ["...", "...", "..."],
    "expectedOutcome": "..."
  },
  "priorityTable": [
    { "key": "<slug>", "title": "...", "currentSituation": "...", "whyItMatters": "...", "recommendedActions": ["...", "..."], "expectedImpact": "...", "level": "critical | high | medium" }
  ],
  "profileDevelopmentStrategy": {
    "academic": { "currentStatus": "...", "gap": "...", "strategicFocus": "...", "expectedOutcome": "..." },
    "experience": { "currentStatus": "...", "gap": "...", "strategicFocus": "...", "expectedOutcome": "..." },
    "differentiation": { "currentAdvantage": "...", "uniqueness": "...", "amplifyHow": "...", "desiredPerception": "..." }
  },
  "narrativeStrategy": {
    "coreNarrative": { "centralStory": "...", "supportingEvidence": ["..."], "admissionsValue": "..." },
    "themes": [ { "key": "<slug>", "title": "...", "rationale": "...", "evidence": ["..."] } ],
    "consistencyCheck": { "supports": "...", "feelsDisconnected": "...", "emphasise": "...", "supportingRole": "..." }
  },
  "executionRoadmap": {
    "phases": [
      { "phaseKey": "<slug>", "name": "...", "objective": "...", "keyActions": ["..."], "deliverables": [ { "key": "<slug>", "label": "...", "tool": "personal_canvas | cv_builder | statement_writer | (omit)" } ], "successCriteria": ["..."], "timeline": "..." }
    ]
  }
}

SHAPE NOTES:
- priorityTable: 2-6 rows covering the applicant's decisive strategic moves for THIS programme.
- narrativeStrategy.themes: 3-5 themes ONLY when evidence supports them; fewer honest themes beat padded ones.
- executionRoadmap.phases: use these canonical phases IN ORDER when they fit: strengthen_foundation ("Strengthen Foundation"), build_competitive_advantages ("Build Competitive Advantages"), craft_application ("Craft Application"), finalise_optimise ("Finalise & Optimise").
- deliverables.tool: set ONLY to a tool that genuinely fits the deliverable (Personal Canvas, CV Builder, Statement Writer); omit for everything else.`;
}

/**
 * Run the F8 v3 call producing the five-section Strategy Report
 * (`StrategyReportV2`). Same throw-on-failure contract as
 * `generateStrategyRecommendation`; the caller persists lineage + input hash.
 */
export async function generateStrategyReportV2(
  args: StrategyRecommendationInputs,
): Promise<StrategyReportV2> {
  const {
    personalReport,
    fit,
    matchingReportV3,
    programme,
    achievements,
    activities,
    apiKey,
    model = defaultOpenAIModel(),
  } = args;

  const content = await openAiJsonCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: buildSystemPromptV2() },
      // Same canonical input rendering as the legacy prompt — one source of
      // truth for how the structured reports reach the model.
      { role: 'user', content: buildUserPrompt(personalReport, fit, programme, achievements, activities, matchingReportV3) },
    ],
    temperature: 0.4,
    maxTokens: 4500,
  });

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as unknown;

  const result = strategyReportV2Schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid strategy report v2 output: ${result.error.issues[0]?.message ?? 'unknown'}`);
  }
  return result.data;
}

