import { expect, test } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';

/**
 * Flows that need a real account.
 *
 * Requires E2E_EMAIL / E2E_PASSWORD pointing at a dedicated Supabase test user
 * with onboarding already completed. Without them the suite skips rather than
 * fails, so CI stays green until the account is provisioned.
 *
 * ⚠️ That account also needs a non-empty `phone` and `date_of_birth` in
 * `student_profiles`. Since 2026-08-17 the proxy holds accounts missing either
 * at /auth/complete-profile — which is under /auth, so an under-provisioned
 * account fails the very first assertion below ("leaves /auth") with a message
 * that looks like a redirect bug rather than missing seed data.
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

  // `FadeInImage` uses next/image's `fill`, so the hero must be its positioned
  // containing block. Without it the absolute image escapes and covers the
  // section navigation/body below the Figma hero.
  const hero = page.getByTestId(TID.uniDetailHero);
  await expect(hero).toBeVisible();
  const geometry = await hero.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    const image = element.querySelector('img');
    const imageRect = image?.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      ratio: frame.width / frame.height,
      imageContained:
        !!imageRect &&
        imageRect.left >= frame.left - 1 &&
        imageRect.top >= frame.top - 1 &&
        imageRect.right <= frame.right + 1 &&
        imageRect.bottom <= frame.bottom + 1,
    };
  });
  expect(geometry.position).toBe('relative');
  expect(geometry.ratio).toBeCloseTo(1216 / 640, 1);
  expect(geometry.imageContained).toBe(true);
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

test('scholarship directory is server-paginated and a save survives reload', async ({ page }) => {
  await signIn(page);
  await page.goto('/universities');
  await page.evaluate(() => localStorage.removeItem('glowbal-focus-university'));
  await page.goto('/scholarships');

  const cards = page.getByTestId(TID.scholarshipCard);
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(9);

  const save = cards.first().locator('button[aria-pressed]');
  if ((await save.getAttribute('aria-pressed')) === 'true') await save.click();

  try {
    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await expect(save).toBeEnabled();
    await page.reload();
    await expect(page.getByTestId(TID.scholarshipCard).first().locator('button[aria-pressed]'))
      .toHaveAttribute('aria-pressed', 'true');

    const next = page.getByRole('button', { name: 'Next page' }).last();
    if (await next.isEnabled()) {
      await next.click();
      await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/);
      expect(await page.getByTestId(TID.scholarshipCard).count()).toBeLessThanOrEqual(9);
      await page.goBack();
      await expect(page).not.toHaveURL(/(?:\?|&)page=2(?:&|$)/);
    }
  } finally {
    const saved = page.getByTestId(TID.scholarshipCard).first().locator('button[aria-pressed]');
    if ((await saved.getAttribute('aria-pressed')) === 'true') await saved.click();
  }
});

test('scholarship focus mode keeps two independent pages and apply focus', async ({ page }) => {
  await signIn(page);
  await page.goto('/scholarships?university=82');
  test.skip(!page.url().includes('university=82'), 'University 82 is unavailable in this environment.');

  const lists = page.getByTestId(TID.scholarshipList);
  test.skip((await lists.count()) < 2, 'University 82 has fewer than two scholarship sections.');
  expect(await lists.nth(0).getByTestId(TID.scholarshipCard).count()).toBeLessThanOrEqual(9);
  expect(await lists.nth(1).getByTestId(TID.scholarshipCard).count()).toBeLessThanOrEqual(9);

  const names = await page.getByTestId(TID.scholarshipCard).locator('h3').allTextContents();
  expect(new Set(names).size).toBe(names.length);

  const firstSave = lists.nth(0).getByTestId(TID.scholarshipCard).first().locator('button[aria-pressed]');
  const wasSaved = (await firstSave.getAttribute('aria-pressed')) === 'true';
  if (!wasSaved) {
    await firstSave.click();
    await expect(firstSave).toBeEnabled();
  }
  try {
    await page.getByTestId(TID.scholarshipContinueToApply).click();
    await expect(page).toHaveURL(/\/apply\?focus=82(?:&|$)/);
  } finally {
    if (!wasSaved) {
      await page.goto('/scholarships?university=82');
      const saved = page.getByTestId(TID.scholarshipList).nth(0)
        .getByTestId(TID.scholarshipCard).first().locator('button[aria-pressed]');
      if ((await saved.getAttribute('aria-pressed')) === 'true') {
        await saved.click();
        await expect(saved).toBeEnabled();
      }
    }
  }
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
