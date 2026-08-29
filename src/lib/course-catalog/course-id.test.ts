import { describe, expect, it } from 'vitest';
import { resolveCourseId, type CourseCatalogueCandidate } from './course-id';

const vinUni: CourseCatalogueCandidate = {
  id: 'c0a00000-0000-4000-a000-000000000004',
  course_name: 'Bachelor of Business Administration',
  course_url: 'https://vinuni.edu.vn/college-of-business-management/bachelor-of-business-administration/',
  canonical_url: 'https://vinuni.edu.vn/college-of-business-management/bachelor-of-business-administration/',
};

describe('resolveCourseId', () => {
  it('matches the catalogue row by programme URL before scraping', () => {
    expect(
      resolveCourseId(
        [vinUni],
        'Bachelor of Business Administration',
        'https://vinuni.edu.vn/college-of-business-management/bachelor-of-business-administration/?utm_source=apply',
      ),
    ).toBe(vinUni.id);
  });

  it('falls back to the exact programme name when the URL is absent', () => {
    expect(resolveCourseId([vinUni], '  bachelor   of business administration ', null)).toBe(
      vinUni.id,
    );
  });
});
