// Promotion polling is anchored to observation start, not RPC completion.
// The minute-based worker needs one minute of the five-minute target.
export type EngineeringNext = { step: string; delaySeconds: number; runAfter?: string };

export function promotionObservationSchedule(previous: unknown, startedAt: number) {
  const polls = typeof previous === "number" && Number.isSafeInteger(previous) && previous >= 0
    ? Math.min(previous + 1, 4)
    : 1;
  const delaySeconds = Math.min(60 * 2 ** (polls - 1), 240);
  return { polls, delaySeconds, runAfter: new Date(startedAt + delaySeconds * 1000).toISOString() };
}

export function engineeringRunAfter(next: EngineeringNext, completedAt: number): string {
  // Only trusted pipeline code sets an absolute time. Other stages retain
  // their completion-relative backoff, deployment timeout and retry behavior.
  return next.runAfter ?? new Date(completedAt + next.delaySeconds * 1000).toISOString();
}
