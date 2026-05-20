import { BrowserContext, Locator, Page } from "playwright";
import {
  clickByCandidates,
  clickBySelectorCandidates,
  clickByTextCandidates,
  clickTextWithinVisibleLayer,
} from "./clickHelpers.js";
import { filterJobsByCareer } from "./careerFilter.js";
import { parseJobCard } from "./parseJobCard.js";
import { selectors } from "./selectors.js";
import {
  AppConfig,
  CareerUiResult,
  ClickCandidate,
  JobPosting,
} from "./types.js";
import {
  dedupeJobs,
  logStep,
  looksBlocked,
  maybeScreenshot,
  normalizeText,
  printHtmlSnippet,
  randomDelay,
  writeDebugArtifacts,
} from "./utils.js";

interface PageCollectionResult {
  cardCount: number;
  jobs: JobPosting[];
}

interface SearchClickResult {
  clicked: boolean;
  description: string;
}

const paginationSelector = "#default_list_wrap > div";
const defaultPageSize = 50;
const unexpectedJobPopupPattern = /\/zf_user\/jobs\/relay\/view/i;

const selectorCandidates = (
  values: readonly string[],
): ClickCandidate[] => values.map((value) => ({ type: "selector", value }));

const waitForPageSettled = async (page: Page): Promise<void> => {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page
    .waitForLoadState("networkidle", { timeout: 8000 })
    .catch(() => undefined);
};

const assertNotBlocked = async (
  page: Page,
  config: AppConfig,
  stepName: string,
): Promise<void> => {
  if (!(await looksBlocked(page))) {
    return;
  }

  await writeDebugArtifacts(page, config, `${stepName} 차단 또는 CAPTCHA 의심 화면 감지`);
  throw new Error(`${stepName}: 403/429/CAPTCHA/비정상 접근 의심 화면이 감지되어 중단합니다.`);
};

const gotoWithSafety = async (
  page: Page,
  config: AppConfig,
  url: string,
  stepName: string,
): Promise<void> => {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  const status = response?.status();
  if (status === 403 || status === 429) {
    await writeDebugArtifacts(page, config, `${stepName} HTTP ${status}`);
    throw new Error(`${stepName}: HTTP ${status} 응답을 받아 크롤링을 중단합니다.`);
  }

  await waitForPageSettled(page);
  await assertNotBlocked(page, config, stepName);
};

const clickOptionalLayerDone = async (
  page: Page,
  stepName: string,
): Promise<void> => {
  const textResult = await clickByTextCandidates(
    page,
    [...selectors.layerDoneButtons],
    `${stepName} 레이어 닫기`,
  );
  if (textResult.success) {
    return;
  }

  await clickBySelectorCandidates(
    page,
    [...selectors.careerCloseButtons],
    `${stepName} 레이어 닫기`,
  ).catch(() => undefined);
};

const openRecruitPage = async (
  page: Page,
  config: AppConfig,
): Promise<void> => {
  logStep(2, "사람인 접속");
  await gotoWithSafety(page, config, config.baseUrl, "사람인 메인 접속");
  await maybeScreenshot(page, config, "01_home.png");

  logStep(3, "IT개발·데이터 직업별 페이지 이동");
  await gotoWithSafety(
    page,
    config,
    config.jobCategoryUrl,
    "IT개발·데이터 직업별 URL 이동",
  );
  await maybeScreenshot(page, config, "02_jobs_page.png");

  if (!page.url().includes("cat_mcls=2")) {
    console.warn(`IT개발·데이터 직업 조건이 URL에 보이지 않습니다. 현재 URL: ${page.url()}`);
  }
};

