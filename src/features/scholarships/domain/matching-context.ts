import type {
  BenefitAmount,
  BenefitComponent,
  BenefitConfidence,
  BenefitCurrencyStatus,
  NormalizedScholarshipBenefits,
} from './benefit-types';
import type { DurationValue } from './duration';
import type { ValuationPeriod } from './valuation';
import {
  buildScholarshipValuationContexts,
  type ScholarshipValuationContext,
} from './valuation-context';

/** Bump when the shape or meaning of the canonical matching context changes. */
export const SCHOLARSHIP_MATCHING_CONTEXT_VERSION = 'scholarship-matching-context-v2';

export type MatchingSourceKind =
  | 'student-profile'
  | 'student-achievement'
  | 'student-activity'
  | 'english-test'
  | 'standardized-test'
  | 'saved-university'
  | 'application'
  | 'programme'
  | 'university'
  | 'scholarship-catalogue';

export type MatchingProvenance = {
  sourceKind: MatchingSourceKind;
  recordId: string | null;
  sourceUrl: string | null;
  sourceField: string | null;
  retrievedAt: string | null;
};

export type MatchingReadStatus = 'present' | 'missing' | 'unavailable';

export type MatchingContextDiagnostic = {
  source: MatchingSourceKind | 'context-loader';
  status: MatchingReadStatus | 'invalid-selection';
  message: string;
};

export type MatchingRead<T> = {
  value: T | null;
  status: MatchingReadStatus;
  message: string | null;
};

export type MatchingAcademicEvidence = {
  achievements: readonly AcademicAchievementSource[] | null;
  activities: readonly AcademicActivitySource[] | null;
  englishTests: readonly EnglishTestSource[] | null;
  standardizedTests: readonly StandardizedTestSource[] | null;
};

export type AcademicAchievementSource = {
  id: string;
  title: string;
  category: string | null;
  level: string | null;
  year: string | null;
  detail: string | null;
  source: MatchingProvenance;
};

export type AcademicActivitySource = {
  id: string;
  title: string;
  category: string | null;
  level: string | null;
  period: string | null;
  description: string | null;
  source: MatchingProvenance;
};

export type EnglishTestSource = {
  id: string;
  testType: string;
  overallScore: number | null;
  source: MatchingProvenance;
};

export type StandardizedTestSource = {
  id: string;
  testType: string;
  score: string | null;
  source: MatchingProvenance;
};

export type MatchingProfileSource = {
  id: string | null;
  profileVersion: string | null;
  nationality: string | null;
  preferredCountries: readonly string[] | null;
  targetSubjects: readonly string[] | null;
  studyLevel: string | null;
  budgetRange: string | null;
  tuitionBudgetUsd: string | null;
  fundingPreference: string | null;
  targetIntake: string | null;
  applicationCycleYear: number | null;
  preferredCities: readonly string[] | null;
  studyMode: string | null;
  academicBackground: string | null;
  currentQualification: string | null;
  gradesSummary: unknown;
  curriculumGrades: unknown;
  gpaScale: string | null;
  gpaValue: number | null;
  predictedGrades: string | null;
  postgraduateAcademic: unknown;
  phdAcademic: unknown;
  careerInterests: readonly string[] | null;
  campusPreferences: string | null;
  source: MatchingProvenance;
};

export type MatchingUniversitySource = {
  id: number;
  name: string | null;
  country: string | null;
  city: string | null;
  type: string | null;
  tuitionText: string | null;
  livingCostText: string | null;
  housingText: string | null;
  source: MatchingProvenance;
};

export type SavedUniversitySource = {
  id: string | null;
  universityId: number;
  status: string | null;
  addedAt: string | null;
  updatedAt: string | null;
  university: MatchingUniversitySource | null;
  source: MatchingProvenance;
};

export type MatchingApplicationSource = {
  id: string;
  courseId: string | null;
  universityId: number | null;
  universityName: string | null;
  courseName: string | null;
  courseUrl: string | null;
  degreeLevel: string | null;
  subject: string | null;
  studyMode: string | null;
  intake: string | null;
  country: string | null;
  deadline: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: MatchingProvenance;
};

export type MatchingProgrammeSource = {
  id: string;
  universityId: number | null;
  universityName: string | null;
  name: string | null;
  degreeLevel: string | null;
  subject: string | null;
  studyMode: string | null;
  intake: string | null;
  country: string | null;
  city: string | null;
  durationText: string | null;
  duration: DurationValue | null;
  tuitionText: string | null;
  tuitionAmount: BenefitAmount | null;
  tuitionPeriod: ValuationPeriod;
  source: MatchingProvenance;
};

