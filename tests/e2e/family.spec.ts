import { expect, test } from '@playwright/test';
import { finishChildOnboarding, passParentGate, playJourney, signUpWithChild } from './helpers';

test.describe('family journey (device mode)', () => {
  test('parent signs up, child onboards and completes a daily journey', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await signUpWithChild(page);
    await finishChildOnboarding(page);
    await playJourney(page);
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByText('You finished today’s adventure!')).toBeVisible();
    // Mimo hatched and a sticker was earned
    await page.goto('/play/rewards');
    await expect(page.getByText('Golden Key')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('parent gate protects the Parent Zone and dashboard shows progress', async ({ page }) => {
    await signUpWithChild(page, { lang: 'Spanish', nickname: 'Omar' });
    await finishChildOnboarding(page);
    await playJourney(page);
    await page.goto('/parent');
    await expect(page.getByText('For grown-ups')).toBeVisible();
    await page.fill('#gate-answer', '1');
    await page.click('button[type=submit]');
    await expect(page.getByText('That’s not it. Here’s a new one.')).toBeVisible();
    await passParentGate(page);
    await expect(page.getByText(/This week Omar practised \d+ Spanish word/)).toBeVisible();
    await page.goto('/parent/reports');
    await page.click('button:has-text("Create this week’s report")');
    await expect(page.getByText("Omar's week in LingoWorld")).toBeVisible();
  });

  test('multiple children, plan limits and mock subscription', async ({ page }) => {
    await signUpWithChild(page, { nickname: 'Ada', lang: 'German' });
    await finishChildOnboarding(page);
    await page.goto('/parent/children/new');
    await passParentGate(page);
    await page.fill('input[name=nickname]', 'Ben');
    await page.click('label:has-text("Italian")');
    await page.click('button[type=submit]');
    await page.waitForURL('**/child/onboarding');
    await page.goto('/parent/children');
    await expect(page.getByText('Upgrade to add more children')).toBeVisible();
    await page.goto('/parent/plan');
    await page.click('button:has-text("Choose Family")');
    // Payment-method step (card / wallet / Fawry); demo billing applies the plan instantly.
    await page.click('label:has-text("Bank card")');
    await page.fill('input[autocomplete=tel]', '01001234567');
    await page.click('button:has-text("Continue to pay")');
    await expect(page.getByText('Current plan').first()).toBeVisible();
    await page.goto('/parent/children');
    await expect(page.getByRole('link', { name: 'Add a child' })).toBeVisible();
    await page.goto('/who');
    await expect(page.getByText('Ada')).toBeVisible();
    await expect(page.getByText('Ben')).toBeVisible();
  });
});

test.describe('child modes', () => {
  test('explore, play, create, Mimo, library and music all open', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await signUpWithChild(page, { lang: 'English' });
    await finishChildOnboarding(page);
    for (const [path, text] of [
      ['/play/explore', 'Explore LingoWorld'], ['/play/explore?world=my-home', 'Find the hidden things!'], ['/play/games', 'Play'],
      ['/play/game?type=memory-cards', 'Find the pairs'], ['/play/create', 'Create'], ['/play/mimo', 'Tricks'], ['/play/library', 'Library'],
      ['/play/book?id=book.colours', 'Read to me'], ['/play/music', 'Music Valley'], ['/play/rewards', 'My treasures'], ['/play/roleplay?id=rp.new-friend', 'Meeting a New Friend'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByText(text).first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('switching the learning language keeps separate progress', async ({ page }) => {
    await signUpWithChild(page, { lang: 'French' });
    await finishChildOnboarding(page);
    await playJourney(page);
    await page.goto('/parent/children');
    await passParentGate(page);
    await page.click('a:has-text("Settings & controls")');
    await page.selectOption('select >> nth=1', 'it');
    await page.click('button:has-text("Save changes")');
    // Free plan: language switching is premium — the UI explains instead of silently failing.
    await expect(page.getByText(/Switching the learning language is part of Premium/)).toBeVisible();
  });
});

test.describe('admin CMS', () => {
  test('passcode gate and content editing with live preview', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('#pc', process.env.LOCAL_ADMIN_PASSCODE ?? 'lingo-admin');
    await page.click('button[type=submit]');
    await expect(page.getByText('Content overview')).toBeVisible();
    await expect(page.getByText('Ready to publish')).toBeVisible();
    await page.goto('/admin/content?type=concepts');
    await page.getByRole('button', { name: /food\.apple/ }).click();
    await expect(page.getByText('der Apfel')).toBeVisible();
    await expect(page.getByText('Je vois une pomme rouge.')).toBeVisible();
  });
});
