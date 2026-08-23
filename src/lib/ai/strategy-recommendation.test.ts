import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateStrategyRecommendation,
  STRATEGY_RECOMMENDATION_PROMPT_VERSION,
} from './strategy-recommendation';
import { strategyRecommendationSchema } from '@/features/ai-strategy-dashboard/domain';
import type { PersonalReportV2, ProgrammeFit } from '@/features/apply/domain';

const personalReport: PersonalReportV2 = {
  generatedAt: '2026-08-08T00:00:00Z',
  overallEvidenceConfidence: 'high',
  coreIdentity: {
    available: true,
    headline: 'A resourceful, community-driven problem solver',
    interpretation: 'Across multiple activities, the candidate repeatedly takes on problem-solving roles.',
    recurringRole: 'Problem solver',
    recurringBehaviours: ['Community organising', 'Quantitative reasoning'],
    valueOrientation: 'Equity and access',
    observations: ['Quantitative reasoning in regional challenge', 'Community organizing for education'],
    evidenceRefs: [],
    confidence: 'high',
    stillDeveloping: ['Formal research experience'],
    insufficientData: null,
  },
  drivingForce: {
    available: true,
    headline: 'Wants to make education systems fairer',
    explanation: 'Motivated by educational equity and creating scalable tools.',
    repeatedMotivations: ['Educational access', 'Data transparency'],
    isHypothesis: false,
    missingPersonalGrounding: null,
    reflectionPrompt: null,
    evidenceRefs: [],
    confidence: 'high',
    insufficientData: null,
  },
  signaturePattern: {
    available: true,
    steps: [
      {
        key: 'trigger',
        label: 'Discover',
        description: 'Finds data disparities',
        examples: ['Data Challenge'],
      },
      {
        key: 'response',
        label: 'Mobilize',
        description: 'Organizes community stakeholders',
        examples: ['NGO Project'],
      },
    ],
    patternStrength: 'established',
    distinctiveness: 'Distinctive multi-theme pattern',
    supportingExperienceCount: 3,
    confidence: 'high',
    evidenceRefs: [],
    insufficientData: null,
  },
  emergingThemes: {
    available: true,
    themes: [
      {
        theme: 'Education access',
        status: 'established_theme',
        statusLabel: 'Established theme',
        explanation: 'Deep interest in education access across projects',
        supportingExperiences: ['Education NGO Data Project'],
        confidence: 'high',
        limitation: '',
        evidenceRefs: [],
      },
      {
        theme: 'Data for good',
        status: 'strong_emerging_theme',
        statusLabel: 'Strong emerging theme',
        explanation: 'Strong application of data skills to social impact',
        supportingExperiences: ['Regional Data Challenge'],
        confidence: 'high',
        limitation: '',
        evidenceRefs: [],
      },
    ],
    insufficientData: null,
  },
  personalPositioning: {
    available: true,
    statement: 'A data-minded advocate for education access.',
    positioningStatus: 'strong_positioning',
    authentic: true,
    differentiated: true,
    coherent: true,
    directionAligned: true,
    credible: true,
    whyThisFits: ['Directly aligns with proven portfolio results.'],
    whatPreventsStrongerPositioning: ['Formal research experience'],
    confidence: 'high',
    evidenceRefs: [],
    insufficientData: null,
  },
  proofOfMe: {
    available: true,
    cards: [
      {
        activityId: 'act-1',
        title: 'Education NGO Data Project',
        role: 'Lead Analyst',
        personalContribution: 'Built analytics pipelines',
        outcome: 'Improved student enrollment by 25%',
        competenciesDemonstrated: ['Data Analysis', 'Project Management'],
        supports: ['Core Identity', 'Emerging Themes: Education access'],
        evidenceStrength: 'strong',
        verificationStatus: 'verified',
        evidenceSource: 'NGO Letter',
        evidenceRefs: [],
      },
    ],
    insufficientData: null,
  },
};

const dimension = {
  status: 'assessed' as const,
  score: 4,
  summary: 'Strong fit on the available evidence.',
  strengths: ['Relevant coursework'],
  gaps: [],
  evidence: ['GPA 3.7'],
};

