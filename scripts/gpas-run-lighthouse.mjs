import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';

const BASE_URL = 'https://gpas.nh.ac.cn';
const OUTPUT_ROOT = process.env.GPAS_OUTPUT_ROOT || 'reports/gpas.nh.ac.cn/full-audit-2026-03-08';
const USER_DATA_DIR = process.env.GPAS_USER_DATA_DIR || path.join(OUTPUT_ROOT, 'profile');
const USERNAME = process.env.GPAS_USERNAME;
const PASSWORD = process.env.GPAS_PASSWORD;
const DEBUG_PORT = 9222;

const routes = [
  '/task-management/create',
  '/task-management/query',
  '/report-management/query',
  '/system-management/notice',
  '/guide',
  '/update-log',
  '/user-information',
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(route) {
  return route.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
}

async function waitForSettled(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function ensureLoggedIn(context) {
  if (!USERNAME || !PASSWORD) {
    return;
  }

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/#/task-management/create`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForSettled(page);
  if (!page.url().includes('/login')) {
    await page.close();
    return;
  }

  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByText('Password Login', { exact: true }).click();
  await page.getByPlaceholder('Enter UID or Mobile Number').fill(USERNAME);
  await page.getByPlaceholder('Enter Password').fill(PASSWORD);
  const checkbox = page.locator('input.ant-checkbox-input').last();
  if (!(await checkbox.isChecked())) {
    await checkbox.check();
  }
  await Promise.all([
    page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 120000 }),
    page.getByRole('button', { name: 'Login' }).click(),
  ]);
  await waitForSettled(page);
  await page.close();
}

async function main() {
  const outputDir = path.join(OUTPUT_ROOT, 'lighthouse');
  ensureDir(outputDir);

  const summaries = [];
  for (const route of routes) {
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      args: [`--remote-debugging-port=${DEBUG_PORT}`],
    });

    try {
      await ensureLoggedIn(context);
      const url = `${BASE_URL}/#${route}`;
      const base = path.join(outputDir, slugify(route));
      console.log(`Lighthouse ${route}`);
      try {
        const runnerResult = await lighthouse(url, {
          port: DEBUG_PORT,
          output: ['html', 'json'],
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          preset: 'desktop',
          disableStorageReset: true,
        });
        fs.writeFileSync(`${base}.report.html`, runnerResult.report[0]);
        fs.writeFileSync(`${base}.report.json`, runnerResult.report[1]);
        const report = runnerResult.lhr;
        summaries.push({
          route,
          url,
          performance: report.categories.performance.score * 100,
          accessibility: report.categories.accessibility.score * 100,
          bestPractices: report.categories['best-practices'].score * 100,
          seo: report.categories.seo.score * 100,
          firstContentfulPaint: report.audits['first-contentful-paint'].displayValue,
          largestContentfulPaint: report.audits['largest-contentful-paint'].displayValue,
          speedIndex: report.audits['speed-index'].displayValue,
          totalBlockingTime: report.audits['total-blocking-time'].displayValue,
          cumulativeLayoutShift: report.audits['cumulative-layout-shift'].displayValue,
        });
      } catch (error) {
        summaries.push({
          route,
          url,
          error: error.message,
        });
      }
    } finally {
      await context.close();
    }
  }

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    chromePath: chromium.executablePath(),
    routes: summaries,
  }, null, 2));

  console.log(JSON.stringify({ ok: true, routes: summaries }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
