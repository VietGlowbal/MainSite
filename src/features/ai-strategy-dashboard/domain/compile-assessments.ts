import type { ApplicationRequirement } from '@/lib/apply-types';
import type { EvidenceItem } from '@/shared/evaluation/f3-evidence';
import type {
  DeadlineAuthority,
  MissingEvidenceItem,
  PlanningContext,
  PlanningGap,
  SourceDiagnostic,
  UserConstraint,
} from './planning-context';
import type {
  AssessmentEvidence,
  AssessmentKind,
  AssessmentProvenance,
  AssessmentResult,
  AssessmentSeverity,
  AssessmentSource,
  AssessmentStatus,
} from './assessment';

const KIND_ORDER: Record<AssessmentKind, number> = {
  requirement: 0,
  identified_gap: 1,
  evidence: 2,
  deadline: 3,
  constraint: 4,
  missing_information: 5,
};

const SEVERITY_ORDER: Record<AssessmentSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
};

const STATUS_ORDER: Record<AssessmentStatus, number> = {
  gap: 0,
  needs_attention: 1,
  unknown: 2,
  meets: 3,
};

/**
 * Compile deterministic, current-state findings from a normalized planning
 * context. This function performs no I/O and never proposes an action.
 */
export function compileAssessments(context: PlanningContext): AssessmentResult[] {
  return [
    ...assessRequirements(context),
    ...assessIdentifiedGaps(context),
    ...assessEvidence(context),
    ...assessDeadlines(context),
    ...assessConstraints(context),
    ...assessMissingInformation(context),
  ].sort(compareAssessments);
}

function assessRequirements(context: PlanningContext): AssessmentResult[] {
  const results: AssessmentResult[] = [];
  const represented = new Set<string>();

  for (const requirement of sortedById(context.programmeRequirements)) {
    represented.add(requirement.id);
    results.push(assessmentFromRequirement(requirement));
  }

  // The context keeps pre-classified views for downstream consumers. Use them
  // only as a fallback so an incomplete source list cannot hide a known gap,
  // while avoiding duplicate findings when it is complete.
  for (const gap of sortedById(context.requirementGaps, (item) => item.requirementId)) {
    if (!represented.has(gap.requirementId)) {
      results.push({
        id: `requirement:${gap.requirementId}`,
        kind: 'requirement',
        subject: requirementSubject(gap.title, gap.requirementText),
        currentState: gap.status,
        status: 'gap',
        severity: gap.isMandatory ? 'high' : 'medium',
        title: `Requirement gap: ${requirementSubject(gap.title, gap.requirementText)}`,
        summary: `${gap.isMandatory ? 'Mandatory' : 'Optional'} requirement is ${gap.status.replace('_', ' ')}.`,
        evidence: [requirementEvidence(gap)],
        source: requirementSource(gap.requirementId),
        decisionBasis: gap.isMandatory ? 'hard_constraint' : 'neutral',
        confidence: gap.confidence,
        mode: 'deterministic',
      });
    }
  }

  for (const unresolved of sortedById(context.unresolvedRequirements, (item) => item.requirementId)) {
    if (!represented.has(unresolved.requirementId)) {
      const status: AssessmentStatus = unresolved.status === 'needs_review' ? 'needs_attention' : 'unknown';
      results.push({
        id: `requirement:${unresolved.requirementId}`,
        kind: 'requirement',
        subject: requirementSubject(unresolved.title, unresolved.requirementText),
        currentState: unresolved.status,
        status,
        severity: unresolved.isMandatory ? 'medium' : 'low',
        title: `Requirement status unresolved: ${requirementSubject(unresolved.title, unresolved.requirementText)}`,
        summary: `The ${unresolved.isMandatory ? 'mandatory' : 'optional'} requirement has not been conclusively assessed.`,
        evidence: [requirementEvidence(unresolved)],
        source: requirementSource(unresolved.requirementId),
        decisionBasis: unresolved.isMandatory ? 'information_gap' : 'neutral',
        confidence: unresolved.confidence,
        mode: 'deterministic',
      });
    }
  }

  if (results.length === 0) {
    const diagnostic = diagnosticFor(context, 'application_requirements');
    results.push({
      id: 'requirements:availability',
      // Keep a missing requirement source with the other requirement findings
      // in the explicit output ordering; its source still records uncertainty.
      kind: 'requirement',
      subject: 'Programme requirements',
      currentState: diagnostic?.status ?? 'unknown',
      status: 'unknown',
      severity: diagnostic?.status === 'unavailable' || diagnostic?.status === 'invalid' ? 'high' : 'medium',
      title: 'Programme requirements are unavailable',
      summary: diagnostic?.message ?? 'No programme requirements are available to assess.',
      evidence: diagnostic ? [diagnosticEvidence(diagnostic)] : [],
      source: {
        kind: 'missing_information',
        sourceId: 'application_requirements',
        provenance: 'unknown',
      },
      decisionBasis: 'information_gap',
      confidence: null,
      mode: 'deterministic',
    });
  }

  return results;
}

