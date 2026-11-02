import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildSupportDedupeKey,
  checkSupportRequest,
  cleanErrorText,
  loadFailedToolRuns,
  reportSupportProblem,
  runSelfDiagnostics,
  SupportRpcError,
  type SupportRpc,
} from "../../supabase/functions/bloom-assist/tools/implementations/support-tools";
import { getRegisteredTool } from "../../supabase/functions/bloom-assist/tools/registry";
import { parseClientContext } from "../../supabase/functions/bloom-assist/client-context";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";
import { readBloomDiagnostics } from "@/lib/bloomSupport/api";

const OWN_TENANT ="11111111-1111-4111-8111-111111111111";
const CLIENT_TENANT = "22222222-2222-4222-8222-222222222222";
const CONVERSATION = "33333333-3333-4333-8333-333333333333";
const MESSAGE = "44444444-4444-4444-8444-444444444444";
// Built at runtime so the committed-credential scanner does not flag this fake token.
const JWT = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJ1c2VyLTEyMzQ1Njc4In0", "c2lnbmF0dXJlLXZhbHVl"].join(".");

type Response = { data: unknown; error: { message: string } | null; count?: number | null };

/** Chainable PostgREST stand-in. `respond` decides each table's answer. */
function client(respond: (table: string, calls: Array<[string, unknown[]]>) => Response | Promise<Response>) {
  const log: Array<{ table: string; calls: Array<[string, unknown[]]> }> = [];
  return {
    log,
    client: {
      rpc: vi.fn(),
      from: (table: string) => {
        const entry = { table, calls: [] as Array<[string, unknown[]]> };
        log.push(entry);
        const builder: Record<string, unknown> = {};
        for (const m of ["select", "insert", "eq", "is", "or", "in", "not", "gte", "order", "limit", "abortSignal"]) {
          builder[m] = (...args: unknown[]) => { entry.calls.push([m, args]); return builder; };
        }
        builder.maybeSingle = () => Promise.resolve(respond(table, entry.calls));
        builder.then = (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
          Promise.resolve().then(() => respond(table, entry.calls)).then(ok, fail);
        return builder;
      },
    },
  };
}

function fakeRpc(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const defaults: Record<string, unknown> = {
    resolve_crm_user: "principal-jon",
    whoami: { role: "platform_admin" },
    account_for_crm_tenant: { id: "account-client", name: "West Coast Gardens" },
    create_ticket: { ticket_id: "ticket-1", number: 1042, duplicate_delivery: false },
    ensure_service_principal: "principal-bot",
    set_automation: {},
    update_ticket: {},
    list_tickets: [],
  };
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const value = fn in overrides ? overrides[fn] : defaults[fn];
    if (value instanceof Error) throw value;
    return value;
  }) as unknown as SupportRpc;
  return { rpc, calls };
}

function context(opts: {
  tenantId?: string;
  ownTenant?: string | null;
  failedRuns?: Response;
  dataClient?: unknown;
  approved?: boolean;
  role?: string;
  serviceTables?: (table: string, calls: Array<[string, unknown[]]>) => Response | undefined;
  serviceLog?: Array<{ table: string; calls: Array<[string, unknown[]]> }>;
}): ToolExecutionContext {
  const service = client((table, calls) => {
    const custom = opts.serviceTables?.(table, calls);
    if (custom) return custom;
    if (table === "users") return { data: { email: "jon@example.com", full_name: "Jon", tenant_id: opts.ownTenant === undefined ? OWN_TENANT : opts.ownTenant }, error: null };
    if (table === "tenants") return { data: { name: "Brands in Blooms" }, error: null };
    if (table === "bloom_tool_executions") return opts.failedRuns ?? { data: [], error: null };
    return { data: null, error: { message: `unexpected table ${table}` } };
  });
  const serviceLog = opts.serviceLog;
  if (serviceLog) {
    const from = service.client.from;
    service.client.from = (table: string) => {
      const builder = from(table);
      serviceLog.push(service.log[service.log.length - 1]);
      return builder;
    };
  }
  return {
    tenantId: opts.tenantId ?? CLIENT_TENANT,
    authenticatedTenantId: opts.tenantId ?? CLIENT_TENANT,
    userId: "user-jon",
    userRole: opts.role ?? "admin",
    userName: "Jon",
    conversationId: CONVERSATION,
    messageId: MESSAGE,
    timezone: "UTC",
    approved: opts.approved ?? true,
    clientContext: { route: "/crm/segments", user_agent: "Mozilla/5.0 Test", viewport: "1280x800" },
    serviceClient: service.client,
    dataClient: opts.dataClient,
  } as unknown as ToolExecutionContext;
}

