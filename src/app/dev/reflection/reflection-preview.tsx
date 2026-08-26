'use client';

import { Container } from '@/shared/ui';
import { ReflectionAboutForm } from '@/app/ai-strategy/reflection/reflection-about-form';
import { ReflectionEvidenceForm } from '@/app/ai-strategy/reflection/achievements/reflection-evidence-form';

/**
 * Both reflection steps, unauthenticated.
 *
 * The real routes redirect to /auth, so the only way to look at them is to hold
 * a signed-in account — the same reason /dev/apply-workspace exists. Everything
 * here is the real component; only the seed values are fabricated, and they are
 * written to be obviously fabricated per CLAUDE.md's rule about demo data that
 * could pass for a real student's.
 *
 * Submitting posts to /api/reflection and will 401. That is correct: the point
 * of this page is the layout, not the round trip.
 */
export function ReflectionPreview({ step }: { step: 'about' | 'evidence' }) {
  if (step === 'evidence') {
    return (
      <Container className="max-w-4xl py-gb-5xl">
        <ReflectionEvidenceForm
          initialAchievements={[
            {
              id: 'demo-1',
              category: 'competition',
              title: '1 Giải nhất Kì thi Olympic Toán học Sinh viên toàn quốc 2024',
              competition: 'Olympic Toán học Toàn quốc',
              organisation: 'Hội Toán học Việt Nam / ĐHQG',
              level: 'National',
              year: 2024,
              detail:
                'Điểm số đạt được: 28.5/30, xếp thứ 2 toàn đoàn. Đại diện cho trường Đại học Khoa học Tự nhiên tham dự vòng chung kết và đạt thành tích xuất sắc.',
              reviewStatus: 'reviewed',
              sourceType: 'manual',
            },
          ]}
          initialActivities={[
            {
              id: 'demo-2',
              category: 'community_project',
              title: 'Chiến dịch Mùa hè xanh 2024',
              organisation: 'Đoàn trường THPT',
              level: 'Trưởng ban Tổ chức',
              period: '06/2024 - 08/2024',
              description:
                'Điều phối 50 tình nguyện viên tham gia xây dựng 2 phòng học cho trẻ em vùng cao và tổ chức các lớp sinh hoạt hè.',
              reviewStatus: 'reviewed',
              sourceType: 'manual',
            },
          ]}
          initialDocuments={[
            {
              id: 'demo-doc',
              fileName: 'Resume.pdf',
              storageKey: '',
              uploadedAt: new Date().toISOString(),
            },
          ]}
        />
      </Container>
    );
  }

  return (
    <Container className="max-w-4xl py-gb-5xl">
      <ReflectionAboutForm
        initial={{
          highestEducation: '4 - Year Bachelor’s Degree',
          nationality: 'Vietnam',
          gpa: '3.5 / 4',
          ielts: '7 / 10',
          // Two subjects, so the per-subject motivation question shows its
          // chips rather than the single-subject case only.
          majors: ['arts-design', 'computer-science'],
          countries: ['JP'],
          intendedLevel: 'Bachelor’s Degree',
          // Seeded because the intake question is required: without it this
          // page cannot be walked past question 8, which is most of what it
          // exists to show.
          intake: { type: 'undecided' },
          fundingSource: 'personal_savings_or_parents',
          tuitionBudget: { currency: 'GBP', min: 15_000, max: 40_000 },
        }}
      />
    </Container>
  );
}
