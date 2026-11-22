import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync(
  "supabase/functions/pos-sync-worker/index.ts",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260903153000_loyalty_provider_account_ledger.sql",
  "utf8",
);
const fullSyncCallers = [
  "shopify-full-sync",
  "clover-full-sync",
  "square-full-sync",
  "lightspeed-full-sync",
].map((name) =>
  readFileSync(`supabase/functions/${name}/index.ts`, "utf8"),
);

describe("POS loyalty sync release gate", () => {
  it("requires a verified service credential before claiming sync jobs", () => {
    expect(config).toMatch(
      /\[functions\.pos-sync-worker\]\s*verify_jwt = true/,
    );
    expect(worker).toContain("isServiceRequest(req, serviceRoleKey)");
    expect(worker).toContain(
      'req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`',
    );
    expect(worker.indexOf("isServiceRequest(req, serviceRoleKey)")).toBeLessThan(
      worker.indexOf('supabase.rpc(\n      "claim_next_pos_sync_job"'),
    );
    for (const caller of fullSyncCallers) {
      expect(caller).toContain("const workerClient = createClient(");
      expect(caller).toContain(
        'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""',
      );
      expect(caller).toContain("await workerClient.functions.invoke(");
    }
  });

  it("writes Square accounts through the normalized snapshot RPC", () => {
    expect(worker).toContain('"sync_loyalty_account_snapshot"');
    expect(worker).toContain('p_provider: "square"');
    expect(worker).toContain('p_balance_unit: "points"');
    expect(worker).toContain("Square loyalty snapshot failed");
    expect(worker).not.toMatch(/^\s*program_name: "Square Loyalty"/m);
    expect(worker).not.toMatch(/^\s*points_balance: account\.balance/m);
    expect(worker).not.toMatch(/^\s*external_loyalty_id: account\.id/m);
  });

  it("keeps provider balances and immutable source snapshots", () => {
    expect(migration).toContain(
      "CREATE TABLE public.loyalty_provider_accounts",
    );
    expect(migration).toContain(
      "CREATE TABLE public.loyalty_provider_balance_snapshots",
    );
    expect(migration).toContain(
      "balance_unit IN ('points', 'currency', 'unknown')",
    );
    expect(migration).toContain("provider, external_account_id");
    expect(migration).toContain("legacy_metrics");
    expect(migration).toContain("crm_import");
  });

  it("makes synchronization service-only and tenant-consistent", () => {
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(migration).toContain("customer.tenant_id = p_tenant_id");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("validate_loyalty_provider_account_tenant");
    expect(migration).toContain("validate_loyalty_provider_snapshot_tenant");
  });
});

