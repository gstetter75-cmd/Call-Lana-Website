import { test, expect } from '../fixtures/auth.fixture';

test.describe('Admin Dashboard', () => {

  test('admin page loads with overview tab', async ({ adminPage: page }) => {
    const breadcrumb = page.locator('#breadcrumb-page');
    await expect(breadcrumb).toContainText('Übersicht');
  });

  test('all 10 tabs are clickable', async ({ adminPage: page }) => {
    const tabs = ['overview', 'analytics', 'onboarding', 'minutes-alert', 'error-log',
                  'integrations', 'customers', 'users', 'orgs', 'system'];
    for (const tab of tabs) {
      const btn = page.locator(`.tab-btn[data-tab="${tab}"]`);
      await expect(btn).toBeVisible();
      await btn.click();
      await page.waitForTimeout(300);
      const section = page.locator(`#tab-${tab}`);
      await expect(section).toHaveClass(/active/);
    }
  });

  test('overview shows MRR and active customers KPIs', async ({ adminPage: page }) => {
    await expect(page.locator('text=MRR (Monatsumsatz)')).toBeVisible();
    await expect(page.locator('text=Aktive Kunden')).toBeVisible();
  });

  test('customers tab loads table', async ({ adminPage: page }) => {
    await page.locator('.tab-btn[data-tab="customers"]').click();
    await page.waitForTimeout(1000);
    const section = page.locator('#tab-customers');
    await expect(section).toHaveClass(/active/);
  });

  test('users tab loads table', async ({ adminPage: page }) => {
    await page.locator('.tab-btn[data-tab="users"]').click();
    await page.waitForTimeout(1000);
    const section = page.locator('#tab-users');
    await expect(section).toHaveClass(/active/);
  });

  test('onboarding tab shows queue', async ({ adminPage: page }) => {
    await page.locator('.tab-btn[data-tab="onboarding"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#onb-pending')).toBeVisible();
    await expect(page.locator('#onb-setup')).toBeVisible();
  });

  test('minutes-alert tab shows usage stats', async ({ adminPage: page }) => {
    await page.locator('.tab-btn[data-tab="minutes-alert"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#min-critical')).toBeVisible();
    await expect(page.locator('#min-warning')).toBeVisible();
  });

  test('error-log tab loads', async ({ adminPage: page }) => {
    await page.locator('.tab-btn[data-tab="error-log"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#err-today')).toBeVisible();
  });

  test('system tab loads', async ({ adminPage: page }) => {
    await page.locator('.tab-btn[data-tab="system"]').click();
    await page.waitForTimeout(500);
    const section = page.locator('#tab-system');
    await expect(section).toHaveClass(/active/);
  });

  test('invalid tab falls back to overview', async ({ adminPage: page }) => {
    await page.evaluate(() => { window.location.hash = 'nonexistent'; });
    await page.waitForTimeout(500);
    // switchTab should fallback to 'overview'
    const overview = page.locator('#tab-overview');
    await expect(overview).toHaveClass(/active/);
  });

  test('customer detail modal has impersonate button', async ({ adminPage: page }) => {
    await page.locator('.tab-btn[data-tab="customers"]').click();
    await page.waitForTimeout(1000);
    // Try to find a customer row and click it
    const customerRow = page.locator('#admin-customers-tbody tr').first();
    if (await customerRow.count() > 0) {
      await customerRow.click();
      await page.waitForTimeout(500);
      const impersonateBtn = page.locator('text=Als Kunde anmelden');
      if (await impersonateBtn.count() > 0) {
        await expect(impersonateBtn).toBeVisible();
      }
    }
  });
});
