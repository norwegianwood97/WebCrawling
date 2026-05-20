import { Locator } from "playwright";
import { JobPosting } from "./types.js";
import { normalizeText, toAbsoluteUrl } from "./utils.js";

const locatorReadTimeoutMs = 1000;

const companyNameSelectors = [
  "div.box_item > div.col.company_nm > a",
  ".company_nm a",
  ".company_nm",
];

const titleSelectors = [
  "div.box_item > div.col.notification_info > div.job_tit a.str_tit",
  "a.str_tit",
  '[id^="rec_link_"] span',
  ".job_tit a",
  '.notification_info a[href*="rec_idx"]',
];

const jobMetaSelectors = [
  "div.box_item > div.col.notification_info > div.job_meta > span",
  ".job_meta span",
  ".job_meta",
];

const jobUrlSelectors = [
  "div.box_item > div.col.notification_info > div.job_tit a.str_tit",
  "a.str_tit",
  'a[href*="/zf_user/jobs/relay/view"]',
  'a[href*="rec_idx="]',
];

const companyUrlSelectors = [
  ".company_nm a",
  "div.col.company_nm > a",
];

const locationSelectors = [
  "div.box_item > div.col.recruit_info > ul > li:nth-child(1) > p",
  ".recruit_info li:nth-child(1) p",
  ".recruit_info li:nth-child(1)",
];

const careerSelectors = [
  "div.box_item > div.col.recruit_info > ul > li:nth-child(2) > p",
  ".recruit_info li:nth-child(2) p",
  ".recruit_info li:nth-child(2)",
];

const educationSelectors = [
  "div.box_item > div.col.recruit_info > ul > li:nth-child(3) > p",
  ".recruit_info li:nth-child(3) p",
  ".recruit_info li:nth-child(3)",
];

interface HrefOptions {
  rejectCompanyInfo?: boolean;
}

const cleanCompanyName = (value: string): string =>
  normalizeText(value.replace(/관심기업\s*등록/g, " "));

const isCompanyInfoUrl = (url: string): boolean =>
  url.includes("company-info/view-inner-recruit");

const textsBySelector = async (
  card: Locator,
  selector: string,
): Promise<string[]> => {
  const locators = card.locator(selector);
  const count = await locators.count().catch(() => 0);
  const values: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const text = normalizeText(
      await locators
        .nth(index)
        .innerText({ timeout: locatorReadTimeoutMs })
        .catch(() => ""),
    );
    if (text) {
      values.push(text);
    }
  }

  return values;
};

const textBySelectors = async (
  card: Locator,
  selectors: readonly string[],
): Promise<string> => {
  for (const selector of selectors) {
    const [firstText] = await textsBySelector(card, selector);
    if (firstText) {
      return firstText;
    }
  }

  return "";
};

const joinedTextBySelectors = async (
  card: Locator,
  selectors: readonly string[],
): Promise<string> => {
  for (const selector of selectors) {
    const values = await textsBySelector(card, selector);
    if (values.length > 0) {
      return normalizeText(values.join(" / "));
    }
  }

  return "";
};

const hrefBySelectors = async (
  card: Locator,
  selectors: readonly string[],
  options: HrefOptions = {},
): Promise<string> => {
  for (const selector of selectors) {
    const locators = card.locator(selector);
    const count = await locators.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const href = normalizeText(
        await locators
          .nth(index)
          .getAttribute("href", { timeout: locatorReadTimeoutMs })
          .catch(() => ""),
      );
      const absoluteUrl = toAbsoluteUrl(href);
      if (!absoluteUrl) {
        continue;
      }

      if (options.rejectCompanyInfo && isCompanyInfoUrl(absoluteUrl)) {
        continue;
      }

      return absoluteUrl;
    }
  }

  return "";
};

const parseRecruitId = async (
  card: Locator,
  jobUrl: string,
): Promise<string> => {
  const id = normalizeText(await card.getAttribute("id").catch(() => ""));
  const cardMatch = id.match(/^rec-(\d+)$/);
  if (cardMatch?.[1]) {
    return cardMatch[1];
  }

  try {
    const url = new URL(jobUrl);
    const recIdx = url.searchParams.get("rec_idx");
    if (recIdx) {
      return recIdx;
    }
  } catch {
    // Fallback to regex below.
  }

  return jobUrl.match(/[?&]rec_idx=(\d+)/)?.[1] ?? "";
};

const parseTitle = async (
  card: Locator,
  companyName: string,
): Promise<string> => {
  for (const selector of titleSelectors) {
    const candidates = await textsBySelector(card, selector);
    const title = candidates.find((text) => text !== companyName);
    if (title) {
      return title;
    }
  }

  return "";
};

export const parseJobCard = async (
  card: Locator,
  sourceUrl: string,
): Promise<JobPosting | null> => {
  try {
    const companyName = cleanCompanyName(
      await textBySelectors(card, companyNameSelectors),
    );
    const title = await parseTitle(card, companyName);
    const jobUrl = await hrefBySelectors(card, jobUrlSelectors, {
      rejectCompanyInfo: true,
    });

    if (!jobUrl || isCompanyInfoUrl(jobUrl)) {
      console.warn("공고 URL을 찾지 못해 목록 카드를 건너뜁니다.");
      return null;
    }

    if (!title) {
      console.warn("공고 제목을 찾지 못해 목록 카드를 건너뜁니다.");
      return null;
    }

    const recruitId = await parseRecruitId(card, jobUrl);

    return {
      recruit_id: recruitId,
      company_name: companyName,
      title,
      job_meta: await joinedTextBySelectors(card, jobMetaSelectors),
      location: await textBySelectors(card, locationSelectors),
      career: await textBySelectors(card, careerSelectors),
      education: await textBySelectors(card, educationSelectors),
      job_url: jobUrl,
      company_url: await hrefBySelectors(card, companyUrlSelectors),
      source_url: sourceUrl,
      scraped_at: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`공고 카드 파싱 실패: ${message}`);
    return null;
  }
};
