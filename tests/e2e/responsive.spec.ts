import { test, expect } from '../fixtures/auth.fixture';
import { test as base } from '@playwright/test';

test.describe('Responsive & Mobile', () => {

  // --- Public pages mobile ---

  base('homepage is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(500);
    // Mobile hamburger menu should appear or nav should be collapsed
    const hamburger = page.locator('.mobile-toggle, .hamburger, [class*="menu-toggle"], button[aria-label*="Menu"]');
    const desktopNav = page.locator('nav .nav-links, nav ul');
    // Either hamburger is visible or desktop nav is hidden
    const isMobileLayout = await hamburger.count() > 0 || !(await desktopNav.isVisible().catch(() => false));
    expect(isMobileLayout).toBe(true);
  });

  base('login page works on mobile', async ({ page }) => {
    await page.goto('/login.html');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    // Dismiss cookie banner if present
    const cookieBtn = page.locator('button:has-text("Alle akzeptieren")');
    if (await cookieBtn.count() > 0) await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(300);
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  base('registration page works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/registrierung.html');
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();
    await expect(page.locator('#reg-form button[type="submit"]')).toBeVisible();
  });

  // --- Dashboard mobile ---

  test('dashboard sidebar collapses on mobile', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    const sidebar = page.locator('.sidebar');
    // Sidebar should either be hidden or collapsed on mobile
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    const bottomNav = page.locator('.mobile-bottom-nav');
    const bottomNavVisible = await bottomNav.isVisible().catch(() => false);
    // On mobile: either sidebar is hidden or bottom nav is shown
    expect(!sidebarVisible || bottomNavVisible).toBe(true);
  });

  test('dashboard content is scrollable on mobile', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const content = page.locator('.content, .main-content, main');
    await expect(content.first()).toBeVisible();
  });

  test('mobile bottom nav has correct links', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    const bottomNav = page.locator('.mobile-bottom-nav');
    if (await bottomNav.isVisible().catch(() => false)) {
      const links = await bottomNav.locator('a, button').count();
      expect(links).toBeGreaterThanOrEqual(3);
    }
  });

  test('mobile bottom nav navigation works', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    // Dismiss cookie banner if present
    const cookieBtn = page.locator('button:has-text("Alle akzeptieren")');
    if (await cookieBtn.count() > 0) await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(300);
    const bottomNav = page.locator('.mobile-bottom-nav');
    if (await bottomNav.isVisible().catch(() => false)) {
      const navItem = bottomNav.locator('a, button').nth(1);
      if (await navItem.count() > 0) {
        await navItem.click();
        await page.waitForTimeout(500);
        // Page should change
        const activePage = page.locator('.page.active, [class*="page"][class*="active"]');
        await expect(activePage.first()).toBeVisible();
      }
    }
  });

  // --- Tablet viewport ---

  test('dashboard works on tablet viewport', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    // Content should be visible
    const heading = page.locator('h1:has-text("Dashboard")');
    await expect(heading).toBeVisible();
    // Metric cards should be visible
    await expect(page.locator('#metricCallsToday')).toBeVisible();
  });

  test('admin page works on tablet viewport', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    // Tab buttons should be visible
    await expect(page.locator('.tab-btn[data-tab="overview"]')).toBeVisible();
  });

  // --- Settings mobile ---

  test('settings page works on mobile', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    // Profile form should be usable
    const firstNameInput = page.locator('#firstName');
    await expect(firstNameInput).toBeVisible();
  });

  // --- Sales CRM mobile ---

  test('sales page tabs work on mobile', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    // Tab bar should be scrollable or wrap
    const tabBar = page.locator('.tab-bar, [class*="tab"]').first();
    await expect(tabBar).toBeVisible();
  });
});
