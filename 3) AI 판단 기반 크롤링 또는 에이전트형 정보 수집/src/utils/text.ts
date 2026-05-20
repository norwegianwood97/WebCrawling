export const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

export const normalizeMultilineText = (value: string | null | undefined): string =>
  (value ?? "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .join("\n")
    .trim();

export const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};
