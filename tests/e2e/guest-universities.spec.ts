import { expect, test } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';

/**
 * The guest browse experience on /universities.
 *
 * This is the page Track A is re-plumbing (server pagination) and Track B is
 * redesigning, so it needs a contract that outlives both.
 *
 * Note what is NOT asserted: opening a university detail view. Guests are
 * deliberately gated out of it — `setView('detail')` in explorer-context opens
 * the login gate instead. Detail-view coverage therefore lives in the
 * signed-in spec, not here.
 */
test.describe('guest browsing universities', () => {
  test('renders a results grid with cards', async ({ page }) => {
    await page.goto('/universities');

    await expect(page.getByTestId(TID.uniResultsGrid)).toBeVisible();
    await expect(page.getByTestId(TID.uniCard).first()).toBeVisible();

    const cards = await page.getByTestId(TID.uniCard).count();
    expect(cards, 'guest list should not be empty').toBeGreaterThan(0);
  });

  test('every card exposes a save control', async ({ page }) => {
    await page.goto('/universities');
    await expect(page.getByTestId(TID.uniCard).first()).toBeVisible();

    const cards = await page.getByTestId(TID.uniCard).count();
    const saveButtons = await page.getByTestId(TID.uniCardSaveButton).count();
    expect(saveButtons).toBe(cards);
  });

  test('search input filters the grid', async ({ page }) => {
    await page.goto('/universities');
    await expect(page.getByTestId(TID.uniCard).first()).toBeVisible();

    const before = await page.getByTestId(TID.uniCard).count();

    // A string unlikely to match anything, so the count must drop.
    await page.getByTestId(TID.uniSearchInput).fill('zzzzzzzzzz');
    await expect(async () => {
      const after = await page.getByTestId(TID.uniCard).count();
      expect(after).toBeLessThan(before);
    }).toPass({ timeout: 10_000 });
  });

  test('clicking a card gates a guest instead of opening the detail view', async ({ page }) => {
    await page.goto('/universities');
    await expect(page.getByTestId(TID.uniCard).first()).toBeVisible();

    await page.getByTestId(TID.uniCard).first().click();

    // The login gate is the intended outcome for a signed-out visitor.
    await expect(page.getByTestId(TID.uniDetailPanel)).toHaveCount(0);
  });
});