function assessmentFromRequirement(requirement: ApplicationRequirement): AssessmentResult {
  const subject = requirementSubject(requirement.title ?? null, requirement.requirementText);
  const status = requirementStatus(requirement.studentStatus);

  return {
    id: `requirement:${requirement.id}`,
    kind: 'requirement',
    subject,
    currentState: requirement.studentStatus,
    status,
    severity: requirementSeverity(requirement.studentStatus, requirement.isMandatory),
    title: requirementTitle(status, subject),
    summary: requirementSummary(requirement.studentStatus, requirement.isMandatory),
    evidence: [requirementEvidence(requirement)],
    source: requirementSource(requirement.id),
    decisionBasis: requirementDecisionBasis(requirement),
    confidence: requirement.confidence,
    mode: 'deterministic',
  };
}

function requirementDecisionBasis(requirement: ApplicationRequirement): AssessmentResult['decisionBasis'] {
  if (!requirement.isMandatory) return 'neutral';
  return requirement.studentStatus === 'met' || requirement.studentStatus === 'not_met' || requirement.studentStatus === 'partially_met'
    ? 'hard_constraint'
    : 'information_gap';
}

function requirementStatus(status: ApplicationRequirement['studentStatus']): AssessmentStatus {
  switch (status) {
    case 'met':
      return 'meets';
    case 'not_met':
    case 'partially_met':
      return 'gap';
    case 'needs_review':
      return 'needs_attention';
    case 'unknown':
      return 'unknown';
  }
}

function requirementSeverity(
  status: ApplicationRequirement['studentStatus'],
  mandatory: boolean,
): AssessmentSeverity {
  if (status === 'not_met') return mandatory ? 'high' : 'medium';
  if (status === 'partially_met') return mandatory ? 'high' : 'medium';
  if (status === 'needs_review' || status === 'unknown') return mandatory ? 'medium' : 'low';
  return 'info';
}

function requirementTitle(status: AssessmentStatus, subject: string): string {
  if (status === 'meets') return `Requirement met: ${subject}`;
  if (status === 'gap') return `Requirement gap: ${subject}`;
  if (status === 'needs_attention') return `Requirement needs review: ${subject}`;
  return `Requirement status unknown: ${subject}`;
}

function requirementSummary(
  status: ApplicationRequirement['studentStatus'],
  mandatory: boolean,
): string {
  const prefix = mandatory ? 'Mandatory requirement' : 'Optional requirement';
  if (status === 'met') return `${prefix} is recorded as met.`;
  if (status === 'not_met') return `${prefix} is recorded as not met.`;
  if (status === 'partially_met') return `${prefix} is recorded as partially met.`;
  if (status === 'needs_review') return `${prefix} needs review before it can be assessed.`;
  return `${prefix} has not been assessed.`;
}

function requirementSubject(title: string | null | undefined, text: string): string {
  return title?.trim() || text;
}

function requirementSource(id: string): AssessmentSource {
  return { kind: 'requirement', sourceId: id, provenance: 'database_factual' };
}

function requirementEvidence(item: {
  requirementId?: string;
  id?: string;
  requirementText: string;
  sourceUrl?: string | null;
  sourceId?: string | null;
  confidence: number;
}): AssessmentEvidence {
  const id = item.requirementId ?? item.id ?? 'unknown';
  return {
    id: `requirement-evidence:${id}`,
    label: item.requirementText,
    detail: null,
    provenance: 'database_factual',
    sourceId: item.sourceId ?? id,
    sourceUrl: item.sourceUrl ?? null,
    confidence: item.confidence,
  };
}

