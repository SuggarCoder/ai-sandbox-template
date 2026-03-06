/* eslint-disable @typescript-eslint/no-explicit-any */

const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
];

const blockedPatterns = [
  /captcha/i,
  /automated access/i,
  /access denied/i,
  /temporarily blocked/i,
  /unusual traffic/i,
  /forbidden/i,
  /bot/i
];

export function pickUserAgent() {
  const idx = Math.floor(Math.random() * userAgents.length);
  return userAgents[idx] ?? userAgents[0];
}

export function isBlockedContent(content: string) {
  return blockedPatterns.some((pattern) => pattern.test(content));
}

export async function randomPause(page: any, minMs = 300, maxMs = 1200) {
  const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
  await page.waitForTimeout(delay);
}

export async function setupPageForScraping(page: any) {
  await page.setExtraHTTPHeaders({
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "upgrade-insecure-requests": "1"
  });

  await page.route("**/*", (route: any) => {
    const type = route.request().resourceType();
    if (type === "font" || type === "media") {
      route.abort();
      return;
    }

    route.continue();
  });
}

export async function gotoWithBackoff(page: any, url: string, label: string) {
  let lastError: unknown;
  const attempts: Array<"domcontentloaded" | "load" | "commit" | "domcontentloaded" | "load"> = [
    "domcontentloaded",
    "load",
    "commit",
    "domcontentloaded",
    "load"
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    try {
      await page.goto(url, {
        waitUntil: attempts[i],
        timeout: 50000
      });

      const content = await page.content();
      if (isBlockedContent(content)) {
        throw new Error(`${label} blocked by anti-bot response`);
      }

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ERR_ABORTED")) {
        // Navigation may be interrupted by client-side redirects. If page has loaded, continue.
        const currentUrl = page.url?.() ?? "";
        if (currentUrl && currentUrl !== "about:blank") {
          try {
            await page.waitForLoadState("domcontentloaded", { timeout: 6000 });
            return;
          } catch {
            // Continue retries when load state is still unstable.
          }
        }
      }

      lastError = error;
      const backoff = 700 * (i + 1) + Math.floor(Math.random() * 600);
      await page.waitForTimeout(backoff);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to navigate: ${url}`);
}
