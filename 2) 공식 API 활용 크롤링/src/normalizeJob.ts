import { MaybeArray, NormalizedJob, Primitive, RawSaraminJob, SaraminCodeName } from "./types";
import { toNumberOrNull } from "./careerFilter";

export function normalizeJob(job: RawSaraminJob, scrapedAt: string): NormalizedJob {
  const position = job.position ?? {};
  const companyDetail = job.company?.detail ?? {};
  const experience = position["experience-level"] ?? {};
  const education = position["required-education-level"] ?? {};
  const location = firstCodeName(position.location);
  const jobMid = firstCodeName(position["job-mid-code"]);
  const jobCode = firstCodeName(position["job-code"]);

  return {
    id: toStringValue(job.id),
    title: toStringValue(position.title),
    company_name: toStringValue(companyDetail.name),
    company_url: toStringValue(companyDetail.href),
    job_url: toStringValue(job.url),
    location_name: joinNames(position.location),
    location_code: toStringValue(location?.code),
    job_mid_code: toStringValue(jobMid?.code),
    job_mid_name: toStringValue(jobMid?.name),
    job_code: toStringValue(jobCode?.code),
    job_code_name: joinNames(position["job-code"]),
    experience_code: toNumberOrNull(experience.code),
    experience_min: toNumberOrNull(experience.min),
    experience_max: toNumberOrNull(experience.max),
    experience_name: toStringValue(experience.name),
    education: toStringValue(education.name) || toStringValue(education.code),
    job_type: joinNames(position["job-type"]),
    industry: joinNames(position.industry),
    keyword: toStringValue(job.keyword),
    salary: codeNameOrPrimitiveToString(job.salary),
    posting_date: toStringValue(job["posting-date"]),
    expiration_date: toStringValue(job["expiration-date"]),
    close_type: codeNameOrPrimitiveToString(job["close-type"]),
    read_count: toNumberOrNull(job["read-cnt"]),
    apply_count: toNumberOrNull(job["apply-cnt"]),
    scraped_at: scrapedAt
  };
}

export function isActiveJob(job: RawSaraminJob): boolean {
  return toNumberOrNull(job.active) === 1;
}

function firstCodeName(value: MaybeArray<SaraminCodeName>): SaraminCodeName | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

function joinNames(value: MaybeArray<SaraminCodeName>): string {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .map((entry) => toStringValue(entry.name) || toStringValue(entry.code))
    .filter(Boolean)
    .join(", ");
}

function codeNameOrPrimitiveToString(value: SaraminCodeName | Primitive | unknown): string {
  if (isCodeName(value)) {
    return toStringValue(value.name) || toStringValue(value.code);
  }

  return toStringValue(value);
}

function isCodeName(value: unknown): value is SaraminCodeName {
  return typeof value === "object" && value !== null && ("name" in value || "code" in value);
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}
