import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

async function importPage() {
  return import('./page');
}

describe('ApplicantPortraitLegacyAlias', () => {
  it('redirects to the canonical Personal Report with a return param back to this Strategy', async () => {
    const { default: ApplicantPortraitLegacyAlias } = await importPage();

    await ApplicantPortraitLegacyAlias({ params: Promise.resolve({ applicationId: 'app-1' }) });

    expect(mocks.redirect).toHaveBeenCalledWith(
      `/ai-strategy/personal-report?return=${encodeURIComponent('/ai-strategy/app-1/strategy/analysis')}`,
    );
  });
});
