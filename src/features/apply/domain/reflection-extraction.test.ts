import { describe, expect, it } from 'vitest';
import {
  applyEvidenceCandidates,
  evidenceCandidateToItem,
  mergeDuplicate,
  validateEvidenceExtraction,
  type EvidenceCandidate,
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

  it('marks the new record needs_review, sourced from a document, with a readable file name', () => {
    const result = applyEvidenceCandidates(
      [],
      [],
      [
        {
          candidateId: 'a-1',
          kind: 'achievement',
          confidence: 'high',
          data: { category: 'academic_award', title: 'IELTS Academic 8.0' },
          sourceRefs: [{ documentId: 'doc-cv', page: 2, quote: 'IELTS Academic 8.0' }],
        },
      ],
      { 'doc-cv': 'James_Lapslie_CV.pdf' },
    );

    const item = result.achievements[0];
    expect(item?.reviewStatus).toBe('needs_review');
    expect(item?.sourceType).toBe('document');
    expect(item?.sources).toEqual([
      { documentId: 'doc-cv', fileName: 'James_Lapslie_CV.pdf', page: 2, quote: 'IELTS Academic 8.0' },
    ]);
  });

  it('flags a same-title candidate as a duplicate instead of silently dropping it', () => {
    // The previous behaviour discarded it, which is indistinguishable from
    // the extraction having missed it entirely.
    const candidate: EvidenceCandidate = {
      candidateId: 'b-2',
      kind: 'achievement',
      confidence: 'high',
      data: { category: 'academic_award', title: 'IELTS Academic 8.0' },
      sourceRefs: [
        { documentId: 'doc-cert', page: 1, quote: 'IELTS Academic 8.0' },
      ],
    };

    const result = applyEvidenceCandidates(
      [{ id: 'existing-1', category: 'academic_award', title: 'IELTS Academic 8.0' }],
      [],
      [candidate],
    );

    expect(result.achievements).toHaveLength(1);
    expect(result.duplicates).toEqual([
      { candidate, existingId: 'existing-1', existingTitle: 'IELTS Academic 8.0' },
    ]);
  });
});

describe('mergeDuplicate', () => {
  it('fills blanks on the existing record without touching what it already had', () => {
    const merged = mergeDuplicate(
      {
        id: 'existing-1',
        category: 'academic_award',
        title: 'IELTS Academic 8.0',
        organisation: 'Handwritten note kept by the student',
        sources: [{ documentId: 'doc-cv', fileName: 'CV.pdf', page: 2 }],
      },
      {
        id: 'extracted-b-2',
        category: 'academic_award',
        title: 'IELTS Academic 8.0',
        organisation: 'Should not overwrite the existing organisation',
        year: 2025,
        sources: [{ documentId: 'doc-cert', fileName: 'IELTS_certificate.pdf', page: 1 }],
        reviewStatus: 'needs_review',
        sourceType: 'document',
      },
    );

    expect(merged.id).toBe('existing-1');
    expect(merged.organisation).toBe('Handwritten note kept by the student');
    expect(merged.year).toBe(2025);
    expect(merged.sources).toEqual([
      { documentId: 'doc-cv', fileName: 'CV.pdf', page: 2 },
      { documentId: 'doc-cert', fileName: 'IELTS_certificate.pdf', page: 1 },
    ]);
  });
});

describe('evidenceCandidateToItem', () => {
  it('is the "Keep both" path: builds the same shape apply would, unconditionally', () => {
    const candidate: EvidenceCandidate = {
      candidateId: 'c-3',
      kind: 'activity',
      confidence: 'medium',
      data: { category: 'mentoring', title: 'Volunteer Coding Tutor' },
      sourceRefs: [{ documentId: 'doc-cv', page: 1, quote: 'Volunteer Coding Tutor' }],
    };

    const item = evidenceCandidateToItem(candidate, { 'doc-cv': 'CV.pdf' });
    expect(item.id).toBe('extracted-c-3');
    expect(item.title).toBe('Volunteer Coding Tutor');
    expect(item.reviewStatus).toBe('needs_review');
  });
});