const selectRegionSeoul = async (
  page: Page,
  config: AppConfig,
): Promise<void> => {
  logStep(4, "지역 선택: 서울 전체");
  const openResult = await clickByCandidates(
    page,
    [
      { type: "text", value: "지역 선택" },
      { type: "text", value: "지역" },
      ...selectorCandidates(selectors.regionOpenButtons),
    ],
    "지역 선택 열기",
  );

  if (!openResult.success) {
    throw new Error("지역 선택 버튼을 찾지 못했습니다. src/selectors.ts의 지역 selector를 확인하세요.");
  }

  await page.waitForTimeout(500);
  await maybeScreenshot(page, config, "03_region_layer.png");

  const selectorResult = await clickBySelectorCandidates(
    page,
    [...selectors.seoulButtons],
    "서울 전체 선택",
  );
  const textResult = selectorResult.success
    ? selectorResult
    : await clickTextWithinVisibleLayer(
        page,
        ["서울전체", "서울 전체", "서울"],
        "서울 전체 선택",
      );

  if (!textResult.success) {
    throw new Error("서울 전체 선택 버튼을 찾지 못했습니다. 지역 선택 레이어 구조가 바뀌었을 수 있습니다.");
  }

  await page.waitForTimeout(400);
  await clickOptionalLayerDone(page, "지역 선택");
  await randomDelay(config);
};

const isJobCategoryAlreadyApplied = async (page: Page): Promise<boolean> => {
  return page.url().includes("cat_mcls=2");
};

const selectJobCategory = async (
  page: Page,
  config: AppConfig,
): Promise<void> => {
  logStep(5, "직업 선택 확인");
  if (await isJobCategoryAlreadyApplied(page)) {
    console.log("URL에 cat_mcls=2가 있어 IT개발·데이터 직업 조건이 적용된 것으로 판단합니다.");
    return;
  }

  const openResult = await clickByCandidates(
    page,
    [
      { type: "text", value: "직업 선택" },
      { type: "text", value: "직업" },
      ...selectorCandidates(selectors.jobOpenButtons),
    ],
    "직업 선택 열기",
  );

  if (!openResult.success) {
    throw new Error("직업 선택 버튼을 찾지 못했습니다. 직업별 URL 적용 여부와 selector를 확인하세요.");
  }

  await page.waitForTimeout(500);
  await maybeScreenshot(page, config, "04_job_layer.png");

  const categoryResult = await clickTextWithinVisibleLayer(
    page,
    ["IT개발·데이터"],
    "IT개발·데이터 대분류 선택",
  );
  if (!categoryResult.success) {
    const fallback = await page
      .locator("span.txt")
      .filter({ hasText: "IT개발·데이터" })
      .first()
      .click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!fallback) {
      throw new Error("IT개발·데이터 대분류를 찾지 못했습니다.");
    }
  }

  await page.waitForTimeout(400);
  const allSelected = await clickBySelectorCandidates(
    page,
    [...selectors.jobAllSelect],
    "IT개발·데이터 전체선택",
  );
  if (!allSelected.success) {
    const textSelected = await clickTextWithinVisibleLayer(
      page,
      ["IT개발·데이터 전체선택", "전체선택"],
      "IT개발·데이터 전체선택",
    );
    if (!textSelected.success) {
      throw new Error("IT개발·데이터 전체선택 버튼을 찾지 못했습니다.");
    }
  }

  await page.waitForTimeout(400);
  await clickOptionalLayerDone(page, "직업 선택");
  await randomDelay(config);
};

const labelTextForCareerCheckbox = async (page: Page): Promise<string> => {
  const explicitLabel = normalizeText(
    await page
      .locator('label[for="btn_check_career_over0"]')
      .innerText({ timeout: 1500 })
      .catch(() => ""),
  );
  if (explicitLabel) {
    return explicitLabel;
  }

  const checkbox = page.locator(selectors.careerCheckbox).first();
  return normalizeText(
    await checkbox
      .locator("xpath=ancestor::*[self::li or self::label or self::span][1]")
      .innerText({ timeout: 1500 })
      .catch(() => ""),
  );
};

