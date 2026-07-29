import { describe, expect, it } from 'vitest';
import {
  applyCvClarificationAnswers,
  CvBuilderFormSchema,
  cvBuilderFormErrorMessage,
  generatedCvEvents,
  parseCvBuilderModelLine,
  renderGeneratedCvText,
  restoreCvBuilderDraft,
  validateTargetProfile,
  type CvBuilderFormV1,
  type CvTargetProfileV1,
  type GeneratedCvV1,
} from './cv-builder';

const form: CvBuilderFormV1 = {
  personal: {
    fullName: 'Alex Nguyen',
    email: 'alex@example.com',
    links: [],
  },
  education: [],
  entries: [
    {
      id: 'entry-1',
      category: 'project',
      title: 'Robotics Project',
      contributions: [
        {
          id: 'K001',
          framework: 'built',
          text: 'Built a low-cost robot for twelve students.',
        },
      ],
    },
  ],
  awards: [],
  skillGroups: [],
};

const targetProfile: CvTargetProfileV1 = {
  universityName: 'Example University',
  programmeName: 'BSc Computer Science',
  universityDna: {
    positioning: {
      text: 'Project-based learning is emphasized.',
      status: 'explicit',
      sourceRefs: ['university:teaching_style'],
    },
    educationalPhilosophy: {
      text: 'Project-based learning is emphasized.',
      status: 'synthesis',
      sourceRefs: ['university:teaching_style'],
    },
    environment: {
      text: 'International learning environment.',
      status: 'explicit',
      sourceRefs: ['university:international_environment'],
    },
    studentSignals: [
      {
        text: 'Students who turn ideas into practical work.',
        status: 'synthesis',
        sourceRefs: ['university:best_for'],
      },
    ],
  },
  programmeDna: {
    objectives: [
      { text: 'Chưa đủ dữ liệu', status: 'unavailable', sourceRefs: [] },
    ],
    modules: [
      { text: 'Chưa đủ dữ liệu', status: 'unavailable', sourceRefs: [] },
    ],
    learningOutcomes: [
      { text: 'Chưa đủ dữ liệu', status: 'unavailable', sourceRefs: [] },
    ],
    competencies: [
      {
        text: 'Programming and analytical problem solving.',
        status: 'synthesis',
        sourceRefs: ['course:subject'],
      },
    ],
    entrySignals: [
      {
        text: 'Strong mathematics preparation.',
        status: 'explicit',
        sourceRefs: ['course:entry_requirements_summary'],
      },
    ],
  },
  careerAlignment: [
    {
      text: 'Software engineering and product development.',
      status: 'synthesis',
      sourceRefs: ['profile:career_interests'],
    },
  ],
  keywords: ['Builder', 'Analytical', 'Collaborative'],
  confidence: 'medium',
  limitations: ['Core modules are unavailable in Supabase.'],
};

