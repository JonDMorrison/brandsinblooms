import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

// The editor's data comes from CampaignEditorContext. These tests replace it
// with a fixed draft so they check the layout, not the save pipeline.
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
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ hasPermission: () => true, tenantId: "tenant-test" }) }));
vi.mock("@/hooks/useEmailDomains", () => ({
  useEmailDomains: () => ({
    emailDomains: [{ domain: "fernhill.com", status: "active", default_from_email: "news@fernhill.com" }],
    loading: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ data: [], totalCount: 0, isLoading: false }) }));
vi.mock("@/hooks/useCampaignEmailEligibility", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCampaignEmailEligibility")>(
    "@/hooks/useCampaignEmailEligibility",
  );
  return {
    ...actual,
    // A finished check with people to send to; eligibility gating has its own test.
    useCampaignEmailEligibility: () => ({
      data: {
        audienceConfigured: true, total: 120, eligible: 120, waiting: 0, askedToStop: 0,
        neverOptedIn: 0, unsendable: 0, duplicates: 0, blocked: 0,
        eligibleWithConsentOverride: 120, eligibleWithSoftOverride: 120,
        eligibleWithBothOverrides: 120, singleEligibleEmail: null,
      },
      isError: false,
      gate: "ready",
    }),
  };
});
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
    data: {
      groups: [{ id: "december", name: "December", colour: "#795548" }],
      memberships: [{ campaign_id: "campaign-test", group_id: "december" }],
      colours: [],
    },
    error: null,
    mutation: { mutate: vi.fn(), isPending: false, error: null },
  }),
}));
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
      rpc: () => Promise.resolve({ data: null, error: null }),
      functions: { invoke: () => Promise.resolve({ data: { suggestions: [] }, error: null }) },
    },
  };
});
// Dialogs that only open on request; they are covered by their own tests.
vi.mock("@/components/crm/campaign-editor/CampaignSendConfirmation", () => ({ CampaignSendConfirmation: () => null }));
vi.mock("@/components/crm/campaign-editor/SenderVerificationDialog", () => ({ SenderVerificationDialog: () => null }));
vi.mock("@/components/crm/studio/StudioPreviewDialog", () => ({ default: () => null }));

import CRMCampaignEditorPage from "../CRMCampaignEditorPage";

const blocks: StudioBlock[] = [
  {
    id: "hero-1",
    type: "email-safe-hero",
    label: "Hero",
    order: 0,
    visible: true,
    headline: "Winter wreath workshops",
    body: "Join us November 14.",
  },
  {
    id: "footer-1",
    type: "footer",
    label: "Footer",
    order: 1,
    visible: true,
    businessName: "Oakridge Nursery",
    businessNameSource: "custom",
  },
];

