import { test as base, expect, Page } from '@playwright/test';

// Auth fixture: provides logged-in pages for different roles
type AuthFixtures = {
  customerPage: Page;
  adminPage: Page;
};

async function loginAs(page: Page, email: string, password: string, expectedUrl: string) {
  await page.goto('/login.html');
  await page.waitForSelector('#login-email', { state: 'visible', timeout: 10_000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  // Wait for redirect after login
  await page.waitForURL(`**/${expectedUrl}*`, { timeout: 15_000 });
  // Wait for auth-pending to be removed (content visible)
  await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
}

export const test = base.extend<AuthFixtures>({
  customerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(
      page,
      process.env.TEST_CUSTOMER_EMAIL || '',
      process.env.TEST_CUSTOMER_PASSWORD || '',
      'dashboard.html'
    );
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(
      page,
      process.env.TEST_ADMIN_EMAIL || '',
      process.env.TEST_ADMIN_PASSWORD || '',
      'admin.html'
    );
    await use(page);
    await context.close();
  },
});

export { expect };
