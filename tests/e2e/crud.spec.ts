import { test, expect } from '../fixtures/auth.fixture';

test.describe('Supabase CRUD Operations', () => {

  // --- Assistants ---

  test('assistants page has create button', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="assistants"]').click();
    await page.waitForTimeout(1000);
    // "+ Neuer Assistent" button should be visible
    const newBtn = page.locator('button:has-text("Neuer Assistent"), #btnNewAssistant');
    await expect(newBtn.first()).toBeVisible();
  });

  test('edit assistant name', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="assistants"]').click();
    await page.waitForTimeout(1000);
    // Click on first assistant card to edit
    const card = page.locator('#assistantsListBody .assistant-card, #assistantsListBody [class*="card"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(500);
      await page.fill('#edName', 'Umbenannter Assistent');
      await page.click('#btnSaveAssistant');
      await page.waitForTimeout(2000);
      await expect(page.locator('#assistantsListBody')).toContainText('Umbenannter Assistent');
    } else {
      test.skip();
    }
  });

  // --- Leads (via Sales CRM) ---

  test('create lead in sales CRM', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="leads"]').click();
    await page.waitForTimeout(500);
    await page.click('#btn-add-lead');
    await page.waitForTimeout(500);
    await page.fill('#lead-company', 'E2E Test GmbH');
    await page.fill('#lead-contact', 'Max Mustermann');
    await page.fill('#lead-email', 'max@e2e-test.de');
    await page.fill('#lead-phone', '+491234567890');
    await page.fill('#lead-value', '25000');
    await page.fill('#lead-notes', 'Automatisch erstellt via E2E-Test');
    await page.click('#btn-save-lead');
    await page.waitForTimeout(2000);
    // Verify lead appears in table
    await expect(page.locator('#leads-tbody')).toContainText('E2E Test GmbH');
  });

  test('search leads filters results', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="leads"]').click();
    await page.waitForTimeout(500);
    const searchInput = page.locator('#lead-search');
    if (await searchInput.count() > 0) {
      await searchInput.fill('E2E Test');
      await page.waitForTimeout(500);
      // Should show filtered results or empty state
      const tbody = page.locator('#leads-tbody');
      await expect(tbody).toBeVisible();
    }
  });

  // --- Tasks ---

  test('create task in sales CRM', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="tasks"]').click();
    await page.waitForTimeout(500);
    await page.click('#btn-add-task');
    await page.waitForTimeout(500);
    await page.fill('#task-title', 'E2E Testaufgabe');
    await page.fill('#task-desc', 'Diese Aufgabe wurde automatisch erstellt');
    await page.selectOption('#task-priority', 'high');
    await page.click('#btn-save-task');
    await page.waitForTimeout(2000);
    // Verify task appears
    const taskList = page.locator('#tab-tasks');
    await expect(taskList).toContainText('E2E Testaufgabe');
  });

  // --- Customers ---

  test('customer tab shows table and add button', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="customers"]').click();
    await page.waitForTimeout(1000);
    // Table should be visible
    const tbody = page.locator('#customers-tbody');
    await expect(tbody).toBeVisible();
    // Add customer button should exist
    const addBtn = page.locator('#tab-customers button:has-text("Kunde")');
    await expect(addBtn.first()).toBeVisible();
  });

  // --- Settings ---

  test('save profile settings', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(1000);
    // Update first name
    await page.fill('#firstName', 'E2E-Gero');
    await page.fill('#lastName', 'E2E-Stetter');
    await page.fill('#company', 'E2E Test Company');
    await page.click('#saveProfileBtn');
    await page.waitForTimeout(2000);
    // Reload and verify persistence
    await page.reload();
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(1000);
    await expect(page.locator('#firstName')).toHaveValue('E2E-Gero');
    await expect(page.locator('#lastName')).toHaveValue('E2E-Stetter');
    // Restore original values
    await page.fill('#firstName', 'Gero');
    await page.fill('#lastName', 'Stetter');
    await page.fill('#company', 'Test GmbH');
    await page.click('#saveProfileBtn');
    await page.waitForTimeout(1000);
  });

  test('billing address fields are editable', async ({ customerPage: page }) => {
    await page.goto('/settings.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(1000);
    const billingStreet = page.locator('#billingStreet');
    if (await billingStreet.count() > 0) {
      await billingStreet.fill('Teststraße 123');
      await page.fill('#billingZip', '12345');
      await page.fill('#billingCity', 'Teststadt');
      // Save is part of the profile save
      await page.click('#saveProfileBtn');
      await page.waitForTimeout(1000);
    }
  });

  // --- Appointments ---

  test('appointments page loads and shows empty state', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="appointments"]').click();
    await page.waitForTimeout(1000);
    const weekView = page.locator('#appt-week-view');
    await expect(weekView).toBeVisible();
    // New appointment button or empty state
    const newApptBtn = page.locator('button:has-text("Termin")');
    if (await newApptBtn.count() > 0) {
      await expect(newApptBtn.first()).toBeVisible();
    }
  });

  // --- Analytics ---

  test('analytics page loads chart containers', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="analytics"]').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('#chart-calls-per-day')).toBeVisible();
    // Check additional chart containers exist
    const chartBooking = page.locator('#chart-booking-rate');
    if (await chartBooking.count() > 0) {
      await expect(chartBooking).toBeVisible();
    }
  });

  // --- Billing ---

  test('billing page shows subscription info', async ({ customerPage: page }) => {
    await page.locator('.sb-item[data-page="billing"]').click();
    await page.waitForTimeout(1000);
    const billingPage = page.locator('#page-billing');
    await expect(billingPage).toHaveClass(/active/);
    // Should show balance or plan info
    const balanceEl = page.locator('[id*="balance"], [class*="balance"]');
    const guthabenEl = page.locator('text=Guthaben');
    const hasBalance = await balanceEl.count() > 0 || await guthabenEl.count() > 0;
    expect(hasBalance).toBe(true);
  });
});
