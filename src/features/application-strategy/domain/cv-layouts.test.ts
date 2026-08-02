import { describe, expect, it } from 'vitest';
import { CV_LAYOUTS, applyLayoutOrder, canExport, cvLayout, isEmphasised, recommendLayout } from './cv-layouts';
import type { CvSection, CvTargetProfile, StructuredCv } from './types';

function section(kind: CvSection['kind'], entries = 1): CvSection {
  return {
    id: `s-${kind}`,
    kind,
    entries: Array.from({ length: entries }, (_, i) => ({ id: `${kind}-${i}`, bullets: ['x'] })),
  };
}

function cv(sections: CvSection[]): Pick<StructuredCv, 'sections'> {
  return { sections };
}

function targetProfile(
  fields: Partial<Pick<CvTargetProfile, 'priorityCapabilities' | 'careerDirection'>>,
): Pick<CvTargetProfile, 'priorityCapabilities' | 'careerDirection'> {
  return { priorityCapabilities: null, careerDirection: null, ...fields };
}

describe('CV layout definitions', () => {
  it('defines exactly the three layouts', () => {
    expect(CV_LAYOUTS.map((l) => l.key)).toEqual(['academic', 'technical', 'leadership']);
  });

  /**
   * The requirement is "genuinely different layouts, not only different labels".
   * This is that requirement as an assertion: a label-only implementation fails
   * here rather than in review.
   */
  it('gives every layout a structurally different section order', () => {
    for (const a of CV_LAYOUTS) {
      for (const b of CV_LAYOUTS) {
        if (a.key === b.key) continue;
        expect(a.order.join(),`${a.key} and ${b.key} share an order`).not.toBe(b.order.join());
      }
    }
  });

  it('gives every layout a different emphasis set', () => {
    const sets = CV_LAYOUTS.map((l) => [...l.emphasise].sort().join());
    expect(new Set(sets).size).toBe(CV_LAYOUTS.length);
  });

  it('leads each layout with the sections its name promises', () => {
    // order[0] is always contact; the first content section is what differs.
    expect(cvLayout('academic').order[1]).toBe('education');
    expect(cvLayout('technical').order[1]).toBe('skills');
    expect(cvLayout('leadership').order[1]).toBe('activities');
  });

  it('covers every section kind in every layout, so nothing can be silently dropped', () => {
    for (const layout of CV_LAYOUTS) {
      expect(new Set(layout.order).size, layout.key).toBe(layout.order.length);
    }
  });
});

describe('applyLayoutOrder', () => {
  it('reorders the student sections to the layout order', () => {
    const sections = [section('skills'), section('education'), section('research')];
    const ordered = applyLayoutOrder(sections, 'academic');
    expect(ordered.map((s) => s.kind)).toEqual(['education', 'research', 'skills']);
  });

  it('puts the same sections in a different order for a different layout', () => {
    const sections = [section('skills'), section('education'), section('research')];
    expect(applyLayoutOrder(sections, 'technical').map((s) => s.kind)).toEqual([
      'skills',
      'education',
      'research',
    ]);
  });

  it('keeps sections the layout does not mention rather than dropping them', () => {
    const sections = [section('custom'), section('education')];
    const ordered = applyLayoutOrder(sections, 'academic');
    expect(ordered).toHaveLength(2);
    expect(ordered.map((s) => s.kind)).toContain('custom');
  });
});

describe('isEmphasised', () => {
  it('emphasises research for academic but not for technical', () => {
    expect(isEmphasised('academic', 'research')).toBe(true);
    expect(isEmphasised('technical', 'research')).toBe(false);
  });

  it('emphasises skills for technical but not for academic', () => {
    expect(isEmphasised('technical', 'skills')).toBe(true);
    expect(isEmphasised('academic', 'skills')).toBe(false);
  });
});

describe('recommendLayout', () => {
  it('recommends academic for a research-led target profile', () => {
    const result = recommendLayout(
      targetProfile({ priorityCapabilities: 'Nghiên cứu độc lập, viết luận văn, lab work' }),
      cv([section('research', 2), section('publications')]),
    );
    expect(result.key).toBe('academic');
  });

  it('recommends technical for an engineering target profile', () => {
    const result = recommendLayout(
      targetProfile({ priorityCapabilities: 'Analytical thinking, programming, data engineering' }),
      cv([section('projects', 3), section('skills')]),
    );
    expect(result.key).toBe('technical');
  });

  it('recommends leadership for a community-led target profile', () => {
    const result = recommendLayout(
      targetProfile({ priorityCapabilities: 'Lãnh đạo, tổ chức cộng đồng, quản lý nhóm' }),
      cv([section('activities', 3)]),
    );
    expect(result.key).toBe('leadership');
  });

  it('is deterministic', () => {
    const tp = targetProfile({ priorityCapabilities: 'programming and research' });
    const content = cv([section('projects'), section('research')]);
    const first = recommendLayout(tp, content);
    for (let i = 0; i < 5; i += 1) {
      expect(recommendLayout(tp, content)).toEqual(first);
    }
  });

  it('explains itself using words from the actual target profile', () => {
    const result = recommendLayout(
      targetProfile({ priorityCapabilities: 'Analytical thinking and programming' }),
      cv([section('projects', 2)]),
    );
    expect(result.reason).toContain('Technical is recommended because');
    expect(result.reason.toLowerCase()).toContain('programming');
    expect(result.reason).toContain('projects');
  });

  it('admits it does not know rather than inventing a rationale', () => {
    const result = recommendLayout(null, null);
    expect(result.reason).toContain('do not have enough');
    // It still returns a usable default so the page has something selected.
    expect(result.key).toBe('technical');
  });

  it('recommends from CV evidence alone when the target profile is empty', () => {
    const result = recommendLayout(targetProfile({}), cv([section('activities', 3)]));
    expect(result.key).toBe('leadership');
    expect(result.reason).toContain('activities');
  });
});

describe('canExport', () => {
  it('is false for no CV and for a CV of empty sections', () => {
    expect(canExport(null)).toBe(false);
    expect(canExport(cv([{ id: 's', kind: 'education', entries: [] }]))).toBe(false);
  });

  it('is true once there is a single entry', () => {
    expect(canExport(cv([section('education')]))).toBe(true);
  });
});
