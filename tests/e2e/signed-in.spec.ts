import { expect, test } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';

/**
 * Flows that need a real account.
 *
 * Requires E2E_EMAIL / E2E_PASSWORD pointing at a dedicated Supabase test user
 * with onboarding already completed. Without them the suite skips rather than
 * fails, so CI stays green until the account is provisioned.
 *
 * The shortlist test writes to `user_universities` for that user only, and
 * cleans up after itself. Do not point these at a real account.
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  'Set E2E_EMAIL and E2E_PASSWORD to run the signed-in flows.',
);

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth');
  await page.getByTestId(TID.authEmailInput).fill(EMAIL!);
  await page.getByTestId(TID.authPasswordInput).fill(PASSWORD!);
  await page.getByTestId(TID.authSubmit).click();
  // The proxy redirects away from /auth once the session cookie is set.
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
}

test('a signed-in user leaves /auth', async ({ page }) => {
  await signIn(page);
  expect(new URL(page.url()).pathname).not.toBe('/auth');
});

test('a signed-in user can open a university detail view', async ({ page }) => {
  await signIn(page);
  await page.goto('/universities');
  await expect(page.getByTestId(TID.uniCard).first()).toBeVisible();

  await page.getByTestId(TID.uniCard).first().click();

  // Unlike a guest, this must open rather than trigger the login gate.
  await expect(page.getByTestId(TID.uniDetailPanel)).toBeVisible();
});

test('saving a university survives a reload', async ({ page }) => {
  await signIn(page);
  await page.goto('/universities');
  await expect(page.getByTestId(TID.uniCard).first()).toBeVisible();

  const save = page.getByTestId(TID.uniCardSaveButton).first();
  const label = await save.getAttribute('aria-label');
  const alreadySaved = label?.toLowerCase().includes('remove') ?? false;

  // Start from a known state so the test is idempotent.
  if (alreadySaved) {
    await save.click();
    await expect(save).toHaveAttribute('aria-label', /save/i);
  }

  await save.click();
  await expect(save).toHaveAttribute('aria-label', /remove/i);

  await page.reload();
  const afterReload = page.getByTestId(TID.uniCardSaveButton).first();
  await expect(afterReload).toHaveAttribute('aria-label', /remove/i);

  // Clean up so the next run starts from the same state.
  await afterReload.click();
  await expect(afterReload).toHaveAttribute('aria-label', /save/i);
});

test('a VinUni application opens the V2 statement feedback workspace', async ({ page }) => {
  await signIn(page);
  const response = await page.request.get('/api/applications');
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    applications?: Array<{
      id: string;
      universityName?: string;
      university_name?: string;
    }>;
  };
  const vinUni = payload.applications?.find((application) =>
    /vin\s*(?:university|uni)/i.test(
      application.universityName ?? application.university_name ?? '',
    ),
  );
  test.skip(!vinUni, 'The E2E account has no VinUniversity application.');

  await page.goto(`/apply/${vinUni!.id}/statement-feedback`);

  await expect(page.getByLabel('Đề bài luận')).toBeVisible();
  await expect(page.getByLabel('Nội dung bài luận')).toBeVisible();
  await expect(page.getByText('VinUni AACC')).toBeVisible();
});
