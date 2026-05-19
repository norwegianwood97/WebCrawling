# Saramin Job Collector

사람인 공식 채용공고 Open API를 우선 사용해 서울 전체의 `IT개발·데이터` 공고 중 1년차 지원 가능 공고를 JSON/CSV로 저장하는 Node.js + TypeScript 수집기입니다.

## 실행 방법

```bash
npm install
cp .env.example .env
npm run dev
```

빌드 후 실행:

```bash
npm run build
npm start
```

## API 키 설정

`.env` 파일에 사람인 API access key를 넣습니다.

```env
SARAMIN_ACCESS_KEY=your_access_key
STRICT_MAX_ONE_YEAR=false
MAX_PAGES=5
OUTPUT_DIR=output
USE_PLAYWRIGHT_FALLBACK=false
```

API 키가 없고 `USE_PLAYWRIGHT_FALLBACK=false`이면 명확한 에러 메시지와 함께 종료합니다.

## 공식 API 수집 조건

요청 endpoint는 `https://oapi.saramin.co.kr/job-search`입니다.

기본 파라미터:

- `loc_mcd=101000`: 서울전체
- `job_mid_cd=2`: IT개발·데이터
- `job_cd` 미사용: 세부 직무 전체선택 조건
- `fields=posting-date,expiration-date,keyword-code,count`
- `sort=pd`
- `count=110`
- `start=0`부터 페이지네이션

`MAX_PAGES`에 도달하거나 API 응답의 `total/count/start` 기준으로 마지막 페이지에 도달하면 수집을 중단합니다.

## 경력 필터 기준

API 응답의 `position["experience-level"]` 필드를 사용합니다.

기본 정책은 "1년차 지원 가능 공고"입니다. 아래 조건 중 하나에 해당하면 포함합니다.

- 경력무관: `code === 0`
- 신입: `code === 1`
- 신입/경력: `code === 3`
- 경력 공고 중 `min <= 1`

`STRICT_MAX_ONE_YEAR=true`이면 더 엄격하게 필터링합니다.

- 경력무관
- 신입
- 신입/경력
- `max` 값이 있고 `max <= 1`
- `name`에 `1년` 또는 `1년 이하`가 포함되는 공고

## 저장 결과

기본 저장 경로는 `output`입니다.

- `output/saramin_jobs.json`
- `output/saramin_jobs.csv`

CSV는 한글 깨짐을 줄이기 위해 UTF-8 BOM을 포함해 저장합니다.

## Playwright Fallback

`USE_PLAYWRIGHT_FALLBACK=true`이고 `SARAMIN_ACCESS_KEY`가 없을 때만 Playwright fallback이 실행됩니다.

Fallback은 공식 API 사용이 불가능한 상황을 대비한 구조입니다.

처음 fallback을 사용할 때 Chromium 브라우저가 없다면 아래 명령으로 설치합니다.

```bash
npm run playwright:install
```

- `https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_mcls=2` 접속
- 텍스트 기반 locator로 지역, 직업, 경력 조건 선택 시도
- `div.list_item[id^="rec-"]`, `.list_item`, `.item_recruit` 순서로 결과 카드 파싱
- 요청 사이 1~2초 랜덤 딜레이 적용
- CAPTCHA, 로그인, 차단 우회 로직은 포함하지 않습니다.

웹 UI 구조는 변경될 수 있으므로 fallback은 보조 수단으로만 사용하고, 기본 수집은 공식 API를 권장합니다.
