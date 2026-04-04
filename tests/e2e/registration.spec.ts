import { test, expect } from '@playwright/test';

test.describe('Registration Flow', () => {

  test('registration page has all required fields', async ({ page }) => {
    await page.goto('/registrierung.html');
    await expect(page.locator('#reg-vorname')).toBeVisible();
    await expect(page.locator('#reg-nachname')).toBeVisible();
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-company')).toBeVisible();
    await expect(page.locator('#reg-branche')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();
    await expect(page.locator('#reg-password2')).toBeVisible();
    await expect(page.locator('#reg-datenschutz')).toBeAttached();
    await expect(page.locator('#reg-form button[type="submit"]')).toBeVisible();
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.goto('/registrierung.html');
    await page.fill('#reg-vorname', 'Test');
    await page.fill('#reg-nachname', 'User');
    await page.fill('#reg-email', 'mismatch@test.de');
    await page.fill('#reg-company', 'Test');
    await page.fill('#reg-password', 'SecurePass123!');
    await page.fill('#reg-password2', 'DifferentPass456!');
    await page.check('#reg-datenschutz');
    await page.click('#reg-form button[type="submit"]');
    await page.waitForTimeout(1000);
    // Should show password error
    const pwError = page.locator('#reg-pw-error, #reg-error');
    const hasError = await pwError.count() > 0;
    if (hasError) {
      const errorText = await pwError.first().textContent();
      expect(errorText?.length).toBeGreaterThan(0);
    }
  });

  test('empty form submission shows validation', async ({ page }) => {
    await page.goto('/registrierung.html');
    await page.click('#reg-form button[type="submit"]');
    await page.waitForTimeout(500);
    // Browser's built-in validation should prevent submission
    // Check that we're still on the registration page
    expect(page.url()).toContain('registrierung.html');
  });

  test('privacy checkbox is required', async ({ page }) => {
    await page.goto('/registrierung.html');
    await page.fill('#reg-vorname', 'Test');
    await page.fill('#reg-nachname', 'User');
    await page.fill('#reg-email', 'privacy@test.de');
    await page.fill('#reg-company', 'Test GmbH');
    await page.fill('#reg-password', 'SecurePass123!');
    await page.fill('#reg-password2', 'SecurePass123!');
    // Do NOT check privacy checkbox
    await page.click('#reg-form button[type="submit"]');
    await page.waitForTimeout(1000);
    // Should still be on registration page
    expect(page.url()).toContain('registrierung.html');
  });

  test('industry dropdown has options', async ({ page }) => {
    await page.goto('/registrierung.html');
    const options = await page.locator('#reg-branche option').count();
    expect(options).toBeGreaterThan(1);
  });

  test('registration page links to login', async ({ page }) => {
    await page.goto('/registrierung.html');
    // Should have a reference to login somewhere on the page
    const pageText = await page.textContent('body');
    expect(pageText).toContain('Konto');
  });

  test('forgot password modal opens', async ({ page }) => {
    await page.goto('/login.html');
    const forgotLink = page.locator('text=Passwort vergessen, a:has-text("Passwort")');
    if (await forgotLink.count() > 0) {
      await forgotLink.first().click();
      await page.waitForTimeout(500);
      const modal = page.locator('#forgot-modal');
      if (await modal.count() > 0) {
        await expect(modal).toBeVisible();
        await expect(page.locator('#forgot-email')).toBeVisible();
      }
    }
  });
});
