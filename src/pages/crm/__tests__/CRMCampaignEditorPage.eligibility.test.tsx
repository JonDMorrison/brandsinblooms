import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

// The page and the Ready to send dialog both run the real eligibility hook.
// Only the RPC is faked, so these tests prove every surface reads the one
// server answer (public.email_campaign_eligibility) and nothing else.
// Nothing here can send: activate() is a mock and no edge function is called.
const editor = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/components/crm/campaign-editor/CampaignEditorContext", () => ({
  CampaignEditorProvider: ({ children }: { children: React.ReactNode }) => children,
  useCampaignEditor: () => editor.current,
}));
const designSystem = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/contexts/DesignSystemContext", () => ({
  DesignSystemProvider: ({ children }: { children: React.ReactNode }) => children,
  useDesignSystem: () => ({ designSystem: designSystem.current, isLoading: false }),
  useOptionalDesignSystem: () => ({ designSystem: designSystem.current, isLoading: false }),
}));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenant: { id: "tenant-test" }, loading: false }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-test", email: "owner@fernhill.com" } }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ hasPermission: () => true, tenantId: "tenant-test" }) }));
vi.mock("@/hooks/useEmailDomains", () => ({
  useEmailDomains: () => ({
    emailDomains: [{ domain: "fernhill.com", status: "active", default_from_email: "news@fernhill.com" }],
    loading: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ data: [], totalCount: 0, isLoading: false }) }));
vi.mock("@/hooks/usePersonaTargetingAvailable", () => ({ usePersonaTargetingAvailable: () => ({ available: false }) }));
vi.mock("@/hooks/useThisWeeksTheme", () => ({ useThisWeeksTheme: () => ({ data: null, isLoading: false, isFetched: true }) }));
vi.mock("@/hooks/useSavedTemplates", () => ({
  useSavedTemplates: () => ({
    savedTemplates: [],
    saveTemplate: vi.fn(),
    renameTemplate: vi.fn(),
    archiveTemplate: vi.fn(),
    isSaving: false,
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useCampaignTemplateLock", () => ({
  useCampaignTemplateLock: () => ({
    lock: null,
    record: vi.fn().mockResolvedValue(true),
    release: { isPending: false, mutate: vi.fn() },
  }),
}));
vi.mock("@/lib/crm/campaignOrganization", () => ({
  campaignOrganizationClient: { rpc: vi.fn() },
  useCampaignOrganization: () => ({
    data: { groups: [], memberships: [], colours: [] },
    error: null,
    mutation: { mutate: vi.fn(), isPending: false, error: null },
  }),
}));
// Dialog-only reads that are not about eligibility.
vi.mock("@/hooks/useCampaignApproval", () => ({ useCampaignApproval: () => ({ approval: null, error: null }) }));
vi.mock("@/components/crm/campaign-editor/CampaignApprovalPanel", () => ({ CampaignApprovalPanel: () => null }));
vi.mock("@/hooks/usePreviousCampaignRecipientCount", () => ({
  usePreviousCampaignRecipientCount: () => ({ data: null }),
}));
vi.mock("@/hooks/useTenantEmailHealthDashboard", () => ({
  useTenantEmailHealthDashboard: () => ({ data: { reputation_score: 90 }, isLoading: false }),
}));
vi.mock("@/components/crm/campaign-editor/SenderVerificationDialog", () => ({ SenderVerificationDialog: () => null }));
vi.mock("@/components/crm/studio/StudioPreviewDialog", () => ({ default: () => null }));

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => {
  const result = Promise.resolve({ data: [], error: null });
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "not", "or", "limit"]) {
    chain[method] = () => chain;
  }
  chain.then = result.then.bind(result);
  return {
    supabase: {
      from: () => chain,
      rpc,
      functions: { invoke: () => Promise.resolve({ data: { suggestions: [] }, error: null }) },
    },
  };
});

import CRMCampaignEditorPage from "../CRMCampaignEditorPage";