function assessIdentifiedGaps(context: PlanningContext): AssessmentResult[] {
  return sortedById(context.identifiedGaps).map((gap) => {
    const provenance: AssessmentProvenance = gap.source.startsWith('f5_')
      ? 'ai_generated'
      : 'deterministically_derived';

    return {
      id: `identified-gap:${gap.id}`,
      kind: 'identified_gap',
      subject: gap.dimensionKey ?? 'Applicant profile',
      currentState: 'gap identified',
      status: 'needs_attention',
      severity: 'medium',
      title: 'Current profile gap identified',
      summary: gap.description,
      evidence: [planningGapEvidence(gap, provenance)],
      source: { kind: 'identified_gap', sourceId: gap.sourceAnalysisId, provenance },
      decisionBasis: 'soft_signal',
      confidence: null,
      mode: 'deterministic',
    };
  });
}

function planningGapEvidence(
  gap: PlanningGap,
  provenance: AssessmentProvenance,
): AssessmentEvidence {
  return {
    id: `planning-gap:${gap.id}`,
    label: gap.description,
    detail: gap.source,
    provenance,
    sourceId: gap.sourceAnalysisId,
    sourceUrl: null,
    confidence: null,
  };
}

function assessEvidence(context: PlanningContext): AssessmentResult[] {
  const results: AssessmentResult[] = [];
  const existing = existingEvidence(context);

  for (const missing of sortedMissingEvidence(context.missingEvidence)) {
    results.push(missingEvidenceAssessment(missing));
  }

  for (const item of sortedById(context.evidenceNeedsProof, (evidence) => evidence.itemId)) {
    results.push({
      id: `evidence:proof:${item.itemId}`,
      kind: 'evidence',
      subject: item.title,
      currentState: 'exists but needs stronger proof',
      status: 'needs_attention',
      severity: 'low',
      title: `Evidence needs stronger proof: ${item.title}`,
      summary: 'This evidence exists, but is currently supported only by the applicant statement.',
      evidence: [evidenceItemEvidence(item, 'user_provided')],
      source: { kind: 'evidence', sourceId: item.itemId, provenance: 'user_provided' },
      decisionBasis: 'soft_signal',
      confidence: null,
      mode: 'deterministic',
    });
  }

  if (existing.length > 0) {
    results.push({
      id: 'evidence:availability',
      kind: 'evidence',
      subject: 'Application evidence',
      currentState: `${existing.length} evidence item${existing.length === 1 ? '' : 's'} available`,
      status: 'meets',
      severity: 'info',
      title: 'Evidence is available for planning',
      summary: `${existing.length} existing evidence item${existing.length === 1 ? '' : 's'} can be considered by downstream planning.`,
      evidence: existing.map((item) => evidenceItemEvidence(item, evidenceProvenance(item))),
      source: { kind: 'evidence', sourceId: null, provenance: 'deterministically_derived' },
      decisionBasis: 'neutral',
      confidence: null,
      mode: 'deterministic',
    });
  } else if (context.missingEvidence.length === 0) {
    const diagnostic = diagnosticFor(context, 'uploaded_documents');
    results.push({
      id: 'evidence:availability',
      kind: 'evidence',
      subject: 'Application evidence',
      currentState: diagnostic?.status ?? 'none recorded',
      status: diagnostic?.status === 'unavailable' || diagnostic?.status === 'invalid' ? 'unknown' : 'needs_attention',
      severity: diagnostic?.status === 'unavailable' || diagnostic?.status === 'invalid' ? 'medium' : 'low',
      title: diagnostic?.status === 'unavailable' || diagnostic?.status === 'invalid'
        ? 'Evidence availability is unknown'
        : 'No evidence is currently available for planning',
      summary: diagnostic?.message ?? 'No existing evidence was supplied in the planning context.',
      evidence: diagnostic ? [diagnosticEvidence(diagnostic)] : [],
      source: { kind: 'evidence', sourceId: 'uploaded_documents', provenance: 'unknown' },
      decisionBasis: diagnostic?.status === 'unavailable' || diagnostic?.status === 'invalid'
        ? 'information_gap'
        : 'neutral',
      confidence: null,
      mode: 'deterministic',
    });
  }

  for (const signal of sortedById(
    context.missingInputSignals,
    (item) => `${item.frameworkContext}:${item.description}`,
  )) {
    results.push({
      id: `missing-input:${stableKey(signal.frameworkContext)}:${stableKey(signal.description)}`,
      kind: 'missing_information',
      subject: signal.frameworkContext,
      currentState: 'input missing',
      status: 'unknown',
      severity: 'low',
      title: 'Assessment input is missing',
      summary: signal.description,
      evidence: [{
        id: `missing-input-evidence:${stableKey(signal.frameworkContext)}:${stableKey(signal.description)}`,
        label: signal.description,
        detail: signal.frameworkContext,
        provenance: 'deterministically_derived',
        sourceId: signal.frameworkContext,
        sourceUrl: null,
        confidence: null,
      }],
      source: {
        kind: 'missing_information',
        sourceId: signal.frameworkContext,
        provenance: 'deterministically_derived',
      },
      decisionBasis: 'information_gap',
      confidence: null,
      mode: 'deterministic',
    });
  }

  return results;
}

