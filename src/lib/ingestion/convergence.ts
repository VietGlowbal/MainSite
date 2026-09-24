import { createHash } from 'node:crypto';

/**
 * Phase 3E common ingestion contract.
 *
 * This module is deliberately a pure boundary. Adapters describe evidence and
 * assertions; they do not fetch, write canonical rows, or turn legacy output
 * into trusted product truth. The Python crawler emits the same JSON shape from
 * its matching wire contract in services/data-ingestion.
 */

export const INGESTION_CONVERGENCE_VERSION = 'ingestion-convergence/v1';
export const LEGACY_COMPATIBILITY_ADAPTER_VERSION = 'legacy-compatibility/v1';
export const MANUAL_SOURCE_ADAPTER_VERSION = 'manual-source/v1';
export const STRUCTURED_SOURCE_ADAPTER_VERSION = 'structured-source/v1';
export const SCHOLARSHIP_SOURCE_ADAPTER_VERSION = 'scholarship-source/v1';

export type IngestionAdapterId =
  | 'python_acquisition'
  | 'legacy_parser'
  | 'manual_url'
  | 'programme_csv'
  | 'scholarship_csv'
  | 'provider_source'
  | 'curator';

export type CompatibilityLifecycle =
  | 'ACTIVE'
  | 'SHADOWED'
  | 'DEPRECATED'
  | 'READY_FOR_CUTOVER';

export type AssertionEntityType = 'programme' | 'university' | 'scholarship';

export type AssertionEpistemic = 'OBSERVED' | 'DERIVED' | 'INFERRED';
export type AssertionTemporal = 'CURRENT' | 'HISTORICAL' | 'UNKNOWN';
export type AssertionVerification = 'VALIDATED' | 'NEEDS_REVIEW' | 'UNVALIDATED';

export type IngestionFailureCode =
  | 'ACQUISITION_FAILED'
  | 'RAW_PERSIST_FAILED'
  | 'EXTRACTION_FAILED'
  | 'VALIDATION_FAILED'
  | 'IDENTITY_UNRESOLVED'
  | 'QUALITY_BLOCKED'
  | 'PROMOTION_FAILED';

export type DirectWritePurpose =
  | 'normal_ingestion'
  | 'legacy_compatibility'
  | 'csv_import'
  | 'manual_url'
  | 'scholarship_etl'
  | 'v3_promotion'
  | 'curator_override'
  | 'admin_repair'
  | 'migration';

export type DirectWriteDisposition = 'BLOCKED' | 'ALLOWED_PRIVILEGED' | 'ALLOWED_COMPATIBILITY';

export interface RawEvidenceReference {
  kind: 'remote_raw' | 'structured_file' | 'structured_record' | 'none';
  rawDocumentId: string | null;
  sourceId: string;
  locator: string | null;
  contentHash: string | null;
  retained: boolean;
  limitation: string | null;
}

export interface SourceMetadata {
  sourceId: string;
  adapter: IngestionAdapterId;
  adapterVersion: string;
  sourcePath: string;
  sourceUrl: string | null;
  sourceOwner: string | null;
  parserVersion: string | null;
  fileId: string | null;
  fileHash: string | null;
  rowLocator: string | null;
  observedAt: string;
  lifecycle: CompatibilityLifecycle;
}

export interface AssertionProvenance {
  source: SourceMetadata;
  rawEvidence: RawEvidenceReference;
  originalValue: unknown;
  legacyJobId: string | null;
  parsedField: string;
  adaptationTimestamp: string | null;
  provenanceLimitations: string[];
}

export interface StagedAssertion {
  assertionId: string;
  entityType: AssertionEntityType;
  entityKey: string;
  field: string;
  value: unknown;
  provenance: AssertionProvenance;
  epistemic: AssertionEpistemic;
  temporal: AssertionTemporal;
  verification: AssertionVerification;
  authority: string | null;
  audience: string | null;
  academicCycle: string | null;
  validated: boolean;
  trustedForCanonicalPromotion: false;
}

