import { describe, expect, it } from 'vitest';
import {
  applyCvClarificationAnswers,
  CvBuilderFormSchema,
  CvTargetProfileSchema,
  cvBuilderExpectedSections,
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
  evidenceSignals: Array.from({ length: 5 }, (_, index) => ({
    id: `S00${index + 1}`,
    label: ['Analytical thinking', 'Practical builder', 'Academic readiness', 'Collaboration', 'Career direction'][index],
    description: 'CV cần cung cấp một dẫn chứng cụ thể phù hợp với mục tiêu chương trình.',
    evidenceExamples: ['Một trải nghiệm có mô tả hành động và kết quả'],
    sourceRefs: ['course:subject'],
  })),
  keywords: ['Builder', 'Analytical', 'Collaborative'],
  confidence: 'medium',
  limitations: ['Core modules are unavailable in Supabase.'],
};

describe('CV builder contracts', () => {
  it('requires a target-only evidence rubric before any CV coverage is assessed', () => {
    const withoutRubric: Partial<CvTargetProfileV1> = structuredClone(targetProfile);
    delete withoutRubric.evidenceSignals;
    expect(CvTargetProfileSchema.safeParse(withoutRubric).success).toBe(false);
  });

  it('keeps generated CV sections in one fixed order', () => {
    expect(
      cvBuilderExpectedSections({
        ...form,
        education: [
          {
            id: 'education-1',
            institution: 'Example School',
            qualification: 'A-levels',
            details: [],
          },
        ],
        entries: [
          ...form.entries,
          {
            id: 'entry-2',
            category: 'experience',
            title: 'Internship',
            contributions: [
              { id: 'K002', framework: 'built', text: 'Built an internal tool.' },
            ],
          },
          {
            id: 'entry-3',
            category: 'activity',
            title: 'Coding Club',
            contributions: [
              { id: 'K003', framework: 'led', text: 'Led weekly coding sessions.' },
            ],
          },
        ],
        awards: [{ id: 'award-1', title: 'School Prize' }],
        skillGroups: [{ id: 'skills-1', label: 'Technical', skills: ['Python'] }],
      }),
    ).toEqual([
      'about_me',
      'education',
      'experience',
      'projects',
      'activities',
      'awards',
      'skills',
      'assessment',
      'layout',
    ]);
  });

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

  it('rejects an unavailable Target Profile card when its source exists', () => {
    const incomplete = structuredClone(targetProfile);
    incomplete.universityDna.educationalPhilosophy = {
      text: 'Chưa đủ dữ liệu',
      status: 'unavailable',
      sourceRefs: [],
    };

    expect(() =>
      validateTargetProfile(
        incomplete,
        new Set([
          'university:teaching_style',
          'university:international_environment',
          'university:best_for',
          'course:subject',
          'course:entry_requirements_summary',
          'profile:career_interests',
        ]),
      ),
    ).toThrow(/available sources/i);
  });

  it('normalizes harmless Target Profile verbosity before source validation', () => {
    const parsed = validateTargetProfile(
      {
        ...targetProfile,
        ignored: 'extra model metadata',
        keywords: [...targetProfile.keywords, 'Fourth Keyword'],
        limitations: Array.from(
          { length: 10 },
          (_, index) => `Limitation ${index + 1}`,
        ),
      },
      new Set([
        'university:teaching_style',
        'university:international_environment',
        'university:best_for',
        'course:subject',
        'course:entry_requirements_summary',
        'profile:career_interests',
      ]),
    );

    expect(parsed.keywords).toEqual(targetProfile.keywords);
    expect(parsed.limitations).toHaveLength(8);
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

  it('accepts equivalent decimal separators in Vietnamese input and English output', () => {
    const decimalForm = structuredClone(form);
    decimalForm.entries[0].contributions[0].text +=
      ' Reduced weekly checking time from 4 hours to 1,5 hours.';

    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'about_me',
          data: { text: 'Applicant who reduced weekly checking time to 1.5 hours.' },
        }),
        decimalForm,
      ),
    ).not.toThrow();
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
                    text: 'Reduced weekly checking time to 1.5 hours.',
                    evidenceIds: ['K001'],
                  },
                ],
              },
            ],
          },
        }),
        decimalForm,
      ),
    ).not.toThrow();
  });

  it('accepts equivalent percentage and decimal formatting', () => {
    const numericForm = structuredClone(form);
    numericForm.entries[0].contributions[0].text +=
      ' Improved scores from 62% to 84% and load time from 4 seconds to 1,5 seconds.';

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
                    text: 'Improved scores from 62 to 84 percent and load time from 4.0 to 1.5 seconds.',
                    evidenceIds: ['K001'],
                  },
                ],
              },
            ],
          },
        }),
        numericForm,
      ),
    ).not.toThrow();
  });

  it('does not reject an entry section when only its date formatting changes', () => {
    const datedForm = structuredClone(form);
    datedForm.entries[0].startDate = 'Jun 2025';

    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'projects',
          data: {
            items: [
              {
                sourceId: 'entry-1',
                title: 'Robotics Project',
                dates: '06/2025',
                bullets: [
                  {
                    text: 'Built a low-cost robot for students.',
                    evidenceIds: ['K001'],
                  },
                ],
              },
            ],
          },
        }),
        datedForm,
      ),
    ).not.toThrow();
  });

  it('accepts a detailed layout rationale', () => {
    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'layout',
          data: {
            templateId: 'technical',
            rationale: 'Lý do chọn bố cục phù hợp với hồ sơ. '.repeat(12),
          },
        }),
        form,
      ),
    ).not.toThrow();
  });

  it('accepts detailed assessment feedback', () => {
    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'assessment',
          data: {
            strengths: [
              'Builder',
              'Analytical',
              'Shows a clear ability to connect technical decisions with user needs, explain trade-offs, improve the solution after feedback, and communicate the result in a way that supports the target programme.'.repeat(
                2,
              ),
            ],
            missingSignals: ['Clarify impact across 3 relevant dimensions.'],
            improvementActions: [],
          },
        }),
        form,
      ),
    ).not.toThrow();
  });

  it('normalizes harmless model verbosity without dropping a CV section', () => {
    const event = parseCvBuilderModelLine(
      JSON.stringify({
        section: 'projects',
        ignored: 'extra model metadata',
        data: {
          items: [
            {
              sourceId: 'entry-1',
              title: 'Robotics Project',
              organization: null,
              ignored: 'extra item metadata',
              bullets: [
                {
                  text: 'Built and tested a low-cost robotics learning tool. '.repeat(20),
                  evidenceIds: ['K001'],
                  ignored: true,
                },
              ],
            },
          ],
        },
      }),
      form,
    );

    expect(event.section).toBe('projects');
    if (event.section !== 'projects') return;
    expect(event.data.items[0].organization).toBeUndefined();
    expect(event.data.items[0].bullets[0].text).toHaveLength(500);
  });

  it('keeps the first three assessment strengths when the model returns extras', () => {
    const event = parseCvBuilderModelLine(
      JSON.stringify({
        section: 'assessment',
        data: {
          strengths: ['Builder', 'Analytical', 'Collaborative', 'Curious'],
          missingSignals: [],
          improvementActions: [],
        },
      }),
      form,
    );

    expect(event.section).toBe('assessment');
    if (event.section !== 'assessment') return;
    expect(event.data.strengths).toEqual(['Builder', 'Analytical', 'Collaborative']);
  });

  it('does not treat layout guidance numbers as applicant claims', () => {
    expect(() =>
      parseCvBuilderModelLine(
        JSON.stringify({
          section: 'layout',
          data: {
            templateId: 'technical',
            rationale: 'Nên ưu tiên CV 1 trang để nội dung chính dễ đọc.',
          },
        }),
        form,
      ),
    ).not.toThrow();
  });

  it.each([
    {
      section: 'education',
      data: {
        items: [
          {
            sourceId: 'unknown',
            institution: 'Example School',
            qualification: 'A Levels',
            details: [],
          },
        ],
      },
    },
    {
      section: 'awards',
      data: {
        items: [{ sourceId: 'unknown', title: 'Example Award' }],
      },
    },
    {
      section: 'skills',
      data: {
        groups: [{ sourceId: 'unknown', label: 'Technical', skills: ['TypeScript'] }],
      },
    },
  ])('rejects unknown form source IDs in $section', ({ section, data }) => {
    expect(() =>
      parseCvBuilderModelLine(JSON.stringify({ section, data }), form),
    ).toThrow('Unknown form source: unknown');
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

  it('keeps every clarification when an existing contribution is already long', () => {
    const longForm = {
      ...form,
      entries: form.entries.map((entry) => ({
        ...entry,
        contributions: entry.contributions.map((contribution, index) => ({
          ...contribution,
          text: index === 0 ? 'x'.repeat(1700) : contribution.text,
        })),
      })),
    };
    const firstAnswer = `FIRST ${'a'.repeat(1494)}`;
    const secondAnswer = `SECOND ${'b'.repeat(1493)}`;

    const result = applyCvClarificationAnswers(
      longForm,
      [
        {
          id: 'Q001',
          evidenceId: 'K001',
          targetSection: 'projects',
          question: 'Kết quả cụ thể là gì?',
          reason: 'Thiếu kết quả.',
        },
        {
          id: 'Q002',
          evidenceId: 'K001',
          targetSection: 'projects',
          question: 'Vai trò cụ thể của bạn là gì?',
          reason: 'Thiếu vai trò.',
        },
      ],
      { Q001: firstAnswer, Q002: secondAnswer },
    );

    const text = result.form.entries[0].contributions[0].text;
    expect(text).toContain(firstAnswer);
    expect(text).toContain(secondAnswer);
    expect(text.length).toBeLessThanOrEqual(6000);
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
