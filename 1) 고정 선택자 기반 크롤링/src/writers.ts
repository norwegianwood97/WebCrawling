import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { JobPosting } from "./types.js";

const columns = [
  "recruit_id",
  "company_name",
  "title",
  "job_meta",
  "location",
  "career",
  "education",
  "job_url",
  "company_url",
  "source_url",
  "scraped_at",
] as const satisfies ReadonlyArray<keyof JobPosting>;

interface XlsxColumn {
  header: string;
  key: keyof JobPosting;
  width: number;
  wrapText?: boolean;
  hyperlink?: boolean;
}

interface WriteOptions {
  timestamp: string;
}

const xlsxColumns: XlsxColumn[] = [
  { header: "공고ID", key: "recruit_id", width: 14 },
  { header: "회사명", key: "company_name", width: 26 },
  { header: "공고 제목", key: "title", width: 44, wrapText: true },
  { header: "모집 직무", key: "job_meta", width: 34, wrapText: true },
  { header: "지역", key: "location", width: 18 },
  { header: "경력요구사항", key: "career", width: 18 },
  { header: "학력요구사항", key: "education", width: 18 },
  { header: "모집공고링크", key: "job_url", width: 48, hyperlink: true },
  { header: "회사 URL", key: "company_url", width: 38, hyperlink: true },
  { header: "수집 URL", key: "source_url", width: 48 },
  { header: "수집 시각", key: "scraped_at", width: 24 },
];

export const timestampForFileName = (): string => {
  const date = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
};

const buildOutputPath = (
  outputDir: string,
  extension: "csv" | "json" | "xlsx",
  options: WriteOptions,
): string => path.join(outputDir, `saramin_jobs_${options.timestamp}.${extension}`);

const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const serializeJob = (job: JobPosting): Record<string, string> => {
  const row: Record<string, string> = {};
  for (const column of columns) {
    row[column] = job[column] ?? "";
  }

  return row;
};

const serializeJobs = (jobs: JobPosting[]): Array<Record<string, string>> =>
  jobs.map(serializeJob);

const isBusyError = (error: unknown): boolean => {
  return error instanceof Error && "code" in error && error.code === "EBUSY";
};

const applyHyperlinks = (row: ExcelJS.Row, job: JobPosting): void => {
  for (const column of xlsxColumns) {
    if (!column.hyperlink) {
      continue;
    }

    const value = job[column.key];
    if (!value) {
      continue;
    }

    const cell = row.getCell(column.key);
    cell.value = {
      text: value,
      hyperlink: value,
    };
    cell.font = {
      color: { argb: "FF0563C1" },
      underline: true,
    };
  }
};

export const writeJson = async (
  jobs: JobPosting[],
  outputDir: string,
  options: WriteOptions,
): Promise<string> => {
  await mkdir(outputDir, { recursive: true });
  const filePath = buildOutputPath(outputDir, "json", options);
  await writeFile(
    filePath,
    `${JSON.stringify(serializeJobs(jobs), null, 2)}\n`,
    "utf8",
  );
  return filePath;
};

export const writeCsv = async (
  jobs: JobPosting[],
  outputDir: string,
  options: WriteOptions,
): Promise<string> => {
  await mkdir(outputDir, { recursive: true });
  const filePath = buildOutputPath(outputDir, "csv", options);
  const header = columns.join(",");
  const rows = jobs.map((job) =>
    columns.map((column) => csvEscape(job[column] ?? "")).join(","),
  );
  await writeFile(filePath, `\uFEFF${[header, ...rows].join("\n")}\n`, "utf8");
  return filePath;
};

export const writeXlsx = async (
  jobs: JobPosting[],
  outputDir: string,
  options: WriteOptions,
): Promise<string> => {
  await mkdir(outputDir, { recursive: true });
  const filePath = buildOutputPath(outputDir, "xlsx", options);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "saramin-ui-crawler";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("채용공고", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = xlsxColumns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
    style: {
      alignment: {
        vertical: "top",
        wrapText: column.wrapText ?? false,
      },
    },
  }));

  for (const job of jobs) {
    const row = worksheet.addRow(job);
    applyHyperlinks(row, job);
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: xlsxColumns.length },
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    row.alignment = { vertical: "top", wrapText: false };
    for (const column of xlsxColumns) {
      if (column.wrapText) {
        row.getCell(column.key).alignment = { vertical: "top", wrapText: true };
      }
    }
  });

  try {
    await workbook.xlsx.writeFile(filePath);
  } catch (error) {
    if (isBusyError(error)) {
      throw new Error(
        `XLSX 파일이 열려 있어 저장할 수 없습니다. ${filePath} 파일을 닫고 다시 실행해 주세요.`,
      );
    }

    throw error;
  }

  return filePath;
};
