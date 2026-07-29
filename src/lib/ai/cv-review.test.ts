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
      strengths: [bullet('Nhận xét có căn cứ.')],
      weaknesses: [bullet('Cần diễn đạt cụ thể hơn.')],
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
      strengths: [bullet('Thông tin liên quan được trình bày rõ.', evidenceId)],
      improvements: [bullet('Bổ sung ngữ cảnh để tăng sức thuyết phục.', evidenceId)],
      missingOpportunities: [],
      recommendations: [bullet('Ưu tiên chi tiết có tác động đo lường được.', evidenceId)],
    },
  }));
  return [
    {
      section: 'summary',
      data: {
        communicationReadiness: 'CV dễ đọc nhưng cần làm rõ tác động.',
        programmeAlignment: 'Nội dung có liên hệ với Computer Science.',
        firstImpression: 'Ứng viên có định hướng kỹ thuật rõ.',
        biggestStrengths: [bullet('Kinh nghiệm kỹ thuật có số liệu.', 'C002')],
        biggestWeaknesses: [bullet('Education còn thiếu thành tích nổi bật.', 'C001')],
        priorities: [
          bullet('Làm rõ kết quả trong phần Experience.', 'C002'),
          bullet('Bổ sung coursework liên quan.', 'C001'),
          bullet('Nhóm kỹ năng theo chuyên môn.', 'C003'),
        ],
      },
    },
    ...strategic,
    ...cvSections,
    {
      section: 'recommendations',
      data: {
        high: [bullet('Viết lại Experience theo action và impact.', 'C002')],
        medium: [bullet('Thêm coursework phù hợp chương trình.', 'C001')],
        low: [bullet('Chuẩn hóa cách viết tên kỹ năng.', 'C003')],
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
            communicationReadiness: 'CV được trình bày tương đối rõ.',
            programmeAlignment: 'Nội dung có liên quan chương trình.',
            firstImpression: 'Định hướng được truyền tải tập trung.',
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
            high: [bullet('Ưu tiên viết lại Experience.', 'C001')],
            medium: [{ text: '[CẦN USER BỔ SUNG: kết quả định lượng]', evidenceIds: [] }],
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
      targetProfile: {
        universityName: 'VinUniversity',
        programmeName: 'BSc Computer Science',
      },
      apiKey: 'test-key',
      model: 'deepseek-v4-pro',
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
      targetProfile: {
        universityName: 'VinUniversity',
        programmeName: 'BSc Computer Science',
      },
      apiKey: 'test-key',
      model: 'deepseek-v4-pro',
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
      model: 'deepseek-v4-pro',
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
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      'TẤT CẢ nội dung phản hồi phải bằng tiếng Việt',
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).not.toContain(
      'giữ ngôn ngữ gốc của CV',
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      'không đánh giá độ mạnh',
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      'học sinh cấp 2 hoặc cấp 3',
    );
    expect(vi.mocked(stream).mock.calls[0][0].messages[0].content).toContain(
      'Tránh thuật ngữ tuyển sinh',
    );
  });
});