export type MatchingScholarshipSource = {
  id: number;
  name: string;
  scope: string;
  country: string | null;
  provider: string | null;
  fundingType: readonly string[];
  coverage: string | null;
  eligibility: string | null;
  appliesToText: string | null;
  conditions: string | null;
  deadline: string | null;
  sourceUrl: string | null;
  raw: Record<string, unknown>;
  universityIds: readonly number[];
  universityCountries: readonly string[];
  normalizedBenefits: NormalizedScholarshipBenefits;
  /** Candidate-owned alternatives; student selection is not stored here. */
  valuationContexts?: readonly ScholarshipValuationContext[];
  source: MatchingProvenance;
};

export type MatchingContextSources = {
  profile: MatchingRead<MatchingProfileSource>;
  evidence: MatchingRead<MatchingAcademicEvidence>;
  savedUniversities: MatchingRead<readonly SavedUniversitySource[]>;
  applications: MatchingRead<readonly MatchingApplicationSource[]>;
  programmes: MatchingRead<readonly MatchingProgrammeSource[]>;
  universities: MatchingRead<readonly MatchingUniversitySource[]>;
  scholarships: MatchingRead<readonly MatchingScholarshipSource[]>;
  diagnostics?: readonly MatchingContextDiagnostic[];
};

export type MatchingContextRequest = {
  userId: string;
  scholarshipIds?: readonly number[];
  applicationId?: string | null;
  selectedProgrammeId?: string | null;
  selectedUniversityId?: number | null;
};

export type MatchingStudentContext = {
  userId: string;
  profileId: string | null;
  profileVersion: string | null;
  nationality: string | null;
  preferredCountries: readonly string[] | null;
  targetSubjects: readonly string[] | null;
  studyLevel: string | null;
  budgetRange: string | null;
  tuitionBudgetUsd: string | null;
  fundingPreference: string | null;
  targetIntake: string | null;
  applicationCycleYear: number | null;
  preferredCities: readonly string[] | null;
  studyMode: string | null;
  academicBackground: string | null;
  currentQualification: string | null;
  gradesSummary: unknown;
  curriculumGrades: unknown;
  gpaScale: string | null;
  gpaValue: number | null;
  predictedGrades: string | null;
  postgraduateAcademic: unknown;
  phdAcademic: unknown;
  careerInterests: readonly string[] | null;
  campusPreferences: string | null;
};

export type MatchingUniversityContext = MatchingUniversitySource;

export type MatchingApplicationContext = MatchingApplicationSource;

export type MatchingProgrammeContext = MatchingProgrammeSource;

export type MatchingSavedUniversityContext = SavedUniversitySource;

export type MatchingScholarshipContext = MatchingScholarshipSource & {
  /** Normalized facts are carried once; downstream valuation must not reparse raw prose. */
  benefits: readonly BenefitComponent[];
  valuationContexts?: readonly ScholarshipValuationContext[] | undefined;
};

export type ScholarshipMatchingContext = {
  contextVersion: typeof SCHOLARSHIP_MATCHING_CONTEXT_VERSION;
  cache: {
    scope: 'user';
    key: string;
    userId: string;
    profileVersion: string | null;
  };
  student: MatchingStudentContext;
  academicEvidence: MatchingAcademicEvidence;
  savedUniversities: readonly MatchingSavedUniversityContext[] | null;
  selection: {
    requestedApplicationId: string | null;
    requestedProgrammeId: string | null;
    requestedUniversityId: number | null;
    application: MatchingApplicationContext | null;
    programme: MatchingProgrammeContext | null;
    university: MatchingUniversityContext | null;
  };
  scholarships: readonly MatchingScholarshipContext[];
  sourceStatus: {
    profile: MatchingReadStatus;
    evidence: MatchingReadStatus;
    savedUniversities: MatchingReadStatus;
    applications: MatchingReadStatus;
    programmes: MatchingReadStatus;
    universities: MatchingReadStatus;
    scholarships: MatchingReadStatus;
  };
  diagnostics: readonly MatchingContextDiagnostic[];
};

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringList(value: readonly string[] | null | undefined): readonly string[] | null {
  if (value == null) return null;
  const cleaned: string[] = [];
  for (const item of value) {
    const normalized = cleanString(item);
    if (normalized && !cleaned.includes(normalized)) cleaned.push(normalized);
  }
  return cleaned;
}

