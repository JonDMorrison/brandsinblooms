import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import {
  bloomSupport,
  captureClientContext,
  parsePublicSupportIntake,
  parseSignedSupportIntake,
  parseSupportMessageResult,
  readBloomDiagnostics,
  safeClientPageUrl,
} from "@/lib/bloomSupport/api";
import {
  checkAttachments,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
  safeSupportTrackingUrl,
} from "@/lib/bloomSupport/constants";
import { asSentence, humanizeStaffNote, triageNoteText } from "../../supabase/functions/_shared/bloom-support/notes";
import {
  decodeBase64File,
  validateAttachmentFile,
  validateAttachmentName,
} from "../../supabase/functions/_shared/bloom-support/attachments";
import {
  approvedVerificationUrl,
  deploy as deployEngineeringRelease,
  evaluate as evaluateEngineeringRelease,
  type EngineeringIssue,
  verify as verifyEngineeringRelease,
  verificationChecksForPolicy,
} from "../../supabase/functions/_shared/bloom-support/engineering";
import { actions as supportActions } from "../../supabase/functions/_shared/bloom-support/service";

const releaseMocks = vi.hoisted(() => ({
  commitContains: vi.fn(),
  env: vi.fn(),
  productionCommitForRepair: vi.fn(),
  productionDeployment: vi.fn(),
  pullRequestFacts: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/bloom-support/runtime.ts", () => {
  class BloomError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  }
  return {
    BloomError,
    db: vi.fn(),
    directRpc: vi.fn(),
    env: (...args: unknown[]) => releaseMocks.env(...args),
    readResponseText: async (response: globalThis.Response, limit: number) => {
      const reader = response.body?.getReader();
      if (!reader) return "";
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) {
          await reader.cancel();
          throw new BloomError(413, "too_large", "Response too large");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new TextDecoder().decode(bytes);
    },
    rpc: (...args: unknown[]) => releaseMocks.rpc(...args),
    str: (value: unknown, max = 20_000) => {
      if (value === undefined || value === null) return undefined;
      const text = String(value).trim();
      return text ? text.slice(0, max) : undefined;
    },
    uuid: (value: unknown) => String(value),
  };
});

