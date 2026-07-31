import type {
  ApplicationStrategyContext,
  CvSuggestionAction,
  CvTargetProfile,
} from '@/features/application-strategy/domain';
import { asString, callStrategyModel, type AiCallResult } from './call';
import { renderContext, withTrustRules } from './prompts';

/**
 * Rewrite one CV line, five ways.
 *
 * WHY ONE LINE AT A TIME. Rewriting a whole entry means the student is reviewing
 * four changes at once and will accept all of them to be done with it. One line,
 * one suggestion, one decision — which is also what makes the accept/dismiss/edit
 * contract meaningful rather than a formality.
 *
 * WHY "ADD CONFIRMED EVIDENCE" IS THE DELICATE ONE. It is the only action that
 * introduces facts, and the facts must come from the student's own profile rather
 * than from plausibility. A model asked to "add evidence" will happily invent "a
 * 40% improvement" because that is what strong CV bullets look like. The prompt for
 * that action therefore restricts it to the achievements and activities in the
 * context and requires it to return the line unchanged if there is nothing to draw
 * on.
 */


const INSTRUCTIONS: Record<CvSuggestionAction, string> = {
  clearer: `Rewrite the line so a reader understands what the candidate actually did, on first read. Remove vagueness and hedging ("helped with", "was involved in", "various"). Name the actual action. Do not add any information that is not already in the line.`,

  concise: `Shorten the line without losing any fact it contains. Cut filler, redundant qualifiers and throat-clearing. If the line is already tight, return it unchanged.`,

  impact: `Rewrite the line so the outcome is visible, using ONLY outcomes the line or the candidate's profile already states. If no outcome is recorded anywhere in the material, do NOT invent one — instead return the line unchanged and explain in "note" that an outcome would strengthen it and that the candidate needs to supply the number.`,

  evidence: `Add a specific piece of evidence to the line, drawn STRICTLY from the candidate's recorded achievements and activities in the material above. Quote figures exactly as recorded. If the material contains no evidence relevant to this line, return the line unchanged and say so in "note". Never invent a metric, a scale, a rank or a result.`,

  tailor: `Rewrite the line so its relevance to this specific programme is apparent, using the programme's stated priorities. Keep every fact the line contains. Do not claim the candidate did anything they did not do, and do not assert anything about the programme that the material does not state.`,
};

const SYSTEM_PROMPT = `You improve a single line of a candidate's CV, on request, one line at a time.

You will be given the line, the candidate's material, the programme, and one instruction. Apply only that instruction.

HARD RULES FOR THIS TASK:
- Never introduce a fact, number, metric, date, scale, rank or result that is not already present in the material you were given.
- Preserve every fact the original line contains. Rewriting is not editing out.
- One line in, one line out. No bullet lists, no multiple options, no commentary inside the line.
- Keep the candidate's own language and register. This is their CV, not yours.
- If the instruction cannot be honestly carried out, return the line UNCHANGED and explain why in "note". Returning the original is a valid, useful answer.

Respond with JSON only:
{ "suggested": "<the rewritten line, or the original unchanged>", "note": "<short explanation, or empty string>" }`;

export type CvSuggestionResult =
  | { ok: true; original: string; suggested: string; note: string; model: string }
  | { ok: false; reason: Extract<AiCallResult, { ok: false }>['reason'] };

export async function suggestCvLine(args: {
  context: ApplicationStrategyContext;
  targetProfile: CvTargetProfile | null;
  action: CvSuggestionAction;
  /** The bullet being rewritten. */
  line: string;
  /** The entry it sits in, so the model knows what the line is about. */
  entryContext: { role?: string | null; organization?: string | null; section: string };
}): Promise<CvSuggestionResult> {
  const { context, targetProfile, action, line, entryContext } = args;

  const strategyBlock = targetProfile?.priorityCapabilities
    ? `\nWHAT THIS CV MUST PROVE (from the candidate's target profile):\n${targetProfile.priorityCapabilities}`
    : '';

  const result = await callStrategyModel({
    system: withTrustRules(SYSTEM_PROMPT),
    user: `${renderContext(context, { includeCv: false })}
${strategyBlock}

THE ENTRY THIS LINE BELONGS TO:
Section: ${entryContext.section}
Role: ${entryContext.role ?? '(none)'}
Organisation: ${entryContext.organization ?? '(none)'}

THE LINE TO REWRITE:
"${line}"

INSTRUCTION:
${INSTRUCTIONS[action]}

Respond with JSON only.`,
    temperature: 0.3,
    maxTokens: 800,
  });

  if (!result.ok) return { ok: false, reason: result.reason };

  const suggested = asString(result.data.suggested, 2000);

  return {
    ok: true,
    original: line,
    // An empty response falls back to the original rather than blanking the
    // student's line — the UI shows "no change suggested" instead of an empty
    // suggestion card offering to delete their text.
    suggested: suggested.length > 0 ? suggested : line,
    note: asString(result.data.note, 400),
    model: result.model,
  };
}
