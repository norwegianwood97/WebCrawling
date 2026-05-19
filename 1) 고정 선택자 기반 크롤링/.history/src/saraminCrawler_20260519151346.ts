import { Page } from "playwright";
import { clickByCandidates, clickBySelectorCandidates, clickByTextCandidates, clickTextWithinVisibleLayer } from "./clickHelpers.js";
import { filterJobsByCareer, isCareerAllowed } from "./careerFilter.js";
import { parseJobCard } from "./parseJobCard.js";
import { selectors } from "./selectors.js";
import { AppConfig, CareerUiResult, ClickCandidate, JobPosting } from "./types.js";
import {
  dedupeJobs,
  logStep,
  looksBlocked,
  maybeScreenshot,
  normalizeText,
  printHtmlSnippet,
  randomDelay,
  writeDebugArtifacts
} from "./utils.js";

const waitForPageSettled = async (page: Page): Promise<void> => {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
};

const assertNotBlocked = async (page: Page, config: AppConfig, stepName: string): Promise<void> => {
  if (!await looksBlocked(page)) {
    return;
  }

  await writeDebugArtifacts(page, config, `${stepName} 단계에서 차단 또는 CAPTCHA 의심 화면 감지`);
  throw new Error(`${stepName}: 403/429/CAPTCHA/비정상 접근 의심 화면이 감지되어 즉시 중단합니다.`);
};

const gotoWithSafety = async (page: Page, config: AppConfig, url: string, stepName: string): Promise<void> => {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const status = response?.status();
  if (status === 403 || status === 429) {
    await writeDebugArtifacts(page, config, `${stepName} HTTP ${status}`);
    throw new Error(`${stepName}: HTTP ${status} 응답을 받아 크롤링을 중단합니다.`);
  }

  await waitForPageSettled(page);
  await assertNotBlocked(page, config, stepName);
};

const clickOptionalLayerDone = async (page: Page, stepName: string): Promise<void> => {
  const textResult = await clickByTextCandidates(page, [...selectors.layerDoneButtons], `${stepName} 레이어 닫기`);
  if (textResult.success) {
    return;
  }

  await clickBySelectorCandidates(page, [...selectors.careerCloseButtons], `${stepName} 레이어 닫기`).catch(() => undefined);
};

const openRecruitPage = async (page: Page, config: AppConfig): Promise<void> => {
  logStep(2, "사람인 접속 시도");
  await gotoWithSafety(page, config, config.baseUrl, "사람인 메인 접속");
  await maybeScreenshot(page, config, "01_home.png");
  logStep(2, "사람인 접속 완료");

  logStep(3, "채용정보 메뉴 클릭 시도");
  const clicked = await clickByCandidates(page, [
    { type: "text", value: "채용정보" },
    ...selectors.homeRecruitMenu.map<ClickCandidate>((value) => ({ type: "selector", value }))
  ], "채용정보 메뉴");

  if (clicked.success) {
    await waitForPageSettled(page);
  }

  const hasJobPageSignal = page.url().includes("/jobs/") || page.url().includes("recruit");
  if (!clicked.success || !hasJobPageSignal) {
    console.warn("채용정보 메뉴 이동 확인이 어려워 IT개발·데이터 직업별 URL로 직접 이동합니다.");
    await gotoWithSafety(page, config, config.jobCategoryUrl, "직접 URL 이동");
  }

  await maybeScreenshot(page, config, "02_jobs_page.png");
  logStep(3, "채용정보 페이지 이동 완료");
};

const selectRegionSeoul = async (page: Page, config: AppConfig): Promise<void> => {
  logStep(4, "지역 선택: 서울 전체");
  const openResult = await clickByCandidates(page, [
    { type: "text", value: "지역 선택" },
    { type: "text", value: "지역" },
    ...selectors.regionOpenButtons.map<ClickCandidate>((value) => ({ type: "selector", value }))
  ], "지역 선택 열기");

  if (!openResult.success) {
    throw new Error("지역 선택 버튼을 찾지 못했습니다. src/selectors.ts의 지역 선택 후보를 확인하세요.");
  }

  await page.waitForTimeout(500);
  await maybeScreenshot(page, config, "03_region_layer.png");

  const selectorResult = await clickBySelectorCandidates(page, [...selectors.seoulButtons], "서울 전체 선택");
  const textResult = selectorResult.success
    ? selectorResult
    : await clickTextWithinVisibleLayer(page, ["서울전체", "서울 전체", "서울"], "서울 전체 선택");

  if (!textResult.success) {
    throw new Error("서울 전체 선택 버튼을 찾지 못했습니다. 지역 선택 레이어 구조가 변경되었을 수 있습니다.");
  }

  await page.waitForTimeout(400);
  await clickOptionalLayerDone(page, "지역 선택");
  await randomDelay(config);
};

