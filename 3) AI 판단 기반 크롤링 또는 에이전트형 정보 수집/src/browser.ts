import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { AppConfig } from "./config.js";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export const createBrowserSession = async (config: AppConfig): Promise<BrowserSession> => {
  const browser = await chromium.launch({
    headless: config.headless,
  });

  const context = await browser.newContext({
    locale: "ko-KR",
    viewport: { width: 1440, height: 1200 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(30_000);

  return { browser, context, page };
};
