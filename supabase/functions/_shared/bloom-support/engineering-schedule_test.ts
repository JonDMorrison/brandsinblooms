import { strict as assert } from "node:assert";
import { engineeringRunAfter, promotionObservationSchedule } from "./engineering-schedule.ts";

Deno.test("promotion deadlines account for completion time and minute worker cadence", () => {
  // Every phase in the cron minute, including the review's :02 example.
  for (let phase = 0; phase < 60; phase++) {
    const start = Date.UTC(2026, 10, 9, 0, 0, phase);
    for (const processingMs of [0, 2000, 45000, 180000]) {
      const next = { step: "deploy", ...promotionObservationSchedule(4, start) };
      const scheduled = Date.parse(engineeringRunAfter(next, start + processingMs));
      const nextIdleTick = Math.ceil(scheduled / 60000) * 60000;
      assert.equal(scheduled, start + 240000);
      assert.ok(nextIdleTick - start <= 300000);
      assert.ok(scheduled >= start + processingMs);
    }
  }
});

Deno.test("overdue promotion observation is immediately eligible, not delayed again", () => {
  const start = Date.UTC(2026, 10, 9);
  const next = { step: "deploy", ...promotionObservationSchedule(4, start) };
  assert.ok(Date.parse(engineeringRunAfter(next, start + 360000)) <= start + 360000);
});

Deno.test("promotion schedule persists bounded backoff and handles legacy counters", () => {
  let polls: unknown = undefined;
  for (const expected of [60, 120, 240, 240, 240]) {
    const next = promotionObservationSchedule(polls, 0);
    assert.equal(next.delaySeconds, expected);
    assert.equal(Date.parse(next.runAfter), expected * 1000);
    polls = next.polls;
  }
  for (const value of [undefined, -1, 0.5, "20", NaN, Infinity]) {
    assert.equal(promotionObservationSchedule(value, 0).delaySeconds, 60);
  }
  assert.equal(promotionObservationSchedule(Number.MAX_SAFE_INTEGER, 0).delaySeconds, 240);
});

Deno.test("all other engineering stages retain completion-relative scheduling", () => {
  for (const step of ["investigate", "poll", "evaluate", "deploy", "verify"]) {
    assert.equal(engineeringRunAfter({ step, delaySeconds: 300 }, 123000), new Date(423000).toISOString());
  }
});
