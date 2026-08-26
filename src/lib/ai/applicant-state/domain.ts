import type {
  ApplicantAIState as BaseApplicantAIState,
  StateMetadata,
} from '../runtime/ai-module';
import type { CandidateFollowUpAnswer } from '@/features/apply/api';

/**
 * The application-scoped ApplicantAIState contract (Task 5) — the working
 * state every analysis module of ONE application reads. Reconstructed ONLY
 * from a confirmed snapshot; never from live profile tables (see
 * `context-builder.ts` for the enforcement).
 *
 * Extends the runtime's structural base with the concrete member types this
 * milestone introduces.
 */

/** One normalized academic/test record frozen into the snapshot. */
export interface AcademicRecord {
  id?: string;
  kind: 'english_test' | 'standardized_test' | 'gpa' | 'grade_summary';
  testType?: string | null;
  value: number | null;
  scale?: number | null;
  raw: string | null;
}

export interface AcademicProfile {
  records: AcademicRecord[];
  gradesSummary?: string | null;
  curriculum?: string | null;
}

export interface ActivityAnalysisItem {
  id: string;
  title: string;
  category?: string | null;
  freeText: string | null;
  followUpAnswers?: CandidateFollowUpAnswer[];
}

export interface EvidenceBankItem {
  id: string;
  kind: 'achievement' | 'activity' | 'document' | 'profile' | 'follow_up';
  label: string;
  raw: unknown;
}

export interface DirectionSignals {
  intendedDirection?: string | null;
  academicDirection?: string | null;
  careerDirection?: string | null;
  preferredEnvironment?: string | null;
}

export interface IdentitySignals {
  interestsMotivations?: string[];
  valuesGrowth?: string[];
  problemDomains?: string[];
  capabilityOwnership?: string[];
}

export interface ApplicantAIState extends BaseApplicantAIState {
  academicProfile?: AcademicProfile;
  activities: ActivityAnalysisItem[];
  evidenceBank: EvidenceBankItem[];
  identitySignals?: IdentitySignals;
  directionSignals?: DirectionSignals;
  metadata: StateMetadata & { sourceFingerprints?: Record<string, string> };
}
