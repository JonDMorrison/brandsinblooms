import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Support runtime talks to the database through two gateways. Both are
// replaced here so the tests see exactly which checks runRead asks for.
const rpc = vi.fn();
const directRpc = vi.fn();
vi.mock("../../supabase/functions/_shared/bloom-support/runtime.ts", () => {
  class BloomError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  }
  return {
    BloomError,
    rpc: (...args: unknown[]) => rpc(...args),
    directRpc: (...args: unknown[]) => directRpc(...args),
    db: () => { throw new Error("db() must not be used by reads"); },
    env: (k: string) => ({ BLOOM_OPS_URL_CMS: "https://cms.test/ops", BLOOM_OPS_SECRET_CMS: "s1", BLOOM_OPS_URL_POS: "https://pos.test/ops", BLOOM_OPS_SECRET_POS: "s2" } as Record<string, string>)[k],
  };
});

import { CLIENT_READ_KINDS, previewOperation, runRead } from "../../supabase/functions/_shared/bloom-support/operations";
import { explainReadFailure, SALES_OWNER_ONLY_MESSAGE, SUITE_READ_KINDS } from "../../supabase/functions/bloom-assist/tools/implementations/suite-tools";
import { getRegisteredTool } from "../../supabase/functions/bloom-assist/tools/registry";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OTHER_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const client = { principalId: "client-1", role: "client", via: "crm_session" as const, name: "Ann", scopes: [] };
const staff = { principalId: "staff-1", role: "support", via: "crm_session" as const, name: "Sam", scopes: [] };
const account = { id: ACCOUNT, name: "Green Acres", crm_tenant_id: "t1", links: [{ product: "cms", external_id: "site-1", label: null }, { product: "pos", external_id: "pos-1", label: null }] };

type Verdict = { allowed: boolean; reason?: string; permission?: string };
function wire(opts: { staffPermission: boolean; verdict?: Verdict }) {
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "has_permission") return opts.staffPermission;
    if (fn === "get_account") {
      if (args.account_id !== ACCOUNT) throw Object.assign(new Error("forbidden: account"), { status: 403, code: "forbidden" });
      return account;
    }
    if (fn === "log") return { ok: true };
    throw new Error(`unexpected rpc ${fn}`);
  });
  directRpc.mockImplementation(async () => opts.verdict ?? { allowed: false, reason: "not_client" });
}

const fetchMock = vi.fn(async (_url: string, init: { body: string }) => new Response(JSON.stringify({ ok: true, echo: JSON.parse(init.body) }), { status: 200 }));

