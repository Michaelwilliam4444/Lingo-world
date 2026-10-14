import { expect, test } from '@playwright/test';

test.describe('public website', () => {
  test('landing, tracks, pricing, contact and legal pages are reachable from the site chrome', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/welcome');
    await expect(page.getByText('A separate track for every age')).toBeVisible();
    for (const [path, text] of [
      ['/tracks', 'One world. Three separate tracks.'], ['/pricing', 'Simple plans for the whole family'], ['/contact', 'Contact us'],
      ['/legal/terms', 'Terms of Service'], ['/legal/privacy', 'Privacy Policy'], ['/legal/refunds', 'Refund & Cancellation Policy'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: text })).toBeVisible();
    }
    await page.goto('/tracks');
    for (const name of ['Little Explorers', 'Adventurers', 'Heroes']) await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    await page.goto('/pricing');
    await page.getByRole('radio', { name: /USD/ }).click();
    await expect(page.getByText('$9.99').first()).toBeVisible();
    await page.getByRole('radio', { name: /EGP/ }).click();
    await expect(page.getByText(/EGP\s?249/).first()).toBeVisible();
    const sitemap = await page.request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('/pricing');
    expect(errors).toEqual([]);
  });
});
