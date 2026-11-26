import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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


// Exercise the real adapter and wizard without creating live drafts or sending texts.
import * as React from "react";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ConnectedSmsReview} from "@/components/sms/ConnectedSmsReview";
import {SMSCampaignWizard} from "@/components/sms/SMSCampaignWizard";
import {loadConnectedSmsDraft, saveConnectedSmsDraft, type SmsCampaignDraft} from "@/lib/sms/campaignDraft";
const mocks = vi.hoisted(() => ({rpc: vi.fn(), invoke: vi.fn(), eq: vi.fn(), row: {} as Record<string, unknown> & {message: string}, navigate: vi.fn(), error: null as null | {message: string}, empty: []}));
vi.mock("react-router-dom", () => ({useNavigate: () => mocks.navigate, useSearchParams: () => [new URLSearchParams("draftId=draft-123")]}));
vi.mock("@/hooks/useTenant", () => ({useTenant: () => ({tenant: {id: "tenant-123"}, loading: false})}));
vi.mock("@/hooks/useAuth", () => ({useAuth: () => ({user: {id: "user-123"}})}));
vi.mock("@/hooks/useSegments", () => ({useSegments: () => ({allSegments: mocks.empty, isLoading: false})}));
vi.mock("@/hooks/useAllPersonas", () => ({useAllPersonas: () => ({personas: mocks.empty, loading: false})}));
vi.mock("sonner", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
vi.mock("@/integrations/supabase/client", () => ({supabase: {
  rpc: mocks.rpc, functions: {invoke: mocks.invoke},
  from: () => {
    const chain = {
      select: () => chain,
      eq: (...args: unknown[]) => {mocks.eq(...args); return chain;},
      not: () => chain, is: () => chain,
      maybeSingle: async () => ({data: mocks.error ? null : mocks.row, error: mocks.error}),
      then: (resolve: (value: {count: number; error: null}) => unknown) => Promise.resolve({count: 5, error: null}).then(resolve),
    };
    return chain;
  },
}}));

describe("promoted SMS draft adapter", () => {
  beforeEach(() => {
    mocks.rpc.mockReset(); mocks.eq.mockReset(); mocks.invoke.mockReset(); mocks.navigate.mockReset(); mocks.error = null;
    mocks.row = {id: "draft-123", tenant_id: "tenant-123", name: "Promote garden workshop", message: "Workshop details https://garden.example/event", media_urls: [], status: "draft", source: "connected_content", updated_at: "2026-11-21T12:00:00Z", connected_content_sources: [{siteId: "site", itemId: "event", type: "event", updatedAt: "v1", publicUrl: "https://garden.example/event"}], audience_confirmed: false};
    mocks.rpc.mockResolvedValue({data: {...mocks.row, updated_at: "2026-11-21T12:01:00Z"}, error: null});
  });
  afterEach(cleanup);
  it("loads only the requested business's editable connected-content draft", async () => {
    expect((await loadConnectedSmsDraft("tenant-123", "draft-123")).message).toContain("Workshop details");
    for (const pair of [["tenant_id", "tenant-123"], ["id", "draft-123"], ["status", "draft"], ["source", "connected_content"]]) expect(mocks.eq).toHaveBeenCalledWith(...pair);
    mocks.error = {message: "forbidden"};
    await expect(loadConnectedSmsDraft("other-tenant", "draft-123")).rejects.toThrow("unavailable");
  });
  it("does not reopen a superseded draft even if its status was reset", async () => {
    mocks.row.metrics = {replacement_campaign_id: "new"};
    await expect(loadConnectedSmsDraft("tenant-123", "draft-123")).rejects.toThrow("replaced");
    render(React.createElement(ConnectedSmsReview,{campaign: mocks.row as unknown as SmsCampaignDraft}));
    expect(screen.getByRole("button",{name:"Open replacement campaign"})).toBeInTheDocument();
  });
  it("saves unscheduled with no audience and propagates stale-edit rejection", async () => {
    await saveConnectedSmsDraft({tenantId: "tenant-123", id: "draft-123", expectedUpdatedAt: "v1", name: "Edited", message: "Edited copy"});
    expect(mocks.rpc).toHaveBeenCalledWith("save_connected_sms_draft", expect.objectContaining({p_campaign_id: "draft-123", p_tenant_id: "tenant-123", p_expected_updated_at: "v1", p_audience: null, p_launch: false, p_scheduled_at: null}));
    expect(mocks.invoke).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({data: null, error: {message: "This draft changed in another window"}});
    await expect(saveConnectedSmsDraft({tenantId: "tenant-123", name: "Edited", message: "Edited copy"})).rejects.toThrow("another window");
  });
  const mountWizard = () => render(React.createElement(QueryClientProvider, {client: new QueryClient({defaultOptions: {queries: {retry: false}}})}, React.createElement(SMSCampaignWizard)));
  it("reopens editable copy, requires audience selection, and saves the same draft", async () => {
    mountWizard();
    const name = await screen.findByPlaceholderText("Weekend perks reminder");
    expect(name).toHaveValue("Promote garden workshop");
    fireEvent.change(name, {target: {value: "Edited workshop"}});
    fireEvent.click(screen.getByRole("button", {name: "Save draft"}));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("save_connected_sms_draft", expect.objectContaining({p_campaign_id: "draft-123", p_expected_updated_at: "2026-11-21T12:00:00Z", p_name: "Edited workshop", p_message: mocks.row.message, p_audience: null, p_launch: false})));
    fireEvent.click(screen.getByRole("button", {name: "Next"}));
    expect(screen.getByRole("button", {name: "Next"})).toBeDisabled();
    fireEvent.click(screen.getByText("All Subscribers"));
    fireEvent.click(screen.getByRole("button", {name: "Next"}));
    const message = screen.getByPlaceholderText(/your weekend offer is live/);
    expect(message).toHaveValue(mocks.row.message);
    fireEvent.change(message, {target: {value: "Edited text. Reply STOP to opt out."}});
    fireEvent.click(screen.getByRole("button", {name: "Save draft"}));
    await waitFor(() => expect(mocks.rpc).toHaveBeenLastCalledWith("save_connected_sms_draft", expect.objectContaining({p_campaign_id: "draft-123", p_expected_updated_at: "2026-11-21T12:01:00Z", p_message: "Edited text. Reply STOP to opt out.", p_launch: false})));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("fails closed for unavailable drafts instead of opening an empty composer", async () => {
    mocks.error = {message: "not found"};
    mountWizard();
    expect(await screen.findByText(/This text draft is unavailable/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Weekend perks reminder")).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  const reviewCampaign = () => ({...mocks.row, status: "paused", metrics: {content_review: {decision: "review_required", reason: "Website details changed."}}}) as unknown as SmsCampaignDraft;
  const latestWebsite = () => ({data: {items: [{id: "event", siteId: "site", type: "event", title: "Updated workshop", description: "Current details", publicUrl: "https://garden.example/event", imageUrl: null, updatedAt: "2026-11-21T13:00:00Z", startAt: null, eventStatus: "available"}], sources: [], errors: []}, error: null});
  it("previews latest content without writing, then explicitly replaces unsent work with a new draft", async () => {
    mocks.invoke.mockResolvedValue(latestWebsite());
    mocks.rpc.mockResolvedValue({data: {...mocks.row,id: "replacement-456"},error:null});
    render(React.createElement(ConnectedSmsReview,{campaign: reviewCampaign()}));
    expect(screen.getByText("Website details changed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Review latest website content"}));
    const create=await screen.findByRole("button",{name:"Create updated text draft"});
    expect(screen.getByText(String(mocks.row.message))).toBeInTheDocument();
    expect(screen.getByText(/Updated workshop/)).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(create);fireEvent.click(create);
    await waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith("/sms/new?draftId=replacement-456"));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("replace_connected_sms_draft",expect.objectContaining({p_tenant_id:"tenant-123",p_campaign_id:"draft-123",p_expected_updated_at:"2026-11-21T12:00:00Z",p_message:expect.stringContaining("Updated workshop"),p_sources:[expect.objectContaining({updatedAt:"2026-11-21T13:00:00Z"})]}));
  });
  it("cancelling review keeps the original text and creates nothing", async () => {
    mocks.invoke.mockResolvedValue(latestWebsite());
    render(React.createElement(ConnectedSmsReview,{campaign:reviewCampaign()}));
    fireEvent.click(screen.getByRole("button",{name:"Review latest website content"}));
    await screen.findByRole("button",{name:"Create updated text draft"});
    fireEvent.click(screen.getByRole("button",{name:"Close dialog"}));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("prevents a replacement when the source is cancelled or cannot be checked", async () => {
    const result=latestWebsite();result.data.items[0].eventStatus="cancelled";
    mocks.invoke.mockResolvedValue(result);
    render(React.createElement(ConnectedSmsReview,{campaign:reviewCampaign()}));
    fireEvent.click(screen.getByRole("button",{name:"Review latest website content"}));
    expect(await screen.findByText(/not available to promote/)).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Create updated text draft"})).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("enforces the no-audience boundary and optimistic editing in the database", () => {
    const sql = readFileSync("supabase/migrations/20261122060000_connected_content_sms_drafts.sql", "utf8");
    expect(sql).toContain("public.has_tenant_permission(p_tenant_id, 'campaign.write'");
    expect(sql).toContain("audience_confirmed OR (status = 'draft' AND scheduled_at IS NULL)");
    expect(sql).toContain("tenant_id=p_tenant_id AND source='connected_content' FOR UPDATE");
    expect(sql).toContain("v_campaign.updated_at <> p_expected_updated_at");
    expect(sql).toContain("connection.tenant_id = p_tenant_id AND connection.status = 'active'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION");
  });
});


describe("connected SMS draft schema", () => {
  const sql = readFileSync("supabase/migrations/20261122060000_connected_content_sms_drafts.sql", "utf8");
  it("requires save and launch permissions separately", () => {
    expect(sql).toContain("auth.uid() IS NULL");
    expect(sql).toContain("public.has_tenant_permission(p_tenant_id, 'campaign.write'");
    expect(sql).toContain("p_launch AND NOT public.has_tenant_permission(p_tenant_id, 'campaign.send'");
    expect(sql).toContain("FROM PUBLIC, anon");
  });
  it("keeps unconfirmed audiences out of schedules and queues", () => {
    expect(sql).toContain("audience_confirmed OR (status = 'draft' AND scheduled_at IS NULL)");
    expect(sql).toContain("p_launch OR p_audience IS NOT NULL OR p_scheduled_at IS NOT NULL");
    expect(sql).toContain("Choose an audience and write a message before launch");
  });
  it("preserves source binding and rejects stale cross-business draft edits", () => {
    expect(sql).toContain("connection.tenant_id = p_tenant_id AND connection.status = 'active'");
    expect(sql).toContain("tenant_id=p_tenant_id AND source='connected_content' FOR UPDATE");
    expect(sql).toContain("v_campaign.updated_at <> p_expected_updated_at");
    expect(sql).not.toContain("SET connected_content_sources");
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
  it("never reopens superseded or review-held campaigns even when sources revert or disappear", async () => {
    for (const metrics of [{replacement_campaign_id: "new-draft"}, {content_review: {decision: "review_required"}}]) {
      for (const connected_content_sources of [[source], []]) {
        const row = {...campaign, metrics, connected_content_sources};
        const {db, writes} = database(row);
        const fetcher = published();
        expect((await checkSmsCampaignContent(db, row, fetcher)).decision).toBe("review_required");
        expect((await checkSmsMessageCampaignContent(db, row.id, tenantId, fetcher)).decision).toBe("review_required");
        expect(fetcher).not.toHaveBeenCalled(); expect(writes).toEqual([]);
      }
    }
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

describe("connected campaign review schema", () => {
  const sql=readFileSync("supabase/migrations/20261122070000_replace_connected_sms_draft.sql","utf8");
  it("requires scoped explicit replacement and preserves delivered message history", () => {
    expect(sql).toContain("tenant_id=p_tenant_id AND source='connected_content' FOR UPDATE");
    expect(sql).toContain("v_original.status <> 'paused'");
    expect(sql).toContain("v_original.updated_at <> p_expected_updated_at");
    expect(sql).toContain("status='queued' AND twilio_sid IS NULL");
    expect(sql).toContain("replacement_campaign_id");
    expect(sql).toContain("p_sources,NULL,false,NULL");
  });
  it("atomically merges only service-authenticated review metadata", () => {
    expect(sql).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(sql).toContain("jsonb_set(coalesce(metrics,'{}'::jsonb),'{content_review}'");
    expect(sql).toContain("status=p_expected_status");
    expect(sql).toContain("status IN ('draft','scheduled','queued','sending','paused')");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
  });
  it("distinguishes legacy email payloads from explicit source snapshots", () => {
    expect(sql).toContain("public.email_messages ADD COLUMN connected_content_sources jsonb");
    expect(sql).toContain("connected_content_sources IS NULL OR jsonb_typeof(connected_content_sources)='array'");
  });
});

import {SmsCampaignActions} from "@/components/sms/SmsCampaignActions";
describe("SMS content hold actions", () => {
  afterEach(cleanup);
  it("hides resume and retry on reviewed or superseded work while retaining exports", () => {
    render(React.createElement(SmsCampaignActions,{campaignId:"held",status:"paused",failedCount:2,deliveryBlocked:true}));
    expect(screen.queryByRole("button",{name:"Resume"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/Retry failed/})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Export failed CSV"})).toBeInTheDocument();
  });
});
