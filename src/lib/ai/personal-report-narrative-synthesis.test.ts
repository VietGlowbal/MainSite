import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersonalReportV2 } from '@/features/apply/domain';
import {
  allowedEvidenceIdsFor,
  applyNarrativeSynthesis,
  type PersonalReportNarrativeGrounding,
  synthesisInputFromReport,
  synthesizePersonalReportNarrative,
} from './personal-report-narrative-synthesis';

afterEach(() => {
  vi.unstubAllGlobals();
});

function chatResponse(content: string) {
  const body = JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] });
  return {
    ok: true,
    status: 200,
    async json() {
      return JSON.parse(body);
    },
    async text() {
      return body;
    },
  } as Response;
}

const NOT_AVAILABLE_INSUFFICIENT = { reason: 'Not enough evidence yet.', actions: [] };

/** A fully "available" report — every section populated, matching evidence refs a
 * synthesis response could legitimately cite. */
function fullReport(overrides: Partial<PersonalReportV2> = {}): PersonalReportV2 {
  return {
    generatedAt: '2026-08-14T00:00:00.000Z',
    overallEvidenceConfidence: 'medium',
    coreIdentity: {
      available: true,
      headline: 'Someone who organises people around a shared goal',
      interpretation: 'Across multiple activities, the candidate repeatedly takes on the role of "organiser".',
      recurringRole: 'organiser',
      recurringBehaviours: ['coordinating volunteers'],
      valueOrientation: 'community impact',
      observations: ['Coding club: coordinating volunteers'],
      evidenceRefs: [{ id: 'activity-1', kind: 'activity', label: 'Coding club' }],
      confidence: 'medium',
      stillDeveloping: [],
      insufficientData: null,
    },
    drivingForce: {
      available: true,
      headline: 'Motivation is becoming clearer',
      explanation: 'The candidate has not clearly stated their motivation.',
      repeatedMotivations: ['wants to help others learn to code'],
      evidenceRefs: [{ id: 'activity-1', kind: 'activity', label: 'Coding club' }],
      confidence: 'medium',
      isHypothesis: true,
      missingPersonalGrounding: 'The candidate has never explained why they chose these activities.',
      reflectionPrompt: null,
      insufficientData: null,
    },
    signaturePattern: {
      available: true,
      steps: [
        { key: 'trigger', label: 'Trigger', description: 'coding', examples: ['Coding club'] },
        { key: 'response', label: 'Response', description: 'organiser', examples: ['Coding club'] },
        { key: 'method', label: 'Method', description: 'coordinating volunteers', examples: ['Coding club'] },
        { key: 'valueCreated', label: 'Value created', description: 'more students learned to code', examples: ['Coding club'] },
      ],
      patternStrength: 'emerging',
      supportingExperienceCount: 2,
      confidence: 'medium',
      distinctiveness: null,
      evidenceRefs: [{ id: 'activity-1', kind: 'activity', label: 'Coding club' }],
      insufficientData: null,
    },
    emergingThemes: {
      available: true,
      themes: [
        {
          theme: 'Computer science education',
          status: 'strong_emerging_theme',
          statusLabel: 'Strong emerging theme',
          explanation: 'The candidate has shown interest in "Computer science education" across 2 activities.',
          supportingExperiences: ['Coding club'],
          confidence: 'medium',
          limitation: 'More activities are needed.',
          evidenceRefs: [{ id: 'theme-1', kind: 'activity', label: 'Coding club theme link' }],
        },
      ],
      insufficientData: null,
    },
    personalPositioning: {
      available: true,
      statement: 'The candidate is someone who organises people, creates value by coordinating volunteers.',
      positioningStatus: 'positioned',
      authentic: true,
      differentiated: true,
      coherent: true,
      directionAligned: false,
      credible: true,
      whyThisFits: ['A consistent role or behaviour is grounded in real activity records.'],
      whatPreventsStrongerPositioning: [],
      confidence: 'medium',
      evidenceRefs: [{ id: 'positioning-1', kind: 'activity', label: 'Coding club positioning' }],
      insufficientData: null,
    },
    proofOfMe: {
      available: true,
      cards: [
        {
          activityId: 'activity-1',
          title: 'Coding club',
          role: 'organiser',
          personalContribution: 'Coordinated weekly sessions',
          outcome: 'More students learned to code',
          competenciesDemonstrated: ['Leadership'],
          supports: ['Core Identity'],
          evidenceStrength: 'strong',
          verificationStatus: 'verified',
          evidenceSource: 'Coding club',
          evidenceRefs: [{ id: 'proof-1', kind: 'activity', label: 'Coding club proof' }],
        },
      ],
      insufficientData: null,
    },
    ...overrides,
  } as PersonalReportV2;
}

