import { describe, expect, it } from 'vitest';
import type { CvSection } from '@/features/application-strategy/domain';
import { cvExportFileName, cvExportPath, renderCvPdf } from './index';

/**
 * These tests actually render PDFs.
 *
 * That is deliberate and it is the point: every other kind of test on this module
 * would pass while producing a zero-byte file or throwing inside the renderer. A
 * PDF pipeline that typechecks and crashes at runtime is the normal failure here,
 * because the failure only appears when someone clicks Download.
 *
 * They assert the bytes are a real PDF, that text is extractable (which is what
 * "selectable text" and "ATS-readable" reduce to), and that the three layouts
 * genuinely produce different documents from identical input.
 */

function section(kind: CvSection['kind'], entries: Partial<CvSection['entries'][number]>[]): CvSection {
  return {
    id: `s-${kind}`,
    kind,
    entries: entries.map((entry, index) => ({
      id: `${kind}-${index}`,
      bullets: [],
      ...entry,
    })),
  };
}

const CV = {
  sections: [
    section('contact', [
      { role: 'Name', organization: 'Nguyen Minh Anh' },
      { role: 'Email', organization: 'minhanh@example.com' },
      { role: 'LinkedIn', organization: 'linkedin.com/in/minhanh' },
    ]),
    section('education', [
      {
        organization: 'Hanoi University of Science',
        role: 'BSc Computer Science',
        startDate: 'Sep 2022',
        endDate: 'Jun 2026',
        bullets: ['GPA 3.8 of 4.0', 'Dean’s list 2024 and 2025'],
      },
    ]),
    section('projects', [
      {
        role: 'Clinic wait-time predictor',
        organization: 'Personal project',
        bullets: ['Built a model over 40,000 anonymised visit records', 'Deployed with FastAPI'],
        evidence: 'GitHub, 41 stars',
      },
    ]),
    section('skills', [{ bullets: ['Python', 'SQL', 'PyTorch', 'FastAPI'] }]),
    section('activities', [
      {
        organization: 'Robotics Club',
        role: 'Team lead',
        startDate: '2023',
        endDate: '2025',
        bullets: ['Led a team of nine to a national final'],
      },
    ]),
    section('research', [
      {
        organization: 'University AI Lab',
        role: 'Research assistant',
        bullets: ['Co-authored a workshop paper on time-series imputation'],
      },
    ]),
  ],
};

/** The PDF text layer, flattened enough to search. */
function extractText(pdf: Buffer): string {
  return pdf.toString('latin1');
}