const fit: ProgrammeFit = {
  classification: 'match',
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

function directionOption(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Business Analytics for Education',
    identityFit: 9.7,
    evidenceStrength: 9.2,
    consistency: 9.0,
    differentiation: 9.4,
    futureAlignment: 10,
    scalability: 9.1,
    overall: 9.6,
    ...overrides,
  };
}

function validResponseBody() {
  return {
    directionOptions: [directionOption(), directionOption({ name: 'Education Entrepreneurship' })],
    chosenDirection: 'Business Analytics for Education',
    chosenDirectionWhy: 'It integrates nearly every recurring pattern in the portfolio.',
    narrative: 'Throughout these experiences, one question kept recurring...',
    positioningBefore: 'Interested in business, leadership, education, and technology.',
    positioningAfter: 'A Business Analytics applicant focused on educational access.',
    positioningRationale: 'The second positioning is more focused and defensible.',
    portfolioEvaluations: [
      {
        name: 'Education NGO Data Project',
        source: 'existing_activity',
        strategicContribution: 'Directly strengthens the chosen direction.',
        recommendation: 'highly_recommended',
      },
      {
        name: 'Open education-access dashboard',
        source: 'ai_proposed',
        strategicContribution: 'Would demonstrate independent initiative in the same direction.',
        recommendation: 'recommended',
      },
    ],
    differentiationInsight: 'Many applicants have coding projects or consulting competitions.',
    differentiationProposal: 'Publish a public analytics tool comparing education pathways.',
    roadmap: {
      chosenStrategy: 'Become a Business Analytics applicant specialising in education.',
      why: 'Strongest intersection of identity, evidence, and future direction.',
      prioritize: ['Deepen the NGO data project', 'Publish the analytics tool'],
      avoid: ['Generic leadership programmes'],
      expectedPositioning: 'An applicant who blends business analytics with education impact.',
      longTermNarrative: 'From identifying gaps to building scalable, data-driven systems.',
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateStrategyRecommendation', () => {
  it('parses a valid F7.1-F7.6 response, consumes canonical structured inputs, and enforces prompt versioning', async () => {
    expect(STRATEGY_RECOMMENDATION_PROMPT_VERSION).toBe('strategy-recommendation-f8-v2');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(validResponseBody()) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateStrategyRecommendation({
      personalReport,
      fit,
      programme: { universityName: 'Example University', courseName: 'BSc Business Analytics' },
      achievements: [{ category: 'Award', title: 'Regional Data Challenge Winner' }],
      activities: [{ category: 'Volunteering', title: 'Education NGO Data Project' }],
      apiKey: 'test-key',
    });

    expect(result.chosenDirection).toBe('Business Analytics for Education');
    expect(result.directionOptions).toHaveLength(2);
    expect(result.portfolioEvaluations.some((p) => p.source === 'existing_activity')).toBe(true);
    expect(result.portfolioEvaluations.some((p) => p.source === 'ai_proposed')).toBe(true);

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ content: string }>;
    };
    expect(request.messages[0]?.content).toContain('Write every field in English');
    expect(request.messages[0]?.content).toContain('Never calculate, estimate, or imply an admission probability');
    expect(request.messages[1]?.content).toContain('BSc Business Analytics');
    expect(request.messages[1]?.content).toContain('Education NGO Data Project');
    expect(request.messages[1]?.content).toContain('CANONICAL PERSONAL REPORT');
    expect(request.messages[1]?.content).toContain('CANONICAL MATCHING REPORT');
    expect(request.messages[1]?.content).toContain('Education access');
  });

  it('builds prompt correctly when personal report sections have missing data', async () => {
    const emptyPersonalReport: PersonalReportV2 = {
      generatedAt: '2026-08-08T00:00:00Z',
      overallEvidenceConfidence: 'low',
      coreIdentity: {
        available: false,
        headline: null,
        interpretation: null,
        recurringRole: null,
        recurringBehaviours: [],
        valueOrientation: null,
        observations: [],
        evidenceRefs: [],
        confidence: 'low',
        stillDeveloping: [],
        insufficientData: { reason: 'No activities yet', actions: [] },
      },
      drivingForce: {
        available: false,
        headline: null,
        explanation: null,
        repeatedMotivations: [],
        isHypothesis: false,
        missingPersonalGrounding: null,
        reflectionPrompt: null,
        evidenceRefs: [],
        confidence: 'low',
        insufficientData: { reason: 'No reflections yet', actions: [] },
      },
      signaturePattern: {
        available: false,
        steps: [],
        patternStrength: 'insufficient',
        distinctiveness: null,
        supportingExperienceCount: 0,
        confidence: 'low',
        evidenceRefs: [],
        insufficientData: { reason: 'No pattern yet', actions: [] },
      },
      emergingThemes: {
        available: false,
        themes: [],
        insufficientData: { reason: 'No themes yet', actions: [] },
      },
      personalPositioning: {
        available: false,
        statement: null,
        positioningStatus: 'insufficient_data',
        authentic: false,
        differentiated: false,
        coherent: false,
        directionAligned: false,
        credible: false,
        whyThisFits: [],
        whatPreventsStrongerPositioning: [],
        confidence: 'low',
        evidenceRefs: [],
        insufficientData: { reason: 'Insufficient data for positioning', actions: [] },
      },
      proofOfMe: {
        available: false,
        cards: [],
        insufficientData: { reason: 'No proof cards', actions: [] },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(validResponseBody()) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await generateStrategyRecommendation({
      personalReport: emptyPersonalReport,
      fit,
      programme: { universityName: 'Example University', courseName: 'BSc Business Analytics' },
      achievements: [],
      activities: [],
      apiKey: 'test-key',
    });

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ content: string }>;
    };
    expect(request.messages[1]?.content).toContain('insufficient data: No activities yet');
    expect(request.messages[1]?.content).toContain('(none recorded)');
  });

  it('throws when the response does not match the schema rather than returning a partial report', async () => {
    const invalid = { ...validResponseBody(), directionOptions: [directionOption()] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(invalid) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateStrategyRecommendation({
        personalReport,
        fit,
        programme: { universityName: 'Example University', courseName: 'BSc Business Analytics' },
        achievements: [],
        activities: [],
        apiKey: 'test-key',
      }),
    ).rejects.toThrow('Invalid strategy recommendation output');
  });

  it('surfaces the OpenAI error when the request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateStrategyRecommendation({
        personalReport,
        fit,
        programme: { universityName: 'Example University', courseName: 'BSc Business Analytics' },
        achievements: [],
        activities: [],
        apiKey: 'test-key',
      }),
    ).rejects.toThrow('OpenAI request failed');
  });
});

