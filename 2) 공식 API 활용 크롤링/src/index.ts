import path from "node:path";
import dotenv from "dotenv";
import { SaraminApiClient } from "./saraminApiClient";
import { shouldIncludeByCareer } from "./careerFilter";
import { isActiveJob, normalizeJob } from "./normalizeJob";
import { collectWithPlaywrightFallback } from "./playwrightFallback";
import { CollectionStats, CollectorConfig, NormalizedJob } from "./types";
import { writeOutputs } from "./writers";

dotenv.config();

const PAGE_SIZE = 110;

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.accessKey) {
    if (config.usePlaywrightFallback) {
      console.warn("SARAMIN_ACCESS_KEY가 없어 Playwright fallback 모드로 실행합니다.");
      const fallbackJobs = dedupeJobs(await collectWithPlaywrightFallback());
      const paths = await writeOutputs(fallbackJobs, config.outputDir);
      printResult({ totalSeen: fallbackJobs.length, activeSeen: fallbackJobs.length, passedFilter: fallbackJobs.length, saved: fallbackJobs.length }, paths);
      return;
    }

    throw new Error(
      "SARAMIN_ACCESS_KEY가 설정되지 않았습니다. .env 파일에 SARAMIN_ACCESS_KEY=발급받은_API_KEY 를 추가해 주세요."
    );
  }

  const { jobs, stats } = await collectFromApi(config);
  const paths = await writeOutputs(jobs, config.outputDir);
  printResult(stats, paths);
}

async function collectFromApi(config: CollectorConfig): Promise<{ jobs: NormalizedJob[]; stats: CollectionStats }> {
  const client = new SaraminApiClient();
  const scrapedAt = new Date().toISOString();
  const jobsById = new Map<string, NormalizedJob>();
  const stats: CollectionStats = {
    totalSeen: 0,
    activeSeen: 0,
    passedFilter: 0,
    saved: 0
  };

  for (let pageIndex = 0; pageIndex < config.maxPages; pageIndex += 1) {
    const start = pageIndex * PAGE_SIZE;
    const page = await client.fetchJobsPage({
      accessKey: config.accessKey,
      start,
      count: PAGE_SIZE
    });

    stats.totalSeen += page.jobs.length;

    for (const rawJob of page.jobs) {
      if (!isActiveJob(rawJob)) {
        continue;
      }

      stats.activeSeen += 1;

      if (!shouldIncludeByCareer(rawJob, config.strictMaxOneYear)) {
        continue;
      }

      stats.passedFilter += 1;

      const normalized = normalizeJob(rawJob, scrapedAt);
      if (normalized.id) {
        jobsById.set(normalized.id, normalized);
      }
    }

    const nextStart = page.start + page.count;
    if (page.jobs.length === 0 || nextStart >= page.total) {
      break;
    }
  }

  const jobs = [...jobsById.values()];
  stats.saved = jobs.length;
  return { jobs, stats };
}

function loadConfig(): CollectorConfig {
  return {
    accessKey: process.env.SARAMIN_ACCESS_KEY?.trim() ?? "",
    strictMaxOneYear: parseBoolean(process.env.STRICT_MAX_ONE_YEAR, false),
    maxPages: parsePositiveInteger(process.env.MAX_PAGES, 5),
    outputDir: path.resolve(process.env.OUTPUT_DIR?.trim() || "output"),
    usePlaywrightFallback: parseBoolean(process.env.USE_PLAYWRIGHT_FALLBACK, false)
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function dedupeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const map = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    map.set(job.id, job);
  }

  return [...map.values()];
}

function printResult(stats: CollectionStats, paths: { jsonPath: string; csvPath: string }): void {
  console.log("Saramin job collection completed.");
  console.log(`- total collected from source: ${stats.totalSeen}`);
  console.log(`- active postings: ${stats.activeSeen}`);
  console.log(`- passed career filter: ${stats.passedFilter}`);
  console.log(`- saved unique postings: ${stats.saved}`);
  console.log(`- JSON: ${paths.jsonPath}`);
  console.log(`- CSV: ${paths.csvPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