function existingEvidence(context: PlanningContext): EvidenceItem[] {
  return [
    ...context.existingEvidence.verified,
    ...context.existingEvidence.attributable,
    ...context.existingEvidence.stated,
  ].sort((a, b) => compareStrings(a.itemId, b.itemId));
}

function evidenceProvenance(item: EvidenceItem): AssessmentProvenance {
  if (item.tier === 'verified') return 'database_factual';
  return 'user_provided';
}

function evidenceItemEvidence(
  item: EvidenceItem,
  provenance: AssessmentProvenance,
): AssessmentEvidence {
  return {
    id: `evidence-item:${item.itemId}`,
    label: item.title,
    detail: `Verification tier: ${item.tier}`,
    provenance,
    sourceId: item.itemId,
    sourceUrl: null,
    confidence: null,
  };
}

function sortedMissingEvidence(items: readonly MissingEvidenceItem[]): MissingEvidenceItem[] {
  return [...items].sort((a, b) =>
    compareStrings(`${a.source}:${a.reason}:${a.description}`, `${b.source}:${b.reason}:${b.description}`),
  );
}

function missingEvidenceAssessment(item: MissingEvidenceItem): AssessmentResult {
  const provenance: AssessmentProvenance = item.source === 'evaluation_finding'
    ? 'deterministically_derived'
    : 'database_factual';
  const key = stableKey(`${item.source}:${item.reason}:${item.description}`);
  return {
    id: `evidence:missing:${key}`,
    kind: 'evidence',
    subject: item.description,
    currentState: 'absent',
    status: 'needs_attention',
    severity: item.source === 'programme_requirement' ? 'high' : 'medium',
    title: `Required evidence is missing: ${item.description}`,
    summary: item.reason,
    evidence: [{
      id: `missing-evidence:${key}`,
      label: item.description,
      detail: item.reason,
      provenance,
      sourceId: item.reason,
      sourceUrl: null,
      confidence: null,
    }],
    source: { kind: 'evidence', sourceId: item.reason, provenance },
    decisionBasis: item.source === 'evaluation_finding' ? 'soft_signal' : 'hard_constraint',
    confidence: null,
    mode: 'deterministic',
  };
}

function assessDeadlines(context: PlanningContext): AssessmentResult[] {
  if (context.deadlines.length === 0) {
    return [{
      id: 'deadline:application',
      kind: 'deadline',
      subject: 'Application deadline',
      currentState: 'unknown',
      status: 'unknown',
      severity: 'medium',
      title: 'Application deadline is unknown',
      summary: 'No planning deadline is available in the current context.',
      evidence: [],
      source: { kind: 'deadline', sourceId: null, provenance: 'unknown' },
      decisionBasis: 'information_gap',
      confidence: null,
      mode: 'deterministic',
    }];
  }

  return [...context.deadlines]
    .sort((a, b) => compareStrings(`${a.kind}:${a.source}:${a.date}`, `${b.kind}:${b.source}:${b.date}`))
    .map((deadline) => {
      const provenance = deadlineProvenance(deadline.authority);
      const authorityKnown = deadline.authority !== 'unknown';
      return {
        id: `deadline:${stableKey(deadline.kind)}:${stableKey(deadline.source)}`,
        kind: 'deadline',
        subject: `${deadline.kind} deadline`,
        currentState: deadline.date,
        status: authorityKnown ? 'meets' : 'unknown',
        severity: authorityKnown ? 'info' : 'medium',
        title: authorityKnown ? 'Deadline available for planning' : 'Deadline authority is unknown',
        summary: authorityKnown
          ? `${deadline.date} is available from a ${deadline.authority.replace('_', ' ')} source.`
          : `${deadline.date} is recorded, but its authority is unknown.`,
        evidence: [{
          id: `deadline-evidence:${stableKey(deadline.kind)}:${stableKey(deadline.source)}`,
          label: deadline.date,
          detail: deadline.sourceReference,
          provenance,
          sourceId: deadline.source,
          sourceUrl: null,
          confidence: deadline.confidence,
        }],
        source: { kind: 'deadline', sourceId: deadline.source, provenance },
        decisionBasis: authorityKnown ? 'neutral' : 'information_gap',
        confidence: deadline.confidence,
        mode: 'deterministic',
      } satisfies AssessmentResult;
    });
}

