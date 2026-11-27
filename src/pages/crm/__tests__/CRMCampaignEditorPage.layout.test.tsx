import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
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
const eligibilityCounts = vi.hoisted(() => ({ current: {} as Record<string, number> }));
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
        ...eligibilityCounts.current,
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
// Every edge function call goes through this spy; nothing reaches the network,
// and the Send test checks assert the test-send function is never called.
const invoke = vi.hoisted(() => vi.fn());
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
      functions: { invoke },
    },
  };
});
// Dialogs that only open on request; they are covered by their own tests.
vi.mock("@/components/crm/campaign-editor/CampaignSendConfirmation", () => ({ CampaignSendConfirmation: () => null }));
vi.mock("@/components/crm/campaign-editor/SenderVerificationDialog", () => ({ SenderVerificationDialog: () => null }));
// StudioPreviewDialog is real here: the Send test checks open it.

import { CssVarsProvider } from "@mui/joy/styles";
import { joyTheme } from "@/config/joy-theme";
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
  invoke.mockImplementation(() => Promise.resolve({ data: { suggestions: [] }, error: null }));
  designSystem.current = buildStudioDesignSystem({
    name: "Fernhill Gardens",
    streetAddress: "12 Fern Road",
    city: "Victoria",
    stateProvince: "BC",
    postalCode: "V8V 1A1",
  });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.clearAllMocks();
  eligibilityCounts.current = {};
});

