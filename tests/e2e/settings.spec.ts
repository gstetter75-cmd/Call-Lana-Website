import { test, expect } from '../fixtures/auth.fixture';

test.describe('Settings', () => {

  test('settings page loads with profile tab', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    // Profile tab should be active by default
    const profileTab = page.locator('.sn-item[data-tab="profile"]');
    await expect(profileTab).toHaveClass(/active/);
  });

  test('profile tab has save button', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    const saveBtn = page.locator('#saveProfileBtn, button:has-text("Profil speichern")');
    await expect(saveBtn.first()).toBeVisible();
  });

  test('security tab has password fields', async ({ customerPage: page }) => {
    await page.goto('/settings.html#security');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    const pwField = page.locator('#newPw, input[type="password"]');
    await expect(pwField.first()).toBeVisible();
  });

  test('notifications tab has toggle switches', async ({ customerPage: page }) => {
    await page.goto('/settings.html#notifications');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    const toggles = page.locator('.toggle-switch');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('emergency tab has phone field', async ({ customerPage: page }) => {
    await page.goto('/settings.html#emergency');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    const phoneField = page.locator('#emergencyPhone');
    await expect(phoneField).toBeVisible();
  });

  test('calendar tab has connect button', async ({ customerPage: page }) => {
    await page.goto('/settings.html#calendar');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    const connectBtn = page.locator('#btnConnectCalendar');
    await expect(connectBtn).toBeVisible();
  });

  test('forwarding tab has add rule button', async ({ customerPage: page }) => {
    await page.goto('/settings.html#forwarding');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    const addBtn = page.locator('text=Neue Regel');
    await expect(addBtn).toBeVisible();
  });

  test('addons tab has toggle switches', async ({ customerPage: page }) => {
    await page.goto('/settings.html#addons');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    const toggles = page.locator('.toggle-switch');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('all setting nav items are clickable', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    const navItems = page.locator('.sn-item[data-tab]');
    const count = await navItems.count();
    expect(count).toBeGreaterThan(5);
    // Click each and verify tab content shows
    for (let i = 0; i < count; i++) {
      const item = navItems.nth(i);
      const tab = await item.getAttribute('data-tab');
      await item.click();
      await page.waitForTimeout(300);
      if (tab) {
        const content = page.locator(`#tab-${tab}`);
        if (await content.count() > 0) {
          await expect(content).toBeVisible();
        }
      }
    }
  });
});
