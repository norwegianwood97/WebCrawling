import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Page } from "playwright";
import { AppConfig } from "../config.js";

export const ensureDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true });
};

export const maybeScreenshot = async (
  page: Page,
  config: AppConfig,
  fileName: string,
): Promise<string> => {
  if (!config.debugScreenshot) {
    return "";
  }

  await ensureDirectory(config.screenshotsDir);
  const filePath = path.join(config.screenshotsDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => undefined);
  return filePath;
};

export const writeDebugArtifacts = async (
  page: Page,
  config: AppConfig,
  reason: string,
  name = "debug",
): Promise<void> => {
  await ensureDirectory(config.screenshotsDir);

  if (config.debugScreenshot) {
    await page
      .screenshot({
        path: path.join(config.screenshotsDir, name === "debug" ? "error.png" : `${name}.png`),
        fullPage: true,
      })
      .catch(() => undefined);
  }

  const html = await page.content().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return `HTML 저장 실패: ${message}`;
  });

  await writeFile(path.join(config.screenshotsDir, `${name}.html`), html, "utf8");
  if (name !== "debug") {
    await writeFile(path.join(config.screenshotsDir, "debug.html"), html, "utf8").catch(
      () => undefined,
    );
  }

  console.error(`[debug] ${reason}`);
  console.error(`[debug] currentUrl=${page.url()}`);
};
