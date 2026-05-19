import { Page } from "playwright";
import { JobPosting } from "./types.js";
import { normalizeText } from "./utils.js";

type DetailFields = Pick<
  JobPosting,
  | "main_tasks"
  | "requirements"
  | "preferred"
  | "hiring_process"
  | "benefits"
  | "work_conditions"
  | "tech_stack"
  | "detail_text"
  | "detail_error"
>;

type DetailFieldKey = Exclude<keyof DetailFields, "detail_text" | "detail_error">;

const emptyDetailFields = (): DetailFields => ({
  main_tasks: "",
  requirements: "",
  preferred: "",
  hiring_process: "",
  benefits: "",
  work_conditions: "",
  tech_stack: "",
  detail_text: "",
  detail_error: ""
});

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
  "body"
];

const sectionTitles: Record<DetailFieldKey, string[]> = {
  main_tasks: ["주요업무", "담당업무", "업무내용", "담당하실 업무", "이런 일을 해요"],
  requirements: ["자격요건", "지원자격", "필수요건", "필요역량", "이런 분을 찾고 있어요"],
  preferred: ["우대사항", "우대조건", "이런 분이면 더 좋아요"],
  hiring_process: ["전형절차", "채용절차", "채용 프로세스", "합류 여정"],
  benefits: ["복리후생", "혜택", "혜택 및 복지", "복지"],
  work_conditions: ["근무조건", "근무지", "근무시간", "급여", "근무형태"],
  tech_stack: ["기술스택", "사용기술", "개발환경", "Tech Stack", "Stack"]
};

export const isValidJobDetailUrl = (url: string): boolean => {
  if (!url || url.includes("company-info/view-inner-recruit")) {
    return false;
  }

  return (
    url.includes("/zf_user/jobs/relay/view") ||
    url.includes("rec_idx=") ||
    url.includes("/jobs/view")
  );
};

const normalizeDetailText = (value: string): string => {
  return value
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .join("\n")
    .trim();
};

const extractBodyText = async (page: Page): Promise<string> => {
  let fallbackText = "";

  for (const selector of bodySelectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) === 0) {
      continue;
    }

    const text = normalizeDetailText(
      await locator.innerText({ timeout: 3000 }).catch(() => "")
    );

    if (!fallbackText && text) {
      fallbackText = text;
    }

    if (text.length > 100 || selector === "body") {
      return text;
    }
  }

  return fallbackText;
};

const stripHeadingNoise = (line: string): string => {
  return normalizeText(
    line
      .replace(/^[\s\-•*·#\d.)]+/, "")
      .replace(/[:：]\s*$/, "")
  );
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findSectionKey = (line: string): DetailFieldKey | null => {
  const cleaned = stripHeadingNoise(line);

  for (const [key, titles] of Object.entries(sectionTitles) as Array<[DetailFieldKey, string[]]>) {
    for (const title of titles) {
      const escaped = escapeRegex(title);
      const headingPattern = new RegExp(`^${escaped}\\s*[:：]?$`, "i");
      const inlinePattern = new RegExp(`^${escaped}\\s*[:：]\\s*(.+)$`, "i");

      if (headingPattern.test(cleaned) || inlinePattern.test(cleaned)) {
        return key;
      }
    }
  }

  return null;
};

const removeInlineHeading = (line: string, key: DetailFieldKey): string => {
  let current = line;

  for (const title of sectionTitles[key]) {
    current = current.replace(new RegExp(`^\\s*${escapeRegex(title)}\\s*[:：]\\s*`, "i"), "");
  }

  return normalizeText(current);
};

const splitSections = (text: string): DetailFields => {
  const details = emptyDetailFields();
  details.detail_text = text;

  let currentKey: DetailFieldKey | null = null;
  const buffers: Record<DetailFieldKey, string[]> = {
    main_tasks: [],
    requirements: [],
    preferred: [],
    hiring_process: [],
    benefits: [],
    work_conditions: [],
    tech_stack: []
  };

  for (const line of text.split("\n")) {
    const nextKey = findSectionKey(line);
    if (nextKey) {
      currentKey = nextKey;
      const inlineText = removeInlineHeading(line, nextKey);
      if (inlineText && inlineText !== stripHeadingNoise(line)) {
        buffers[nextKey].push(inlineText);
      }
      continue;
    }

    if (currentKey) {
      buffers[currentKey].push(line);
    }
  }

  for (const key of Object.keys(buffers) as DetailFieldKey[]) {
    details[key] = normalizeDetailText(buffers[key].join("\n"));
  }

  return details;
};

const titleMatchesAt = (text: string, title: string): RegExpMatchArray | null => {
  const escaped = escapeRegex(title);
  return text.match(new RegExp(`${escaped}\\s*[:：]?`, "i"));
};

const fallbackExtractSections = (text: string): DetailFields => {
  const details = emptyDetailFields();
  details.detail_text = text;

  const hits: Array<{ key: DetailFieldKey; index: number; end: number }> = [];
  for (const [key, titles] of Object.entries(sectionTitles) as Array<[DetailFieldKey, string[]]>) {
    for (const title of titles) {
      const match = titleMatchesAt(text, title);
      if (match?.index !== undefined) {
        hits.push({
          key,
          index: match.index,
          end: match.index + match[0].length
        });
        break;
      }
    }
  }

  hits.sort((a, b) => a.index - b.index);
  for (let index = 0; index < hits.length; index += 1) {
    const hit = hits[index];
    const next = hits[index + 1];
    details[hit.key] = normalizeDetailText(text.slice(hit.end, next?.index ?? text.length));
  }

  return details;
};

const hasImportantSections = (details: DetailFields): boolean => {
  return Boolean(
    details.main_tasks ||
    details.requirements ||
    details.preferred ||
    details.tech_stack
  );
};

export const parseJobDetail = async (page: Page): Promise<DetailFields> => {
  const text = await extractBodyText(page);
  const details = text ? splitSections(text) : emptyDetailFields();
  details.detail_text = text;

  if (text && !hasImportantSections(details)) {
    const fallback = fallbackExtractSections(text);
    Object.assign(details, {
      main_tasks: details.main_tasks || fallback.main_tasks,
      requirements: details.requirements || fallback.requirements,
      preferred: details.preferred || fallback.preferred,
      hiring_process: details.hiring_process || fallback.hiring_process,
      benefits: details.benefits || fallback.benefits,
      work_conditions: details.work_conditions || fallback.work_conditions,
      tech_stack: details.tech_stack || fallback.tech_stack,
      detail_text: text
    });
  }

  const imageCount = await page.locator("img").count().catch(() => 0);
  if (text.length < 300 && imageCount >= 5) {
    details.detail_error = "상세 내용이 이미지형 공고일 가능성이 높습니다";
  }

  return details;
};
