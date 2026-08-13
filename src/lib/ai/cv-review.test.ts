import { describe, expect, it, vi } from 'vitest';
import {
  parseCvReviewLine,
  segmentCv,
  streamCvReview,
  type CvReviewTextStream,
} from './cv-review';

const cvText = `EDUCATION
VinUniversity, BSc Computer Science

EXPERIENCE
Built a robotics curriculum for 30 students.

SKILLS
TypeScript, Python, public speaking`;

const bullet = (text: string, evidenceId = 'C001') => ({
  text,
  evidenceIds: [evidenceId],
});

function validLines() {
  const strategic = [
    'programme_alignment',
    'story_positioning',
    'evidence_quality',
    'content_prioritization',
    'one_page_efficiency',
  ].map((criterion) => ({
    section: 'strategic',
    criterion,
    data: {
      score: 7,
      strengths: [bullet('Well-supported feedback.')],
      weaknesses: [bullet('Needs more concrete wording.')],
    },
  }));
  const cvSections = [
    ['education', 'Education', 'C001'],
    ['experience', 'Experience', 'C002'],
    ['skills', 'Skills', 'C003'],
  ].map(([sectionKey, sectionName, evidenceId]) => ({
    section: 'cv_section',
    sectionKey,
    sectionName,
    data: {
      score: 7,
      strengths: [bullet('Relevant information is presented clearly.', evidenceId)],
      improvements: [bullet('Add context to make it more persuasive.', evidenceId)],
      missingOpportunities: [],
      recommendations: [bullet('Prioritize details with a measurable impact.', evidenceId)],
    },
  }));
  return [
    {
      section: 'summary',
      data: {
        communicationReadiness: 'The CV is readable but needs clearer impact.',
        programmeAlignment: 'The content connects to Computer Science.',
        firstImpression: 'The applicant shows a clear technical direction.',
        biggestStrengths: [bullet('Technical experience backed by numbers.', 'C002')],
        biggestWeaknesses: [bullet('Education is missing standout achievements.', 'C001')],
        priorities: [
          bullet('Clarify the results in the Experience section.', 'C002'),
          bullet('Add relevant coursework.', 'C001'),
          bullet('Group skills by specialty.', 'C003'),
        ],
      },
    },
    ...strategic,
    ...cvSections,
    {
      section: 'recommendations',
      data: {
        high: [bullet('Rewrite Experience around action and impact.', 'C002')],
        medium: [bullet('Add coursework matching the programme.', 'C001')],
        low: [bullet('Standardize how skill names are written.', 'C003')],
      },
    },
  ];
}

function fakeStream(lines: unknown[]): CvReviewTextStream {
  return vi.fn(async function* () {
    const text = lines.map((line) => JSON.stringify(line)).join('\n');
    yield { content: text.slice(0, 91) };
    yield { content: text.slice(91) };
  });
}

describe('CV review streaming evaluation', () => {
  it('segments CV content into stable evidence IDs and detected sections', () => {
    expect(segmentCv(cvText)).toEqual([
      { evidenceId: 'C001', sectionKey: 'education', text: 'VinUniversity, BSc Computer Science' },
      {
        evidenceId: 'C002',
        sectionKey: 'experience',
        text: 'Built a robotics curriculum for 30 students.',
      },
      {
        evidenceId: 'C003',
        sectionKey: 'skills',
        text: 'TypeScript, Python, public speaking',
      },
    ]);
  });

  it('rejects feedback that cites evidence outside the CV', () => {
    expect(() =>
      parseCvReviewLine(
        JSON.stringify({
          section: 'summary',
          data: {
            communicationReadiness: 'The CV is presented fairly clearly.',
            programmeAlignment: 'The content is relevant to the programme.',
            firstImpression: 'The direction comes across in a focused way.',
            biggestStrengths: [bullet('Unsupported.', 'C999')],
            biggestWeaknesses: [bullet('Weak.', 'C001')],
            priorities: [
              bullet('One.', 'C001'),
              bullet('Two.', 'C001'),
              bullet('Three.', 'C001'),
            ],
          },
        }),
        new Set(['C001']),
      ),
    ).toThrow('Unknown evidence ID');
  });

  it('allows an empty evidence list for genuinely missing CV information', () => {
    expect(
      parseCvReviewLine(
        JSON.stringify({
          section: 'recommendations',
          data: {
            high: [bullet('Prioritize rewriting Experience.', 'C001')],
            medium: [{ text: '[NEEDS USER INPUT: a quantified result]', evidenceIds: [] }],
            low: [],
          },
        }),
        new Set(['C001']),
      ),
    ).toMatchObject({ section: 'recommendations' });
  });

  it('accepts a detailed grounded recommendation without repairing the whole section', () => {
    expect(
      parseCvReviewLine(
        JSON.stringify({
          section: 'recommendations',
          data: {
            high: [{ text: 'Chi tiết '.repeat(45).trim(), evidenceIds: ['C001'] }],
            medium: [],
            low: [],
          },
        }),
        new Set(['C001']),
      ),
    ).toMatchObject({ section: 'recommendations' });
  });

  it('emits sections in report order when parallel streams finish out of order', async () => {
    const lines = validLines();
    const stream = fakeStream([
      lines[6],
      lines[3],
      lines[9],
      lines[0],
      lines[5],
      lines[1],
      lines[2],
      lines[4],
      lines[7],
      lines[8],
    ]);
    const keys: string[] = [];

    for await (const event of streamCvReview({
      cvText,
      template: 'technical',
      targetProfile: {
        universityName: 'VinUniversity',
        programmeName: 'BSc Computer Science',
      },
      apiKey: 'test-key',
      model: 'gpt-4o',
      stream,
    })) {
      if (event.type !== 'section') continue;
      keys.push(
        event.section === 'strategic'
          ? `strategic:${event.criterion}`
          : event.section === 'cv_section'
            ? `cv_section:${event.sectionKey}`
            : event.section,
      );
    }

    expect(keys).toEqual([
      'summary',
      'strategic:programme_alignment',
      'strategic:story_positioning',
      'strategic:evidence_quality',
      'strategic:content_prioritization',
      'strategic:one_page_efficiency',
      'cv_section:education',
      'cv_section:experience',
      'cv_section:skills',
      'recommendations',
    ]);
  });

  it('streams validated sections and calculates the final score in code', async () => {
    const stream = fakeStream(validLines());
    const events = [];

    for await (const event of streamCvReview({
      cvText,
      template: 'technical',
      targetProfile: {
        universityName: 'VinUniversity',
        programmeName: 'BSc Computer Science',
      },
      apiKey: 'test-key',
      model: 'gpt-4o',
      stream,
    })) {
      events.push(event);
    }

    expect(events.filter(({ type }) => type === 'section')).toHaveLength(10);
    expect(events.at(-1)).toMatchObject({
      type: 'complete',
      analysis: {
        overallScore: 7,
        detectedSections: ['education', 'experience', 'skills'],
      },
    });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(vi.mocked(stream).mock.calls[0][0]).toMatchObject({
      model: 'gpt-4o',
      temperature: 0,
    });
    expect(
      vi.mocked(stream).mock.calls.map(([request]) => request.messages[1].content),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('summary'),
        expect.stringContaining('cv_section:education'),
      ]),
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[1].content).toContain(
      '"cvFormat":{"id":"aacc"',
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      'ALL response content must be in English',
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      "do not assess the overall strength/weakness",
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      'middle or high school student',
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      'Avoid admissions jargon',
    );
  });
});