export interface IdentityHint {
  entityType: AssertionEntityType;
  institutionId: string | number | null;
  programmeCode: string | null;
  providerId: string | null;
  nationalId: string | null;
  accreditorId: string | null;
  name: string | null;
  credential: string | null;
  degreeLevel: string | null;
  country: string | null;
}

export interface AcquisitionIntentDescriptor {
  intentId: string;
  sourceClass: string;
  locator: string;
  fieldScope: string[];
  requiresRawPersistence: boolean;
  directFetchOwner: 'slice_b';
  fingerprint: string;
}

export interface IngestionEnvelope {
  contractVersion: string;
  ingestionId: string;
  source: SourceMetadata;
  rawEvidence: RawEvidenceReference;
  assertions: StagedAssertion[];
  identityHint: IdentityHint;
  acquisitionIntent: AcquisitionIntentDescriptor | null;
  provenanceLimitations: string[];
  qualityHandoff: {
    required: true;
    policyInput: 'slice_c';
    promotionMode: 'shadow';
  };
  canonicalWrite: {
    allowed: false;
    reason: 'requires_product_safety_contract_and_promotion_v3';
  };
}

export interface DirectWriteRequest {
  purpose: DirectWritePurpose;
  sourcePath: string;
  actor: string | null;
  contractPassed?: boolean;
  explicitCompatibility?: boolean;
  reason?: string;
}

export interface DirectWriteDecision {
  disposition: DirectWriteDisposition;
  purpose: DirectWritePurpose;
  sourcePath: string;
  requiresV3Parity: boolean;
  reason: string;
}

export interface WriteAuditRecord {
  auditId: string;
  sourcePath: string;
  adapter: IngestionAdapterId;
  identityDecision: string | null;
  qualityDecision: string | null;
  promotionId: string | null;
  canonicalChange: Record<string, unknown> | null;
  disposition: DirectWriteDisposition;
  actor: string | null;
  reason: string | null;
  recordedAt: string;
}

export interface DifferentialReport {
  reportId: string;
  sourcePath: string;
  adapter: IngestionAdapterId;
  legacyOutput: Record<string, unknown>;
  v3AssertionFields: string[];
  identityDecision: string;
  qualityState: string;
  promotionEligible: boolean;
  differences: string[];
  blockingReasons: string[];
  generatedAt: string;
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return value == null ? null : String(value);
  const result = value.trim();
  return result || null;
}

function canonical(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim().toLocaleLowerCase('en-US');
}

export function stableConvergenceId(namespace: string, ...parts: unknown[]): string {
  return createHash('sha256')
    .update(`${namespace}\u001f${parts.map(canonical).join('\u001f')}`)
    .digest('hex')
    .slice(0, 32);
}

function sourceMetadata(input: Partial<SourceMetadata> & Pick<SourceMetadata, 'adapter' | 'sourcePath'>): SourceMetadata {
  const observedAt = input.observedAt ?? new Date().toISOString();
  return {
    sourceId: input.sourceId ?? stableConvergenceId('source', input.adapter, input.sourcePath, input.sourceUrl),
    adapter: input.adapter,
    adapterVersion: input.adapterVersion ?? INGESTION_CONVERGENCE_VERSION,
    sourcePath: input.sourcePath,
    sourceUrl: input.sourceUrl ?? null,
    sourceOwner: input.sourceOwner ?? null,
    parserVersion: input.parserVersion ?? null,
    fileId: input.fileId ?? null,
    fileHash: input.fileHash ?? null,
    rowLocator: input.rowLocator ?? null,
    observedAt,
    lifecycle: input.lifecycle ?? 'SHADOWED',
  };
}

function rawEvidence(input: Partial<RawEvidenceReference> & Pick<RawEvidenceReference, 'kind' | 'sourceId'>): RawEvidenceReference {
  const retained = input.retained ?? false;
  return {
    kind: input.kind,
    rawDocumentId: input.rawDocumentId ?? null,
    sourceId: input.sourceId,
    locator: input.locator ?? null,
    contentHash: input.contentHash ?? null,
    retained,
    limitation: input.limitation ?? (retained ? null : 'RAW_EVIDENCE_NOT_RETAINED'),
  };
}