function deadlineProvenance(authority: DeadlineAuthority): AssessmentProvenance {
  if (authority === 'official') return 'database_factual';
  if (authority === 'user_set') return 'user_provided';
  if (authority === 'derived') return 'deterministically_derived';
  return 'unknown';
}

function assessConstraints(context: PlanningContext): AssessmentResult[] {
  return [...context.userConstraints]
    .sort((a, b) => compareStrings(`${a.kind}:${a.value}`, `${b.kind}:${b.value}`))
    .map((constraint) => constraintAssessment(constraint));
}

function constraintAssessment(constraint: UserConstraint): AssessmentResult {
  const key = stableKey(`${constraint.kind}:${constraint.value}`);
  return {
    id: `constraint:${key}`,
    kind: 'constraint',
    subject: constraint.kind,
    currentState: constraint.value,
    status: 'meets',
    severity: 'info',
    title: `Planning constraint recorded: ${constraint.kind.replaceAll('_', ' ')}`,
    summary: `The student's ${constraint.kind.replaceAll('_', ' ')} constraint is available to downstream planning.`,
    evidence: [{
      id: `constraint-evidence:${key}`,
      label: constraint.value,
      detail: null,
      provenance: 'user_provided',
      sourceId: constraint.kind,
      sourceUrl: null,
      confidence: null,
    }],
    source: { kind: 'constraint', sourceId: constraint.kind, provenance: 'user_provided' },
    decisionBasis: 'user_constraint',
    confidence: null,
    mode: 'deterministic',
  };
}

function assessMissingInformation(context: PlanningContext): AssessmentResult[] {
  const results: AssessmentResult[] = [];

  if (context.applicantState === null) {
    results.push({
      id: 'profile:evaluation',
      kind: 'missing_information',
      subject: 'Profile evaluation',
      currentState: 'missing',
      status: 'unknown',
      severity: 'medium',
      title: 'Profile evaluation is unavailable',
      summary: 'No structured profile evaluation is available in the planning context.',
      evidence: [],
      source: { kind: 'missing_information', sourceId: 'student_personal_report_versions', provenance: 'unknown' },
      decisionBasis: 'information_gap',
      confidence: null,
      mode: 'deterministic',
    });
  }

  for (const diagnostic of [...context.provenance.sourceDiagnostics]
    .filter((item) => item.status === 'unavailable' || item.status === 'invalid')
    .sort((a, b) => compareStrings(a.source, b.source))) {
    results.push({
      id: `source:${stableKey(diagnostic.source)}`,
      kind: 'missing_information',
      subject: diagnostic.source,
      currentState: diagnostic.status,
      status: 'unknown',
      severity: diagnostic.status === 'unavailable' ? 'high' : 'medium',
      title: `Planning source ${diagnostic.status}`,
      summary: diagnostic.message ?? `The ${diagnostic.source} source could not be used for assessment.`,
      evidence: [diagnosticEvidence(diagnostic)],
      source: { kind: 'missing_information', sourceId: diagnostic.source, provenance: 'unknown' },
      decisionBasis: 'information_gap',
      confidence: null,
      mode: 'deterministic',
    });
  }

  return results;
}

function diagnosticFor(context: PlanningContext, source: string): SourceDiagnostic | undefined {
  return context.provenance.sourceDiagnostics.find((diagnostic) => diagnostic.source === source);
}

function diagnosticEvidence(diagnostic: SourceDiagnostic): AssessmentEvidence {
  return {
    id: `diagnostic:${stableKey(diagnostic.source)}`,
    label: diagnostic.source,
    detail: diagnostic.message ?? null,
    provenance: 'unknown',
    sourceId: diagnostic.source,
    sourceUrl: null,
    confidence: null,
  };
}

function sortedById<T>(items: readonly T[], id: (item: T) => string = (item) => (item as { id: string }).id): T[] {
  return [...items].sort((a, b) => compareStrings(id(a), id(b)));
}

function compareAssessments(a: AssessmentResult, b: AssessmentResult): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || compareStrings(a.id, b.id);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function stableKey(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return key || 'unknown';
}
