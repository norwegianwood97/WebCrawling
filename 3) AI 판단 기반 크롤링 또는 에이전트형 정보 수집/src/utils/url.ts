import { normalizeText } from "./text.js";

export const toAbsoluteUrl = (
  value: string | null | undefined,
  base = "https://www.saramin.co.kr",
): string => {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  try {
    return new URL(text, base).toString();
  } catch {
    return text;
  }
};

export const isSaraminUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.hostname === "saramin.co.kr" || url.hostname.endsWith(".saramin.co.kr");
  } catch {
    return false;
  }
};

export const isValidJobDetailUrl = (value: string): boolean => {
  const url = toAbsoluteUrl(value);
  if (!url || url.includes("company-info/view-inner-recruit")) {
    return false;
  }

  return (
    url.includes("/zf_user/jobs/relay/view") ||
    url.includes("rec_idx=") ||
    url.includes("/jobs/view")
  );
};
