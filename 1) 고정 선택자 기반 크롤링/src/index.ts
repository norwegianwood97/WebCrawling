import { launchBrowser } from "./browser.js";
import { loadConfig } from "./config.js";
import { crawlSaraminJobs } from "./saraminCrawler.js";
import { logStep } from "./utils.js";
import { writeCsv, writeJson, writeXlsx } from "./writers.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const { browser, context, page } = await launchBrowser(config);

  try {
    const jobs = await crawlSaraminJobs(page, config);
    logStep(13, `총 저장 공고 ${jobs.length}개`);
    console.log("[verify] first job keys:", Object.keys(jobs[0] ?? {}));
    console.log("[verify] detail_text length:", jobs[0]?.detail_text?.length ?? "undefined");
    if (jobs[0]?.detail_text === undefined) {
      console.error("[verify] detail_text가 undefined입니다. 상세 필드 병합 또는 기본값 보장 흐름을 확인하세요.");
    }

    const csvPath = await writeCsv(jobs, config.outputDir);
    logStep(14, `CSV 저장 완료: ${csvPath}`);

    const jsonPath = await writeJson(jobs, config.outputDir);
    logStep(15, `JSON 저장 완료: ${jsonPath}`);

    if (config.saveXlsx) {
      const xlsxPath = await writeXlsx(jobs, config.outputDir, {
        timestampFileName: config.saveXlsxTimestamp
      });
      logStep(16, `XLSX 저장 완료: ${xlsxPath}`);
    } else {
      logStep(16, "SAVE_XLSX=false 설정으로 XLSX 저장을 생략합니다.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`크롤링 실패: ${message}`);
    process.exitCode = 1;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

await main();