describe('generation contract invariants (Task 2.6)', () => {
  // No validated output surface may carry an admission-probability-shaped
  // field — the plan's invariant 10, enforced at the schema itself so a new
  // prompt cannot quietly reintroduce it.
  const FORBIDDEN = /probabilit|likelihood|odds|acceptance|chance/i;

  function shapeKeysOf(schemaField: unknown): string[] {
    const shape = (schemaField as { shape?: Record<string, unknown> }).shape;
    return shape ? Object.keys(shape) : [];
  }

  it('never exposes an admission-probability-shaped field in the validated output', () => {
    for (const key of shapeKeysOf(strategyRecommendationSchema)) {
      expect(key).not.toMatch(FORBIDDEN);
    }

    for (const key of shapeKeysOf(directionOptionElement())) {
      expect(key).not.toMatch(FORBIDDEN);
    }
  });

  it('keeps every direction score axis a strategy-fit dimension, not an admission chance', () => {
    expect(shapeKeysOf(directionOptionElement())).toEqual(
      expect.arrayContaining([
        'identityFit',
        'evidenceStrength',
        'consistency',
        'differentiation',
        'futureAlignment',
        'scalability',
      ]),
    );
  });

  function directionOptionElement(): unknown {
    return (
      strategyRecommendationSchema.shape.directionOptions as unknown as { element?: unknown }
    ).element;
  }
});