function insufficientReport(): PersonalReportV2 {
  return fullReport({
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
      insufficientData: NOT_AVAILABLE_INSUFFICIENT,
    },
    drivingForce: {
      available: false,
      headline: null,
      explanation: null,
      repeatedMotivations: [],
      evidenceRefs: [],
      confidence: 'low',
      isHypothesis: false,
      missingPersonalGrounding: null,
      reflectionPrompt: null,
      insufficientData: NOT_AVAILABLE_INSUFFICIENT,
    },
    signaturePattern: {
      available: false,
      steps: [],
      patternStrength: 'insufficient',
      supportingExperienceCount: 0,
      confidence: 'low',
      distinctiveness: null,
      evidenceRefs: [],
      insufficientData: NOT_AVAILABLE_INSUFFICIENT,
    },
    emergingThemes: {
      available: false,
      themes: [],
      insufficientData: NOT_AVAILABLE_INSUFFICIENT,
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
      insufficientData: NOT_AVAILABLE_INSUFFICIENT,
    },
    proofOfMe: {
      available: false,
      cards: [],
      insufficientData: NOT_AVAILABLE_INSUFFICIENT,
    },
  });
}

function completeSynthesisResponse(overrides: Record<string, unknown> = {}) {
  return {
    overview: null,
    coreIdentity: {
      headline: 'A natural organiser',
      paragraphs: ['The candidate repeatedly steps into an organising role.'],
      evidenceIds: ['activity-1'],
    },
    drivingForce: {
      headline: 'A developing motivation',
      paragraphs: ['The repeated choice to support learners is still an emerging hypothesis.'],
      evidenceIds: ['activity-1'],
    },
    signaturePattern: {
      paragraphs: ['Across activities, the candidate turns interest in coding into organised learning opportunities.'],
      evidenceIds: ['activity-1'],
    },
    emergingThemes: {
      paragraphs: ['Computer science education is a strong emerging theme grounded in the coding club record.'],
      evidenceIds: ['theme-1'],
    },
    personalPositioning: {
      statement: 'An organiser creating accessible coding learning opportunities.',
      whyItFits: ['The role is repeated in the available activity evidence.'],
      evidenceIds: ['positioning-1'],
    },
    proofOfMe: {
      paragraphs: ['The coding club provides verified evidence of the candidate’s contribution and outcome.'],
      evidenceIds: ['proof-1'],
    },
    overallSummary: null,
    ...overrides,
  };
}

function narrativeGrounding(): PersonalReportNarrativeGrounding {
  return {
    evaluationInput: {
      writtenFields: [{ field: 'personalStatement', value: 'I organise coding workshops for younger students.' }],
      reflectionRecords: [{ prompt: 'Why this matters?', response: 'I want peers to feel welcome in technical spaces.' }],
      competencyClaims: [{ competency: 'Leadership', source: 'Coding club' }],
      evidenceItems: [{ title: 'Coding club attendance record', source: 'school' }],
      narrativeActivities: [{ title: 'Coding club', description: 'Coordinated weekly sessions.' }],
      profileMotivations: ['Inclusive computing education'],
      reflectionAnswerSignals: ['Values peer learning'],
      intendedDirection: 'Computer science at university',
    } as unknown as PersonalReportNarrativeGrounding['evaluationInput'],
    evaluation: { overallEvidenceConfidence: 'medium' } as unknown as PersonalReportNarrativeGrounding['evaluation'],
    evidenceBank: null,
  };
}

