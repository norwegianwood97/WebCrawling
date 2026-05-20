import path from "node:path";
import { Page } from "playwright";
import { AppConfig } from "../config.js";
import { maybeScreenshot } from "../utils/debug.js";
import { normalizeText, truncate } from "../utils/text.js";
import { looksBlockedText } from "./safetyGuard.js";
import { ElementCandidate, GoalProgress, PageObservation } from "./types.js";

const resultSelectors = [
  'div.list_item[id^="rec-"]',
  "div.list_item",
  "#default_list_wrap .list_body .list_item",
  ".item_recruit",
  '[id^="rec-"]',
];

const makeCandidateSelectors = (progress: GoalProgress): string[] => {
  const selectors = [
    ...resultSelectors,
    'a[href*="/zf_user/jobs/relay/view"]',
    'a[href*="rec_idx="]',
    'button:visible',
    'a:visible',
    'input:visible',
  ];

  if (!progress.regionSelected) {
    selectors.push('text="지역"', 'text="서울"', 'text="서울전체"');
  }

  if (!progress.jobCategorySelected) {
    selectors.push('text="IT개발·데이터"', 'text="직업"', 'text="직무"');
  }

  if (!progress.careerSelected) {
    selectors.push('text="경력"', 'text="신입"', 'text="~1년"');
  }

  return selectors;
};

const collectCandidates = async (
  page: Page,
  kind: "buttons" | "links" | "inputs",
  limit: number,
): Promise<ElementCandidate[]> => {
  const selectors =
    kind === "buttons"
      ? [
          { selector: "button", tag: "button", role: "button" },
          { selector: '[role="button"]', tag: "button", role: "button" },
          { selector: 'input[type="button"]', tag: "input", role: "button" },
          { selector: 'input[type="submit"]', tag: "input", role: "button" },
        ]
      : kind === "links"
        ? [{ selector: "a[href]", tag: "a", role: "link" }]
        : [
            { selector: "input", tag: "input", role: "input" },
            { selector: "textarea", tag: "textarea", role: "textbox" },
            { selector: "select", tag: "select", role: "combobox" },
          ];

  const candidates: ElementCandidate[] = [];

  for (const entry of selectors) {
    const locators = page.locator(entry.selector);
    const count = await locators.count().catch(() => 0);

    for (let index = 0; index < count && candidates.length < limit; index += 1) {
      const locator = locators.nth(index);
      if (!(await locator.isVisible().catch(() => false))) {
        continue;
      }

      const [innerText, value, placeholder, ariaLabel, title, href, name, type] =
        await Promise.all([
          locator.innerText({ timeout: 1000 }).catch(() => ""),
          locator.inputValue({ timeout: 1000 }).catch(() => ""),
          locator.getAttribute("placeholder").catch(() => ""),
          locator.getAttribute("aria-label").catch(() => ""),
          locator.getAttribute("title").catch(() => ""),
          locator.getAttribute("href").catch(() => ""),
          locator.getAttribute("name").catch(() => ""),
          locator.getAttribute("type").catch(() => ""),
        ]);

      const text =
        normalizeText(innerText) ||
        normalizeText(value) ||
        normalizeText(placeholder) ||
        normalizeText(ariaLabel) ||
        normalizeText(title);

      if (!text && !placeholder && !name && !href) {
        continue;
      }

      candidates.push({
        tag: entry.tag,
        text,
        selector: `${entry.selector} >> nth=${index}`,
        role: entry.role,
        visible: true,
        href: href || undefined,
        placeholder: placeholder || undefined,
        name: name || undefined,
        type: type || undefined,
      });
    }
  }

  return candidates;
};

const inferProgress = async (
  page: Page,
  bodyText: string,
  currentUrl: string,
  title: string,
): Promise<GoalProgress> => {
  const compact = normalizeText(bodyText);
  const resultChecks = await Promise.all(
    resultSelectors.map(async (selector) => (await page.locator(selector).count().catch(() => 0)) > 0),
  );
  const resultListVisible = resultChecks.some(Boolean);

  const urlLooksDone = /search_done=y|preview=y|loc_mcd=101000|cat_mcls=2|job_category/i.test(
    currentUrl,
  );

  return {
    regionSelected: /서울\s*전체|서울전체|loc_mcd=101000/i.test(compact) || /loc_mcd=101000/.test(currentUrl),
    jobCategorySelected:
      /IT개발\s*·\s*데이터|IT개발·데이터|cat_mcls=2/i.test(compact) || /cat_mcls=2/.test(currentUrl),
    careerSelected: /경력무관|신입|신입\s*\/\s*경력|~\s*1년|1년\s*이하|1년\s*미만|0\s*~\s*1년/.test(
      compact,
    ),
    resultListVisible: resultListVisible || urlLooksDone,
    blockedOrCaptchaLikely: looksBlockedText(compact, currentUrl, title),
  };
};

export const observePage = async (
  page: Page,
  config: AppConfig,
  step: number,
): Promise<PageObservation> => {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "");
  const bodyText = truncate(
    normalizeText(await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")),
    6000,
  );

  const progress = await inferProgress(page, bodyText, currentUrl, title);
  const screenshotPath = await maybeScreenshot(
    page,
    config,
    step === 0 ? "01_home.png" : `agent_step_${String(step).padStart(3, "0")}.png`,
  );

  return {
    currentUrl,
    title,
    bodyText,
    screenshotPath: screenshotPath ? path.normalize(screenshotPath) : "",
    buttons: await collectCandidates(page, "buttons", 50),
    links: await collectCandidates(page, "links", 50),
    inputs: await collectCandidates(page, "inputs", 30),
    candidateSelectors: makeCandidateSelectors(progress),
    progress,
  };
};
