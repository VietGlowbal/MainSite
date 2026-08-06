import { describe, expect, it, vi } from 'vitest';
import {
  generateCvTargetProfile,
  streamCvBuilderGeneration,
  type CvBuilderFormV1,
} from './cv-builder';

const targetJson = {
  universityName: 'Example University',
  programmeName: 'BSc Computer Science',
  universityDna: {
    positioning: {
      text: 'Known for practical learning.',
      status: 'explicit',
      sourceRefs: ['university:strengths'],
    },
    educationalPhilosophy: {
      text: 'Hands-on learning.',
      status: 'explicit',
      sourceRefs: ['university:teaching_style'],
    },
    environment: {
      text: 'International cohort.',
      status: 'explicit',
      sourceRefs: ['university:international_environment'],
    },
    studentSignals: [
      {
        text: 'Curious builders.',
        status: 'explicit',
        sourceRefs: ['university:best_for'],
      },
    ],
  },
  programmeDna: {
    objectives: [{ text: 'Not enough data', status: 'unavailable', sourceRefs: [] }],
    modules: [{ text: 'Not enough data', status: 'unavailable', sourceRefs: [] }],
    learningOutcomes: [
      { text: 'Not enough data', status: 'unavailable', sourceRefs: [] },
    ],
    competencies: [
      {
        text: 'Programming and analytical reasoning.',
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
      text: 'Software engineering.',
      status: 'explicit',
      sourceRefs: ['profile:career_interests'],
    },
  ],
  evidenceSignals: [
    {
      id: 'S001',
      label: 'Analytical problem solving',
      description: 'The CV needs examples showing how the applicant analyzes and solves problems.',
      evidenceExamples: ['A technical project describing the approach and the outcome'],
      sourceRefs: ['course:subject'],
    },
    {
      id: 'S002',
      label: 'Practical builder',
      description: 'The CV needs to prove the ability to turn ideas into a concrete product or outcome.',
      evidenceExamples: ['A product, tool or activity the applicant built directly'],
      sourceRefs: ['university:best_for'],
    },
    {
      id: 'S003',
      label: 'Academic readiness',
      description: "The CV needs an academic foundation matching the programme's requirements.",
      evidenceExamples: ['A relevant subject, academic result or project'],
      sourceRefs: ['course:entry_requirements_summary'],
    },
    {
      id: 'S004',
      label: 'Collaboration',
      description: 'The CV needs evidence of how the applicant works effectively with others.',
      evidenceExamples: ['A clear role in a team or community activity'],
      sourceRefs: ['university:teaching_style'],
    },
    {
      id: 'S005',
      label: 'Career direction',
      description: "The CV needs to connect existing experience to the chosen career direction.",
      evidenceExamples: ['Experience directly relevant to Software Engineering'],
      sourceRefs: ['profile:career_interests'],
    },
  ],
  keywords: ['Builder', 'Analytical', 'Collaborative'],
  confidence: 'high',
  limitations: [],
};

const targetContext = {
  universityName: 'Example University',
  programmeName: 'BSc Computer Science',
  sourceEntries: [
    { ref: 'university:strengths', value: 'Practical learning' },
    { ref: 'university:teaching_style', value: 'Hands-on learning' },
    { ref: 'university:international_environment', value: 'International cohort' },
    { ref: 'university:best_for', value: 'Curious builders' },
    { ref: 'course:subject', value: 'Computer Science' },
    {
      ref: 'course:entry_requirements_summary',
      value: 'Strong mathematics preparation',
    },
    { ref: 'profile:career_interests', value: 'Software Engineering' },
  ],
  validSourceRefs: new Set([
    'university:strengths',
    'university:teaching_style',
    'university:international_environment',
    'university:best_for',
    'course:subject',
    'course:entry_requirements_summary',
    'profile:career_interests',
  ]),
  confidence: 'medium' as const,
  limitations: ['Core modules unavailable.'],
};

describe('CV builder model streams', () => {
  it('builds a target profile only from known Supabase source references', async () => {
    const stream = vi.fn(async function* (request: { messages: { content: string }[] }) {
      expect(request.messages[0].content).toContain('"universityDna"');
      expect(request.messages[0].content).toContain('"programmeDna"');
      yield { content: JSON.stringify(targetJson) };
    });

    const profile = await generateCvTargetProfile({
      context: targetContext,
      careerDirection: 'Software Engineering',
      apiKey: 'openai-key',
      model: 'gpt-4o',
      stream,
    });

    expect(profile.confidence).toBe('medium');
    expect(profile.keywords).toHaveLength(3);
    expect(profile.evidenceSignals).toHaveLength(5);
    expect(profile.limitations).toContain('Core modules unavailable.');
  });

  it('allocates enough output tokens for a complete Target Profile JSON object', async () => {
    const stream = vi.fn(async function* (request: { maxTokens: number }) {
      if (request.maxTokens < 4000) {
        yield {
          content: '{"universityName":"Example University',
          finishReason: 'length',
        };
        return;
      }
      yield { content: JSON.stringify(targetJson), finishReason: 'stop' };
    });

    await expect(
      generateCvTargetProfile({
        context: targetContext,
        careerDirection: 'Software Engineering',
        apiKey: 'openai-key',
        model: 'gpt-4o',
        stream,
      }),
    ).resolves.toMatchObject({ universityName: 'Example University' });
  });

  it('streams validated CV sections in order and finishes with plain text', async () => {
    const form: CvBuilderFormV1 = {
      personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
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
              text: 'Built a low-cost robot for 12 students.',
            },
          ],
        },
      ],
      awards: [],
      skillGroups: [],
    };
    const lines = [
      {
        section: 'about_me',
        data: { text: 'Computer Science applicant focused on accessible technology.' },
      },
      {
        section: 'projects',
        data: {
          items: [
            {
              sourceId: 'entry-1',
              title: 'Robotics Project',
              bullets: [
                {
                  text: 'Built a low-cost robot for 12 students.',
                  evidenceIds: ['K001'],
                },
              ],
            },
          ],
        },
      },
      {
        section: 'assessment',
        data: {
          strengths: ['Builder', 'Analytical', 'Collaborative'],
          missingSignals: [],
          improvementActions: [],
        },
      },
      {
        section: 'layout',
        data: { templateId: 'technical', rationale: 'Project-led profile.' },
      },
    ];
    const stream = vi.fn(async function* (request: { messages: { content: string }[] }) {
      expect(request.messages[0].content).toContain(
        'Assess applicant evidence only from form',
      );
      const output = `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
      yield { content: output.slice(0, 100) };
      yield { content: output.slice(100) };
      await new Promise<void>(() => {});
    });

    const events = [];
    for await (const event of streamCvBuilderGeneration({
      form,
      targetProfile: targetJson,
      apiKey: 'openai-key',
      model: 'gpt-4o',
      stream,
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      'section',
      'section',
      'section',
      'section',
      'complete',
    ]);
    const complete = events.at(-1);
    expect(complete?.type).toBe('complete');
    if (complete?.type === 'complete') {
      expect(complete.generatedCv.plainText).toContain('ROBOTICS PROJECT');
    }
  });

  it('accepts fenced pretty-printed JSON from the model', async () => {
    const form: CvBuilderFormV1 = {
      personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
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
              text: 'Built a low-cost robot for 12 students.',
            },
          ],
        },
      ],
      awards: [],
      skillGroups: [],
    };
    const output = [
      {
        section: 'about_me',
        data: { text: 'Computer Science applicant focused on accessible technology.' },
      },
      {
        section: 'projects',
        data: {
          items: [
            {
              sourceId: 'entry-1',
              title: 'Robotics Project',
              bullets: [
                {
                  text: 'Built a low-cost robot for 12 students.',
                  evidenceIds: ['K001'],
                },
              ],
            },
          ],
        },
      },
      {
        section: 'assessment',
        data: {
          strengths: ['Builder', 'Analytical', 'Collaborative'],
          missingSignals: [],
          improvementActions: [],
        },
      },
      {
        section: 'layout',
        data: { templateId: 'technical', rationale: 'Project-led profile.' },
      },
    ]
      .map((event) => JSON.stringify(event, null, 2))
      .join('\n');
    const stream = vi.fn(async function* () {
      yield { content: `\`\`\`json\n${output}\n\`\`\`` };
    });

    const events = [];
    for await (const event of streamCvBuilderGeneration({
      form,
      targetProfile: targetJson,
      apiKey: 'openai-key',
      model: 'gpt-4o',
      stream,
    })) {
      events.push(event);
    }

    expect(events.at(-1)?.type).toBe('complete');
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it('tells the repair pass why a section failed validation', async () => {
    const form: CvBuilderFormV1 = {
      personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
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
              text: 'Built a low-cost robot for 12 students.',
            },
          ],
        },
      ],
      awards: [],
      skillGroups: [],
    };
    let attempt = 0;
    const stream = vi.fn(async function* (request: { messages: { content: string }[] }) {
      attempt += 1;
      if (attempt === 1) {
        yield {
          content: [
            {
              section: 'about_me',
              data: { text: 'Computer Science applicant focused on accessible technology.' },
            },
            {
              section: 'projects',
              data: {
                items: [
                  {
                    sourceId: 'entry-1',
                    title: 'Robotics Project',
                    bullets: [
                      {
                        text: 'Built a low-cost robot for 12 students.',
                        evidenceIds: ['K001'],
                      },
                    ],
                  },
                ],
              },
            },
            {
              section: 'assessment',
              data: {
                strengths: ['Builder', 'Analytical'],
                missingSignals: [],
                improvementActions: [],
              },
            },
            {
              section: 'layout',
              data: { templateId: 'technical', rationale: 'Project-led profile.' },
            },
          ]
            .map((event) => JSON.stringify(event))
            .join('\n'),
        };
        return;
      }
      const repairInput = JSON.parse(request.messages[1].content);
      expect(repairInput.validationErrors.assessment).toContain(
        'data.strengths:too_small',
      );
      yield {
        content: JSON.stringify({
          section: 'assessment',
          data: {
            strengths: ['Builder', 'Analytical', 'Collaborative'],
            missingSignals: [],
            improvementActions: [],
          },
        }),
      };
    });

    const events = [];
    for await (const event of streamCvBuilderGeneration({
      form,
      targetProfile: targetJson,
      apiKey: 'openai-key',
      model: 'gpt-4o',
      stream,
    })) {
      events.push(event);
    }

    expect(events.at(-1)?.type).toBe('complete');
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('repairs derived numbers using the contribution number whitelist', async () => {
    const form: CvBuilderFormV1 = {
      personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
      education: [],
      entries: [
        {
          id: 'entry-1',
          category: 'experience',
          title: 'Software Intern',
          contributions: [
            {
              id: 'K001',
              framework: 'improved',
              text: 'Reduced dashboard load time from 4 seconds to 1,5 seconds.',
            },
          ],
        },
      ],
      awards: [],
      skillGroups: [],
    };
    let attempt = 0;
    const stream = vi.fn(async function* (request: {
      messages: { content: string }[];
      temperature: number;
    }) {
      attempt += 1;
      if (attempt === 1) {
        yield {
          content: JSON.stringify({
            section: 'experience',
            data: {
              items: [
                {
                  sourceId: 'entry-1',
                  title: 'Software Intern',
                  bullets: [
                    {
                      text: 'Reduced dashboard load time by 62.5%.',
                      evidenceIds: ['K001'],
                    },
                  ],
                },
              ],
            },
          }),
        };
        return;
      }
      expect(request.messages[0].content).toContain(
        'Do not calculate or derive new numeric values',
      );
      expect(request.temperature).toBe(0);
      const repairInput = JSON.parse(request.messages[1].content);
      expect(repairInput.allowedNumbersByEvidence).toEqual({
        K001: ['4', '1,5'],
      });
      yield {
        content: JSON.stringify({
          section: 'experience',
          data: {
            items: [
              {
                sourceId: 'entry-1',
                title: 'Software Intern',
                bullets: [
                  {
                    text: 'Reduced dashboard load time from 4 seconds to 1.5 seconds.',
                    evidenceIds: ['K001'],
                  },
                ],
              },
            ],
          },
        }),
      };
    });

    const events = [];
    for await (const event of streamCvBuilderGeneration({
      form,
      targetProfile: targetJson,
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      requestedSections: ['experience'],
      clarification: true,
      stream,
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      expect.objectContaining({ type: 'section', section: 'experience' }),
    ]);
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('reports safe validation codes when repair still fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const form: CvBuilderFormV1 = {
      personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
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
              text: 'Built a low-cost robot for 12 students.',
            },
          ],
        },
      ],
      awards: [],
      skillGroups: [],
    };
    const stream = vi.fn(async function* () {
      yield {
        content: JSON.stringify({
          section: 'assessment',
          data: {
            strengths: ['Builder', 'Analytical'],
            missingSignals: [],
            improvementActions: [],
          },
        }),
      };
    });
    const collect = async () => {
      for await (const event of streamCvBuilderGeneration({
        form,
        targetProfile: targetJson,
        apiKey: 'openai-key',
        model: 'gpt-4o-mini',
        requestedSections: ['assessment'],
        stream,
      })) {
        void event;
      }
    };

    await expect(collect()).rejects.toThrow(
      'Missing CV builder sections: assessment',
    );
    expect(consoleError).toHaveBeenCalledWith('CV builder output validation failed', {
      missingSections: ['assessment'],
      validationErrors: { assessment: ['data.strengths:too_small'] },
    });
    consoleError.mockRestore();
  });

  it('requires clarification facts in the revised CV sections', async () => {
    const form: CvBuilderFormV1 = {
      personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
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
              text: 'Built a robot. Clarification: helped 20 students.',
            },
          ],
        },
      ],
      awards: [],
      skillGroups: [],
    };
    const stream = vi.fn(async function* (request: { messages: { content: string }[] }) {
      expect(request.messages[0].content).toContain(
        'must incorporate every concrete clarification',
      );
      yield {
        content: JSON.stringify({
          section: 'about_me',
          data: { text: 'Applicant who built a robot that helped 20 students.' },
        }),
      };
    });

    for await (const event of streamCvBuilderGeneration({
      form,
      targetProfile: targetJson,
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      requestedSections: ['about_me'],
      clarification: true,
      stream,
    })) {
      void event;
    }
  });
});
