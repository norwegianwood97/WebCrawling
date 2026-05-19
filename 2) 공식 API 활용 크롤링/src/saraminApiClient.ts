import axios, { AxiosError, AxiosInstance } from "axios";
import { MaybeArray, RawSaraminJob, SaraminApiResponse } from "./types";
import { toNumberOrNull } from "./careerFilter";

const ENDPOINT = "https://oapi.saramin.co.kr/job-search";
const DEFAULT_COUNT = 110;
const RETRY_COUNT = 2;

export interface FetchJobsPageOptions {
  accessKey: string;
  start: number;
  count?: number;
}

export interface SaraminJobsPage {
  jobs: RawSaraminJob[];
  total: number;
  count: number;
  start: number;
}

export class SaraminApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: ENDPOINT,
      headers: {
        Accept: "application/json"
      },
      timeout: 20_000
    });
  }

  async fetchJobsPage(options: FetchJobsPageOptions): Promise<SaraminJobsPage> {
    const requestedCount = options.count ?? DEFAULT_COUNT;
    const response = await this.requestWithRetry(options.accessKey, options.start, requestedCount);
    const envelope = response.jobs;
    const jobs = normalizeJobArray(envelope?.job);

    return {
      jobs,
      total: toNumberOrNull(envelope?.total) ?? 0,
      count: toNumberOrNull(envelope?.count) ?? requestedCount,
      start: toNumberOrNull(envelope?.start) ?? options.start
    };
  }

  private async requestWithRetry(accessKey: string, start: number, count: number): Promise<SaraminApiResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
      try {
        const response = await this.http.get<SaraminApiResponse>("", {
          params: {
            "access-key": accessKey,
            loc_mcd: "101000",
            job_mid_cd: "2",
            fields: "posting-date,expiration-date,keyword-code,count",
            sort: "pd",
            count,
            start
          }
        });

        return response.data;
      } catch (error) {
        lastError = error;

        if (isStopStatus(error)) {
          throw friendlyHttpError(error);
        }

        if (attempt < RETRY_COUNT && isRetryable(error)) {
          await delay(500 * (attempt + 1));
          continue;
        }

        throw friendlyHttpError(error);
      }
    }

    throw friendlyHttpError(lastError);
  }
}

export function normalizeJobArray(value: MaybeArray<RawSaraminJob>): RawSaraminJob[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  return status === undefined || status >= 500 || status === 408;
}

function isStopStatus(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status === 429 || error.response?.status === 403);
}

function friendlyHttpError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const status = error.response?.status;
  if (status === 429) {
    return new Error("Saramin API rate limit(429)에 도달했습니다. 요청 간격을 늘린 뒤 다시 실행해 주세요.");
  }

  if (status === 403) {
    return new Error("Saramin API 접근이 거부되었습니다(403). SARAMIN_ACCESS_KEY 값과 API 권한을 확인해 주세요.");
  }

  return new Error(buildAxiosMessage(error));
}

function buildAxiosMessage(error: AxiosError): string {
  const status = error.response?.status;
  const statusText = error.response?.statusText;
  const suffix = status ? ` (${status}${statusText ? ` ${statusText}` : ""})` : "";
  return `Saramin API 요청에 실패했습니다${suffix}: ${error.message}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
