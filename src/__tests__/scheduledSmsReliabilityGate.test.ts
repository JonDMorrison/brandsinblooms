import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903220000_reliable_scheduled_sms_claim.sql",
  "utf8",
);
const enqueueWorker = readFileSync(
  "supabase/functions/sms-campaign-enqueue-worker/index.ts",
  "utf8",
);
const sendCampaign = readFileSync(
  "supabase/functions/send-sms-campaign/index.ts",
  "utf8",
);
const wizard = readFileSync("src/components/sms/SMSCampaignWizard.tsx", "utf8");
const legacyComposer = readFileSync(
  "src/components/crm/campaign-composer/SMSCampaignComposer.tsx",
  "utf8",
);

describe("scheduled SMS reliability gate", () => {
  it("atomically claims only due schedules and fails very late sends closed", () => {
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("campaign.scheduled_at <= now()");
    expect(migration).toContain(
      "campaign.scheduled_at >= now() - p_max_lateness",
    );
    expect(migration).toContain(
      "Scheduled send expired before it could be queued",
    );
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("bridges scheduled campaigns into the existing idempotent queue", () => {
    expect(enqueueWorker).toContain("claim_due_sms_campaign_for_enqueue");
    expect(enqueueWorker).toContain("claim_sms_campaign_enqueue");
    expect(enqueueWorker).toContain('["queued", "sending"]');
  });

  it("preserves persona targeting instead of falling through to all subscribers", () => {
    expect(enqueueWorker).toContain("get_sms_persona_recipient_page");
    expect(migration).toContain(
      "assignment.persona_id = ANY(v_campaign.targeting_persona_ids)",
    );
    expect(migration).toContain(
      "lower(coalesce(v_campaign.targeting_logic, 'any'))",
    );
  });

  it("uses the same consent-safe count for immediate and scheduled sends", () => {
    expect(sendCampaign).toContain("count_sms_campaign_recipients");
    expect(migration).toContain("customer.sms_opt_in_at IS NOT NULL");
    expect(migration).toContain(
      "nullif(customer.sms_consent_source, '') IS NOT NULL",
    );
    expect(migration).toContain("NOT coalesce(customer.opt_out, false)");
    expect(migration).toContain("NOT coalesce(customer.suppressed, false)");
  });

  it("queues Send Now and blocks empty audiences", () => {
    expect(wizard).toContain('"SMS campaign queued for sending"');
    expect(wizard).toContain('functions.invoke("send-sms-campaign"');
    expect(wizard).toContain("recipientEstimate > 0");
    expect(legacyComposer).toContain("body: { campaignId: savedCampaign.id }");
    expect(legacyComposer).not.toContain("body: { campaign_id:");
    expect(legacyComposer).not.toContain("status: sendNow ? 'sent'");
  });

  it("authorizes tenant senders and the internal scheduled worker", () => {
    expect(sendCampaign).toContain("isInternalRequest");
    expect(sendCampaign).toContain(
      "You do not have permission to send this campaign",
    );
    expect(sendCampaign).toContain('["owner", "admin", "team", "marketing"]');
  });
});
import {checkSmsCampaignContent, checkSmsMessageCampaignContent} from "../../supabase/functions/_shared/smsCampaignContentGate";

describe("SMS website content dispatch gate", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const source = {siteId: "00000000-0000-4000-8000-000000000002", itemId: "00000000-0000-4000-8000-000000000003", type: "page", updatedAt: "2026-11-21T12:00:00Z", publicUrl: "https://garden.example/page"};
  const campaign = {id: "campaign", tenant_id: tenantId, status: "queued", audience_confirmed: true, connected_content_sources: [source], metrics: {delivered: 2}};
  const database = (row: unknown = campaign) => {
    const writes: Record<string, unknown>[] = [];
    const scopes: unknown[][] = [];
    const db = {rpc: async (name: string, args: Record<string, unknown>) => {
      writes.push({rpc: name, ...args}); return {data: true, error: null};
    }, from: (table: string) => {
      let write: Record<string, unknown> | null = null;
      const chain = {
        select: () => chain,
        update: (value: Record<string, unknown>) => {write = value; writes.push(value); return chain;},
        eq: (...args: unknown[]) => {scopes.push(args); return chain;},
        in: () => chain,
        maybeSingle: async () => ({data: row, error: null}),
        then: (resolve: (value: {data: unknown; error: null}) => unknown) => Promise.resolve({data: write ? null : table === "crm_connected_websites" ? [{cms_site_id: source.siteId}] : row, error: null}).then(resolve),
      };
      return chain;
    }};
    return {db: db as unknown as Parameters<typeof checkSmsCampaignContent>[0], writes, scopes};
  };
  const published = (changes: Record<string, unknown> = {}) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({siteId: source.siteId, siteOrigin: "https://garden.example", items: [{id: source.itemId, siteId: source.siteId, type: source.type, updatedAt: source.updatedAt, publicUrl: source.publicUrl, ...changes}]}), {status: 200}));
  it("checks the saved source at provider dispatch and preserves current delivery metrics", async () => {
    const {db, writes, scopes} = database();
    const fetcher = published({updatedAt: "2026-11-21T13:00:00Z"});
    expect((await checkSmsMessageCampaignContent(db, campaign.id, tenantId, fetcher)).decision).toBe("review_required");
    expect(scopes).toContainEqual(["tenant_id", tenantId]);
    expect(writes).toEqual([{rpc: "record_sms_content_review", p_tenant_id: tenantId, p_campaign_id: campaign.id, p_expected_status: "queued", p_decision: "review_required", p_reason: expect.any(String)}]);
    expect(writes[0]).not.toHaveProperty("metrics");
  });
  it("retries unavailable source checks without pausing or sending", async () => {
    const {db, writes} = database();
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    expect((await checkSmsCampaignContent(db, campaign, fetcher)).decision).toBe("retry");
    expect(writes[0]).not.toHaveProperty("status");
    expect(writes[0]).toEqual(expect.objectContaining({rpc: "record_sms_content_review", p_decision: "retry"}));
  });
  it("requires audience confirmation and explicit resume for paused linked campaigns", async () => {
    const fetcher = published();
    const {db} = database({...campaign, status: "paused"});
    expect((await checkSmsMessageCampaignContent(db, campaign.id, tenantId, fetcher)).decision).toBe("review_required");
    expect((await checkSmsCampaignContent(db, {...campaign, audience_confirmed: false}, fetcher)).decision).toBe("review_required");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not pause terminal campaigns or rewrite their review metrics", async () => {
    const {db, writes} = database();
    const fetcher = published();
    for (const status of ["sent", "completed", "failed", "cancelled"]) {
      expect((await checkSmsCampaignContent(db, {...campaign,status}, fetcher)).decision).toBe("review_required");
    }
    expect(writes).toEqual([]); expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not alter automation messages or ordinary campaigns without sources", async () => {
    const {db, writes} = database({...campaign, status: "sent", connected_content_sources: []});
    const fetcher = published();
    expect((await checkSmsMessageCampaignContent(db, null, tenantId, fetcher)).decision).toBe("fresh");
    expect((await checkSmsMessageCampaignContent(db, campaign.id, tenantId, fetcher)).decision).toBe("fresh");
    expect(fetcher).not.toHaveBeenCalled(); expect(writes).toEqual([]);
  });
  it("fails closed for unavailable or malformed campaign sources", async () => {
    const fetcher = published();
    expect((await checkSmsMessageCampaignContent(database(null).db, campaign.id, tenantId, fetcher)).decision).toBe("review_required");
    expect((await checkSmsCampaignContent(database().db, {...campaign, connected_content_sources: "bad"}, fetcher)).decision).toBe("review_required");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("enforces manual, scheduled, job and legacy paths before provider calls", () => {
    const sender = readFileSync("supabase/functions/send-sms-campaign/index.ts", "utf8");
    const enqueue = readFileSync("supabase/functions/sms-campaign-enqueue-worker/index.ts", "utf8");
    const worker = readFileSync("supabase/functions/sms-queue-worker/index.ts", "utf8");
    expect(sender.indexOf("checkSmsCampaignContent(supabase, campaign)")).toBeLessThan(sender.indexOf('// Step B:'));
    expect(enqueue.indexOf("checkSmsCampaignContent(supabase, campaign)")).toBeLessThan(enqueue.indexOf('// Step 3: Atomic claim'));
    expect(worker.match(/await deferIfCampaignContentBlocked/g)).toHaveLength(2);
    expect(worker).toContain("attempts: Math.max(0, job.attempts - 1)");
    expect(worker).toContain(".in('status', ['queued', 'sending'])");
    expect(worker).toContain("CONTENT_CHECK_RETRY");
    expect(worker).toContain("CONTENT_REVIEW_REQUIRED");
  });
});
