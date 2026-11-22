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
import {SMSCampaignWizard} from "@/components/sms/SMSCampaignWizard";
import {loadConnectedSmsDraft, saveConnectedSmsDraft} from "@/lib/sms/campaignDraft";
const mocks = vi.hoisted(() => ({rpc: vi.fn(), invoke: vi.fn(), eq: vi.fn(), row: {} as Record<string, unknown>, navigate: vi.fn(), error: null as null | {message: string}, empty: []}));
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
