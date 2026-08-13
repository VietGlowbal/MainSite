import { describe, expect, it } from 'vitest';
import {
  FIELD_OF_STUDY_GROUPS,
  FIELD_OF_STUDY_TRANSLATIONS,
  FIELD_OF_STUDY_VALUES,
} from './fields-of-study';
import { translations } from './i18n-dictionary';

describe('fields of study taxonomy', () => {
  it('provides a broad, duplicate-free set of canonical subjects', () => {
    expect(FIELD_OF_STUDY_GROUPS.length).toBeGreaterThanOrEqual(12);
    expect(FIELD_OF_STUDY_VALUES.length).toBeGreaterThanOrEqual(250);
    expect(new Set(FIELD_OF_STUDY_VALUES).size).toBe(FIELD_OF_STUDY_VALUES.length);
  });

  it('registers every group and subject in the main i18n dictionary', () => {
    for (const group of FIELD_OF_STUDY_GROUPS) {
      expect(FIELD_OF_STUDY_TRANSLATIONS[group.label]).toBe(group.labelVi);
      expect(translations[group.label]).toBeTruthy();

      for (const [subject, labelVi] of group.subjects) {
        expect(FIELD_OF_STUDY_TRANSLATIONS[subject]).toBe(labelVi);
        expect(translations[subject]).toBeTruthy();
      }
    }
  });
});
