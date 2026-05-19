# Saramin 채용공고 UI 크롤러

사람인 공식 Open API를 사용하지 않고, Playwright로 실제 사람인 웹사이트 UI를 조작해 공개 채용공고 목록을 수집하는 Node.js + TypeScript 프로젝트입니다.

로그인, CAPTCHA 우회, 차단 우회, 과도한 요청은 구현하지 않습니다. 공개적으로 접근 가능한 채용공고 목록만 대상으로 하며, 403/429/CAPTCHA 의심 화면이 감지되면 즉시 중단합니다.

## 설치

```bash
npm install
npx playwright install
```

## 실행

개발 실행:

```bash
npm run dev
```

빌드:

```bash
npm run build
```

빌드 결과 실행:

```bash
npm start
```

## 환경변수

`.env.example`을 참고해 `.env` 파일을 만들 수 있습니다. `.env`가 없어도 아래 기본값으로 동작합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `HEADLESS` | `false` | `false`이면 실제 Chromium 창을 띄웁니다. |
| `MAX_ITEMS` | `50` | 최대 저장 공고 수입니다. |
| `MAX_PAGES` | `3` | 최대 탐색 페이지 수입니다. |
| `MAX_DETAIL_PAGES` | `50` | 목록 필터 통과 후 방문할 상세 페이지 최대 수입니다. |
| `OUTPUT_DIR` | `output` | CSV/JSON 저장 폴더입니다. |
| `DEBUG_SCREENSHOT` | `true` | 주요 단계와 오류 시 스크린샷을 저장합니다. |
| `CRAWL_DELAY_MIN_MS` | `1000` | 요청 사이 최소 랜덤 대기 시간입니다. |
| `CRAWL_DELAY_MAX_MS` | `2500` | 요청 사이 최대 랜덤 대기 시간입니다. |
| `CRAWL_DETAIL_DELAY_MIN_MS` | `1500` | 상세 페이지 방문 전 최소 랜덤 대기 시간입니다. |
| `CRAWL_DETAIL_DELAY_MAX_MS` | `3000` | 상세 페이지 방문 전 최대 랜덤 대기 시간입니다. |
| `SAVE_XLSX` | `true` | `false`이면 XLSX 저장을 생략합니다. |
| `SAVE_XLSX_TIMESTAMP` | `false` | `true`이면 `saramin_jobs_YYYYMMDDTHHMMSSZ.xlsx` 형식으로 저장합니다. |

## 수집 조건

- 시작 페이지: `https://www.saramin.co.kr/zf_user/`
- 채용정보 메뉴 클릭을 먼저 시도합니다.
- 실패하거나 이동 확인이 어려우면 아래 IT개발·데이터 직업별 페이지로 직접 이동합니다.
  - `https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2`
- 지역: 서울 전체
- 직업: IT개발·데이터
- 직업 세부: IT개발·데이터 전체선택
- 경력: UI에서 `~1년` 계열 선택을 시도하고, 수집 후 경력 텍스트를 한 번 더 필터링합니다.

## 경력 필터링 기준

포함:

- `경력무관`
- `신입`
- `신입/경력`
- `경력 1년`, `경력1년`, `경력 1년↑`
- `1년 이하`, `1년 미만`
- `0 ~ 1년`, `0~1년`
- `~1년`

제외:

- `경력 2년`, `경력2년`
- `2년↑`, `3년↑`, `4년↑`, `5년↑`
- `2 ~`, `3 ~`, `4 ~`, `5 ~`

필터 코드는 [src/careerFilter.ts](src/careerFilter.ts)에 있습니다.

## 저장 결과

실행 후 아래 파일이 생성됩니다.

- `output/saramin_jobs.json`
- `output/saramin_jobs.csv`
- `output/saramin_jobs.xlsx`

CSV는 Excel에서 한글이 깨지지 않도록 UTF-8 BOM을 붙여 저장합니다.
XLSX는 `채용공고` 시트에 헤더 고정, 자동 필터, URL 하이퍼링크, 긴 텍스트 줄바꿈을 적용해 저장합니다.

목록 필터를 통과한 공고는 `MAX_DETAIL_PAGES` 한도 안에서 상세 페이지를 방문해 `주요업무`, `자격요건`, `우대사항`, `전형절차`, `복리후생`, `근무조건`, `기술스택`을 추가 저장합니다. 상세 페이지가 실패하거나 CAPTCHA/차단 의심 화면이면 해당 공고의 `detail_error`에 이유를 남기고 다음 공고로 넘어갑니다.

컬럼 순서:

```text
recruit_id, company_name, title, career, location, education, employment_type, deadline, tech_stack, main_tasks, requirements, preferred, hiring_process, benefits, work_conditions, detail_text, detail_error, job_url, company_url, source_url, scraped_at
```

## 디버깅

`DEBUG_SCREENSHOT=true`일 때 `screenshots/` 폴더에 주요 단계별 스크린샷이 저장됩니다.

- `01_home.png`
- `02_jobs_page.png`
- `03_region_layer.png`
- `04_job_layer.png`
- `05_after_search.png`
- `06_results.png`

selector 실패나 결과 목록 로딩 실패 시 아래 파일도 저장됩니다.

- `screenshots/error.png`
- `screenshots/debug.html`

콘솔에는 현재 URL, 페이지 제목, 주요 HTML 일부가 함께 출력됩니다.

## Selector 수정 위치

사람인 UI가 바뀌어 selector가 깨졌을 때는 먼저 [src/selectors.ts](src/selectors.ts)를 수정하세요.

클릭 방식 자체를 조정해야 하면 [src/clickHelpers.ts](src/clickHelpers.ts)를 확인하면 됩니다. 공고 카드 파싱 필드가 비어 나온다면 [src/parseJobCard.ts](src/parseJobCard.ts)의 후보 selector를 보강하세요.

## 안전 정책

- 공식 사람인 Open API는 사용하지 않습니다.
- Playwright로 공개 웹 UI만 조작합니다.
- 로그인 필요한 데이터는 수집하지 않습니다.
- CAPTCHA 우회 코드는 작성하지 않습니다.
- 차단 우회 목적의 과도한 위장이나 프록시 로직을 넣지 않습니다.
- 요청 사이에 1~2.5초 기본 랜덤 딜레이를 둡니다.
- 403, 429, CAPTCHA 의심 화면이 나오면 즉시 중단합니다.
