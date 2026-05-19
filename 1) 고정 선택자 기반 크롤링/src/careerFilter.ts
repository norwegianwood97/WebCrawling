import { JobPosting } from "./types.js";
import { normalizeText } from "./utils.js";

const includePatterns = [
  /경력무관/,
  /신입/,
  /신입\s*\/\s*경력/,
  /경력\s*1년/,
  /1년\s*이하/,
  /1년\s*미만/,
  /0\s*~\s*1년/,
  /~\s*1년/
];

const excludePatterns = [
  /경력\s*2년/,
  /경력\s*3년/,
  /경력\s*4년/,
  /경력\s*5년/,
  /2년\s*↑/,
  /3년\s*↑/,
  /4년\s*↑/,
  /5년\s*↑/,
  /2\s*~/,
  /3\s*~/,
  /4\s*~/,
  /5\s*~/
];

export const isCareerAllowed = (career: string): boolean => {
  const text = normalizeText(career);
  if (!text) {
    return false;
  }

  if (excludePatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  return includePatterns.some((pattern) => pattern.test(text));
};

export const filterJobsByCareer = (jobs: JobPosting[]): JobPosting[] =>
  jobs.filter((job) => isCareerAllowed(job.career));
