import { defaultOpenAIModel } from '../openai-client';
import { getReportPrompt, REPORT_PROMPT_VERSIONS } from '../runtime/prompt-registry';
import {
  generateStructured,
  StructuredGenerationError,
} from '../runtime/structured-generation';
import { z } from 'zod';
import {
  canonicalSourceFingerprint,
  targetProfileSchema,
  TARGET_PROFILE_SCHEMA_VERSION,
  type TargetProfile,
  type TargetFact,
  type TargetRequirement,
} from './domain';
import {
  createTargetProfileVersion,
  getLatestTargetProfileVersion,
  loadProgrammeCatalogue,
} from './repository';

/**
 * Target Profile resolution (Task 4).
 *
 * Deterministic-first: every already-structured catalogue row maps directly
 * onto a requirement with its provenance. Only genuinely unstructured prose
 * goes to the model — through `generateStructured` with the shared registry
 * prompt — and its output is merged under the same "sources or explicit
 * missing information" rule.
 *
 * STALENESS = fingerprint mismatch between the newest stored version and the
 * CURRENT ingested rows. It is never about retrieval age. On `stale` this
 * resolver regenerates synchronously and reports status 'stale' with the NEW
 * version id; a first-ever generation reports 'ready'; an unchanged
 * fingerprint serves 'cached'. Absent lineage (no programme row) is
 * 'not_ready' and generates nothing.
 *
 * This module performs no network I/O beyond the model call itself — there is
 * no code path that could crawl an arbitrary URL.
 */

export type TargetProfileResolution =
  | { status: 'not_ready'; versionId: null; profile: null; reason: string }
  | { status: 'cached'; versionId: string; profile: TargetProfile }
  | { status: 'stale'; versionId: string; profile: TargetProfile; previousVersionId: string }
  | { status: 'ready'; versionId: string; profile: TargetProfile };

/** Unstructured prose pool handed to the extractor (already source-tagged). */
export type UnstructuredSource = { ref: string; text: string };

export type ExtractedRequirementDraft = {
  category: TargetRequirement['category'];
  label: string;
  detail: string | null;
  sourceRefs: string[];
};

export type ExtractedTargetFactDraft = {
  field:
    | 'universityMission' | 'universityValue' | 'educationalPhilosophy' | 'studentProfile'
    | 'teachingModel' | 'experientialLearning' | 'classStructure' | 'interdisciplinary'
    | 'research' | 'entrepreneurship' | 'mentorship' | 'communityProgramme'
    | 'distinctiveOpportunity' | 'programmeDescription' | 'curriculum' | 'programmeOutcome'
    | 'preferredCompetency' | 'careerPathway' | 'programmeOpportunity';
  value: string;
  sourceRefs: string[];
};

export type RequirementExtractorResult = {
  requirements: ExtractedRequirementDraft[];
  facts: ExtractedTargetFactDraft[];
};

export type RequirementExtractor = (
  sources: readonly UnstructuredSource[],
) => Promise<ExtractedRequirementDraft[] | RequirementExtractorResult>;

const extractionOutputSchema = z.object({
  requirements: z
    .array(
      z.object({
        category: z.enum(['academic', 'competency', 'selection', 'scholarship', 'application']),
        label: z.string().min(1).max(300),
        detail: z.string().max(2000).nullable(),
        sourceIndex: z.number().int().min(0).max(49),
      }),
    )
    .max(40),
  facts: z.array(z.object({
    field: z.enum([
      'universityMission', 'universityValue', 'educationalPhilosophy', 'studentProfile',
      'teachingModel', 'experientialLearning', 'classStructure', 'interdisciplinary',
      'research', 'entrepreneurship', 'mentorship', 'communityProgramme',
      'distinctiveOpportunity', 'programmeDescription', 'curriculum', 'programmeOutcome',
      'preferredCompetency', 'careerPathway', 'programmeOpportunity',
    ]),
    value: z.string().min(1).max(2000),
    sourceIndex: z.number().int().min(0).max(49),
  })).max(80),
});

/**
 * Default extractor: one structured model call over the unstructured prose.
 * The registry prompt pins extraction-only behaviour and per-source citation.
 */
