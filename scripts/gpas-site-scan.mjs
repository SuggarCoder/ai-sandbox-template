import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'https://gpas.nh.ac.cn';
const OUTPUT_ROOT = process.env.GPAS_OUTPUT_ROOT || 'reports/gpas.nh.ac.cn/full-audit-2026-03-08';
const USER_DATA_DIR = process.env.GPAS_USER_DATA_DIR || path.join(OUTPUT_ROOT, 'profile');
const USERNAME = process.env.GPAS_USERNAME;
const PASSWORD = process.env.GPAS_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('Missing GPAS_USERNAME or GPAS_PASSWORD');
  process.exit(1);
}

const STATIC_ROUTES = [
  '/task-management',
  '/task-management/create',
  '/task-management/query',
  '/task-management/sample',
  '/report-management/query',
  '/system-management',
  '/system-management/notice',
  '/guide',
  '/update-log',
  '/user-information',
  '/register-management',
  '/register-management/query',
];

const axeSource = fs.readFileSync(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(route) {
  return route.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function flattenMenu(nodes, output = []) {
  for (const node of nodes || []) {
    output.push({
      name: node.name || '',
      enName: node.enName || '',
      fullPath: node.fullPath || '',
      redirect: node.redirect || '',
      invisible: Boolean(node.meta?.invisible),
    });
    flattenMenu(node.children, output);
  }
  return output;
}

async function waitForSettled(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function login(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (!page.url().includes('/login')) {
    await waitForSettled(page);
    await page.close();
    return;
  }

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

async function collectRoute(page, route) {
  const fullUrl = `${BASE_URL}/#${route}`;
  const consoleErrors = [];
  const failedRequests = [];
  const documentResponses = [];

  const consoleHandler = (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    }
  };

  const requestFailedHandler = (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
      resourceType: request.resourceType(),
    });
  };

  const responseHandler = async (response) => {
    if (response.request().resourceType() === 'document') {
      documentResponses.push({
        url: response.url(),
        status: response.status(),
        headers: await response.allHeaders(),
      });
    }
  };

  page.on('console', consoleHandler);
  page.on('requestfailed', requestFailedHandler);
  page.on('response', responseHandler);

  const startedAt = Date.now();
  await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForSettled(page);
  const elapsedMs = Date.now() - startedAt;

  const snapshot = await page.evaluate(async () => {
    const visibleText = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
    const genericAltWords = ['image', 'img', 'icon', 'logo', 'picture', 'photo', 'qr', 'qr-code'];
    const anchors = Array.from(document.querySelectorAll('a')).map((el) => ({
      text: visibleText(el),
      href: el.getAttribute('href') || '',
    }));
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).map((el) => ({
      text: visibleText(el),
      ariaLabel: el.getAttribute('aria-label') || '',
    }));
    const inputs = Array.from(document.querySelectorAll('input,textarea,select')).map((el) => {
      const id = el.getAttribute('id');
      const labels = id
        ? Array.from(document.querySelectorAll(`label[for="${id}"]`)).map((label) => visibleText(label)).filter(Boolean)
        : [];
      const wrapperLabel = el.closest('label');
      if (wrapperLabel) labels.push(visibleText(wrapperLabel));
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        name: el.getAttribute('name') || '',
        labels: Array.from(new Set(labels.filter(Boolean))),
      };
    });
    const images = Array.from(document.querySelectorAll('img')).map((img) => ({
      alt: img.getAttribute('alt') || '',
      src: img.getAttribute('src') || '',
    }));
    const englishNodes = Array.from(document.querySelectorAll('body *'))
      .map((el) => visibleText(el))
      .filter((text) => /[A-Za-z]/.test(text) && text.length >= 4 && text.length <= 160)
      .slice(0, 300);

    return {
      href: location.href,
      htmlLang: document.documentElement.lang || '',
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).map((el) => visibleText(el)).filter(Boolean),
      bodySnippet: visibleText(document.body).slice(0, 1600),
      anchors,
      buttons,
      inputs,
      images,
      genericAltImages: images.filter((img) => genericAltWords.includes((img.alt || '').trim().toLowerCase())).length,
      emptyAltImages: images.filter((img) => !img.alt.trim()).length,
      unlabeledInputs: inputs.filter((input) => !input.labels.length && !input.ariaLabel).length,
      englishTextSample: Array.from(new Set(englishNodes)).slice(0, 80),
      navEntry: performance.getEntriesByType('navigation')[0]
        ? {
            type: performance.getEntriesByType('navigation')[0].type,
            domContentLoaded: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
            loadEventEnd: Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd),
            transferSize: performance.getEntriesByType('navigation')[0].transferSize,
          }
        : null,
    };
  });

  await page.addScriptTag({ content: axeSource });
  const axe = await Promise.race([
    page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa'],
        },
      });
      return {
        violations: result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.slice(0, 5).map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
          })),
        })),
      };
    }),
    new Promise((resolve) => setTimeout(() => resolve({ violations: [{ id: 'axe-timeout', impact: 'unknown', help: 'axe scan timed out', helpUrl: '', nodes: [] }] }), 15000)),
  ]);

  page.off('console', consoleHandler);
  page.off('requestfailed', requestFailedHandler);
  page.off('response', responseHandler);

  return {
    route,
    requestedUrl: fullUrl,
    elapsedMs,
    finalUrl: snapshot.href,
    title: snapshot.title,
    htmlLang: snapshot.htmlLang,
    metaDescription: snapshot.metaDescription,
    headings: snapshot.headings,
    bodySnippet: snapshot.bodySnippet,
    anchors: snapshot.anchors.slice(0, 50),
    buttons: snapshot.buttons.slice(0, 50),
    inputs: snapshot.inputs,
    images: {
      total: snapshot.images.length,
      emptyAltImages: snapshot.emptyAltImages,
      genericAltImages: snapshot.genericAltImages,
    },
    unlabeledInputs: snapshot.unlabeledInputs,
    englishTextSample: snapshot.englishTextSample,
    navEntry: snapshot.navEntry,
    consoleErrors,
    failedRequests,
    axe: axe.violations,
    status: documentResponses[documentResponses.length - 1]?.status || null,
    responseHeaders: documentResponses[documentResponses.length - 1]?.headers || {},
  };
}

