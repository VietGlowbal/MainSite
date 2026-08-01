import { describe, expect, it, vi } from 'vitest';

const callStrategyModel = vi.fn();

vi.mock('./call', async () => {
  const actual = await vi.importActual<typeof import('./call')>('./call');
  return { ...actual, callStrategyModel: (...args: unknown[]) => callStrategyModel(...args) };
});

const { reviewCv } = await import('./cv-review');

function targetProfile() {
  return {
    id: 'tp-1',
    strategyId: 's-1',
    careerDirection: 'Data engineering',
    universityPositioning: null,
    educationPhilosophy: null,
    environment: null,
    programmeObjectives: null,
    priorityCapabilities: 'Analytical thinking',
    careerAlignment: null,
    missingInformation: [],
    sourcesUsed: [],
    version: 1,
    generatedAt: null,
    updatedAt: '2026-07-01T00:00:00Z',
  };
}

function context() {
  return {
    candidate: { academics: null, achievements: [], activities: [], goals: null, preferences: {} },
    application: {
      universityName: 'Test',
      courseName: 'CS',
      requirements: null,
      courseSummary: null,
      deadline: null,
      sources: [],
    },
    documents: { cvText: null, structuredCv: null, statementText: null },
    notes: [],
  };
}

async function run(data: Record<string, unknown>) {
  callStrategyModel.mockResolvedValue({ ok: true, data, model: 'gpt-4o' });
  const result = await reviewCv({ context: context(), targetProfile: targetProfile() });
  if (!result.ok) throw new Error('expected success');
  return result.data;
}

describe('reviewCv normalisation', () => {
  /**
   * A strength with no quoted evidence is unfalsifiable praise — the student
   * cannot check it, and it is indistinguishable from a fabrication. Dropped
   * rather than rendered with an empty quote.
   */
  it('drops a strength that has no quoted evidence', async () => {
    const data = await run({
      strengths: [
        { title: 'Great communicator', evidence: '', targetProfileArea: 'x', programmeRelevance: 'y', strength: 'strong' },
        { title: 'Real one', evidence: 'Built a pipeline', targetProfileArea: 'x', programmeRelevance: 'y', strength: 'strong' },
      ],
      missingSignals: [],
      summary: '',
    });

    expect(data.strengths).toHaveLength(1);
    expect(data.strengths[0]?.title).toBe('Real one');
  });

  it('caps strengths at three', async () => {
    const data = await run({
      strengths: Array.from({ length: 6 }, (_, i) => ({
        title: `Strength ${i}`,
        evidence: 'quoted',
        targetProfileArea: 'x',
        programmeRelevance: 'y',
        strength: 'moderate',
      })),
      missingSignals: [],
    });
    expect(data.strengths).toHaveLength(3);
  });

  it('defaults an unrecognised strength rating to moderate', async () => {
    const data = await run({
      strengths: [
        { title: 'A', evidence: 'q', targetProfileArea: 'x', programmeRelevance: 'y', strength: 'exceptional' },
      ],
      missingSignals: [],
    });
    expect(data.strengths[0]?.strength).toBe('moderate');
  });

  /**
   * "Open relevant section" must always land somewhere real. A model that answers
   * "volunteering" is not wrong, it just used a word the CV schema does not have.
   */
  it('maps a plausible section synonym onto a real section kind', async () => {
    const data = await run({
      strengths: [],
      missingSignals: [
        { signal: 'a', reason: 'b', action: 'c', targetSection: 'volunteering', critical: false },
        { signal: 'd', reason: 'e', action: 'f', targetSection: 'Employment', critical: false },
        { signal: 'g', reason: 'h', action: 'i', targetSection: 'honors', critical: false },
      ],
    });

    expect(data.missingSignals.map((s) => s.targetSection)).toEqual([
      'activities',
      'experience',
      'awards',
    ]);
  });

  it('falls back to experience for a section it cannot place', async () => {
    const data = await run({
      strengths: [],
      missingSignals: [{ signal: 'a', reason: 'b', action: 'c', targetSection: 'vibes', critical: false }],
    });
    expect(data.missingSignals[0]?.targetSection).toBe('experience');
  });

  it('drops a signal with no action, since there would be nothing to do', async () => {
    const data = await run({
      strengths: [],
      missingSignals: [
        { signal: 'Something is wrong', reason: 'b', action: '', targetSection: 'projects' },
        { signal: 'Fixable', reason: 'b', action: 'Add numbers', targetSection: 'projects' },
      ],
    });
    expect(data.missingSignals).toHaveLength(1);
    expect(data.missingSignals[0]?.signal).toBe('Fixable');
  });

  it('defaults critical to false, so the model must opt in to blocking', async () => {
    const data = await run({
      strengths: [],
      missingSignals: [{ signal: 'a', reason: 'b', action: 'c', targetSection: 'projects' }],
    });
    expect(data.missingSignals[0]?.critical).toBe(false);
  });

  it('survives a response with nothing usable in it', async () => {
    const data = await run({});
    expect(data.strengths).toEqual([]);
    expect(data.missingSignals).toEqual([]);
    expect(data.summary).toBe('');
  });

  it('drops a source citation without a usable url', async () => {
    const data = await run({
      strengths: [],
      missingSignals: [],
      sourcesUsed: [
        { field: 'programmeObjectives', url: 'not-a-url' },
        { field: 'programmeObjectives', url: 'https://example.ac.uk/cs' },
      ],
    });
    // A citation the student cannot click looks like verification and provides
    // none.
    expect(data.sourcesUsed).toHaveLength(1);
    expect(data.sourcesUsed[0]?.url).toBe('https://example.ac.uk/cs');
  });

  it('passes the provider failure reason through', async () => {
    callStrategyModel.mockResolvedValue({ ok: false, reason: 'provider_failed' });
    const result = await reviewCv({ context: context(), targetProfile: targetProfile() });
    expect(result).toEqual({ ok: false, reason: 'provider_failed' });
  });

  it('sends the target profile into the prompt', async () => {
    await run({ strengths: [], missingSignals: [] });
    const call = callStrategyModel.mock.calls.at(-1)?.[0] as { user: string };
    expect(call.user).toContain('Analytical thinking');
    expect(call.user).toContain('TARGET PROFILE THIS CV MUST SATISFY');
  });
});
