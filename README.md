# 사람인 채용공고 크롤링

사람인에서 서울 지역의 IT개발·데이터 직군 신입~경력1년 이하 공고를 모아보려고 만든 크롤러다.

처음에는 목록에서 공고를 찾고, 상세 페이지까지 들어가서 주요업무나 자격요건 같은 내용도 가져오려고 했다. 그런데 사람인 상세 공고는 이미지형이 많고, 회사마다 템플릿도 제각각이라 DOM에서 텍스트를 안정적으로 뽑기 어려웠다. 그래서 이 버전에서는 상세 페이지를 포기하고, 목록 화면에서 확실하게 보이는 정보만 저장하는 쪽으로 정리했다.

1. 고정 선택자 기반 크롤링
   공식 사람인 Open API는 쓰지 않는다. OpenAI API나 AI 판단도 들어가지 않는다. 그냥 Playwright로 실제 페이지에서 조건을 선택하고, 목록 카드의 고정 selector를 읽는다.
2. 공식 API 활용 크롤링

- API 활용 승인 대기중(26.05.19)

## 수집 기준

현재 기준은 아래처럼 잡았다.

- 지역: 서울 전체
- 직업: IT개발·데이터
- 경력: `~1년`, 신입, 경력무관, 1년차 지원 가능 공고

검색 결과가 나오면 `#sp_preview_total_cnt`에서 전체 건수를 읽고, 한 페이지에 보이는 공고 수를 기준으로 마지막 페이지까지 넘긴다. 예를 들어 검색 결과가 510건이고 한 페이지에 50개가 보이면 11페이지까지 돈다.

페이지 이동은 사람인 목록 하단의 `#default_list_wrap > div` 페이징 영역을 기준으로 처리했다. 1~10페이지를 보고 나면 `다음` 버튼을 눌러 다음 페이지 묶음으로 넘어간다.

## 저장하는 값

상세 페이지를 보지 않기 때문에 저장 컬럼도 목록 카드에서 확인 가능한 값만 남겼다.

```text
recruit_id
company_name
title
job_meta
location
career
education
job_url
company_url
source_url
scraped_at
```

결과 파일은 실행 시각을 붙여서 `output` 폴더에 저장된다.

```text
saramin_jobs_YYYYMMDD_HHMMSS.csv
saramin_jobs_YYYYMMDD_HHMMSS.json
saramin_jobs_YYYYMMDD_HHMMSS.xlsx
```

CSV는 Excel에서 한글이 깨지지 않도록 BOM을 붙였고, XLSX는 링크 컬럼을 하이퍼링크로 넣었다.

## 구현하면서 신경 쓴 부분

목록 카드 selector는 `div.list_item[id^="rec-"]`를 우선 사용한다. 사람인 DOM이 조금 바뀔 수 있어서 몇 가지 fallback selector도 같이 둔 상태다.

공고 상세 링크와 회사 링크가 섞이지 않도록 `company-info/view-inner-recruit` 형태의 URL은 공고 URL로 인정하지 않는다. 공고 ID는 카드의 `id="rec-..."`에서 먼저 가져오고, 없으면 `job_url`의 `rec_idx`에서 다시 찾는다.

검색 버튼도 조금 조심해서 눌렀다. 조건 선택 후 눌러야 하는 버튼은 `div#sp_preview button#search_btn`이라서, 다른 `#search_btn`이나 목록의 공고 링크를 잘못 누르지 않도록 이 selector로 고정했다.

## 빠르게 실행하기

```bash
npm install
npx playwright install
npm run dev
```

## 하지 않는 것

- 상세 페이지 방문
- 이미지형 공고 OCR
- OpenAI API 또는 AI 판단
- CAPTCHA 우회
- 차단 회피용 프록시나 우회 로직

이 프로젝트의 목적은 사람인 화면에서 공개적으로 확인 가능한 목록 정보를 정리하는 데 있다. 상세 공고 본문까지 억지로 긁어오는 것보다, 안정적으로 반복 가능한 범위만 가져오는 쪽을 선택했다.
