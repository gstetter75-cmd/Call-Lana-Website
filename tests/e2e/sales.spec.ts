import { test, expect } from '../fixtures/auth.fixture';

test.describe('Sales CRM', () => {

  test('sales page loads with pipeline tab', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    const breadcrumb = page.locator('#breadcrumb-page');
    await expect(breadcrumb).toContainText('Pipeline');
  });

  test('all 6 tabs are clickable', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    const tabs = ['pipeline', 'leads', 'tasks', 'customers', 'availability', 'commission'];
    for (const tab of tabs) {
      const btn = page.locator(`.tab-btn[data-tab="${tab}"]`);
      await expect(btn).toBeVisible();
      await btn.click();
      await page.waitForTimeout(300);
      const section = page.locator(`#tab-${tab}`);
      await expect(section).toHaveClass(/active/);
    }
  });

  test('pipeline shows kanban board', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    const board = page.locator('#pipeline-board, .kanban-board');
    await expect(board).toBeVisible();
  });

  test('pipeline shows stage value bars', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    const stageValues = page.locator('#stage-value-bars');
    await expect(stageValues).toBeVisible();
  });

  test('leads tab has new lead button', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="leads"]').click();
    await page.waitForTimeout(500);
    const addBtn = page.locator('#tab-leads button:has-text("Neuer Lead")');
    await expect(addBtn).toBeVisible();
  });

  test('tasks tab has new task button', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="tasks"]').click();
    await page.waitForTimeout(500);
    const addBtn = page.locator('button:has-text("Neue Aufgabe")');
    await expect(addBtn).toBeVisible();
  });

  test('customers tab loads', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="customers"]').click();
    await page.waitForTimeout(500);
    const section = page.locator('#tab-customers');
    await expect(section).toHaveClass(/active/);
  });

  test('availability tab shows grid', async ({ adminPage: page }) => {
    await page.goto('/sales.html');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.locator('.tab-btn[data-tab="availability"]').click();
    await page.waitForTimeout(500);
    const section = page.locator('#tab-availability');
    await expect(section).toHaveClass(/active/);
  });

  test('invalid tab falls back to pipeline', async ({ adminPage: page }) => {
    await page.goto('/sales.html#nonexistent');
    await page.waitForFunction(() => !document.body.classList.contains('auth-pending'), { timeout: 10_000 });
    await page.waitForTimeout(500);
    const pipeline = page.locator('#tab-pipeline');
    await expect(pipeline).toHaveClass(/active/);
  });
});
