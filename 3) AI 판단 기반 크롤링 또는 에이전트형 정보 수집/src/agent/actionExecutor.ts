import { Page } from "playwright";
import { AppConfig } from "../config.js";
import { delay } from "../utils/delay.js";
import { normalizeText } from "../utils/text.js";
import { toAbsoluteUrl } from "../utils/url.js";
import { AgentAction } from "./types.js";
import { validateAction } from "./safetyGuard.js";

export interface ActionExecutionResult {
  success: boolean;
  message: string;
}

const clickByText = async (page: Page, text: string): Promise<void> => {
  const target = normalizeText(text);
  if (!target) {
    throw new Error("click_text target이 비어 있습니다.");
  }

  const candidates = [
    page.getByRole("button", { name: new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }),
    page.getByRole("link", { name: new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }),
    page.getByText(target, { exact: false }),
  ];

  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      continue;
    }

    await locator.first().click({ timeout: 5000 });
    return;
  }

  throw new Error(`텍스트를 가진 클릭 대상이 없습니다: ${target}`);
};

export const executeAction = async (
  page: Page,
  config: AppConfig,
  action: AgentAction,
): Promise<ActionExecutionResult> => {
  const validation = validateAction(action);
  if (!validation.ok) {
    return { success: false, message: validation.reason };
  }

  try {
    if (action.action === "goto") {
      await page.goto(toAbsoluteUrl(action.url), { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      return { success: true, message: `goto ${action.url}` };
    }

    if (action.action === "click_text") {
      await clickByText(page, action.target || "");
      await page.waitForLoadState("domcontentloaded", { timeout: 7000 }).catch(() => undefined);
      return { success: true, message: `click_text ${action.target}` };
    }

    if (action.action === "click_selector") {
      const selector = action.selector || action.target || "";
      await page.locator(selector).first().click({ timeout: 5000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 7000 }).catch(() => undefined);
      return { success: true, message: `click_selector ${selector}` };
    }

    if (action.action === "fill_text") {
      const selector = action.selector || action.target || "";
      await page.locator(selector).first().fill(action.text || "", { timeout: 5000 });
      return { success: true, message: `fill_text ${selector}` };
    }

    if (action.action === "press") {
      await page.keyboard.press(action.key || "Enter");
      await page.waitForLoadState("domcontentloaded", { timeout: 7000 }).catch(() => undefined);
      return { success: true, message: `press ${action.key || "Enter"}` };
    }

    if (action.action === "wait") {
      await delay(Math.min(Math.max(action.ms ?? 1000, 250), 10_000));
      return { success: true, message: `wait ${action.ms ?? 1000}ms` };
    }

    if (action.action === "extract_results") {
      return { success: true, message: "extract_results" };
    }

    if (action.action === "stop") {
      return { success: true, message: "stop" };
    }

    return { success: false, message: `구현되지 않은 action: ${action.action}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message };
  } finally {
    await delay(Math.min(config.crawlDelayMinMs, 1500)).catch(() => undefined);
  }
};
