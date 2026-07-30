import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CvBuilderWorkspace } from './CvBuilderWorkspace';
import type {
  CvBuilderFormV1,
  CvTargetProfileV1,
  GeneratedCvV1,
} from '@/lib/ai/cv-builder';

const prefill: CvBuilderFormV1 = {
  personal: {
    fullName: 'Alex Nguyen',
    email: 'alex@example.com',
    phone: '+84 90 123 4567',
    location: 'Hanoi',
    links: ['alex.dev'],
  },
  education: [
    {
      id: 'edu-1',
      institution: 'Example School',
      qualification: 'A-levels',
      fieldOfStudy: 'Mathematics',
      details: ['Predicted A*A*A.'],
    },
  ],
  entries: [
    {
      id: 'entry-1',
      category: 'project',
      title: 'Robotics project',
      contributions: Array.from({ length: 5 }, (_, index) => ({
        id: `K00${index + 1}`,
        framework: 'built' as const,
        text: `Built project component ${index + 1}`,
      })),
    },
  ],
  awards: [{ id: 'award-1', title: 'Robotics Prize', issuer: 'Example School' }],
  skillGroups: [{ id: 'skill-1', label: 'Core skills', skills: ['Python', 'C++'] }],
};

const generatedCv: GeneratedCvV1 = {
  aboutMe: 'Applicant focused on accessible robotics.',
  education: [
    {
      sourceId: 'edu-1',
      institution: 'Example School',
      qualification: 'A-levels',
      fieldOfStudy: 'Mathematics',
      details: ['Predicted A*A*A.'],
    },
  ],
  experience: [],
  projects: [
    {
      sourceId: 'entry-1',
      title: 'Robotics project',
      organization: 'Robotics Club',
      dates: '2025',
      bullets: [
        {
          text: 'Built project component 1.',
          evidenceIds: ['K001'],
        },
      ],
    },
  ],
  activities: [],
  awards: [
    {
      sourceId: 'award-1',
      title: 'Robotics Prize',
      issuer: 'Example School',
    },
  ],
  skillGroups: [
    {
      sourceId: 'skill-1',
      label: 'Core skills',
      skills: ['Python', 'C++'],
    },
  ],
  assessment: {
    strengths: ['Builder', 'Analytical', 'Collaborative'],
    missingSignals: ['Thiếu kết quả cụ thể.'],
    improvementActions: ['Bổ sung tác động.'],
    followUpQuestions: [
      {
        id: 'Q001',
        evidenceId: 'K001',
        targetSection: 'projects',
        question: 'Dự án đã giúp được bao nhiêu người?',
        reason: 'Bullet hiện chưa có tác động rõ.',
      },
      {
        id: 'Q002',
        evidenceId: 'K002',
        targetSection: 'projects',
        question: 'Bạn đã tự làm phần nào trong dự án?',
        reason: 'Vai trò cá nhân chưa rõ.',
      },
    ],
  },
  layout: { templateId: 'technical', rationale: 'Project-led profile.' },
  plainText: '',
};

const unavailable = {
  text: 'Chưa đủ dữ liệu',
  status: 'unavailable' as const,
  sourceRefs: [],
};
const targetProfile: CvTargetProfileV1 = {
  universityName: 'Example University',
  programmeName: 'Computer Science',
  universityDna: {
    positioning: unavailable,
    educationalPhilosophy: unavailable,
    environment: unavailable,
    studentSignals: [unavailable],
  },
  programmeDna: {
    objectives: [unavailable],
    modules: [unavailable],
    learningOutcomes: [unavailable],
    competencies: [unavailable],
    entrySignals: [unavailable],
  },
  careerAlignment: [unavailable],
  evidenceSignals: [
    {
      id: 'S001',
      label: 'Problem solving',
      description: 'CV cần chứng minh cách bạn giải quyết một vấn đề cụ thể.',
      evidenceExamples: ['Một dự án có mô tả cách làm và kết quả'],
      sourceRefs: ['course:subject'],
    },
    {
      id: 'S002',
      label: 'Programming',
      description: 'CV cần có dẫn chứng về khả năng lập trình thực tế.',
      evidenceExamples: ['Sản phẩm hoặc công cụ bạn đã xây dựng'],
      sourceRefs: ['course:subject'],
    },
    {
      id: 'S003',
      label: 'Collaboration',
      description: 'CV cần chứng minh bạn có thể làm việc cùng người khác.',
      evidenceExamples: ['Vai trò cụ thể trong một nhóm'],
      sourceRefs: ['university:best_for'],
    },
    {
      id: 'S004',
      label: 'Academic readiness',
      description: 'CV cần thể hiện nền tảng học tập phù hợp.',
      evidenceExamples: ['Môn học hoặc dự án học thuật liên quan'],
      sourceRefs: ['course:entry_requirements_summary'],
    },
    {
      id: 'S005',
      label: 'Career direction',
      description: 'CV cần kết nối trải nghiệm với định hướng nghề nghiệp.',
      evidenceExamples: ['Trải nghiệm liên quan đến ngành dự định theo đuổi'],
      sourceRefs: ['profile:career_interests'],
    },
  ],
  keywords: ['Problem solving', 'Programming', 'Collaboration'],
  confidence: 'low',
  limitations: [],
};

