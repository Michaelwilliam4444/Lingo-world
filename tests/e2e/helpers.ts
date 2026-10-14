import { expect, type Page } from '@playwright/test';

/** Signs up a fresh parent in device mode and creates one child. */
export async function signUpWithChild(page: Page, opts: { nickname?: string; lang?: 'English' | 'French' | 'German' | 'Italian' | 'Spanish'; age?: string } = {}) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto('/auth/sign-up');
  await page.fill('input[autocomplete="given-name"]', 'Parent');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', 'supersecret1');
  await page.check('input[type=checkbox]');
  await page.click('button[type=submit]');
  await page.waitForURL('**/parent/children/new');
  await page.fill('input[name=nickname]', opts.nickname ?? 'Maria');
  await page.selectOption('select[name=age]', opts.age ?? '7');
  await page.click(`label:has-text("${opts.lang ?? 'French'}")`);
  // Disable voice so tests use the deterministic "I said it!" path.
  await page.uncheck('input[name=voiceConsent]');
  await page.click('button[type=submit]');
  await page.waitForURL('**/child/onboarding');
  return email;
}

export async function finishChildOnboarding(page: Page) {
  await page.click('button:has-text("Next")');
  await page.click('button:has-text("Next")');
  await page.click('button[aria-label=animals]');
  await page.click('button:has-text("go")');
  await page.waitForURL('**/play/journey');
  await expect(page.getByText('Lumi').first()).toBeVisible();
}

/** Plays through today's journey by always taking the first available action. */
export async function playJourney(page: Page) {
  const click = (sel: string) => page.locator(sel).first().click({ force: true, timeout: 3000 }).catch(() => undefined);
  const has = async (sel: string) => (await page.locator(sel).count()) > 0;
  for (let step = 0; step < 80 && page.url().includes('/play/journey'); step++) {
    await page.waitForTimeout(400);
    if (await has('button:has-text("say it together")')) await click('button:has-text("say it together")');
    else if (await has('button:has-text("The end")')) await click('button:has-text("The end")');
    else if (await has('section[aria-label] header')) {
      for (let r = 0; r < 40 && (await has('section[aria-label] header')); r++) {
        if (await has('button[aria-label="I said it!"]')) { await click('button[aria-label="I said it!"]'); await page.waitForTimeout(1500); continue; }
        const opts = page.locator('section[aria-label] div button:not([title])');
        const n = await opts.count();
        if (n) await opts.nth(r % n).click({ force: true, timeout: 2000 }).catch(() => undefined);
        await page.waitForTimeout(450);
      }
      await click('button:has-text("Continue")');
    } else if (await has('button[aria-label="I said it!"]')) { await click('button[aria-label="I said it!"]'); await page.waitForTimeout(1600); }
    else if (await has('button:has-text("Continue")')) { await page.waitForTimeout(300); await click('button:has-text("Continue")'); }
    else if (await has('div.grid button span.text-6xl')) await click('div.grid button');
    await page.waitForTimeout(300);
  }
}

export async function passParentGate(page: Page) {
  const label = await page.locator('label[for=gate-answer]').textContent();
  const m = label!.match(/(\d+) × (\d+)/)!;
  await page.fill('#gate-answer', String(Number(m[1]) * Number(m[2])));
  await page.click('button[type=submit]');
}
