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
  keywords: ['Problem solving', 'Programming', 'Collaboration'],
  confidence: 'low',
  limitations: [],
};

describe('CvBuilderWorkspace', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

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

  it('uses a Harvard paper, edits on click, and locks review until every answer is applied', async () => {
    const improvedCv: GeneratedCvV1 = {
      ...generatedCv,
      assessment: { ...generatedCv.assessment, followUpQuestions: [] },
      layout: { templateId: 'academic', rationale: 'Harvard-style ATS layout.' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          `${JSON.stringify({
            type: 'complete',
            generatedCv: improvedCv,
            timing: { firstSectionMs: 10, totalMs: 20 },
          })}\n`,
          { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
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
    expect(
      await screen.findByRole('heading', { name: 'AI cần bạn bổ sung' }),
    ).toBeVisible();
    expect(
      screen.getByLabelText('Dự án đã giúp được bao nhiêu người?'),
    ).toBeVisible();
    expect(screen.getByRole('article', { name: 'CV Harvard' })).toHaveClass(
      'cv-harvard',
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
      'Chỉnh sửa tiêu đề Projects & Research',
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
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'AI cần bạn bổ sung' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Chạy CV Review' })).toBeEnabled(),
    );
  });
});