const blocks: StudioBlock[] = [
  { id: "hero-1", type: "email-safe-hero", label: "Hero", order: 0, visible: true, headline: "Winter wreaths", body: "Join us." },
  { id: "footer-1", type: "footer", label: "Footer", order: 1, visible: true, businessName: "Fernhill Gardens", businessNameSource: "custom" },
];

const SEGMENT = { id: "b2cb2978-2d77-407b-99be-ab881e99468d", name: "Email Subscribers" };

function readyDraft(patch: Record<string, unknown> = {}) {
  return {
    campaignId: "campaign-test",
    campaignType: "email",
    status: "draft",
    sendBlockedReason: null,
    name: "November garden news",
    subjectLine: "Winter wreath workshops are back",
    preheaderText: "Join us November 14.",
    senderName: "Fernhill Gardens",
    senderEmail: "news@fernhill.com",
    replyTo: "",
    selectedSegments: [SEGMENT],
    selectedPersonas: [],
    includeAllCustomers: false,
    additionalCustomerIds: [],
    // The raw audience size. It must never stand in for eligibility.
    audienceCount: 7600,
    isAudienceLoading: false,
    contentBlocks: blocks,
    smsMessage: "",
    sendAt: null,
    sendImmediately: true,
    isLoading: false,
    isLocked: false,
    isSaving: false,
    isDirty: false,
    lastSavedAt: new Date(),
    autoSaveStatus: "saved",
    autoSaveMessage: null,
    origin: null,
    isTenantReady: true,
    updateSetup: vi.fn(),
    updateAudience: vi.fn(),
    updateContent: vi.fn(),
    updateSchedule: vi.fn(),
    saveDraft: vi.fn().mockResolvedValue("campaign-test"),
    setOrigin: vi.fn(),
    activate: vi.fn(),
    ...patch,
  };
}

/** One email_campaign_eligibility row. */
function eligibilityRow(patch: Record<string, number | string | boolean | null> = {}) {
  return {
    audience_configured: true,
    total: 7600,
    eligible: 0,
    waiting: 0,
    asked_to_stop: 0,
    never_opted_in: 0,
    unsendable: 7600,
    duplicates: 0,
    blocked: 7600,
    eligible_with_consent_override: 0,
    eligible_with_soft_override: 0,
    eligible_with_both_overrides: 0,
    single_eligible_email: null,
    ...patch,
  };
}

function mockEligibility(row: ReturnType<typeof eligibilityRow> | "pending") {
  rpc.mockImplementation((name: string) => {
    if (name !== "email_campaign_eligibility") return Promise.resolve({ data: null, error: null });
    if (row === "pending") return new Promise(() => {});
    return Promise.resolve({ data: [row], error: null });
  });
}

function renderEditor(url = "/crm/campaigns/campaign-test/edit") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/crm/campaigns/:campaignId/edit" element={<CRMCampaignEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const audienceStep = () => document.getElementById("campaign-editor-audience") as HTMLElement;
const dialog = () => screen.getByRole("dialog");
const primarySend = () => within(dialog()).getByRole("button", { name: /send to|schedule for|checking audience|no one in this audience/i });