import React from "react";
import {afterEach, beforeEach, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {POSMembership} from "@/components/crm/POSMembership";
import {latestMembershipPolicies, loadMembershipWorkspace, saveMembershipPolicy, validateMembershipPolicy, type MembershipPolicyInput} from "@/lib/crm/posMembership";
const membershipMocks = vi.hoisted(() => ({rpc: vi.fn(), invoke: vi.fn(), role: "owner_admin"}));
vi.mock("@/integrations/supabase/client", () => ({supabase: {rpc: membershipMocks.rpc, functions: {invoke: membershipMocks.invoke}}}));
vi.mock("@/hooks/useTenant", () => ({useTenant: () => ({tenant: {id: "tenant"}})}));
const validPolicy: MembershipPolicyInput = {keyId: "connection", storeId: "00000000-0000-4000-8000-000000000001", programmeVersionId: "version", expectedVersion: null, authority: "PROVIDER", termsVersion: "2026-11", terms: "The actual membership terms customers see.", emailStatement: "Please send me your email marketing updates.", smsStatement: "Please send me your text marketing updates.", enabled: false};
describe("POS membership administration", () => {
  beforeEach(() => {membershipMocks.rpc.mockReset(); membershipMocks.invoke.mockReset(); membershipMocks.role = "owner_admin";});
  afterEach(cleanup);
  it("requires explicit authority and separate statements and saves disabled by default", async () => {
    expect(validateMembershipPolicy({...validPolicy, authority: ""})).not.toBeNull();
    expect(validateMembershipPolicy({...validPolicy, smsStatement: ""})).not.toBeNull();
    membershipMocks.rpc.mockResolvedValueOnce({data: "policy", error: null});
    await saveMembershipPolicy(validPolicy);
    expect(membershipMocks.rpc).toHaveBeenCalledWith("save_pos_membership_policy", expect.objectContaining({p_enabled: false, p_authority: "PROVIDER", p_expected_version: null, p_email_statement: validPolicy.emailStatement, p_sms_statement: validPolicy.smsStatement}));
    expect(membershipMocks.invoke).not.toHaveBeenCalled();
  });
  it("uses latest policy versions per connection and store", () => {
    const old = {id: "old", key_id: "key", store_id: "store", version: 1};
    const current = {...old, id: "new", version: 2};
    expect(latestMembershipPolicies([current, old] as never)).toEqual([current]);
  });
  it("rejects workspace data for a different selected tenant", async () => {
    membershipMocks.rpc.mockImplementation((name: string) => Promise.resolve({data: name === "get_current_crm_access" ? {tenantId: "different"} : {policies: []}, error: null}));
    await expect(loadMembershipWorkspace("tenant")).rejects.toThrow("selected business");
  });
  function renderWorkspace(role: string) {
    membershipMocks.rpc.mockImplementation((name: string) => Promise.resolve({data: name === "get_current_crm_access" ? {tenantId: "tenant"} : {role, programmes: [{id: "programme", name: "Store membership", versionId: "version"}], connections: [{keyId: "key", posTenantId: "pos"}], policies: [], requests: []}, error: null}));
    render(React.createElement(QueryClientProvider, {client: new QueryClient({defaultOptions: {queries: {retry: false}}})}, React.createElement(POSMembership)));
  }
  it("starts with checkout disabled and no chosen authority; loading creates nothing", async () => {
    renderWorkspace("owner_admin");
    expect(await screen.findByRole("checkbox", {name: "Enable this policy at the selected POS store"})).not.toBeChecked();
    expect(screen.getByText("Choose who confirms membership")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Save policy version"})).toBeDisabled();
    expect(membershipMocks.rpc.mock.calls.some(([name]) => name === "save_pos_membership_policy")).toBe(false);
  });
  it("keeps policy mutation unavailable to marketing staff", async () => {
    renderWorkspace("marketing_staff");
    expect(await screen.findByText("An account owner manages checkout membership policies.")).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Save policy version"})).toBeNull();
  });
  it("requires live session workspace validation before the service review call", () => {
    const edge = readFileSync("supabase/functions/pos-membership-review/index.ts", "utf8");
    expect(edge.indexOf('userClient.rpc("pos_membership_workspace")')).toBeLessThan(edge.indexOf('admin.rpc("review_pos_membership_request"'));
    expect(edge).toContain('access?.tenantId !== input.tenantId');
    expect(edge).toContain('userClient.auth.getUser(token)');
    expect(edge).toContain('p_user: user.id');
    expect(edge).not.toContain('p_user: input.');
    expect(readFileSync("supabase/config.toml", "utf8")).toMatch(/\[functions.pos-membership-review\]\s*verify_jwt = true/);
  });
});

import ts from "typescript";
describe("membership review edge authorization", () => {
  async function exercise(overrides: {tenant?: string; workspaceError?: boolean; userError?: boolean; state?: string; purchase?: string; reject?: boolean; oversized?: boolean} = {}) {
    let handler: (request: Request) => Promise<Response> = async () => new Response(null, {status: 500});
    const serviceRpc = vi.fn().mockResolvedValue({data: null, error: null});
    const userRpc = vi.fn().mockImplementation((name: string) => Promise.resolve(name === "get_current_crm_access" ? {data: {tenantId: overrides.tenant || "00000000-0000-4000-8000-000000000001"}, error: null} : {data: {requests: [{id: "00000000-0000-4000-8000-000000000002", state: overrides.state || "REVIEW_REQUIRED", purchase_result: overrides.purchase}]}, error: overrides.workspaceError ? {message: "session revoked"} : null}));
    const createClient = vi.fn().mockImplementation((_url: string, key: string) => key === "service" ? {rpc: serviceRpc} : {rpc: userRpc, auth: {getUser: async () => ({data: {user: {id: "verified-user"}}, error: overrides.userError ? {message: "invalid"} : null})}});
    const source = readFileSync("supabase/functions/pos-membership-review/index.ts", "utf8").replace(/^import.*\n/gm, "");
    const javascript = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None}}).outputText;
    new Function("serve", "createClient", "Deno", javascript)((next: typeof handler) => {handler = next;}, createClient, {env: {get: (key: string) => ({SUPABASE_URL: "https://database.test", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service"})[key]}});
    const response = await handler(new Request("https://edge.test", {method: "POST", headers: {Authorization: "Bearer user-jwt", "Content-Type": "application/json"}, body: JSON.stringify({tenantId: "00000000-0000-4000-8000-000000000001", requestId: "00000000-0000-4000-8000-000000000002", reject: overrides.reject ?? false, reason: "Checked the original identity evidence.", userId: "attacker", customerId: "arbitrary", extra: overrides.oversized ? "é".repeat(5000) : ""})}));
    return {response, serviceRpc, createClient};
  }
  it("rejects oversized actual UTF-8 bodies before auth or service clients", async () => {
    const result = await exercise({oversized: true});
    expect(result.response.status).toBe(413);
    expect(result.createClient).not.toHaveBeenCalled();
    expect(result.serviceRpc).not.toHaveBeenCalled();
  });
  it("rejects revoked sessions and cross-tenant inputs without privileged writes", async () => {
    for (const override of [{workspaceError: true}, {tenant: "foreign"}, {userError: true}]) {
      const result = await exercise(override);
      expect([401, 403]).toContain(result.response.status);
      expect(result.serviceRpc).not.toHaveBeenCalled();
      expect(result.createClient.mock.calls.some(([, key]) => key === "service")).toBe(false);
    }
  });
  it("allows confirmed purchase-link retry but blocks confirmed rejection and completed links", async () => {
    expect((await exercise({state: "CONFIRMED", purchase: "pending"})).response.status).toBe(200);
    for (const override of [{state: "CONFIRMED", purchase: "linked"}, {state: "CONFIRMED", purchase: "pending", reject: true}]) {
      const result = await exercise(override);
      expect(result.response.status).toBe(409);
      expect(result.serviceRpc).not.toHaveBeenCalled();
    }
  });
  it("uses the verified user and tenant and never forwards an arbitrary contact", async () => {
    const result = await exercise();
    expect(result.response.status).toBe(200);
    expect(result.serviceRpc).toHaveBeenCalledWith("review_pos_membership_request", {p_tenant: "00000000-0000-4000-8000-000000000001", p_user: "verified-user", p_request: "00000000-0000-4000-8000-000000000002", p_reject: false, p_reason: "Checked the original identity evidence."});
  });
});
