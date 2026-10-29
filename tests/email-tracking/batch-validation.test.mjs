import assert from "node:assert/strict";
import test from "node:test";
import { isolateBatchValidation } from "../../supabase/functions/_shared/isolateBatchValidation.ts";

test("isolates malformed recipients and preserves recipient/result order", async () => {
  const keys = [];
  const send = async (items, key) => {
    keys.push(key);
    return items.includes("bad")
      ? { error: "Invalid `to` field.", status: 422 }
      : { ids: items.map((id) => ({ id })) };
  };
  const result = await isolateBatchValidation(["a", "bad", "c", "d"], "stable", send);
  assert.deepEqual(result.ids, [
    { id: "a" }, { error: "Invalid `to` field.", status: 422 },
    { id: "c" }, { id: "d" },
  ]);
  assert.equal(new Set(keys).size, keys.length);
  const firstKeys = [...keys];
  keys.length = 0;
  await isolateBatchValidation(["a", "bad", "c", "d"], "stable", send);
  assert.deepEqual(keys, firstKeys);
});

test("does not split successful or ambiguous requests", async () => {
  for (const response of [
    { error: "timeout" }, { error: "server error", status: 500 },
    { error: "rate limited", status: 429, rateLimited: true },
    { error: "unauthorized", status: 401 },
    { ids: [{ id: "a" }, { id: "b" }], status: 200 },
  ]) {
    let calls = 0;
    assert.deepEqual(await isolateBatchValidation(["a", "b"], "stable", async () => {
      calls++;
      return response;
    }), response);
    assert.equal(calls, 1);
  }
});

test("keeps accepted sibling results when another split is rate limited", async () => {
  const result = await isolateBatchValidation(["a", "b"], "stable", async (items) =>
    items.length > 1 ? { error: "validation error", status: 422 }
      : items[0] === "a" ? { ids: [{ id: "accepted" }] }
      : { error: "rate limited", status: 429, rateLimited: true });
  assert.deepEqual(result.ids, [{ id: "accepted" }, { error: "rate limited", status: 429 }]);
});
