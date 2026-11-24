/**
 * A card is valid through the last day of its expiry month.
 */
export function isCardExpired(
  expMonth: number,
  expYear: number,
  now: Date = new Date(),
): boolean {
  if (!Number.isInteger(expMonth) || !Number.isInteger(expYear)) return false;
  // First instant of the month after expiry (local time).
  const firstInvalid = new Date(expYear, expMonth, 1);
  return now.getTime() >= firstInvalid.getTime();
}

function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export interface PlanDateDisplay {
  label: "Renews" | "Ends" | "Trial ends" | "End date";
  date: Date | null;
}

/**
 * A monthly plan renews every month from its start date; the stored end_date
 * is a far-off bound (for some accounts years away), not the next billing
 * date. Show the next monthly renewal, or "Ends" when the stored end date
 * comes first (a cancelled plan).
 */
export function getPlanDateDisplay(input: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  billingInterval: string | null | undefined;
  isTrial: boolean;
  now?: Date;
}): PlanDateDisplay {
  const end = parseDay(input.endDate);
  if (input.isTrial) return { label: "Trial ends", date: end };

  const start = parseDay(input.startDate);
  const interval = (input.billingInterval ?? "").toLowerCase();
  if (!start || (interval !== "monthly" && interval !== "month")) {
    return { label: "End date", date: end };
  }

  const now = input.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let months = Math.max(
    0,
    (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()),
  );
  let next = addMonthsClamped(start, months);
  while (next.getTime() <= today.getTime()) {
    months += 1;
    next = addMonthsClamped(start, months);
  }

  if (end && end.getTime() <= next.getTime()) {
    return { label: "Ends", date: end };
  }
  return { label: "Renews", date: next };
}
