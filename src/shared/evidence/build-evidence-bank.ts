import {
  EVIDENCE_BANK_VERSION,
  type AIInterpretation,
  type EvidenceBank,
  type EvidenceClaim,
  type NormalizedValue,
  type RawSource,
} from './domain';

/**
 * Deterministic Evidence Bank construction (Task 7 Step 4).
 *
 * Built from ONE confirmed snapshot's slices: academic/test records,
 * achievements+activities, follow-up answers, documents, profile fields, and
 * report-only supplements. No vector search, no model calls — the bank is a
 * pure function of its inputs so identical snapshots always produce
 * identical banks.
 *
 * VERIFICATION RULES (deterministic, exhaustive):
 * - test-backed numeric record  → `verified`
 * - document-backed achievement → `verified`
 * - everything else student-entered → `unverified`
 * - supplement-backed           → `report_only` (structurally barred)
 * - same metric, same value     → merge provenance into one claim
 * - same metric, differing values → stay separate, both `conflicting`
 */

export interface AcademicRecordInput {
  id?: string;
  kind: 'english_test' | 'standardized_test' | 'gpa' | 'grade_summary';
  testType?: string | null;
  value: number | null;
  scale?: number | null;
  raw: string | null;
}

export interface ActivityRecordInput {
  id: string;
  kind: 'activity' | 'achievement';
  title: string;
  freeText: string | null;
  /** Storage key when an uploaded document backs this entry. */
  evidenceKey?: string | null;
  /** Original snapshot metadata, kept on the raw source for social-proof consumers. */
  metadata?: Record<string, unknown>;
}

export interface FollowUpAnswerInput {
  activityId: string;
  dimension: string;
  question: string;
  answer: string;
  round: number;
}

export interface SupplementInput {
  fieldKey: string;
  answer: string;
}

export interface DocumentInput {
  id: string;
  fileName: string;
  storageKey?: string | null;
}

export interface EvidenceBankInput {
  academicRecords: AcademicRecordInput[];
  activities: ActivityRecordInput[];
  followUpAnswers?: FollowUpAnswerInput[];
  documents?: DocumentInput[];
  supplements?: SupplementInput[];
  interpretations?: Array<Omit<AIInterpretation, 'origin'> & { origin?: 'ai_extraction' }>;
  profileFields?: Record<string, unknown>;
}

function metricFor(record: AcademicRecordInput): string | null {
  if (record.kind === 'gpa') return 'gpa';
  if (record.kind === 'grade_summary' && record.scale === 100) return 'percentage';
  const test = (record.testType ?? '').toLowerCase();
  if (/ielts/.test(test)) return 'ielts';
  if (/toefl/.test(test)) return 'toefl';
  if (/sat\b/.test(test)) return 'sat';
  if (/act\b/.test(test)) return 'act';
  if (/ib\b/.test(test)) return 'ib_points';
  if (/a-?level|gce/.test(test)) return 'a_level';
  return record.kind === 'standardized_test' ? 'standardized' : null;
}

class BankBuilder {
  private sources: Record<string, RawSource> = {};
  private _claims: EvidenceClaim[] = [];

  addSource(source: Omit<RawSource, never>): string {
    this.sources[source.id] = source;
    return source.id;
  }

  hasSource(id: string): boolean {
    return Boolean(this.sources[id]);
  }

  addClaim(claim: EvidenceClaim): void {
    this._claims.push(claim);
  }

  get claims(): EvidenceClaim[] {
    return this._claims;
  }

  snapshot(missingInformation: EvidenceBank['missingInformation'], interpretations: AIInterpretation[]): EvidenceBank {
    return {
      version: EVIDENCE_BANK_VERSION,
      sources: this.sources,
      interpretations,
      claims: this._claims,
      missingInformation,
    };
  }
}

