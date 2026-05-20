import { AgentHistoryItem, PageObservation } from "./types.js";

const goal = `
사람인 공개 채용공고 목록에서 다음 조건을 설정한다.
- 채용정보 섹션
- 지역: 서울 전체
- 직업: IT개발·데이터
- 직업 세부: IT개발·데이터 전체선택
- 경력: ~1년 또는 1년차 지원 가능 공고

메인 페이지에서 채용 목록 진입이 어렵다면 다음 사람인 직업별 목록 URL로 이동할 수 있다.
https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2
`;

const safetyRules = `
안전 규칙:
- 공식 사람인 Open API는 사용하지 않는다.
- 로그인, 인증, CAPTCHA 우회, 차단 우회, 프록시, 과도한 새로고침을 절대 제안하지 않는다.
- 공개 접근 가능한 채용공고 목록/상세 페이지만 다룬다.
- CAPTCHA, 403, 429, 비정상 접근 화면이면 우회하지 말고 stop 또는 extract_results 중 적절한 행동을 선택한다.
- 고정 selector를 외워서 쓰지 말고, 현재 관찰된 페이지 상태를 보고 다음 한 단계만 결정한다.
`;

const schema = `
반드시 JSON 객체 하나만 반환한다. 설명 문장, Markdown, 코드블록은 금지한다.
허용 action: goto, click_text, click_selector, fill_text, press, wait, extract_results, stop

JSON schema:
{
  "action": "goto|click_text|click_selector|fill_text|press|wait|extract_results|stop",
  "target": "클릭하거나 입력할 대상 텍스트. 필요한 경우만",
  "selector": "관찰된 selector. 필요한 경우만",
  "url": "goto에만 사용. saramin.co.kr URL만",
  "text": "fill_text에 입력할 값. 필요한 경우만",
  "key": "press에 사용할 키. 필요한 경우만",
  "ms": 1000,
  "reason": "왜 이 한 단계를 선택했는지",
  "confidence": 0.0
}
`;

const missingConditions = (observation: PageObservation): string[] => {
  const missing: string[] = [];
  if (!observation.progress.regionSelected) {
    missing.push("지역 서울 전체");
  }
  if (!observation.progress.jobCategorySelected) {
    missing.push("직업 IT개발·데이터");
  }
  if (!observation.progress.careerSelected) {
    missing.push("경력 ~1년 또는 신입/1년차 가능");
  }
  if (!observation.progress.resultListVisible) {
    missing.push("채용공고 결과 목록");
  }

  return missing;
};

export const buildPrompt = (
  observation: PageObservation,
  history: AgentHistoryItem[],
  failedHistory: AgentHistoryItem[],
): string => {
  const completed = Object.entries(observation.progress)
    .filter(([key, value]) => key !== "blockedOrCaptchaLikely" && value)
    .map(([key]) => key);

  return [
    goal,
    safetyRules,
    schema,
    `현재 URL: ${observation.currentUrl}`,
    `현재 title: ${observation.title}`,
    `현재 완료된 조건 추정: ${completed.length ? completed.join(", ") : "없음"}`,
    `아직 필요한 조건: ${missingConditions(observation).join(", ") || "없음"}`,
    `차단/CAPTCHA 의심: ${observation.progress.blockedOrCaptchaLikely}`,
    `스크린샷 경로: ${observation.screenshotPath || "없음"}`,
    `클릭 가능한 버튼 후보:\n${JSON.stringify(observation.buttons, null, 2)}`,
    `클릭 가능한 링크 후보:\n${JSON.stringify(observation.links, null, 2)}`,
    `입력 후보:\n${JSON.stringify(observation.inputs, null, 2)}`,
    `candidate selectors:\n${JSON.stringify(observation.candidateSelectors, null, 2)}`,
    `현재 본문 일부:\n${observation.bodyText}`,
    `이전 행동 기록:\n${JSON.stringify(history.slice(-10), null, 2)}`,
    `실패한 행동 기록:\n${JSON.stringify(failedHistory.slice(-10), null, 2)}`,
    "다음 한 단계만 결정하라.",
    "지역, 직업, 경력 조건이 모두 준비되고 채용 목록 결과 페이지가 보일 때만 extract_results를 반환하라.",
    "resultListVisible=false 상태에서 wait를 2번 이상 반복하지 마라.",
    "현재 URL이 /zf_user/jobs/list/domestic 이고 resultListVisible=false이면, https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2 로 goto하라.",
    "조건이 모두 준비되었지만 resultListVisible=false이면 검색하기 버튼을 클릭하라.",
    "검색하기 버튼 후보는 '검색하기', '#search_btn', 'button.btn_search.active' 순서로 판단하라.",
  ].join("\n\n");
};
