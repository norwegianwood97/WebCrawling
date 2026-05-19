export const selectors = {
  homeRecruitMenu: [
    "div.wrap_gnb a.depth1 span.txt",
    "#sri_header > div.wrap_header > div.navigation > div.wrap_gnb > div.major.recruit > a > span"
  ],
  regionOpenButtons: [
    "#sp_main_wrapper > div.main_option > ul > li.area_section > button",
    "li.area_section button.btn_area",
    "div.main_option li.area_section:nth-of-type(1) button"
  ],
  seoulButtons: [
    'button[data-code="101000"]',
    "button.depth1_btn_101000"
  ],
  layerDoneButtons: [
    "선택완료",
    "적용",
    "확인",
    "닫기"
  ],
  jobOpenButtons: [
    "#sp_main_wrapper > div.main_option > ul > li.area_section:nth-of-type(2) > button",
    "div.main_option li.area_section:nth-of-type(2) button"
  ],
  jobAllSelect: [
    'label[for="all_check_onedepth_2"]'
  ],
  careerOpenButtons: [
    "#sp_main_wrapper > div.default_option > div.search_option.career_option > button"
  ],
  careerCheckbox: "#btn_check_career_over0",
  careerCloseButtons: [
    ".closeDefaultOptionLayer",
    "button.btn_close"
  ],
  searchButtons: [
    "#search_btn",
    "button.btn_search.active"
  ],
  jobCards: [
    'div.list_item[id^="rec-"]',
    "div.list_item",
    "#default_list_wrap .list_body .list_item",
    ".item_recruit",
    '[id^="rec-"]'
  ],
  paginationLinks: [
    'a[aria-label="다음"]',
    ".pagination a",
    ".page a"
  ]
} as const;
