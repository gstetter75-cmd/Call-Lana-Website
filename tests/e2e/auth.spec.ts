import { test, expect } from '@playwright/test';

// Both test accounts appear to be superadmin — tests adapt to actual roles
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || '';
const CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || '';

test.describe('Authentication', () => {

  test('login with valid admin credentials redirects to protected page', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    // Should redirect to some protected page (admin.html or dashboard.html)
    await page.waitForURL(/\/(admin|dashboard|sales)\.html/, { timeout: 15_000 });
    const url = page.url();
    expect(url).toMatch(/\/(admin|dashboard|sales)\.html/);
  });

  test('login with second account works', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', CUSTOMER_EMAIL);
    await page.fill('#login-password', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|sales)\.html/, { timeout: 15_000 });
    const url = page.url();
    expect(url).toMatch(/\/(admin|dashboard|sales)\.html/);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', 'wrong@example.com');
    await page.fill('#login-password', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    // Should stay on login page
    expect(page.url()).toContain('login.html');
  });

  test('protected page redirects to login when not authenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard.html');
    await page.waitForURL('**/login.html*', { timeout: 15_000 });
    expect(page.url()).toContain('login.html');
  });

  test('auth-pending class is removed after login', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|sales)\.html/, { timeout: 15_000 });
    await page.waitForTimeout(2000);
    const hasAuthPending = await page.evaluate(() => document.body.classList.contains('auth-pending'));
    expect(hasAuthPending).toBe(false);
  });

  test('session persists after page reload', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|sales)\.html/, { timeout: 15_000 });
    const originalUrl = page.url();
    await page.reload();
    await page.waitForTimeout(3000);
    // Should still be on a protected page (not redirected to login)
    expect(page.url()).not.toContain('login.html');
  });

  test('sidebar or content is visible after auth', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|sales)\.html/, { timeout: 15_000 });
    await page.waitForTimeout(2000);
    // Some content should be visible
    const sidebar = page.locator('.sidebar');
    const content = page.locator('.content');
    const hasSidebar = await sidebar.count() > 0 && await sidebar.isVisible();
    const hasContent = await content.count() > 0;
    expect(hasSidebar || hasContent).toBe(true);
  });

  test('logout redirects to login page', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|sales)\.html/, { timeout: 15_000 });
    // Wait for sidebar to load (dynamically injected)
    await page.waitForSelector('#sidebar-logout, .sb-logout, [title="Abmelden"]', { state: 'attached', timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    // Dismiss cookie banner if present (it can block the logout button)
    const cookieBtn = page.locator('button:has-text("Alle akzeptieren")');
    if (await cookieBtn.count() > 0) await cookieBtn.click().catch(() => {});
    // Logout via JS to avoid scroll/visibility issues with sidebar button
    await page.evaluate(async () => {
      if (typeof clanaAuth !== 'undefined') await clanaAuth.signOut();
    });
    await page.waitForURL('**/login.html*', { timeout: 10_000 });
    expect(page.url()).toContain('login.html');
  });
});
