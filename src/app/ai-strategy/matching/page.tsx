import { redirect } from 'next/navigation';
import Link from 'next/link';
import { listMatchingApplications } from '@/features/apply/api';
import { AI_JOURNEY, aiJourneySteps } from '@/features/apply/domain';
import { createClient } from '@/lib/supabase/server';
import { Avatar, Badge, Button, Panel, Stepper } from '@/shared/ui';
import { ReflectionChrome } from '../reflection-chrome';

export default async function MatchingApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const result = await listMatchingApplications(supabase, user.id);

  return (
    <ReflectionChrome user={user}>
      <div className="flex flex-col gap-gb-4xl" data-no-auto-translate>
        <header className="flex flex-col gap-gb-lg">
          <Badge variant="brand-subtle">GlowBal Matching Report</Badge>
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            Chọn chương trình để đánh giá
          </h1>
          <p className="text-gb-md text-fg-tertiary">
            Mỗi báo cáo gắn với một chương trình cụ thể và chỉ dùng dữ liệu thuộc tài khoản
            của bạn.
          </p>
        </header>

        <Stepper
          steps={aiJourneySteps()}
          currentIndex={AI_JOURNEY.findIndex((step) => step.key === 'university')}
          label="Hành trình AI Strategy"
        />

        {result.migrationMissing ? (
          <p className="text-gb-sm text-fg-error">
            Matching Report chưa được kích hoạt trong cơ sở dữ liệu.
          </p>
        ) : null}

        {result.applications.length === 0 ? (
          <Panel className="flex flex-col items-start gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">Chưa có chương trình nào</h2>
            <p className="text-gb-sm text-fg-tertiary">
              Hãy thêm một chương trình vào My Applications trước khi tạo báo cáo.
            </p>
            <Button href="/apply">Thêm chương trình</Button>
          </Panel>
        ) : (
          <div className="grid gap-gb-lg">
            {result.applications.map((application) => (
              <Link
                key={application.id}
                href={`/ai-strategy/matching/${application.id}`}
                className="rounded-gb-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Panel className="flex items-center justify-between gap-gb-xl transition-colors hover:border-line-strong hover:bg-surface-hover">
                  <div className="flex min-w-0 items-center gap-gb-lg">
                    <Avatar name={application.universityName} size="lg" />
                    <div className="min-w-0">
                      <h2 className="truncate text-gb-md font-semibold text-fg">
                        {application.courseName}
                      </h2>
                      <p className="truncate text-gb-sm text-fg-tertiary">
                        {application.universityName}
                      </p>
                      <p className="text-gb-xs text-fg-muted">
                        {[application.degreeLevel, application.country].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={application.analysis ? 'safe-chip' : 'neutral-chip'}>
                    {application.analysis ? 'Đã có báo cáo' : 'Chưa phân tích'}
                  </Badge>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ReflectionChrome>
  );
}
