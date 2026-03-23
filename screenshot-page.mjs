import puppeteer from 'puppeteer';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const screenshotDir = join(__dirname, 'temporary screenshots');
if (!existsSync(screenshotDir)) mkdirSync(screenshotDir);

const url    = process.argv[2] || 'http://localhost:3000/dashboard.html';
const pageId = process.argv[3] || '';
const label  = process.argv[4] || pageId;

const existing = readdirSync(screenshotDir).filter(f => f.startsWith('screenshot-'));
let maxNum = 0;
for (const f of existing) {
  const match = f.match(/^screenshot-(\d+)/);
  if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
}
const filename = label ? `screenshot-${maxNum+1}-${label}.png` : `screenshot-${maxNum+1}.png`;
const filepath = join(screenshotDir, filename);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
if (pageId) {
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-page="${id}"]`);
    if (el) el.click();
  }, pageId);
  await new Promise(r => setTimeout(r, 400));
}
await page.screenshot({ path: filepath, fullPage: true });
await browser.close();
console.log(`Screenshot saved: ${filepath}`);
