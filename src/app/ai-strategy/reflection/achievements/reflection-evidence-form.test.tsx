import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReflectionEvidenceForm } from './reflection-evidence-form';

const pushMock = vi.fn();
let reviewMode = false;
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'return' ? '/custom-return' : key === 'review' && reviewMode ? '1' : null),
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/demo.pdf' } }),
      }),
    },
  }),
}));

describe('ReflectionEvidenceForm (SVG & Mockup UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewMode = false;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });

  it('renders the complete inline form matching Figma mockups', () => {
    render(
      <ReflectionEvidenceForm
        initialAchievements={[
          {
            id: 'ach-1',
            category: 'competition',
            title: '1 Giải nhất Kì thi Olympic Toán học Sinh viên toàn quốc 2024',
            competition: 'Olympic Toán học Toàn quốc',
            organisation: 'Hội Toán học Việt Nam / ĐHQG',
            year: 2024,
            level: 'National',
            detail: 'Điểm số đạt được 28.5/30',
          },
        ]}
        initialActivities={[
          {
            id: 'act-1',
            category: 'community_project',
            title: 'Chiến dịch Mùa hè xanh 2024',
            organisation: 'Đoàn trường THPT',
            level: 'Trưởng ban Tổ chức',
            period: '06/2024 - 08/2024',
            description: 'Điều phối tình nguyện viên',
          },
        ]}
        initialDocuments={[
          {
            id: 'doc-1',
            fileName: 'Resume.pdf',
            storageKey: 'resumes/1.pdf',
            uploadedAt: '2026-08-26T00:00:00Z',
          },
        ]}
      />,
    );

    // Header & Titles
    expect(
      screen.getByRole('heading', { level: 2, name: /Academic achievements and non-academic activities/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /^Academic achievements$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /^Non-academic activities$/i }),
    ).toBeInTheDocument();

    // CV Upload Hero
    expect(screen.getByText(/Upload your CV/i)).toBeInTheDocument();
    expect(screen.getByText(/Resume.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();

    // Achievements & Activities cards
    expect(screen.getByDisplayValue('1 Giải nhất Kì thi Olympic Toán học Sinh viên toàn quốc 2024')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chiến dịch Mùa hè xanh 2024')).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
  });

  it('opens the extracted-item review queue and resolves each item explicitly', async () => {
    const user = userEvent.setup();
    reviewMode = true;

    render(
      <ReflectionEvidenceForm
        initialAchievements={[
          {
            id: 'ach-1',
            category: 'competition',
            title: 'Extracted award',
            detail: 'Award detail',
            year: 2024,
            reviewStatus: 'needs_review',
          },
        ]}
        initialActivities={[
          {
            id: 'act-1',
            category: 'community_project',
            title: 'Extracted activity',
            description: 'Activity detail',
            reviewStatus: 'needs_review',
          },
        ]}
        initialDocuments={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Extracted award' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.getByRole('heading', { name: 'Extracted activity' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.getByText('All extracted achievements reviewed')).toBeInTheDocument();
  });

  it('treats Continue as approval and saves extracted items as reviewed', async () => {
    const user = userEvent.setup();
    render(
      <ReflectionEvidenceForm
        initialAchievements={[
          { id: 'ach-1', category: 'competition', title: 'Extracted award', reviewStatus: 'needs_review' },
        ]}
        initialActivities={[
          { id: 'act-1', category: 'leadership', title: 'Extracted activity', reviewStatus: 'needs_review' },
        ]}
        initialDocuments={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [, init] = vi.mocked(global.fetch).mock.calls[0] ?? [];
    const payload = JSON.parse(String(init?.body));
    expect(payload.achievements[0].reviewStatus).toBe('reviewed');
    expect(payload.activities[0].reviewStatus).toBe('reviewed');
  });

  it('allows adding and removing achievements', async () => {
    const user = userEvent.setup();
    render(
      <ReflectionEvidenceForm
        initialAchievements={[]}
        initialActivities={[]}
        initialDocuments={[]}
      />,
    );

    // Initial empty card is present
    expect(screen.getByText(/Achievement 1/i)).toBeInTheDocument();

    // Click Add Achievement button
    const addButtons = screen.getAllByTitle(/Add/i);
    await user.click(addButtons[0]);

    // Now Achievement 2 should be present
    expect(screen.getByText(/Achievement 2/i)).toBeInTheDocument();
  });

  it('submits valid achievements and activities to /api/reflection and routes to personal reflection', async () => {
    const user = userEvent.setup();
    render(
      <ReflectionEvidenceForm
        initialAchievements={[
          {
            id: 'ach-1',
            category: 'competition',
            title: 'Giải nhất Olympic',
            year: 2024,
          },
        ]}
        initialActivities={[
          {
            id: 'act-1',
            category: 'community_project',
            title: 'Mùa hè xanh',
          },
        ]}
        initialDocuments={[]}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /Continue/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/reflection',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Giải nhất Olympic'),
        }),
      );
      expect(pushMock).toHaveBeenCalledWith(
        '/ai-strategy/reflection/personal?return=%2Fcustom-return',
      );
    });
  });
});
