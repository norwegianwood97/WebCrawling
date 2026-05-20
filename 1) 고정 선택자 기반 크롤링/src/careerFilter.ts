import { JobPosting } from "./types.js";
import { normalizeText } from "./utils.js";

const includePatterns = [
  /경력\s*무관/,
  /신입/,
  /신입\s*\/\s*경력/,
  /0\s*~\s*1\s*년/,
  /~\s*1\s*년/,
  /1\s*년\s*(?:차|이하|미만|↑|이상)?/,
  /경력\s*1\s*년/,
];

const excludePatterns = [
  /경력\s*[2-9]\s*년/,
  /[2-9]\s*년\s*(?:이상|↑|차)/,
  /[2-9]\s*~/,
];

const isClearlyAllowed = (text: string): boolean =>
  /신입|경력\s*무관|1\s*년/.test(text);

export const isCareerAllowed = (career: string): boolean => {
  const text = normalizeText(career);
  if (!text) {
    return false;
  }

  if (!includePatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  return isClearlyAllowed(text) || !excludePatterns.some((pattern) => pattern.test(text));
};

export const filterJobsByCareer = (jobs: JobPosting[]): JobPosting[] =>
  jobs.filter((job) => isCareerAllowed(job.career));