describe('synthesisInputFromReport', () => {
  it('carries the intendedDirection parameter through, not a value derived from the report itself', () => {
    const input = synthesisInputFromReport(fullReport(), 'Computer science at university');
    expect(input.personalPositioning?.intendedDirection).toBe('Computer science at university');
  });

  it('marks a section null when its report section is unavailable, rather than sending partial data', () => {
    const input = synthesisInputFromReport(insufficientReport(), null);
    expect(input.coreIdentity).toBeNull();
    expect(input.drivingForce).toBeNull();
    expect(input.signaturePattern).toBeNull();
    expect(input.emergingThemes).toBeNull();
    expect(input.personalPositioning).toBeNull();
    expect(input.proofOfMe).toBeNull();
  });

  it('keeps isHypothesis explicit so the model cannot present an inferred motivation as stated fact', () => {
    const input = synthesisInputFromReport(fullReport(), null);
    expect(input.drivingForce?.isHypothesis).toBe(true);
  });
});

describe('allowedEvidenceIdsFor', () => {
  it('collects every evidence id referenced anywhere in the report', () => {
    const allowed = allowedEvidenceIdsFor(fullReport());
    expect([...allowed.keys()].sort()).toEqual(
      ['activity-1', 'positioning-1', 'proof-1', 'theme-1'].sort(),
    );
  });
});

