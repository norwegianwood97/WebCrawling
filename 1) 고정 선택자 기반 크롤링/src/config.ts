import dotenv from "dotenv";
import { AppConfig } from "./types.js";

dotenv.config();

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const loadConfig = (): AppConfig => ({
  headless: parseBoolean(process.env.HEADLESS, false),
  maxItems: parsePositiveInt(process.env.MAX_ITEMS, 50),
  maxPages: parsePositiveInt(process.env.MAX_PAGES, 3),
  maxDetailPages: parsePositiveInt(process.env.MAX_DETAIL_PAGES, 50),
  outputDir: process.env.OUTPUT_DIR?.trim() || "output",
  debugScreenshot: parseBoolean(process.env.DEBUG_SCREENSHOT, true),
  crawlDelayMinMs: parsePositiveInt(process.env.CRAWL_DELAY_MIN_MS, 1000),
  crawlDelayMaxMs: parsePositiveInt(process.env.CRAWL_DELAY_MAX_MS, 2500),
  crawlDetailDelayMinMs: parsePositiveInt(process.env.CRAWL_DETAIL_DELAY_MIN_MS, 1500),
  crawlDetailDelayMaxMs: parsePositiveInt(process.env.CRAWL_DETAIL_DELAY_MAX_MS, 3000),
  saveXlsx: parseBoolean(process.env.SAVE_XLSX, true),
  saveXlsxTimestamp: parseBoolean(process.env.SAVE_XLSX_TIMESTAMP, false),
  baseUrl: "https://www.saramin.co.kr/zf_user/",
  jobCategoryUrl: "https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2",
  screenshotsDir: "screenshots"
});