function assertion(
  source: SourceMetadata,
  evidence: RawEvidenceReference,
  input: {
    entityType: AssertionEntityType;
    entityKey: string;
    field: string;
    value: unknown;
    originalValue?: unknown;
    legacyJobId?: string | null;
    adaptationTimestamp?: string | null;
    entitySource?: string | null;
    audience?: string | null;
    academicCycle?: string | null;
    authority?: string | null;
    temporal?: AssertionTemporal;
    verification?: AssertionVerification;
    validated?: boolean;
    epistemic?: AssertionEpistemic;
    provenanceLimitations?: string[];
  },
): StagedAssertion {
  const limitations = [...(input.provenanceLimitations ?? [])];
  if (evidence.limitation && !limitations.includes(evidence.limitation)) limitations.push(evidence.limitation);
  return {
    assertionId: stableConvergenceId('assertion', source.sourceId, input.entityKey, input.field, input.value),
    entityType: input.entityType,
    entityKey: input.entityKey,
    field: input.field,
    value: input.value,
    provenance: {
      source,
      rawEvidence: evidence,
      originalValue: input.originalValue ?? input.value,
      legacyJobId: input.legacyJobId ?? null,
      parsedField: input.field,
      adaptationTimestamp: input.adaptationTimestamp ?? null,
      provenanceLimitations: limitations,
    },
    epistemic: input.epistemic ?? 'OBSERVED',
    temporal: input.temporal ?? 'UNKNOWN',
    verification: input.verification ?? 'UNVALIDATED',
    authority: input.authority ?? null,
    audience: input.audience ?? null,
    academicCycle: input.academicCycle ?? null,
    validated: input.validated ?? false,
    trustedForCanonicalPromotion: false,
  };
}

function envelope(input: {
  source: SourceMetadata;
  rawEvidence: RawEvidenceReference;
  ingestionId: string;
  assertions: StagedAssertion[];
  identityHint: IdentityHint;
  acquisitionIntent?: AcquisitionIntentDescriptor | null;
  provenanceLimitations?: string[];
}): IngestionEnvelope {
  return {
    contractVersion: INGESTION_CONVERGENCE_VERSION,
    ingestionId: input.ingestionId,
    source: input.source,
    rawEvidence: input.rawEvidence,
    assertions: input.assertions,
    identityHint: input.identityHint,
    acquisitionIntent: input.acquisitionIntent ?? null,
    provenanceLimitations: [...new Set(input.provenanceLimitations ?? [])],
    qualityHandoff: { required: true, policyInput: 'slice_c', promotionMode: 'shadow' },
    canonicalWrite: { allowed: false, reason: 'requires_product_safety_contract_and_promotion_v3' },
  };
}

export interface LegacyParserResult {
  course?: Record<string, unknown>;
  data?: { course?: Record<string, unknown> } & Record<string, unknown>;
}

export class LegacyCompatibilityAdapter {
  static readonly VERSION = LEGACY_COMPATIBILITY_ADAPTER_VERSION;
  static readonly LIFECYCLE: CompatibilityLifecycle = 'SHADOWED';

