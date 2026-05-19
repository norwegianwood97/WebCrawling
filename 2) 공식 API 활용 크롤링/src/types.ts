export type Primitive = string | number | boolean | null | undefined;

export type MaybeArray<T> = T | T[] | null | undefined;

export interface SaraminCodeName {
  code?: Primitive;
  name?: Primitive;
}

export interface SaraminExperienceLevel extends SaraminCodeName {
  min?: Primitive;
  max?: Primitive;
}

export interface SaraminCompany {
  detail?: {
    href?: Primitive;
    name?: Primitive;
  };
}

export interface SaraminPosition {
  title?: Primitive;
  industry?: MaybeArray<SaraminCodeName>;
  location?: MaybeArray<SaraminCodeName>;
  "job-type"?: MaybeArray<SaraminCodeName>;
  "job-mid-code"?: MaybeArray<SaraminCodeName>;
  "job-code"?: MaybeArray<SaraminCodeName>;
  "experience-level"?: SaraminExperienceLevel | null;
  "required-education-level"?: SaraminCodeName | null;
}

export interface RawSaraminJob {
  id?: Primitive;
  url?: Primitive;
  active?: Primitive;
  company?: SaraminCompany;
  position?: SaraminPosition;
  salary?: SaraminCodeName | Primitive;
  keyword?: Primitive;
  "posting-date"?: Primitive;
  "expiration-date"?: Primitive;
  "close-type"?: SaraminCodeName | Primitive;
  "read-cnt"?: Primitive;
  "apply-cnt"?: Primitive;
  [key: string]: unknown;
}

export interface SaraminJobsEnvelope {
  total?: Primitive;
  count?: Primitive;
  start?: Primitive;
  job?: MaybeArray<RawSaraminJob>;
}

export interface SaraminApiResponse {
  jobs?: SaraminJobsEnvelope;
}

export interface NormalizedJob {
  id: string;
  title: string;
  company_name: string;
  company_url: string;
  job_url: string;
  location_name: string;
  location_code: string;
  job_mid_code: string;
  job_mid_name: string;
  job_code: string;
  job_code_name: string;
  experience_code: number | null;
  experience_min: number | null;
  experience_max: number | null;
  experience_name: string;
  education: string;
  job_type: string;
  industry: string;
  keyword: string;
  salary: string;
  posting_date: string;
  expiration_date: string;
  close_type: string;
  read_count: number | null;
  apply_count: number | null;
  scraped_at: string;
}

export interface CollectorConfig {
  accessKey: string;
  strictMaxOneYear: boolean;
  maxPages: number;
  outputDir: string;
  usePlaywrightFallback: boolean;
}

export interface CollectionStats {
  totalSeen: number;
  activeSeen: number;
  passedFilter: number;
  saved: number;
}