describe("report_support_problem", () => {
  it("files a master admin's report against the client workspace account, keeping the admin as requester", async () => {
    const { rpc, calls } = fakeRpc();
    const result = await reportSupportProblem({ what_happened: "The segments page shows the same list twice." }, context({}), rpc);

    expect(result.success).toBe(true);
    const resolve = calls.find((c) => c.fn === "resolve_crm_user")!;
    expect(resolve.args).toMatchObject({ auth_user_id: "user-jon", email: "jon@example.com", tenant_id: OWN_TENANT, tenant_name: "Brands in Blooms" });
    const account = calls.find((c) => c.fn === "account_for_crm_tenant")!;
    expect(account.args).toEqual({ actor: "principal-jon", tenant_id: CLIENT_TENANT, tenant_name: null });
    const create = calls.find((c) => c.fn === "create_ticket")!;
    expect(create.args.actor).toBe("principal-jon");
    const ticket = create.args.ticket as Record<string, unknown>;
    expect(ticket).toMatchObject({ account_id: "account-client", channel: "crm", product: "crm" });
    expect(ticket).not.toHaveProperty("requester_id");
    const diagnostics = (ticket.context as Record<string, Record<string, unknown>>).diagnostics;
    expect(diagnostics).toMatchObject({ filed_by_staff: true, admin_workspace: true, tenant_id: CLIENT_TENANT, account_id: "account-client", route: "/crm/segments", bloom_conversation_id: CONVERSATION });
    expect(result.message).toContain("#1042");
    expect(result.message).toContain("West Coast Gardens");
  });

  it("files a regular user's report against their own company", async () => {
    const { rpc, calls } = fakeRpc({ whoami: { role: "client" } });
    await reportSupportProblem({ what_happened: "Customers are missing from my list." }, context({ tenantId: OWN_TENANT }), rpc);
    expect(calls.find((c) => c.fn === "account_for_crm_tenant")!.args).toEqual({ actor: "principal-jon", tenant_id: OWN_TENANT, tenant_name: "Brands in Blooms" });
    const diagnostics = ((calls.find((c) => c.fn === "create_ticket")!.args.ticket as Record<string, unknown>).context as Record<string, Record<string, unknown>>).diagnostics;
    expect(diagnostics).toMatchObject({ filed_by_staff: false, admin_workspace: false });
  });

  it("uses conversation_id:message_id as the dedupe key and pauses automation only on a new ticket", async () => {
    expect(buildSupportDedupeKey(CONVERSATION, MESSAGE)).toBe(`${CONVERSATION}:${MESSAGE}`);
    const first = fakeRpc();
    await reportSupportProblem({ what_happened: "Email sending stopped this morning." }, context({}), first.rpc);
    expect((first.calls.find((c) => c.fn === "create_ticket")!.args.ticket as Record<string, unknown>).dedupe_key).toBe(`${CONVERSATION}:${MESSAGE}`);
    expect(first.calls.find((c) => c.fn === "set_automation")!.args).toMatchObject({ actor: "principal-bot", ticket_id: "ticket-1", mode: "paused" });
    expect(first.calls.find((c) => c.fn === "update_ticket")!.args).toMatchObject({ actor: "principal-bot", patch: { tags: ["bloom-chat"], internal_only: true } });
    const order = first.calls.map((c) => c.fn);
    expect(order.indexOf("set_automation")).toBeGreaterThan(order.indexOf("create_ticket"));
    expect(order.indexOf("update_ticket")).toBeGreaterThan(order.indexOf("set_automation"));

    const retry = fakeRpc({ create_ticket: { ticket_id: "ticket-1", number: 1042, duplicate_delivery: true } });
    const again = await reportSupportProblem({ what_happened: "Email sending stopped this morning." }, context({}), retry.rpc);
    expect(again.success).toBe(true);
    expect(retry.calls.some((c) => c.fn === "set_automation" || c.fn === "update_ticket")).toBe(false);
  });

  it("attaches up to 10 recent failures with redacted, 300-character error text", async () => {
    const long = `Request failed with token ${JWT} ${"x".repeat(600)}`;
    const rows = Array.from({ length: 12 }, (_, i) => ({ tool_name: `query_customers_${i}`, created_at: "2026-11-02T10:00:00Z", error_message: "execution_error", output_message: long }));
    const { rpc, calls } = fakeRpc();
    await reportSupportProblem({ what_happened: "Bloom keeps failing on customers." }, context({ failedRuns: { data: rows, error: null } }), rpc);
    const diagnostics = ((calls.find((c) => c.fn === "create_ticket")!.args.ticket as Record<string, unknown>).context as Record<string, Record<string, unknown>>).diagnostics;
    const runs = diagnostics.failed_tool_runs as Array<{ error: string }>;
    expect(runs).toHaveLength(10);
    for (const run of runs) {
      expect(run.error.length).toBeLessThanOrEqual(300);
      expect(run.error).not.toContain("eyJhbGci");
      expect(run.error).toContain("[redacted token]");
    }
  });

  it("scopes failed-run reads to this company, this user and the last 24 hours", async () => {
    const ctx = context({});
    const now = new Date("2026-11-02T12:00:00Z");
    const spy = client(() => ({ data: [], error: null }));
    await loadFailedToolRuns({ ...ctx, serviceClient: spy.client } as unknown as ToolExecutionContext, now);
    const calls = spy.log[0].calls;
    expect(calls).toContainEqual(["eq", ["tenant_id", CLIENT_TENANT]]);
    expect(calls).toContainEqual(["eq", ["user_id", "user-jon"]]);
    expect(calls).toContainEqual(["eq", ["status", "failed"]]);
    expect(calls).toContainEqual(["gte", ["created_at", "2026-11-01T12:00:00.000Z"]]);
    expect(calls).toContainEqual(["limit", [10]]);
  });

  it("still files the report when recent failures cannot be read, marking them unknown", async () => {
    const { rpc, calls } = fakeRpc();
    const result = await reportSupportProblem({ what_happened: "The dashboard will not load." }, context({ failedRuns: { data: null, error: { message: "permission denied" } } }), rpc);
    expect(result.success).toBe(true);
    const diagnostics = ((calls.find((c) => c.fn === "create_ticket")!.args.ticket as Record<string, unknown>).context as Record<string, Record<string, unknown>>).diagnostics;
    expect(diagnostics.failed_tool_runs_status).toBe("unknown");
    expect(diagnostics.failed_tool_runs).toEqual([]);
  });

  it("explains plainly when the support desk refuses the company", async () => {
    const { rpc, calls } = fakeRpc({ account_for_crm_tenant: new SupportRpcError("42501", "forbidden: account") });
    const result = await reportSupportProblem({ what_happened: "Something is wrong with my customers." }, context({}), rpc);
    expect(result.success).toBe(false);
    expect(result.error).toBe("support_unavailable");
    expect(result.message).not.toMatch(/42501|forbidden/);
    expect(calls.some((c) => c.fn === "create_ticket")).toBe(false);
  });
});

