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
              title: 'Demo placing — Example Mathematics Olympiad',
              competition: 'Example Olympiad',
              organisation: 'Example Department of Education',
              level: 'Cấp thành phố',
              year: 2026,
              detail: 'Demo entry. Not a real student record.',
              reviewStatus: 'reviewed',
              sourceType: 'manual',
            },
            {
              id: 'demo-3',
              category: 'certification',
              title: 'Demo — Example English Test 8.0',
              organisation: 'Example Test Board',
              year: 2025,
              detail: 'Demo entry, showing an unreviewed AI-extracted card.',
              reviewStatus: 'needs_review',
              sourceType: 'document',
              sources: [{ documentId: 'demo-doc', fileName: 'Demo_CV.pdf', page: 2 }],
            },
          ]}
          initialActivities={[
            {
              id: 'demo-2',
              category: 'mentoring',
              title: 'Demo peer tutoring programme',
              organisation: 'Example School',
              period: '2024 – 2026',
              reviewStatus: 'reviewed',
              sourceType: 'manual',
            },
          ]}
          initialDocuments={[
            {
              id: 'demo-doc',
              fileName: 'Demo_CV.pdf',
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
