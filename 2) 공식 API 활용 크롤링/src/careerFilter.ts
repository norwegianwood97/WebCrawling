import { RawSaraminJob, SaraminExperienceLevel } from "./types";

const BASIC_ALLOWED_CODES = new Set([0, 1, 3]);

export function shouldIncludeByCareer(job: RawSaraminJob, strictMaxOneYear: boolean): boolean {
  const experience = job.position?.["experience-level"];
  if (!experience) {
    return false;
  }

  return strictMaxOneYear
    ? isStrictOneYearCandidate(experience)
    : isOneYearCandidate(experience);
}

export function isOneYearCandidate(experience: SaraminExperienceLevel): boolean {
  const code = toNumberOrNull(experience.code);
  const min = toNumberOrNull(experience.min);

  if (code !== null && BASIC_ALLOWED_CODES.has(code)) {
    return true;
  }

  return min !== null && min <= 1;
}

export function isStrictOneYearCandidate(experience: SaraminExperienceLevel): boolean {
  const code = toNumberOrNull(experience.code);
  const max = toNumberOrNull(experience.max);
  const name = toStringOrEmpty(experience.name);

  if (code !== null && BASIC_ALLOWED_CODES.has(code)) {
    return true;
  }

  if (max !== null && max <= 1) {
    return true;
  }

  return /1\s*년/.test(name) || name.includes("1년 이하");
}

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
