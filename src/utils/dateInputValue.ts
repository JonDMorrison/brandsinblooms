import { format } from "date-fns";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const US_SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function padDatePart(value: string) {
  return value.padStart(2, "0");
}

export function normalizeDateInputValue(value?: string | null): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (ISO_DATE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const usSlashMatch = trimmed.match(US_SLASH_DATE_PATTERN);
  if (usSlashMatch) {
    const [, month, day, year] = usSlashMatch;
    return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return format(parsed, "yyyy-MM-dd");
}

export function getTodayDateInputValue(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}