function profileContext(profile: MatchingProfileSource | null, userId: string): MatchingStudentContext {
  return {
    userId,
    profileId: profile?.id ?? null,
    profileVersion: profile?.profileVersion ?? null,
    nationality: profile?.nationality ?? null,
    preferredCountries: cleanStringList(profile?.preferredCountries),
    targetSubjects: cleanStringList(profile?.targetSubjects),
    studyLevel: profile?.studyLevel ?? null,
    budgetRange: profile?.budgetRange ?? null,
    tuitionBudgetUsd: profile?.tuitionBudgetUsd ?? null,
    fundingPreference: profile?.fundingPreference ?? null,
    targetIntake: profile?.targetIntake ?? null,
    applicationCycleYear: profile?.applicationCycleYear ?? null,
    preferredCities: cleanStringList(profile?.preferredCities),
    studyMode: profile?.studyMode ?? null,
    academicBackground: profile?.academicBackground ?? null,
    currentQualification: profile?.currentQualification ?? null,
    gradesSummary: profile?.gradesSummary ?? null,
    curriculumGrades: profile?.curriculumGrades ?? null,
    gpaScale: profile?.gpaScale ?? null,
    gpaValue: profile?.gpaValue ?? null,
    predictedGrades: profile?.predictedGrades ?? null,
    postgraduateAcademic: profile?.postgraduateAcademic ?? null,
    phdAcademic: profile?.phdAcademic ?? null,
    careerInterests: cleanStringList(profile?.careerInterests),
    campusPreferences: profile?.campusPreferences ?? null,
  };
}

function applicationAsProgramme(application: MatchingApplicationSource): MatchingProgrammeContext | null {
  if (!application.courseId && !application.courseName) return null;
  return {
    id: application.courseId ?? `application:${application.id}`,
    universityId: application.universityId,
    universityName: application.universityName,
    name: application.courseName,
    degreeLevel: application.degreeLevel,
    subject: application.subject,
    studyMode: application.studyMode,
    intake: application.intake,
    country: application.country,
    city: null,
    durationText: null,
    duration: null,
    tuitionText: null,
    tuitionAmount: null,
    tuitionPeriod: 'unspecified',
    source: application.source,
  };
}

function selectedApplication(
  request: MatchingContextRequest,
  applications: readonly MatchingApplicationSource[],
): MatchingApplicationSource | null {
  if (request.applicationId) {
    return applications.find((application) => application.id === request.applicationId) ?? null;
  }
  if (request.selectedProgrammeId) {
    return applications.find((application) => application.courseId === request.selectedProgrammeId) ?? null;
  }
  return null;
}

function selectedProgramme(
  request: MatchingContextRequest,
  application: MatchingApplicationSource | null,
  programmes: readonly MatchingProgrammeSource[],
): MatchingProgrammeContext | null {
  const requestedId = cleanString(request.selectedProgrammeId);
  if (requestedId) {
    return programmes.find((programme) => programme.id === requestedId) ?? null;
  }

  const applicationProgramme = application?.courseId
    ? programmes.find((programme) => programme.id === application.courseId)
    : undefined;
  return applicationProgramme ?? (application ? applicationAsProgramme(application) : null);
}

function applicationFallbackUniversity(
  application: MatchingApplicationSource | null,
  programme: MatchingProgrammeContext | null,
): MatchingUniversityContext | null {
  const universityId = programme?.universityId ?? application?.universityId ?? null;
  if (universityId == null) return null;
  return {
    id: universityId,
    name: programme?.universityName ?? application?.universityName ?? null,
    country: programme?.country ?? application?.country ?? null,
    city: programme?.city ?? null,
    type: null,
    tuitionText: null,
    livingCostText: null,
    housingText: null,
    source: programme?.source ?? application?.source ?? {
      sourceKind: 'application',
      recordId: application?.id ?? null,
      sourceUrl: null,
      sourceField: null,
      retrievedAt: null,
    },
  };
}

function selectedUniversity(
  request: MatchingContextRequest,
  application: MatchingApplicationSource | null,
  programme: MatchingProgrammeContext | null,
  universities: readonly MatchingUniversitySource[],
): MatchingUniversityContext | null {
  const requestedId = request.selectedUniversityId ?? null;
  if (requestedId != null) return universities.find((university) => university.id === requestedId) ?? null;

  const selectedId = programme?.universityId ?? application?.universityId ?? null;
  if (selectedId == null) return null;
  return universities.find((university) => university.id === selectedId)
    ?? applicationFallbackUniversity(application, programme);
}

function normalizeCachePart(value: string | number | null): string {
  return value == null ? '-' : String(value);
}

/**
 * User-specific cache identity. The loader intentionally does not put this
 * context in a public catalogue cache; callers that add a private cache must
 * use this key, including the user and profile version.
 */
export function scholarshipMatchingContextCacheKey(request: MatchingContextRequest, profileVersion: string | null): string {
  const scholarshipIds = [...new Set((request.scholarshipIds ?? []).filter(Number.isFinite))].sort((a, b) => a - b);
  return [
    SCHOLARSHIP_MATCHING_CONTEXT_VERSION,
    normalizeCachePart(request.userId),
    normalizeCachePart(profileVersion),
    normalizeCachePart(request.applicationId ?? null),
    normalizeCachePart(request.selectedProgrammeId ?? null),
    normalizeCachePart(request.selectedUniversityId ?? null),
    scholarshipIds.join(','),
  ].join('|');
}

