import { describe, expect, it } from 'vitest';
import {
  candidateConfidence,
  canonicalize,
  enforceFitClassification,
  hydratePersonalReport,
  personalReportDraftSchema,
  type CandidateContext,
  type PersonalReportDraft,
  type ProgrammeFit,
} from './ai-reports';

const oliviaContext: CandidateContext = {
  profile: {
    target_subjects: ['Business Analytics'],
    career_interests: ['Education technology'],
    goals: 'Use data to improve access to education',
    nationality: 'Vietnam',
    gpa_value: 3.8,
    budget_range: '800000000-1200000000',
  },
  achievements: [
    {
      id: 'careerbridge',
      title: 'CareerBridge',
      detail: 'Founded a 12-person team and reached 350 students',
      evidence_key: 'olivia/careerbridge.pdf',
    },
    { id: 'marketing', title: 'Marketing Club', detail: 'Attendance increased by 40%' },
  ],
  activities: [
    { id: 'data', title: 'Student information data project', description: 'Surveyed 500 students' },
    { id: 'ngo', title: 'Education NGO', description: 'Developed learning materials' },
    { id: 'competition', title: 'Business competition', description: '30 user interviews' },
  ],
  englishTests: [{ id: 'ielts', test_type: 'IELTS', overall_score: 7.5 }],
  standardizedTests: [],
  documents: [{ id: 'cv', type: 'cv', file_name: 'olivia-cv.pdf' }],
  evidence: [
    { id: 'achievement:careerbridge', kind: 'achievement', label: 'CareerBridge' },
    { id: 'achievement:marketing', kind: 'achievement', label: 'Marketing Club' },
    { id: 'activity:data', kind: 'activity', label: 'Student information data project' },
    { id: 'activity:ngo', kind: 'activity', label: 'Education NGO' },
    { id: 'activity:competition', kind: 'activity', label: 'Business competition' },
    { id: 'english_test:ielts', kind: 'english_test', label: 'IELTS 7.5' },
    { id: 'document:cv', kind: 'document', label: 'olivia-cv.pdf' },
  ],
};

const narrative = {
  status: 'established' as const,
  headline: 'Người xây dựng từ insight đến hành động',
  narrative: 'Olivia thường quan sát một khoảng trống, thu thập dữ liệu và tạo giải pháp.',
  evidenceIds: ['achievement:careerbridge', 'activity:data'],
};

const oliviaDraft: PersonalReportDraft = {
  summary: 'Hồ sơ cho thấy một ứng viên dùng dữ liệu để mở rộng khả năng tiếp cận giáo dục.',
  limitations: [],
  coreIdentity: narrative,
  drivingForce: narrative,
  signaturePattern: narrative,
  emergingThemes: [{ ...narrative, theme: 'Tiếp cận giáo dục' }],
  personalPositioning: narrative,
  proofOfMe: [
    {
      status: 'established',
      title: 'CareerBridge',
      role: 'Founder',
      contribution: 'Xây đội ngũ và chương trình workshop.',
      outcome: 'Tiếp cận 350 học sinh.',
      competencies: ['Lãnh đạo', 'Tư duy dựa trên dữ liệu'],
      evidenceStrength: 'strong',
      evidenceIds: ['achievement:careerbridge'],
    },
  ],
};

describe('AI report contracts', () => {
  it('hydrates the Olivia golden fixture with owned evidence and system confidence', () => {
    expect(personalReportDraftSchema.parse(oliviaDraft)).toEqual(oliviaDraft);
    const report = hydratePersonalReport(oliviaDraft, oliviaContext);

    expect(report.coreIdentity.headline).toContain('insight');
    expect(report.coreIdentity.evidenceRefs).toHaveLength(2);
    expect(report.confidence).toBeGreaterThanOrEqual(75);
    expect(report.confidenceLevel).toBe('high');
    expect(report.proofOfMe[0]?.evidenceRefs[0]?.label).toBe('CareerBridge');
  });

  it('rejects a provider evidence id that is outside the authenticated context', () => {
    const invalid = {
      ...oliviaDraft,
      coreIdentity: {
        ...oliviaDraft.coreIdentity,
        evidenceIds: ['achievement:careerbridge', 'achievement:someone-else'],
      },
    };
    expect(() => hydratePersonalReport(invalid, oliviaContext)).toThrow('REPORT_EVIDENCE_INVALID');
  });

  it('caps sparse profiles and forces narrative sections to limited', () => {
    const sparse: CandidateContext = {
      profile: { nationality: 'Vietnam' },
      achievements: [],
      activities: [{ id: 'one', title: 'One activity' }],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [{ id: 'activity:one', kind: 'activity', label: 'One activity' }],
    };
    const sparseNarrative = { ...narrative, evidenceIds: ['activity:one'] };
    const draft = {
      ...oliviaDraft,
      coreIdentity: sparseNarrative,
      drivingForce: sparseNarrative,
      signaturePattern: sparseNarrative,
      emergingThemes: [],
      personalPositioning: sparseNarrative,
      proofOfMe: [{ ...oliviaDraft.proofOfMe[0]!, evidenceIds: ['activity:one'] }],
    };

    expect(candidateConfidence(sparse).score).toBeLessThan(55);
    expect(hydratePersonalReport(draft, sparse).coreIdentity.status).toBe('limited');
  });

  it('canonicalizes object keys without changing array order', () => {
    expect(canonicalize({ z: 1, a: [{ y: 2, x: 1 }] })).toEqual({
      a: [{ x: 1, y: 2 }],
      z: 1,
    });
  });

  it('lets failed hard filters override an optimistic model classification', () => {
    const dimension = {
      status: 'assessed' as const,
      score: 4,
      summary: 'Có dữ liệu.',
      strengths: [],
      gaps: [],
      evidence: [],
    };
    const fit: ProgrammeFit = {
      classification: 'safety',
      confidence: 70,
      limitations: [],
      eligibility: {
        requiredSubjects: 'not_met',
        minimumQualification: 'met',
        languageRequirement: 'met',
        citizenshipRequirement: 'unknown',
        deadline: 'met',
      },
      dimensions: {
        academicCompetitiveness: dimension,
        personaAlignment: dimension,
        financialFeasibility: dimension,
        careerDirection: dimension,
        applicationReadiness: dimension,
      },
    };

    expect(enforceFitClassification(fit).classification).toBe('currently_ineligible');
  });

  it('derives reach, match, or safety from the assessed academic band', () => {
    const dimension = {
      status: 'assessed' as const,
      score: 4,
      summary: 'Có dữ liệu.',
      strengths: [],
      gaps: [],
      evidence: [],
    };
    const fit: ProgrammeFit = {
      classification: 'safety',
      confidence: 70,
      limitations: [],
      eligibility: {
        requiredSubjects: 'met',
        minimumQualification: 'met',
        languageRequirement: 'met',
        citizenshipRequirement: 'unknown',
        deadline: 'met',
      },
      dimensions: {
        academicCompetitiveness: dimension,
        personaAlignment: dimension,
        financialFeasibility: dimension,
        careerDirection: dimension,
        applicationReadiness: dimension,
      },
    };

    expect(enforceFitClassification(fit).classification).toBe('match');
  });
});