const selectCareer = async (
  page: Page,
  config: AppConfig,
): Promise<CareerUiResult> => {
  logStep(6, "경력 선택: ~1년");
  const opened = await clickByCandidates(
    page,
    [
      { type: "text", value: "경력선택" },
      { type: "text", value: "경력 선택" },
      { type: "text", value: "경력" },
      ...selectorCandidates(selectors.careerOpenButtons),
    ],
    "경력 선택 열기",
  );

  if (!opened.success) {
    return {
      attempted: true,
      selected: false,
      reason: "경력 선택 버튼을 찾지 못해 후처리 필터만 사용합니다.",
    };
  }

  await page.waitForTimeout(500);
  const labelText = await labelTextForCareerCheckbox(page);
  console.log(`#btn_check_career_over0 연결 label 텍스트: ${labelText || "(확인 실패)"}`);

  if (
    labelText &&
    /(~\s*1년|1년\s*이하|1년\s*미만|경력\s*1년)/.test(labelText)
  ) {
    await page
      .locator(selectors.careerCheckbox)
      .first()
      .click({ timeout: 5000 });
    await clickOptionalLayerDone(page, "경력 선택");
    await randomDelay(config);
    return {
      attempted: true,
      selected: true,
      reason: `확인된 label 텍스트: ${labelText}`,
    };
  }

  const textResult = await clickTextWithinVisibleLayer(
    page,
    ["~1년", "1년 이하", "1년 미만", "경력 1년", "1년"],
    "경력 ~1년 선택",
  );
  await clickOptionalLayerDone(page, "경력 선택");
  await randomDelay(config);

  if (textResult.success) {
    return {
      attempted: true,
      selected: true,
      reason: `텍스트 후보로 선택: ${textResult.value ?? ""}`,
    };
  }

  return {
    attempted: true,
    selected: false,
    reason: `#btn_check_career_over0 후보가 불확실하여 UI 선택은 건너뜁니다. label="${labelText}"`,
  };
};

const clickSearch = async (page: Page, config: AppConfig): Promise<void> => {
  logStep(7, "검색 버튼 클릭");

  const popupCloser = closeUnexpectedJobPopups(page.context());
  const clickResult = await dispatchSearchButtonClick(page);
  await popupCloser.stop();

  if (!clickResult.clicked) {
    throw new Error("검색 버튼을 찾지 못했습니다.");
  }
  console.log(`검색 버튼 클릭 대상: ${clickResult.description}`);

  await waitForPageSettled(page);
  await maybeScreenshot(page, config, "05_after_search.png");
  await assertNotBlocked(page, config, "검색 버튼 클릭 후");
};

const dispatchSearchButtonClick = async (page: Page): Promise<SearchClickResult> => {
  return page
    .evaluate((buttonSelectors) => {
      const candidates = buttonSelectors
        .flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
        .filter((element, index, elements) => elements.indexOf(element) === index);

      const searchButton = candidates.find((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          element.matches("div#sp_preview button#search_btn")
        );
      });

      if (!searchButton) {
        return {
          clicked: false,
          description: "not-found",
        };
      }

      const text = (searchButton.textContent ?? "").replace(/\s+/g, " ").trim();
      const description = [
        searchButton.tagName.toLowerCase(),
        searchButton.id ? `#${searchButton.id}` : "",
        searchButton.className ? `.${String(searchButton.className).trim().replace(/\s+/g, ".")}` : "",
        text ? `text="${text}"` : "",
      ]
        .filter(Boolean)
        .join("");

      searchButton.click();
      return {
        clicked: true,
        description,
      };
    }, [...selectors.searchButtons]);
};

const closeUnexpectedJobPopups = (
  context: BrowserContext,
): { stop: () => Promise<void> } => {
  const openedPages: Page[] = [];
  const handler = (popup: Page): void => {
    openedPages.push(popup);
    popup
      .waitForLoadState("domcontentloaded", { timeout: 3000 })
      .catch(() => undefined)
      .finally(async () => {
        if (unexpectedJobPopupPattern.test(popup.url())) {
          console.warn(`예상치 못한 공고 새 창을 닫습니다: ${popup.url()}`);
          await popup.close().catch(() => undefined);
        }
      });
  };

  context.on("page", handler);

  return {
    stop: async (): Promise<void> => {
      await new Promise((resolve) => {
        setTimeout(resolve, 1200);
      });
      context.off("page", handler);

      for (const popup of openedPages) {
        if (!popup.isClosed() && unexpectedJobPopupPattern.test(popup.url())) {
          await popup.close().catch(() => undefined);
        }
      }
    },
  };
};

