import type {
  ApplicationStrategyContext,
  TargetProfileGeneration,
} from '@/features/application-strategy/domain';
import {
  asNullableString,
  asSources,
  asString,
  asStringArray,
  callStrategyModel,
  type AiCallResult,
} from './call';
import { renderContext, withTrustRules } from './prompts';

/**
 * "What does this CV need to prove?" — the first AI operation in the workflow.
 *
 * WHY THIS COMES BEFORE THE CV ITSELF. A CV reviewed against nothing produces
 * generic advice: shorter bullets, more numbers. Reviewed against a specific
 * programme's stated priorities, it produces "this course asks for evidence of
 * independent research and your CV does not show any". The target profile is what
 * makes the later review specific, which is why it is step one rather than an
 * optional extra.
 *
 * WHY EMPTY FIELDS ARE A SUCCESS CASE. Four of the seven fields describe the
 * university, and they are answerable only from programme material. When we have
 * not parsed the course page, the honest output is four empty fields and a
 * `missingInformation` entry saying so. The prompt is written to make that the
 * expected behaviour rather than an edge case, because the alternative — a
 * confident paragraph about a university's educational philosophy, invented — is
 * the single most damaging thing this feature could produce. The student would
 * quote it back in an interview.
 */

const SYSTEM_PROMPT = `You are a university admissions strategist helping a student work out what their CV must demonstrate for one specific programme.

You are filling in seven fields. Each has a defined source of truth:

FROM THE UNIVERSITY'S OWN MATERIAL (leave empty if the material is not provided):
- universityPositioning: how this university positions itself. Its actual standing and character, not marketing adjectives.
- educationPhilosophy: how it teaches and what it values in a student.
- environment: the learning environment a student would enter.
- programmeObjectives: what this specific programme commits to producing in its graduates.

FROM THE CANDIDATE'S OWN INFORMATION (leave empty if not provided):
- careerDirection: where this student says they want to get to.

FROM BOTH, AND ONLY WHERE BOTH EXIST:
- priorityCapabilities: the capabilities this student's CV most needs to evidence for THIS programme. This is the field the later CV review is scored against, so it must be specific and checkable — name capabilities, not virtues.
- careerAlignment: the genuine overlap between the student's stated direction and what this programme offers. If there is no evidence of overlap, say so plainly rather than manufacturing one.

HOW TO WRITE EACH FIELD:
- Two to four sentences. These are read as cards, not as essays.
- Concrete. "Strong analytical foundation, evidenced through quantitative coursework" is useful; "excellence and passion" is not.
- No university marketing language, even if the source material is full of it.
- Vietnamese, matching the student's interface language, EXCEPT careerAlignment which is written in English.

ALSO RETURN:
- missingInformation: a list of the specific things you could not establish and what would resolve each one. Write these as actions the student can take, e.g. "We have not read this course's entry requirements — add the course page URL to this application." One entry per genuinely missing input. Empty list if nothing is missing.
- sourcesUsed: for every claim you made about the university or programme, the url it came from. Each entry: { "field": "<which field>", "url": "<url>", "heading": "<section heading or null>", "snippet": "<short verbatim excerpt or null>" }. Only urls that appear in the provided source list. Empty list if you made no programme claims.

Respond with JSON only:
{
  "careerDirection": "",
  "universityPositioning": "",
  "educationPhilosophy": "",
  "environment": "",
  "programmeObjectives": "",
  "priorityCapabilities": "",
  "careerAlignment": "",
  "missingInformation": [],
  "sourcesUsed": []
}`;

export type TargetProfileResult =
  | { ok: true; data: TargetProfileGeneration; model: string }
  | { ok: false; reason: Extract<AiCallResult, { ok: false }>['reason'] };

export async function generateTargetProfile(
  context: ApplicationStrategyContext,
): Promise<TargetProfileResult> {
  const result = await callStrategyModel({
    system: withTrustRules(SYSTEM_PROMPT),
    // The CV is included because `priorityCapabilities` is about the gap between
    // what the programme wants and what this student can currently evidence.
    // Without the CV that field becomes a restatement of the course page.
    user: `${renderContext(context, { includeCv: true })}

Fill in the seven fields for this student and this programme. Leave any field empty that the material above does not support. Respond with JSON only.`,
    maxTokens: 2500,
  });

  if (!result.ok) return { ok: false, reason: result.reason };

  const raw = result.data;

  return {
    ok: true,
    model: result.model,
    data: {
      careerDirection: asString(raw.careerDirection, 1200),
      universityPositioning: asString(raw.universityPositioning, 1200),
      educationPhilosophy: asString(raw.educationPhilosophy, 1200),
      environment: asString(raw.environment, 1200),
      programmeObjectives: asString(raw.programmeObjectives, 1200),
      priorityCapabilities: asString(raw.priorityCapabilities, 1200),
      careerAlignment: asString(raw.careerAlignment, 1200),
      missingInformation: asStringArray(raw.missingInformation, 12, 400),
      sourcesUsed: asSources(raw.sourcesUsed, 20),
    },
  };
}

/**
 * Gaps we can identify without asking a model.
 *
 * Called before generating so the page can warn the student that generation will
 * mostly return empty fields, and merged into `missingInformation` afterwards so
 * the record is complete even when the model does not mention them. Deterministic
 * checks are better than prompt instructions for facts we already know.
 */
export function deterministicGaps(context: ApplicationStrategyContext): string[] {
  const gaps: string[] = [];

  if (!context.application.requirements && !context.application.courseSummary) {
    gaps.push(
      'We have not read this programme’s own page yet, so the four university fields cannot be filled in. Add the course URL to this application.',
    );
  }
  if (context.application.sources.length === 0) {
    gaps.push('No official programme sources are attached, so programme claims cannot be cited.');
  }
  if (!context.candidate.academics) {
    gaps.push('Your academic background is empty in your Glowbal profile.');
  }
  if (!context.candidate.goals) {
    gaps.push('You have not recorded a career goal, which is what “Định hướng nghề nghiệp” is built from.');
  }
  if (
    context.candidate.achievements.length === 0 &&
    context.candidate.activities.length === 0
  ) {
    gaps.push('You have no achievements or activities recorded, so priority capabilities will be broad.');
  }
  if (!context.documents.cvText && !context.documents.structuredCv) {
    gaps.push('No CV content yet, so we cannot say which capabilities you already evidence.');
  }

  return gaps;
}

/** Merge, dedupe, and keep the list short enough to read. */
export function mergeMissingInformation(
  fromModel: readonly string[],
  fromChecks: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...fromChecks, ...fromModel]) {
    const key = item.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out.slice(0, 10);
}

/** Nullifies empty strings so a blank field is `null` in the database, not `''`. */
export function toTargetProfilePatch(data: TargetProfileGeneration) {
  return {
    careerDirection: asNullableString(data.careerDirection, 1200),
    universityPositioning: asNullableString(data.universityPositioning, 1200),
    educationPhilosophy: asNullableString(data.educationPhilosophy, 1200),
    environment: asNullableString(data.environment, 1200),
    programmeObjectives: asNullableString(data.programmeObjectives, 1200),
    priorityCapabilities: asNullableString(data.priorityCapabilities, 1200),
    careerAlignment: asNullableString(data.careerAlignment, 1200),
  };
}