vi.mock("../../supabase/functions/_shared/bloom-support/github.ts", () => ({
  commitContains: releaseMocks.commitContains,
  GitHubError: class GitHubError extends Error {},
  findPullRequestForBranch: vi.fn(),
  gh: vi.fn(),
  mergePullRequest: vi.fn(),
  productionCommitForRepair: releaseMocks.productionCommitForRepair,
  productionDeployment: releaseMocks.productionDeployment,
  pullRequestFacts: releaseMocks.pullRequestFacts,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

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
    const firstTicket = first.calls.find((c) => c.fn === "create_ticket")!.args.ticket as Record<string, unknown>;
    expect(firstTicket.dedupe_key).toBe(`${CONVERSATION}:${MESSAGE}`);
    expect(firstTicket.intake_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    // Created paused, so no triage job is ever queued (no race with the worker).
    expect((first.calls.find((c) => c.fn === "create_ticket")!.args.ticket as Record<string, unknown>).automation).toBe("paused");
    expect(first.calls.find((c) => c.fn === "set_automation")!.args).toMatchObject({ actor: "principal-bot", ticket_id: "ticket-1", mode: "paused" });
    expect(first.calls.find((c) => c.fn === "update_ticket")!.args).toMatchObject({ actor: "principal-bot", patch: { tags: ["bloom-chat"], internal_only: true } });
    const order = first.calls.map((c) => c.fn);
    expect(order.indexOf("set_automation")).toBeGreaterThan(order.indexOf("create_ticket"));
    expect(order.indexOf("update_ticket")).toBeGreaterThan(order.indexOf("set_automation"));

    const retry = fakeRpc({ create_ticket: { ticket_id: "ticket-1", number: 1042, duplicate_delivery: true } });
    const again = await reportSupportProblem({ what_happened: "Email sending stopped this morning." }, context({}), retry.rpc);
    expect(again.success).toBe(true);
    expect(retry.calls.some((c) => c.fn === "set_automation" || c.fn === "update_ticket")).toBe(false);

    const changed = fakeRpc();
    await reportSupportProblem({ what_happened: "Email sending stopped for a different reason." }, context({}), changed.rpc);
    const changedTicket = changed.calls.find((c) => c.fn === "create_ticket")!.args.ticket as Record<string, unknown>;
    expect(changedTicket.dedupe_key).toBe(firstTicket.dedupe_key);
    expect(changedTicket.intake_fingerprint).not.toBe(firstTicket.intake_fingerprint);
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

  it("strips URL credentials and only accepts canonical Bloom tracking links", () => {
    const original = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, "", "/reset-password?token_hash=secret#access_token=also-secret");
    try {
      const captured = captureClientContext();
      expect(safeClientPageUrl()).toBe(`${window.location.origin}/reset-password`);
      expect(captured).toMatchObject({ page_url: `${window.location.origin}/reset-password`, route: "/reset-password" });
      expect(JSON.stringify(captured)).not.toContain("secret");
    } finally {
      window.history.replaceState({}, "", original);
    }

    const token = "0123456789abcdef0123456789ABCDEF";
    expect(safeSupportTrackingUrl("javascript:alert(1)")).toBeNull();
    expect(safeSupportTrackingUrl(`https://attacker.example/support/track/${token}`)).toBeNull();
    expect(safeSupportTrackingUrl(`https://bloomsuite.app:8443/support/track/${token}`)).toBeNull();
    expect(safeSupportTrackingUrl(`https://bloomsuite.app/support/track/${token}?code=secret#fragment`))
      .toBe(`https://bloomsuite.app/support/track/${token}`);
  });
});

describe("Bloom Support intake and attachment contracts", () => {
  const encode = (text: string) => new TextEncoder().encode(text);
  const ticketId = "11111111-1111-4111-8111-111111111111";
  const browserFile = (name: string, size: number, type = "image/png") => ({ name, size, type }) as File;

  it("enforces 8 MB per file and 12 MB total before browser upload", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(8 * 1024 * 1024);
    expect(MAX_ATTACHMENT_TOTAL_BYTES).toBe(12 * 1024 * 1024);
    expect(checkAttachments([browserFile("large.png", MAX_ATTACHMENT_BYTES + 1)]))
      .toMatchObject({ accepted: [], rejected: [expect.stringContaining("8 MB or smaller")] });
    expect(checkAttachments([
      browserFile("first.png", 7 * 1024 * 1024),
      browserFile("second.png", 6 * 1024 * 1024),
    ])).toMatchObject({
      accepted: [expect.objectContaining({ name: "first.png" })],
      rejected: [expect.stringContaining("12 MB or less")],
    });
  });

  it("rejects an oversized reply attachment before reading or uploading it", async () => {
    const arrayBuffer = vi.fn();
    const oversized = {
      name: "huge.pdf", type: "application/pdf", size: MAX_ATTACHMENT_BYTES + 1,
      lastModified: 1, arrayBuffer,
    } as unknown as File;
    await expect(bloomSupport.uploadAttachment(ticketId, oversized)).rejects.toMatchObject({
      code: "invalid_attachment", status: 400,
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("validates extension, signature, text safety and filename boundaries", () => {
    expect(() => validateAttachmentFile({ name: "invoice.exe", type: "application/pdf", bytes: encode("%PDF-1.7\n%%EOF") }))
      .toThrow("extension does not match");
    expect(() => validateAttachmentFile({ name: "screenshot.png", type: "image/png", bytes: encode("<script>alert(1)</script>") }))
      .toThrow("contents do not match");
    expect(() => validateAttachmentFile({ name: "notes.txt", type: "text/plain", bytes: new Uint8Array([0x61, 0x00, 0x62]) }))
      .toThrow("contents do not match");
    expect(validateAttachmentFile({ name: "browser.log", type: "text/plain", bytes: encode("Save failed with status 503") }))
      .toBe("text/plain");
    expect(() => validateAttachmentName("../private.txt")).toThrow("cannot contain paths");
    expect(() => validateAttachmentName("bad\nname.txt")).toThrow("control characters");
    expect(new TextDecoder().decode(decodeBase64File("bm90ZXM="))).toBe("notes");
    expect(() => decodeBase64File("not base64!")).toThrow("valid base64");
  });

  it("rejects malformed 2xx intake receipts and strips unsafe tracking URLs", () => {
    const receipt = {
      received: true,
      duplicate_delivery: false,
      ticket_id: ticketId,
      number: 42,
      tracking_url: "javascript:alert(1)",
      attachments: { stored: 1, failed: [] },
    };
    expect(parseSignedSupportIntake(receipt)).toEqual({
      received: true,
      duplicate_delivery: false,
      ticket_id: ticketId,
      number: 42,
      attachments: { stored: 1, failed: [] },
    });
    expect(() => parseSignedSupportIntake({ ...receipt, attachments: undefined })).toThrow("did not confirm");
    expect(() => parseSignedSupportIntake({ ...receipt, received: false })).toThrow("did not confirm");
    expect(() => parsePublicSupportIntake({ received: true, duplicate_delivery: false, number: 42, email_delivery: "sent" }))
      .toThrow("did not confirm");
    expect(parsePublicSupportIntake({ received: true, duplicate_delivery: false, number: 42, email_delivery: "pending" }))
      .toMatchObject({ number: 42, email_delivery: "pending" });
    expect(parseSupportMessageResult({ message_id: ticketId, duplicate: false }))
      .toEqual({ message_id: ticketId, duplicate: false });
    expect(() => parseSupportMessageResult({ ok: true })).toThrow("did not confirm your reply");
  });

  it("computes generic API idempotency fingerprints from normalized stored content", async () => {
    releaseMocks.rpc.mockResolvedValue({ ticket_id: ticketId, number: 42, duplicate_delivery: false });
    const caller = { principalId: "staff-principal", role: "support", via: "crm_session" as const, scopes: [] };
    const base = {
      subject: "Checkout issue",
      body: "The checkout button does not respond.",
      product: "crm",
      idempotency_key: "generic-api-key",
      intake_fingerprint: "a".repeat(64),
    };
    await supportActions.createTicket(caller, base);
    await supportActions.createTicket(caller, base);
    await supportActions.createTicket(caller, {
      ...base,
      body: "The edited request must not alias the first ticket.",
      intake_fingerprint: "a".repeat(64),
    });
    const tickets = releaseMocks.rpc.mock.calls.map(([, args]) =>
      (args as { ticket: Record<string, unknown> }).ticket
    );
    expect(tickets[0].intake_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(tickets[1].intake_fingerprint).toBe(tickets[0].intake_fingerprint);
    expect(tickets[2].intake_fingerprint).not.toBe(tickets[0].intake_fingerprint);
    expect(tickets[0].intake_fingerprint).not.toBe("a".repeat(64));
  });
});

describe("Bloom Support staff note wording", () => {
  it("writes triage as a plain sentence, with what is missing and any duplicate", () => {
    expect(triageNoteText({ kind: "bug", priority: "high", category: "fundraising", missing: [] }))
      .toBe("Bloom read this as a bug, high priority, about fundraising.");
    expect(triageNoteText({ kind: "unknown", priority: "normal", category: "general", missing: ["which product (website, CRM or POS)"], duplicateOf: 12 }))
      .toBe("Bloom couldn't tell what kind of request this is yet, normal priority. Still needs from the client: which product (website, CRM or POS). Looks like the same issue as #12.");
  });

  it("rewrites older machine-style triage notes and leaves other notes alone", () => {
    expect(humanizeStaffNote("Triage (model): bug, high, fundraising")).toBe("Bloom read this as a bug, high priority, about fundraising.");
    expect(humanizeStaffNote("Triage (rules): change, normal, website; missing: what page; which logo; likely same issue as #7"))
      .toBe("Bloom read this as a change request, normal priority, about website. Still needs from the client: what page; which logo. Looks like the same issue as #7.");
    expect(humanizeStaffNote("Triage limit reached for today; a person should look at this ticket.")).toBe("Triage limit reached for today; a person should look at this ticket.");
  });

  it("never doubles the full stop", () => {
    expect(asSentence("it won't let me save.")).toBe("it won't let me save.");
    expect(asSentence("Reported, not started yet")).toBe("Reported, not started yet.");
    expect(asSentence("Is it live?")).toBe("Is it live?");
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

describe("create_ticket paused-on-create migration", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261102190000_bloom_support_create_ticket_paused.sql"), "utf8");
  it("only accepts lowering automation and skips the triage job when paused", () => {
    expect(sql).toContain("IN (''paused'', ''human'')");
    expect(sql).toContain("IF v_automation IS NULL THEN");
    expect(sql).toContain("RAISE EXCEPTION 'create_ticket anchors not found");
  });
});

describe("Bloom repair outcome reporting", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github/workflows/bloom-repair.yml"),
    "utf8",
  );
  const reportJob = workflow.slice(workflow.indexOf("\n  report:"));

  it("fails visibly after bounded HTTPS retries without logging response data", () => {
    expect(reportJob).toContain("BLOOM_SUPPORT_API_URL is not configured");
    expect(reportJob).toContain("BLOOM_REPAIR_REPORT_KEY is not configured");
    expect(reportJob).toContain("--retry 3");
    expect(reportJob).toContain("--retry-max-time 90");
    expect(reportJob).toContain("--retry-all-errors");
    expect(reportJob).toContain("BLOOM_SUPPORT_API_URL must use https://");
    expect(reportJob).toContain("--proto '=https' --tlsv1.2");
    expect(reportJob).toContain("umask 077");
    expect(reportJob).toContain("--silent --show-error --output /dev/null");
    expect(reportJob).not.toContain('|| echo "Bloom report failed"');
  });
});

describe("Bloom engineering release recovery", () => {
  const releaseCaller = {
    principalId: "release-service",
    role: "service",
    via: "service" as const,
    scopes: [],
  };
  const repository = "JonDMorrison/brandsinblooms";
  const cmsRepository = "Brands-In-Blooms/cms-brandsinblooms";
  const policy = {
    vercel: {
      [repository]: { projectId: "prj_test" },
      [cmsRepository]: { projectId: "prj_cms" },
    },
    verificationOrigins: {
      [repository]: ["https://bloomsuite.app"],
      [cmsRepository]: ["https://winderberry.bloomsites.app"],
    },
    verificationChecks: {
      [repository]: [{ url: "https://bloomsuite.app/health", contains: "healthy" }],
      [cmsRepository]: [{ url: "https://winderberry.bloomsites.app/api/health", contains: "ok" }],
    },
  };

  const baseIssue = (): EngineeringIssue => ({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Broken support flow",
    product: "crm",
    repository,
    status: "approved",
    version: 1,
    evidence: {},
    reproduction: { reproduced: true },
    branch: "bloom/fix-11111111",
    pr_number: 4243,
    pr_url: `https://github.com/${repository}/pull/4243`,
    head_sha: "reviewed-head",
    merge_sha: null,
    deployment: null,
    verification: null,
    eligibility: null,
    attempts: 1,
    approved_head_sha: "reviewed-head",
    tickets: [],
  });

  function wireIssue(initial: EngineeringIssue, releasePolicy: Record<string, unknown> = policy) {
    let issue = structuredClone(initial);
    releaseMocks.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "list_engineering") return [structuredClone(issue)];
      if (fn === "setting") return args.key === "release_policy" ? releasePolicy : null;
      if (fn === "update_engineering_issue") {
        const update = args.update as { status?: string; patch?: Record<string, unknown> };
        issue = {
          ...issue,
          ...(update.patch ?? {}),
          ...(update.status ? { status: update.status } : {}),
          version: issue.version + 1,
        } as EngineeringIssue;
        return structuredClone(issue);
      }
      throw new Error(`unexpected rpc ${fn}`);
    });
    return () => issue;
  }

  const rollbackIssue = (polls = 0): EngineeringIssue => ({
    ...baseIssue(),
    status: "verifying",
    merge_sha: "bad-production-sha",
    verification: {
      passed: false,
      scope: "release_smoke",
      checks: [{ url: "https://bloomsuite.app/health", pass: false }],
    },
    rollback: {
      previous_deployment_id: "dpl_previous",
      previous_url: "previous.vercel.test",
      provider: "vercel",
      status: "requested",
      requested_at: new Date(Date.now() - 1_000).toISOString(),
      polls,
    },
  });

  const productionAlias = (deployment: {
    uid: string;
    url: string;
    meta: Record<string, unknown>;
  }) => ({
    target: "PRODUCTION",
    deployment: { ...deployment, readyState: "READY" },
  });

  beforeEach(() => {
    releaseMocks.commitContains.mockReset().mockResolvedValue(false);
    releaseMocks.env.mockReset().mockImplementation((key: string) =>
      key === "BLOOM_VERCEL_TOKEN" || key.includes("GITHUB") ? "test-value" : undefined
    );
    releaseMocks.productionCommitForRepair.mockReset();
    releaseMocks.productionDeployment.mockReset();
    releaseMocks.pullRequestFacts.mockReset();
    releaseMocks.rpc.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps verification targets on the approved production origin", () => {
    expect(approvedVerificationUrl(policy, repository, "https://attacker.example/health")).toBeNull();
    expect(approvedVerificationUrl(policy, repository, "https://user:secret@bloomsuite.app/health")).toBeNull();
    expect(approvedVerificationUrl(policy, repository, "https://bloomsuite.app/health?token=secret")).toBeNull();
    expect(verificationChecksForPolicy({
      ...policy,
      verificationChecks: { [repository]: Array.from({ length: 11 }, () => ({ url: "https://bloomsuite.app/health" })) },
    }, repository)).toBeNull();
  });

  it("blocks verifier redirects and bounds streamed response evidence", async () => {
    const redirectIssue = {
      ...baseIssue(),
      status: "verifying",
      merge_sha: "merge-sha",
    };
    const redirectCurrent = wireIssue(redirectIssue);
    const redirectFetch = vi.fn().mockRejectedValue(new TypeError("redirect blocked"));
    vi.stubGlobal("fetch", redirectFetch);
    await expect(verifyEngineeringRelease(releaseCaller, redirectIssue.id)).resolves.toEqual({ note: "verification failed" });
    expect(redirectFetch).toHaveBeenCalledWith(
      "https://bloomsuite.app/health",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(redirectCurrent()).toMatchObject({ status: "failed", verification: { passed: false } });

    vi.unstubAllGlobals();
    const oversizedIssue = { ...redirectIssue, id: "22222222-2222-4222-8222-222222222222" };
    const oversizedCurrent = wireIssue(oversizedIssue);
    let cancelled = false;
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(700_000));
        controller.enqueue(new Uint8Array(700_000));
      },
      cancel() { cancelled = true; },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(responseBody)));
    await verifyEngineeringRelease(releaseCaller, oversizedIssue.id);
    expect(cancelled).toBe(true);
    expect(oversizedCurrent()).toMatchObject({ status: "failed", verification: { passed: false } });
  });

  it("persists a manually merged pull request before deployment recovery", async () => {
    const current = wireIssue(baseIssue(), {});
    releaseMocks.pullRequestFacts.mockResolvedValue({
      pr: {
        merged: true,
        merge_commit_sha: "manual-merge-sha",
        state: "closed",
        head: { ref: "bloom/fix-11111111", sha: "reviewed-head" },
      },
      facts: {},
    });
    await expect(evaluateEngineeringRelease(releaseCaller, baseIssue().id)).resolves.toMatchObject({
      next: { step: "deploy" },
    });
    expect(current()).toMatchObject({ status: "deploying", merge_sha: "manual-merge-sha" });
  });

  it("waits for GitHub's merge commit instead of inventing release evidence", async () => {
    const current = wireIssue(baseIssue(), {});
    releaseMocks.pullRequestFacts.mockResolvedValue({
      pr: {
        merged: true,
        merge_commit_sha: null,
        state: "closed",
        head: { ref: "bloom/fix-11111111", sha: "reviewed-head" },
      },
      facts: {},
    });
    await expect(evaluateEngineeringRelease(releaseCaller, baseIssue().id)).resolves.toEqual({
      next: { step: "evaluate", delaySeconds: 60 },
      note: "merged; waiting for GitHub merge commit",
    });
    expect(current()).toMatchObject({ status: "approved", merge_sha: null });
  });

  it("never auto-merges a delayed repair report that requires human review", async () => {
    const issue = {
      ...baseIssue(),
      status: "approved",
      approved_head_sha: null,
      reproduction: {
        reproduced: true,
        intended_behaviour_established: true,
        needs_human: true,
      },
    };
    const current = wireIssue(issue);
    releaseMocks.pullRequestFacts.mockResolvedValue({
      pr: {
        merged: false,
        state: "open",
        merge_commit_sha: null,
        head: { ref: "bloom/fix-11111111", sha: "reviewed-head" },
      },
      facts: { checks: [], files: [] },
    });

    await expect(evaluateEngineeringRelease(releaseCaller, issue.id)).resolves.toEqual({
      note: "awaiting approval: repair report requires human review",
    });
    expect(current()).toMatchObject({
      status: "awaiting_approval",
      eligibility: { eligible: false, reasons: ["repair report requires human review"] },
    });
  });

  it("observes a dev promotion and skips every rollback deployment that already contains the repair", async () => {
    const issue = {
      ...baseIssue(),
      product: "cms" as const,
      repository: cmsRepository,
      status: "deploying",
      merge_sha: "dev-merge-sha",
    };
    const current = wireIssue(issue);
    releaseMocks.productionCommitForRepair.mockResolvedValue("main-production-sha");
    releaseMocks.productionDeployment.mockResolvedValue({
      state: "success",
      environment: "Production – cms-brandsinblooms-latest",
      url: "https://winderberry.bloomsites.app",
      deployment_id: 7552913436,
    });
    releaseMocks.commitContains.mockImplementation(
      async (_repository: string, marker: string, candidate: string) =>
        marker === "dev-merge-sha" && candidate === "promotion-production-sha",
    );
    const promoted = {
      uid: "dpl_contains_repair",
      url: "promotion.example.test",
      meta: { githubCommitSha: "promotion-production-sha" },
    };
    const previous = {
      uid: "dpl_safe_previous",
      url: "previous.example.test",
      meta: { githubCommitSha: "previous-production-sha" },
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/v9/projects/prj_cms") {
        return Response.json({ alias: [productionAlias(promoted)] });
      }
      if (url.pathname === "/v6/deployments") {
        return Response.json({ deployments: [promoted, previous] });
      }
      throw new Error(`unexpected request ${url}`);
    }));

    await expect(deployEngineeringRelease(releaseCaller, issue.id)).resolves.toMatchObject({ next: { step: "verify" } });
    expect(releaseMocks.productionCommitForRepair).toHaveBeenCalledWith(cmsRepository, "dev-merge-sha", "dev");
    expect(current()).toMatchObject({
      status: "verifying",
      deployment: { production_sha: "main-production-sha", promoted_from: "dev" },
      rollback: { previous_deployment_id: "dpl_safe_previous" },
    });
  });

  it("only observes a person-authorised dev-to-main release; it never promotes dev itself", async () => {
    const issue = {
      ...baseIssue(),
      product: "cms" as const,
      repository: cmsRepository,
      status: "deploying",
      merge_sha: "dev-merge-sha",
    };
    const current = wireIssue(issue);
    releaseMocks.productionCommitForRepair.mockResolvedValue(null);
    await expect(deployEngineeringRelease(releaseCaller, issue.id)).resolves.toMatchObject({
      next: { step: "deploy", delaySeconds: 3600 },
      note: "awaiting person-authorised production release",
    });
    expect(releaseMocks.productionDeployment).not.toHaveBeenCalled();
    expect(current().deployment).toMatchObject({
      state: "awaiting_production_release",
      source_merge_sha: "dev-merge-sha",
    });
  });

  it("uses the deployment actually serving production, not newer failed READY history", async () => {
    const issue = {
      ...baseIssue(),
      status: "deploying",
      merge_sha: "bloom-merge-c",
      rollback: {
        previous_deployment_id: "dpl_old_a",
        previous_url: "old-a.example.test",
        previous_commit_sha: "old-a",
        provider: "vercel",
      },
    };
    const current = wireIssue(issue);
    releaseMocks.productionDeployment.mockResolvedValue({
      state: "success",
      environment: "Production – bloomsuite-crm",
      url: "https://bloomsuite.app",
      deployment_id: 7552913437,
    });
    const failedHistory = {
      uid: "dpl_failed_c",
      url: "failed-c.example.test",
      meta: { githubCommitSha: "failed-release-c" },
    };
    const serving = {
      uid: "dpl_intervening_b",
      url: "good-b.example.test",
      meta: { githubCommitSha: "good-release-b" },
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/v9/projects/prj_test") {
        return Response.json({ alias: [productionAlias(serving)] });
      }
      if (url.pathname === "/v6/deployments") {
        return Response.json({ deployments: [failedHistory, serving] });
      }
      throw new Error(`unexpected request ${url}`);
    }));

    await expect(deployEngineeringRelease(releaseCaller, issue.id)).resolves.toMatchObject({ next: { step: "verify" } });
    expect(current()).toMatchObject({
      status: "verifying",
      rollback: {
        previous_deployment_id: "dpl_intervening_b",
        previous_commit_sha: "good-release-b",
      },
    });
  });

  it("records Vercel's 201 rollback response as requested, not restored", async () => {
    const issue = { ...rollbackIssue(), rollback: { ...rollbackIssue().rollback, status: undefined } };
    const current = wireIssue(issue);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "bloomsuite.app") return new Response("still broken", { status: 200 });
      if (url.pathname.includes("/rollback/")) return new Response(null, { status: 201 });
      throw new Error(`unexpected request ${url}`);
    }));

    await expect(verifyEngineeringRelease(releaseCaller, issue.id)).resolves.toMatchObject({
      next: { step: "verify", delaySeconds: 30 },
    });
    expect(current()).toMatchObject({ status: "verifying", rollback: { status: "requested", polls: 0 } });
    expect(current().rollback).not.toHaveProperty("rolled_back_at");
  });

  it("keeps an accepted rollback pending while Vercel remaps aliases", async () => {
    const issue = rollbackIssue();
    const current = wireIssue(issue);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      lastAliasRequest: {
        type: "rollback",
        jobStatus: "in-progress",
        requestedAt: Date.now(),
        toDeploymentId: "dpl_previous",
      },
    })));

    await expect(verifyEngineeringRelease(releaseCaller, issue.id)).resolves.toMatchObject({
      next: { step: "verify", delaySeconds: 30 },
    });
    expect(current()).toMatchObject({ status: "verifying", rollback: { status: "requested", polls: 1 } });
  });

  it("fails safely on a wrong alias target or bounded confirmation timeout", async () => {
    const wrongAlias = rollbackIssue();
    const wrongCurrent = wireIssue(wrongAlias);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({
        lastAliasRequest: { type: "rollback", jobStatus: "succeeded", requestedAt: Date.now(), toDeploymentId: "dpl_previous" },
      }))
      .mockResolvedValueOnce(Response.json({
        aliases: [{ alias: { alias: "bloomsuite.app", deploymentId: "dpl_wrong" }, status: "failed" }],
        pagination: { next: null },
      })));
    await expect(verifyEngineeringRelease(releaseCaller, wrongAlias.id)).resolves.toEqual({ note: "rollback confirmation failed" });
    expect(wrongCurrent()).toMatchObject({ status: "failed", rollback: { status: "confirmation_failed" } });

    vi.unstubAllGlobals();
    const timedOut = rollbackIssue(20);
    const timeoutCurrent = wireIssue(timedOut);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      lastAliasRequest: { type: "rollback", jobStatus: "pending", requestedAt: Date.now(), toDeploymentId: "dpl_previous" },
    })));
    await expect(verifyEngineeringRelease(releaseCaller, timedOut.id)).resolves.toEqual({ note: "rollback confirmation failed" });
    expect(timeoutCurrent()).toMatchObject({ status: "failed", rollback: { status: "confirmation_failed", polls: 21 } });
  });

  it("reports rollback only after nested alias mappings and recovery smoke are confirmed", async () => {
    const issue = rollbackIssue();
    const current = wireIssue(issue);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/v9/projects/prj_test") {
        return Response.json({
          lastAliasRequest: { type: "rollback", jobStatus: "succeeded", requestedAt: Date.now(), toDeploymentId: "dpl_previous" },
        });
      }
      if (url.pathname.endsWith("/rollback/aliases")) {
        return Response.json({
          aliases: [{ alias: { alias: "bloomsuite.app", deploymentId: "dpl_previous" }, status: "completed" }],
          pagination: { next: null },
        });
      }
      if (url.hostname === "bloomsuite.app") return new Response("healthy", { status: 200 });
      throw new Error(`unexpected request ${url}`);
    }));

    await expect(verifyEngineeringRelease(releaseCaller, issue.id)).resolves.toEqual({
      note: "verification failed; rollback confirmed",
    });
    expect(current()).toMatchObject({
      status: "rolled_back",
      rollback: { status: "confirmed", aliases_confirmed: 1, recovery_verification: { passed: true, scope: "release_smoke" } },
    });
  });
});
