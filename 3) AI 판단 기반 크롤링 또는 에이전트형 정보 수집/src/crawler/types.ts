export interface JobPosting {
  recruit_id: string;
  company_name: string;
  title: string;
  career: string;
  location: string;
  education: string;
  employment_type: string;
  deadline: string;
  tech_stack: string;
  main_tasks: string;
  requirements: string;
  preferred: string;
  hiring_process: string;
  benefits: string;
  work_conditions: string;
  detail_text: string;
  detail_error: string;
  job_url: string;
  company_url: string;
  source_url: string;
  scraped_at: string;
}

export type DetailFields = Pick<
  JobPosting,
  | "tech_stack"
  | "main_tasks"
  | "requirements"
  | "preferred"
  | "hiring_process"
  | "benefits"
  | "work_conditions"
  | "detail_text"
  | "detail_error"
>;