describe('CvBuilderWorkspace', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows target evidence requirements without scoring a CV that does not exist yet', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
        form: prefill,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'CV cần chứng minh' })).toBeVisible();
    expect(screen.getAllByText('Problem solving')).toHaveLength(2);
    expect(screen.queryByText(/đã có dẫn chứng/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/còn thiếu tín hiệu/i)).not.toBeInTheDocument();
  });

  it('opens the content step and enforces five contributions per entry', async () => {
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Nội dung/ }));
    expect(screen.getByRole('button', { name: '+ Contribution (5/5)' })).toBeDisabled();
    expect(screen.getAllByLabelText(/Contribution \d/)).toHaveLength(5);
  });

  it('removes a skill group from the CV form', async () => {
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Nội dung/ }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Xóa nhóm kỹ năng 1' }),
    );

    expect(screen.queryByDisplayValue('Core skills')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Thêm nhóm kỹ năng' }),
    ).toBeVisible();
  });

  it('uses a Harvard paper, edits on click, and locks review until every answer is applied', async () => {
    const improvedCv: GeneratedCvV1 = {
      ...generatedCv,
      projects: generatedCv.projects.map((project) => ({
        ...project,
        bullets: [
          {
            text: 'Built a robotics project used by 20 students.',
            evidenceIds: ['K001'],
          },
        ],
      })),
      assessment: { ...generatedCv.assessment, followUpQuestions: [] },
      layout: { templateId: 'academic', rationale: 'Harvard-style ATS layout.' },
    };
    let resolveGenerate!: (response: Response) => void;
    const generateResponse = new Promise<Response>((resolve) => {
      resolveGenerate = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => generateResponse),
    );
    const finishGenerate = () =>
      resolveGenerate(
        new Response(
          [
            {
              type: 'section',
              section: 'about_me',
              data: { text: improvedCv.aboutMe },
            },
            {
              type: 'section',
              section: 'projects',
              data: { items: improvedCv.projects },
            },
            {
              type: 'section',
              section: 'assessment',
              data: generatedCv.assessment,
            },
          ]
            .map((event) => JSON.stringify(event))
            .join('\n') + '\n',
          { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      );
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Bản CV/ }));
    expect(
      await screen.findByRole('heading', { name: 'AI cần bạn bổ sung' }),
    ).toBeVisible();
    expect(
      screen.getByLabelText('Dự án đã giúp được bao nhiêu người?'),
    ).toBeVisible();
    expect(screen.getByRole('article', { name: 'CV Harvard' })).toHaveClass(
      'cv-harvard',
    );
    const harvardPaper = screen.getByRole('article', { name: 'CV Harvard' });
    expect(harvardPaper.querySelector('.cv-harvard-header')).not.toBeNull();
    expect(harvardPaper.querySelector('.cv-harvard-contact')).toHaveTextContent(
      'alex@example.com | +84 90 123 4567 | Hanoi | alex.dev',
    );
    expect(
      harvardPaper.querySelectorAll('.cv-harvard-entry-row').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('textbox', {
        name: 'Chỉnh sửa tiêu đề University Projects',
      }),
    ).toHaveTextContent('University Projects');
    const educationHeader = screen
      .getByRole('textbox', { name: 'Chỉnh sửa tiêu đề Education' })
      .closest('h2');
    const educationSection = educationHeader?.closest('section');
    const educationEntryHeader = educationSection?.querySelector('h3');
    expect(getComputedStyle(educationHeader!)).toHaveProperty('fontWeight', '400');
    expect(getComputedStyle(educationEntryHeader!)).toHaveProperty(
      'fontWeight',
      '400',
    );
    expect(getComputedStyle(educationSection!)).toHaveProperty(
      'marginTop',
      '12px',
    );
    expect(
      screen.queryByRole('button', { name: 'Sửa trực tiếp trên CV' }),
    ).not.toBeInTheDocument();
    [
      'Chỉnh sửa họ tên',
      'Chỉnh sửa email',
      'Chỉnh sửa số điện thoại',
      'Chỉnh sửa địa điểm',
      'Chỉnh sửa liên kết 1',
      'Chỉnh sửa tiêu đề Profile',
      'Chỉnh sửa phần giới thiệu',
      'Chỉnh sửa tiêu đề Education',
      'Chỉnh sửa bằng cấp 1',
      'Chỉnh sửa trường học 1',
      'Chỉnh sửa ngành học 1',
      'Chỉnh sửa chi tiết học vấn 1.1',
      'Chỉnh sửa tiêu đề University Projects',
      'Chỉnh sửa tiêu đề dự án 1',
      'Chỉnh sửa tổ chức dự án 1',
      'Chỉnh sửa thời gian dự án 1',
      'Chỉnh sửa Robotics project — bullet 1',
      'Chỉnh sửa tiêu đề Awards',
      'Chỉnh sửa giải thưởng 1',
      'Chỉnh sửa đơn vị trao giải 1',
      'Chỉnh sửa tiêu đề Skills',
      'Chỉnh sửa tên nhóm kỹ năng 1',
      'Chỉnh sửa kỹ năng nhóm 1',
    ].forEach((name) =>
      expect(screen.getByRole('textbox', { name })).toBeVisible(),
    );

    const aboutMe = screen.getByRole('textbox', {
      name: 'Chỉnh sửa phần giới thiệu',
    });
    fireEvent.input(aboutMe, {
      currentTarget: { textContent: 'Applicant building accessible robotics.' },
      target: { textContent: 'Applicant building accessible robotics.' },
    });
    fireEvent.blur(aboutMe);
    expect(aboutMe).toHaveTextContent('Applicant building accessible robotics.');
    const educationHeading = screen.getByRole('textbox', {
      name: 'Chỉnh sửa tiêu đề Education',
    });
    fireEvent.input(educationHeading, {
      target: { textContent: 'ACADEMIC BACKGROUND' },
    });
    fireEvent.blur(educationHeading);
    expect(educationHeading).toHaveTextContent('ACADEMIC BACKGROUND');

    const reviewButton = screen.getByRole('button', { name: 'Chạy CV Review' });
    const submitButton = screen.getByRole('button', {
      name: 'Dùng câu trả lời để cải thiện CV',
    });
    expect(reviewButton).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Đã trả lời 0/2 câu')).toBeVisible();

    await userEvent.type(
      screen.getByLabelText('Dự án đã giúp được bao nhiêu người?'),
      '20 học sinh.',
    );
    expect(submitButton).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText('Bạn đã tự làm phần nào trong dự án?'),
      'Tôi thiết kế và lập trình bộ điều khiển.',
    );
    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)),
    ).toEqual(expect.objectContaining({ mode: 'clarification' }));
    expect(
      screen.getByRole('button', { name: 'AI đang cải thiện CV…' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('AI đang chuẩn hóa và sắp xếp CV…'),
    ).not.toBeInTheDocument();
    finishGenerate();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'AI cần bạn bổ sung' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Chạy CV Review' })).toBeEnabled(),
    );
    expect(screen.getByRole('article', { name: 'CV Harvard' })).toHaveTextContent(
      '20 students',
    );

    vi.mocked(fetch).mockImplementationOnce(
      () => new Promise<Response>(() => {}),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Chạy CV Review' }),
    );
    expect(
      screen.getByRole('button', { name: 'AI đang review…' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('AI đang đọc và đánh giá CV…'),
    ).not.toBeInTheDocument();
  });

  it('keeps clarification mode when retrying a missing revised section', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            `${JSON.stringify({
              type: 'error',
              code: 'STREAM_FAILED',
              missingSections: ['projects'],
              message: 'CV generation incomplete.',
              retryable: true,
            })}\n`,
            { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
          ),
        )
        .mockImplementationOnce(() => new Promise<Response>(() => {})),
    );
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Bản CV/ }));
    await userEvent.type(
      screen.getByLabelText('Dự án đã giúp được bao nhiêu người?'),
      '20 học sinh.',
    );
    await userEvent.type(
      screen.getByLabelText('Bạn đã tự làm phần nào trong dự án?'),
      'Tôi thiết kế và lập trình bộ điều khiển.',
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Dùng câu trả lời để cải thiện CV',
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Thử lại phần thiếu' }),
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)),
    ).toEqual(expect.objectContaining({ mode: 'clarification' }));
  });

  it('offers only Harvard and AACC layouts and switches the CV preview', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'technical',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Bản CV/ }));
    await userEvent.click(screen.getByRole('button', { name: /Chọn layout/ }));

    const harvard = screen.getByRole('button', { name: /Harvard/ });
    const aacc = screen.getByRole('button', { name: /AACC/ });
    expect(aacc).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Leadership/ })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'CV AACC' })).toHaveClass('cv-aacc');

    await userEvent.click(harvard);
    expect(screen.getByRole('article', { name: 'CV Harvard' })).toHaveClass(
      'cv-harvard',
    );

    await userEvent.click(aacc);
    expect(aacc).toHaveAttribute('aria-pressed', 'true');
  });
});
