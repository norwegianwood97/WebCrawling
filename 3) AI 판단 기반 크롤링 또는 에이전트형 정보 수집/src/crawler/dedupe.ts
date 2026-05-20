import { JobPosting } from "./types.js";

export const dedupeJobs = (jobs: JobPosting[]): JobPosting[] => {
  const seen = new Set<string>();
  const unique: JobPosting[] = [];

  for (const job of jobs) {
    const key = job.recruit_id || job.job_url;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(job);
  }

  return unique;
};
