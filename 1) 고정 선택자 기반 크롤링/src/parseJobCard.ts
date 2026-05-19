import { Locator } from "playwright";
import { JobPosting } from "./types.js";
import { normalizeText, toAbsoluteUrl } from "./utils.js";

interface AnchorCandidate {
  selector: string;
  href: string;
  text: string;
}

const jobAnchorSelectors = [
  'a[href*="/zf_user/jobs/relay/view"]',
  'a[href*="rec_idx="]',
  'a[href*="/jobs/view"]'
];

const companyAnchorSelectors = [
  ".company_nm a",
  ".corp_name a",
  ".area_corp a",
  ".col.company_nm a",
  'a[href*="/zf_user/company-info/"]'
];

const companyNameSelectors = [
  ".company_nm",
  ".corp_name",
  ".area_corp",
  ".col.company_nm"
];

const deadlineSelectors = [
  ".support_detail .date",
  ".deadlines",
  ".date",
  ".support_info .date",
  ".job_date"
];

const textBySelectors = async (
  card: Locator,
  selectors: string[],
): Promise<string> => {
  for (const selector of selectors) {
    const locator = card.locator(selector).first();
    if ((await locator.count().catch(() => 0)) === 0) {
      continue;
    }

    const text = normalizeText(
      await locator.innerText({ timeout: 1500 }).catch(() => ""),
    );
    if (text) {
      return text;
    }
  }

  return "";
};

const hrefBySelectors = async (
  card: Locator,
  selectors: string[],
): Promise<string> => {
  for (const selector of selectors) {
    const locators = card.locator(selector);
    const count = await locators.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const locator = locators.nth(index);
      const href = normalizeText(
        await locator.getAttribute("href", { timeout: 1500 }).catch(() => ""),
      );
      if (href) {
        return href;
      }
    }
  }

  return "";
};

const isInvalidJobUrl = (url: string): boolean => {
  return !url || url.includes("company-info/view-inner-recruit");
};

const findJobAnchor = async (card: Locator): Promise<AnchorCandidate | null> => {
  for (const selector of jobAnchorSelectors) {
    const locators = card.locator(selector);
    const count = await locators.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const locator = locators.nth(index);
      const href = toAbsoluteUrl(
        await locator.getAttribute("href", { timeout: 1500 }).catch(() => ""),
      );

      if (isInvalidJobUrl(href)) {
        continue;
      }

      const text = normalizeText(
        await locator.innerText({ timeout: 1500 }).catch(() => ""),
      );

      if (href && text) {
        return { selector, href, text };
      }
    }
  }

  return null;
};

const parseRecruitId = async (
  card: Locator,
  jobUrl: string,
): Promise<string> => {
  const id = normalizeText(await card.getAttribute("id").catch(() => ""));
  const idMatch = id.match(/rec-(\d+)/);
  if (idMatch?.[1]) {
    return idMatch[1];
  }

  const urlMatch = jobUrl.match(/rec_idx=(\d+)/) ?? jobUrl.match(/rec-(\d+)/);
  return urlMatch?.[1] ?? "";
};

const parseMetaFields = async (
  card: Locator,
): Promise<
  Pick<JobPosting, "career" | "location" | "education" | "employment_type">
