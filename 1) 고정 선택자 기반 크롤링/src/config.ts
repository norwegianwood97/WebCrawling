import dotenv from "dotenv";
import { AppConfig } from "./types.js";

dotenv.config();

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ["true", "1", "yes", "y"].includes(normalized);
};

const parseNonNegativeInt = (value: string | undefined, fallback: number): number => {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const loadConfig = (): AppConfig => ({
  headless: parseBoolean(process.env.HEADLESS, false),
  maxItems: parseNonNegativeInt(process.env.MAX_ITEMS, 0),
  maxPages: parseNonNegativeInt(process.env.MAX_PAGES, 0),
  outputDir: process.env.OUTPUT_DIR?.trim() || "output",
  debugScreenshot: parseBoolean(process.env.DEBUG_SCREENSHOT, true),
  crawlDelayMinMs: parseNonNegativeInt(process.env.CRAWL_DELAY_MIN_MS, 1000),
  crawlDelayMaxMs: parseNonNegativeInt(process.env.CRAWL_DELAY_MAX_MS, 2500),
  saveXlsx: parseBoolean(process.env.SAVE_XLSX, true),
  baseUrl: "https://www.saramin.co.kr/zf_user/",
  jobCategoryUrl: "https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2",
  screenshotsDir: "screenshots"
});