export const structuredRequirementExtractor: RequirementExtractor = async (sources) => {
  if (sources.length === 0) return [];
  const { systemPrompt } = getReportPrompt('target_profile_extraction');
  try {
    const result = await generateStructured({
      moduleId: 'target_profile_extraction',
      promptVersion: REPORT_PROMPT_VERSIONS.target_profile_extraction,
      schemaVersion: TARGET_PROFILE_SCHEMA_VERSION,
      schema: extractionOutputSchema,
      systemPrompt,
      userPrompt:
        `Extract programme requirements/criteria from the numbered sources below. ` +
        `Cite each item with the index of its source. Sources:\n` +
        sources.map((source, index) => `[${index}] (${source.ref}) ${source.text}`).join('\n'),
      temperature: 0,
      maxTokens: 2400,
    });
    const requirements = result.data.requirements.map((item) => {
      const source = sources[item.sourceIndex];
      if (!source) throw new Error(`Target extraction cited unknown source index: ${item.sourceIndex}`);
      return {
        category: item.category,
        label: item.label,
        detail: item.detail,
        sourceRefs: [source.ref],
      };
    });
    const facts = result.data.facts.map((item) => {
      const source = sources[item.sourceIndex];
      if (!source) throw new Error(`Target extraction cited unknown source index: ${item.sourceIndex}`);
      return { field: item.field, value: item.value, sourceRefs: [source.ref] };
    });
    return { requirements, facts };
  } catch (error) {
    if (error instanceof StructuredGenerationError) {
      // Extraction failure degrades to deterministic-only output; never fails
      // the whole request when structure already mapped something.
      console.warn('[target-profile] unstructured extraction failed', error.kind);
      return [];
    }
    throw error;
  }
};

function fieldText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['text'] === 'string') return record['text'];
  }
  return null;
}

/** Field names that map deterministically onto profile slots. */
const DEADLINE_FIELDS = /deadline|due_date|closing/i;
const SCHOLARSHIP_FIELDS = /scholarship|bursary|funding|merit/i;
const VALUE_FIELDS = /value|mission|ethos|culture|specific_insight|best_for|strength|weakness|notes/i;
const THEME_FIELDS = /theme|focus|specialis|description|overview/i;
const LEARNING_FIELDS = /teach|pedagog|class|interdiscip|experiential|research|entrepreneur|mentor|community_programme|international_environment|study_mode/i;
const PROGRAMME_PROFILE_FIELDS = /curriculum|module|coursework|outcome|graduate|career|pathway|employ|opportun|competenc|skill|quality|intern|industry|connection/i;

function hasSourceBackedTargetData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSourceBackedTargetData);
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record['sourceRefs']) && record['sourceRefs'].some((ref) => typeof ref === 'string' && ref.length > 0)) {
    return true;
  }
  return Object.values(record).some(hasSourceBackedTargetData);
}

