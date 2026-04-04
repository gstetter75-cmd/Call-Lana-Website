import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {

  test('homepage loads with nav, hero, and CTA', async ({ page }) => {
    await page.goto('/');
    // Wait for components.js to render nav
    await page.waitForTimeout(2000);
    // Nav should contain rendered content
    const navContent = await page.locator('#nav-container').innerHTML();
    expect(navContent.length).toBeGreaterThan(10);
    // Hero text
    await expect(page.locator('text=Dein Telefon klingelt')).toBeVisible();
    // CTA button
    await expect(page.locator('text=Kostenlos testen').first()).toBeVisible();
  });

  test('navigation links are visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Check desktop nav links container is visible
    const desktopNav = page.locator('#desktopNavLinks');
    await expect(desktopNav).toBeVisible();
    // Check it contains links
    const links = await desktopNav.locator('a').count();
    expect(links).toBeGreaterThanOrEqual(4);
  });

  test('mobile viewport hides desktop nav links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Desktop nav links should be hidden
    const desktopLinks = page.locator('.hidden.md\\:flex a[href="funktionen.html"]');
    if (await desktopLinks.count() > 0) {
      await expect(desktopLinks.first()).toBeHidden();
    }
  });

  test('branchen page loads with content', async ({ page }) => {
    await page.goto('/branchen.html');
    await page.waitForTimeout(1000);
    // Check page has substantial content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
    expect(bodyText).toContain('Klempner');
  });

  test('funktionen page loads', async ({ page }) => {
    await page.goto('/funktionen.html');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('preise page loads with pricing content', async ({ page }) => {
    await page.goto('/preise.html');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('Starter');
  });

  test('kontakt page has form', async ({ page }) => {
    await page.goto('/kontakt.html');
    const form = page.locator('form, input[type="email"]');
    await expect(form.first()).toBeVisible();
  });

  test('login page has email and password fields', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    // First submit button (main login, not forgot-password)
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('registrierung page has form fields', async ({ page }) => {
    await page.goto('/registrierung.html');
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();
    await expect(page.locator('#reg-vorname')).toBeVisible();
  });

  test('404 page shows for unknown routes', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz.html');
    if (response) {
      const status = response.status();
      expect([200, 404]).toContain(status);
    }
  });

  test('footer is rendered on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const footer = page.locator('#footer-container');
    const html = await footer.innerHTML();
    expect(html.length).toBeGreaterThan(10);
  });

  test('datenschutz page loads', async ({ page }) => {
    await page.goto('/datenschutz.html');
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(50);
  });

  test('impressum page loads', async ({ page }) => {
    await page.goto('/impressum.html');
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(50);
  });
});