export function buildEvidenceBank(input: EvidenceBankInput): EvidenceBank {
  const builder = new BankBuilder();
  const missingInformation: EvidenceBank['missingInformation'] = [];
  const documentSourceByKey = new Map<string, string>();

  // ── documents register first so evidence keys can link to them ────────────
  for (const doc of input.documents ?? []) {
    const sourceId = builder.addSource({ id: `document:${doc.id}`, type: 'document', label: doc.fileName });
    documentSourceByKey.set(doc.id, sourceId);
    if (doc.storageKey) documentSourceByKey.set(doc.storageKey, sourceId);
  }

  const claimsById = new Map<string, EvidenceClaim>();
  /** Semantic merge index: "metric|value|scale" → claim id. */
  const normIndex = new Map<string, string>();

  const putNumericClaim = (args: {
    id: string;
    category: EvidenceClaim['category'];
    statement: string;
    normalizedValue: NormalizedValue | null;
    sourceRefs: string[];
    verified: boolean;
    tags?: { competencies?: string[]; criteria?: string[] };
  }): void => {
    if (args.normalizedValue) {
      const key = `${args.normalizedValue.metric}|${args.normalizedValue.value}|${args.normalizedValue.scale ?? ''}`;
      const existingId = normIndex.get(key);
      if (existingId) {
        // Compatible duplicate — merge provenance into the existing claim.
        const existing = claimsById.get(existingId)!;
        existing.sourceRefs = Array.from(new Set([...existing.sourceRefs, ...args.sourceRefs]));
        return;
      }
      // Same metric, DIFFERENT value anywhere before → both become conflicting.
      const sameMetricDifferentValue = Array.from(claimsById.values()).find(
        (claim) =>
          claim.normalizedValue?.metric === args.normalizedValue!.metric &&
          Math.abs(claim.normalizedValue.value - args.normalizedValue!.value) >= 1e-9,
      );
      if (sameMetricDifferentValue) {
        sameMetricDifferentValue.status = 'conflicting';
      }
      const claim: EvidenceClaim = {
        id: args.id,
        category: args.category,
        statement: args.statement,
        normalizedValue: args.normalizedValue,
        status: sameMetricDifferentValue ? 'conflicting' : args.verified ? 'verified' : 'unverified',
        sourceRefs: args.sourceRefs,
        interpretationRefs: [],
        tags: {
          competencies: args.tags?.competencies ?? [],
          criteria: args.tags?.criteria ?? [],
        },
      };
      claimsById.set(args.id, claim);
      normIndex.set(key, args.id);
      builder.addClaim(claim);
      return;
    }

    const claim: EvidenceClaim = {
      id: args.id,
      category: args.category,
      statement: args.statement,
      normalizedValue: null,
      // Non-numeric claims verify only through their deterministic source
      // rule (document-backed achievements) computed by the caller.
      status: args.verified ? 'verified' : 'unverified',
      sourceRefs: args.sourceRefs,
      interpretationRefs: [],
      tags: {
        competencies: args.tags?.competencies ?? [],
        criteria: args.tags?.criteria ?? [],
      },
    };
    claimsById.set(args.id, claim);
    builder.addClaim(claim);
  };

  // ── academic / test records ───────────────────────────────────────────────
  for (const [index, record] of (input.academicRecords ?? []).entries()) {
    const sourceId = `${record.kind}:${record.id ?? index}`;
    builder.addSource({
      id: sourceId,
      type:
        record.kind === 'english_test'
          ? 'english_test'
          : record.kind === 'standardized_test'
            ? 'standardized_test'
            : 'profile_field',
      label: record.raw ?? record.testType ?? record.kind,
    });

    const metric = metricFor(record);
    const verified =
      record.value != null &&
      (record.kind !== 'gpa' || true) && // presence of the record itself is deterministic
      (record.kind === 'english_test' || record.kind === 'standardized_test');
    putNumericClaim({
      id: `academic:${sourceId}`,
      category: 'academic',
      statement: record.raw ?? `${record.testType ?? record.kind} ${record.value ?? ''}`.trim(),
      normalizedValue:
        record.value != null && metric
          ? { metric, value: record.value, scale: record.scale ?? null }
          : null,
      sourceRefs: [sourceId],
      verified: Boolean(verified),
      tags: {
        criteria: metric ? [`criterion:${metric}`, 'criterion:english'] : [],
      },
    });
  }

  // ── achievements & activities ─────────────────────────────────────────────
  for (const item of input.activities ?? []) {
    const sourceId = `${item.kind}:${item.id}`;
    builder.addSource({
      id: sourceId,
      type: item.kind,
      label: item.title,
      ...(item.metadata ? { metadata: item.metadata } : {}),
    });

    const backingDoc = item.evidenceKey ? documentSourceByKey.get(item.evidenceKey) ?? null : null;
    putNumericClaim({
      id: `experience:${item.id}`,
      category: 'experience',
      statement: item.freeText ?? item.title,
      normalizedValue: null,
      sourceRefs: [sourceId, ...(backingDoc ? [backingDoc] : [])],
      // Deterministic rule: an attached uploaded document verifies the entry.
      verified: item.kind === 'achievement' && Boolean(backingDoc),
      tags: {},
    });
  }

  // ── follow-up answers ─────────────────────────────────────────────────────
  (input.followUpAnswers ?? []).forEach((answer, index) => {
    const sourceId = `follow_up:${answer.activityId}:${answer.dimension}:${index}`;
    builder.addSource({ id: sourceId, type: 'follow_up_answer', label: answer.question });
    putNumericClaim({
      id: `follow_up:${answer.activityId}:${answer.dimension}:${index}`,
      category: 'experience',
      statement: answer.answer,
      normalizedValue: null,
      sourceRefs: [sourceId],
      verified: false, // self-reported detail — stays unverified
      tags: { criteria: [`criterion:follow_up_${answer.dimension}`] },
    });
  });

  // ── supplements: structurally report-only ─────────────────────────────────
  (input.supplements ?? []).forEach((supplement) => {
    const sourceId = `supplement:${supplement.fieldKey}`;
    builder.addSource({ id: sourceId, type: 'supplement', label: supplement.fieldKey });
    putNumericClaim({
      id: `supplement:${supplement.fieldKey}`,
      category: 'direction',
      statement: supplement.answer,
      normalizedValue: null,
      sourceRefs: [sourceId],
      verified: false,
      tags: { criteria: ['scope:report_only'] },
    });
    const claim = claimsById.get(`supplement:${supplement.fieldKey}`);
    if (claim) claim.status = 'report_only';
  });

  // ── AI interpretations: linked, never verifiable, never sources ──────────
  for (const interpretation of input.interpretations ?? []) {
    const anchor = builder.claims.find((claim) =>
      claim.sourceRefs.some((ref) => interpretation.sourceRefs.includes(ref)),
    );
    if (anchor && !anchor.interpretationRefs.includes(interpretation.id)) {
      anchor.interpretationRefs.push(interpretation.id);
    }
    const payload = (interpretation.payload ?? {}) as { label?: unknown };
    const label = typeof payload.label === 'string' ? payload.label : null;
    if (label) {
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const competencyId = `competency:${slug}`;
      const existing = claimsById.get(competencyId);
      if (existing) {
        if (!existing.interpretationRefs.includes(interpretation.id)) {
          existing.interpretationRefs.push(interpretation.id);
        }
        existing.sourceRefs = Array.from(
          new Set([...existing.sourceRefs, ...interpretation.sourceRefs]),
        );
      } else {
        const claim: EvidenceClaim = {
          id: competencyId,
          category: 'competency',
          statement: label,
          normalizedValue: null,
          // AI-originated: structurally unverified — an interpretation id can
          // never appear in sourceRefs, so no deterministic rule can fire.
          status: 'unverified',
          sourceRefs: [],
          interpretationRefs: [interpretation.id],
          tags: { competencies: [slug], criteria: [] },
          limitations: ['Derived from AI extraction; not independently verified.'],
        };
        claimsById.set(competencyId, claim);
        builder.addClaim(claim);
      }
    }
  }

  // Conflict bookkeeping surfaces as explicit missing information.
  const conflicting = builder.claims.filter((claim) => claim.status === 'conflicting');
  for (const claim of conflicting) {
    if (claim.normalizedValue) {
      missingInformation.push({
        area: `conflict:${claim.normalizedValue.metric}`,
        note: `Snapshot holds more than one different ${claim.normalizedValue.metric} value; confirm which is correct.`,
      });
    }
  }

  return builder.snapshot(
    missingInformation,
    // Normalize the origin marker so every stored interpretation is
    // structurally flagged as AI output.
    (input.interpretations ?? []).map((interpretation) => ({
      ...interpretation,
      origin: 'ai_extraction' as const,
    })),
  );
}
