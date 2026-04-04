import { test, expect } from '../fixtures/auth.fixture';

test.describe('Customer Dashboard', () => {

  test('sidebar is visible with navigation links', async ({ customerPage: page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    // Check key navigation items exist
    await expect(page.locator('.sb-item[data-page="home"]')).toBeVisible();
    await expect(page.locator('.sb-item[data-page="assistants"]')).toBeVisible();
    await expect(page.locator('.sb-item[data-page="transactions"]')).toBeVisible();
  });

  test('sidebar links are clickable and navigate', async ({ customerPage: page }) => {
    const assistantsLink = page.locator('.sb-item[data-page="assistants"]');
    await assistantsLink.click();
    await page.waitForTimeout(500);
    const assistantsPage = page.locator('#page-assistants');
    await expect(assistantsPage).toHaveClass(/active/);
  });

  test('home shows 4 metric cards', async ({ customerPage: page }) => {
    await expect(page.locator('#metricCallsToday')).toBeVisible();
    await expect(page.locator('#metricBookingRate')).toBeVisible();
    await expect(page.locator('#metricMinutes')).toBeVisible();
    await expect(page.locator('#metricSentiment')).toBeVisible();
  });

  test('home shows recent calls widget', async ({ customerPage: page }) => {
    const widget = page.locator('#widget-recent-calls');
    await expect(widget).toBeVisible();
  });

  test('home shows appointments widget', async ({ customerPage: page }) => {
    const widget = page.locator('#widget-appointments');
    await expect(widget).toBeVisible();
  });

  test('home shows top leads widget', async ({ customerPage: page }) => {
    const widget = page.locator('#widget-top-leads');
    await expect(widget).toBeVisible();
  });

  test('navigate to calls page shows filter bar', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="transactions"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#callSearchInput')).toBeVisible();
    await expect(page.locator('#callStatusFilter')).toBeVisible();
    await expect(page.locator('#callOutcomeFilter')).toBeVisible();
  });

  test('navigate to appointments page shows week view', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="appointments"]').click();
    await page.waitForTimeout(500);
    const weekView = page.locator('#appt-week-view');
    await expect(weekView).toBeVisible();
  });

  test('appointments week navigation works', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="appointments"]').click();
    await page.waitForTimeout(500);
    const weekLabel = page.locator('#appt-week-label');
    const initialText = await weekLabel.textContent();
    // Click next week
    await page.click('text=Nächste →');
    await page.waitForTimeout(500);
    const newText = await weekLabel.textContent();
    expect(newText).not.toBe(initialText);
  });

  test('appointments view toggle works', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="appointments"]').click();
    await page.waitForTimeout(500);
    // Switch to list view
    await page.click('text=Liste');
    await page.waitForTimeout(300);
    const listView = page.locator('#appt-list-view');
    await expect(listView).toBeVisible();
  });

  test('navigate to analytics page shows charts', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="analytics"]').click();
    await page.waitForTimeout(1000);
    // Charts should render (not empty divs)
    const chartContainer = page.locator('#chart-calls-per-day');
    await expect(chartContainer).toBeVisible();
  });

  test('navigate to billing page', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="billing"]').click();
    await page.waitForTimeout(500);
    const billingPage = page.locator('#page-billing');
    await expect(billingPage).toHaveClass(/active/);
  });

  test('CSV export button exists on calls page', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="transactions"]').click();
    await page.waitForTimeout(500);
    const exportBtn = page.locator('text=CSV Export');
    await expect(exportBtn).toBeVisible();
  });

  test('invalid hash navigates to home', async ({ customerPage: page }) => {
    await page.goto(page.url().split('#')[0] + '#nonexistent-page');
    await page.waitForTimeout(500);
    const homePage = page.locator('#page-home');
    await expect(homePage).toHaveClass(/active/);
  });

  test('impersonation banner is NOT visible for normal customer', async ({ customerPage: page }) => {
    const banner = page.locator('#impersonation-banner');
    await expect(banner).toHaveCount(0);
  });

  test('mobile bottom nav visible on small viewport', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();
  });

  test('mobile metric cards show 2x2 grid', async ({ customerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const grid = page.locator('.stats-grid');
    const style = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    // Should have 2 columns on mobile
    const columns = style.split(' ').length;
    expect(columns).toBe(2);
  });
});