  static adapt(input: {
    legacyJobId: string;
    sourceUrl: string;
    parserVersion: string;
    result: LegacyParserResult | Record<string, unknown>;
    applicationId?: string | null;
    rawDocumentId?: string | null;
    rawContentHash?: string | null;
    rawRetained?: boolean;
    adaptedAt?: string;
  }): IngestionEnvelope {
    const result = input.result as Record<string, unknown>;
    const course = (result.course ?? (result.data as Record<string, unknown> | undefined)?.course ?? result) as Record<string, unknown>;
    const source = sourceMetadata({
      adapter: 'legacy_parser',
      adapterVersion: LegacyCompatibilityAdapter.VERSION,
      sourcePath: 'src/lib/course-parser/job-processor.ts',
      sourceUrl: input.sourceUrl,
      parserVersion: input.parserVersion,
      sourceId: stableConvergenceId('legacy-source', input.legacyJobId, input.sourceUrl),
      lifecycle: LegacyCompatibilityAdapter.LIFECYCLE,
      observedAt: input.adaptedAt,
    });
    const evidence = rawEvidence({
      kind: input.rawRetained ? 'remote_raw' : 'none',
      sourceId: source.sourceId,
      rawDocumentId: input.rawDocumentId,
      contentHash: input.rawContentHash,
      locator: input.sourceUrl,
      retained: input.rawRetained ?? false,
    });
    const entityKey = input.applicationId ?? `legacy-job:${input.legacyJobId}`;
    const fieldMap: Record<string, string> = {
      universityName: 'university_name',
      courseName: 'programme_name',
      degreeLevel: 'degree_level',
      subject: 'subject',
      studyMode: 'delivery_mode',
      intake: 'intake',
      country: 'country',
      deadline: 'deadline',
      tuitionFeeText: 'tuition',
      entryRequirements: 'admission_requirements',
      englishRequirements: 'english_requirement',
      summary: 'summary',
    };
    const assertions = Object.entries(fieldMap).flatMap(([legacyField, field]) => {
      const value = course[legacyField];
      return value == null || value === ''
        ? []
        : [assertion(source, evidence, {
            entityType: 'programme',
            entityKey,
            field,
            value,
            originalValue: value,
            legacyJobId: input.legacyJobId,
            adaptationTimestamp: input.adaptedAt ?? new Date().toISOString(),
            entitySource: input.sourceUrl,
            epistemic: 'DERIVED',
          })];
    });
    return envelope({
      source,
      rawEvidence: evidence,
      ingestionId: stableConvergenceId('legacy-ingestion', input.legacyJobId),
      assertions,
      identityHint: {
        entityType: 'programme',
        institutionId: null,
        programmeCode: clean(course.applicationCode),
        providerId: null,
        nationalId: null,
        accreditorId: null,
        name: clean(course.courseName),
        credential: clean(course.degreeLevel),
        degreeLevel: clean(course.degreeLevel),
        country: clean(course.country),
      },
      provenanceLimitations: input.rawRetained ? [] : ['RAW_EVIDENCE_NOT_RETAINED', 'LEGACY_PARSER_OUTPUT_ONLY'],
    });
  }
}

export class ManualSourceAdapter {
  static readonly VERSION = MANUAL_SOURCE_ADAPTER_VERSION;

  static describe(input: {
    sourceUrl: string;
    universityId?: string | number | null;
    sourceOwner?: string | null;
    submittedAt?: string;
  }): IngestionEnvelope {
    const source = sourceMetadata({
      adapter: 'manual_url',
      adapterVersion: ManualSourceAdapter.VERSION,
      sourcePath: 'src/app/api/applications/from-course-url/route.ts',
      sourceUrl: input.sourceUrl,
      sourceOwner: input.sourceOwner,
      observedAt: input.submittedAt,
      lifecycle: 'SHADOWED',
    });
    const evidence = rawEvidence({
      kind: 'none',
      sourceId: source.sourceId,
      locator: input.sourceUrl,
      retained: false,
      limitation: 'AWAITING_SLICE_B_RAW_PERSISTENCE',
    });
    const intentId = stableConvergenceId('manual-acquisition-intent', input.sourceUrl, input.universityId);
    const intent: AcquisitionIntentDescriptor = {
      intentId,
      sourceClass: 'official_programme',
      locator: input.sourceUrl,
      fieldScope: ['identity', 'academics', 'admissions', 'language', 'finance', 'deadline_intake'],
      requiresRawPersistence: true,
      directFetchOwner: 'slice_b',
      fingerprint: stableConvergenceId('manual-intent', input.sourceUrl, input.universityId),
    };
    return envelope({
      source,
      rawEvidence: evidence,
      ingestionId: stableConvergenceId('manual-ingestion', input.sourceUrl, input.universityId),
      assertions: [],
      identityHint: {
        entityType: 'programme',
        institutionId: input.universityId ?? null,
        programmeCode: null,
        providerId: null,
        nationalId: null,
        accreditorId: null,
        name: null,
        credential: null,
        degreeLevel: null,
        country: null,
      },
      acquisitionIntent: intent,
      provenanceLimitations: ['RAW_EVIDENCE_PENDING'],
    });
  }
}

