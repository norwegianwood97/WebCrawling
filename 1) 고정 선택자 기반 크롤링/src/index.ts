import { launchBrowser } from "./browser.js";
import { loadConfig } from "./config.js";
import { crawlSaraminJobs } from "./saraminCrawler.js";
import { logStep } from "./utils.js";
import { timestampForFileName, writeCsv, writeJson, writeXlsx } from "./writers.js";

const main = async (): Promise<void> => {
  const config = loadConfig();

  logStep(1, "브라우저 실행");
  const { browser, context, page } = await launchBrowser(config);

  try {
    const jobs = await crawlSaraminJobs(page, config);
    const writeOptions = { timestamp: timestampForFileName() };

    const csvPath = await writeCsv(jobs, config.outputDir, writeOptions);
    logStep(12, `CSV 저장 완료: ${csvPath}`);

    const jsonPath = await writeJson(jobs, config.outputDir, writeOptions);
    logStep(13, `JSON 저장 완료: ${jsonPath}`);

    if (config.saveXlsx) {
      const xlsxPath = await writeXlsx(jobs, config.outputDir, writeOptions);
      logStep(14, `XLSX 저장 완료: ${xlsxPath}`);
    } else {
      logStep(14, "SAVE_XLSX=false 설정으로 XLSX 저장을 생략합니다.");
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
