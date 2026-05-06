import { describe, expect, it } from "vitest";
import {
  AUTO_SAVE_FAILED_MESSAGE,
  AUTO_SAVE_MAX_RETRIES,
  AUTO_SAVE_RETRY_DELAYS_MS,
  decideAutoSaveFailure,
} from "../autoSaveRetryPolicy";

describe("autoSaveRetryPolicy", () => {
  it("exposes the documented retry-budget constants", () => {
    expect(AUTO_SAVE_RETRY_DELAYS_MS).toEqual([2000, 8000, 30000]);
    expect(AUTO_SAVE_MAX_RETRIES).toBe(3);
    expect(AUTO_SAVE_FAILED_MESSAGE).toMatch(/copy your work/i);
  });

  describe("decideAutoSaveFailure", () => {
    it("schedules a retry at 2s for the first failure", () => {
      const decision = decideAutoSaveFailure(1);
      expect(decision.kind).toBe("retry");
      if (decision.kind !== "retry") return;
      expect(decision.attempt).toBe(1);
      expect(decision.delayMs).toBe(2000);
      expect(decision.message).toBe("Retrying save... attempt 1 of 3");
    });

    it("schedules a retry at 8s for the second failure", () => {
      const decision = decideAutoSaveFailure(2);
      expect(decision.kind).toBe("retry");
      if (decision.kind !== "retry") return;
      expect(decision.delayMs).toBe(8000);
      expect(decision.message).toBe("Retrying save... attempt 2 of 3");
    });

    it("schedules a retry at 30s for the third failure", () => {
      const decision = decideAutoSaveFailure(3);
      expect(decision.kind).toBe("retry");
      if (decision.kind !== "retry") return;
      expect(decision.delayMs).toBe(30000);
      expect(decision.message).toBe("Retrying save... attempt 3 of 3");
    });

    it("returns 'failed' on the fourth failure (no more retries)", () => {
      const decision = decideAutoSaveFailure(4);
      expect(decision.kind).toBe("failed");
      if (decision.kind !== "failed") return;
      expect(decision.message).toBe(AUTO_SAVE_FAILED_MESSAGE);
    });

    it("returns 'failed' for any attempt count beyond the max", () => {
      for (const n of [5, 10, 100]) {
        expect(decideAutoSaveFailure(n).kind).toBe("failed");
      }
    });

    it("delays are monotonically increasing (exponential-style backoff)", () => {
      for (let i = 1; i < AUTO_SAVE_RETRY_DELAYS_MS.length; i += 1) {
        expect(AUTO_SAVE_RETRY_DELAYS_MS[i]).toBeGreaterThan(
          AUTO_SAVE_RETRY_DELAYS_MS[i - 1],
        );
      }
    });
  });
});
