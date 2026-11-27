import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

// "Add people" runs the real useCustomers search and the real eligibility
// hooks. Only Supabase is faked: the customer table answers for the ACTIVE
// tenant only, and the two eligibility RPCs answer from a fixed verdict table.
// Nothing here can send.

const ACTIVE_TENANT = "tenant-northfield";
const HOME_TENANT = "tenant-admin-home";

const editorState = vi.hoisted(() => ({
  initial: {} as Record<string, unknown>,
}));
vi.mock("@/components/crm/campaign-editor/CampaignEditorContext", async () => {
  const ReactModule = await import("react");
  type Value = Record<string, unknown>;
  const Context = ReactModule.createContext<Value>({});
  // A stateful stand-in: updateAudience changes what the page reads, as the
  // real provider does.
  function CampaignEditorProvider({ children }: { children: React.ReactNode }) {
    const [audience, setAudience] = ReactModule.useState(() => ({
      includeAllCustomers: editorState.initial.includeAllCustomers as boolean,
      additionalCustomerIds: editorState.initial.additionalCustomerIds as string[],
    }));
    const updateAudience = ReactModule.useCallback(
      (next: { includeAllCustomers?: boolean; additionalCustomerIds?: string[] }) =>
        setAudience((current) => ({ ...current, ...next })),
      [],
    );
    const value = ReactModule.useMemo(
      () => ({ ...editorState.initial, ...audience, updateAudience }),
      [audience, updateAudience],
    );
    return ReactModule.createElement(Context.Provider, { value }, children);
  }
  return {
    CampaignEditorProvider,
    useCampaignEditor: () => ReactModule.useContext(Context),
  };
});
const designSystem = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/contexts/DesignSystemContext", () => ({
  DesignSystemProvider: ({ children }: { children: React.ReactNode }) => children,
  useDesignSystem: () => ({ designSystem: designSystem.current, isLoading: false }),
  useOptionalDesignSystem: () => ({ designSystem: designSystem.current, isLoading: false }),
}));
// A master admin working in Northfield: the active tenant is not their home one.
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenant: { id: "tenant-northfield" }, loading: false }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-test", email: "owner@fernhill.com" } }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ hasPermission: () => true, tenantId: "tenant-northfield" }) }));
vi.mock("@/hooks/useEmailDomains", () => ({
  useEmailDomains: () => ({
    emailDomains: [{ domain: "fernhill.com", status: "active", default_from_email: "news@fernhill.com" }],
    loading: false,
    refetch: vi.fn(),
  }),
}));
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
vi.mock("@/components/crm/campaign-editor/SenderVerificationDialog", () => ({ SenderVerificationDialog: () => null }));
vi.mock("@/components/crm/studio/StudioPreviewDialog", () => ({ default: () => null }));

type CustomerRow = {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  customer_segments: Array<{ segment_id: string }>;
};

const CUSTOMERS: CustomerRow[] = [
  {
    id: "cust-lucas",
    tenant_id: ACTIVE_TENANT,
    email: "lucas@tremblaygardens.ca",
    first_name: "Lucas",
    last_name: "Tremblay",
    phone: "604-555-0101",
    customer_segments: [],
  },
  {
    id: "cust-sophia",
    tenant_id: ACTIVE_TENANT,
    email: "sophia.tremblay@greenfield-demo.example.invalid",
    first_name: "Sophia",
    last_name: "Tremblay",
    phone: null,
    customer_segments: [],
  },
  // Same surname in the admin's home tenant: must never appear.
  {
    id: "cust-home",
    tenant_id: HOME_TENANT,
    email: "home@admin.example",
    first_name: "Home",
    last_name: "Tremblay",
    phone: null,
    customer_segments: [],
  },
];

const VERDICTS: Record<string, { can_receive: boolean; reason: string }> = {
  "cust-lucas": { can_receive: true, reason: "eligible" },
  "cust-sophia": { can_receive: false, reason: "undeliverable_address" },
};

