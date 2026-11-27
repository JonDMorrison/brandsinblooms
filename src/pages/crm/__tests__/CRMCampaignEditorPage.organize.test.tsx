import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

// Organize step: groups, membership and colours go through the real
// useCampaignOrganization hook against an in-memory database, so a "reload"
// (a fresh mount with an empty query cache) reads back what was saved.
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
type Row = Record<string, string>;
const db = vi.hoisted(() => ({
  campaign_groups: [] as Record<string, string>[],
  campaign_group_memberships: [] as Record<string, string>[],
  campaign_colours: [] as Record<string, string>[],
  calls: [] as string[],
  nextId: 1,
}));
const KEYS = vi.hoisted((): Record<string, string[]> => ({
  campaign_groups: ["id"],
  campaign_group_memberships: ["campaign_id", "group_id"],
  campaign_colours: ["campaign_id"],
}));
vi.mock("@/integrations/supabase/client", () => {
  type Table = "campaign_groups" | "campaign_group_memberships" | "campaign_colours";
  const isOrgTable = (table: string): table is Table => table in KEYS;
  const sameKey = (table: Table, a: Row, b: Row) => KEYS[table].every((key) => a[key] === b[key]);
  function from(table: string) {
    const filters: [string, string][] = [];
    let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    let payload: Row = {};
    let single = false;
    const run = () => {
      if (!isOrgTable(table)) return { data: [], error: null };
      const rows = db[table];
      const matches = (row: Row) => filters.every(([key, value]) => row[key] === value);
      let out: Row[];
      db.calls.push(`${op}:${table}`);
      if (op === "insert") {
        const row = { ...payload, id: payload.id ?? `group-${db.nextId++}` };
        rows.push(row);
        out = [row];
      } else if (op === "upsert") {
        const existing = rows.find((row) => sameKey(table, row, payload));
        if (existing) Object.assign(existing, payload);
        else rows.push({ ...payload });
        out = [rows.find((row) => sameKey(table, row, payload)) as Row];
      } else if (op === "update") {
        out = rows.filter(matches);
        out.forEach((row) => Object.assign(row, payload));
      } else if (op === "delete") {
        out = rows.filter(matches);
        db[table] = rows.filter((row) => !matches(row));
      } else {
        out = rows.filter(matches);
      }
      const copy = out.map((row) => ({ ...row }));
      return { data: single ? copy[0] ?? null : copy, error: null };
    };
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "is", "in", "order", "not", "or", "limit", "maybeSingle"]) {
      chain[method] = () => chain;
    }
    chain.eq = (key: string, value: string) => { filters.push([key, value]); return chain; };
    chain.single = () => { single = true; return chain; };
    chain.insert = (row: Row) => { op = "insert"; payload = row; return chain; };
    chain.update = (row: Row) => { op = "update"; payload = row; return chain; };
    chain.upsert = (row: Row) => { op = "upsert"; payload = row; return chain; };
    chain.delete = () => { op = "delete"; return chain; };
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve().then(run).then(resolve, reject);
    return chain;
  }
  function rpc(name: string, args: Record<string, string>) {
    if (name !== "create_campaign_group_with_membership") return Promise.resolve({ data: null, error: null });
    db.calls.push(`rpc:${name}`);
    const group = { id: `group-${db.nextId++}`, tenant_id: args.p_tenant_id, name: args.p_name, colour: args.p_colour };
    db.campaign_groups.push(group);
    db.campaign_group_memberships.push({ campaign_id: args.p_campaign_id, tenant_id: args.p_tenant_id, group_id: group.id });
    return Promise.resolve({ data: { ...group }, error: null });
  }
  return {
    supabase: {
      from,
      rpc,
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

const stepToggle = () =>
  screen.getAllByRole("button", { name: /Organize/ }).find((button) => button.hasAttribute("data-campaign-step-toggle")) as HTMLElement;
const headerChips = () => within(screen.getByTestId("campaign-editor-header")).queryAllByTestId("campaign-editor-group-chip");

/** Mounts the editor with an empty cache, the same as reloading the page. */
async function reload(previous?: { unmount: () => void }) {
  previous?.unmount();
  const view = renderEditor();
  await waitFor(() => expect(db.calls).toContain("select:campaign_colours"));
  return view;
}

beforeEach(() => {
  designSystem.current = buildStudioDesignSystem({
    name: "Fernhill Gardens",
    streetAddress: "12 Fern Road",
    city: "Victoria",
    stateProvince: "BC",
    postalCode: "V8V 1A1",
  });
  Element.prototype.scrollIntoView = vi.fn();
  db.campaign_groups = [];
  db.campaign_group_memberships = [];
  db.campaign_colours = [];
  db.calls = [];
  db.nextId = 1;
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("campaign editor Organize step", () => {
  it("Add group saves the group and this campaign's membership in one call, and survives a reload", async () => {
    const recordExternalSave = vi.fn();
    editor.current = draft({ recordExternalSave });
    let view = await reload();
    expect(within(stepToggle()).getByTestId("campaign-step-badge-optional")).toBeInTheDocument();
    fireEvent.click(stepToggle());

    fireEvent.change(screen.getByLabelText("New group name"), { target: { value: "December" } });
    fireEvent.change(screen.getByLabelText("Group colour"), { target: { value: "#795548" } });
    fireEvent.click(screen.getByRole("button", { name: "Add group" }));

    await waitFor(() => expect(headerChips()).toHaveLength(1));
    // One atomic call, not a group insert followed by nothing.
    expect(db.calls.filter((call) => !call.startsWith("select:"))).toEqual([
      "rpc:create_campaign_group_with_membership",
    ]);
    expect(db.campaign_group_memberships).toEqual([
      { campaign_id: "campaign-test", tenant_id: "tenant-test", group_id: "group-1" },
    ]);
    expect(headerChips()[0]).toHaveTextContent("December");
    expect(within(stepToggle()).getByTestId("campaign-step-badge-done")).toHaveTextContent("In 1 group");
    expect(recordExternalSave).toHaveBeenCalledWith(expect.any(Date));

    view = await reload(view);
    await waitFor(() => expect(headerChips()).toHaveLength(1));
    expect(headerChips()[0]).toHaveTextContent("December");
    const swatch = headerChips()[0].querySelector("[aria-hidden]") as HTMLElement;
    expect(getComputedStyle(swatch).backgroundColor).toBe("rgb(121, 85, 72)");
    expect(within(stepToggle()).getByTestId("campaign-step-badge-done")).toHaveTextContent("In 1 group");
    view.unmount();
  });

  it("selecting an existing group adds a membership; Remove deletes only the membership", async () => {
    db.campaign_groups = [
      { id: "december", tenant_id: "tenant-test", name: "December", colour: "#795548" },
      { id: "wholesale", tenant_id: "tenant-test", name: "Wholesale", colour: "#1E88E5" },
    ];
    editor.current = draft({ recordExternalSave: vi.fn() });
    let view = await reload();
    await waitFor(() => expect(within(stepToggle()).getByTestId("campaign-step-badge-optional")).toBeInTheDocument());
    fireEvent.click(stepToggle());

    fireEvent.click(await screen.findByRole("button", { name: "Add to December" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add to Wholesale" }));
    await waitFor(() => expect(headerChips()).toHaveLength(2));
    expect(within(stepToggle()).getByTestId("campaign-step-badge-done")).toHaveTextContent("In 2 groups");

    view = await reload(view);
    await waitFor(() => expect(headerChips()).toHaveLength(2));
    fireEvent.click(stepToggle());
    fireEvent.click(screen.getByRole("button", { name: "Remove from December" }));
    await waitFor(() => expect(headerChips()).toHaveLength(1));
    expect(headerChips()[0]).toHaveTextContent("Wholesale");
    // The group itself is kept for other campaigns.
    expect(db.campaign_groups.map((group) => group.id)).toEqual(["december", "wholesale"]);
    expect(db.campaign_group_memberships.map((m) => m.group_id)).toEqual(["wholesale"]);

    view = await reload(view);
    await waitFor(() => expect(headerChips()).toHaveLength(1));
    expect(headerChips()[0]).toHaveTextContent("Wholesale");
    view.unmount();
  });

  it("campaign colour and group colour changes are kept after a reload", async () => {
    db.campaign_groups = [{ id: "december", tenant_id: "tenant-test", name: "December", colour: "#795548" }];
    db.campaign_group_memberships = [{ campaign_id: "campaign-test", tenant_id: "tenant-test", group_id: "december" }];
    const recordExternalSave = vi.fn();
    editor.current = draft({ recordExternalSave });
    let view = await reload();
    await waitFor(() => expect(headerChips()).toHaveLength(1));
    fireEvent.click(stepToggle());

    // Several picker steps save once, with the last colour.
    const campaignColour = screen.getByLabelText("Campaign colour") as HTMLInputElement;
    fireEvent.change(campaignColour, { target: { value: "#111111" } });
    fireEvent.change(campaignColour, { target: { value: "#aa3355" } });
    expect(campaignColour.value).toBe("#aa3355");
    await waitFor(() => expect(db.campaign_colours).toEqual([
      { tenant_id: "tenant-test", campaign_id: "campaign-test", colour: "#aa3355" },
    ]));
    expect(db.calls.filter((call) => call === "upsert:campaign_colours")).toHaveLength(1);
    await waitFor(() => expect(recordExternalSave).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Rename / colour" }));
    fireEvent.change(screen.getByLabelText("Group colour"), { target: { value: "#2e7d32" } });
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));
    await waitFor(() => expect(db.campaign_groups[0].colour).toBe("#2e7d32"));

    view = await reload(view);
    await waitFor(() => expect(headerChips()).toHaveLength(1));
    const swatch = headerChips()[0].querySelector("[aria-hidden]") as HTMLElement;
    expect(getComputedStyle(swatch).backgroundColor).toBe("rgb(46, 125, 50)");
    fireEvent.click(stepToggle());
    expect((screen.getByLabelText("Campaign colour") as HTMLInputElement).value).toBe("#aa3355");
    view.unmount();
  });

  it("Organize card has no sideways scroll container or negative margin", async () => {
    editor.current = draft({ recordExternalSave: vi.fn() });
    const view = await reload();
    fireEvent.click(stepToggle());
    const card = document.getElementById("campaign-editor-organize") as HTMLElement;
    expect(getComputedStyle(card).overflow).toBe("clip");
    const body = document.getElementById("campaign-editor-organize-body") as HTMLElement;
    const senderBody = document.getElementById("campaign-editor-sender-body") as HTMLElement;
    expect(getComputedStyle(body).padding).toBe(getComputedStyle(senderBody).padding);
    for (const element of [body, ...Array.from(body.querySelectorAll<HTMLElement>("*"))]) {
      const style = getComputedStyle(element);
      // Visually hidden helpers (Joy Select's native input) sit out of flow.
      if (style.position === "absolute") continue;
      for (const margin of [style.marginLeft, style.marginRight]) expect(margin.startsWith("-")).toBe(false);
    }
    view.unmount();
  });

  it("group colour and campaign colour pickers share one grid column and size", async () => {
    editor.current = draft({ recordExternalSave: vi.fn() });
    const view = await reload();
    fireEvent.click(stepToggle());
    const grid = screen.getByTestId("campaign-organization-form-grid");
    const groupColour = screen.getByLabelText("Group colour") as HTMLInputElement;
    const campaignColour = screen.getByLabelText("Campaign colour") as HTMLInputElement;
    expect(groupColour.type).toBe("color");
    expect(campaignColour.type).toBe("color");
    // Both pickers are grid cells of the same grid (the group one inside its
    // FormControl), with identical styling.
    expect(grid.contains(groupColour) && grid.contains(campaignColour)).toBe(true);
    expect(campaignColour.parentElement).toBe(grid);
    expect(groupColour.parentElement?.parentElement).toBe(grid);
    expect(groupColour.className).toBe(campaignColour.className);
    expect(getComputedStyle(grid).display).toBe("grid");
    view.unmount();
  });
});