describe("campaign editor layout", () => {
  it("replace-content dialog: Keep current draft is primary, Start over is destructive", () => {
    editor.current = draft();
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Change design" }));
    fireEvent.click(screen.getByTestId("start-mode-scratch"));
    fireEvent.click(screen.getByTestId("intent-card-blank"));
    const dialog = screen.getByRole("dialog");
    const keep = within(dialog).getByRole("button", { name: "Keep current draft" });
    const startOver = within(dialog).getByRole("button", { name: "Start over" });
    expect(keep).toHaveClass("MuiButton-variantSolid", "MuiButton-colorPrimary");
    expect(startOver).toHaveClass("MuiButton-variantOutlined", "MuiButton-colorDanger");
    expect(startOver).not.toHaveClass("MuiButton-variantSolid");
    fireEvent.click(keep);
    expect(editor.current.updateContent).not.toHaveBeenCalled();
  });

  it("drafts empty preview text from the first sentence of the first text block, greeting removed", () => {
    const updateSetup = vi.fn();
    editor.current = draft({
      updateSetup,
      contentBlocks: [
        { ...blocks[0], body: "<p>Hi {{ first_name }}, our wreath workshops start November 14. Book early.</p>" },
        blocks[1],
      ],
    });
    renderEditor();
    expect(updateSetup).toHaveBeenCalledWith({ preheaderText: "Our wreath workshops start November 14." });
  });

  it("names the campaign name box \"Campaign name\", not the subject", () => {
    editor.current = draft({ name: "", subjectLine: "Winter wreath workshops" });
    renderEditor();
    const input = screen.getByRole("textbox", { name: "Campaign name" });
    expect(input).toHaveAttribute("id", "campaign-editor-name");
    expect(screen.queryByRole("textbox", { name: "Winter wreath workshops" })).toBeNull();
  });

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
    // Never an empty bar: the ready state takes its place.
    expect(screen.getByTestId("campaign-readiness-ready")).toHaveTextContent("Campaign is ready");
    expect(screen.getByTestId("campaign-editor-schedule-cta")).not.toBeDisabled();
  });

  it("lists a block with a broken button link and keeps Schedule off", () => {
    editor.current = draft({
      subjectLine: "Winter wreath workshops are back this month",
      preheaderText: "Join us November 14.",
      includeAllCustomers: true,
      audienceCount: 120,
      contentBlocks: [
        { ...blocks[0], buttonText: "Book a seat", buttonUrl: "www shop" },
        { ...blocks[1], businessName: "Fernhill Gardens" },
      ],
    });
    renderEditor();
    const bar = screen.getByTestId("campaign-readiness-bar");
    expect(bar).toHaveTextContent("1 thing before you can send");
    expect(within(bar).getByText(/^Block 1 \(.+\): Button link is not a full link/)).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: /Fix the link in block 1/ })).toBeInTheDocument();
    expect(screen.getByTestId("campaign-editor-schedule-cta")).toBeDisabled();
  });

  it("warns about a placeholder footer business name and offers the From name", () => {
    const updateContent = vi.fn();
    editor.current = draft({
      updateContent,
      contentBlocks: blocks.map((block) =>
        block.type === "footer" ? { ...block, businessName: "Your Company" } : block,
      ),
    });
    renderEditor();
    fireEvent.click(stepToggle(/Sender/));
    const warning = screen.getByTestId("sender-mismatch-footerBusinessName");
    expect(warning).toHaveTextContent("(“Your Company”) is a placeholder");
    fireEvent.click(within(warning).getByRole("button", { name: "Use From name" }));
    const next = updateContent.mock.calls[0][0].contentBlocks as StudioBlock[];
    expect(next.find((block) => block.type === "footer")?.businessName).toBe("Fernhill Gardens");
  });

  it("warns about an empty footer business name", () => {
    editor.current = draft({
      contentBlocks: blocks.map((block) =>
        block.type === "footer" ? { ...block, businessName: "" } : block,
      ),
    });
    renderEditor();
    fireEvent.click(stepToggle(/Sender/));
    const warning = screen.getByTestId("sender-mismatch-footerBusinessName");
    expect(warning).toHaveTextContent("The footer business name is empty.");
    expect(within(warning).getByRole("button", { name: "Use From name" })).toBeInTheDocument();
  });

  it("blocks sending without a postal address and links to the address settings", () => {
    designSystem.current = buildStudioDesignSystem({ name: "Fernhill Gardens" });
    editor.current = draft({
      subjectLine: "Winter wreath workshops are back this month",
      includeAllCustomers: true,
      audienceCount: 120,
      contentBlocks: blocks.map((block) =>
        block.type === "footer"
          ? { ...block, businessName: "Fernhill Gardens", address: "123 Business St, Suite 100, City, State 12345" }
          : block,
      ),
    });
    renderEditor();
    const bar = screen.getByTestId("campaign-readiness-bar");
    expect(within(bar).getAllByRole("listitem")).toHaveLength(1);
    expect(within(bar).getByText(/Add your business address\. Marketing email must include a postal address\./)).toBeInTheDocument();
    const link = within(bar).getByTestId("campaign-readiness-settings-link");
    expect(link).toHaveAttribute("href", "/profile/contact-footer");
    expect(link).toHaveTextContent("Add your business address");
    expect(screen.getByTestId("campaign-editor-schedule-cta")).toBeDisabled();
    // The placeholder address is never rendered anywhere on the page.
    expect(document.body.innerHTML).not.toContain("123 Business St");
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

describe("campaign editor Send test", () => {
  const testSendCalls = () => invoke.mock.calls.filter(([name]) => name === "send-test-email-v2");

  it("opens the test-send dialog with the signed-in user's email and sends nothing", () => {
    editor.current = draft({ subjectLine: "Winter wreath workshops" });
    renderEditor();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByTestId("campaign-editor-send-test-cta"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Preview & Test")).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "Send test" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("textbox", { name: "Test recipient" })).toHaveValue("owner@fernhill.com");
    // Opening the dialog sends nothing; only its own Send test button would.
    expect(testSendCalls()).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(testSendCalls()).toHaveLength(0);
  });

  it("still allows a test send with a broken link, and shows the same warning", () => {
    editor.current = draft({
      subjectLine: "Winter wreath workshops",
      contentBlocks: [
        { ...blocks[0], buttonText: "Book a seat", buttonUrl: "javascript:alert(1)" },
        blocks[1],
      ],
    });
    renderEditor();
    expect(screen.getByTestId("campaign-editor-schedule-cta")).toBeDisabled();
    const sendTest = screen.getByTestId("campaign-editor-send-test-cta");
    expect(sendTest).not.toBeDisabled();
    fireEvent.click(sendTest);

    const dialog = screen.getByRole("dialog");
    const warning = within(dialog).getByTestId("preview-test-link-warning");
    expect(warning).toHaveTextContent("1 block has a link to fix before you can send or schedule.");
    expect(warning).toHaveTextContent(/Block 1 \(.+\): Button link is a kind of link emails can't use/);
    expect(within(dialog).getByRole("button", { name: "Send test" })).not.toBeDisabled();
  });

  it("is disabled with a hint when the campaign has no design", async () => {
    editor.current = draft({ contentBlocks: blocks.filter((block) => block.type === "footer") });
    renderEditor();
    const button = screen.getByTestId("campaign-editor-send-test-cta");
    expect(button).toBeDisabled();

    fireEvent.mouseOver(screen.getByTestId("campaign-editor-send-test-wrapper"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Add a design first");

    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(testSendCalls()).toHaveLength(0);
  });
});

describe("campaign name field", () => {
  it("Escape puts back the last saved name, blurs, and saves nothing", () => {
    const revertName = vi.fn();
    const updateSetup = vi.fn();
    const saveDraft = vi.fn().mockResolvedValue("campaign-test");
    editor.current = draft({ revertName, updateSetup, saveDraft, subjectLine: "Winter wreath workshops" });
    renderEditor();
    const input = screen.getByRole("textbox", { name: "Campaign name" });
    input.focus();
    fireEvent.change(input, { target: { value: "Typo" } });
    updateSetup.mockClear();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(revertName).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(input);
    // The blur that Escape causes does not fill in a default name.
    expect(updateSetup).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("an empty name on blur becomes Draft, <date> and says it is a default", () => {
    const updateSetup = vi.fn((next: { name?: string }) => {
      editor.current = { ...editor.current, ...next };
    });
    editor.current = draft({ name: "", updateSetup, subjectLine: "Winter wreath workshops" });
    const view = renderEditor();
    const input = screen.getByRole("textbox", { name: "Campaign name" });
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(updateSetup).toHaveBeenCalledWith({ name: expect.stringMatching(/^Draft, \w{3} \d{1,2}, \d{4}$/) });
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/crm/campaigns/campaign-test/edit"]}>
          <Routes>
            <Route path="/crm/campaigns/:campaignId/edit" element={<CRMCampaignEditorPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("campaign-editor-name-hint")).toHaveTextContent("Using a default name");
  });

  it("a named campaign keeps its name on blur", () => {
    const updateSetup = vi.fn();
    editor.current = draft({ updateSetup });
    renderEditor();
    const input = screen.getByRole("textbox", { name: "Campaign name" });
    fireEvent.blur(input);
    expect(updateSetup).not.toHaveBeenCalledWith(expect.objectContaining({ name: expect.anything() }));
    expect(screen.queryByTestId("campaign-editor-name-hint")).toBeNull();
  });
});

/**
 * Layout rules checked with the app's own Joy theme (4px spacing unit).
 * jsdom applies only the styles outside min-width media queries, so the
 * computed styles here are the phone layout (below 600px); the wider
 * layouts are checked from the CSS each element is given.
 */
function renderThemedEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <CssVarsProvider theme={joyTheme}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/crm/campaigns/campaign-test/edit"]}>
          <Routes>
            <Route path="/crm/campaigns/:campaignId/edit" element={<CRMCampaignEditorPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </CssVarsProvider>,
  );
}

/** The CSS emotion generated for an element's classes, media queries included. */
function cssFor(element: Element) {
  const classes = Array.from(element.classList).filter((name) => name.startsWith("css-"));
  const css = Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");
  return classes.map((name) => css.split("}").filter((rule) => rule.includes(`.${name}`)).join("}")).join("\n");
}

const readyDraft = () =>
  draft({
    subjectLine: "Winter wreath workshops are back this month",
    preheaderText: "Join us November 14.",
    includeAllCustomers: true,
    audienceCount: 120,
    contentBlocks: blocks.map((block) =>
      block.type === "footer" ? { ...block, businessName: "Fernhill Gardens" } : block,
    ),
  });

describe("campaign editor visual polish", () => {
  it("header: Inter 700 at xl3, soft neutral status and type chips, 8px group dots, buttons stacked full width", () => {
    editor.current = draft();
    renderThemedEditor();
    const heading = screen.getByRole("heading", { level: 1 });
    const headingStyle = getComputedStyle(heading);
    expect(headingStyle.fontFamily).toBe("var(--joy-fontFamily-display)");
    expect(headingStyle.fontSize).toBe("var(--joy-fontSize-xl3)");
    expect(headingStyle.fontWeight).toBe("var(--joy-fontWeight-bold)");

    for (const chip of [screen.getByTestId("campaign-editor-status-chip"), screen.getByTestId("campaign-editor-type-chip")]) {
      expect(chip).toHaveClass("MuiChip-variantSoft");
      expect(chip).toHaveClass("MuiChip-colorNeutral");
    }
    const groupChip = screen.getByTestId("campaign-editor-group-chip");
    expect(groupChip).toHaveClass("MuiChip-colorNeutral");
    const dot = within(groupChip).getByTestId("campaign-editor-group-dot");
    expect(getComputedStyle(dot).width).toBe("8px");
    expect(getComputedStyle(dot).height).toBe("8px");
    expect(getComputedStyle(dot).borderRadius).toBe("50%");

    // Below 600px the buttons stack, full width, under the title.
    const actions = screen.getByTestId("campaign-editor-header-actions");
    expect(getComputedStyle(actions).flexDirection).toBe("column");
    // Joy writes xs values as min-width:0px rules, which jsdom does not apply.
    const phone = /@media \(min-width:0px\)\{[^}]*width:100%/;
    expect(cssFor(actions)).toMatch(phone);
    expect(cssFor(screen.getByTestId("campaign-editor-send-test-wrapper"))).toMatch(phone);
    expect(cssFor(screen.getByTestId("campaign-editor-schedule-cta"))).toMatch(phone);
    // From 600px they sit in a row, centred on one line.
    expect(cssFor(actions)).toMatch(/@media \(min-width:600px\)\{[^}]*flex-direction:row/);
    // The title block and controls share one row from 900px, on one baseline.
    const row = actions.parentElement as HTMLElement;
    expect(cssFor(row)).toMatch(/@media \(min-width:900px\)\{[^}]*flex-direction:row/);
    expect(cssFor(row)).toMatch(/@media \(min-width:900px\)\{[^}]*align-items:flex-end/);
  });

  it("readiness: one compact row of chips that each jump to their step", () => {
    editor.current = draft();
    renderThemedEditor();
    const bar = screen.getByTestId("campaign-readiness-bar");
    expect(within(bar).getByRole("heading", { level: 2 })).toHaveTextContent("2 things before you can send");
    const links = within(bar).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Add a subject line", "Choose an audience"]);
    for (const link of links) expect(getComputedStyle(link).minHeight).toBe("44px");
    if (stepToggle(/Audience/).getAttribute("aria-expanded") === "true") fireEvent.click(stepToggle(/Audience/));
    expect(stepToggle(/Audience/)).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(within(bar).getByRole("link", { name: /Choose an audience/ }));
    expect(stepToggle(/Audience/)).toHaveAttribute("aria-expanded", "true");
  });

  it("step cards: 64px headers, 24px padding, 16px apart, badges and tertiary summaries", () => {
    editor.current = readyDraft();
    const { container } = renderThemedEditor();
    const toggles = Array.from(container.querySelectorAll<HTMLElement>("[data-campaign-step-toggle]"));
    expect(toggles).toHaveLength(5);
    for (const toggle of toggles) {
      expect(getComputedStyle(toggle).height).toBe("64px");
      expect(getComputedStyle(toggle).paddingLeft).toBe("24px");
      expect(getComputedStyle(toggle).paddingRight).toBe("24px");
    }
    for (const id of ["content", "inbox", "audience", "sender"]) {
      expect(getComputedStyle(document.getElementById(`campaign-editor-${id}-body`) as HTMLElement).padding).toBe("24px");
      expect(getComputedStyle(document.getElementById(`campaign-editor-${id}`) as HTMLElement).borderRadius).toBe(
        "var(--joy-radius-lg)",
      );
    }
    const steps = screen.getByTestId("campaign-editor-steps").children;
    expect(getComputedStyle(steps[1]).marginTop).toBe("16px");
    // Done is success soft with a check; Organize is neutral "Optional".
    const done = within(stepToggle(/Inbox/)).getByTestId("campaign-step-badge-done");
    expect(done).toHaveClass("MuiChip-variantSoft");
    expect(done).toHaveClass("MuiChip-colorSuccess");
    expect(done.querySelector("svg")).not.toBeNull();
    // Collapsed, the step shows one line of summary in text.tertiary.
    const summary = within(stepToggle(/Organize/)).getByTestId("campaign-step-summary");
    expect(getComputedStyle(summary).color).toBe("var(--joy-palette-text-tertiary)");
    expect(getComputedStyle(summary).whiteSpace).toBe("nowrap");
  });

  it("warning badge carries the number of things to fix", () => {
    editor.current = draft();
    renderThemedEditor();
    const badge = within(stepToggle(/Audience/)).getByTestId("campaign-step-badge-required");
    expect(badge).toHaveClass("MuiChip-colorWarning");
    expect(badge).toHaveClass("MuiChip-variantSoft");
  });

  it("design step: 160x200 thumbnail with radius.md and a divider border; solid and outlined actions", () => {
    editor.current = readyDraft();
    renderThemedEditor();
    const thumbnail = screen.getByTestId("campaign-design-thumbnail");
    const style = getComputedStyle(thumbnail);
    expect([style.width, style.height]).toEqual(["160px", "200px"]);
    expect(style.borderRadius).toBe("var(--joy-radius-md)");
    expect(cssFor(thumbnail)).toMatch(/border:1px solid/);
    expect(cssFor(thumbnail)).toMatch(/border-color:var\(--joy-palette-divider\)/);
    const info = screen.getByTestId("campaign-design-info");
    expect(Array.from(info.children).map((child) => child.textContent)).toEqual([
      "Design applied",
      expect.any(String),
      expect.stringMatching(/^2 blocks/),
    ]);
    expect(screen.getByTestId("campaign-design-edit-studio")).toHaveClass("MuiButton-variantSolid");
    expect(screen.getByTestId("campaign-design-edit-studio")).toHaveClass("MuiButton-colorPrimary");
    expect(screen.getByTestId("campaign-design-change")).toHaveClass("MuiButton-variantOutlined");
  });

  it("audience: five buckets in a 5-column grid, zeros muted, can't-be-sent-to warns and explains", () => {
    eligibilityCounts.current = { total: 130, eligible: 120, unsendable: 10 };
    editor.current = readyDraft();
    renderThemedEditor();
    fireEvent.click(stepToggle(/Audience/));
    const grid = screen.getByTestId("audience-bucket-grid");
    expect(grid.children).toHaveLength(5);
    expect(cssFor(grid)).toMatch(/@media \(min-width:600px\)\{[^}]*grid-template-columns:repeat\(5, minmax\(0, 1fr\)\)/);
    expect(getComputedStyle(screen.getByTestId("audience-bucket-eligible-value")).fontSize).toBe("var(--joy-fontSize-xl)");
    // level body-sm: the theme sets it to 0.875rem (src/config/joy-theme.ts).
    expect(getComputedStyle(screen.getByTestId("audience-bucket-eligible-label")).fontSize).toContain("0.875rem");
    // Zero buckets are muted.
    expect(screen.getByTestId("audience-bucket-waiting")).toHaveAttribute("data-empty", "true");
    expect(getComputedStyle(screen.getByTestId("audience-bucket-waiting-value")).color).toBe(
      "var(--joy-palette-text-tertiary)",
    );
    // Above 0, "Can't be sent to" is warning text with a link that explains it.
    expect(getComputedStyle(screen.getByTestId("audience-bucket-unsendable-value")).color).toBe(
      "var(--joy-palette-warning-plainColor)",
    );
    const why = screen.getByTestId("audience-unsendable-why");
    expect(getComputedStyle(why).minHeight).toBe("44px");
    fireEvent.click(why);
    const info = screen.getByTestId("audience-unsendable-info");
    for (const label of [
      "Email address can't receive mail",
      "Blocked from email",
      "Bounced",
      "Shares an email address that is blocked",
    ]) {
      expect(within(info).getByText(label)).toBeInTheDocument();
    }
  });

  it("has no can't-be-sent-to link when that bucket is 0", () => {
    editor.current = readyDraft();
    renderThemedEditor();
    fireEvent.click(stepToggle(/Audience/));
    expect(screen.getByTestId("audience-bucket-unsendable")).toHaveAttribute("data-empty", "true");
    expect(screen.queryByTestId("audience-unsendable-why")).toBeNull();
  });

  it("keeps every control at least 44px tall and nothing wider than a 390px phone", () => {
    eligibilityCounts.current = { total: 130, eligible: 120, unsendable: 10 };
    editor.current = readyDraft();
    // A 390px phone: 16px page gutters and 24px card padding leave the live
    // preview 310px to lay the email out in.
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(310);
    onTestFinished(() => clientWidth.mockRestore());
    const { container } = renderThemedEditor();
    for (const toggle of Array.from(container.querySelectorAll<HTMLElement>("[data-campaign-step-toggle]"))) {
      if (toggle.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
    }
    const page = screen.getByTestId("campaign-editor-page");
    // The page sets 44px on every Joy button, icon button and select
    // (campaignEditorPageSx). That rule wins in a browser by specificity;
    // jsdom resolves the cascade by source order only, so the per-element
    // check below counts those controls as covered once the rule is there.
    let pageCss = "";
    for (let node: Element | null = page; node && !pageCss.includes("min-height:44px"); node = node.parentElement) {
      pageCss = cssFor(node);
    }
    expect(pageCss).toMatch(/\.MuiButton-root,[^{]*\.MuiIconButton-root\{min-height:44px/);
    expect(pageCss).toMatch(/\.MuiSelect-root[^{]*\{min-height:44px/);
    const coveredByPageRule = (element: HTMLElement) =>
      element.matches(".MuiButton-root, .MuiIconButton-root") || Boolean(element.closest(".MuiSelect-root"));
    const small: string[] = [];
    for (const element of Array.from(page.querySelectorAll<HTMLElement>("button, a[href], [role='switch']"))) {
      const style = getComputedStyle(element);
      // Visually hidden helpers and Joy's overlay action elements sit out of
      // flow; tabindex -1 parts (Autocomplete indicators, tag delete) are not
      // separate targets.
      if (style.position === "absolute" || element.getAttribute("tabindex") === "-1") continue;
      if (coveredByPageRule(element)) continue;
      const size = Math.max(parseFloat(style.minHeight) || 0, parseFloat(style.height) || 0);
      if (size < 44) small.push(`${size} ${element.outerHTML.slice(0, 140)}`);
    }
    expect(small).toEqual([]);
    for (const element of Array.from(page.querySelectorAll<HTMLElement>("*"))) {
      const width = getComputedStyle(element).width;
      if (!width.endsWith("px") || parseFloat(width) <= 390) continue;
      // Only the scaled email renders are wider; each sits in a clipped box.
      expect(element.tagName, element.outerHTML.slice(0, 120)).toBe("IFRAME");
    }
  });
});