function diagnosticForSelection(
  request: MatchingContextRequest,
  application: MatchingApplicationSource | null,
  programme: MatchingProgrammeContext | null,
  university: MatchingUniversityContext | null,
): MatchingContextDiagnostic[] {
  const diagnostics: MatchingContextDiagnostic[] = [];
  if (request.applicationId && !application) {
    diagnostics.push({
      source: 'application',
      status: 'invalid-selection',
      message: 'The requested application was not found for this user.',
    });
  }
  if (request.selectedProgrammeId && !programme) {
    diagnostics.push({
      source: 'programme',
      status: 'invalid-selection',
      message: 'The requested programme was not found in the available catalogue.',
    });
  }
  if (request.selectedUniversityId != null && !university) {
    diagnostics.push({
      source: 'university',
      status: 'invalid-selection',
      message: 'The requested university was not found in the available catalogue.',
    });
  }
  return diagnostics;
}

function diagnosticForReads(sources: MatchingContextSources): MatchingContextDiagnostic[] {
  const reads: Array<{ source: MatchingContextDiagnostic['source']; read: MatchingRead<unknown> }> = [
    { source: 'student-profile', read: sources.profile },
    { source: 'context-loader', read: sources.evidence },
    { source: 'saved-university', read: sources.savedUniversities },
    { source: 'application', read: sources.applications },
    { source: 'programme', read: sources.programmes },
    { source: 'university', read: sources.universities },
    { source: 'scholarship-catalogue', read: sources.scholarships },
  ];
  return reads
    .filter(({ read }) => read.message !== null)
    .map(({ source, read }) => ({
      source,
      status: read.status,
      message: read.message!,
    }));
}

/**
 * Build the canonical matching context without I/O, scoring, eligibility, or
 * valuation. All missing values remain null; source adapters decide whether a
 * null means no row or an unavailable read and carry that status separately.
 */
export function buildScholarshipMatchingContext(
  request: MatchingContextRequest,
  sources: MatchingContextSources,
): ScholarshipMatchingContext {
  const profileVersion = sources.profile.value?.profileVersion ?? null;
  const application = selectedApplication(request, sources.applications.value ?? []);
  const programme = selectedProgramme(request, application, sources.programmes.value ?? []);
  const university = selectedUniversity(
    request,
    application,
    programme,
    sources.universities.value ?? [],
  );

  const scholarships = (sources.scholarships.value ?? [])
    .map((scholarship): MatchingScholarshipContext => ({
      ...scholarship,
      benefits: scholarship.normalizedBenefits.components,
      valuationContexts: scholarship.valuationContexts ?? buildScholarshipValuationContexts({
        scholarshipId: scholarship.id,
        scholarshipCountry: scholarship.country,
        universities: scholarship.universityIds.map((id) => ({
          id,
          // `universityCountries` is a filtered display list, so its indexes
          // are not a reliable join to `universityIds`. The loader normally
          // supplies full candidate contexts; this compatibility fallback must
          // prefer the scholarship's own country over assigning another
          // university's country to this candidate.
          country: scholarship.country,
        })),
      }),
    }))
    .sort((left, right) => left.id - right.id);

  return {
    contextVersion: SCHOLARSHIP_MATCHING_CONTEXT_VERSION,
    cache: {
      scope: 'user',
      key: scholarshipMatchingContextCacheKey(request, profileVersion),
      userId: request.userId,
      profileVersion,
    },
    student: profileContext(sources.profile.value, request.userId),
    academicEvidence: sources.evidence.value ?? {
      achievements: null,
      activities: null,
      englishTests: null,
      standardizedTests: null,
    },
    savedUniversities: sources.savedUniversities.value,
    selection: {
      requestedApplicationId: request.applicationId ?? null,
      requestedProgrammeId: request.selectedProgrammeId ?? null,
      requestedUniversityId: request.selectedUniversityId ?? null,
      application,
      programme,
      university,
    },
    scholarships,
    sourceStatus: {
      profile: sources.profile.status,
      evidence: sources.evidence.status,
      savedUniversities: sources.savedUniversities.status,
      applications: sources.applications.status,
      programmes: sources.programmes.status,
      universities: sources.universities.status,
      scholarships: sources.scholarships.status,
    },
    diagnostics: [
      ...(sources.diagnostics ?? []),
      ...diagnosticForReads(sources),
      ...diagnosticForSelection(request, application, programme, university),
    ].filter((diagnostic, index, diagnostics) =>
      diagnostics.findIndex((candidate) =>
        candidate.source === diagnostic.source &&
        candidate.status === diagnostic.status &&
        candidate.message === diagnostic.message,
      ) === index,
    ),
  };
}

export type { BenefitAmount, BenefitConfidence, BenefitCurrencyStatus };