type Call = { table: string; filters: Array<[string, ...unknown[]]> };
const customerQueries = vi.hoisted(() => [] as Call[]);
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => {
  const resolve = (call: Call) => {
    if (call.table === "users") {
      return { data: { tenant_id: HOME_TENANT }, error: null };
    }
    if (call.table !== "crm_customers") {
      return { data: [], error: null, count: 0 };
    }
    customerQueries.push(call);
    let rows = CUSTOMERS.slice();
    for (const [method, ...args] of call.filters) {
      if (method === "eq" && args[0] === "tenant_id") {
        rows = rows.filter((row) => row.tenant_id === args[1]);
      }
      if (method === "in" && args[0] === "id") {
        const ids = args[1] as string[];
        rows = rows.filter((row) => ids.includes(row.id));
      }
      if (method === "or") {
        const needles = [...String(args[0]).matchAll(/ilike\.%([^%]+)%/g)].map((match) =>
          match[1].toLowerCase(),
        );
        rows = rows.filter((row) =>
          needles.some((needle) =>
            [row.email, row.first_name, row.last_name, row.phone ?? ""].some((value) =>
              value.toLowerCase().includes(needle),
            ),
          ),
        );
      }
    }
    return { data: rows, error: null, count: rows.length };
  };
  const from = (table: string) => {
    const call: Call = { table, filters: [] };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "order", "not", "or", "limit", "range"]) {
      builder[method] = (...args: unknown[]) => {
        call.filters.push([method, ...args]);
        return builder;
      };
    }
    builder.single = () => Promise.resolve(resolve(call));
    builder.maybeSingle = () => Promise.resolve(resolve(call));
    builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolve(call)).then(onFulfilled, onRejected);
    return builder;
  };
  return {
    supabase: {
      from,
      rpc,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "admin-user" } }, error: null }) },
      functions: { invoke: () => Promise.resolve({ data: { suggestions: [] }, error: null }) },
    },
  };
});

import CRMCampaignEditorPage from "../CRMCampaignEditorPage";

function eligibilityFor(customerIds: string[]) {
  const configured = customerIds.length > 0;
  const eligible = customerIds.filter((id) => VERDICTS[id]?.can_receive).length;
  const unsendable = customerIds.length - eligible;
  return {
    audience_configured: configured,
    total: customerIds.length,
    eligible,
    waiting: 0,
    asked_to_stop: 0,
    never_opted_in: 0,
    unsendable,
    duplicates: 0,
    blocked: unsendable,
    eligible_with_consent_override: eligible,
    eligible_with_soft_override: eligible,
    eligible_with_both_overrides: eligible,
    single_eligible_email: eligible === 1 ? "lucas@tremblaygardens.ca" : null,
  };
}

const blocks: StudioBlock[] = [
  { id: "hero-1", type: "email-safe-hero", label: "Hero", order: 0, visible: true, headline: "Winter wreaths", body: "Join us." },
  { id: "footer-1", type: "footer", label: "Footer", order: 1, visible: true, businessName: "Fernhill Gardens", businessNameSource: "custom" },
];

