import type { Locator, Page } from "playwright";
import { NormalizedJob } from "./types";

const FALLBACK_URL = "https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2";

export async function collectWithPlaywrightFallback(): Promise<NormalizedJob[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  });

  try {
    await page.goto(FALLBACK_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await randomDelay();

    await chooseLocation(page);
    await chooseJobCategory(page);
    await chooseCareer(page);
    await submitSearch(page);
    await randomDelay();

    return await parseCards(page);
  } finally {
    await browser.close();
  }
}

async function chooseLocation(page: Page): Promise<void> {
  await clickFirstVisible([
    page.getByText("지역 선택", { exact: false }),
    page.getByRole("button", { name: /지역/ }),
    page.locator("button, a").filter({ hasText: "지역" })
  ]);

  await randomDelay();
  await clickFirstVisible([
    page.getByLabel(/서울\s*전체/),
    page.getByText("서울전체", { exact: false }),
    page.getByText("서울 전체", { exact: false })
  ]);
}

async function chooseJobCategory(page: Page): Promise<void> {
  await clickFirstVisible([
    page.getByText("직업 선택", { exact: false }),
    page.getByRole("button", { name: /직업/ }),
    page.locator("button, a").filter({ hasText: "직업" })
  ]);

  await randomDelay();
  await clickFirstVisible([
    page.getByText("IT개발·데이터", { exact: false }),
    page.getByText("IT개발", { exact: false })
  ]);

  await randomDelay();
  await clickFirstVisible([
    page.getByLabel(/IT개발·데이터\s*전체선택/),
    page.getByText("IT개발·데이터 전체선택", { exact: false }),
    page.locator('label[for="all_check_onedepth_2"]')
  ]);
}

async function chooseCareer(page: Page): Promise<void> {
  await clickFirstVisible([
    page.getByText("경력", { exact: false }),
    page.getByRole("button", { name: /경력/ }),
    page.locator("button, a").filter({ hasText: "경력" })
  ]);

  await randomDelay();
  await clickFirstVisible([
    page.getByLabel(/1년\s*이하/),
    page.getByLabel(/~\s*1년/),
    page.getByText("1년 이하", { exact: false }),
    page.getByText("~1년", { exact: false }),
    page.getByText("1년차", { exact: false }),
    page.getByText("신입", { exact: false })
  ]);
}

async function submitSearch(page: Page): Promise<void> {
  await clickFirstVisible([
    page.locator("button#search_btn"),
    page.getByRole("button", { name: /검색하기|검색/ }),
    page.getByText("검색하기", { exact: false })
  ]);
}

async function parseCards(page: Page): Promise<NormalizedJob[]> {
  const cards = await firstNonEmptyLocator(page, [
    'div.list_item[id^="rec-"]',
    ".list_item",
    ".item_recruit"
  ]);

  const count = Math.min(await cards.count(), 110);
  const scrapedAt = new Date().toISOString();
  const jobs: NormalizedJob[] = [];

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const id = await getCardId(card);
    const titleLink = card.locator("a[href*='/zf_user/jobs/relay/'], a[href*='/zf_user/jobs/view']").first();
    const title = await safeText(titleLink);
    const href = await titleLink.getAttribute("href").catch(() => null);

    jobs.push({
      id: id || buildFallbackId(href, index),
      title,
      company_name: await safeText(card.locator(".company_nm, .corp_name, .area_corp strong, .str_tit").first()),
      company_url: await safeHref(card.locator("a[href*='/zf_user/company-info/']").first()),
      job_url: normalizeSaraminUrl(href),
      location_name: await safeText(card.locator(".job_condition span, .recruit_condition span").first()),
      location_code: "",
      job_mid_code: "2",
      job_mid_name: "IT개발·데이터",
      job_code: "",
      job_code_name: "",
      experience_code: null,
      experience_min: null,
      experience_max: null,
      experience_name: await safeText(card.locator("text=/경력|신입|무관|1년/").first()),
      education: await safeText(card.locator("text=/학력|대졸|초대졸|고졸|무관/").first()),
      job_type: "",
      industry: "",
      keyword: "",
      salary: "",
      posting_date: "",
      expiration_date: await safeText(card.locator(".date, .support_detail, .deadlines").first()),
      close_type: "",
      read_count: null,
      apply_count: null,
      scraped_at: scrapedAt
    });

    await randomDelay();
  }

  return jobs;
}

async function clickFirstVisible(locators: Locator[]): Promise<void> {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible().catch(() => false)) {
      await target.click({ timeout: 5_000 });
      return;
    }
  }
}

async function firstNonEmptyLocator(page: Page, selectors: string): Promise<Locator>;
async function firstNonEmptyLocator(page: Page, selectors: string[]): Promise<Locator>;
async function firstNonEmptyLocator(page: Page, selectors: string | string[]): Promise<Locator> {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of list) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) {
      return locator;
    }
  }

  return page.locator("__no_saramin_result__");
}

async function safeText(locator: Locator): Promise<string> {
  const text = await locator.textContent({ timeout: 2_000 }).catch(() => null);
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

async function safeHref(locator: Locator): Promise<string> {
  const href = await locator.getAttribute("href").catch(() => null);
  return normalizeSaraminUrl(href);
}

async function getCardId(locator: Locator): Promise<string> {
  const id = await locator.getAttribute("id").catch(() => null);
  return id?.replace(/^rec-/, "") ?? "";
}

function normalizeSaraminUrl(value: string | null): string {
  if (!value) {
    return "";
  }

  if (value.startsWith("http")) {
    return value;
  }

  return `https://www.saramin.co.kr${value}`;
}

function buildFallbackId(href: string | null, index: number): string {
  if (!href) {
    return `fallback-${index}`;
  }

  const match = href.match(/rec_idx=(\d+)|view\/(\d+)/);
  return match?.[1] ?? match?.[2] ?? `fallback-${index}`;
}

function randomDelay(): Promise<void> {
  const ms = 1_000 + Math.floor(Math.random() * 1_000);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