const isJobCategoryAlreadyApplied = async (page: Page): Promise<boolean> => {
  if (page.url().includes("cat_mcls=2")) {
    return true;
  }

  const bodyText = normalizeText(await page.locator("body").innerText({ timeout: 3000 }).catch(() => ""));
  return /IT개발·데이터/.test(bodyText) && /(전체|선택|직업별|개발)/.test(bodyText);
};

const selectJobCategory = async (page: Page, config: AppConfig): Promise<void> => {
  logStep(5, "직업 선택: IT개발·데이터 확인");
  if (await isJobCategoryAlreadyApplied(page)) {
    console.log("IT개발·데이터 조건이 이미 적용된 것으로 보여 직업 선택 UI 조작을 생략합니다.");
    return;
  }

  const openResult = await clickByCandidates(page, [
    { type: "text", value: "직업 선택" },
    { type: "text", value: "직업" },
    ...selectors.jobOpenButtons.map<ClickCandidate>((value) => ({ type: "selector", value }))
  ], "직업 선택 열기");

  if (!openResult.success) {
    throw new Error("직업 선택 버튼을 찾지 못했습니다. 직업별 URL 적용 여부와 selector를 확인하세요.");
  }

  await page.waitForTimeout(500);
  await maybeScreenshot(page, config, "04_job_layer.png");

  const categoryResult = await clickTextWithinVisibleLayer(page, ["IT개발·데이터"], "IT개발·데이터 대분류 선택");
  if (!categoryResult.success) {
    const fallback = await page.locator("span.txt").filter({ hasText: "IT개발·데이터" }).first().click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!fallback) {
      throw new Error("IT개발·데이터 대분류를 찾지 못했습니다.");
    }
  }

  await page.waitForTimeout(400);
  const allSelected = await clickBySelectorCandidates(page, [...selectors.jobAllSelect], "IT개발·데이터 전체선택");
  if (!allSelected.success) {
    const textSelected = await clickTextWithinVisibleLayer(page, ["IT개발·데이터 전체선택", "전체선택"], "IT개발·데이터 전체선택");
    if (!textSelected.success) {
      throw new Error("IT개발·데이터 전체선택 버튼을 찾지 못했습니다.");
    }
  }

  await page.waitForTimeout(400);
  await clickOptionalLayerDone(page, "직업 선택");
  await randomDelay(config);
};

const labelTextForCareerCheckbox = async (page: Page): Promise<string> => {
  const explicitLabel = normalizeText(await page.locator('label[for="btn_check_career_over0"]').innerText({ timeout: 1500 }).catch(() => ""));
  if (explicitLabel) {
    return explicitLabel;
  }

  const checkbox = page.locator(selectors.careerCheckbox).first();
  return normalizeText(await checkbox.locator("xpath=ancestor::*[self::li or self::label or self::span][1]").innerText({ timeout: 1500 }).catch(() => ""));
};

const selectCareer = async (page: Page, config: AppConfig): Promise<CareerUiResult> => {
  logStep(6, "경력 선택 시도");
  const opened = await clickByCandidates(page, [
    { type: "text", value: "경력선택" },
    { type: "text", value: "경력 선택" },
    { type: "text", value: "경력" },
    ...selectors.careerOpenButtons.map<ClickCandidate>((value) => ({ type: "selector", value }))
  ], "경력 선택 열기");

  if (!opened.success) {
    return { attempted: true, selected: false, reason: "경력 선택 버튼을 찾지 못해 후처리 필터링만 사용합니다." };
  }

  await page.waitForTimeout(500);
  const labelText = await labelTextForCareerCheckbox(page);
  console.log(`#btn_check_career_over0 연결 label 텍스트: ${labelText || "(확인 실패)"}`);

  if (labelText && /(~\s*1년|1년\s*이하|1년\s*미만|1년|경력\s*1년)/.test(labelText)) {
    await page.locator(selectors.careerCheckbox).first().click({ timeout: 5000 });
    await clickOptionalLayerDone(page, "경력 선택");
    await randomDelay(config);
    return { attempted: true, selected: true, reason: `확인된 label 텍스트: ${labelText}` };
  }

  const textResult = await clickTextWithinVisibleLayer(page, ["~1년", "1년 이하", "1년 미만", "경력 1년", "1년"], "경력 ~1년 선택");
  await clickOptionalLayerDone(page, "경력 선택");
  await randomDelay(config);

  if (textResult.success) {
    return { attempted: true, selected: true, reason: `텍스트 후보로 선택: ${textResult.value ?? ""}` };
  }

  return {
    attempted: true,
    selected: false,
    reason: `#btn_check_career_over0 의미가 불확실하여 UI 선택은 건너뜁니다. label="${labelText}"`
  };
};

