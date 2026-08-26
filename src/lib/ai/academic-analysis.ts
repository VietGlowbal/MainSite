import type { AcademicProfile, AcademicRecord } from './applicant-state/domain';

/** Re-export so consumers can model records without reaching into applicant-state. */
export type { AcademicRecord };

/**
 * Deterministic-first Academic Analyzer (Task 5).
 *
 * Emits EXACTLY one of four verdicts per requirement:
 *   meets | possibly_meets | does_not_meet | insufficient_information
 *
 * Hard rules (plan Task 5 Step 5):
 * - `meets` / `does_not_meet` ONLY for directly comparable values — same
 *   metric family and same (or both-absent) scale.
 * - `possibly_meets` for conditional/equivalence cases — recognisable metric
 *   but a different grading system (e.g. percentage vs GPA/4.0).
 * - `insufficient_information` whenever data is missing or incomparable —
 *   never a failure and never a zero.
 * - No arithmetic beyond direct comparison; AI may explain semantics
 *   elsewhere but performs no score math here.
 * - The output NEVER contains an admission probability.
 */

export type AcademicVerdict =
  | 'meets'
  | 'possibly_meets'
  | 'does_not_meet'
  | 'insufficient_information';

export interface AcademicRequirementSpec {
  id: string;
  label: string;
  /** Normalized metric family the requirement speaks in. */
  metric:
    | 'ielts'
    | 'toefl'
    | 'gpa'
    | 'sat'
    | 'act'
    | 'ib_points'
    | 'a_level'
    | 'percentage'
    | 'other';
  minValue?: number | null;
  maxValue?: number | null;
  scale?: number | null;
  sourceRefs?: string[];
}

export interface AcademicAssessmentItem {
  requirementId: string;
  requirementLabel: string;
  verdict: AcademicVerdict;
  rationale: string;
  matchedRecordId?: string | null;
  comparedOn?: {
    recordValue: number | null;
    recordScale: number | null;
    requirementValue: number | null;
    requirementScale: number | null;
  } | null;
}

/** Metric families a record's kind/testType can normalize to. */
function metricOf(record: AcademicRecord): AcademicRequirementSpec['metric'] | null {
  if (record.kind === 'gpa') return 'gpa';
  if (record.kind === 'grade_summary') {
    // A bare percentage summary is only comparable when its scale is 100.
    return record.scale === 100 ? 'percentage' : null;
  }
  const test = (record.testType ?? '').toLowerCase();
  if (/ielts/.test(test)) return 'ielts';
  if (/toefl/.test(test)) return 'toefl';
  if (/sat\b|sat total/.test(test)) return 'sat';
  if (/act\b/.test(test)) return 'act';
  if (/ib\b|diploma programme/.test(test)) return 'ib_points';
  if (/a-?level|gce/.test(test)) return 'a_level';
  if (/gpa/.test(test)) return 'gpa';
  return null;
}

/** Metrics whose scale is internationally fixed — a recorded scale is informational only. */
const FIXED_SCALE_METRICS = new Set(['ielts', 'toefl', 'sat', 'act']);

function directlyComparable(
  recordMetric: AcademicRequirementSpec['metric'],
  recordScale: number | null,
  requirement: AcademicRequirementSpec,
): boolean {
  if (recordMetric !== requirement.metric) return false;
  if (FIXED_SCALE_METRICS.has(requirement.metric)) return true;
  const reqScale = requirement.scale ?? null;
  // Same explicit scale, or neither side declares one.
  return (
    (recordScale !== null && reqScale !== null && Math.abs(recordScale - reqScale) < 1e-9) ||
    (recordScale === null && reqScale === null)
  );
}

