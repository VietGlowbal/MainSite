import { describe, expect, it } from 'vitest';
import {
  applyEvidenceCandidates,
  validateEvidenceExtraction,
} from './reflection-extraction';

const pages = [
  {
    documentId: 'doc-cv',
    page: 1,
    text: 'FIRST PRIZE Hanoi Mathematics Olympiad 2025. Volunteer Coding Tutor at CodeClub.',
  },
];

describe('validateEvidenceExtraction', () => {
  it('accepts candidates only when their quoted evidence exists on the referenced page', () => {
    const result = validateEvidenceExtraction(
      {
        items: [
          {
            candidateId: 'a-1',
            kind: 'achievement',
            confidence: 'high',
            data: {
              category: 'competition',
              title: 'First Prize, Hanoi Mathematics Olympiad',
              competition: 'Hanoi Mathematics Olympiad',
              year: 2025,
            },
            sourceRefs: [
              {
                documentId: 'doc-cv',
                page: 1,
                quote: 'FIRST PRIZE Hanoi Mathematics Olympiad 2025',
              },
            ],
          },
        ],
      },
      pages,
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.rejectedCount).toBe(0);
  });

  it('rejects a hallucinated source quote without discarding valid siblings', () => {
    const result = validateEvidenceExtraction(
      {
        items: [
          {
            candidateId: 'bad',
            kind: 'achievement',
            confidence: 'high',
            data: { category: 'academic_award', title: 'International Gold Medal' },
            sourceRefs: [
              { documentId: 'doc-cv', page: 1, quote: 'International Gold Medal' },
            ],
          },
          {
            candidateId: 'good',
            kind: 'activity',
            confidence: 'medium',
            data: {
              category: 'mentoring',
              title: 'Volunteer Coding Tutor',
              organisation: 'CodeClub',
            },
            sourceRefs: [
              {
                documentId: 'doc-cv',
                page: 1,
                quote: 'Volunteer Coding Tutor at CodeClub',
              },
            ],
          },
        ],
      },
      pages,
    );

    expect(result.candidates.map((item) => item.candidateId)).toEqual(['good']);
    expect(result.rejectedCount).toBe(1);
  });
});

describe('applyEvidenceCandidates', () => {
  it('replaces starter blank rows and keeps existing user-entered rows', () => {
    const result = applyEvidenceCandidates(
      [{ id: 'blank', category: 'academic_award', title: '' }],
      [{ id: 'existing', category: 'leadership', title: 'Student Council' }],
      [
        {
          candidateId: 'a-1',
          kind: 'achievement',
          confidence: 'high',
          data: {
            category: 'competition',
            title: 'First Prize, Hanoi Mathematics Olympiad',
            year: 2025,
          },
          sourceRefs: [
            {
              documentId: 'doc-cv',
              page: 1,
              quote: 'FIRST PRIZE Hanoi Mathematics Olympiad 2025',
            },
          ],
        },
      ],
    );

    expect(result.achievements.map(({ title }) => title)).toEqual([
      'First Prize, Hanoi Mathematics Olympiad',
    ]);
    expect(result.activities.map(({ title }) => title)).toEqual(['Student Council']);
  });
});
