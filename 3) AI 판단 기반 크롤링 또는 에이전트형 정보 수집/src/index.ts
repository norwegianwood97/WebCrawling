import { loadConfig, validateLlmConfig } from "./config.js";
import { crawlSaraminWithAgent } from "./crawler/saraminAgentCrawler.js";
import { writeCsv, writeJson, writeXlsx } from "./output/writers.js";
import { logSave } from "./utils/logger.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  validateLlmConfig(config);

  const jobs = await crawlSaraminWithAgent(config);

  const jsonPath = await writeJson(jobs, config.outputDir);
  logSave(`JSON 저장 완료: ${jsonPath}`);

  const csvPath = await writeCsv(jobs, config.outputDir);
  logSave(`CSV 저장 완료: ${csvPath}`);

  if (config.saveXlsx) {
    const xlsxPath = await writeXlsx(jobs, config.outputDir, config.saveXlsxTimestamp);
    logSave(`XLSX 저장 완료: ${xlsxPath}`);
  }

  console.log(`[done] 총 ${jobs.length}개 공고 저장 완료`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exitCode = 1;
});
