import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Page } from "playwright";
import { AppConfig, JobPosting } from "./types.js";

export const logStep = (step: number, message: string): void => {
  console.log(`[${step}] ${message}`);
};

export const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

export const toAbsoluteUrl = (value: string | null | undefined, base = "https://www.saramin.co.kr"): string => {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  try {
    return new URL(text, base).toString();
  } catch {
    return text;
  }
};

export const delay = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const randomDelay = async (config: AppConfig): Promise<void> => {
  const min = Math.min(config.crawlDelayMinMs, config.crawlDelayMaxMs);
  const max = Math.max(config.crawlDelayMinMs, config.crawlDelayMaxMs);
  const waitMs = min + Math.floor(Math.random() * (max - min + 1));
  console.log(`요청 간 대기: ${waitMs}ms`);
  await delay(waitMs);
};

export const ensureDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true });
};

export const maybeScreenshot = async (page: Page, config: AppConfig, fileName: string): Promise<void> => {
  if (!config.debugScreenshot) {
    return;
  }

  await ensureDirectory(config.screenshotsDir);
  await page.screenshot({
    path: path.join(config.screenshotsDir, fileName),
    fullPage: true
  });
};

export const writeDebugArtifacts = async (page: Page, config: AppConfig, reason: string): Promise<void> => {
  await ensureDirectory(config.screenshotsDir);

  if (config.debugScreenshot) {
    await page.screenshot({
      path: path.join(config.screenshotsDir, "error.png"),
      fullPage: true
    }).catch(() => undefined);
  }

  const html = await page.content().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return `HTML 저장 실패: ${message}`;
  });

  await writeFile(path.join(config.screenshotsDir, "debug.html"), html, "utf8");
  console.error(`디버그 파일 저장 완료: ${reason}`);
  console.error(`현재 URL: ${page.url()}`);
  console.error(`페이지 제목: ${await page.title().catch(() => "제목 확인 실패")}`);
};

export const dedupeJobs = (jobs: JobPosting[]): JobPosting[] => {
  const seen = new Set<string>();
  const unique: JobPosting[] = [];

  for (const job of jobs) {
    const key = job.recruit_id || job.job_url;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(job);
  }

  return unique;
};

export const looksBlocked = async (page: Page): Promise<boolean> => {
  const bodyText = normalizeText(await page.locator("body").innerText({ timeout: 3000 }).catch(() => ""));
  const url = page.url().toLowerCase();
  const title = (await page.title().catch(() => "")).toLowerCase();
  const text = bodyText.toLowerCase();

  const pageSignals = [
    /access\s+denied/,
    /too\s+many\s+requests/,
    /request\s+blocked/,
    /unusual\s+traffic/,
    /captcha\s+(verification|required|challenge)/,
    /보안문자\s*(입력|확인|인증)/,
    /자동입력\s*(방지|확인|문자)/,
    /비정상적인\s*접근/,
    /접근이\s*차단/,
    /서비스\s*이용이\s*제한/
  ];

  const chromeSignals = [
    /(^|[^\d])403([^\d]|$)/,
    /(^|[^\d])429([^\d]|$)/,
    /access\s+denied/,
    /too\s+many\s+requests/
  ];

  return (
    pageSignals.some((pattern) => pattern.test(text)) ||
    chromeSignals.some((pattern) => pattern.test(url) || pattern.test(title))
  );
};

export const printHtmlSnippet = async (page: Page): Promise<void> => {
  const html = await page.locator("body").innerHTML({ timeout: 3000 }).catch(() => "");
  console.error(`주요 HTML 일부:\n${html.slice(0, 2000)}`);
};