describe("confirmation", () => {
  it("is required before a report is filed", () => {
    expect(getRegisteredTool("report_support_problem")).toMatchObject({ category: "mutation", requires_confirmation: true, allowed_roles: ["admin", "staff", "viewer"] });
    // The executor imports Deno-only modules, so its gate is checked at the source level.
    const executor = fs.readFileSync(path.join(process.cwd(), "supabase/functions/bloom-assist/tools/executor.ts"), "utf8");
    expect(executor).toContain("if (tool.requires_confirmation && context.approved !== true) {");
    expect(executor).toMatch(/report_support_problem: \(params\) => \{[\s\S]*?Send a problem report to the Bloom support team/);
    expect(executor).toMatch(/case "manage_consent":\n\s+case "report_support_problem":\n\s+return false;/);
    expect(executor).toContain("if (isSupportTool(toolName)) return false;");
  });

  it("refuses to file without approval even if called directly", async () => {
    const { rpc, calls } = fakeRpc();
    const result = await reportSupportProblem({ what_happened: "My segments page is empty today." }, context({ approved: false }), rpc);
    expect(result.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("keeps the read-only tools free of confirmation", () => {
    expect(getRegisteredTool("check_support_request")).toMatchObject({ category: "query", requires_confirmation: false, risk_level: "safe" });
    expect(getRegisteredTool("run_self_diagnostics")).toMatchObject({ category: "query", requires_confirmation: false, risk_level: "safe" });
  });
});

describe("run_self_diagnostics", () => {
  const now = new Date("2026-11-02T12:00:00Z");

  it("returns unknown, never a guess, when a query fails, errors or runs out of time", async () => {
    const data = client((table) => {
      if (table === "crm_customers") throw new Error("connection reset");
      if (table === "crm_segments") return { data: null, error: { message: "canceling statement due to statement timeout" } };
      if (table === "customer_segments") return new Promise<Response>(() => undefined);
      return { data: [], error: null, count: null };
    });
    const result = await runSelfDiagnostics({ area: "all" }, context({ dataClient: data.client }), { now, budgetMs: 30 });
    const checks = (result.data as { checks: Array<{ id: string; status: string; evidence: { count: number | null } }> }).checks;
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    for (const id of ["customer_count", "customers_with_purchase_data", "duplicate_built_in_segments", "segment_members_deleted_customers", "pos_sync_failures", "email_send_failures"]) {
      expect(byId[id].status).toBe("unknown");
      expect(byId[id].evidence.count).toBeNull();
    }
  });

  it("reports counts with evidence and keeps every query on this company", async () => {
    const data = client((table, calls) => {
      if (table === "crm_customers") return { data: null, error: null, count: calls.some(([m]) => m === "or") ? 0 : 1250 };
      if (table === "crm_segments") return { data: [{ name: "VIP" }, { name: "vip" }, { name: "Lapsed" }], error: null };
      if (table === "customer_segments") return { data: null, error: null, count: 3 };
      if (table === "customer_intelligence_imports") return { data: [{ status: "completed", completed_at: "2026-10-30T08:00:00Z", accepted_row_count: 900, rejected_row_count: 0 }], error: null, count: 2 };
      return { data: null, error: null, count: 0 };
    });
    const result = await runSelfDiagnostics({ area: "all" }, context({ dataClient: data.client }), { now });
    const checks = (result.data as { checks: Array<{ id: string; status: string; plain_message: string; evidence: { count: number | null; as_of: string } }> }).checks;
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId.customer_count).toMatchObject({ status: "ok", evidence: { count: 1250 } });
    expect(byId.customers_with_purchase_data).toMatchObject({ status: "warn", evidence: { count: 0 } });
    expect(byId.duplicate_built_in_segments).toMatchObject({ status: "warn", evidence: { count: 1 } });
    expect(byId.segment_members_deleted_customers).toMatchObject({ status: "warn", evidence: { count: 3 } });
    expect(byId.latest_customer_import).toMatchObject({ status: "ok", evidence: { count: 900, as_of: "2026-10-30T08:00:00Z" } });
    expect(byId.recent_bloom_failures.status).toBe("ok");
    for (const entry of data.log) {
      const scoped = entry.calls.some(([m, args]) => m === "eq" && String(args[0]).endsWith("tenant_id") && args[1] === CLIENT_TENANT);
      expect(scoped, entry.table).toBe(true);
      expect(entry.calls.some(([m]) => m === "abortSignal"), entry.table).toBe(true);
    }
    for (const c of checks) expect(c.plain_message).not.toMatch(/—/);
  });

  it("sees POS and email failures for the client company an admin is working in, including partly failed email batches", async () => {
    const serviceLog: Array<{ table: string; calls: Array<[string, unknown[]]> }> = [];
    const serviceTables = (table: string) =>
      table === "pos_sync_jobs" || table === "email_send_jobs" ? { data: null, error: null, count: 2 } : undefined;
    const result = await runSelfDiagnostics({ area: "all" }, context({ dataClient: client(() => ({ data: null, error: null, count: 0 })).client, serviceTables, serviceLog }), { now });
    const byId = Object.fromEntries((result.data as { checks: Array<{ id: string; status: string; evidence: { count: number | null } }> }).checks.map((c) => [c.id, c]));
    expect(byId.pos_sync_failures).toMatchObject({ status: "warn", evidence: { count: 2 } });
    expect(byId.email_send_failures).toMatchObject({ status: "warn", evidence: { count: 2 } });
    const email = serviceLog.find((e) => e.table === "email_send_jobs");
    expect(email?.calls).toContainEqual(["or", ["status.eq.failed,emails_failed.gt.0"]]);
    for (const table of ["pos_sync_jobs", "email_send_jobs"]) {
      const entry = serviceLog.find((e) => e.table === table);
      expect(entry?.calls).toContainEqual(["eq", ["tenant_id", CLIENT_TENANT]]);
    }
  });

  it("only runs the checks for the requested area", async () => {
    const data = client(() => ({ data: null, error: null, count: 0 }));
    const result = await runSelfDiagnostics({ area: "pos_sync" }, context({ dataClient: data.client }), { now });
    expect((result.data as { checks: Array<{ id: string }> }).checks.map((c) => c.id)).toEqual(["pos_sync_failures"]);
  });
});

describe("check_support_request", () => {
  it("looks up one request by number inside the company's account with plain status labels", async () => {
    const { rpc, calls } = fakeRpc({
      whoami: { role: "client" },
      list_tickets: [{ id: "ticket-9", number: 1042 }],
      get_ticket: { number: 1042, subject: "Segments doubled", status: "needs_owner", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-02T00:00:00Z", messages: [{ visibility: "public", author_kind: "staff", body: "We are looking into it." }] },
    });
    const result = await checkSupportRequest({ ticket_number: 1042 }, context({ tenantId: OWN_TENANT }), rpc);
    expect(calls.find((c) => c.fn === "list_tickets")!.args).toMatchObject({ filters: { account_id: "account-client", q: "1042" } });
    expect(result.data).toMatchObject({ request_number: 1042, status: "Needs Jon/Jeff", latest_reply_from_support: "We are looking into it." });
  });
});

describe("client context", () => {
  it("keeps only bounded route, browser and screen size", () => {
    expect(parseClientContext({ route: "/crm/segments?token=abc", user_agent: "U".repeat(500), viewport: "1280x800", extra: "x" }))
      .toEqual({ route: "/crm/segments", user_agent: "U".repeat(300), viewport: "1280x800" });
    expect(parseClientContext({ viewport: "huge" })).toBeNull();
    expect(parseClientContext("nope")).toBeNull();
  });

  it("is read back for the staff desk", () => {
    const d = readBloomDiagnostics({ diagnostics: { account_name: "West Coast Gardens", filed_by_staff: true, admin_workspace: true, route: "/crm", failed_tool_runs_status: "ok", failed_tool_runs: [{ tool: "query_customers", at: "2026-11-02T10:00:00Z", error: "timed out" }] } });
    expect(d).toMatchObject({ company: "West Coast Gardens", filedByStaff: true, adminWorkspace: true, failedRuns: [{ tool: "query_customers", error: "timed out" }] });
    expect(readBloomDiagnostics({ route: "/crm" })).toBeNull();
  });
});

describe("cleanErrorText", () => {
  it("redacts before cutting to 300 characters", () => {
    const text = `${"a".repeat(290)} Bearer abcdefghijklmnop ${JWT}`;
    const out = cleanErrorText(text)!;
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out).not.toContain("abcdefghijklmnop");
    expect(cleanErrorText("   ")).toBeNull();
    expect(cleanErrorText(42)).toBeNull();
  });
});

describe("support bridge migration", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261102170000_bloom_assist_support_bridge.sql"), "utf8");
  const previous = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261101140000_bloom_support_audit_hardening.sql"), "utf8");
  const dispatcher = (text: string) => text.slice(text.indexOf("CREATE OR REPLACE FUNCTION public.bloom_support_rpc"), text.indexOf("GRANT EXECUTE ON FUNCTION public.bloom_support_rpc"));

  it("copies the latest dispatcher and adds only account_for_crm_tenant", () => {
    const added = "    WHEN 'account_for_crm_tenant' THEN r := bloom_support.account_for_crm_tenant(a, (p->>'tenant_id')::uuid, p->>'tenant_name');\n";
    expect(dispatcher(sql).replace(added, "")).toBe(dispatcher(previous));
  });

  it("only lets staff or verified members of that tenant reach the account", () => {
    expect(sql).toContain("staff := bloom_support.has_permission(p_actor, 'accounts.read_all')");
    expect(sql).toMatch(/m\.account_id = acct\.id AND m\.principal_id = p_actor AND m\.verified/);
    expect(sql).toContain("RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION bloom_support.account_for_crm_tenant(uuid, uuid, text) FROM PUBLIC, anon, authenticated");
  });
});