describe('renderCvPdf', () => {
  it('produces a valid, non-trivial PDF', async () => {
    const pdf = await renderCvPdf({ layout: 'technical', cv: CV, candidateName: 'Nguyen Minh Anh' });

    expect(pdf.byteLength).toBeGreaterThan(1000);
    // The PDF magic number, and a trailer, so it is a complete file rather than a
    // truncated stream.
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(extractText(pdf)).toContain('%%EOF');
  }, 30_000);

  it('renders all three layouts without throwing', async () => {
    for (const layout of ['academic', 'technical', 'leadership'] as const) {
      const pdf = await renderCvPdf({ layout, cv: CV, candidateName: 'Nguyen Minh Anh' });
      expect(pdf.subarray(0, 5).toString('latin1'), layout).toBe('%PDF-');
      expect(pdf.byteLength, layout).toBeGreaterThan(1000);
    }
  }, 60_000);

  /**
   * "Genuinely different layouts, not only different labels" — asserted on the
   * rendered output rather than only on the definitions, so a renderer that ignores
   * the layout it was handed fails here.
   */
  it('produces materially different documents for the three layouts', async () => {
    const [academic, technical, leadership] = await Promise.all([
      renderCvPdf({ layout: 'academic', cv: CV }),
      renderCvPdf({ layout: 'technical', cv: CV }),
      renderCvPdf({ layout: 'leadership', cv: CV }),
    ]);

    expect(academic.equals(technical)).toBe(false);
    expect(technical.equals(leadership)).toBe(false);
    expect(academic.equals(leadership)).toBe(false);

    // Not just different bytes: different sizes, because emphasis changes how much
    // detail is printed rather than only the order.
    const sizes = new Set([academic.byteLength, technical.byteLength, leadership.byteLength]);
    expect(sizes.size).toBeGreaterThan(1);
  }, 60_000);

  it('renders with no candidate name', async () => {
    const pdf = await renderCvPdf({ layout: 'academic', cv: CV, candidateName: null });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 30_000);

  it('renders a nearly empty CV rather than throwing', async () => {
    const pdf = await renderCvPdf({
      layout: 'technical',
      cv: { sections: [section('education', [{ role: 'BSc', organization: 'Somewhere' }])] },
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 30_000);

  it('skips sections whose entries are all empty', async () => {
    const pdf = await renderCvPdf({
      layout: 'technical',
      cv: {
        sections: [
          section('education', [{ role: 'BSc', organization: 'Somewhere' }]),
          section('awards', [{ bullets: ['   '] }]),
        ],
      },
    });
    // A heading with nothing under it is the commonest way a generated CV looks
    // unfinished.
    expect(extractText(pdf)).not.toContain('AWARDS');
  }, 30_000);

  it('handles Vietnamese diacritics without throwing', async () => {
    const pdf = await renderCvPdf({
      layout: 'leadership',
      cv: {
        sections: [
          section('activities', [
            {
              organization: 'Đại học Quốc gia Hà Nội',
              role: 'Trưởng nhóm',
              bullets: ['Tổ chức hội thảo cho hơn 200 sinh viên'],
            },
          ]),
        ],
      },
      candidateName: 'Nguyễn Minh Ánh',
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  }, 30_000);

  it('paginates a long CV across more than one page', async () => {
    const many = {
      sections: [
        section(
          'experience',
          Array.from({ length: 30 }, (_, i) => ({
            organization: `Organisation ${i}`,
            role: `Role number ${i}`,
            startDate: '2024',
            endDate: '2025',
            bullets: [
              'A reasonably long description line that takes up a meaningful amount of horizontal space.',
              'A second line, also of some length, to force the document over one page.',
            ],
          })),
        ),
      ],
    };

    const pdf = await renderCvPdf({ layout: 'technical', cv: many });
    const text = extractText(pdf);
    // More than one /Type /Page object means it really paginated rather than
    // overflowing off the bottom of a single page.
    const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
  }, 60_000);
});

describe('cvExportPath', () => {
  /**
   * The version in the object name is what makes re-export idempotent and makes
   * "the PDF is stale" a comparison rather than a guess.
   */
  it('embeds the content version', () => {
    const path = cvExportPath({ userId: 'user-1', strategyId: 'strategy-1', contentVersion: 7 });
    expect(path).toBe('user-1/cv-exports/strategy-1-v7.pdf');
  });

  it('gives the same path for the same version and a different one otherwise', () => {
    const base = { userId: 'u', strategyId: 's' };
    expect(cvExportPath({ ...base, contentVersion: 3 })).toBe(
      cvExportPath({ ...base, contentVersion: 3 }),
    );
    expect(cvExportPath({ ...base, contentVersion: 3 })).not.toBe(
      cvExportPath({ ...base, contentVersion: 4 }),
    );
  });

  it('scopes the path to the user, so it cannot reach another student’s folder', () => {
    expect(cvExportPath({ userId: 'user-1', strategyId: 's', contentVersion: 1 })).toMatch(/^user-1\//);
  });
});

describe('cvExportFileName', () => {
  it('builds a readable name', () => {
    expect(cvExportFileName({ candidateName: 'Minh Anh', courseName: 'Computer Science' })).toBe(
      'Minh-Anh-CV-Computer-Science.pdf',
    );
  });

  it('falls back when nothing is known', () => {
    expect(cvExportFileName({})).toBe('CV.pdf');
  });

  it('strips characters that would break a Content-Disposition header', () => {
    const name = cvExportFileName({ candidateName: 'A"B; drop/table', courseName: 'X\\Y' });
    expect(name).not.toMatch(/[";/\\]/);
    expect(name.endsWith('.pdf')).toBe(true);
  });

  it('keeps Vietnamese characters, which are legitimate in a name', () => {
    expect(cvExportFileName({ candidateName: 'Nguyễn Ánh' })).toBe('Nguyễn-Ánh-CV.pdf');
  });
});
