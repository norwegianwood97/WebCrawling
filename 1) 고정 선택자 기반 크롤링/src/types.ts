export interface AppConfig {
  headless: boolean;
  maxItems: number;
  maxPages: number;
  outputDir: string;
  debugScreenshot: boolean;
  crawlDelayMinMs: number;
  crawlDelayMaxMs: number;
  saveXlsx: boolean;
  baseUrl: string;
  jobCategoryUrl: string;
  screenshotsDir: string;
}

export interface JobPosting {
  recruit_id: string;
  company_name: string;
  title: string;
  job_meta: string;
  location: string;
  career: string;
  education: string;
  job_url: string;
  company_url: string;
  source_url: string;
  scraped_at: string;
}

export interface ClickCandidate {
  type: "text" | "selector";
  value: string;
}

export interface ClickResult {
  success: boolean;
  value?: string;
  failures: string[];
}

export interface CareerUiResult {
  attempted: boolean;
  selected: boolean;
  reason: string;
}
