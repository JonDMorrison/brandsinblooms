import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  toast: vi.fn(),
  getTenantBusinessProfileUserId: vi.fn(),
  notifyBusinessProfileChanged: vi.fn(),
  auth: { user: { id: "signed-in-user" } as { id: string } | null },
  tenant: {
    tenant: { id: "tenant-a", name: "Client Garden Co" } as
      | { id: string; name: string; fallback_from_name?: string | null }
      | null,
    loading: false,
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: (column: string, value: string) => {
      mocks.eq(column, value);
      return chain;
    },
    maybeSingle: () => mocks.maybeSingle(),
    update: (...args: unknown[]) => {
      mocks.update(...args);
      return chain;
    },
    insert: (...args: unknown[]) => {
      mocks.insert(...args);
      return chain;
    },
  };
  return {
    supabase: {
      rpc: (...args: unknown[]) => mocks.rpc(...args),
      from: (table: string) => {
        mocks.from(table);
        return chain;
      },
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => mocks.tenant,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/profile/businessProfileUserId", () => ({
  getTenantBusinessProfileUserId: (...args: unknown[]) =>
    mocks.getTenantBusinessProfileUserId(...args),
  notifyBusinessProfileChanged: (...args: unknown[]) =>
    mocks.notifyBusinessProfileChanged(...args),
}));

import { ContactFooterTab } from "../ContactFooterTab";

const PROFILE_ROW = {
  id: "profile-row",
  company_name: "Client Garden Co",
  company_phone: "555-0100",
  company_email: "hello@client.example",
  website_url: "",
  street_address: "",
  city: "",
  state_province: "",
  postal_code: "",
  country: "",
  facebook_url: null,
  instagram_url: null,
  tiktok_url: null,
  pinterest_url: null,
  youtube_url: null,
  linkedin_url: null,
  footer_legal_text: null,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ContactFooterTab />
    </MemoryRouter>,
  );
}

async function editStreetAndSave(street: string) {
  fireEvent.click(await screen.findByRole("button", { name: /edit/i }));
  fireEvent.change(screen.getByLabelText("Street Address"), {
    target: { value: street },
  });
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
}

describe("ContactFooterTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "signed-in-user" };
    mocks.tenant = {
      tenant: { id: "tenant-a", name: "Client Garden Co" },
      loading: false,
    };
    mocks.maybeSingle.mockResolvedValue({ data: PROFILE_ROW, error: null });
    mocks.rpc.mockResolvedValue({
      data: [{ profile_id: "profile-row", profile_user_id: "client-owner" }],
      error: null,
    });
  });

  it("loads the active tenant's business profile, not the signed-in user's", async () => {
    mocks.getTenantBusinessProfileUserId.mockResolvedValue("client-owner");

    renderPage();

    expect(
      await screen.findByTestId("contact-footer-editing-business"),
    ).toHaveTextContent("Editing Client Garden Co");
    expect(mocks.getTenantBusinessProfileUserId).toHaveBeenCalledWith(
      "signed-in-user",
      "tenant-a",
    );
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "client-owner");
    expect(screen.getByLabelText("Phone Number")).toHaveValue("555-0100");
  });

  it("saves a master admin's edit in another tenant through the RPC with that tenant id", async () => {
    mocks.getTenantBusinessProfileUserId.mockResolvedValue("client-owner");

    renderPage();
    await editStreetAndSave("1 Orchard Lane");

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    const [name, args] = mocks.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("save_tenant_contact_footer");
    expect(args.p_tenant_id).toBe("tenant-a");
    expect(args.p_street_address).toBe("1 Orchard Lane");
    expect(args.p_company_phone).toBe("555-0100");
    // No direct table write that RLS would route to the admin's own row.
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    // The readiness check's data source is told to reload.
    await waitFor(() =>
      expect(mocks.notifyBusinessProfileChanged).toHaveBeenCalledWith({
        tenantId: "tenant-a",
        profileUserId: "client-owner",
      }),
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Saved successfully" }),
    );
  });

  it("saves a member's edit to their own tenant's profile", async () => {
    mocks.auth.user = { id: "member-user" };
    mocks.tenant = {
      tenant: { id: "member-tenant", name: "Member Nursery" },
      loading: false,
    };
    mocks.getTenantBusinessProfileUserId.mockResolvedValue("member-tenant-owner");
    mocks.maybeSingle.mockResolvedValue({
      data: { ...PROFILE_ROW, company_name: "Member Nursery" },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: [{ profile_id: "member-row", profile_user_id: "member-tenant-owner" }],
      error: null,
    });

    renderPage();
    expect(
      await screen.findByTestId("contact-footer-editing-business"),
    ).toHaveTextContent("Editing Member Nursery");
    await editStreetAndSave("9 Fern Road");

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "save_tenant_contact_footer",
        expect.objectContaining({
          p_tenant_id: "member-tenant",
          p_street_address: "9 Fern Road",
        }),
      ),
    );
    await waitFor(() =>
      expect(mocks.notifyBusinessProfileChanged).toHaveBeenCalledWith({
        tenantId: "member-tenant",
        profileUserId: "member-tenant-owner",
      }),
    );
  });

  it("omits the tenant for a user without a tenant (own profile)", async () => {
    mocks.tenant = { tenant: null, loading: false };
    mocks.getTenantBusinessProfileUserId.mockResolvedValue("signed-in-user");
    mocks.rpc.mockResolvedValue({
      data: [{ profile_id: "own-row", profile_user_id: "signed-in-user" }],
      error: null,
    });

    renderPage();
    await editStreetAndSave("2 Elm St");

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    const [, args] = mocks.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(args).not.toHaveProperty("p_tenant_id");
    await waitFor(() =>
      expect(mocks.notifyBusinessProfileChanged).toHaveBeenCalledWith({
        tenantId: null,
        profileUserId: "signed-in-user",
      }),
    );
  });

  it("explains when the tenant has no business profile yet", async () => {
    mocks.getTenantBusinessProfileUserId.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByTestId("contact-footer-no-profile")).toBeInTheDocument();
    expect(screen.getByTestId("contact-footer-editing-business")).toHaveTextContent(
      "Editing Client Garden Co",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("waits for the active tenant before loading", async () => {
    mocks.tenant = { tenant: null, loading: true };
    mocks.getTenantBusinessProfileUserId.mockResolvedValue("signed-in-user");

    renderPage();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.getTenantBusinessProfileUserId).not.toHaveBeenCalled();
  });

  it("shows the RPC's permission message and does not announce a save", async () => {
    mocks.getTenantBusinessProfileUserId.mockResolvedValue("client-owner");
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "You do not have permission to edit this business profile.",
      },
    });

    renderPage();
    await editStreetAndSave("1 Orchard Lane");

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error saving",
          description: "You do not have permission to edit this business profile.",
        }),
      ),
    );
    expect(mocks.notifyBusinessProfileChanged).not.toHaveBeenCalled();
  });
});