describe('CV builder contracts', () => {
  it('rejects more than five contributions for one entry', () => {
    const result = CvBuilderFormSchema.safeParse({
      ...form,
      entries: [
        {
          ...form.entries[0],
          contributions: Array.from({ length: 6 }, (_, index) => ({
            id: `K00${index + 1}`,
            framework: 'built',
            text: `Built item ${index + 1}`,
          })),
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('explains which contribution is incomplete', () => {
    const invalid = CvBuilderFormSchema.safeParse({
      ...form,
      entries: [
        {
          ...form.entries[0],
          contributions: [{ ...form.entries[0].contributions[0], text: '' }],
        },
      ],
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(cvBuilderFormErrorMessage(invalid.error)).toBe(
        'Trải nghiệm 1, contribution 1: nội dung đang để trống.',
      );
    }
  });

  it('rejects target-profile source references that are not in server context', () => {
    expect(() =>
      validateTargetProfile(targetProfile, new Set(['university:teaching_style'])),
    ).toThrow(/Unknown target source/);
  });

  it('rejects generated bullet numbers that do not occur in cited evidence', () => {
    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'projects',
          data: {
            items: [
              {
                sourceId: 'entry-1',
                title: 'Robotics Project',
                bullets: [
                  {
                    text: 'Built a robot for 50 students.',
                    evidenceIds: ['K001'],
                  },
                ],
              },
            ],
          },
        }),
        form,
      ),
    ).toThrow(/Unsupported number/);
  });

  it('rejects invented numbers outside generated bullets', () => {
    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'about_me',
          data: { text: 'Applicant with 10 years of software engineering experience.' },
        }),
        form,
      ),
    ).toThrow('Unsupported number: 10');
  });

  it('rejects follow-up questions that cite unknown contribution evidence', () => {
    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'assessment',
          data: {
            strengths: ['Builder', 'Analytical', 'Collaborative'],
            missingSignals: ['Thiếu kết quả đo lường.'],
            improvementActions: ['Bổ sung tác động cụ thể.'],
            followUpQuestions: [
              {
                id: 'Q001',
                evidenceId: 'K999',
                targetSection: 'projects',
                question: 'Dự án đã tạo ra kết quả cụ thể nào?',
                reason: 'Bullet hiện chưa có tác động.',
              },
            ],
          },
        }),
        form,
      ),
    ).toThrow('Unknown follow-up evidence: K999');
  });

  it('rejects follow-up questions assigned to the wrong CV section', () => {
    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'assessment',
          data: {
            strengths: ['Builder', 'Analytical', 'Collaborative'],
            missingSignals: ['Thiếu kết quả đo lường.'],
            improvementActions: ['Bổ sung tác động cụ thể.'],
            followUpQuestions: [
              {
                id: 'Q001',
                evidenceId: 'K001',
                targetSection: 'activities',
                question: 'Dự án đã tạo ra kết quả cụ thể nào?',
                reason: 'Bullet hiện chưa có tác động.',
              },
            ],
          },
        }),
        form,
      ),
    ).toThrow('Follow-up section does not match evidence: K001');
  });

  it('applies clarification answers to cited evidence and requests only affected output', () => {
    const result = applyCvClarificationAnswers(
      form,
      [
        {
          id: 'Q001',
          evidenceId: 'K001',
          targetSection: 'projects',
          question: 'Dự án đã tạo ra kết quả cụ thể nào?',
          reason: 'Bullet hiện chưa có tác động.',
        },
      ],
      { Q001: 'Giúp mười hai học sinh hoàn thành sản phẩm.' },
    );

    expect(result.form.entries[0].contributions[0].text).toContain(
      'Giúp mười hai học sinh hoàn thành sản phẩm.',
    );
    expect(result.sections).toEqual(['about_me', 'projects', 'assessment']);
  });

  it('renders a stable plain-text CV and drops stale generated output on restore', () => {
    const generated: GeneratedCvV1 = {
      aboutMe: 'Computer Science applicant focused on accessible technology.',
      education: [],
      experience: [],
      projects: [
        {
          sourceId: 'entry-1',
          title: 'Robotics Project',
          bullets: [
            {
              text: 'Built a low-cost robot for twelve students.',
              evidenceIds: ['K001'],
            },
          ],
        },
      ],
      activities: [],
      awards: [],
      skillGroups: [],
      assessment: {
        strengths: ['Builder', 'Analytical', 'Collaborative'],
        missingSignals: [],
        improvementActions: [],
      },
      layout: {
        templateId: 'technical',
        rationale: 'Project-led profile.',
      },
      plainText: '',
    };

    expect(renderGeneratedCvText(form.personal, generated)).toContain(
      'ROBOTICS PROJECT',
    );
    const restored = restoreCvBuilderDraft(
      {
        schemaVersion: 'old-version',
        applicationId: 'app-1',
        form,
        generatedCv: generated,
        selectedTemplate: 'technical',
      },
      'app-1',
    );
    expect(restored?.form).toEqual(form);
    expect(restored?.generatedCv).toBeUndefined();
  });

  it('reconstructs section events from a restored generated CV', () => {
    const generated: GeneratedCvV1 = {
      aboutMe: 'Computer Science applicant focused on accessible technology.',
      education: [],
      experience: [],
      projects: [
        {
          sourceId: 'entry-1',
          title: 'Robotics Project',
          bullets: [
            {
              text: 'Built a low-cost robot for twelve students.',
              evidenceIds: ['K001'],
            },
          ],
        },
      ],
      activities: [],
      awards: [],
      skillGroups: [],
      assessment: {
        strengths: ['Builder', 'Analytical', 'Collaborative'],
        missingSignals: [],
        improvementActions: [],
      },
      layout: {
        templateId: 'technical',
        rationale: 'Project-led profile.',
      },
      plainText: '',
    };

    expect(generatedCvEvents(generated).map(({ section }) => section)).toEqual([
      'about_me',
      'projects',
      'assessment',
      'layout',
    ]);
  });

  it('restores an unfinished local draft before education or experience is added', () => {
    const unfinished = {
      ...form,
      education: [],
      entries: [],
    };
    const restored = restoreCvBuilderDraft(
      {
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        form: unfinished,
        selectedTemplate: 'academic',
      },
      'app-1',
    );

    expect(restored?.form).toEqual(unfinished);
  });
});
