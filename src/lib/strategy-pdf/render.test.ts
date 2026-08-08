import { describe, expect, it } from 'vitest';
import { renderStrategyPdf, strategyExportFileName, strategyExportPath } from './index';
import type { StrategyPdfProps } from './index';

/**
 * These tests actually render PDFs — see `lib/cv-pdf/render.test.ts`'s header
 * on why: a PDF pipeline that typechecks and crashes at runtime is the
 * normal failure mode here.
 */

function directionOption(overrides: Partial<StrategyPdfProps['recommendation']['directionOptions'][number]> = {}) {
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

function recommendation(
  overrides: Partial<StrategyPdfProps['recommendation']> = {},
): StrategyPdfProps['recommendation'] {
  return {
    directionOptions: [directionOption(), directionOption({ name: 'Education Entrepreneurship', overall: 7.8 })],
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
    createdAt: '2026-08-08T00:00:00Z',
    ...overrides,
  };
}

function extractText(pdf: Buffer): string {
  return pdf.toString('latin1');
}

describe('renderStrategyPdf', () => {
  it('produces a valid, non-trivial PDF', async () => {
    const pdf = await renderStrategyPdf({
      recommendation: recommendation(),
      candidateName: 'Nguyen Minh Anh',
      programmeName: 'BSc Business Analytics at Example University',
    });

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(extractText(pdf)).toContain('%%EOF');
  }, 30_000);

  it('renders with no candidate name or programme name', async () => {
    const pdf = await renderStrategyPdf({ recommendation: recommendation() });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 30_000);

  it('handles Vietnamese diacritics without throwing', async () => {
    const pdf = await renderStrategyPdf({
      recommendation: recommendation({
        narrative: 'Trong suốt hành trình, một câu hỏi liên tục xuất hiện...',
      }),
      candidateName: 'Nguyễn Minh Ánh',
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  }, 30_000);

  it('paginates across more than one page', async () => {
    const pdf = await renderStrategyPdf({ recommendation: recommendation() });
    const text = extractText(pdf);
    const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
  }, 30_000);
});

describe('strategyExportPath', () => {
  it('is keyed by the recommendation id', () => {
    const path = strategyExportPath({ userId: 'user-1', recommendationId: 'rec-1' });
    expect(path).toBe('user-1/strategy-exports/rec-1.pdf');
  });

  it('scopes the path to the user, so it cannot reach another student’s folder', () => {
    expect(strategyExportPath({ userId: 'user-1', recommendationId: 'rec-1' })).toMatch(/^user-1\//);
  });
});

describe('strategyExportFileName', () => {
  it('builds a readable name', () => {
    expect(strategyExportFileName({ candidateName: 'Minh Anh' })).toBe('Minh-Anh-Personalized-Strategy.pdf');
  });

  it('falls back when nothing is known', () => {
    expect(strategyExportFileName({})).toBe('Personalized-Strategy.pdf');
  });

  it('strips characters that would break a Content-Disposition header', () => {
    const name = strategyExportFileName({ candidateName: 'A"B; drop/table' });
    expect(name).not.toMatch(/[";/\\]/);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});
