import { z } from 'zod';
import type { ReflectionAnswerKey, ReflectionAnswerSignal, ReflectionFinding } from '@/shared/evaluation';
import { defaultOpenAIModel, openAiJsonCompletion } from '../openai-client';
import { getReportPrompt } from '../runtime/prompt-registry';

const shortText = z.string().trim().min(1).max(180);
const textList = z.array(shortText).max(12);
const nullableText = shortText.nullable();

const responseSchema = z.object({
  signals: z.array(z.object({
    key: z.enum(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']),
    summary: shortText.max(180).nullable().optional(),
    q1: z.object({
      interests: textList,
      intellectualCuriosity: textList,
      problemInterests: textList,
      themeCandidates: textList,
    }).nullable().optional(),
    q2: z.object({
      turningPoint: nullableText,
      values: textList,
      mindsetShift: nullableText,
      personalGrowth: nullableText,
    }).nullable().optional(),
    q3: z.object({
      problemCaredAbout: nullableText,
      affectedGroups: textList,
      socialConcern: nullableText,
      personalConnection: nullableText,
      ownershipSignal: nullableText,
    }).nullable().optional(),
    q4: z.object({
      builtImprovedSolved: nullableText,
      actions: textList,
      agencySignals: textList,
      capabilitySignals: textList,
      impactSignals: textList,
    }).nullable().optional(),
    q5: z.object({
      intendedMajor: nullableText,
      academicMotivation: nullableText,
      majorRationale: nullableText,
      intellectualDirection: nullableText,
    }).nullable().optional(),
    q6: z.object({
      futureProblem: nullableText,
      desiredChange: nullableText,
      futureAmbition: nullableText,
      desiredImpact: nullableText,
    }).nullable().optional(),
    q7: z.object({
      learningPreferences: textList,
      collaborationPreferences: textList,
      researchProjectPreferences: textList,
      mentorshipPreferences: textList,
      extracurricularPreferences: textList,
      preferredOpportunities: textList,
    }).nullable().optional(),
  })).max(7),
});

function normalizedTokens(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

/** Reject a near-verbatim answer before it can enter any report-facing field. */
export function isNearVerbatimReflectionSummary(summary: string, raw: string): boolean {
  const cleanSummary = summary.trim().toLocaleLowerCase();
  const cleanRaw = raw.trim().toLocaleLowerCase();
  if (cleanSummary.length >= 24 && cleanRaw.includes(cleanSummary)) return true;
  const summaryTokens = normalizedTokens(summary);
  const rawTokens = normalizedTokens(raw);
  if (summaryTokens.size < 5 || rawTokens.size < 5) return false;
  let shared = 0;
  for (const token of summaryTokens) if (rawTokens.has(token)) shared += 1;
  return shared / summaryTokens.size >= 0.85;
}

function emptyFinding(key: ReflectionAnswerKey, summary: string | null): ReflectionFinding {
  const finding: ReflectionFinding = { key, summary };
  if (key === 'q1') finding.q1 = { interests: [], intellectualCuriosity: [], problemInterests: [], themeCandidates: [] };
  if (key === 'q2') finding.q2 = { turningPoint: null, values: [], mindsetShift: null, personalGrowth: null };
  if (key === 'q3') finding.q3 = { problemCaredAbout: null, affectedGroups: [], socialConcern: null, personalConnection: null, ownershipSignal: null };
  if (key === 'q4') finding.q4 = { builtImprovedSolved: null, actions: [], agencySignals: [], capabilitySignals: [], impactSignals: [] };
  if (key === 'q5') finding.q5 = { intendedMajor: null, academicMotivation: null, majorRationale: null, intellectualDirection: null };
  if (key === 'q6') finding.q6 = { futureProblem: null, desiredChange: null, futureAmbition: null, desiredImpact: null };
  if (key === 'q7') finding.q7 = { learningPreferences: [], collaborationPreferences: [], researchProjectPreferences: [], mentorshipPreferences: [], extracurricularPreferences: [], preferredOpportunities: [] };
  return finding;
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringValues);
  return [];
}

const { systemPrompt: SYSTEM_PROMPT } = getReportPrompt('reflection_signal_extraction');

/** Structured normalization; no fallback prose is created when this call fails. */
export async function extractReflectionFindings(args: {
  signals: readonly ReflectionAnswerSignal[];
  apiKey: string;
  model?: string;
}): Promise<Map<ReflectionAnswerKey, ReflectionFinding>> {
  const findings = new Map<ReflectionAnswerKey, ReflectionFinding>();
  if (args.signals.length === 0) return findings;

  try {
    const content = await openAiJsonCompletion({
      apiKey: args.apiKey,
      model: args.model ?? defaultOpenAIModel(),
      temperature: 0,
      maxTokens: 1_300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({ answers: args.signals.map(({ key, value }) => ({ key, value })) }),
        },
      ],
    });
    const parsed = responseSchema.parse(JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()));
    const rawByKey = new Map(args.signals.map((signal) => [signal.key, signal.value]));
    for (const item of parsed.signals) {
      const raw = rawByKey.get(item.key);
      if (!raw) continue;
      const candidate = emptyFinding(item.key, item.summary?.trim() || null);
      const section = item[item.key];
      if (section !== undefined) Object.assign(candidate, { [item.key]: section });
      if (stringValues(candidate).some((value) => isNearVerbatimReflectionSummary(value, raw))) continue;
      findings.set(item.key, candidate);
    }
  } catch {
    // Raw answers remain source evidence; a failed normalization creates no
    // generic report phrase and no synthetic capability or direction.
  }
  return findings;
}

/** Backward-compatible summary view for legacy consumers; it uses the same one AI call. */
export async function extractReflectionSignalSummaries(args: {
  signals: readonly ReflectionAnswerSignal[];
  apiKey: string;
  model?: string;
}): Promise<Map<ReflectionAnswerKey, string>> {
  const summaries = new Map<ReflectionAnswerKey, string>();
  for (const [key, finding] of await extractReflectionFindings(args)) {
    if (finding.summary) summaries.set(key, finding.summary);
  }
  return summaries;
}
