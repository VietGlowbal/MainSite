import { describe, expect, it } from 'vitest';
import {
  EMPTY_PG_ACADEMIC,
  EMPTY_PHD_ACADEMIC,
  academicFromProfile,
  pgAcademicComplete,
  phdAcademicComplete,
  pgAcademicFromProfile,
  phdAcademicFromProfile,
  readAcademicDraft,
  readPgAcademicDraft,
  readPhdAcademicDraft,
} from './draft';

describe('PG and PhD branching domain helpers', () => {
  describe('pgAcademicComplete', () => {
    it('returns false for empty or null inputs', () => {
      expect(pgAcademicComplete(null)).toBe(false);
      expect(pgAcademicComplete(undefined)).toBe(false);
      expect(pgAcademicComplete(EMPTY_PG_ACADEMIC)).toBe(false);
    });

    it('returns false if any required field is missing', () => {
      expect(
        pgAcademicComplete({
          degree: '',
          institution: 'National University of Singapore',
          field_of_study: 'Computer Science',
          gpa_scale: '4.0 scale',
          gpa: '3.8',
          completion_year: '2024',
        }),
      ).toBe(false);

      expect(
        pgAcademicComplete({
          degree: 'Bachelor of Science',
          institution: '',
          field_of_study: 'Computer Science',
          gpa_scale: '4.0 scale',
          gpa: '3.8',
          completion_year: '2024',
        }),
      ).toBe(false);

      expect(
        pgAcademicComplete({
          degree: 'Bachelor of Science',
          institution: 'National University of Singapore',
          field_of_study: '',
          gpa_scale: '4.0 scale',
          gpa: '3.8',
          completion_year: '2024',
        }),
      ).toBe(false);

      expect(
        pgAcademicComplete({
          degree: 'Bachelor of Science',
          institution: 'National University of Singapore',
          field_of_study: 'Computer Science',
          gpa_scale: '4.0 scale',
          gpa: '',
          completion_year: '2024',
        }),
      ).toBe(false);
    });

    it('validates GPA against scale formats', () => {
      // 4.0 scale invalid (> 4.0)
      expect(
        pgAcademicComplete({
          degree: 'Bachelor of Science',
          institution: 'NUS',
          field_of_study: 'CS',
          gpa_scale: '4.0 scale',
          gpa: '4.5',
          completion_year: '2024',
        }),
      ).toBe(false);

      // 10-point scale invalid (> 10.0)
      expect(
        pgAcademicComplete({
          degree: 'Bachelor of Science',
          institution: 'HUST',
          field_of_study: 'CS',
          gpa_scale: '10-point scale',
          gpa: '10.5',
          completion_year: '2024',
        }),
      ).toBe(false);

      // 100% scale invalid (> 100)
      expect(
        pgAcademicComplete({
          degree: 'Bachelor of Science',
          institution: 'NUS',
          field_of_study: 'CS',
          gpa_scale: '100% Percentage',
          gpa: '105',
          completion_year: '2024',
        }),
      ).toBe(false);

      // Valid 4.0 scale
      expect(
        pgAcademicComplete({
          degree: 'Bachelor of Science',
          institution: 'NUS',
          field_of_study: 'CS',
          gpa_scale: '4.0 scale',
          gpa: '3.75',
          completion_year: '2024',
        }),
      ).toBe(true);
    });
  });

  describe('phdAcademicComplete', () => {
    it('returns false for empty or null inputs', () => {
      expect(phdAcademicComplete(null)).toBe(false);
      expect(phdAcademicComplete(undefined)).toBe(false);
      expect(phdAcademicComplete(EMPTY_PHD_ACADEMIC)).toBe(false);
    });

    it('strictly requires bachelor degree history', () => {
      // Missing bachelor degree even with master degree and research experience
      expect(
        phdAcademicComplete({
          bachelor_degree: '',
          master_degree: 'MSc Data Science, NTU',
          institution: 'NTU',
          research_experience: '3 years in NLP lab, 1 ACL paper',
          research_direction: 'Multimodal generative models for biomedical literature',
          supervisor_fit: 'Prof. John Doe in Vision & NLP group',
        }),
      ).toBe(false);
    });

    it('requires research direction, experience, and supervisor fit', () => {
      const base = {
        bachelor_degree: 'BSc Computer Science, NUS',
        master_degree: 'MSc Data Science, NTU',
        institution: 'NTU',
        research_experience: '3 years in NLP lab',
        research_direction: 'Multimodal models',
        supervisor_fit: 'Prof. John Doe',
      };

      expect(phdAcademicComplete({ ...base, research_experience: '' })).toBe(false);
      expect(phdAcademicComplete({ ...base, research_direction: '' })).toBe(false);
      expect(phdAcademicComplete({ ...base, supervisor_fit: '' })).toBe(false);

      // Fully valid
      expect(phdAcademicComplete(base)).toBe(true);
      // Valid even if master_degree is omitted
      expect(phdAcademicComplete({ ...base, master_degree: '' })).toBe(true);
      // Valid with publications
      expect(phdAcademicComplete({ ...base, publications: '1 NeurIPS workshop paper' })).toBe(true);
    });
  });

  describe('readPgAcademicDraft and readPhdAcademicDraft', () => {
    it('reads valid PG academic drafts and ignores malformed inputs', () => {
      expect(readPgAcademicDraft(null)).toBeNull();
      expect(readPgAcademicDraft('not an object')).toBeNull();
      expect(readPgAcademicDraft(123)).toBeNull();

      const parsed = readPgAcademicDraft({
        degree: 'BSc',
        institution: 'NUS',
        field_of_study: 'CS',
        gpa_scale: '4.0 scale',
        gpa: '3.9',
        completion_year: '2023',
      });
      expect(parsed).toEqual({
        degree: 'BSc',
        institution: 'NUS',
        field_of_study: 'CS',
        gpa_scale: '4.0 scale',
        gpa: '3.9',
        classification: '',
        completion_year: '2023',
      });
    });

    it('reads valid PhD academic drafts including optional publications', () => {
      expect(readPhdAcademicDraft(null)).toBeNull();
      expect(readPhdAcademicDraft('not an object')).toBeNull();

      const parsed = readPhdAcademicDraft({
        bachelor_degree: 'BSc CS, NUS',
        master_degree: 'MSc AI, NTU',
        institution: 'NTU',
        research_experience: 'NLP lab',
        publications: '1 paper at ACL',
        research_direction: 'LLM reasoning',
        supervisor_fit: 'Prof. Smith',
      });
      expect(parsed).toEqual({
        bachelor_degree: 'BSc CS, NUS',
        master_degree: 'MSc AI, NTU',
        institution: 'NTU',
        research_experience: 'NLP lab',
        publications: '1 paper at ACL',
        research_direction: 'LLM reasoning',
        supervisor_fit: 'Prof. Smith',
      });
    });
  });

  describe('pgAcademicFromProfile and phdAcademicFromProfile hydration', () => {
    it('hydrates PG academic from structured JSONB profile payload', () => {
      const profile = {
        postgraduate_academic: {
          degree: 'Bachelor of Engineering',
          institution: 'Oxford',
          field_of_study: 'Engineering Science',
          gpa_scale: '4.0 scale',
          gpa: '3.85',
          completion_year: '2022',
        },
      };

      const hydrated = pgAcademicFromProfile(profile);
      expect(hydrated.degree).toBe('Bachelor of Engineering');
      expect(hydrated.institution).toBe('Oxford');
      expect(hydrated.field_of_study).toBe('Engineering Science');
      expect(hydrated.gpa).toBe('3.85');
      expect(hydrated.completion_year).toBe('2022');
    });

    it('hydrates PG academic from canonical fallback columns if JSONB is missing', () => {
      const profile = {
        current_qualification: 'Bachelor of Business Administration',
        current_institution: 'Monash University',
        gpa_scale: '4.0 scale',
        gpa_value: 3.7,
        graduation_year: 2024,
      };

      const hydrated = pgAcademicFromProfile(profile);
      expect(hydrated.degree).toBe('Bachelor of Business Administration');
      expect(hydrated.institution).toBe('Monash University');
      expect(hydrated.gpa).toBe('3.7');
      expect(hydrated.completion_year).toBe('2024');
    });

    it('hydrates PhD academic from structured JSONB profile payload', () => {
      const profile = {
        phd_academic: {
          bachelor_degree: 'BSc Biology, Cambridge',
          master_degree: 'MPhil Genetics, Cambridge',
          institution: 'Cambridge',
          research_experience: 'Crispr gene editing experiments',
          publications: 'Nature Comms 2023',
          research_direction: 'Therapeutic genome editing',
          supervisor_fit: 'Prof. Watson',
        },
      };

      const hydrated = phdAcademicFromProfile(profile);
      expect(hydrated.bachelor_degree).toBe('BSc Biology, Cambridge');
      expect(hydrated.master_degree).toBe('MPhil Genetics, Cambridge');
      expect(hydrated.publications).toBe('Nature Comms 2023');
      expect(hydrated.research_direction).toBe('Therapeutic genome editing');
    });

    it('hydrates PhD academic from canonical fallback columns if JSONB is missing', () => {
      const profile = {
        current_qualification: 'MSc Biochemistry',
        current_institution: 'Imperial College London',
        academic_background: 'Structural biology crystallography',
        goals: 'Cryo-EM investigation of membrane proteins',
      };

      const hydrated = phdAcademicFromProfile(profile);
      expect(hydrated.master_degree).toBe('MSc Biochemistry');
      expect(hydrated.institution).toBe('Imperial College London');
      expect(hydrated.research_experience).toBe('Structural biology crystallography');
      expect(hydrated.research_direction).toBe('Cryo-EM investigation of membrane proteins');
    });
  });

  describe('UG persistence compatibility', () => {
    it('preserves graduation_year in academicFromProfile and readAcademicDraft', () => {
      const profile = {
        curriculum: ['Vietnamese National Curriculum'],
        curriculum_grades: [{ curriculum: 'Vietnamese National Curriculum', scale: '10-point scale', grade: '9.0' }],
        graduation_year: 2025,
      };

      const academic = academicFromProfile(profile);
      expect(academic.graduation_year).toBe('2025');

      const draft = readAcademicDraft({
        curriculum: ['Vietnamese National Curriculum'],
        scales: { 'Vietnamese National Curriculum': '10-point scale' },
        grades: { 'Vietnamese National Curriculum': '9.0' },
        graduation_year: '2025',
      });
      expect(draft?.graduation_year).toBe('2025');
    });

    it('survives older drafts without graduation_year', () => {
      const draft = readAcademicDraft({
        curriculum: ['Vietnamese National Curriculum'],
        scales: { 'Vietnamese National Curriculum': '10-point scale' },
        grades: { 'Vietnamese National Curriculum': '9.0' },
      });
      expect(draft?.graduation_year).toBeUndefined();
    });
  });
});
