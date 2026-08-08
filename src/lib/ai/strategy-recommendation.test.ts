import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStrategyRecommendation } from './strategy-recommendation';
import type { NarrativeProfile } from '@/features/ai-strategy-dashboard/domain';
import type { ProgrammeFit } from '@/features/apply/domain';

const narrative: NarrativeProfile = {
  coreIdentity: 'A resourceful, community-driven problem solver.',
  learningStyle: ['Hands-on'],
  academicStrengths: ['Quantitative reasoning'],
  drivingForce: 'Wants to make education systems fairer.',
  signaturePattern: ['Data analysis paired with community organising'],
  emergingThemes: ['Education access', 'Data for good'],
  personalPositioning: 'A data-minded advocate for education access.',
  growthAreas: ['Formal research experience'],
  overallRating: 78,
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
  it('parses a valid F7.1-F7.6 response and writes the prompt in English', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(validResponseBody()) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateStrategyRecommendation({
      narrative,
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
    expect(request.messages[1]?.content).toContain('BSc Business Analytics');
    expect(request.messages[1]?.content).toContain('Education NGO Data Project');
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
        narrative,
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
        narrative,
        fit,
        programme: { universityName: 'Example University', courseName: 'BSc Business Analytics' },
        achievements: [],
        activities: [],
        apiKey: 'test-key',
      }),
    ).rejects.toThrow('OpenAI request failed');
  });
});
