import { AppConfig } from "../config.js";
import { createBrowserSession } from "../browser.js";
import { runAgentLoop } from "../agent/agentLoop.js";
import { maybeScreenshot, writeDebugArtifacts } from "../utils/debug.js";
import { randomDelay } from "../utils/delay.js";
import { logDetail, logResult, logStep } from "../utils/logger.js";
import { extractDetailFromPage } from "./detailExtractor.js";
import { extractResultsFromPage } from "./resultExtractor.js";
import { isAllowedCareer } from "./careerFilter.js";
import { dedupeJobs } from "./dedupe.js";
import { JobPosting } from "./types.js";

const nextPageSelectors = [
  'a[aria-label*="다음"]',
  'a[title*="다음"]',
  "a.next",
  ".pagination a.next",
  ".page a.next",
  'a:has-text("다음")',
  'button:has-text("다음")',
];

const clickNextPage = async (page: import("playwright").Page): Promise<boolean> => {
  const beforeUrl = page.url();

  for (const selector of nextPageSelectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0 || !(await locator.isVisible().catch(() => false))) {
      continue;
    }

    const ariaDisabled = await locator.getAttribute("aria-disabled").catch(() => "");
    const className = await locator.getAttribute("class").catch(() => "");
    const disabled = ariaDisabled === "true" || /disabled|inactive/.test(className || "");

    if (disabled) {
      continue;
    }

    await locator.click({ timeout: 5000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    return page.url() !== beforeUrl || true;
  }

  return false;
};

const collectListPages = async (
  page: import("playwright").Page,
  config: AppConfig,
): Promise<JobPosting[]> => {
  const jobs: JobPosting[] = [];

  for (let pageIndex = 1; pageIndex <= config.maxPages && jobs.length < config.maxItems; pageIndex += 1) {
    const pageJobs = await extractResultsFromPage(page, config.maxItems - jobs.length);
    logResult(`${pageIndex}페이지 공고 ${pageJobs.length}개 발견`);
    jobs.push(...pageJobs);

    if (pageIndex >= config.maxPages || jobs.length >= config.maxItems) {
      break;
    }

    const moved = await clickNextPage(page);
    if (!moved) {
      break;
    }

    await randomDelay(config);
  }

  return dedupeJobs(jobs).slice(0, config.maxItems);
};

const enrichDetails = async (
  jobs: JobPosting[],
  config: AppConfig,
  context: import("playwright").BrowserContext,
): Promise<JobPosting[]> => {
  const limitedJobs = jobs.slice(0, config.maxDetailPages);
  const page = await context.newPage();

  for (let index = 0; index < limitedJobs.length; index += 1) {
    const job = limitedJobs[index];
    logDetail(`${index + 1}/${limitedJobs.length} 상세 수집`);
    const details = await extractDetailFromPage(page, config, job.job_url, index + 1);
    Object.assign(job, details);
    await randomDelay(config);
  }

  await page.close().catch(() => undefined);
  return jobs;
};

export const crawlSaraminWithAgent = async (config: AppConfig): Promise<JobPosting[]> => {
  const session = await createBrowserSession(config);

  try {
    logStep(1, "브라우저 실행");
    logStep(2, "사람인 접속");
    await session.page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });
    await session.page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await maybeScreenshot(session.page, config, "01_home.png");

    const agentResult = await runAgentLoop(session.page, config);
    if (!agentResult.success) {
      await writeDebugArtifacts(session.page, config, agentResult.reason, "debug");
      throw new Error(agentResult.reason);
    }

    await maybeScreenshot(session.page, config, "results.png");
    const extracted = await collectListPages(session.page, config);

    if (extracted.length === 0) {
      await writeDebugArtifacts(session.page, config, "결과 목록에서 공고를 추출하지 못했습니다.", "debug");
      return [];
    }

    const filtered = extracted.filter((job) => isAllowedCareer(job.career));
    logResult(`경력 필터 통과 ${filtered.length}개`);

    const enriched = await enrichDetails(
      filtered.slice(0, config.maxItems),
      config,
      session.context,
    );

    return enriched;
  } finally {
    await session.browser.close().catch(() => undefined);
  }
};
