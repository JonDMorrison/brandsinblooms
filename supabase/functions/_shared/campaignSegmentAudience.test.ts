import {
  resolveCampaignSegmentIds,
  resolveSegmentAudienceCustomerIds,
} from "./campaignSegmentAudience.ts";
import { createMockSupabaseClient } from "./testing/testHarness.ts";

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(message ?? `Expected ${e}, received ${a}`);
}

const TENANT = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const SEGMENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEGMENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_1 = "c0000000-0000-4000-8000-000000000001";
const CUSTOMER_2 = "c0000000-0000-4000-8000-000000000002";
const CUSTOMER_3 = "c0000000-0000-4000-8000-000000000003";

Deno.test("editor save shape: segment_id is the first segment, campaign_segments holds both", async () => {
  const { client, recorder } = createMockSupabaseClient({
    "campaign_segments:select": {
      data: [{ segment_id: SEGMENT_A }, { segment_id: SEGMENT_B }],
      error: null,
    },
  });

  const result = await resolveCampaignSegmentIds(client, {
    campaignId: CAMPAIGN,
    legacySegmentId: SEGMENT_A,
  });

  assertEquals(result, { ok: true, value: [SEGMENT_A, SEGMENT_B] });
  assertEquals(recorder[0]?.filters, [
    { type: "eq", column: "campaign_id", value: CAMPAIGN },
  ]);
});

Deno.test("legacy save shape: segment_id null, campaign_segments holds both", async () => {
  const { client } = createMockSupabaseClient({
    "campaign_segments:select": {
      data: [{ segment_id: SEGMENT_A }, { segment_id: SEGMENT_B }],
      error: null,
    },
  });

  const result = await resolveCampaignSegmentIds(client, {
    campaignId: CAMPAIGN,
    legacySegmentId: null,
  });

  assertEquals(result, { ok: true, value: [SEGMENT_A, SEGMENT_B] });
});

Deno.test("single segment kept only on segment_id still resolves", async () => {
  const { client } = createMockSupabaseClient({
    "campaign_segments:select": { data: [], error: null },
  });

  const result = await resolveCampaignSegmentIds(client, {
    campaignId: CAMPAIGN,
    legacySegmentId: SEGMENT_B,
  });

  assertEquals(result, { ok: true, value: [SEGMENT_B] });
});

Deno.test("campaign_segments read failure is reported, not treated as no segments", async () => {
  const { client } = createMockSupabaseClient({
    "campaign_segments:select": { data: null, error: { message: "boom" } },
  });

  const result = await resolveCampaignSegmentIds(client, {
    campaignId: CAMPAIGN,
    legacySegmentId: SEGMENT_A,
  });

  assertEquals(result, { ok: false, error: { message: "boom" } });
});

Deno.test("two segments: audience is the union of both, tenant-scoped, de-duplicated", async () => {
  const { client, recorder } = createMockSupabaseClient({
    "customer_segments:select": {
      data: [
        { customer_id: CUSTOMER_1 },
        { customer_id: CUSTOMER_2 },
        { customer_id: CUSTOMER_2 },
        { customer_id: CUSTOMER_3 },
      ],
      error: null,
    },
  });

  const result = await resolveSegmentAudienceCustomerIds(client, {
    tenantId: TENANT,
    segmentIds: [SEGMENT_A, SEGMENT_B, SEGMENT_A],
  });

  assertEquals(result, {
    ok: true,
    value: [CUSTOMER_1, CUSTOMER_2, CUSTOMER_3],
  });
  assertEquals(recorder.length, 1);
  assertEquals(recorder[0]?.filters, [
    { type: "eq", column: "crm_segments.tenant_id", value: TENANT },
    { type: "is", column: "crm_segments.deleted_at", value: null },
    { type: "in", column: "segment_id", value: [SEGMENT_A, SEGMENT_B] },
    { type: "order", column: "customer_id", value: { ascending: true } },
    { type: "order", column: "segment_id", value: { ascending: true } },
    { type: "range", value: [0, 999] },
  ]);
});

Deno.test("two segments across pages: every page is read", async () => {
  const { client, recorder } = createMockSupabaseClient({
    "customer_segments:select": [
      {
        data: [{ customer_id: CUSTOMER_1 }, { customer_id: CUSTOMER_2 }],
        error: null,
      },
      {
        data: [{ customer_id: CUSTOMER_2 }, { customer_id: CUSTOMER_3 }],
        error: null,
      },
      { data: [], error: null },
    ],
  });

  const result = await resolveSegmentAudienceCustomerIds(client, {
    tenantId: TENANT,
    segmentIds: [SEGMENT_A, SEGMENT_B],
    pageSize: 2,
  });

  assertEquals(result, {
    ok: true,
    value: [CUSTOMER_1, CUSTOMER_2, CUSTOMER_3],
  });
  assertEquals(
    recorder.map((entry) => entry.filters.at(-1)),
    [
      { type: "range", value: [0, 1] },
      { type: "range", value: [2, 3] },
      { type: "range", value: [4, 5] },
    ],
  );
});

Deno.test("no segments: no query, empty audience", async () => {
  const { client, recorder } = createMockSupabaseClient({});

  const result = await resolveSegmentAudienceCustomerIds(client, {
    tenantId: TENANT,
    segmentIds: [],
  });

  assertEquals(result, { ok: true, value: [] });
  assertEquals(recorder.length, 0);
});

Deno.test("customer_segments read failure is reported", async () => {
  const { client } = createMockSupabaseClient({
    "customer_segments:select": { data: null, error: { message: "down" } },
  });

  const result = await resolveSegmentAudienceCustomerIds(client, {
    tenantId: TENANT,
    segmentIds: [SEGMENT_A, SEGMENT_B],
  });

  assertEquals(result, { ok: false, error: { message: "down" } });
});
