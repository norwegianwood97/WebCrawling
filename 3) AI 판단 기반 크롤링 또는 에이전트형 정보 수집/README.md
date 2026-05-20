# Saramin Agent Crawler

사람인 공개 채용공고를 Playwright로 관찰하고, LLM이 다음 행동을 한 단계씩 판단하는 실험용/포트폴리오용 AI 에이전트형 크롤러입니다.

공식 사람인 Open API는 사용하지 않습니다. 로그인, CAPTCHA 우회, 차단 우회, 프록시 우회, 과도한 요청도 구현하지 않습니다. CAPTCHA, 403, 429, 비정상 접근 화면이 감지되면 우회하지 않고 해당 단계나 상세 페이지만 스킵합니다.

## 1번 방식과의 차이

1번 고정 selector 방식은 사람이 미리 정한 버튼/필터 selector를 순서대로 클릭합니다. 이 프로젝트는 현재 페이지의 URL, 제목, 본문 일부, 버튼/링크/input 후보, 스크린샷 경로를 관찰한 뒤 LLM이 다음 행동 하나만 JSON으로 결정합니다.

중요한 원칙은 LLM이 데이터를 읽어 추출하지 않는다는 점입니다. LLM은 어디를 누를지만 판단하고, 공고 목록과 상세 페이지 데이터 추출은 TypeScript 코드가 담당합니다.

## 설치

```bash
npm install
npx playwright install
```

## 실행

```bash
npm run dev
npm run build
npm start
```

## 환경변수

`.env.example`을 `.env`로 복사한 뒤 값을 설정합니다.

| 변수 | 설명 |
| --- | --- |
| `HEADLESS` | 브라우저 headless 실행 여부 |
| `OUTPUT_DIR` | 결과 저장 폴더 |
| `MAX_ITEMS` | 최대 저장 공고 수 |
| `MAX_PAGES` | 목록 페이지 최대 탐색 수 |
| `MAX_DETAIL_PAGES` | 상세 페이지 방문 최대 수 |
| `MAX_AGENT_STEPS` | LLM 판단 루프 최대 단계 |
| `DEBUG_SCREENSHOT` | 디버그 스크린샷 저장 여부 |
| `SAVE_XLSX` | XLSX 저장 여부 |
| `SAVE_XLSX_TIMESTAMP` | XLSX 파일명에 timestamp 추가 여부 |
| `CRAWL_DELAY_MIN_MS` | 요청 간 최소 대기 시간 |
| `CRAWL_DELAY_MAX_MS` | 요청 간 최대 대기 시간 |
| `LLM_PROVIDER` | 현재 `openai`만 사용 |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `OPENAI_MODEL` | 사용할 모델명. 코드에 하드코딩하지 않으므로 사용자가 직접 지정 |
| `LLM_TEMPERATURE` | LLM temperature |

`OPENAI_API_KEY`가 없거나 `OPENAI_MODEL`이 비어 있으면 LLM 판단 모드를 실행하지 않고 친절한 에러를 출력합니다.

## 수집 조건

- 시작 URL: `https://www.saramin.co.kr/zf_user/`
- 채용정보 섹션
- 지역: 서울 전체
- 직업: IT개발·데이터
- 직업 세부: IT개발·데이터 전체선택
- 경력: `~1년` 또는 `1년차 지원 가능` 공고

## 저장 파일

`output/` 아래에 저장합니다.

- `saramin_agent_jobs.json`
- `saramin_agent_jobs.csv`
- `saramin_agent_jobs.xlsx`

저장 컬럼:

`recruit_id`, `company_name`, `title`, `career`, `location`, `education`, `employment_type`, `deadline`, `tech_stack`, `main_tasks`, `requirements`, `preferred`, `hiring_process`, `benefits`, `work_conditions`, `detail_text`, `detail_error`, `job_url`, `company_url`, `source_url`, `scraped_at`

## 안전 정책

허용 action:

- `goto`
- `click_text`
- `click_selector`
- `fill_text`
- `press`
- `wait`
- `extract_results`
- `stop`

금지 action:

- `login`
- `bypass_captcha`
- `solve_captcha`
- `use_proxy`
- `scrape_private_data`
- `aggressive_refresh`
- `infinite_loop`

`actionExecutor`는 LLM 응답을 그대로 실행하지 않고 action 종류, 사람인 도메인 URL, selector 위험도, 로그인/인증/CAPTCHA/프록시/우회 관련 의도를 검증합니다.

## 실패와 디버깅

`DEBUG_SCREENSHOT=true`이면 `screenshots/`에 다음 파일들이 저장됩니다.

- `01_home.png`
- `agent_step_001.png`, `agent_step_002.png`, ...
- `results.png`
- `error.png`
- `debug.html`
- 상세 페이지 오류/차단 관련 HTML 및 스크린샷

결과가 나오지 않으면 `debug.html`과 마지막 agent step 스크린샷을 확인하세요.

## 비용 주의

에이전트 방식은 Observe-Think-Act 루프마다 LLM 호출이 발생합니다. 비용과 지연을 줄이려면 `MAX_AGENT_STEPS`를 낮게 유지하세요. 실험 중에는 `MAX_ITEMS`, `MAX_PAGES`, `MAX_DETAIL_PAGES`도 작게 두는 것을 권장합니다.
