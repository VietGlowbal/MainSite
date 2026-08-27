import { expect, test, describe, vi } from 'vitest';
import { reasonAboutCriteria, generateMatchingSummary, BatchReasoningError } from './reasoner';
import { validateEvidenceReferences } from './evidence';
import type { MatchingCriterion, MatchingEvidence, FitSignal, HardRequirementMatch, MatchingStrength, MatchingGap, PositioningOpportunity } from './domain';

function fakeGenerate<T>(data: T) {
  return async () => ({
    data,
    meta: {
      moduleId: 'test',
      model: 'test',
      promptVersion: 'test',
      schemaVersion: 'test',
      attemptCount: 1 as const,
      repaired: false,
      latencyMs: 100,
      usage: null,
    },
  });
}

function fakeGenerateWithSpy<T>(data: T) {
  return vi.fn().mockImplementation(async () => ({
    data,
    meta: {
      moduleId: 'test',
      model: 'test',
      promptVersion: 'test',
      schemaVersion: 'test',
      attemptCount: 1 as const,
      repaired: false,
      latencyMs: 100,
      usage: null,
    },
  }));
}

describe('Matching Reasoner', () => {
  const dummyCriteria: MatchingCriterion[] = [
    { id: 'crit-1', label: 'Leadership', description: 'desc', category: 'competency', expectedSignals: ['sig'], sourceRefs: [] },
  ];

  const dummyEvidence: MatchingEvidence[] = [
    { id: 'ev-1', statement: 'Led a team', status: 'verified', sourceRefs: [], competencies: [] },
  ];

  const personalContext = { coreIdentity: [], motivations: [], direction: [] };

  describe('reasonAboutCriteria', () => {
    test('1. Prompt contains only batch criteria + retrieved evidence + minimal personal context', async () => {
      const generateSpy = fakeGenerateWithSpy({ results: [{ criterionId: 'crit-1', alignment: 'strong', evidenceIds: ['ev-1'], directEvidenceIds: ['ev-1'], supportingEvidenceIds: [], reasoning: 'good' }] });
      
      await reasonAboutCriteria({
        criteria: dummyCriteria,
        evidenceByCriterion: { 'crit-1': dummyEvidence },
        personalContext,
        generate: generateSpy,
      });

      expect(generateSpy).toHaveBeenCalledTimes(1);
      const callArgs = generateSpy.mock.calls[0][0];
      const parsedPrompt = JSON.parse(callArgs.userPrompt);
      expect(parsedPrompt).toHaveProperty('criteria');
      expect(parsedPrompt).toHaveProperty('evidenceByCriterion');
      expect(parsedPrompt).toHaveProperty('personalContext');
    });

    test('2. Batch size capped at 6', async () => {
      const criteria: MatchingCriterion[] = Array.from({ length: 8 }).map((_, i) => ({
        id: `crit-${i}`, label: `L-${i}`, description: 'd', category: 'competency', expectedSignals: [], sourceRefs: []
      }));
      
      const generateSpy = fakeGenerateWithSpy({ results: [] });
      await reasonAboutCriteria({
        criteria,
        evidenceByCriterion: {},
        personalContext,
        generate: generateSpy,
      });

      expect(generateSpy).toHaveBeenCalledTimes(2);
      const call1Prompt = JSON.parse(generateSpy.mock.calls[0][0].userPrompt);
      const call2Prompt = JSON.parse(generateSpy.mock.calls[1][0].userPrompt);
      expect(call1Prompt.criteria.length).toBe(6);
      expect(call2Prompt.criteria.length).toBe(2);
    });

    test('3. Hallucinated evidence ID rejected via validateEvidenceReferences', async () => {
      const generateSpy = fakeGenerate({ results: [{ criterionId: 'crit-1', alignment: 'strong', evidenceIds: ['ev-hallucinated'], directEvidenceIds: ['ev-hallucinated'], supportingEvidenceIds: [], reasoning: 'good' }] });
      
      await expect(reasonAboutCriteria({
        criteria: dummyCriteria,
        evidenceByCriterion: { 'crit-1': dummyEvidence },
        personalContext,
        generate: generateSpy,
      })).rejects.toThrow(BatchReasoningError);
    });

    test('4. Generic impressive evidence doesn\'t create strong alignment (downgraded)', async () => {
      const generateSpy = fakeGenerate({ results: [{ criterionId: 'crit-1', alignment: 'strong', evidenceIds: ['ev-1'], directEvidenceIds: [], supportingEvidenceIds: ['ev-1'], reasoning: 'Impressive' }] });
      
      const results = await reasonAboutCriteria({
        criteria: dummyCriteria,
        evidenceByCriterion: { 'crit-1': dummyEvidence }, 
        personalContext,
        generate: generateSpy,
      });

      expect(results[0].alignment).toBe('moderate');
    });

    test('5. Vague evidence doesn\'t become strong', async () => {
      const generateSpy = fakeGenerate({ results: [{ criterionId: 'crit-1', alignment: 'strong', evidenceIds: ['ev-vague'], directEvidenceIds: [], supportingEvidenceIds: ['ev-vague'], reasoning: 'vague' }] });
      const results = await reasonAboutCriteria({
        criteria: dummyCriteria,
        evidenceByCriterion: { 'crit-1': [{ id: 'ev-vague', category: 'competency', statement: 'vague', status: 'self_reported', sourceRefs: [], interpretationRefs: [], competencies: [], criteria: [], direct: false, rankScore: 0 }] as MatchingEvidence[] }, 
        personalContext,
        generate: generateSpy,
      });

      expect(results[0].alignment).toBe('moderate');
    });

    test('6. Personal Report context doesn\'t appear in evidence IDs', async () => {
      // ctx-1 is not in evidence list, so validateEvidenceReferences would throw.
      // So this test should actually expect an error, or the AI should only output valid ids.
      // Let's adjust the test to use a valid id but show it's supporting only. Wait, if it outputs 'ctx-1' which is invalid, it will throw.
      const generateSpy = fakeGenerate({ results: [{ criterionId: 'crit-1', alignment: 'supporting', evidenceIds: ['ctx-1'], directEvidenceIds: [], supportingEvidenceIds: ['ctx-1'], reasoning: 'Personal context' }] });
      
      await expect(reasonAboutCriteria({
        criteria: dummyCriteria,
        evidenceByCriterion: { 'crit-1': dummyEvidence },
        personalContext: { coreIdentity: ['ctx-1'], motivations: [], direction: [] },
        generate: generateSpy,
      })).rejects.toThrow(BatchReasoningError);
    });

    test('7. Output missing when no relevant evidence', async () => {
      const generateSpy = fakeGenerate({ results: [{ criterionId: 'crit-1', alignment: 'missing', evidenceIds: [], directEvidenceIds: [], supportingEvidenceIds: [], reasoning: 'none' }] });
      
      const results = await reasonAboutCriteria({
        criteria: dummyCriteria,
        evidenceByCriterion: { 'crit-1': [] },
        personalContext,
        generate: generateSpy,
      });

      expect(results[0].alignment).toBe('missing');
    });

    test('8. One batch failure doesn\'t destroy other batch results', async () => {
      const criteria: MatchingCriterion[] = [
        { id: 'crit-1', label: 'C1', description: 'd', category: 'competency', expectedSignals: [], sourceRefs: [] },
        { id: 'crit-2', label: 'C2', description: 'd', category: 'academic', expectedSignals: [], sourceRefs: [] },
      ];
      
      let callCount = 0;
      const generateSpy = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Batch 1 failed');
        }
        return { data: { results: [{ criterionId: 'crit-2', alignment: 'missing', evidenceIds: [], directEvidenceIds: [], supportingEvidenceIds: [], reasoning: 'ok' }] }, meta: {} as any };
      });

      let error: BatchReasoningError | null = null;
      try {
         await reasonAboutCriteria({
          criteria,
          evidenceByCriterion: {},
          personalContext,
          generate: generateSpy,
        });
      } catch (e) {
        error = e as BatchReasoningError;
      }

      expect(error).not.toBeNull();
      expect(error?.partialSignals.length).toBe(1);
      expect(error?.partialSignals[0].criterionId).toBe('crit-2');
    });
  });

  describe('generateMatchingSummary', () => {
    const dummyFit: FitSignal = { criterionId: 'crit-1', alignment: 'strong', reasoning: '', evidenceIds: ['ev-1'], directEvidenceIds: ['ev-1'], supportingEvidenceIds: [], criterionLabel: 'a', category: 'b', criterionSourceRefs: [], inputHash: 'hash' };
    const dummyArgs = {
      academicRequirements: [],
      programmeAlignment: [dummyFit],
      strengths: [],
      gaps: [],
      positioningOpportunities: [],
      scholarshipAlignment: null,
      programmeFit: { rating: 'good', reasoning: 'ok' } as any,
    };

    test('9. Summary receives structured results only', async () => {
      const generateSpy = fakeGenerateWithSpy({ criterionIds: ['crit-1'], evidenceIds: ['ev-1'], academicSummary: 'a', alignmentSummary: 'b', strengthSummary: 'c', gapSummary: 'd', positioningSummary: 'e', scholarshipSummary: null });
      
      await generateMatchingSummary({
        ...dummyArgs,
        generate: generateSpy,
      });

      expect(generateSpy).toHaveBeenCalledTimes(1);
      const parsedPrompt = JSON.parse(generateSpy.mock.calls[0][0].userPrompt);
      expect(parsedPrompt).toHaveProperty('programmeAlignment');
      expect(parsedPrompt).toHaveProperty('programmeFit');
    });

    test('10. Summary called exactly once per report', async () => {
      const generateSpy = fakeGenerateWithSpy({ criterionIds: ['crit-1'], evidenceIds: ['ev-1'], academicSummary: 'a', alignmentSummary: 'b', strengthSummary: 'c', gapSummary: 'd', positioningSummary: 'e', scholarshipSummary: null });
      await generateMatchingSummary({ ...dummyArgs, generate: generateSpy });
      expect(generateSpy).toHaveBeenCalledTimes(1);
    });

    test('11. Summary output has valid criterionIds and evidenceIds', async () => {
      const generateSpy = fakeGenerateWithSpy({ criterionIds: ['crit-1'], evidenceIds: ['ev-1'], academicSummary: 'a', alignmentSummary: 'b', strengthSummary: 'c', gapSummary: 'd', positioningSummary: 'e', scholarshipSummary: null });
      const res = await generateMatchingSummary({ ...dummyArgs, generate: generateSpy });
      expect(res.criterionIds).toContain('crit-1');
      expect(res.evidenceIds).toContain('ev-1');
    });

    test('12. Summary with unknown ID rejected', async () => {
      const generateSpy = fakeGenerate({ criterionIds: ['crit-unknown'], evidenceIds: ['ev-1'], academicSummary: 'a', alignmentSummary: 'b', strengthSummary: 'c', gapSummary: 'd', positioningSummary: 'e', scholarshipSummary: null });
      await expect(generateMatchingSummary({ ...dummyArgs, generate: generateSpy })).rejects.toThrow('Unknown criterion ID in summary: crit-unknown');
    });

    test('13. Summary failure throws (no fallback)', async () => {
      const generateSpy = vi.fn().mockRejectedValue(new Error('Summary failed'));
      await expect(generateMatchingSummary({ ...dummyArgs, generate: generateSpy })).rejects.toThrow('Summary failed');
    });

    test('14. Summary containing forbidden phrases rejected', async () => {
      const generateSpy = fakeGenerate({ criterionIds: ['crit-1'], evidenceIds: ['ev-1'], academicSummary: 'a', alignmentSummary: 'Great admission chance', strengthSummary: 'c', gapSummary: 'd', positioningSummary: 'e', scholarshipSummary: null });
      await expect(generateMatchingSummary({ ...dummyArgs, generate: generateSpy })).rejects.toThrow('Summary contains forbidden phrase: admission chance');
    });
  });
});
