import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NormalizedJob } from "./types";

const CSV_COLUMNS: Array<keyof NormalizedJob> = [
  "id",
  "title",
  "company_name",
  "company_url",
  "job_url",
  "location_name",
  "location_code",
  "job_mid_code",
  "job_mid_name",
  "job_code",
  "job_code_name",
  "experience_code",
  "experience_min",
  "experience_max",
  "experience_name",
  "education",
  "job_type",
  "industry",
  "keyword",
  "salary",
  "posting_date",
  "expiration_date",
  "close_type",
  "read_count",
  "apply_count",
  "scraped_at"
];

export interface WriteResult {
  jsonPath: string;
  csvPath: string;
}

export async function writeOutputs(jobs: NormalizedJob[], outputDir: string, csvBom = true): Promise<WriteResult> {
  await mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "saramin_jobs.json");
  const csvPath = path.join(outputDir, "saramin_jobs.csv");

  await writeFile(jsonPath, `${JSON.stringify(jobs, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${csvBom ? "\uFEFF" : ""}${toCsv(jobs)}`, "utf8");

  return { jsonPath, csvPath };
}

function toCsv(jobs: NormalizedJob[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = jobs.map((job) => CSV_COLUMNS.map((column) => escapeCsv(job[column])).join(","));
  return [header, ...rows].join("\n") + "\n";
}

function escapeCsv(value: string | number | null): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