export function assessAcademicRequirements(args: {
  records: AcademicRecord[] | AcademicProfile['records'];
  requirements: AcademicRequirementSpec[];
}): AcademicAssessmentItem[] {
  const records = args.records ?? [];

  return args.requirements.map((requirement) => {
    const base: Omit<AcademicAssessmentItem, 'verdict' | 'rationale'> = {
      requirementId: requirement.id,
      requirementLabel: requirement.label,
      matchedRecordId: null,
      comparedOn: null,
    };

    if (requirement.minValue == null && requirement.maxValue == null) {
      return { ...base, verdict: 'insufficient_information', rationale: 'The requirement states no numeric threshold.' };
    }

    const candidates = records
      .map((record) => ({ record, metric: metricOf(record) }))
      .filter(({ metric }) => metric !== null);

    const exact = candidates.find(({ record, metric }) =>
      directlyComparable(metric!, record.scale ?? null, requirement),
    );

    if (exact) {
      const { record } = exact;
      if (record.value == null) {
        return {
          ...base,
          matchedRecordId: record.id ?? null,
          verdict: 'insufficient_information',
          rationale: 'A matching record exists but carries no comparable numeric value.',
        };
      }
      const passesHigh = requirement.minValue == null || record.value >= requirement.minValue - 1e-9;
      const passesLow = requirement.maxValue == null || record.value <= requirement.maxValue + 1e-9;
      return {
        ...base,
        matchedRecordId: record.id ?? null,
        verdict: passesHigh && passesLow ? 'meets' : 'does_not_meet',
        rationale:
          passesHigh && passesLow
            ? `Direct comparison on ${requirement.metric}: ${record.value} against ${requirement.minValue ?? requirement.maxValue}.`
            : `Direct comparison on ${requirement.metric}: ${record.value} falls outside ${requirement.minValue ?? '-'}–${requirement.maxValue ?? '-'}.`,
        comparedOn: {
          recordValue: record.value,
          recordScale: record.scale ?? null,
          requirementValue: requirement.minValue ?? requirement.maxValue ?? null,
          requirementScale: requirement.scale ?? null,
        },
      };
    }

    // Recognisable metric family but a DIFFERENT explicit grading system →
    // equivalence case. If either side lacks an explicit scale the values are
    // simply incomparable — insufficient_information, never a guess.
    const convertible = candidates.find(({ metric }) => metric === requirement.metric);
    if (convertible) {
      if (convertible.record.scale == null || requirement.scale == null) {
        return {
          ...base,
          matchedRecordId: convertible.record.id ?? null,
          verdict: 'insufficient_information',
          rationale: `Matching ${requirement.metric} record exists but its grading scale is missing, so the value cannot be compared.`,
          comparedOn: {
            recordValue: convertible.record.value,
            recordScale: convertible.record.scale ?? null,
            requirementValue: requirement.minValue ?? requirement.maxValue ?? null,
            requirementScale: requirement.scale ?? null,
          },
        };
      }
      return {
        ...base,
        matchedRecordId: convertible.record.id ?? null,
        verdict: 'possibly_meets',
        rationale: `Same metric family (${requirement.metric}) recorded under a different grading system — ${convertible.record.scale}-scale vs ${requirement.scale}-scale. Equivalence not confirmed.`,
        comparedOn: {
          recordValue: convertible.record.value,
          recordScale: convertible.record.scale ?? null,
          requirementValue: requirement.minValue ?? requirement.maxValue ?? null,
          requirementScale: requirement.scale ?? null,
        },
      };
    }

    // Different system entirely (e.g. percentage vs GPA) may still be an
    // equivalence case worth surfacing softly when values exist.
    const otherWithValue = candidates.find(({ record }) => record.value != null);
    if (otherWithValue) {
      return {
        ...base,
        matchedRecordId: otherWithValue.record.id ?? null,
        verdict: 'possibly_meets',
        rationale: `Requirement uses ${requirement.metric}; the snapshot holds a different grading system (${otherWithValue.metric}). Equivalence not confirmed.`,
      };
    }

    return {
      ...base,
      verdict: 'insufficient_information',
      rationale: 'No academic record in this snapshot covers this requirement.',
    };
  });
}