function draft(patch: Record<string, unknown> = {}) {
  return {
    campaignId: "campaign-test",
    campaignType: "email",
    status: "draft",
    sendBlockedReason: null,
    name: "November garden news",
    subjectLine: "",
    preheaderText: "",
    senderName: "Fernhill Gardens",
    senderEmail: "news@fernhill.com",
    replyTo: "",
    selectedSegments: [],
    selectedPersonas: [],
    includeAllCustomers: false,
    additionalCustomerIds: [],
    audienceCount: 0,
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
    ...patch,
  };
}

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/crm/campaigns/campaign-test/edit"]}>
        <Routes>
          <Route path="/crm/campaigns/:campaignId/edit" element={<CRMCampaignEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const stepToggle = (name: RegExp) =>
  screen.getAllByRole("button", { name }).find((button) => button.hasAttribute("data-campaign-step-toggle")) as HTMLElement;

beforeEach(() => {
  designSystem.current = buildStudioDesignSystem({ name: "Fernhill Gardens" });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("campaign editor layout", () => {
  it("shows the steps in order: Design, Inbox, Audience, Sender, Organize", () => {
    editor.current = draft();
    const { container } = renderEditor();
    const toggles = Array.from(container.querySelectorAll<HTMLElement>("[data-campaign-step-toggle]"));
    expect(toggles.map((toggle) => toggle.textContent)).toEqual([
      expect.stringContaining("Design"),
      expect.stringContaining("Inbox"),
      expect.stringContaining("Audience"),
      expect.stringContaining("Sender"),
      expect.stringContaining("Organize"),
    ]);
    expect(toggles.map((toggle) => toggle.textContent?.match(/Step (\d)/)?.[1])).toEqual(["1", "2", "3", "4", "5"]);
    // Step headers are real buttons that report whether they are open.
    for (const toggle of toggles) {
      expect(toggle.tagName).toBe("BUTTON");
      expect(toggle).toHaveAttribute("aria-expanded");
    }
    // Organize (groups and colour) starts collapsed.
    expect(stepToggle(/Organize/)).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(stepToggle(/Organize/));
    expect(stepToggle(/Organize/)).toHaveAttribute("aria-expanded", "true");
    // The old "Campaign details" section is gone; its name field is the heading.
    expect(screen.queryByText("Campaign details")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toContainElement(
      screen.getByRole("textbox", { name: "Campaign name" }),
    );
    expect(within(screen.getByTestId("campaign-editor-header")).getByText("December")).toBeInTheDocument();
  });

  it("lists the blocking send checks and jumps to the first one", () => {
    editor.current = draft();
    renderEditor();
    const bar = screen.getByTestId("campaign-readiness-bar");
    expect(within(bar).getByText("Subject line is required.")).toBeInTheDocument();
    expect(within(bar).getByText("Choose an audience before sending.")).toBeInTheDocument();
    expect(within(bar).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByTestId("campaign-editor-schedule-cta")).toBeDisabled();

    // Close the Inbox step first: the link must open it again.
    fireEvent.click(stepToggle(/Inbox/));
    expect(stepToggle(/Inbox/)).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(within(bar).getByRole("link", { name: /Add a subject line/ }));
    expect(stepToggle(/Inbox/)).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("campaign-editor-inbox")?.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById("campaign-editor-subject"));
  });

  it("hides the readiness bar when nothing blocks sending", () => {
    editor.current = draft({
      subjectLine: "Winter wreath workshops are back this month",
      preheaderText: "Join us November 14.",
      includeAllCustomers: true,
      audienceCount: 120,
      contentBlocks: blocks.map((block) =>
        block.type === "footer" ? { ...block, businessName: "Fernhill Gardens" } : block,
      ),
    });
    renderEditor();
    expect(screen.queryByTestId("campaign-readiness-bar")).toBeNull();
    expect(screen.getByTestId("campaign-editor-schedule-cta")).not.toBeDisabled();
  });

  it("copies the From name into the footer business name that does not match", () => {
    const updateContent = vi.fn();
    editor.current = draft({ updateContent });
    renderEditor();
    fireEvent.click(stepToggle(/Sender/));
    const footerField = screen.getByLabelText("Footer business name");
    expect(footerField).toHaveValue("Oakridge Nursery");
    // The existing identity check is shown under the field it concerns.
    const warnings = screen.getAllByTestId("sender-mismatch-footerBusinessName");
    expect(warnings[0]).toHaveTextContent("doesn’t match the footer business name (“Oakridge Nursery”)");

    fireEvent.click(within(warnings[0]).getByRole("button", { name: "Use From name" }));
    expect(updateContent).toHaveBeenCalledTimes(1);
    const next = updateContent.mock.calls[0][0].contentBlocks as StudioBlock[];
    expect(next.find((block) => block.type === "footer")).toMatchObject({
      businessName: "Fernhill Gardens",
      businessNameSource: "custom",
    });
    // Other blocks are passed through untouched.
    expect(next.find((block) => block.id === "hero-1")).toEqual(blocks[0]);
  });
});
