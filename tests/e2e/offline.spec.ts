import { expect, test } from '@playwright/test';
import { finishChildOnboarding, signUpWithChild } from './helpers';

/**
 * Device mode: once screens have been opened (or downloaded via Parent Zone → Offline),
 * the child world works without a network and progress is saved locally.
 */
test('child world keeps working without network', async ({ page, context }) => {
  await signUpWithChild(page);
  await finishChildOnboarding(page);
  for (const path of ['/play', '/play/games', '/play/mimo']) { await page.goto(path); await page.waitForTimeout(800); }
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15_000 }).catch(() => undefined);
  await context.setOffline(true);
  await page.click('button:has-text("Feed")');
  await page.goto('/play/games');
  await expect(page.getByText('Picture Hunt')).toBeVisible();
  await page.goto('/play/mimo');
  await expect(page.getByText('Tricks').first()).toBeVisible();
  await context.setOffline(false);
});
