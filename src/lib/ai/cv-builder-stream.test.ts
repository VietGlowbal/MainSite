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
    objectives: [{ text: 'Chưa đủ dữ liệu', status: 'unavailable', sourceRefs: [] }],
    modules: [{ text: 'Chưa đủ dữ liệu', status: 'unavailable', sourceRefs: [] }],
    learningOutcomes: [
      { text: 'Chưa đủ dữ liệu', status: 'unavailable', sourceRefs: [] },
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
  keywords: ['Builder', 'Analytical', 'Collaborative'],
  confidence: 'high',
  limitations: [],
};

describe('CV builder model streams', () => {
  it('builds a target profile only from known Supabase source references', async () => {
    const stream = vi.fn(async function* (request: { messages: { content: string }[] }) {
      expect(request.messages[0].content).toContain('"universityDna"');
      expect(request.messages[0].content).toContain('"programmeDna"');
      yield { content: JSON.stringify(targetJson) };
    });

    const profile = await generateCvTargetProfile({
      context: {
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
        confidence: 'medium',
        limitations: ['Core modules unavailable.'],
      },
      careerDirection: 'Software Engineering',
      apiKey: 'deepseek-key',
      model: 'deepseek-v4-pro',
      stream,
    });

    expect(profile.confidence).toBe('medium');
    expect(profile.keywords).toHaveLength(3);
    expect(profile.limitations).toContain('Core modules unavailable.');
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
    const stream = vi.fn(async function* () {
      const output = `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
      yield { content: output.slice(0, 100) };
      yield { content: output.slice(100) };
      await new Promise<void>(() => {});
    });

    const events = [];
    for await (const event of streamCvBuilderGeneration({
      form,
      targetProfile: targetJson,
      apiKey: 'deepseek-key',
      model: 'deepseek-v4-pro',
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
});