describe('synthesizePersonalReportNarrative', () => {
  it('makes no call and returns null when nothing in the report is available to write about', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: insufficientReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('hydrates a response that only cites known evidence ids', async () => {
    const snapshotSummary = Array.from({ length: 150 }, () => 'word').join(' ');
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          snapshot: { summary: snapshotSummary },
          ...completeSynthesisResponse(),
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result?.coreIdentity?.headline).toBe('A natural organiser');
    expect(result?.snapshot?.summary).toBe(snapshotSummary);
    expect(result?.coreIdentity?.evidenceRefs).toEqual([
      { id: 'activity-1', kind: 'activity', label: 'Coding club' },
    ]);
    expect(result?.signaturePattern?.paragraphs).toHaveLength(1);
    expect(result?.emergingThemes?.paragraphs).toHaveLength(1);
    expect(result?.proofOfMe?.paragraphs).toHaveLength(1);
  });

  it('keeps a grounded short snapshot and ignores unsupported optional summaries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify(
          completeSynthesisResponse({
            snapshot: { summary: 'A concise grounded snapshot.' },
            overview: { summary: 'No cited overview.', evidenceIds: [] },
            overallSummary: { paragraphs: ['No cited overall summary.'], evidenceIds: [] },
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result?.snapshot?.summary).toBe('A concise grounded snapshot.');
    expect(result?.overview).toBeNull();
    expect(result?.overallSummary).toBeNull();
    expect(result?.coreIdentity).not.toBeNull();
  });

  it('normalizes empty objects for unavailable canonical sections to null', async () => {
    const report = fullReport({
      signaturePattern: {
        ...fullReport().signaturePattern,
        available: false,
        steps: [],
        evidenceRefs: [],
        insufficientData: NOT_AVAILABLE_INSUFFICIENT,
      },
      emergingThemes: {
        ...fullReport().emergingThemes,
        available: false,
        themes: [],
        insufficientData: NOT_AVAILABLE_INSUFFICIENT,
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify(
          completeSynthesisResponse({
            signaturePattern: { paragraphs: [], evidenceIds: [] },
            emergingThemes: { paragraphs: [], evidenceIds: [] },
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report,
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result?.signaturePattern).toBeNull();
    expect(result?.emergingThemes).toBeNull();
    expect(result?.coreIdentity).not.toBeNull();
  });

  it('rejects a response that omits prose for an available report section', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          overview: null,
          coreIdentity: {
            headline: 'A natural organiser',
            paragraphs: ['The candidate repeatedly steps into an organising role.'],
            evidenceIds: ['activity-1'],
          },
          drivingForce: null,
          personalPositioning: null,
          overallSummary: null,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result).toBeNull();
  });

  it('rejects the entire synthesis when any section cites an unknown evidence id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify(
          completeSynthesisResponse({
            coreIdentity: {
            headline: 'A natural organiser',
            paragraphs: ['The candidate repeatedly steps into an organising role.'],
            evidenceIds: ['activity-1', 'made-up-id'],
            },
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result).toBeNull();
  });

  it('rejects an evidence citation that belongs to a different report section', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify(
          completeSynthesisResponse({
            signaturePattern: {
              paragraphs: ['This must not cite the positioning-only evidence.'],
              evidenceIds: ['positioning-1'],
            },
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result).toBeNull();
  });

  it('rejects an available section with no evidence citation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(JSON.stringify(completeSynthesisResponse({ proofOfMe: { paragraphs: ['Ungrounded.'], evidenceIds: [] } }))),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(), intendedDirection: null, apiKey: 'test-key', model: 'gpt-4o', grounding: narrativeGrounding(),
    });

    expect(result).toBeNull();
  });

  it('falls back to null (deterministic copy) when the completion call throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result).toBeNull();
  });

  it('falls back to null when the response is not valid JSON matching the schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse('not json at all'));
    vi.stubGlobal('fetch', fetchMock);
    let failureCode: string | null = null;

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
      onFailure: (code) => {
        failureCode = code;
      },
    });

    expect(result).toBeNull();
    expect(failureCode).toBe('invalid_json');
  });

  it('rejects prose that invents a numeric outcome not present in structured findings', async () => {
    const response = completeSynthesisResponse({
      coreIdentity: {
        headline: 'A natural organiser',
        paragraphs: ['The candidate led a 999-person team.'],
        evidenceIds: ['activity-1'],
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatResponse(JSON.stringify(response))));
    let failureCode: string | null = null;

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
      onFailure: (code) => {
        failureCode = code;
      },
    });

    expect(result).toBeNull();
    expect(failureCode).toBe('unsupported_narrative_fact');
  });

  it('rejects first-person prose instead of publishing the applicant voice as report narration', async () => {
    const response = completeSynthesisResponse({
      coreIdentity: {
        headline: 'I enjoy building systems',
        paragraphs: ['I enjoy building systems and helping people.'],
        evidenceIds: ['activity-1'],
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatResponse(JSON.stringify(response))));
    let failureCode: string | null = null;

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
      onFailure: (code) => {
        failureCode = code;
      },
    });

    expect(result).toBeNull();
    expect(failureCode).toBe('unsupported_narrative_voice');
  });

  it('does not keep a first-person optional snapshot when canonical prose is valid', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify(
          completeSynthesisResponse({
            snapshot: { summary: 'I enjoy building systems and helping people.' },
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    expect(result?.snapshot).toBeUndefined();
    expect(result?.coreIdentity).not.toBeNull();
  });

  it('sends evidence provenance without raw first-person claim statements', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify(completeSynthesisResponse())));
    vi.stubGlobal('fetch', fetchMock);
    const grounding = narrativeGrounding();
    grounding.evidenceBank = {
      version: 'eb-v1',
      sources: {},
      interpretations: [],
      claims: [
        {
          id: 'experience:1',
          category: 'experience',
          statement: 'I built a chatbot for my school.',
          status: 'unverified',
          sourceRefs: ['activity:1'],
          interpretationRefs: [],
          tags: { competencies: [], criteria: [] },
        },
      ],
      missingInformation: [],
    };

    await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: null,
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding,
    });

    const content = fetchMock.mock.calls
      .map((call) => JSON.parse(call?.[1]?.body as string).messages[1].content)
      .join('\n');
    expect(content).toContain('experience:1');
    expect(content).not.toContain('I built a chatbot for my school.');
  });

  it('sends deterministic findings and section-scoped evidence ids, never raw extraction input', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify(completeSynthesisResponse())));
    vi.stubGlobal('fetch', fetchMock);

    await synthesizePersonalReportNarrative({
      report: fullReport(),
      intendedDirection: 'Computer science at university',
      apiKey: 'test-key',
      model: 'gpt-4o',
      grounding: narrativeGrounding(),
    });

    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(call?.[1]?.body as string),
    );
    expect(bodies.map((body) => body.max_completion_tokens).sort((a, b) => a - b)).toEqual([1800, 3000, 3000]);
    const content = bodies.map((body) => body.messages[1].content).join('\n');
    expect(content).toContain('structuredFindings');
    expect(content).toContain('coordinating volunteers');
    expect(content).not.toContain('I organise coding workshops for younger students.');
    expect(content).not.toContain('Coding club attendance record');
    expect(content).not.toContain('Values peer learning');
    expect(content).toContain('"signaturePattern":["activity-1"]');
    expect(content).toContain('"proofOfMe":["proof-1"]');
  });
});