export interface ProgrammeCsvRow {
  'University Name': string;
  'Program Name': string;
  Degree: string;
  'Program Link': string;
  'School / College'?: string;
  Department?: string;
  Country?: string;
  Duration?: string;
  [key: string]: unknown;
}

export class ProgrammeCsvAdapter {
  static readonly VERSION = STRUCTURED_SOURCE_ADAPTER_VERSION;

  static adaptRow(input: {
    row: ProgrammeCsvRow;
    fileId: string;
    fileHash: string;
    rowNumber: number;
    sourceOwner?: string | null;
    importerVersion?: string;
    importedAt?: string;
  }): IngestionEnvelope {
    const row = input.row;
    const source = sourceMetadata({
      adapter: 'programme_csv',
      adapterVersion: input.importerVersion ?? ProgrammeCsvAdapter.VERSION,
      sourcePath: 'scripts/import-university-programs-csv.mjs',
      sourceUrl: clean(row['Program Link']),
      sourceOwner: input.sourceOwner,
      fileId: input.fileId,
      fileHash: input.fileHash,
      rowLocator: `row:${input.rowNumber}`,
      observedAt: input.importedAt,
      lifecycle: 'SHADOWED',
    });
    const evidence = rawEvidence({
      kind: 'structured_file',
      sourceId: source.sourceId,
      locator: `file:${input.fileId}#row=${input.rowNumber}`,
      contentHash: input.fileHash,
      retained: true,
      limitation: null,
    });
    const entityKey = stableConvergenceId(
      'programme-csv-entity',
      row['University Name'],
      row['Program Name'],
      row.Degree,
      row['Program Link'],
    );
    const fields: Array<[string, unknown]> = [
      ['programme_name', row['Program Name']],
      ['credential', row.Degree],
      ['official_url', row['Program Link']],
      ['academic_unit', row['School / College'] ?? row.Department ?? null],
      ['country', row.Country ?? null],
      ['duration', row.Duration ?? null],
    ];
    const assertions = fields.flatMap(([field, value]) => value == null || value === '' ? [] : [assertion(source, evidence, {
      entityType: 'programme',
      entityKey,
      field,
      value,
      originalValue: value,
      academicCycle: clean(row['Academic Cycle']),
    })]);
    return envelope({
      source,
      rawEvidence: evidence,
      ingestionId: stableConvergenceId('programme-csv-ingestion', input.fileHash, input.rowNumber),
      assertions,
      identityHint: {
        entityType: 'programme',
        institutionId: null,
        programmeCode: clean(row['Programme Code']),
        providerId: clean(row['Provider Programme ID']),
        nationalId: null,
        accreditorId: null,
        name: clean(row['Program Name']),
        credential: clean(row.Degree),
        degreeLevel: clean(row.Degree),
        country: clean(row.Country),
      },
    });
  }
}

export type ScholarshipTemporalState =
  | 'ACTIVE'
  | 'UPCOMING'
  | 'EXPIRED_BUT_RECURRING'
  | 'EXPIRED_HISTORICAL'
  | 'DISCONTINUED'
  | 'UNKNOWN';

export type ScholarshipIdentityDecision = 'RESOLVED' | 'CREATED' | 'REVIEW_REQUIRED' | 'UNMATCHED';
export type ScholarshipMappingState = 'CONFIRMED' | 'CURATED' | 'PROPOSED' | 'UNRESOLVED';
export type ScholarshipMappingMethod = 'EXPLICIT_SOURCE' | 'CURATOR' | 'EXACT_PROVIDER_NAME_CYCLE' | 'FUZZY_CANDIDATE' | 'NONE';

export interface ScholarshipObservation {
  providerId?: string | null;
  schemeId?: string | null;
  providerName?: string | null;
  name: string;
  academicCycle?: string | null;
  sourceUrl?: string | null;
  sourceAssertionIds?: string[];
  rawDocumentId?: string | null;
  explicitStatus?: ScholarshipTemporalState | null;
  recurrenceObserved?: boolean;
}

