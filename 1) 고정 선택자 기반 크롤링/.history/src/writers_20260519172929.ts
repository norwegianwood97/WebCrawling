import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { JobPosting } from "./types.js";

const columns: Array<keyof JobPosting> = [
  "recruit_id",
  "company_name",
  "title",
  "career",
  "location",
  "education",
  "employment_type",
  "deadline",
  "tech_stack",
  "main_tasks",
  "requirements",
  "preferred",
  "hiring_process",
  "benefits",
  "work_conditions",
  "detail_text",
  "detail_error",
  "job_url",
  "company_url",
  "source_url",
  "scraped_at",
];

interface XlsxColumn {
  header: string;
  key: keyof JobPosting;
  width: number;
  wrapText?: boolean;
  hyperlink?: boolean;
}

interface XlsxWriteOptions {
  timestampFileName?: boolean;
}

const xlsxColumns: XlsxColumn[] = [
  { header: "공고ID", key: "recruit_id", width: 14 },
  { header: "회사명", key: "company_name", width: 26 },
  { header: "공고 제목", key: "title", width: 44, wrapText: true },
  { header: "경력", key: "career", width: 18 },
  { header: "지역", key: "location", width: 18 },
  { header: "학력", key: "education", width: 18 },
  { header: "고용형태", key: "employment_type", width: 18 },
  { header: "마감일", key: "deadline", width: 18 },
  { header: "기술스택", key: "tech_stack", width: 34, wrapText: true },
  { header: "주요업무", key: "main_tasks", width: 48, wrapText: true },
  { header: "자격요건", key: "requirements", width: 48, wrapText: true },
  { header: "우대사항", key: "preferred", width: 48, wrapText: true },
  { header: "전형절차", key: "hiring_process", width: 40, wrapText: true },
  { header: "복리후생", key: "benefits", width: 40, wrapText: true },
  { header: "근무조건", key: "work_conditions", width: 42, wrapText: true },
  { header: "상세 오류", key: "detail_error", width: 42, wrapText: true },
  { header: "공고 URL", key: "job_url", width: 42, hyperlink: true },
  { header: "회사 URL", key: "company_url", width: 36, hyperlink: true },
  { header: "수집 URL", key: "source_url", width: 42, hyperlink: true },
  { header: "수집 시각", key: "scraped_at", width: 24 },
];

const csvEscape = (value: string): string => {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
};

const serializeJobs = (jobs: JobPosting[]): Array<Record<string, string>> => {
  return jobs.map((job) => {
    const row: Record<string, string> = {};

    for (const column of columns) {
      row[column] = job[column];
    }

    return row;
  });
};

const timestampForFileName = (): string => {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
};

const isBusyError = (error: unknown): boolean => {
  return error instanceof Error && "code" in error && error.code === "EBUSY";
};

export const writeJson = async (
  jobs: JobPosting[],
  outputDir: string,
): Promise<string> => {
  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "saramin_jobs.json");
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
): Promise<string> => {
  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "saramin_jobs.csv");
  const header = columns.join(",");
  const rows = jobs.map((job) =>
    columns.map((column) => csvEscape(job[column])).join(","),
  );
  await writeFile(filePath, `\uFEFF${[header, ...rows].join("\n")}\n`, "utf8");
  return filePath;
};

export const writeXlsx = async (
  jobs: JobPosting[],
  outputDir: string,
  options: XlsxWriteOptions = {},
): Promise<string> => {
  await mkdir(outputDir, { recursive: true });
  const fileName = options.timestampFileName
    ? `saramin_jobs_${timestampForFileName()}.xlsx`
    : "saramin_jobs.xlsx";
  const filePath = path.join(outputDir, fileName);

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
        "엑셀 파일이 열려 있어서 저장할 수 없습니다. 파일을 닫고 다시 실행해주세요.",
      );
    }

    throw error;
  }

  return filePath;
};
