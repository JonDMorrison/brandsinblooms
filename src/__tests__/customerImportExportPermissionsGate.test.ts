import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCustomers } from "@/hooks/useCustomers";

const customerQueryMocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: customerQueryMocks.from,
    auth: { getUser: customerQueryMocks.getUser },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const customerPage = readFileSync(
  "src/pages/crm/CRMCustomersPage.tsx",
  "utf8",
);
const exportMigration = readFileSync(
  "supabase/migrations/20260903234000_owner_authorized_customer_export.sql",
  "utf8",
);

describe("customer import and export permissions", () => {
  it("shows full-database export and merge review only to owner/admin", () => {
    expect(customerPage).toContain(
      'const canExportCustomers = crmRole === "owner_admin"',
    );
    expect(customerPage).toContain(
      'const canDeleteCustomers = crmRole === "owner_admin"',
    );
    expect(customerPage).toContain("{canExportCustomers ? (");
    expect(customerPage).toContain("{canDeleteCustomers ? (");
  });

  it("allows list imports only for owner/admin and marketing roles", () => {
    expect(customerPage).toContain('crmRole === "owner_admin"');
    expect(customerPage).toContain('crmRole === "marketing"');
    expect(customerPage).toContain("{canImportCustomers ? (");
    expect(customerPage).toContain(
      'searchParams.get("import") === "1" && canImportCustomers',
    );
  });

  it("authorizes exports with the canonical tenant access resolver", () => {
    expect(exportMigration).toContain("public.get_current_crm_access()");
    expect(exportMigration).toContain(
      "v_access->>'role' IS DISTINCT FROM 'owner_admin'",
    );
    expect(exportMigration).toContain(
      "customer.tenant_id = v_tenant_id",
    );
    expect(exportMigration).toContain("FROM PUBLIC, anon");
  });
});


describe("tenant-scoped CRM tag filtering", () => {
  const makeBuilder = () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      or: vi.fn(),
      then: vi.fn((resolve: (result: unknown) => void) =>
        Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
      ),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.range.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    customerQueryMocks.from.mockReturnValue(builder);
    return builder;
  };

  const query = async (options: Parameters<typeof useCustomers>[0]) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);
    const rendered = renderHook(() => useCustomers(options), { wrapper });
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    rendered.unmount();
    client.clear();
  };

  beforeEach(() => {
    customerQueryMocks.from.mockReset();
    customerQueryMocks.getUser.mockReset();
    customerQueryMocks.getUser.mockResolvedValue({
      data: { user: { id: "signed-in-user" } },
      error: null,
    });
  });

  it("filters all pages by joined CRM tag, preserving tenant, count and pagination", async () => {
    const builder = makeBuilder();
    await query({
      tenantId: "tenant-a",
      tagId: "tag-b",
      page: 2,
      pageSize: 15,
    });

    expect(customerQueryMocks.from).toHaveBeenCalledWith("crm_customers");
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining("customer_tags!inner(tag_id)"),
      { count: "exact" },
    );
    expect(builder.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(builder.eq).toHaveBeenCalledWith("customer_tags.tag_id", "tag-b");
    expect(builder.range).toHaveBeenCalledWith(15, 29);
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.is).toHaveBeenCalledWith("merged_into_customer_id", null);
  });

  it("does not restrict to tagged customers until a tag is chosen", async () => {
    const builder = makeBuilder();
    await query({ tenantId: "tenant-a", page: 1, pageSize: 15 });

    expect(builder.select).toHaveBeenCalledWith(
      expect.not.stringContaining("customer_tags!inner(tag_id)"),
      { count: "exact" },
    );
    expect(builder.eq).not.toHaveBeenCalledWith(
      "customer_tags.tag_id",
      expect.anything(),
    );
    expect(builder.range).toHaveBeenCalledWith(0, 14);
  });

  it("combines tag filtering with customer search without dropping tenant scope", async () => {
    const builder = makeBuilder();
    await query({
      tenantId: "tenant-a",
      tagId: "tag-b",
      search: "Rose",
      page: 1,
      pageSize: 15,
    });

    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("Rose"));
    expect(builder.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(builder.eq).toHaveBeenCalledWith("customer_tags.tag_id", "tag-b");
  });

  it("offers only tags fetched through the existing tenant-scoped tag hook", () => {
    const tagsHook = readFileSync("src/hooks/useCRMTags.ts", "utf8");
    const customerHook = readFileSync("src/hooks/useCustomers.ts", "utf8");

    expect(tagsHook).toContain('.eq("tenant_id", tenant.id)');
    expect(customerPage).toContain("Filter by CRM tag");
    expect(customerPage).toContain("availableTags.find");
    expect(customerPage).toContain("selectedTag?.id ?? null");
    expect(customerPage).toContain("setCurrentPage(1)");
    expect(customerPage).toContain("clearSelection()");
    expect(customerPage).toContain("Couldn't load contacts");
    expect(customerPage).toContain("onClick: invalidateCustomers");
    expect(customerHook).toContain("options.tagId");
  });
});