export interface ScholarshipIdentity {
  scholarshipId: string;
  providerId: string | null;
  schemeId: string | null;
  providerName: string | null;
  canonicalName: string;
  academicCycle: string | null;
  decision: ScholarshipIdentityDecision;
  method: ScholarshipMappingMethod;
  supportingAssertionIds: string[];
}

export interface ScholarshipMapping {
  mappingId: string;
  scholarshipId: string;
  universityId: string | number | null;
  relationshipType: 'ELIGIBLE_AT' | 'PROVIDED_BY' | 'PARTNER';
  state: ScholarshipMappingState;
  method: ScholarshipMappingMethod;
  evidence: string | null;
  supportingAssertionIds: string[];
  confirmed: boolean;
  reviewRequired: boolean;
}

export function scholarshipTemporalState(input: {
  explicitStatus?: ScholarshipTemporalState | null;
  currentCycle?: string | null;
  observedCycle?: string | null;
  recurrenceObserved?: boolean;
  discontinued?: boolean;
  inferred?: boolean;
}): ScholarshipTemporalState {
  if (input.discontinued) return 'DISCONTINUED';
  if (input.explicitStatus && !input.inferred) return input.explicitStatus;
  // An inference is never allowed to manufacture a current ACTIVE state.
  // Recurrence is advisory even when the projected cycle matches the target.
  if (input.inferred) {
    return input.recurrenceObserved ? 'EXPIRED_BUT_RECURRING' : 'EXPIRED_HISTORICAL';
  }
  if (input.currentCycle && input.observedCycle && input.currentCycle === input.observedCycle) return 'ACTIVE';
  if (input.observedCycle) return 'EXPIRED_HISTORICAL';
  return 'UNKNOWN';
}

export class ScholarshipIdentityResolver {
  static resolve(observation: ScholarshipObservation, existing: ScholarshipIdentity[] = []): ScholarshipIdentity {
    const providerId = clean(observation.providerId);
    const schemeId = clean(observation.schemeId);
    const providerName = clean(observation.providerName);
    const name = clean(observation.name) ?? '';
    const cycle = clean(observation.academicCycle);
    const support = [...new Set(observation.sourceAssertionIds ?? [])];
    const byStrongId = existing.filter((item) =>
      (schemeId && item.schemeId === schemeId) || (providerId && item.providerId === providerId),
    );
    if (byStrongId.length === 1) {
      return { ...byStrongId[0], decision: 'RESOLVED', method: 'EXACT_PROVIDER_NAME_CYCLE', supportingAssertionIds: support };
    }
    if (byStrongId.length > 1) {
      return {
        scholarshipId: stableConvergenceId('scholarship-review', providerId, schemeId, name, cycle),
        providerId, schemeId, providerName, canonicalName: name, academicCycle: cycle,
        decision: 'REVIEW_REQUIRED', method: 'NONE', supportingAssertionIds: support,
      };
    }
    const exact = existing.filter((item) =>
      providerName && item.providerName === providerName && item.canonicalName === name && cycle && item.academicCycle === cycle,
    );
    if (exact.length === 1) return { ...exact[0], decision: 'RESOLVED', method: 'EXACT_PROVIDER_NAME_CYCLE', supportingAssertionIds: support };
    if (exact.length > 1 || (!providerId && !schemeId && (!providerName || !cycle))) {
      return {
        scholarshipId: stableConvergenceId('scholarship-review', providerId, schemeId, providerName, name, cycle),
        providerId, schemeId, providerName, canonicalName: name, academicCycle: cycle,
        decision: 'REVIEW_REQUIRED', method: 'NONE', supportingAssertionIds: support,
      };
    }
    return {
      scholarshipId: stableConvergenceId('scholarship', schemeId ?? providerId ?? providerName, name, cycle),
      providerId, schemeId, providerName, canonicalName: name, academicCycle: cycle,
      decision: 'CREATED', method: schemeId || providerId ? 'EXACT_PROVIDER_NAME_CYCLE' : 'NONE',
      supportingAssertionIds: support,
    };
  }
}

export class ScholarshipSourceAdapter {
  static readonly VERSION = SCHOLARSHIP_SOURCE_ADAPTER_VERSION;