const clickSearch = async (page: Page, config: AppConfig): Promise<void> => {
  logStep(7, "검색 버튼 클릭");
  const selectorClicked = await clickBySelectorCandidates(page, [...selectors.searchButtons], "검색 버튼");
  const clicked = selectorClicked.success
    ? selectorClicked
    : await clickByTextCandidates(page, ["검색하기"], "검색 버튼");

  if (!clicked.success) {
    throw new Error("검색 버튼을 찾지 못했습니다.");
  }

  await waitForPageSettled(page);
  await maybeScreenshot(page, config, "05_after_search.png");
  await assertNotBlocked(page, config, "검색 버튼 클릭 후");
};

const waitForResults = async (page: Page, config: AppConfig): Promise<string> => {
  logStep(8, "결과 목록 로딩 대기");
  for (const selector of selectors.jobCards) {
    const locator = page.locator(selector);
    try {
      await locator.first().waitFor({ state: "visible", timeout: 10_000 });
      const count = await locator.count();
      if (count > 0) {
        await maybeScreenshot(page, config, "06_results.png");
        logStep(8, `결과 목록 로딩 완료 (${selector}, ${count}개 후보)`);
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

const collectJobsOnCurrentPage = async (page: Page, selector: string, limit: number): Promise<JobPosting[]> => {
  const cards = page.locator(selector);
  const count = await cards.count();
  const jobs: JobPosting[] = [];

  for (let index = 0; index < count && jobs.length < limit; index += 1) {
    const card = cards.nth(index);
    try {
      const parsed = await parseJobCard(card, page.url());
      if (parsed) {
        jobs.push(parsed);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`공고 카드 ${index + 1} 파싱 실패: ${message}`);
    }
  }

  return jobs;
};

const firstRecruitKey = async (page: Page, selector: string): Promise<string> => {
  const firstCard = page.locator(selector).first();
  const id = normalizeText(await firstCard.getAttribute("id").catch(() => ""));
  if (id) {
    return id;
  }

  return normalizeText(await firstCard.innerText({ timeout: 2000 }).catch(() => "")).slice(0, 120);
};

const clickNextPage = async (page: Page, currentPage: number, selector: string): Promise<boolean> => {
  const previousFirstKey = await firstRecruitKey(page, selector);

  const nextCandidates = [
    page.getByText("다음", { exact: false }),
    page.locator('a[aria-label="다음"]'),
    page.getByText(String(currentPage + 1), { exact: true })
  ];

  for (const locator of nextCandidates) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (!await item.isVisible().catch(() => false)) {
        continue;
      }

      const className = await item.getAttribute("class").catch(() => "");
      const ariaDisabled = await item.getAttribute("aria-disabled").catch(() => "");
      if (className?.includes("disabled") || ariaDisabled === "true") {
        continue;
      }

      await item.click({ timeout: 5000 });
      await waitForPageSettled(page);
      await page.waitForFunction(
        ({ cardSelector, previous }) => {
          const first = document.querySelector(cardSelector);
          const key = first?.id || first?.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) || "";
          return key.length > 0 && key !== previous;
        },
        { cardSelector: selector, previous: previousFirstKey },
        { timeout: 10_000 }
      ).catch(() => undefined);
      return true;
    }
  }

  return false;
};

export const crawlSaraminJobs = async (page: Page, config: AppConfig): Promise<JobPosting[]> => {
  logStep(1, "브라우저 실행");
  await openRecruitPage(page, config);
  await selectRegionSeoul(page, config);
  await selectJobCategory(page, config);
  const careerResult = await selectCareer(page, config);
  console.log(`경력 UI 선택 결과: ${careerResult.selected ? "성공" : "후처리 필터 사용"} (${careerResult.reason})`);
  await clickSearch(page, config);

  let resultSelector = await waitForResults(page, config);
  let allJobs: JobPosting[] = [];

  for (let pageNumber = 1; pageNumber <= config.maxPages && allJobs.length < config.maxItems; pageNumber += 1) {
    resultSelector = await waitForResults(page, config);
    const remaining = config.maxItems - allJobs.length;
    const pageJobs = await collectJobsOnCurrentPage(page, resultSelector, remaining);
    logStep(9, `${pageNumber}페이지 공고 ${pageJobs.length}개 발견`);

    const filtered = filterJobsByCareer(pageJobs);
    logStep(10, `경력 필터 통과 ${filtered.length}개`);
    allJobs = dedupeJobs([...allJobs, ...filtered]).slice(0, config.maxItems);

    if (allJobs.length >= config.maxItems || pageNumber >= config.maxPages) {
      break;
    }

    const moved = await clickNextPage(page, pageNumber, resultSelector);
    if (!moved) {
      console.log("다음 페이지 버튼이 없어 수집을 종료합니다.");
      break;
    }

    await randomDelay(config);
    await assertNotBlocked(page, config, "페이지네이션 후");
  }

  const excludedCount = allJobs.filter((job) => !isCareerAllowed(job.career)).length;
  if (excludedCount > 0) {
    console.warn(`중복 제거 후 경력 조건 불일치 ${excludedCount}개가 감지되었습니다.`);
  }

  return allJobs;
};
