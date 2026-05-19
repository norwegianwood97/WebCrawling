export interface AppConfig {
  headless: boolean;
  maxItems: number;
  maxPages: number;
  maxDetailPages: number;
  outputDir: string;
  debugScreenshot: boolean;
  crawlDelayMinMs: number;
  crawlDelayMaxMs: number;
  crawlDetailDelayMinMs: number;
  crawlDetailDelayMaxMs: number;
  saveXlsx: boolean;
  saveXlsxTimestamp: boolean;
  baseUrl: string;
  jobCategoryUrl: string;
  screenshotsDir: string;
}

export interface JobPosting {
  recruit_id: string;
  company_name: string;
  title: string;
  career: string;
  location: string;
  education: string;
  employment_type: string;
  deadline: string;
  job_url: string;
  company_url: string;
  source_url: string;
  scraped_at: string;
  main_tasks: string;
  requirements: string;
  preferred: string;
  hiring_process: string;
  benefits: string;
  work_conditions: string;
  tech_stack: string;
  detail_text: string;
  detail_error: string;
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