beforeEach(() => {
  designSystem.current = buildStudioDesignSystem({
    name: "Fernhill Gardens",
    streetAddress: "12 Fern Road",
    city: "Victoria",
    stateProvince: "BC",
    postalCode: "V8V 1A1",
  });
  Element.prototype.scrollIntoView = vi.fn();
  editor.current = readyDraft();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("email eligibility gating (Northfield Email Subscribers shape)", () => {
  it("keeps Schedule and Send disabled when 0 are eligible", async () => {
    mockEligibility(eligibilityRow());
    renderEditor("/crm/campaigns/campaign-test/edit?action=send");

    const bar = await screen.findByTestId("campaign-readiness-bar");
    expect(within(bar).getByText(/No one in this audience can receive email/)).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: /Go to Audience/, hidden: true })).toHaveAttribute("href", "#campaign-editor-audience");
    expect(screen.getByTestId("campaign-editor-schedule-cta")).toBeDisabled();
    // Amber badge on the Audience step.
    expect(within(audienceStep()).getByTestId("campaign-step-badge-attention")).toBeInTheDocument();

    // Even when opened directly, the dialog never offers 7,600 approved recipients.
    await waitFor(() => expect(primarySend()).toHaveTextContent("No one in this audience can receive email"));
    expect(primarySend()).toBeDisabled();
    expect(within(dialog()).queryByText("Campaign is ready")).toBeNull();
    expect(within(dialog()).getByTestId("send-stat-approved")).toHaveTextContent("0");
    expect(within(dialog()).queryByText(/7,600 approved/)).toBeNull();
    expect(within(dialog()).getByRole("button", { name: "Choose send time" })).toBeDisabled();
  });

  it("shows the same eligible count in the panel, the badge summary and the dialog", async () => {
    mockEligibility(eligibilityRow({
      total: 1500, eligible: 1234, unsendable: 200, waiting: 30, never_opted_in: 20, asked_to_stop: 10,
      duplicates: 6, blocked: 210, eligible_with_consent_override: 1254,
      eligible_with_soft_override: 1240, eligible_with_both_overrides: 1260,
    }));
    // step=review opens the Audience step, where the panel lives.
    renderEditor("/crm/campaigns/campaign-test/edit?step=review&action=send");

    await waitFor(() => expect(screen.getByTestId("audience-bucket-eligible")).toHaveTextContent("1,234"));
    // Collapsed, the step summary carries the same count.
    fireEvent.click(audienceStep().querySelector("[data-campaign-step-toggle]") as HTMLElement);
    expect(within(audienceStep()).getByText(/1,234 can receive email/)).toBeInTheDocument();
    expect(within(audienceStep()).getByTestId("campaign-step-badge-done")).toBeInTheDocument();
    expect(screen.queryByTestId("campaign-readiness-bar")).toBeNull();
    expect(screen.getByTestId("campaign-editor-schedule-cta")).not.toBeDisabled();

    await waitFor(() => expect(within(dialog()).getByTestId("send-stat-approved")).toHaveTextContent("1,234"));
    expect(primarySend()).toHaveTextContent("Send to 1,234 approved recipients");
    expect(primarySend()).not.toBeDisabled();
    expect(within(dialog()).getByText("Campaign is ready")).toBeInTheDocument();
    // Both surfaces asked the same server function with the same audience.
    const calls = rpc.mock.calls.filter(([name]) => name === "email_campaign_eligibility");
    expect(calls.length).toBeGreaterThan(0);
    for (const [, args] of calls) {
      expect(args).toEqual({
        p_tenant_id: "tenant-test",
        p_include_all_customers: false,
        p_segment_ids: [SEGMENT.id],
        p_persona_ids: [],
        p_customer_ids: [],
      });
    }
  });

  it("keeps Send disabled and shows skeletons, not 000, while the check is loading", async () => {
    mockEligibility("pending");
    renderEditor("/crm/campaigns/campaign-test/edit?action=send");

    const schedule = screen.getByTestId("campaign-editor-schedule-cta");
    expect(schedule).toBeDisabled();
    expect(schedule).toHaveTextContent("Checking audience");
    expect(screen.getByTestId("campaign-readiness-checking")).toHaveTextContent("Checking audience");
    expect(within(audienceStep()).getByTestId("campaign-step-badge-checking")).toBeInTheDocument();

    await waitFor(() => expect(primarySend()).toHaveTextContent("Checking audience"));
    expect(primarySend()).toBeDisabled();
    expect(within(dialog()).getByTestId("send-stat-approved-skeleton")).toBeInTheDocument();
    expect(within(dialog()).queryByText("000")).toBeNull();
    expect(within(dialog()).queryByText("Campaign is ready")).toBeNull();
    expect(within(dialog()).queryByText(/7,600/)).toBeNull();
  });
});