async function main() {
  ensureDir(OUTPUT_ROOT);
  ensureDir(path.join(OUTPUT_ROOT, 'data'));
  ensureDir(path.join(OUTPUT_ROOT, 'screenshots'));

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    viewport: { width: 1440, height: 900 },
  });

  await login(context);

  const bootstrapPage = await context.newPage();
  await bootstrapPage.goto(`${BASE_URL}/#/task-management/create`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForSettled(bootstrapPage);

  const appState = await bootstrapPage.evaluate(() => ({
    href: location.href,
    title: document.title,
    localStorage: Object.fromEntries(Object.entries(localStorage)),
    sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
  }));

  const localData = JSON.parse(appState.localStorage.localData || '{}');
  const menuData = flattenMenu(localData?.setting?.menuData || []);
  const menuRoutes = menuData
    .flatMap((item) => [item.fullPath, item.redirect])
    .filter((item) => item && !item.includes('/:'));
  const routeList = unique([...STATIC_ROUTES, ...menuRoutes]);

  fs.writeFileSync(path.join(OUTPUT_ROOT, 'data/app-state.json'), JSON.stringify({
    href: appState.href,
    title: appState.title,
    localStorageKeys: Object.keys(appState.localStorage),
    sessionStorageKeys: Object.keys(appState.sessionStorage),
    menuData,
    routeList,
  }, null, 2));

  await bootstrapPage.close();

  const results = [];
  for (const route of routeList) {
    const page = await context.newPage();
    console.log(`Scanning ${route}`);
    try {
      const result = await collectRoute(page, route);
      const screenshotPath = path.join(OUTPUT_ROOT, 'screenshots', `${slugify(route)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      result.screenshot = screenshotPath;
      results.push(result);
      console.log(`Completed ${route} -> ${result.finalUrl}`);
    } catch (error) {
      results.push({
        route,
        requestedUrl: `${BASE_URL}/#${route}`,
        error: error.message,
      });
      console.log(`Failed ${route}: ${error.message}`);
    }
    await page.close();
  }

  const englishCorpus = Array.from(new Set(results.flatMap((item) => item.englishTextSample))).sort();
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'data/page-scan.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routeCount: results.length,
    results,
  }, null, 2));
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'data/english-corpus.txt'), `${englishCorpus.join('\n')}\n`);

  console.log(JSON.stringify({
    ok: true,
    routeCount: results.length,
    routes: results.map((item) => ({
      route: item.route,
      finalUrl: item.finalUrl,
      status: item.status,
      axeViolations: item.axe.length,
      consoleErrors: item.consoleErrors.length,
      failedRequests: item.failedRequests.length,
      elapsedMs: item.elapsedMs,
    })),
  }, null, 2));

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
