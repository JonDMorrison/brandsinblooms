import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const NORTHFIELD = "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4";

const mocks = vi.hoisted(() => ({
  user: { id: "admin-user" } as { id: string } | null,
  tenant: { id: "tenant-id", name: "Tenant" } as { id: string; name: string } | null,
  tenantLoading: false,
  ownProfileUserId: vi.fn<(userId: string) => Promise<string>>(),
  tenantProfileUserId: vi.fn<(userId: string, tenantId: string | null | undefined) => Promise<string | null>>(),
  clearCache: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  toast: vi.fn(),
  reads: [] as Array<{ column: string; value: string }>,
  updates: [] as Array<{ payload: Record<string, unknown>; id: string }>,
  inserts: [] as Array<Record<string, unknown>>,
  row: null as Record<string, string | null> | null,
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: mocks.tenant, loading: mocks.tenantLoading }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/profile/businessProfileUserId", () => ({
  getBusinessProfileUserId: mocks.ownProfileUserId,
  getTenantBusinessProfileUserId: mocks.tenantProfileUserId,
  clearBusinessProfileUserIdCache: mocks.clearCache,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

import { ContactFooterTab } from "../ContactFooterTab";

function companyProfilesTable() {
  return {
    select: () => ({
      eq: (column: string, value: string) => {
        mocks.reads.push({ column, value });
        return { maybeSingle: () => Promise.resolve({ data: mocks.row, error: null }) };
      },
    }),
    update: (payload: Record<string, unknown>) => ({
      eq: (_column: string, id: string) => {
        mocks.updates.push({ payload, id });
        return {
          select: () => ({ maybeSingle: () => Promise.resolve({ data: { id }, error: null }) }),
        };
      },
    }),
    insert: (payload: Record<string, unknown>) => {
      mocks.inserts.push(payload);
      return {
        select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "new-row" }, error: null }) }),
      };
    },
  };
}

function profileRow(overrides: Record<string, string | null> = {}) {
  return {
    id: "row-id",
    company_phone: "555-0100",
    company_email: null,
    website_url: null,
    street_address: null,
    city: "Calgary",
    state_province: null,
    postal_code: null,
    country: null,
    facebook_url: null,
    instagram_url: null,
    tiktok_url: null,
    pinterest_url: null,
    youtube_url: null,
    linkedin_url: null,
    footer_legal_text: null,
    ...overrides,
  };
}

async function renderAndEditAddress(street: string) {
  render(
    <MemoryRouter>
      <ContactFooterTab />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /edit/i }));
  fireEvent.change(document.getElementById("street_address") as HTMLInputElement, {
    target: { value: street },
  });
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
}

beforeEach(() => {
  mocks.from.mockImplementation((table: string) => {
    if (table !== "company_profiles") throw new Error(`unexpected table ${table}`);
    return companyProfilesTable();
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.reads.length = 0;
  mocks.updates.length = 0;
  mocks.inserts.length = 0;
  mocks.row = null;
  mocks.tenantLoading = false;
});

describe("ContactFooterTab tenant scope", () => {
  it("loads and saves the active tenant's profile for a master admin in another tenant", async () => {
    mocks.user = { id: "admin-user" };
    mocks.tenant = { id: NORTHFIELD, name: "Northfield Garden Center" };
    mocks.ownProfileUserId.mockResolvedValue("admin-user");
    mocks.tenantProfileUserId.mockResolvedValue("northfield-owner");
    mocks.row = profileRow({ id: "northfield-row" });
    mocks.rpc.mockResolvedValue({ data: "northfield-row", error: null });

    await renderAndEditAddress("12 Garden Way");

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    expect(mocks.tenantProfileUserId).toHaveBeenCalledWith("admin-user", NORTHFIELD);
    expect(mocks.reads).toEqual([{ column: "user_id", value: "northfield-owner" }]);
    // Only the changed field is sent, scoped to the active tenant.
    expect(mocks.rpc).toHaveBeenCalledWith("save_tenant_contact_footer", {
      p_tenant_id: NORTHFIELD,
      p_contact: { street_address: "12 Garden Way" },
    });
    // The admin's own profile is never written.
    expect(mocks.updates).toEqual([]);
    expect(mocks.inserts).toEqual([]);
    expect(screen.getByTestId("contact-footer-tenant-scope")).toHaveTextContent(
      "Northfield Garden Center",
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Saved successfully" })),
    );
  });

  it("creates the tenant's profile through the RPC when the tenant has none yet", async () => {
    mocks.user = { id: "admin-user" };
    mocks.tenant = { id: NORTHFIELD, name: "Northfield Garden Center" };
    mocks.ownProfileUserId.mockResolvedValue("admin-user");
    mocks.tenantProfileUserId.mockResolvedValue(null);
    mocks.rpc.mockResolvedValue({ data: "created-row", error: null });

    await renderAndEditAddress("12 Garden Way");

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    expect(mocks.reads).toEqual([]);
    expect(mocks.rpc.mock.calls[0][1]).toEqual({
      p_tenant_id: NORTHFIELD,
      p_contact: { street_address: "12 Garden Way" },
    });
    expect(mocks.inserts).toEqual([]);
    await waitFor(() => expect(mocks.clearCache).toHaveBeenCalled());
  });

  it("shows an error and keeps editing when the RPC refuses the write", async () => {
    mocks.user = { id: "member-user" };
    mocks.tenant = { id: "other-tenant", name: "Other" };
    mocks.ownProfileUserId.mockResolvedValue("member-owner");
    mocks.tenantProfileUserId.mockResolvedValue("other-owner");
    mocks.row = profileRow({ id: "other-row" });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "save_tenant_contact_footer: not allowed to edit this business profile" },
    });

    await renderAndEditAddress("Somewhere");

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error saving" })),
    );
    expect(mocks.updates).toEqual([]);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeVisible();
  });

  it("keeps the direct RLS write for a member editing their own tenant's profile", async () => {
    mocks.user = { id: "teammate" };
    mocks.tenant = { id: "member-tenant", name: "Member Garden" };
    mocks.ownProfileUserId.mockResolvedValue("tenant-owner");
    mocks.tenantProfileUserId.mockResolvedValue("tenant-owner");
    mocks.row = profileRow({ id: "member-row" });

    await renderAndEditAddress("1 Main St");

    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.updates[0].id).toBe("member-row");
    expect(mocks.updates[0].payload).toMatchObject({
      user_id: "tenant-owner",
      street_address: "1 Main St",
      city: "Calgary",
    });
    expect(screen.queryByTestId("contact-footer-tenant-scope")).not.toBeInTheDocument();
  });

  it("waits for the active tenant before loading", async () => {
    mocks.user = { id: "admin-user" };
    mocks.tenant = null;
    mocks.tenantLoading = true;
    mocks.ownProfileUserId.mockResolvedValue("admin-user");

    render(
      <MemoryRouter>
        <ContactFooterTab />
      </MemoryRouter>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.ownProfileUserId).not.toHaveBeenCalled();
    expect(mocks.reads).toEqual([]);
  });
});
