import { chromium, Browser, BrowserContext, Page } from "playwright";
import { AppConfig } from "./types.js";

interface BrowserBundle {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export const launchBrowser = async (config: AppConfig): Promise<BrowserBundle> => {
  const browser = await chromium.launch({
    headless: config.headless
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "ko-KR"
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(30_000);

  return { browser, context, page };
};