> => {
  const selectorCandidates = [
    ".job_condition",
    ".recruit_info .job_condition",
    ".recruit_info",
    ".support_info",
    ".recruit_condition",
    ".corp_info",
    ".col.recruit_info",
    ".job_meta",
    ".condition",
    ".area_job"
  ];

  const chunks: string[] = [];

  for (const selector of selectorCandidates) {
    const locators = card.locator(selector);
    const count = await locators.count().catch(() => 0);

    for (let index = 0; index < Math.min(count, 5); index += 1) {
      const text = normalizeText(
        await locators
          .nth(index)
          .innerText({ timeout: 1000 })
          .catch(() => ""),
      );

      if (text) {
        chunks.push(text);
      }
    }
  }

  // DOM이 바뀌어 세부 selector가 빗나가도 카드 전체 텍스트에서 조건을 보조 추출합니다.
  const fullCardText = normalizeText(
    await card.innerText({ timeout: 1500 }).catch(() => ""),
  );

  if (fullCardText) {
    chunks.push(fullCardText);
  }

  const text = normalizeText(chunks.join(" "));

  const matchFirst = (patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const matched = text.match(pattern);
      if (matched?.[0]) {
        return normalizeText(matched[0]);
      }
    }

    return "";
  };

  return {
    career: matchFirst([
      /경력무관/,
      /신입\s*\/\s*경력/,
      /신입/,
      /경력\s*\d+\s*년\s*(?:↑|이상|이하|미만)?/,
      /~\s*1년/,
      /1년\s*(?:이하|미만)/,
      /0\s*~\s*1년/
    ]),
    location: matchFirst([
      /서울\s*전체/,
      /서울\s*[가-힣]+구/,
      /서울/,
      /경기/,
      /인천/,
      /부산/,
      /대구/,
      /광주/,
      /대전/,
      /울산/,
      /세종/,
      /제주/,
      /전국/
    ]),
    education: matchFirst([
      /학력무관/,
      /고졸/,
      /초대졸/,
      /대졸/,
      /석사/,
      /박사/,
      /졸업/
    ]),
    employment_type: matchFirst([
      /정규직/,
      /계약직/,
      /인턴/,
      /프리랜서/,
      /파견직/,
      /위촉직/,
      /아르바이트/,
      /병역특례/
    ])
  };
};

const cleanCompanyName = (value: string): string => {
  return normalizeText(value.replace(/\s*관심기업\s*등록\s*/g, " "));
};

const logTitleMismatchDebug = async (
  card: Locator,
  title: string,
  companyName: string,
): Promise<void> => {
  const fullText = normalizeText(
    await card.innerText({ timeout: 1500 }).catch(() => ""),
  );

  console.warn("공고 카드 파싱 실패: title과 company_name이 동일합니다.");
  console.warn(`title="${title}", company_name="${companyName}"`);
  console.warn(`공고 링크 후보 selector: ${jobAnchorSelectors.join(", ")}`);
  console.warn(`회사명 후보 selector: ${companyNameSelectors.join(", ")}`);
  console.warn(`카드 전체 텍스트: ${fullText}`);
};

export const parseJobCard = async (
  card: Locator,
  sourceUrl: string,
): Promise<JobPosting | null> => {
  const jobAnchor = await findJobAnchor(card);
  const jobUrl = jobAnchor?.href ?? "";
  const title = normalizeText(jobAnchor?.text ?? "");

  if (!jobUrl || !title || isInvalidJobUrl(jobUrl)) {
    const fullText = normalizeText(
      await card.innerText({ timeout: 1500 }).catch(() => ""),
    );
    console.warn("공고 상세 링크 또는 제목을 찾지 못해 카드를 건너뜁니다.");
    console.warn(`공고 링크 후보 selector: ${jobAnchorSelectors.join(", ")}`);
    console.warn(`카드 전체 텍스트: ${fullText}`);
    return null;
  }

  const companyHref = await hrefBySelectors(card, companyAnchorSelectors);
  const companyName = cleanCompanyName(
    await textBySelectors(card, companyNameSelectors),
  );

  if (title && companyName && title === companyName) {
    await logTitleMismatchDebug(card, title, companyName);
    return null;
  }

  const recruitId = await parseRecruitId(card, jobUrl);
  const meta = await parseMetaFields(card);
  const deadline = await textBySelectors(card, deadlineSelectors);

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
    scraped_at: new Date().toISOString(),
    main_tasks: "",
    requirements: "",
    preferred: "",
    hiring_process: "",
    benefits: "",
    work_conditions: "",
    tech_stack: "",
    detail_text: "",
    detail_error: "",
  };
};
