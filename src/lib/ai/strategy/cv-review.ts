import {
  CV_SECTION_KINDS,
  type ApplicationStrategyContext,
  type CvMissingSignal,
  type CvSectionKind,
  type CvStrength,
  type CvTargetProfile,
} from '@/features/application-strategy/domain';
import {
  asBoolean,
  asEnum,
  asObjectArray,
  asSources,
  asString,
  callStrategyModel,
  type AiCallResult,
} from './call';
import { renderContext, renderStructuredCv, withTrustRules } from './prompts';

/**
 * "Does this CV prove what the target profile says it must?"
 *
 * WHY THE REVIEW IS SCOPED TO THE TARGET PROFILE. A CV reviewed against nothing
 * produces the advice every CV tool produces: shorter bullets, more numbers,
 * stronger verbs. Reviewed against seven specific things this programme wants
 * evidenced, it produces "this course asks for independent research and your CV
 * shows coursework only". The target profile is the entire reason this is worth
 * running, so it is a required input rather than an optional one.
 *
 * WHY EVIDENCE MUST BE QUOTED. A strength the student cannot locate in their own
 * CV is unfalsifiable, and unfalsifiable praise is what makes AI feedback feel
 * hollow. Requiring a verbatim quote means every claim points at a line they can
 * read, and it makes a fabricated strength immediately visible.
 *
 * WHY `targetSection` IS CONSTRAINED. "Open relevant section" has to land
 * somewhere real. Coercing the model's answer to an actual `CvSectionKind` means
 * the button always resolves, and a model that invents "volunteering" gets mapped
 * to `activities` rather than producing a dead link.
 */

const SYSTEM_PROMPT = `You review a candidate's CV against a specific target profile for a specific programme. You are direct and specific. You do not flatter.

You produce exactly two lists.

THREE STRENGTHS. Exactly three, the three that matter most for THIS programme. Each one:
- "title": four to eight words naming the strength
- "evidence": a SHORT VERBATIM quote from the CV content, copied character for character. This is not optional and it is not a paraphrase. If you cannot quote the CV for a claim, it is not a strength you may list.
- "targetProfileArea": which part of the target profile this satisfies, named in the target profile's own words
- "programmeRelevance": one sentence on why this specific programme cares
- "strength": "strong" if the evidence is specific and verifiable, "moderate" if it is real but thin

MISSING SIGNALS. Between two and six. Things the target profile says the CV must prove that it currently does not, or proves weakly. Each one:
- "signal": what is missing or weak, stated plainly
- "reason": why it matters for this programme, one or two sentences
- "action": one concrete thing the candidate can do in their CV. Not "add more detail" — say what detail, in which entry.
- "targetSection": which CV section the fix belongs in. One of: ${CV_SECTION_KINDS.join(', ')}
- "critical": true only if a reader would consider the application incomplete without it. Be sparing; two at most, often zero.

Then:
- "summary": two or three sentences on where this CV stands against this target profile. No score. No percentage. No admission likelihood.
- "sourcesUsed": urls from the provided programme sources that back any programme claim you made. Empty array if none.

WHAT NOT TO DO:
- Do not comment on formatting, layout, fonts or length. A separate step handles presentation.
- Do not invent an achievement to praise, and do not invent a weakness to fill the list. Fewer, real findings beat six padded ones.
- Do not suggest the candidate add something they have not done. Suggest they EVIDENCE something they have.

Respond with JSON only:
{
  "strengths": [{ "title": "", "evidence": "", "targetProfileArea": "", "programmeRelevance": "", "strength": "strong" }],
  "missingSignals": [{ "signal": "", "reason": "", "action": "", "targetSection": "experience", "critical": false }],
  "summary": "",
  "sourcesUsed": []
}`;

export type CvReviewGeneration = {
  strengths: CvStrength[];
  missingSignals: CvMissingSignal[];
  summary: string;
  sourcesUsed: ReturnType<typeof asSources>;
};

export type CvReviewResult =
  | { ok: true; data: CvReviewGeneration; model: string; promptVersion: string }
  | { ok: false; reason: Extract<AiCallResult, { ok: false }>['reason'] };

