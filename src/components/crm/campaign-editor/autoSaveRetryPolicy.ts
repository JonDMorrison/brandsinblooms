// Retry policy for the campaign-editor autosave. Extracted from the context
// so the math is unit-testable without a React rig.
//
// Behavior: after the initial save fails, retry up to AUTO_SAVE_MAX_RETRIES
// times with the delays in AUTO_SAVE_RETRY_DELAYS_MS. After exhausting the
// retry budget the autosave enters the "failed" terminal state and the user
// must take manual action. New edits cancel pending retries (handled in the
// context, not here).

export const AUTO_SAVE_RETRY_DELAYS_MS = [2000, 8000, 30000] as const;
export const AUTO_SAVE_MAX_RETRIES = AUTO_SAVE_RETRY_DELAYS_MS.length;
export const AUTO_SAVE_FAILED_MESSAGE =
  "We couldn't save your changes. Please copy your work and refresh the page.";

export type AutoSaveFailureDecision =
  | {
      kind: "retry";
      attempt: number;
      delayMs: number;
      message: string;
    }
  | {
      kind: "failed";
      message: string;
    };

/**
 * Decide what to do after an autosave failure.
 *
 * @param attemptCount The 1-indexed ordinal of the just-failed attempt
 *                    (1 = first failure, 2 = second, etc.). The caller
 *                    increments before calling so this function never
 *                    receives 0.
 */
export function decideAutoSaveFailure(
  attemptCount: number,
): AutoSaveFailureDecision {
  if (attemptCount > AUTO_SAVE_MAX_RETRIES) {
    return { kind: "failed", message: AUTO_SAVE_FAILED_MESSAGE };
  }
  return {
    kind: "retry",
    attempt: attemptCount,
    delayMs: AUTO_SAVE_RETRY_DELAYS_MS[attemptCount - 1],
    message: `Retrying save... attempt ${attemptCount} of ${AUTO_SAVE_MAX_RETRIES}`,
  };
}
