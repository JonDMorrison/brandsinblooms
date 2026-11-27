import { beforeEach, describe, expect, it, vi } from "vitest";

// "Saving…" used to wait for four more round trips after the campaign row
// was saved: the campaign_blocks mirror (delete, insert) and the segment and
// persona link tables (delete, insert each). These tests hold the mirror open
// and check the save resolves once the row is written.
type Call = { table: string; op: string };
const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  pendingMirror: [] as Array<() => void>,
  holdMirror: true,
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit", "is"]) {
      chain[method] = () => chain;
    }
    for (const method of ["insert", "update", "delete", "upsert"]) {
      chain[method] = () => {
        op = method;
        return chain;
      };
    }
    const resolve = () => {
      fake.calls.push({ table, op });
      if (table === "crm_campaigns" && op === "insert") {
        return Promise.resolve({
          data: {
            id: "campaign-new",
            name: "",
            status: "draft",
            updated_at: "2026-11-27T10:00:00Z",
            metadata: { campaignType: "sms" },
            include_all_customers: false,
            additional_customer_ids: [],
          },
          error: null,
        });
      }
      if (table === "campaign_blocks" && op === "delete" && fake.holdMirror) {
        return new Promise((done) => {
          fake.pendingMirror.push(() => done({ data: null, error: null }));
        });
      }
      return Promise.resolve({ data: [], error: null });
    };
    chain.single = resolve;
    chain.maybeSingle = resolve;
    chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      resolve().then(onFulfilled, onRejected);
    return chain;
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
      rpc: () => Promise.resolve({ data: true, error: null }),
      from: builder,
    },
  };
});

import { persistCampaignDraft } from "@/lib/crm/campaignEditor";

const draft = {
  tenantId: "tenant-1",
  campaignId: null,
  campaignType: "sms" as const,
  name: "",
  subjectLine: "",
  preheaderText: "",
  senderName: "",
  senderEmail: "",
  contentBlocks: [],
  smsMessage: "Roses are in",
  sendAt: null,
  sendImmediately: true,
  segments: [],
  personas: [],
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  fake.calls = [];
  fake.pendingMirror = [];
  fake.holdMirror = true;
});

describe("campaign draft save timing", () => {
  it("resolves when the campaign row is saved, not after the block mirror", async () => {
    let done = false;
    const saving = persistCampaignDraft({ ...draft, mirrorBlocksInBackground: true }).then((saved) => {
      done = true;
      return saved;
    });
    await expect(saving).resolves.toMatchObject({ id: "campaign-new" });
    expect(done).toBe(true);
    // The mirror is still running in the background.
    expect(fake.pendingMirror).toHaveLength(1);
    fake.pendingMirror.shift()?.();
  });

  it("still waits for the mirror when a caller does not opt out", async () => {
    let done = false;
    const saving = persistCampaignDraft(draft).then(() => {
      done = true;
    });
    await flush();
    await flush();
    expect(fake.pendingMirror).toHaveLength(1);
    expect(done).toBe(false);
    fake.pendingMirror.shift()?.();
    await saving;
    expect(done).toBe(true);
  });

  it("writes one campaign's mirrors in order", async () => {
    await persistCampaignDraft({ ...draft, mirrorBlocksInBackground: true });
    await persistCampaignDraft({ ...draft, mirrorBlocksInBackground: true });
    await flush();
    // The second mirror waits for the first to finish.
    expect(fake.calls.filter((call) => call.table === "campaign_blocks")).toHaveLength(1);
    fake.pendingMirror.shift()?.();
    await flush();
    await flush();
    expect(fake.calls.filter((call) => call.table === "campaign_blocks")).toHaveLength(2);
    fake.pendingMirror.shift()?.();
  });

  it("skips rewriting audience links the caller knows are unchanged", async () => {
    fake.holdMirror = false;
    await persistCampaignDraft({ ...draft, campaignId: null, segments: [{ id: "s1", name: "VIP", description: null, customer_count: 3 }], syncAudienceLinks: false });
    expect(fake.calls.some((call) => call.table === "campaign_segments" || call.table === "campaign_personas")).toBe(false);
    fake.calls = [];
    await persistCampaignDraft({ ...draft, campaignId: null, segments: [{ id: "s1", name: "VIP", description: null, customer_count: 3 }] });
    expect(fake.calls.filter((call) => call.table === "campaign_segments").map((call) => call.op)).toEqual(["delete"]);
  });
});