  static adaptRecord(input: {
    record: Record<string, unknown>;
    fileId?: string | null;
    fileHash?: string | null;
    rowNumber?: number | null;
    sourcePath?: string;
    sourceOwner?: string | null;
    importedAt?: string;
  }): IngestionEnvelope {
    const record = input.record;
    const name = clean(record.name ?? record.scholarship_name) ?? '';
    const sourceUrl = clean(record.source_url ?? record.sourceUrl);
    const rowLocator = input.rowNumber == null ? null : `row:${input.rowNumber}`;
    const source = sourceMetadata({
      adapter: 'scholarship_csv',
      adapterVersion: ScholarshipSourceAdapter.VERSION,
      sourcePath: input.sourcePath ?? 'scripts/seed-scholarships.mjs',
      sourceUrl,
      sourceOwner: input.sourceOwner,
      fileId: input.fileId ?? null,
      fileHash: input.fileHash ?? null,
      rowLocator,
      observedAt: input.importedAt,
      lifecycle: 'SHADOWED',
    });
    const evidence = rawEvidence({
      kind: input.fileId ? 'structured_file' : 'structured_record',
      sourceId: source.sourceId,
      locator: input.fileId ? `file:${input.fileId}#${rowLocator ?? 'record'}` : sourceUrl,
      contentHash: input.fileHash ?? null,
      retained: true,
      limitation: null,
    });
    const entityKey = stableConvergenceId('scholarship-source', record.provider_id, record.scheme_id, name, record.academic_cycle);
    const fields: Array<[string, unknown]> = [
      ['scholarship_name', name],
      ['amount', record.amount ?? record.coverage ?? null],
      ['deadline', record.deadline ?? record.deadline_date ?? null],
      ['eligibility', record.eligibility ?? null],
      ['availability', record.status ?? null],
      ['number_of_awards', record.slots ?? null],
    ];
    const assertions = fields.flatMap(([field, value]) => value == null || value === '' ? [] : [assertion(source, evidence, {
      entityType: 'scholarship', entityKey, field, value, originalValue: value,
      academicCycle: clean(record.academic_cycle),
      // A cycle label alone is not proof that the observation is current for
      // the caller's target cycle; Slice C performs that applicability check.
      temporal: 'UNKNOWN',
    })]);
    return envelope({
      source,
      rawEvidence: evidence,
      ingestionId: stableConvergenceId('scholarship-ingestion', input.fileHash, input.rowNumber, name),
      assertions,
      identityHint: {
        entityType: 'scholarship',
        institutionId: null,
        programmeCode: null,
        providerId: clean(record.provider_id),
        nationalId: clean(record.scheme_id),
        accreditorId: null,
        name,
        credential: null,
        degreeLevel: clean(record.degree),
        country: clean(record.country),
      },
    });
  }
}

export function classifyScholarshipMapping(input: {
  scholarshipId: string;
  universityId: string | number | null;
  explicitRelationship: boolean;
  curated: boolean;
  candidateMethod?: 'exact' | 'fuzzy' | 'none';
  evidence?: string | null;
  supportingAssertionIds?: string[];
}): ScholarshipMapping {
  const support = [...new Set(input.supportingAssertionIds ?? [])];
  const explicit = input.explicitRelationship && Boolean(input.evidence) && input.universityId != null;
  const curated = input.curated && Boolean(input.evidence) && input.universityId != null;
  const method: ScholarshipMappingMethod = explicit
    ? 'EXPLICIT_SOURCE'
    : curated
      ? 'CURATOR'
      : input.candidateMethod === 'exact'
        ? 'EXACT_PROVIDER_NAME_CYCLE'
        : input.candidateMethod === 'fuzzy'
          ? 'FUZZY_CANDIDATE'
          : 'NONE';
  const state: ScholarshipMappingState = explicit ? 'CONFIRMED' : curated ? 'CURATED' : input.candidateMethod === 'none' ? 'UNRESOLVED' : 'PROPOSED';
  return {
    mappingId: stableConvergenceId('scholarship-mapping', input.scholarshipId, input.universityId, method),
    scholarshipId: input.scholarshipId,
    universityId: input.universityId,
    relationshipType: 'ELIGIBLE_AT',
    state,
    method,
    evidence: input.evidence ?? null,
    supportingAssertionIds: support,
    confirmed: state === 'CONFIRMED' || state === 'CURATED',
    reviewRequired: state === 'PROPOSED' || state === 'UNRESOLVED',
  };
}