const waitForResults = async (
  page: Page,
  config: AppConfig,
): Promise<string> => {
  for (const selector of selectors.jobCards) {
    const locator = page.locator(selector);
    try {
      await locator.first().waitFor({ state: "visible", timeout: 10_000 });
      const count = await locator.count();
      if (count > 0) {
        await maybeScreenshot(page, config, "06_results.png");
        logStep(8, "결과 목록 로딩 완료");
        return selector;
      }
    } catch {
      // 다음 selector 후보를 시도합니다.
    }
  }

  console.error(`현재 URL: ${page.url()}`);
  console.error(`페이지 제목: ${await page.title().catch(() => "제목 확인 실패")}`);
  await printHtmlSnippet(page);
  await writeDebugArtifacts(page, config, "결과 목록 selector 실패");
  throw new Error("결과 목록을 찾지 못했습니다. src/selectors.ts의 jobCards 후보를 확인하세요.");
};

const collectJobsOnCurrentPage = async (
  page: Page,
  selector: string,
): Promise<PageCollectionResult> => {
  const cards = page.locator(selector);
  const cardCount = await cards.count();
  const jobs: JobPosting[] = [];

  for (let index = 0; index < cardCount; index += 1) {
    const parsed = await parseJobCard(cards.nth(index), page.url());
    if (parsed) {
      jobs.push(parsed);
    }
  }

  return { cardCount, jobs };
};

const getSearchResultCount = async (page: Page): Promise<number> => {
  const rawText = normalizeText(
    await page.locator("#sp_preview_total_cnt").innerText({ timeout: 3000 }).catch(() => ""),
  );
  const parsed = Number.parseInt(rawText.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const firstRecruitKey = async (
  page: Page,
  selector: string,
): Promise<string> => {
  const firstCard = page.locator(selector).first();
  const id = normalizeText(await firstCard.getAttribute("id").catch(() => ""));
  if (id) {
    return id;
  }

  return normalizeText(
    await firstCard.innerText({ timeout: 2000 }).catch(() => ""),
  ).slice(0, 120);
};

const getPaginationRoot = (page: Page) => page.locator(paginationSelector).last();

const waitForPageChanged = async (
  page: Page,
  selector: string,
  previousFirstKey: string,
): Promise<boolean> => {
  await waitForPageSettled(page);
  return page
    .waitForFunction(
      ({ cardSelector, previous }) => {
        const first = document.querySelector(cardSelector);
        const key =
          first?.id ||
          first?.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) ||
          "";
        return key.length > 0 && key !== previous;
      },
      { cardSelector: selector, previous: previousFirstKey },
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false);
};

const clickVisibleLocator = async (locator: Locator): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (!(await item.isVisible().catch(() => false))) {
      continue;
    }

    const className = await item.getAttribute("class").catch(() => "");
    const ariaDisabled = await item.getAttribute("aria-disabled").catch(() => "");
    if (className?.includes("disabled") || ariaDisabled === "true") {
      continue;
    }

    await item.click({ timeout: 5000 });
    return true;
  }

  return false;
};

const clickPageNumber = async (
  page: Page,
  pageNumber: number,
): Promise<boolean> => {
  const pagination = getPaginationRoot(page);
  const pageButton = pagination.getByText(String(pageNumber), { exact: true });
  return clickVisibleLocator(pageButton);
};

const clickNextPageGroup = async (page: Page): Promise<boolean> => {
  const pagination = getPaginationRoot(page);
  const candidates = [
    pagination.getByText("다음", { exact: false }),
    pagination.locator('a[aria-label="다음"], button[aria-label="다음"]'),
    pagination.locator('a:has-text("다음"), button:has-text("다음")'),
  ];

  for (const candidate of candidates) {
    if (await clickVisibleLocator(candidate)) {
      return true;
    }
  }

  return false;
};

const moveToPage = async (
  page: Page,
  targetPage: number,
  selector: string,
): Promise<boolean> => {
  const previousFirstKey = await firstRecruitKey(page, selector);

  if (await clickPageNumber(page, targetPage)) {
    await waitForPageChanged(page, selector, previousFirstKey);
    return true;
  }

  if (await clickNextPageGroup(page)) {
    if (await waitForPageChanged(page, selector, previousFirstKey)) {
      return true;
    }

    if (await clickPageNumber(page, targetPage)) {
      await waitForPageChanged(page, selector, previousFirstKey);
      return true;
    }

    return false;
  }

  return false;
};

