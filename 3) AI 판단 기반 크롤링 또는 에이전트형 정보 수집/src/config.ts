import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  headless: boolean;
  outputDir: string;
  maxItems: number;
  maxPages: number;
  maxDetailPages: number;
  maxAgentSteps: number;
  debugScreenshot: boolean;
  saveXlsx: boolean;
  saveXlsxTimestamp: boolean;
  crawlDelayMinMs: number;
  crawlDelayMaxMs: number;
  llmProvider: "openai";
  openaiApiKey: string;
  openaiModel: string;
  llmTemperature: number;
  baseUrl: string;
  jobCategoryUrl: string;
  screenshotsDir: string;
}

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

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const loadConfig = (): AppConfig => ({
  headless: parseBoolean(process.env.HEADLESS, false),
  outputDir: process.env.OUTPUT_DIR?.trim() || "output",
  maxItems: parsePositiveInt(process.env.MAX_ITEMS, 30),
  maxPages: parsePositiveInt(process.env.MAX_PAGES, 2),
  maxDetailPages: parsePositiveInt(process.env.MAX_DETAIL_PAGES, 20),
  maxAgentSteps: parsePositiveInt(process.env.MAX_AGENT_STEPS, 25),
  debugScreenshot: parseBoolean(process.env.DEBUG_SCREENSHOT, true),
  saveXlsx: parseBoolean(process.env.SAVE_XLSX, true),
  saveXlsxTimestamp: parseBoolean(process.env.SAVE_XLSX_TIMESTAMP, false),
  crawlDelayMinMs: parsePositiveInt(process.env.CRAWL_DELAY_MIN_MS, 1500),
  crawlDelayMaxMs: parsePositiveInt(process.env.CRAWL_DELAY_MAX_MS, 3000),
  llmProvider: (process.env.LLM_PROVIDER?.trim() || "openai") as "openai",
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "",
  llmTemperature: parseNumber(process.env.LLM_TEMPERATURE, 0),
  baseUrl: "https://www.saramin.co.kr/zf_user/",
  jobCategoryUrl: "https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2",
  screenshotsDir: "screenshots",
});

export const validateLlmConfig = (config: AppConfig): void => {
  if (config.llmProvider !== "openai") {
    throw new Error("현재 LLM_PROVIDER는 openai만 지원합니다. .env에서 LLM_PROVIDER=openai로 설정해주세요.");
  }

  if (!config.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY가 없어 LLM 판단 모드를 실행할 수 없습니다. .env 파일에 OPENAI_API_KEY를 설정한 뒤 다시 실행해주세요.",
    );
  }

  if (!config.openaiModel) {
    throw new Error(
      "OPENAI_MODEL이 비어 있습니다. 최신 모델명은 코드에 고정하지 않으므로 .env에서 직접 지정해주세요.",
    );
  }
};
