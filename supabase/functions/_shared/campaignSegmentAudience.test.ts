import {
  type CampaignSegmentLinkReader,
  type CampaignSegmentLinkRow,
  mergeCampaignSegmentIds,
  resolveCampaignSegmentIds,
} from "./campaignSegmentAudience.ts";

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(message ?? `Expected ${e}, received ${a}`);
}

// Read-only fake: records the query and returns fixed rows. Nothing is sent.
function fakeClient(result: { data: CampaignSegmentLinkRow[] | null; error: unknown }) {
  const calls: string[] = [];
  const client: CampaignSegmentLinkReader = {
    from(table) {
      calls.push(`from:${table}`);
      return {
        select(columns: string) {
          calls.push(`select:${columns}`);
          return {
            eq(column: string, value: string) {
              calls.push(`eq:${column}=${value}`);
              return Promise.resolve(result);
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

Deno.test("a campaign saved by the editor with three segments targets all three", async () => {
  // Editor save: segment_id = first selected, campaign_segments = every one.
  const { client, calls } = fakeClient({
    data: [{ segment_id: "seg-a" }, { segment_id: "seg-b" }, { segment_id: "seg-c" }],
    error: null,
  });
  const result = await resolveCampaignSegmentIds(client, { id: "camp-1", segment_id: "seg-a" });
  assertEquals(result, { segmentIds: ["seg-a", "seg-b", "seg-c"], error: null });
  assertEquals(calls, ["from:campaign_segments", "select:segment_id", "eq:campaign_id=camp-1"]);
});

Deno.test("campaign_segments is read even when segment_id is set", async () => {
  const { client, calls } = fakeClient({ data: [{ segment_id: "seg-b" }], error: null });
  const result = await resolveCampaignSegmentIds(client, { id: "camp-2", segment_id: "seg-a" });
  assertEquals(result.segmentIds, ["seg-a", "seg-b"]);
  assertEquals(calls.length, 3);
});

Deno.test("a legacy row with only segment_id keeps that segment", async () => {
  const { client } = fakeClient({ data: [], error: null });
  const result = await resolveCampaignSegmentIds(client, { id: "camp-3", segment_id: "seg-a" });
  assertEquals(result.segmentIds, ["seg-a"]);
});

Deno.test("segment_id null uses the campaign_segments rows", async () => {
  const { client } = fakeClient({
    data: [{ segment_id: "seg-b" }, { segment_id: null }, { segment_id: "seg-c" }],
    error: null,
  });
  const result = await resolveCampaignSegmentIds(client, { id: "camp-4", segment_id: null });
  assertEquals(result.segmentIds, ["seg-b", "seg-c"]);
});

Deno.test("no segments anywhere is an empty list, not an error", async () => {
  const { client } = fakeClient({ data: null, error: null });
  const result = await resolveCampaignSegmentIds(client, { id: "camp-5" });
  assertEquals(result, { segmentIds: [], error: null });
});

Deno.test("a read failure is returned, never treated as no segments", async () => {
  const failure = { message: "permission denied" };
  const { client } = fakeClient({ data: null, error: failure });
  const result = await resolveCampaignSegmentIds(client, { id: "camp-6", segment_id: "seg-a" });
  assertEquals(result, { segmentIds: [], error: failure });
});

Deno.test("merge dedupes and keeps segment_id first", () => {
  assertEquals(
    mergeCampaignSegmentIds("seg-a", [{ segment_id: "seg-b" }, { segment_id: "seg-a" }, { segment_id: "" }]),
    ["seg-a", "seg-b"],
  );
  assertEquals(mergeCampaignSegmentIds(undefined, undefined), []);
});