function draft() {
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
    updateContent: vi.fn(),
    updateSchedule: vi.fn(),
    saveDraft: vi.fn().mockResolvedValue("campaign-test"),
    setOrigin: vi.fn(),
    recordExternalSave: vi.fn(),
    activate: vi.fn(),
  };
}

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/crm/campaigns/campaign-test/edit?step=review"]}>
        <Routes>
          <Route path="/crm/campaigns/:campaignId/edit" element={<CRMCampaignEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const audienceStep = () => document.getElementById("campaign-editor-audience") as HTMLElement;
const dialog = () => screen.getByRole("dialog");

async function openAddPeopleAndSearch(term: string) {
  fireEvent.click(await screen.findByTestId("audience-add-people"));
  expect(within(dialog()).getByText("Add people")).toBeInTheDocument();
  expect(within(dialog()).queryByText("Expand Your Reach")).toBeNull();
  expect(within(dialog()).getByText("Everyone who can receive email")).toBeInTheDocument();
  expect(within(dialog()).getByText("Specific people")).toBeInTheDocument();
  fireEvent.change(within(dialog()).getByLabelText("Search customers"), { target: { value: term } });
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
  editorState.initial = draft();
  customerQueries.length = 0;
  rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    if (name === "email_campaign_eligibility") {
      return Promise.resolve({ data: [eligibilityFor(args.p_customer_ids as string[])], error: null });
    }
    if (name === "email_campaign_customer_eligibility") {
      const ids = args.p_customer_ids as string[];
      return Promise.resolve({
        data: ids.filter((id) => VERDICTS[id]).map((id) => ({ customer_id: id, ...VERDICTS[id] })),
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("Audience > Add people", () => {
  it("finds a known customer in the active tenant and marks who can't receive email", async () => {
    renderEditor();
    await openAddPeopleAndSearch("Tremblay");

    const lucasRow = await within(dialog()).findByTestId("audience-search-row-cust-lucas");
    expect(within(lucasRow).getByText("Lucas Tremblay")).toBeInTheDocument();
    const sophiaRow = within(dialog()).getByTestId("audience-search-row-cust-sophia");
    // The home tenant's customer with the same surname is not listed.
    expect(within(dialog()).queryByTestId("audience-search-row-cust-home")).toBeNull();
    expect(within(dialog()).queryByText("No customers matched this search.")).toBeNull();

    // The search was scoped to the active tenant, not the admin's home one.
    const searches = customerQueries.filter((call) => call.filters.some(([method]) => method === "or"));
    expect(searches.length).toBeGreaterThan(0);
    for (const call of searches) {
      expect(call.filters).toContainEqual(["eq", "tenant_id", ACTIVE_TENANT]);
    }

    // Ineligible people are shown with the shared rule's reason and cannot be added.
    await waitFor(() =>
      expect(within(sophiaRow).getByTestId("audience-search-reason-cust-sophia")).toHaveTextContent(
        "Email address can't receive mail",
      ),
    );
    expect(within(sophiaRow).getByRole("button", { name: "Add Sophia Tremblay" })).toBeDisabled();
    await waitFor(() =>
      expect(within(lucasRow).getByRole("button", { name: "Add Lucas Tremblay" })).not.toBeDisabled(),
    );
    expect(rpc).toHaveBeenCalledWith("email_campaign_customer_eligibility", {
      p_tenant_id: ACTIVE_TENANT,
      p_customer_ids: ["cust-lucas", "cust-sophia"],
    });
  });

  it("adds and removes a person as a chip, and the count and badge follow", async () => {
    renderEditor();
    await openAddPeopleAndSearch("Lucas");
    expect(within(dialog()).getByTestId("audience-add-people-eligible")).toHaveTextContent("No audience chosen yet");

    const lucasRow = await within(dialog()).findByTestId("audience-search-row-cust-lucas");
    const add = within(lucasRow).getByRole("button", { name: "Add Lucas Tremblay" });
    await waitFor(() => expect(add).not.toBeDisabled());
    fireEvent.click(add);

    // The chip appears, with a 44x44 "Remove Lucas Tremblay" button.
    const chip = await within(dialog()).findByTestId("specific-person-chip-cust-lucas");
    const chipRemove = within(chip).getByRole("button", { name: "Remove Lucas Tremblay" });
    expect(chipRemove).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
    expect(within(dialog()).getByTestId("audience-add-people-selected-count")).toHaveTextContent("1 person added");
    await waitFor(() =>
      expect(within(dialog()).getByTestId("audience-add-people-eligible")).toHaveTextContent(
        "1 in this campaign can receive email",
      ),
    );
    expect(rpc).toHaveBeenCalledWith("email_campaign_eligibility", {
      p_tenant_id: ACTIVE_TENANT,
      p_include_all_customers: false,
      p_segment_ids: [],
      p_persona_ids: [],
      p_customer_ids: ["cust-lucas"],
    });

    fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // The Audience step shows the chip and the same server count.
    expect(within(audienceStep()).getByTestId("specific-person-chip-cust-lucas")).toBeInTheDocument();
    expect(within(audienceStep()).getByTestId("audience-specific-people-count")).toHaveTextContent("1 person added");
    fireEvent.click(audienceStep().querySelector("[data-campaign-step-toggle]") as HTMLElement);
    await waitFor(() =>
      expect(within(audienceStep()).getByText(/1 person added · 1 can receive email/)).toBeInTheDocument(),
    );
    expect(within(audienceStep()).getByTestId("campaign-step-badge-done")).toBeInTheDocument();

    // Remove from the panel chip: the person, the count and the badge go back.
    fireEvent.click(audienceStep().querySelector("[data-campaign-step-toggle]") as HTMLElement);
    const panelChip = await within(audienceStep()).findByTestId("specific-person-chip-cust-lucas");
    fireEvent.click(within(panelChip).getByRole("button", { name: "Remove Lucas Tremblay" }));
    await waitFor(() => expect(within(audienceStep()).queryByTestId("specific-person-chip-cust-lucas")).toBeNull());
    expect(within(audienceStep()).queryByTestId("audience-specific-people")).toBeNull();
    fireEvent.click(audienceStep().querySelector("[data-campaign-step-toggle]") as HTMLElement);
    await waitFor(() => expect(within(audienceStep()).getByText("No audience selected")).toBeInTheDocument());
    expect(within(audienceStep()).queryByTestId("campaign-step-badge-done")).toBeNull();
  });
});
