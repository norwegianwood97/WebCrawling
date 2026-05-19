import { Locator } from "playwright";
import { JobPosting } from "./types.js";
import { normalizeText, toAbsoluteUrl } from "./utils.js";

const textBySelectors = async (card: Locator, selectors: string[]): Promise<string> => {
  for (const selector of selectors) {
    const locator = card.locator(selector).first();
    if (await locator.count().catch(() => 0) === 0) {
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
    const locator = card.locator(selector).first();
    if (await locator.count().catch(() => 0) === 0) {
      continue;
    }

    const href = normalizeText(await locator.getAttribute("href", { timeout: 1500 }).catch(() => ""));
    if (href) {
      return href;
    }
  }

  return "";
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

const parseMetaFields = async (card: Locator): Promise<Pick<JobPosting, "career" | "location" | "education" | "employment_type">> => {
  const metaText = await textBySelectors(card, [
    ".job_condition",
    ".recruit_info .job_condition",
    ".support_info",
    ".recruit_condition",
    ".corp_info",
    ".col.recruit_info"
  ]);

  const parts = metaText
    .split(/\n|·|\|/)
    .map((part) => normalizeText(part))
    .filter(Boolean);

  const findPart = (patterns: RegExp[]): string => parts.find((part) => patterns.some((pattern) => pattern.test(part))) ?? "";

  return {
    career: findPart([/신입/, /경력/, /년/, /무관/]),
    location: findPart([/서울/, /경기/, /인천/, /부산/, /대구/, /광주/, /대전/, /울산/, /세종/, /제주/, /전국/]),
    education: findPart([/학력/, /졸업/, /대졸/, /초대졸/, /고졸/, /무관/]),
    employment_type: findPart([/정규직/, /계약직/, /인턴/, /프리랜서/, /파견/, /위촉/, /아르바이트/])
  };
};

export const parseJobCard = async (card: Locator, sourceUrl: string): Promise<JobPosting | null> => {
  const jobHref = await hrefBySelectors(card, [
    "a.str_tit",
    ".job_tit a",
    ".recruit_tit a",
    ".item_recruit a",
    'a[href*="rec_idx="]',
    'a[href*="/zf_user/jobs/relay/"]'
  ]);
  const jobUrl = toAbsoluteUrl(jobHref);

  const companyHref = await hrefBySelectors(card, [
    ".company_nm a",
    ".corp_name a",
    ".area_corp a",
    'a[href*="/zf_user/company-info/"]'
  ]);

  const companyName = await textBySelectors(card, [
    ".company_nm",
    ".corp_name",
    ".area_corp",
    ".col.company_nm"
  ]);

  const title = await textBySelectors(card, [
    "a.str_tit",
    ".job_tit a",
    ".recruit_tit a",
    ".area_job .tit",
    ".item_recruit a"
  ]);

  if (!jobUrl && !title) {
    return null;
  }

  const recruitId = await parseRecruitId(card, jobUrl);
  const meta = await parseMetaFields(card);

  const deadline = await textBySelectors(card, [
    ".support_detail .date",
    ".deadlines",
    ".date",
    ".support_info .date",
    ".job_date"
  ]);

  return {
    recruit_id: recruitId,
    company_name: companyName,
    title,
    career: meta.career,
    location: meta.location,
    education: meta.education,
    employment_type: meta.employment_type,
    deadline,
    job_url: jobUrl,
    company_url: toAbsoluteUrl(companyHref),
    source_url: sourceUrl,
    scraped_at: new Date().toISOString()
  };
};
