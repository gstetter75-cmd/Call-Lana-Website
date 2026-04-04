import { test, expect } from '../fixtures/auth.fixture';
import { test as base } from '@playwright/test';

const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || '';
const CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || '';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

test.describe('Role-Based Access Control', () => {

  // --- Customer cannot access admin pages ---

  test('customer is redirected away from admin.html', async ({ customerPage: page }) => {
    await page.goto('/admin.html');
    await page.waitForTimeout(3000);
    // Customer should be redirected to dashboard or login
    const url = page.url();
    expect(url).not.toContain('admin.html');
    expect(url.includes('dashboard.html') || url.includes('login.html')).toBe(true);
  });

  test('customer is redirected away from sales.html', async ({ customerPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForTimeout(3000);
    // Customer should be redirected to dashboard or login
    const url = page.url();
    expect(url).not.toContain('sales.html');
    expect(url.includes('dashboard.html') || url.includes('login.html')).toBe(true);
  });

  test('customer can access dashboard.html', async ({ customerPage: page }) => {
    expect(page.url()).toContain('dashboard.html');
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('customer can access settings.html', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    expect(page.url()).toContain('settings.html');
  });

  // --- Admin can access all pages ---

  test('admin can access admin.html', async ({ adminPage: page }) => {
    expect(page.url()).toContain('admin.html');
  });

  test('admin can access sales.html', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    expect(page.url()).toContain('sales.html');
  });

  test('admin can access dashboard.html', async ({ adminPage: page }) => {
    await page.goto('/dashboard.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    expect(page.url()).toContain('dashboard.html');
  });

  test('admin can access settings.html', async ({ adminPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    expect(page.url()).toContain('settings.html');
  });

  // --- Admin sees admin-only UI elements ---

  test('admin sidebar has admin-specific links', async ({ adminPage: page }) => {
    // Admin page should have tab buttons
    await expect(page.locator('.tab-btn[data-tab="overview"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="customers"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="users"]')).toBeVisible();
  });

  // --- Data isolation ---

  test('customer profile shows own email', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(1000);
    const emailField = page.locator('#email');
    if (await emailField.count() > 0) {
      const emailValue = await emailField.inputValue();
      expect(emailValue).toContain('g.stetter@gmx.net');
    }
  });

  test('admin profile shows own email', async ({ adminPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(1000);
    const emailField = page.locator('#email');
    if (await emailField.count() > 0) {
      const emailValue = await emailField.inputValue();
      expect(emailValue).toContain('gstetter75@googlemail.com');
    }
  });

  // --- Unauthenticated access ---

  test('unauthenticated user cannot access dashboard', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/dashboard.html');
    await page.waitForTimeout(5000);
    const url = page.url();
    expect(url).toContain('login.html');
    await context.close();
  });

  test('unauthenticated user cannot access admin', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/admin.html');
    await page.waitForTimeout(5000);
    const url = page.url();
    expect(url).toContain('login.html');
    await context.close();
  });

  test('unauthenticated user cannot access settings', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/settings.html');
    await page.waitForTimeout(5000);
    const url = page.url();
    expect(url).toContain('login.html');
    await context.close();
  });
});
