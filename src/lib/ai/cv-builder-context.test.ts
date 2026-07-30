import { describe, expect, it } from 'vitest';
import { buildCvBuilderContextData } from './cv-builder-context';

describe('buildCvBuilderContextData', () => {
  it('maps Supabase fields into cited target sources and an editable CV prefill', () => {
    const context = buildCvBuilderContextData({
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        name: 'Alex Nguyen',
      },
      application: {
        id: 'app-1',
        universityName: 'Example University',
        programmeName: 'BSc Computer Science',
        universityId: 9,
        courseId: 'course-1',
        degreeLevel: 'Bachelor',
        subject: 'Computer Science',
      },
      university: {
        name: 'Example University',
        country: 'United Kingdom',
        qs_rank: 25,
        strengths: 'Project-based learning',
        teaching_style: 'Hands-on seminars',
        international_environment: 'Global cohort',
        best_for: 'Curious builders',
        employability: 'Strong technology outcomes',
      },
      course: {
        id: 'course-1',
        course_name: 'BSc Computer Science',
        subject: 'Computer Science',
        degree_level: 'Bachelor',
        study_mode: 'On campus',
        duration: '3 years',
        entry_requirements_summary: 'Strong mathematics preparation',
        search_keywords: ['programming', 'algorithms'],
        extraction_status: 'extracted',
      },
      profile: {
        phone: '+84 123',
        location: 'Hanoi',
        current_institution: 'Example High School',
        current_qualification: 'High School Diploma',
        academic_background: 'STEM track',
        career_interests: ['Software Engineering'],
        goals: 'Build accessible learning tools',
        achievements: ['Regional robotics finalist'],
        skills: ['Python', 'Leadership'],
      },
      workExperiences: [
        {
          id: 'work-1',
          company: 'Robotics Club',
          role: 'Team Lead',
          start_date: '2025-01',
          end_date: null,
          is_current: true,
          description: 'Led six students to build a low-cost robot.',
        },
      ],
    });

    expect(context.sourceEntries).toContainEqual({
      ref: 'university:teaching_style',
      value: 'Hands-on seminars',
    });
    expect(context.sourceEntries).toContainEqual({
      ref: 'university:qs_rank',
      value: '25',
    });
    expect(context.sourceEntries).toContainEqual({
      ref: 'course:duration',
      value: '3 years',
    });
    expect(context.validSourceRefs.has('profile:career_interests')).toBe(true);
    expect(context.confidence).toBe('medium');
    expect(context.limitations.join(' ')).toMatch(/module/i);
    expect(context.prefill.personal.fullName).toBe('Alex Nguyen');
    expect(context.prefill.education[0].institution).toBe('Example High School');
    expect(context.prefill.entries[0].contributions[0].text).toContain('six students');
    expect(context.prefill.awards[0].title).toBe('Regional robotics finalist');
  });

  it('keeps an unreviewed programme usable but lowers Target Profile confidence', () => {
    const context = buildCvBuilderContextData({
      user: { id: 'user-1', email: 'alex@example.com', name: 'Alex Nguyen' },
      application: {
        id: 'app-1',
        universityName: 'Example University',
        programmeName: 'Computer Science',
        courseId: 'course-1',
      },
      university: { strengths: 'Research-led teaching' },
      course: {
        id: 'course-1',
        course_name: 'Computer Science',
        degree_level: 'bachelor',
        extraction_status: 'needs_review',
      },
      profile: null,
      workExperiences: [],
    });

    expect(context.confidence).toBe('low');
    expect(context.limitations.join(' ')).toMatch(/awaiting review/i);
    expect(context.validSourceRefs.has('course:course_name')).toBe(true);
  });
});