beforeEach(() => {
  rpc.mockReset();
  directRpc.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Client reads of their own website and POS data", () => {
  it("lets a client read site pages, products and stock for their own company", async () => {
    for (const [kind, permission, host] of [
      ["site.pages", "client.site.read", "cms.test"],
      ["site.read", "client.site.read", "cms.test"],
      ["pos.products", "client.pos.read", "pos.test"],
      ["pos.inventory", "client.pos.read", "pos.test"],
    ] as const) {
      fetchMock.mockClear();
      wire({ staffPermission: false, verdict: { allowed: true, permission } });
      const out = await runRead(client, { kind, account_id: ACCOUNT, inputs: {} }) as { echo: Record<string, unknown> };
      expect(directRpc).toHaveBeenLastCalledWith("bloom_support_client_suite_read", { p_actor: "client-1", p_account: ACCOUNT, p_kind: kind });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain(host);
      // The product target is the account's own linked record, never model input.
      expect(out.echo.site_id ?? out.echo.pos_tenant_id).toBe(kind.startsWith("pos.") ? "pos-1" : "site-1");
      // Audited by the database at authorization; the staff-only log route is not called.
      expect(rpc.mock.calls.some(([fn]) => fn === "log")).toBe(false);
    }
  });

  it("refuses sales figures to a client who is not the owner or an admin, before reaching the POS", async () => {
    for (const kind of ["pos.sales_summary", "pos.price_history"]) {
      wire({ staffPermission: false, verdict: { allowed: false, reason: "owner_or_admin_only" } });
      const err = await runRead(client, { kind, account_id: ACCOUNT, inputs: {} }).catch((e) => e);
      expect(err).toMatchObject({ status: 403, code: "owner_or_admin_only" });
      expect(explainReadFailure(kind as (typeof SUITE_READ_KINDS)[number], err)).toBe(SALES_OWNER_ONLY_MESSAGE);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it("lets a client owner or admin read the sales summary", async () => {
    wire({ staffPermission: false, verdict: { allowed: true, permission: "client.pos.sales" } });
    await runRead(client, { kind: "pos.sales_summary", account_id: ACCOUNT, inputs: { from: "2026-10-01", to: "2026-10-31" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: "pos.sales_summary", pos_tenant_id: "pos-1" });
  });

  it("refuses another company's account and a site not linked to the client's account", async () => {
    wire({ staffPermission: false, verdict: { allowed: false, reason: "account" } });
    await expect(runRead(client, { kind: "site.pages", account_id: OTHER_ACCOUNT, inputs: {} })).rejects.toMatchObject({ status: 403, code: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();

    wire({ staffPermission: false, verdict: { allowed: true, permission: "client.site.read" } });
    await expect(runRead(client, { kind: "site.pages", account_id: ACCOUNT, inputs: { site_id: "someone-elses-site" } })).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never offers clients staff-only reads, and never asks the client check for them", async () => {
    wire({ staffPermission: false, verdict: { allowed: true, permission: "client.site.read" } });
    for (const kind of ["client.lookup", "campaign.list", "campaign.read"]) {
      await expect(runRead(client, { kind, account_id: ACCOUNT, inputs: {} })).rejects.toMatchObject({ status: 403 });
    }
    expect(directRpc).not.toHaveBeenCalled();
    expect([...CLIENT_READ_KINDS].sort()).toEqual([...SUITE_READ_KINDS].sort());
  });

  it("gives clients no write path: previews of changes are refused", async () => {
    wire({ staffPermission: false, verdict: { allowed: true, permission: "client.site.read" } });
    for (const kind of ["site.page.update", "site.publish", "site.section.update", "event.update", "campaign.schedule"]) {
      await expect(previewOperation(client, { kind, account_id: ACCOUNT, inputs: {} })).rejects.toMatchObject({ status: 403 });
    }
    expect(directRpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps staff behaviour unchanged: staff permission, no client check, generic audit", async () => {
    wire({ staffPermission: true });
    await runRead(staff, { kind: "pos.sales_summary", account_id: ACCOUNT, inputs: {} });
    expect(directRpc).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("has_permission", { actor: "staff-1", permission: "ops.pos.read" });
    expect(rpc.mock.calls.some(([fn]) => fn === "log")).toBe(true);

    // A staff principal without the permission is not routed to the client path.
    wire({ staffPermission: false, verdict: { allowed: true, permission: "client.pos.read" } });
    await expect(runRead(staff, { kind: "pos.products", account_id: ACCOUNT, inputs: {} })).rejects.toMatchObject({ status: 403 });
    expect(directRpc).not.toHaveBeenCalled();
  });

  it("tells the model plainly what clients can and cannot see", () => {
    const description = String(getRegisteredTool("read_suite_data")?.function.description ?? "");
    expect(description).toContain("owner or an admin");
    expect(description).toContain("stock levels");
  });
});

describe("Client read migration", () => {
  const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261104190000_bloom_support_client_suite_reads.sql"), "utf8");

  it("grants clients read-only client.* permissions and nothing under ops.*", () => {
    const grants = [...sql.matchAll(/\('client',\s*'([^']+)'\)/g)].map((m) => m[1]);
    expect(grants.sort()).toEqual(["client.pos.read", "client.pos.sales", "client.site.read"]);
    expect(sql).not.toMatch(/'client',\s*'ops\./);
  });

  it("limits sales to the tenant's CRM owner/admin and keeps the function service-role only", () => {
    expect(sql).toMatch(/v_permission = 'client\.pos\.sales' AND v_crm_role NOT IN \('owner', 'admin'\)/);
    expect(sql).toMatch(/u\.id = v_principal\.auth_user_id AND u\.tenant_id = v_tenant/);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.bloom_support_client_suite_read(uuid, uuid, text) FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.bloom_support_client_suite_read(uuid, uuid, text) TO service_role;");
  });
});
