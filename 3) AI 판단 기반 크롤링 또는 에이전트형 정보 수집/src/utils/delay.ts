import { AppConfig } from "../config.js";

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const randomDelay = async (config: AppConfig): Promise<void> => {
  const min = Math.min(config.crawlDelayMinMs, config.crawlDelayMaxMs);
  const max = Math.max(config.crawlDelayMinMs, config.crawlDelayMaxMs);
  const waitMs = min + Math.floor(Math.random() * (max - min + 1));
  console.log(`[delay] ${waitMs}ms 대기`);
  await delay(waitMs);
};