const resolveTargetPageCount = (
  totalCount: number,
  firstPageCardCount: number,
  config: AppConfig,
): number => {
  const pageSize = firstPageCardCount > 0 ? firstPageCardCount : defaultPageSize;
  const pagesFromTotal = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
  const configuredLimit = config.maxPages > 0 ? config.maxPages : Number.POSITIVE_INFINITY;

  if (pagesFromTotal > 0) {
    return Math.min(pagesFromTotal, configuredLimit);
  }

  return configuredLimit;
};

const applyMaxItems = (jobs: JobPosting[], config: AppConfig): JobPosting[] => {
  if (config.maxItems <= 0) {
    return jobs;
  }

  return jobs.slice(0, config.maxItems);
};

const filterJobsWithUiFallback = (
  jobs: JobPosting[],
  careerResult: CareerUiResult,
): JobPosting[] => {
  const filtered = filterJobsByCareer(jobs);
  if (filtered.length > 0 || !careerResult.selected || jobs.length === 0) {
    return filtered;
  }

  console.warn("경력 UI 필터는 성공했지만 카드의 career 텍스트 추출이 비어 있어 UI 필터 결과를 신뢰해 저장합니다.");
  return jobs.map((job) => ({
    ...job,
    career: job.career || "~1년(UI필터)",
  }));
};

const mergeAndLimitJobs = (
  existingJobs: JobPosting[],
  nextJobs: JobPosting[],
  config: AppConfig,
): JobPosting[] => applyMaxItems(dedupeJobs([...existingJobs, ...nextJobs]), config);

export const crawlSaraminJobs = async (
  page: Page,
  config: AppConfig,
): Promise<JobPosting[]> => {
  await openRecruitPage(page, config);
  await selectRegionSeoul(page, config);
  await selectJobCategory(page, config);
  const careerResult = await selectCareer(page, config);
  console.log(
    `경력 UI 선택 결과: ${careerResult.selected ? "성공" : "후처리 필터 사용"} (${careerResult.reason})`,
  );
  await clickSearch(page, config);

  let resultSelector = await waitForResults(page, config);
  const totalCount = await getSearchResultCount(page);
  if (totalCount > 0) {
    console.log(`검색 결과 총 ${totalCount}건 확인`);
  } else {
    console.warn("#sp_preview_total_cnt 값을 찾지 못했습니다. 페이지 버튼이 없어질 때까지 수집합니다.");
  }

  let allJobs: JobPosting[] = [];
  let targetPageCount = 1;

  for (let pageNumber = 1; pageNumber <= targetPageCount; pageNumber += 1) {
    resultSelector = await waitForResults(page, config);
    const { cardCount, jobs: pageJobs } = await collectJobsOnCurrentPage(
      page,
      resultSelector,
    );

    if (pageNumber === 1) {
      targetPageCount = resolveTargetPageCount(totalCount, cardCount, config);
      if (Number.isFinite(targetPageCount)) {
        console.log(`수집 대상 페이지 수: ${targetPageCount}페이지`);
      } else {
        console.log("수집 대상 페이지 수: 페이지 버튼이 없어질 때까지");
      }
    }

    logStep(9, `${pageNumber}페이지 공고 ${cardCount}개 발견`);

    const filtered = filterJobsWithUiFallback(pageJobs, careerResult);
    logStep(10, `경력 필터 통과 ${filtered.length}개`);
    allJobs = mergeAndLimitJobs(allJobs, filtered, config);

    if (config.maxItems > 0 && allJobs.length >= config.maxItems) {
      console.log(`MAX_ITEMS=${config.maxItems}에 도달해 수집을 종료합니다.`);
      break;
    }

    if (pageNumber >= targetPageCount) {
      break;
    }

    const moved = await moveToPage(page, pageNumber + 1, resultSelector);
    if (!moved) {
      console.log("다음 페이지 또는 다음 페이지 그룹 버튼이 없어 수집을 종료합니다.");
      break;
    }

    await randomDelay(config);
    await assertNotBlocked(page, config, "페이지 이동 후");
  }

  logStep(11, `총 저장 공고 ${allJobs.length}개`);
  return allJobs;
};