/** Bumped when the prompt changes materially, so stored reviews stay attributable. */
export const CV_REVIEW_PROMPT_VERSION = 'cv-review-1';

export async function reviewCv(args: {
  context: ApplicationStrategyContext;
  targetProfile: CvTargetProfile;
}): Promise<CvReviewResult> {
  const { context, targetProfile } = args;

  const result = await callStrategyModel({
    system: withTrustRules(SYSTEM_PROMPT),
    user: `${renderContext(context, { includeCv: true })}

=== THE TARGET PROFILE THIS CV MUST SATISFY ===
Career direction: ${targetProfile.careerDirection ?? '(not established)'}
University positioning: ${targetProfile.universityPositioning ?? '(not established)'}
Education philosophy: ${targetProfile.educationPhilosophy ?? '(not established)'}
Environment: ${targetProfile.environment ?? '(not established)'}
Programme objectives: ${targetProfile.programmeObjectives ?? '(not established)'}
Priority capabilities: ${targetProfile.priorityCapabilities ?? '(not established)'}
Career alignment: ${targetProfile.careerAlignment ?? '(not established)'}

=== THE STRUCTURED CV CONTENT TO REVIEW ===
${renderStructuredCv(context)}

Review this CV against this target profile. Quote the CV verbatim for every strength. Respond with JSON only.`,
    maxTokens: 3500,
  });

  if (!result.ok) return { ok: false, reason: result.reason };

  return {
    ok: true,
    model: result.model,
    promptVersion: CV_REVIEW_PROMPT_VERSION,
    data: {
      strengths: normaliseStrengths(result.data.strengths),
      missingSignals: normaliseSignals(result.data.missingSignals),
      summary: asString(result.data.summary, 1200),
      sourcesUsed: asSources(result.data.sourcesUsed, 20),
    },
  };
}

/**
 * Three at most, and a strength with no quoted evidence is dropped.
 *
 * Dropping rather than keeping it with an empty evidence field: the UI renders
 * evidence as the justification, and a strength with none is exactly the
 * unfalsifiable praise the prompt is written to prevent. Two real strengths is a
 * better review than three where one is hollow.
 */
function normaliseStrengths(raw: unknown): CvStrength[] {
  return asObjectArray(raw, 6)
    .map((item) => ({
      title: asString(item.title, 160),
      evidence: asString(item.evidence, 600),
      targetProfileArea: asString(item.targetProfileArea, 200),
      programmeRelevance: asString(item.programmeRelevance, 400),
      strength: asEnum<'strong' | 'moderate'>(item.strength, ['strong', 'moderate'], 'moderate'),
    }))
    .filter((item) => item.title.length > 0 && item.evidence.length > 0)
    .slice(0, 3);
}

function normaliseSignals(raw: unknown): CvMissingSignal[] {
  return asObjectArray(raw, 10)
    .map((item) => ({
      signal: asString(item.signal, 300),
      reason: asString(item.reason, 600),
      action: asString(item.action, 600),
      targetSection: coerceSection(item.targetSection),
      critical: asBoolean(item.critical),
    }))
    .filter((item) => item.signal.length > 0 && item.action.length > 0)
    .slice(0, 6);
}

/**
 * Map whatever the model called the section onto a real one.
 *
 * The synonyms are the ones models actually return. Without them a plausible
 * answer like "volunteering" would fall through to `custom`, and "Open relevant
 * section" would send the student to a section that does not exist in their CV.
 */
const SECTION_SYNONYMS: Record<string, CvSectionKind> = {
  volunteering: 'activities',
  volunteer: 'activities',
  leadership: 'activities',
  extracurriculars: 'activities',
  work: 'experience',
  employment: 'experience',
  internships: 'experience',
  academics: 'education',
  qualifications: 'education',
  technical: 'skills',
  competencies: 'skills',
  honours: 'awards',
  honors: 'awards',
  prizes: 'awards',
  papers: 'publications',
  courses: 'certifications',
};

function coerceSection(value: unknown): CvSectionKind {
  const raw = asString(value, 60).toLowerCase().trim();
  if ((CV_SECTION_KINDS as readonly string[]).includes(raw)) return raw as CvSectionKind;
  return SECTION_SYNONYMS[raw] ?? 'experience';
}
