import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Page } from "playwright";
import { AppConfig } from "../config.js";
import { ensureDirectory, maybeScreenshot, writeDebugArtifacts } from "../utils/debug.js";
import { normalizeMultilineText, normalizeText } from "../utils/text.js";
import { looksBlockedText } from "../agent/safetyGuard.js";
import { DetailFields } from "./types.js";

type DetailFieldKey = Exclude<keyof DetailFields, "detail_text" | "detail_error">;

const bodySelectors = [
  ".wrap_jv_cont",
  ".jv_cont",
  ".jv_howto",
  ".jv_summary",
  ".jv_detail",
  ".jv_job",
  ".jv_cont_area",
  ".user_content",
  ".cont_recruit",
  ".job_view",
  ".view_cont",
  "#content",
  "main",
  "body",
];

const sectionKeywords: Record<DetailFieldKey, string[]> = {
  main_tasks: ["주요업무", "담당업무", "업무내용", "담당하실 업무", "이런 일을 해요"],
  requirements: ["자격요건", "지원자격", "필수요건", "필요역량", "이런 분을 찾고 있어요"],
  preferred: ["우대사항", "우대조건", "이런 분이면 더 좋아요"],
  hiring_process: ["전형절차", "채용절차", "채용 프로세스", "합류 여정"],
  benefits: ["복리후생", "혜택", "복지"],
  work_conditions: ["근무조건", "근무지", "근무시간", "급여", "근무형태"],
  tech_stack: ["기술스택", "사용기술", "개발환경", "Tech Stack", "Stack"],
};

const emptyDetails = (): DetailFields => ({
  tech_stack: "",
  main_tasks: "",
  requirements: "",
  preferred: "",
  hiring_process: "",
  benefits: "",
  work_conditions: "",
  detail_text: "",
  detail_error: "",
});

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanHeading = (line: string): string =>
  normalizeText(line.replace(/^[\s\-*#\d.)]+/, "").replace(/[:：]\s*$/, ""));

const findSectionKey = (line: string): DetailFieldKey | null => {
  const cleaned = cleanHeading(line);
  for (const [key, keywords] of Object.entries(sectionKeywords) as Array<[DetailFieldKey, string[]]>) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`^${escapeRegex(keyword)}\\s*[:：]?(?:\\s|$)`, "i");
      if (pattern.test(cleaned)) {
        return key;
      }
    }
  }

  return null;
};

const removeHeading = (line: string, key: DetailFieldKey): string => {
  let current = line;
  for (const keyword of sectionKeywords[key]) {
    current = current.replace(new RegExp(`^\\s*${escapeRegex(keyword)}\\s*[:：]?\\s*`, "i"), "");
  }

  return normalizeText(current);
};

const splitByLineHeadings = (text: string): DetailFields => {
  const details = emptyDetails();
  details.detail_text = text || "";

  const buffers: Record<DetailFieldKey, string[]> = {
    tech_stack: [],
    main_tasks: [],
    requirements: [],
    preferred: [],
    hiring_process: [],
    benefits: [],
    work_conditions: [],
  };

  let currentKey: DetailFieldKey | null = null;
  for (const line of text.split("\n")) {
    const nextKey = findSectionKey(line);
    if (nextKey) {
      currentKey = nextKey;
      const inlineText = removeHeading(line, nextKey);
      if (inlineText && inlineText !== cleanHeading(line)) {
        buffers[nextKey].push(inlineText);
      }
      continue;
    }

    if (currentKey) {
      buffers[currentKey].push(line);
    }
  }

  for (const key of Object.keys(buffers) as DetailFieldKey[]) {
    details[key] = normalizeMultilineText(buffers[key].join("\n"));
  }

  return details;
};

const fallbackSplitByKeywordPosition = (text: string): DetailFields => {
  const details = emptyDetails();
  details.detail_text = text || "";
  const hits: Array<{ key: DetailFieldKey; index: number; end: number }> = [];

  for (const [key, keywords] of Object.entries(sectionKeywords) as Array<[DetailFieldKey, string[]]>) {
    for (const keyword of keywords) {
      const match = new RegExp(`${escapeRegex(keyword)}\\s*[:：]?`, "i").exec(text);
      if (match?.index !== undefined) {
        hits.push({ key, index: match.index, end: match.index + match[0].length });
        break;
      }
    }
  }

  hits.sort((a, b) => a.index - b.index);
  for (let index = 0; index < hits.length; index += 1) {
    const hit = hits[index];
    const next = hits[index + 1];
    details[hit.key] = normalizeMultilineText(text.slice(hit.end, next?.index ?? text.length));
  }

  return details;
};

const hasImportantSection = (details: DetailFields): boolean =>
  Boolean(details.main_tasks || details.requirements || details.preferred || details.tech_stack);

const extractBodyText = async (page: Page): Promise<string> => {
  let fallback = "";

  for (const selector of bodySelectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) === 0) {
      continue;
    }

    const text = normalizeMultilineText(await locator.innerText({ timeout: 3000 }).catch(() => ""));
    if (!fallback && text) {
      fallback = text;
    }

    if (text.length > 100 || selector === "body") {
      return text;
    }
  }

  return fallback;
};

export const extractDetailFromPage = async (
  page: Page,
  config: AppConfig,
  jobUrl: string,
  index: number,
): Promise<DetailFields> => {
  const details = emptyDetails();

  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await maybeScreenshot(page, config, `detail_${String(index).padStart(3, "0")}.png`);

    const title = await page.title().catch(() => "");
    const text = await extractBodyText(page);
    details.detail_text = text || "";

    if (looksBlockedText(text, page.url(), title)) {
      details.detail_error = "차단/CAPTCHA/비정상 접근 의심 화면이 감지되어 상세 수집을 스킵했습니다.";
      await writeDebugArtifacts(page, config, details.detail_error, `detail_blocked_${String(index).padStart(3, "0")}`);
      return details;
    }

    const lineSplit = splitByLineHeadings(text);
    Object.assign(details, lineSplit);
    details.detail_text = text || "";

    if (text && !hasImportantSection(details)) {
      const fallback = fallbackSplitByKeywordPosition(text);
      for (const key of Object.keys(sectionKeywords) as DetailFieldKey[]) {
        details[key] = details[key] || fallback[key];
      }
      details.detail_text = text || "";
    }

    const imageCount = await page.locator("img").count().catch(() => 0);
    if (details.detail_text.length < 300 && imageCount >= 5) {
      details.detail_error = "상세 내용이 이미지형 공고일 가능성이 높습니다";
    }

    console.log(
      `[detail_parse] text=${details.detail_text.length} main=${details.main_tasks.length} req=${details.requirements.length} pref=${details.preferred.length} tech=${details.tech_stack.length}`,
    );

    return details;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    details.detail_error = `상세 페이지 수집 실패: ${message}`;
    details.detail_text = details.detail_text || "";

    await ensureDirectory(config.screenshotsDir);
    await page
      .content()
      .then((html) =>
        writeFile(
          path.join(config.screenshotsDir, `detail_error_${String(index).padStart(3, "0")}.html`),
          html,
          "utf8",
        ),
      )
      .catch(() => undefined);
    await maybeScreenshot(page, config, `detail_error_${String(index).padStart(3, "0")}.png`);

    return details;
  }
};
