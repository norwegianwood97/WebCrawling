import { Locator, Page } from "playwright";
import { ClickCandidate, ClickResult } from "./types.js";
import { normalizeText } from "./utils.js";

const visibleFirst = async (locator: Locator): Promise<Locator | null> => {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      return item;
    }
  }

  return null;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message.split("\n")[0] ?? error.message : String(error);

export const clickByTextCandidates = async (
  page: Page,
  texts: string[],
  stepName: string
): Promise<ClickResult> => {
  const failures: string[] = [];

  for (const text of texts) {
    try {
      const locator = page.getByText(text, { exact: false });
      const target = await visibleFirst(locator);
      if (!target) {
        failures.push(`텍스트 "${text}": visible 요소 없음`);
        continue;
      }

      await target.click({ timeout: 5000 });
      console.log(`${stepName}: 텍스트 후보 클릭 성공 - ${text}`);
      return { success: true, value: text, failures };
    } catch (error) {
      failures.push(`텍스트 "${text}": ${describeError(error)}`);
    }
  }

  return { success: false, failures };
};

export const clickBySelectorCandidates = async (
  page: Page,
  selectorCandidates: string[],
  stepName: string
): Promise<ClickResult> => {
  const failures: string[] = [];

  for (const selector of selectorCandidates) {
    try {
      const locator = page.locator(selector);
      const target = await visibleFirst(locator);
      if (!target) {
        failures.push(`selector "${selector}": visible 요소 없음`);
        continue;
      }

      await target.click({ timeout: 5000 });
      console.log(`${stepName}: selector 후보 클릭 성공 - ${selector}`);
      return { success: true, value: selector, failures };
    } catch (error) {
      failures.push(`selector "${selector}": ${describeError(error)}`);
    }
  }

  return { success: false, failures };
};

export const clickByCandidates = async (
  page: Page,
  candidates: ClickCandidate[],
  stepName: string
): Promise<ClickResult> => {
  const textCandidates = candidates.filter((candidate) => candidate.type === "text").map((candidate) => candidate.value);
  const selectorCandidates = candidates
    .filter((candidate) => candidate.type === "selector")
    .map((candidate) => candidate.value);

  const textResult = await clickByTextCandidates(page, textCandidates, stepName);
  if (textResult.success) {
    return textResult;
  }

  const selectorResult = await clickBySelectorCandidates(page, selectorCandidates, stepName);
  if (selectorResult.success) {
    return {
      success: true,
      value: selectorResult.value,
      failures: [...textResult.failures, ...selectorResult.failures]
    };
  }

  const failures = [...textResult.failures, ...selectorResult.failures];
  console.warn(`${stepName}: 모든 클릭 후보 실패`);
  for (const failure of failures) {
    console.warn(`- ${failure}`);
  }

  return { success: false, failures };
};

export const clickTextWithinVisibleLayer = async (
  page: Page,
  texts: string[],
  stepName: string
): Promise<ClickResult> => {
  const failures: string[] = [];
  const layerSelectors = [
    ".layer_search",
    ".wrap_depth_category",
    ".area_depth",
    ".job_category",
    ".option_content",
    "body"
  ];

  for (const layerSelector of layerSelectors) {
    const layer = page.locator(layerSelector);
    const layerCount = await layer.count().catch(() => 0);
    for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
      const currentLayer = layer.nth(layerIndex);
      if (!await currentLayer.isVisible().catch(() => false)) {
        continue;
      }

      for (const text of texts) {
        try {
          const target = await visibleFirst(currentLayer.getByText(text, { exact: false }));
          if (!target) {
            failures.push(`${layerSelector} 안 텍스트 "${text}": visible 요소 없음`);
            continue;
          }

          await target.click({ timeout: 5000 });
          const clickedText = normalizeText(await target.innerText().catch(() => text));
          console.log(`${stepName}: 레이어 텍스트 클릭 성공 - ${clickedText || text}`);
          return { success: true, value: clickedText || text, failures };
        } catch (error) {
          failures.push(`${layerSelector} 안 텍스트 "${text}": ${describeError(error)}`);
        }
      }
    }
  }

  return { success: false, failures };
};
