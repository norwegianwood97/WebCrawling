import { Locator, Page } from "playwright";
import { normalizeText } from "../utils/text.js";
import { isValidJobDetailUrl, toAbsoluteUrl } from "../utils/url.js";
import { JobPosting } from "./types.js";

const cardSelectors = [
  'div.list_item[id^="rec-"]',
  "div.list_item",
  "#default_list_wrap .list_body .list_item",
  ".item_recruit",
  '[id^="rec-"]',
];

const jobAnchorSelectors = [
  'a[href*="/zf_user/jobs/relay/view"]',
  'a[href*="rec_idx="]',
  'a[href*="/jobs/view"]',
];

const companyAnchorSelectors = [
  'a[href*="/zf_user/company-info/"]',
  ".company_nm a",
  ".corp_name a",
  ".area_corp a",
  ".col.company_nm a",
];

const companyNameSelectors = [
  ".company_nm",
  ".corp_name",
  ".area_corp",
  ".col.company_nm",
  "[class*=company]",
  "[class*=corp]",
];

const deadlineSelectors = [
  ".support_detail .date",
  ".deadlines",
  ".date",
  ".support_info .date",
  ".job_date",
];

interface AnchorCandidate {
  href: string;
  text: string;
}

const textBySelectors = async (card: Locator, selectors: string[]): Promise<string> => {
  for (const selector of selectors) {
    const locator = card.locator(selector).first();
    if ((await locator.count().catch(() => 0)) === 0) {
      continue;
    }

    const text = normalizeText(await locator.innerText({ timeout: 1500 }).catch(() => ""));
    if (text) {
      return text;
    }
  }

  return "";
};

const hrefBySelectors = async (card: Locator, selectors: string[]): Promise<string> => {
  for (const selector of selectors) {
    const locators = card.locator(selector);
    const count = await locators.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const href = toAbsoluteUrl(
        await locators.nth(index).getAttribute("href", { timeout: 1500 }).catch(() => ""),
      );
      if (href) {
        return href;
      }
    }
  }

  return "";
};

const findJobAnchor = async (card: Locator, companyName: string): Promise<AnchorCandidate | null> => {
  for (const selector of jobAnchorSelectors) {
    const locators = card.locator(selector);
    const count = await locators.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const locator = locators.nth(index);
      const href = toAbsoluteUrl(
        await locator.getAttribute("href", { timeout: 1500 }).catch(() => ""),
      );
      const text = normalizeText(await locator.innerText({ timeout: 1500 }).catch(() => ""));

      if (!isValidJobDetailUrl(href) || !text) {
        continue;
      }

      if (companyName && text === companyName) {
        continue;
      }

      return { href, text };
    }
  }

  return null;
};

const parseRecruitId = async (card: Locator, jobUrl: string): Promise<string> => {
  const id = normalizeText(await card.getAttribute("id").catch(() => ""));
  const idMatch = id.match(/rec-(\d+)/);
  if (idMatch?.[1]) {
    return idMatch[1];
  }

  const urlMatch = jobUrl.match(/rec_idx=(\d+)/) ?? jobUrl.match(/rec-(\d+)/);
  return urlMatch?.[1] ?? "";
};

const matchFirst = (text: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      return normalizeText(match[0]);
    }
  }

  return "";
};

const parseMetaFields = async (
  card: Locator,
): Promise<Pick<JobPosting, "career" | "location" | "education" | "employment_type">> => {
  const chunks: string[] = [];
  const selectors = [
    ".job_condition",
    ".recruit_info .job_condition",
    ".recruit_info",
    ".support_info",
    ".recruit_condition",
    ".corp_info",
    ".col.recruit_info",
    ".job_meta",
    ".condition",
    ".area_job",
  ];

  for (const selector of selectors) {
    const locators = card.locator(selector);
    const count = await locators.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 5); index += 1) {
      const text = normalizeText(await locators.nth(index).innerText({ timeout: 1000 }).catch(() => ""));
      if (text) {
        chunks.push(text);
      }
    }
  }

  const fullText = normalizeText(await card.innerText({ timeout: 1500 }).catch(() => ""));
  if (fullText) {
    chunks.push(fullText);
  }

  const text = normalizeText(chunks.join(" "));
  return {
    career: matchFirst(text, [
      /경력무관/,
      /신입\s*\/\s*경력/,
      /신입/,
      /경력\s*\d+\s*년\s*(?:↑|이상|이하|미만)?/,
      /~\s*1년/,
      /1년\s*(?:이하|미만)/,
      /0\s*~\s*1년/,
      /0~1년/,
    ]),
    location: matchFirst(text, [
      /서울\s*전체/,
      /서울\s*[가-힣]+구/,
      /서울/,
      /경기/,
      /인천/,
      /전국/,
      /재택/,
    ]),
    education: matchFirst(text, [
      /학력무관/,
      /고졸/,
      /초대졸/,
      /대졸/,
      /석사/,
      /박사/,
      /졸업/,
    ]),
    employment_type: matchFirst(text, [
      /정규직/,
      /계약직/,
      /인턴/,
      /프리랜서/,
      /파견직/,
      /위촉직/,
      /아르바이트/,
      /병역특례/,
    ]),
  };
};

const cleanCompanyName = (value: string): string =>
  normalizeText(value.replace(/\s*관심기업\s*등록\s*/g, " "));

export const extractResultsFromPage = async (
  page: Page,
  maxItems: number,
): Promise<JobPosting[]> => {
  const cards = page.locator(cardSelectors.join(", "));
  const count = await cards.count().catch(() => 0);
  const jobs: JobPosting[] = [];
  const sourceUrl = page.url();

  for (let index = 0; index < count && jobs.length < maxItems; index += 1) {
    const card = cards.nth(index);
    const companyName = cleanCompanyName(await textBySelectors(card, companyNameSelectors));
    const jobAnchor = await findJobAnchor(card, companyName);

    if (!jobAnchor) {
      continue;
    }

    const title = normalizeText(jobAnchor.text);
    if (title && companyName && title === companyName) {
      continue;
    }

    const meta = await parseMetaFields(card);
    const deadline = await textBySelectors(card, deadlineSelectors);
    const companyUrl = await hrefBySelectors(card, companyAnchorSelectors);

    jobs.push({
      recruit_id: await parseRecruitId(card, jobAnchor.href),
      company_name: companyName,
      title,
      career: meta.career,
      location: meta.location,
      education: meta.education,
      employment_type: meta.employment_type,
      deadline,
      tech_stack: "",
      main_tasks: "",
      requirements: "",
      preferred: "",
      hiring_process: "",
      benefits: "",
      work_conditions: "",
      detail_text: "",
      detail_error: "",
      job_url: jobAnchor.href,
      company_url: companyUrl,
      source_url: sourceUrl,
      scraped_at: new Date().toISOString(),
    });
  }

  return jobs;
};