describe('applyNarrativeSynthesis', () => {
  it('returns the report unchanged when synthesis is null', () => {
    const report = fullReport();
    expect(applyNarrativeSynthesis(report, null)).toBe(report);
  });

  it('overlays prose onto an available section without touching its score, confidence, or evidence refs', () => {
    const report = fullReport();
    const applied = applyNarrativeSynthesis(report, {
      overview: null,
      coreIdentity: {
        headline: 'A natural organiser',
        paragraphs: ['Better-written paragraph.'],
        evidenceRefs: [{ id: 'activity-1', kind: 'activity', label: 'Coding club' }],
      },
      drivingForce: null,
      signaturePattern: null,
      emergingThemes: null,
      personalPositioning: null,
      proofOfMe: null,
      overallSummary: null,
    });

    expect(applied.coreIdentity.headline).toBe('A natural organiser');
    expect(applied.coreIdentity.interpretation).toBe('Better-written paragraph.');
    expect(applied.coreIdentity.confidence).toBe(report.coreIdentity.confidence);
    expect(applied.coreIdentity.evidenceRefs).toBe(report.coreIdentity.evidenceRefs);
  });

  it('never overlays a section the deterministic report marked unavailable', () => {
    const report = insufficientReport();
    const applied = applyNarrativeSynthesis(report, {
      overview: null,
      coreIdentity: {
        headline: 'A natural organiser',
        paragraphs: ['Should never be applied.'],
        evidenceRefs: [],
      },
      drivingForce: null,
      signaturePattern: null,
      emergingThemes: null,
      personalPositioning: null,
      proofOfMe: null,
      overallSummary: null,
    });

    expect(applied.coreIdentity).toBe(report.coreIdentity);
  });

  it('overwrites whyThisFits with the synthesised whyItFits, leaving the positioning booleans untouched', () => {
    const report = fullReport();
    const applied = applyNarrativeSynthesis(report, {
      overview: null,
      coreIdentity: null,
      drivingForce: null,
      signaturePattern: null,
      emergingThemes: null,
      personalPositioning: {
        statement: 'A sharper positioning statement.',
        whyItFits: ['Because of X.', 'Because of Y.'],
        evidenceRefs: [{ id: 'positioning-1', kind: 'activity', label: 'Coding club positioning' }],
      },
      proofOfMe: null,
      overallSummary: null,
    });

    expect(applied.personalPositioning.statement).toBe('A sharper positioning statement.');
    expect(applied.personalPositioning.whyThisFits).toEqual(['Because of X.', 'Because of Y.']);
    expect(applied.personalPositioning.authentic).toBe(report.personalPositioning.authentic);
    expect(applied.personalPositioning.credible).toBe(report.personalPositioning.credible);
  });

  it('overlays AI prose for the remaining canonical sections without replacing their facts', () => {
    const report = fullReport();
    const applied = applyNarrativeSynthesis(report, {
      overview: null,
      coreIdentity: null,
      drivingForce: null,
      signaturePattern: { paragraphs: ['A recurring pattern.'], evidenceRefs: report.signaturePattern.evidenceRefs },
      emergingThemes: { paragraphs: ['A recurring theme.'], evidenceRefs: report.emergingThemes.themes[0]!.evidenceRefs },
      personalPositioning: null,
      proofOfMe: { paragraphs: ['A verified proof.'], evidenceRefs: report.proofOfMe.cards[0]!.evidenceRefs },
      overallSummary: null,
    });

    expect(applied.signaturePattern.distinctiveness).toBe('A recurring pattern.');
    expect(applied.emergingThemes.narrative).toBe('A recurring theme.');
    expect(applied.proofOfMe.narrative).toBe('A verified proof.');
    expect(applied.proofOfMe.cards).toBe(report.proofOfMe.cards);
  });
});