export async function resolveTargetProfile(args: {
  supabase: import('@supabase/supabase-js').SupabaseClient;
  userId: string;
  programmeId: string;
  scholarshipKey?: string;
  /** Injectable for tests; defaults to the structured AI extractor. */
  extractor?: RequirementExtractor;
}): Promise<TargetProfileResolution> {
  const extractor = args.extractor ?? structuredRequirementExtractor;
  const { projection, complete } = await loadProgrammeCatalogue(args.supabase, args.programmeId);
  if (!complete || !projection.programme) {
    return {
      status: 'not_ready',
      versionId: null,
      profile: null,
      reason: 'Programme not found in the ingested catalogue.',
    };
  }

  const fingerprint = canonicalSourceFingerprint(projection);
  const cached = await getLatestTargetProfileVersion(args.supabase, {
    userId: args.userId,
    programmeId: args.programmeId,
    scholarshipKey: args.scholarshipKey,
  });
  if (
    cached &&
    cached.sourceFingerprint === fingerprint &&
    cached.schemaVersion === TARGET_PROFILE_SCHEMA_VERSION &&
    cached.extractionPromptVersion === REPORT_PROMPT_VERSIONS.target_profile_extraction &&
    hasSourceBackedTargetData(cached.profile)
  ) {
    return { status: 'cached', versionId: cached.id, profile: cached.profile };
  }

  // ── build the profile ─────────────────────────────────────────────────────
  const programmeRow = projection.programme as Record<string, unknown>;
  const requirements: TargetRequirement[] = [];
  const deadlines: TargetProfile['deadlines'] = [];
  const missingInformation: TargetProfile['missingInformation'] = [];
  const universityValues: string[] = [];
  const universityValueFacts: TargetFact[] = [];
  let universityMission: TargetFact | null = null;
  let universityStudentProfile: TargetFact | null = null;
  let educationalPhilosophy: TargetFact | null = null;
  const learningEnvironment: {
    teachingModel: TargetFact | null;
    experientialLearning: TargetFact[];
    classStructure: TargetFact | null;
    interdisciplinary: TargetFact | null;
    research: TargetFact | null;
    entrepreneurship: TargetFact | null;
    mentorship: TargetFact | null;
    communityProgrammes: TargetFact[];
  } = {
    teachingModel: null,
    experientialLearning: [],
    classStructure: null,
    interdisciplinary: null,
    research: null,
    entrepreneurship: null,
    mentorship: null,
    communityProgrammes: [],
  };
  const programmeProfile = {
    description: null as TargetFact | null,
    curriculum: [] as TargetFact[],
    outcomes: [] as TargetFact[],
    preferredCompetencies: [] as TargetFact[],
    teachingStyle: null as TargetFact | null,
    careerPathways: [] as TargetFact[],
    opportunities: [] as TargetFact[],
  };
  let description: string | null = null;
  const themes: string[] = [];
  const unstructured: UnstructuredSource[] = [];
  const knownSourceRefs = new Set(projection.sources.map((source) => source.ref));

  for (const row of projection.admissionRequirements) {
    const documentType = String(row['document_type'] ?? 'requirement');
    const runRef = typeof row['source_run_id'] === 'string' ? row['source_run_id'] : '';
    const sourceRefs = runRef && knownSourceRefs.has(runRef) ? [runRef] : [];
    const suppliedCategory = row['category'];
    const category: TargetRequirement['category'] =
      suppliedCategory === 'academic' || suppliedCategory === 'competency' || suppliedCategory === 'selection' || suppliedCategory === 'scholarship' || suppliedCategory === 'application'
        ? suppliedCategory
        : /english|ielts|toefl|test|gpa|transcript|academic/i.test(documentType)
          ? 'academic'
          : 'application';
    requirements.push({
      id: `adm:${documentType}`,
      category,
      label: documentType.replace(/_/g, ' '),
      detail: fieldText(row['detail']) ?? (row['required_count'] != null ? `${row['required_count']} document(s)` : null),
      status: (row['requirement_status'] as TargetRequirement['status']) ?? 'unknown',
      sourceRefs,
      missingInformation: sourceRefs.length ? null : 'No valid ingest provenance recorded for this requirement.',
    });
  }

  for (const row of projection.fieldValues) {
    const fieldName = String(row['field_name'] ?? '');
    const text = fieldText(row['value']);
    const runRef = typeof row['source_run_id'] === 'string' ? row['source_run_id'] : '';
    if (!text) continue;

    if (DEADLINE_FIELDS.test(fieldName)) {
      deadlines.push({ label: fieldName.replace(/_/g, ' '), value: text.slice(0, 200), sourceRefs: runRef && knownSourceRefs.has(runRef) ? [runRef] : [] });
      continue;
    }
    if (SCHOLARSHIP_FIELDS.test(fieldName)) {
      requirements.push({
        id: `sch:${row['id'] ?? fieldName}`,
        category: 'scholarship',
        label: fieldName.replace(/_/g, ' '),
        detail: text.slice(0, 500),
        status: 'unknown',
        sourceRefs: runRef && knownSourceRefs.has(runRef) ? [runRef] : [],
        missingInformation: runRef && knownSourceRefs.has(runRef) ? null : 'Scholarship note lacks valid ingest provenance.',
      });
      continue;
    }
    if (LEARNING_FIELDS.test(fieldName)) {
      const fact = runRef && knownSourceRefs.has(runRef) ? { value: text.slice(0, 2_000), sourceRefs: [runRef] } : null;
      if (!fact) missingInformation.push({ area: fieldName, note: 'Learning-environment fact lacks valid ingest provenance.' });
      else if (/teach|pedagog/i.test(fieldName)) {
        learningEnvironment.teachingModel = fact;
        if (!runRef.startsWith('catalogue:university:')) programmeProfile.teachingStyle = fact;
      }
      else if (/experiential|project|practice/i.test(fieldName)) learningEnvironment.experientialLearning.push(fact);
      else if (/class/i.test(fieldName)) learningEnvironment.classStructure = fact;
      else if (/interdiscip/i.test(fieldName)) learningEnvironment.interdisciplinary = fact;
      else if (/research/i.test(fieldName)) learningEnvironment.research = fact;
      else if (/entrepreneur/i.test(fieldName)) learningEnvironment.entrepreneurship = fact;
      else if (/mentor/i.test(fieldName)) learningEnvironment.mentorship = fact;
      else learningEnvironment.communityProgrammes.push(fact);
      continue;
    }
    if (VALUE_FIELDS.test(fieldName)) {
      if (runRef && knownSourceRefs.has(runRef)) {
        const fact = { value: text.slice(0, 2_000), sourceRefs: [runRef] };
        if (/student|best_for/i.test(fieldName)) {
          universityStudentProfile = fact;
        } else {
          universityValues.push(text.slice(0, 200));
          universityValueFacts.push(fact);
          if (/mission/i.test(fieldName)) universityMission = fact;
          if (/ethos|culture|philosophy/i.test(fieldName)) educationalPhilosophy = fact;
        }
      } else {
        missingInformation.push({ area: fieldName, note: 'Structured university value lacks ingest provenance.' });
      }
      continue;
    }
    if (THEME_FIELDS.test(fieldName)) {
      const fact = runRef && knownSourceRefs.has(runRef) ? { value: text.slice(0, 2_000), sourceRefs: [runRef] } : null;
      if (!fact) missingInformation.push({ area: fieldName, note: 'Programme theme lacks valid ingest provenance.' });
      if (/description|overview/.test(fieldName)) {
        description = description ?? text.slice(0, 4000);
        programmeProfile.description = programmeProfile.description ?? fact;
      } else if (/curriculum|module|coursework/.test(fieldName)) {
        themes.push(text.slice(0, 120));
        if (fact) programmeProfile.curriculum.push(fact);
      } else if (/outcome|graduate/.test(fieldName)) {
        if (fact) programmeProfile.outcomes.push(fact);
      } else if (/career|pathway|employ/.test(fieldName)) {
        if (fact) programmeProfile.careerPathways.push(fact);
      } else if (/opportun|research|intern|project/.test(fieldName)) {
        if (fact) programmeProfile.opportunities.push(fact);
      } else {
        themes.push(text.slice(0, 120));
        if (fact) programmeProfile.curriculum.push(fact);
      }
      continue;
    }
    if (PROGRAMME_PROFILE_FIELDS.test(fieldName)) {
      const fact = runRef && knownSourceRefs.has(runRef) ? { value: text.slice(0, 2_000), sourceRefs: [runRef] } : null;
      if (!fact) missingInformation.push({ area: fieldName, note: 'Programme fact lacks valid ingest provenance.' });
      else if (/curriculum|module|coursework/i.test(fieldName)) programmeProfile.curriculum.push(fact);
      else if (/outcome|graduate/i.test(fieldName)) programmeProfile.outcomes.push(fact);
      else if (/career|pathway|employ/i.test(fieldName)) programmeProfile.careerPathways.push(fact);
      else if (/competenc|skill|quality/i.test(fieldName)) programmeProfile.preferredCompetencies.push(fact);
      else programmeProfile.opportunities.push(fact);
      continue;
    }
    // Everything else stays prose for the extractor, WITH its provenance.
    if (runRef && knownSourceRefs.has(runRef)) unstructured.push({ ref: runRef, text: text.slice(0, 4_000) });
    else missingInformation.push({ area: fieldName, note: 'Unstructured target fact lacks valid ingest provenance.' });
  }

  const extractedResult = await extractor(unstructured);
  const extracted = Array.isArray(extractedResult) ? extractedResult : extractedResult.requirements;
  for (const draft of extracted) {
    const sourceRefs = draft.sourceRefs.filter((ref) => knownSourceRefs.has(ref));
    requirements.push({
      id: `ext:${draft.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
      category: draft.category,
      label: draft.label,
      detail: draft.detail,
      status: null,
      sourceRefs,
      missingInformation: sourceRefs.length ? null : 'Extraction cited no ingested source.',
    });
  }

  const extractedFacts = Array.isArray(extractedResult) ? [] : extractedResult.facts;
  const validFact = (fact: ExtractedTargetFactDraft): TargetFact | null => {
    const sourceRefs = fact.sourceRefs.filter((ref) => knownSourceRefs.has(ref));
    return sourceRefs.length ? { value: fact.value.slice(0, 2_000), sourceRefs } : null;
  };
  for (const draft of extractedFacts) {
    const fact = validFact(draft);
    if (!fact) {
      missingInformation.push({ area: draft.field, note: 'Extraction cited no ingested source.' });
      continue;
    }
    switch (draft.field) {
      case 'universityMission': universityMission ??= fact; break;
      case 'universityValue': universityValueFacts.push(fact); universityValues.push(fact.value.slice(0, 200)); break;
      case 'educationalPhilosophy': educationalPhilosophy ??= fact; break;
      case 'studentProfile': universityStudentProfile ??= fact; break;
      case 'teachingModel': learningEnvironment.teachingModel ??= fact; break;
      case 'experientialLearning': learningEnvironment.experientialLearning.push(fact); break;
      case 'classStructure': learningEnvironment.classStructure ??= fact; break;
      case 'interdisciplinary': learningEnvironment.interdisciplinary ??= fact; break;
      case 'research': learningEnvironment.research ??= fact; break;
      case 'entrepreneurship': learningEnvironment.entrepreneurship ??= fact; break;
      case 'mentorship': learningEnvironment.mentorship ??= fact; break;
      case 'communityProgramme': learningEnvironment.communityProgrammes.push(fact); break;
      case 'distinctiveOpportunity': programmeProfile.opportunities.push(fact); break;
      case 'programmeDescription': description ??= fact.value; programmeProfile.description ??= fact; break;
      case 'curriculum': programmeProfile.curriculum.push(fact); break;
      case 'programmeOutcome': programmeProfile.outcomes.push(fact); break;
      case 'preferredCompetency': programmeProfile.preferredCompetencies.push(fact); break;
      case 'careerPathway': programmeProfile.careerPathways.push(fact); break;
      case 'programmeOpportunity': programmeProfile.opportunities.push(fact); break;
    }
  }

  const profile: TargetProfile = targetProfileSchema.parse({
    programme: {
      id: String(programmeRow['id']),
      name: String(programmeRow['course_name'] ?? ''),
      university: String(programmeRow['university_name'] ?? ''),
      level: (programmeRow['degree_level'] as string | null) ?? null,
      subject: (programmeRow['subject'] as string | null) ?? null,
    },
    universityValues: Array.from(new Set(universityValues)).slice(0, 20),
    programmeThemes: { description, themes: Array.from(new Set(themes)).slice(0, 20) },
    requirements,
    deadlines,
    missingInformation,
    sources: projection.sources.map((source) => ({
      ref: source.ref,
      url: source.url,
      title: source.title,
      retrievedAt: source.retrievedAt,
    })),
    universityProfile: {
      mission: universityMission ?? null,
      values: universityValueFacts,
      educationalPhilosophy,
      studentProfile: universityStudentProfile,
      learningEnvironment,
      distinctiveOpportunities: programmeProfile.opportunities,
    },
    programmeProfile: {
      ...programmeProfile,
      preferredCompetencies: requirements
        .filter((requirement) => requirement.category === 'competency' && requirement.sourceRefs.length > 0)
        .map((requirement) => ({ value: requirement.label, sourceRefs: requirement.sourceRefs })),
      teachingStyle: programmeProfile.teachingStyle,
    },
    scholarshipProfile: null,
  });

  if (!hasSourceBackedTargetData(profile)) {
    console.warn('[target-profile] no source-backed target facts found', { programmeId: args.programmeId });
    return {
      status: 'not_ready',
      versionId: null,
      profile: null,
      reason: 'Catalogue contains no source-backed target facts.',
    };
  }

  const { versionId } = await createTargetProfileVersion(args.supabase, {
    userId: args.userId,
    programmeId: args.programmeId,
    scholarshipKey: args.scholarshipKey,
    sourceFingerprint: fingerprint,
    profile,
    modelName: defaultOpenAIModel(),
    promptVersion: REPORT_PROMPT_VERSIONS.target_profile_extraction,
    schemaVersion: TARGET_PROFILE_SCHEMA_VERSION,
  });

  if (!versionId) {
    return {
      status: 'not_ready',
      versionId: null,
      profile: null,
      reason: 'Target profile persistence is not available yet.',
    };
  }

  return cached
    ? { status: 'stale', versionId, profile, previousVersionId: cached.id }
    : { status: 'ready', versionId, profile };
}
