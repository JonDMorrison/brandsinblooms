import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bloomSuitePosReceiver, signBloomSuitePos } from "../bloomsuite-pos.ts";

const secret = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const binding = {
  keyId: "qa-pos",
  posTenantId: "11111111-1111-4111-8111-111111111111",
  crmTenantId: "22222222-2222-4222-8222-222222222222",
  posConnectionId: "33333333-3333-4333-8333-333333333333",
  secret,
};
const body = JSON.stringify({
  id: "44444444-4444-4444-8444-444444444444",
  tenantId: binding.posTenantId,
  source: "POS",
  type: "SaleCompleted",
  version: 1,
  recordId: "sale-1",
  revision: 1,
  occurredAt: "2026-10-09T05:30:00Z",
  data: { saleId: "sale-1", totalCents: 1000, currency: "CAD", lineItems: [], tenders: [] },
});
const nowMs = 1791523800000;
const timestamp = String(Math.floor(nowMs / 1000));

Deno.test("BloomSuite POS receiver accepts a valid signed event", async () => {
  let calls = 0;
  const signature = await signBloomSuitePos(secret, timestamp, body);
  const response = await bloomSuitePosReceiver({
    binding: async () => binding,
    apply: async (_key, event) => { calls++; return { accepted: true, eventId: (event as {id:string}).id }; },
    now: () => nowMs,
  })(new Request("https://example.test", {
    method: "POST",
    headers: {
      "x-bloom-key-id": binding.keyId,
      "x-bloom-timestamp": timestamp,
      "x-bloom-signature": signature,
    },
    body,
  }));
  assertEquals(response.status, 200);
  assertEquals(calls, 1);
  assertEquals((await response.json()).accepted, true);
});

Deno.test("BloomSuite POS receiver rejects tampering before projection", async () => {
  let calls = 0;
  const signature = await signBloomSuitePos(secret, timestamp, body);
  const response = await bloomSuitePosReceiver({
    binding: async () => binding,
    apply: async () => { calls++; return {}; },
    now: () => nowMs,
  })(new Request("https://example.test", {
    method: "POST",
    headers: {
      "x-bloom-key-id": binding.keyId,
      "x-bloom-timestamp": timestamp,
      "x-bloom-signature": signature,
    },
    body: body.replace("1000", "1001"),
  }));
  assertEquals(response.status, 401);
  assertEquals(calls, 0);
});

Deno.test("BloomSuite POS receiver rejects expired signatures", async () => {
  const old = String(Number(timestamp) - 301);
  const signature = await signBloomSuitePos(secret, old, body);
  const response = await bloomSuitePosReceiver({
    binding: async () => binding,
    apply: async () => ({}),
    now: () => nowMs,
  })(new Request("https://example.test", {
    method: "POST",
    headers: {
      "x-bloom-key-id": binding.keyId,
      "x-bloom-timestamp": old,
      "x-bloom-signature": signature,
    },
    body,
  }));
  assertEquals(response.status, 401);
});