export class DirectWriteGuard {
  static decide(request: DirectWriteRequest): DirectWriteDecision {
    if (request.purpose === 'v3_promotion' || request.purpose === 'curator_override' || request.purpose === 'admin_repair' || request.purpose === 'migration') {
      if (request.purpose === 'v3_promotion' && request.contractPassed !== true) {
        return { disposition: 'BLOCKED', purpose: request.purpose, sourcePath: request.sourcePath, requiresV3Parity: true, reason: 'PRODUCT_SAFETY_CONTRACT_REQUIRED' };
      }
      return { disposition: 'ALLOWED_PRIVILEGED', purpose: request.purpose, sourcePath: request.sourcePath, requiresV3Parity: false, reason: request.reason ?? 'explicit_privileged_path' };
    }
    if (
      (request.purpose === 'legacy_compatibility' || request.purpose === 'scholarship_etl')
      && request.explicitCompatibility === true
    ) {
      return { disposition: 'ALLOWED_COMPATIBILITY', purpose: request.purpose, sourcePath: request.sourcePath, requiresV3Parity: true, reason: 'legacy_behavior_preserved_and_shadowed' };
    }
    return { disposition: 'BLOCKED', purpose: request.purpose, sourcePath: request.sourcePath, requiresV3Parity: true, reason: 'NORMAL_INGESTION_MUST_USE_PROMOTION_V3' };
  }

  static assertAllowed(request: DirectWriteRequest): DirectWriteDecision {
    const decision = DirectWriteGuard.decide(request);
    if (decision.disposition === 'BLOCKED') {
      throw new Error(`${decision.reason}: ${request.sourcePath}`);
    }
    return decision;
  }
}

export class ConvergenceAuditStore {
  #records: WriteAuditRecord[] = [];

  append(record: Omit<WriteAuditRecord, 'auditId' | 'recordedAt'> & { auditId?: string; recordedAt?: string }): WriteAuditRecord {
    const next: WriteAuditRecord = Object.freeze({
      ...record,
      auditId: record.auditId ?? stableConvergenceId('write-audit', record.sourcePath, record.promotionId, this.#records.length),
      recordedAt: record.recordedAt ?? new Date().toISOString(),
    });
    this.#records.push(next);
    return next;
  }

  list(): readonly WriteAuditRecord[] {
    return this.#records.map((record) => ({ ...record }));
  }

  metrics(): Record<string, number> {
    return this.#records.reduce<Record<string, number>>((result, record) => {
      const key = `${record.adapter}:${record.disposition}`;
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {});
  }
}

export function buildDifferentialReport(input: {
  sourcePath: string;
  adapter: IngestionAdapterId;
  legacyOutput: Record<string, unknown>;
  envelope: IngestionEnvelope;
  identityDecision: string;
  qualityState: string;
  promotionEligible: boolean;
  blockingReasons?: string[];
}): DifferentialReport {
  const assertionFields = [...new Set(input.envelope.assertions.map((item) => item.field))].sort();
  const legacyFields = Object.keys(input.legacyOutput).filter((field) => input.legacyOutput[field] != null);
  const differences = legacyFields.filter((field) => !assertionFields.includes(field));
  if (input.envelope.provenanceLimitations.length > 0) differences.push('provenance_limitation');
  return {
    reportId: stableConvergenceId('differential', input.sourcePath, input.envelope.ingestionId),
    sourcePath: input.sourcePath,
    adapter: input.adapter,
    legacyOutput: { ...input.legacyOutput },
    v3AssertionFields: assertionFields,
    identityDecision: input.identityDecision,
    qualityState: input.qualityState,
    promotionEligible: input.promotionEligible,
    differences: [...new Set(differences)],
    blockingReasons: [...new Set(input.blockingReasons ?? [])],
    generatedAt: new Date().toISOString(),
  };
}
