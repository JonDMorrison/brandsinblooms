import { describe, expect, it, vi } from "vitest";
import {
  explainReadFailure,
  pickInputs,
  readSuiteData,
  type SuiteDeps,
} from "../../supabase/functions/bloom-assist/tools/implementations/suite-tools";
import { SupportRpcError } from "../../supabase/functions/bloom-assist/tools/implementations/support-tools";
import { getRegisteredTool } from "../../supabase/functions/bloom-assist/tools/registry";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";

const context = { tenantId: "crm-tenant", userId: "user-1", userName: "Ann", serviceClient: {} } as unknown as ToolExecutionContext;

function deps(over: Partial<SuiteDeps> = {}): SuiteDeps & { runRead: ReturnType<typeof vi.fn> } {
  const runRead = vi.fn(async () => ({ pages: [{ id: "p1", title: "Home" }] }));
  return {
    rpcFor: () => (async () => null) as never,
    identity: async () => ({ principalId: "pr-1", role: "client", staff: false, ownTenantId: "crm-tenant", inAdminWorkspace: false, account: { id: "acct-1", name: "Sunny Gardens" } }),
    runRead,
    ...over,
  } as SuiteDeps & { runRead: ReturnType<typeof vi.fn> };
}

class StatusError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

describe("Bloom reads the website and point of sale through Support permissions", () => {
  it("is registered as a read-only query that needs no confirmation", () => {
    const tool = getRegisteredTool("read_suite_data");
    expect(tool?.category).toBe("query");
    expect(tool?.requires_confirmation).toBe(false);
    expect(tool?.risk_level).toBe("safe");
  });

  it("reads for the person's own principal and the company's own account", async () => {
    const d = deps();
    const result = await readSuiteData({ kind: "site.pages" }, context, d);
    expect(result.success).toBe(true);
    expect(d.runRead).toHaveBeenCalledWith(
      { principalId: "pr-1", role: "client", via: "crm_session", name: "Ann", scopes: [] },
      { kind: "site.pages", account_id: "acct-1", inputs: {} },
    );
    // No tenant_id at the top level, so the tenant-isolation scan still applies to everything else.
    expect(result.data).toEqual({ product: "bloomsites", kind: "site.pages", result: { pages: [{ id: "p1", title: "Home" }] } });
  });

  it("forwards only the inputs each read accepts", () => {
    expect(pickInputs("pos.sales_summary", { kind: "pos.sales_summary", from: "2026-10-01", to: "2026-10-31", store_id: "s1", account_id: "someone-else", actor: "admin" }))
      .toEqual({ from: "2026-10-01", to: "2026-10-31", store_id: "s1" });
    expect(pickInputs("site.read", { site_id: " site-9 ", q: "ignored" })).toEqual({ site_id: "site-9" });
  });

  it("refuses kinds that are not reads, such as publishing", async () => {
    const d = deps();
    const result = await readSuiteData({ kind: "site.publish" }, context, d);
    expect(result.success).toBe(false);
    expect(d.runRead).not.toHaveBeenCalled();
  });

  it("says plainly when the person has no access, without upstream detail", async () => {
    const d = deps({ runRead: vi.fn(async () => { throw new StatusError(403, "ops.pos.read required"); }) });
    const result = await readSuiteData({ kind: "pos.inventory" }, context, d);
    expect(result.success).toBe(false);
    expect(result.message).toContain("don't have access");
    expect(result.message).not.toContain("ops.pos.read");
  });

  it("explains a missing connection and a missing store", () => {
    expect(explainReadFailure("pos.products", new StatusError(400, "Account has no linked POS business"))).toContain("not connected");
    expect(explainReadFailure("site.pages", new StatusError(400, "Account has no linked BloomSites site"))).toContain("website is not connected");
    expect(explainReadFailure("pos.inventory", new StatusError(400, "Account has several pos links; pass pos_tenant_id"))).toContain("more than one");
    expect(explainReadFailure("pos.inventory", new StatusError(400, "store_id required"))).toContain("several stores");
    expect(explainReadFailure("site.read", new SupportRpcError("42501", "forbidden: account"))).toContain("could not connect your sign-in");
  });
});

describe("POS price history is a read like the others", () => {
  it("forwards only the variant and business", () => {
    expect(pickInputs("pos.price_history", { variant_id: "v-1", store_id: "ignored", q: "x" })).toEqual({ variant_id: "v-1" });
  });
});
