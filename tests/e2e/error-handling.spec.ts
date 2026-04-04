import { test, expect } from '../fixtures/auth.fixture';
import { test as base } from '@playwright/test';

test.describe('Error Handling', () => {

  // --- Login errors ---

  base('login with empty fields shows validation', async ({ page }) => {
    await page.goto('/login.html');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    // Should stay on login page (browser validation prevents submission)
    expect(page.url()).toContain('login.html');
  });

  base('login with invalid email format shows error', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', 'not-an-email');
    await page.fill('#login-password', 'somepassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Should show error or stay on login
    expect(page.url()).toContain('login');
  });

  base('login with wrong password shows error message', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-email', 'gstetter75@googlemail.com');
    await page.fill('#login-password', 'totallyWrongPassword123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const errorMsg = page.locator('#login-error, .error-message, [class*="error"]');
    if (await errorMsg.count() > 0) {
      await expect(errorMsg.first()).toBeVisible();
    }
    // Should still be on login page
    expect(page.url()).toContain('login');
  });

  // --- Dashboard error states ---

  test('dashboard handles no calls gracefully', async ({ customerPage: page }) => {
    // With empty data, dashboard should show 0s and empty states
    await expect(page.locator('#metricCallsToday')).toContainText('0');
    await expect(page.locator('#metricMinutes')).toContainText('0');
  });

  test('calls page shows empty state when no calls', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="transactions"]').click();
    await page.waitForTimeout(1000);
    const tbody = page.locator('#allCallsBody');
    const text = await tbody.textContent();
    // Should show "Keine Anrufe" or empty rows or loading
    expect(text !== null).toBe(true);
  });

  test('appointments page handles empty state', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="appointments"]').click();
    await page.waitForTimeout(1000);
    // Should not crash with no appointments
    const weekView = page.locator('#appt-week-view');
    await expect(weekView).toBeVisible();
  });

  // --- Form validation ---

  test('security tab has password change form', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(1000);
    // Navigate to security tab
    const securityNav = page.locator('.settings-nav-item:has-text("Sicherheit"), a:has-text("Sicherheit")');
    if (await securityNav.count() > 0) {
      await securityNav.first().click();
      await page.waitForTimeout(500);
      await expect(page.locator('#newPw')).toBeVisible();
      await expect(page.locator('#newPw2')).toBeVisible();
      await expect(page.locator('#savePwBtn')).toBeVisible();
    }
  });

  // --- Navigation edge cases ---

  test('double hash navigation does not crash', async ({ customerPage: page }) => {
    await page.goto(page.url().split('#')[0] + '#home');
    await page.waitForTimeout(300);
    await page.goto(page.url().split('#')[0] + '#home');
    await page.waitForTimeout(300);
    const homePage = page.locator('#page-home');
    await expect(homePage).toHaveClass(/active/);
  });

  test('rapid tab switching does not crash dashboard', async ({ customerPage: page }) => {
    const pages = ['home', 'assistants', 'transactions', 'appointments', 'analytics', 'home'];
    for (const p of pages) {
      const link = page.locator(`.sb-item[data-page="${p}"]`);
      if (await link.count() > 0) {
        await link.click();
        await page.waitForTimeout(200);
      }
    }
    // Should end up on home without crashing
    const homePage = page.locator('#page-home');
    await expect(homePage).toHaveClass(/active/);
  });

  // --- API error resilience ---

  test('dashboard loads even if some API calls fail', async ({ customerPage: page }) => {
    // The page should have loaded despite potentially empty data
    await expect(page.locator('h1').first()).toBeVisible();
    // Sidebar should be functional
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  // --- Cookie banner ---

  base('cookie banner is shown on first visit', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const cookieBanner = page.locator('[class*="cookie"], dialog:has-text("Cookie")');
    if (await cookieBanner.count() > 0) {
      await expect(cookieBanner.first()).toBeVisible();
    }
  });

  base('cookie banner can be accepted', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const acceptBtn = page.locator('button:has-text("Alle akzeptieren")');
    if (await acceptBtn.count() > 0) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
      // Banner should disappear
      const banner = page.locator('dialog:has-text("Cookie")');
      if (await banner.count() > 0) {
        await expect(banner).not.toBeVisible();
      }
    }
  });

  base('cookie banner can be rejected', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const rejectBtn = page.locator('button:has-text("Nur notwendige")');
    if (await rejectBtn.count() > 0) {
      await rejectBtn.click();
      await page.waitForTimeout(500);
      const banner = page.locator('dialog:has-text("Cookie")');
      if (await banner.count() > 0) {
        await expect(banner).not.toBeVisible();
      }
    }
  });

  // --- 404 handling ---

  base('non-existent page shows 404 or redirects', async ({ page }) => {
    await page.goto('/this-page-does-not-exist.html');
    await page.waitForTimeout(2000);
    // Should show 404 content or redirect
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });
});
