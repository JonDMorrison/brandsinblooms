/**
 * Bloom across the suite: lets the in-app assistant read BloomSites and point
 * of sale data for the company the person is working in.
 *
 * It does not add a second path to those products. Every read goes through the
 * Bloom Support operations layer (`runRead` in _shared/bloom-support/operations.ts),
 * which:
 *   - checks the person's own Support permission in the database. Staff use
 *     ops.site.read / ops.pos.read. Clients (decision 2026-11-04) use the
 *     database check public.bloom_support_client_suite_read: website, products
 *     and stock for every CRM user of their own company; sales summary and
 *     price history only for that company's CRM owner/admin users. The model
 *     cannot grant or widen either;
 *   - only reaches the BloomSites site or POS business linked to this
 *     company's Support account;
 *   - signs the call to the product and records it in the Support audit log.
 *
 * Read-only. Changes to sites, events or the POS go through the Support desk's
 * preview, then confirm, then verify flow, never through chat.
 */
import type { JsonObject } from "../../types.ts";
import type { ToolExecutionContext, ToolName, ToolResult } from "../types.ts";
import { resolveSupportIdentity, SupportRpcError, supportRpcFor, type SupportIdentity, type SupportRpc } from "./support-tools.ts";
import { findDiagnosticAccount, type DiagnosticAccount } from "../../../_shared/bloom-support/integration-diagnostics.ts";

export const SUITE_READ_KINDS = [
  "site.read",
  "site.pages",
  "event.list",
  "pos.products",
  "pos.inventory",
  "pos.sales_summary",
  "pos.price_history",
  "site.preview_link",
] as const;
export type SuiteReadKind = (typeof SUITE_READ_KINDS)[number];

export const SUITE_TOOL_NAMES = ["read_suite_data", "verify_bloomsites_integrations"] as const satisfies readonly ToolName[];
const SUITE_TOOL_SET = new Set<string>(SUITE_TOOL_NAMES);

const KIND_LABEL: Record<SuiteReadKind, string> = {
  "site.read": "website details",
  "site.pages": "website pages",
  "event.list": "website events",
  "pos.products": "point of sale products",
  "pos.inventory": "point of sale stock levels",
  "pos.sales_summary": "point of sale sales summary",
  "pos.price_history": "point of sale price history",
  "site.preview_link": "website page preview link",
};

/** Only these input fields are forwarded. Everything else the model sends is dropped. */
const ALLOWED_INPUTS: Record<SuiteReadKind, readonly string[]> = {
  "site.read": ["site_id"],
  "site.pages": ["site_id"],
  "event.list": ["site_id"],
  "pos.products": ["pos_tenant_id", "q"],
  "pos.inventory": ["pos_tenant_id", "store_id", "q"],
  "pos.sales_summary": ["pos_tenant_id", "store_id", "from", "to"],
  "pos.price_history": ["pos_tenant_id", "variant_id"],
  "site.preview_link": ["site_id", "content_id"],
};

export type RunRead = (
  caller: { principalId: string; role: string; via: "crm_session"; name: string | null; scopes: string[] },
  req: { kind: string; account_id: string; inputs: Record<string, unknown> },
) => Promise<unknown>;

export type SuiteDeps = {
  rpcFor: (context: ToolExecutionContext) => SupportRpc;
  identity: (context: ToolExecutionContext, rpc: SupportRpc) => Promise<SupportIdentity>;
  runRead: RunRead;
};

function toolResult(success: boolean, message: string, data: JsonObject | null = null, error: string | null = null): ToolResult {
  return {
    success,
    data,
    count: null,
    message,
    error,
    block_type: "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}

export function pickInputs(kind: SuiteReadKind, params: JsonObject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_INPUTS[kind]) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 200);
  }
  return out;
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

export const SALES_OWNER_ONLY_MESSAGE =
  "Only your account owner or an admin can see sales figures. Bloom can still show your website, products and stock levels.";

function errorStatus(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error && typeof (error as { status: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return null;
}

/** Plain words for the person. Never exposes upstream error text. */
export function explainReadFailure(kind: SuiteReadKind, error: unknown): string {
  const status = errorStatus(error);
  const message = error instanceof Error ? error.message : "";
  const what = KIND_LABEL[kind];
  if (error instanceof SupportRpcError && error.code === "42501") {
    return `Bloom could not connect your sign-in to this company's account, so it did not read the ${what}.`;
  }
  if (status === 403 && errorCode(error) === "owner_or_admin_only") return SALES_OWNER_ONLY_MESSAGE;
  if (status === 403) return `You don't have access to the ${what} through Bloom. An administrator can give access in Support settings.`;
  if (/no linked/i.test(message)) {
    return kind.startsWith("pos.")
      ? "This company's point of sale is not connected to Bloom yet, so there is nothing to read."
      : "This company's website is not connected to Bloom yet, so there is nothing to read.";
  }
  if (/several/i.test(message)) {
    return kind.startsWith("pos.")
      ? "This company has more than one point of sale business. Ask which one, then try again with its id."
      : "This company has more than one website. Ask which one, then try again with its id.";
  }
  if (/store/i.test(message) && kind.startsWith("pos.")) return "This business has several stores. Ask which store, then try again.";
  if (/not configured|missing/i.test(message)) return `Bloom's connection to read ${what} is not set up yet.`;
  return `Bloom could not read the ${what} right now. Nothing was changed.`;
}

export async function readSuiteData(params: JsonObject, context: ToolExecutionContext, deps: SuiteDeps): Promise<ToolResult> {
  const kind = params.kind;
  if (typeof kind !== "string" || !(SUITE_READ_KINDS as readonly string[]).includes(kind)) {
    return toolResult(false, "Pick one of the listed kinds of data.", null, "invalid_kind");
  }
  const k = kind as SuiteReadKind;
  try {
    const rpc = deps.rpcFor(context);
    const who = await deps.identity(context, rpc);
    const data = await deps.runRead(
      { principalId: who.principalId, role: who.role, via: "crm_session", name: context.userName ?? null, scopes: [] },
      { kind: k, account_id: who.account.id, inputs: pickInputs(k, params) },
    );
    return toolResult(
      true,
      `Read the ${KIND_LABEL[k]} for ${who.account.name ?? "this company"}. Answer from this data only. It is read-only: Bloom changed nothing.`,
      { product: k.startsWith("pos.") ? "pos" : "bloomsites", kind: k, result: (data ?? null) as JsonObject },
    );
  } catch (error) {
    console.error("[bloom-assist] suite read failed", k, error instanceof Error ? error.message : error);
    return toolResult(false, explainReadFailure(k, error), null, "suite_read_failed");
  }
}

async function defaultRunRead(...args: Parameters<RunRead>): Promise<unknown> {
  // Loaded lazily so tests and other tools never initialise the Support runtime.
  const ops = await import("../../../_shared/bloom-support/operations.ts");
  return await ops.runRead(args[0], args[1]);
}

const DEFAULT_DEPS: SuiteDeps = {
  rpcFor: (context) => supportRpcFor(context.serviceClient),
  identity: resolveSupportIdentity,
  runRead: defaultRunRead,
};

/** Staff-only read-only integration health check, reusing the same product and
 * per-principal authorization as the Bloom Support dashboard and Slack. */
export async function verifyBloomsitesIntegrations(
  params: JsonObject, context: ToolExecutionContext, deps: SuiteDeps,
): Promise<ToolResult> {
  try {
    const rpc = deps.rpcFor(context);
    const who = await deps.identity(context, rpc);
    if (!who.staff) {
      return toolResult(false, "Only authorized Bloom Support staff can inspect integration diagnostics. Nothing was changed.", null, "forbidden");
    }
    // Staff may name a garden centre without first switching CRM workspaces.
    // Search only accounts this exact principal is allowed to access, then
    // require one unambiguous, site-linked result before any remote read.
    let accountId = who.account.id;
    let accountName = who.account.name ?? "the selected company";
    let resolvedSiteId: string | null = null;
    if (params.client_name !== undefined && params.client_name !== null) {
      const name = typeof params.client_name === "string" ? params.client_name.trim() : "";
      if (name.length < 3 || name.length > 100 || !/^[\p{L}\p{N} .,'&-]+$/u.test(name)) {
        return toolResult(false, "Use a garden centre name without special characters.", null, "invalid_client");
      }
      const matches = await rpc<DiagnosticAccount[]>("list_accounts", {
        actor: who.principalId, q: name, limit: 50,
      });
      const selected = findDiagnosticAccount(name, Array.isArray(matches) ? matches : []);
      if (!selected) {
        return toolResult(false,
          "I could not identify one authorized BloomSites garden centre from that name. Choose the client in Bloom Support, or provide a more specific name.",
          null, "client_ambiguous");
      }
      accountId = selected.account.id;
      accountName = selected.account.name;
      resolvedSiteId = selected.siteId;
    }
    const site_id = typeof params.site_id === "string" && params.site_id.trim()
      ? params.site_id.trim().slice(0, 80) : null;
    if (resolvedSiteId && site_id && site_id !== resolvedSiteId) {
      return toolResult(false, "That website does not match the named garden centre. Nothing was read.", null, "site_mismatch");
    }
    const targetSite = resolvedSiteId ?? site_id;
    const data = await deps.runRead(
      { principalId: who.principalId, role: who.role, via: "crm_session", name: context.userName ?? null, scopes: [] },
      { kind: "site.integration_health", account_id: accountId, inputs: targetSite ? { site_id: targetSite } : {} },
    );
    return toolResult(true,
      `Checked recorded CounterPoint and Open Plant Data synchronization evidence for ${accountName}. Explain the exact assessment, recorded failures, latest successful receipt and import counts. A connected service or staged batch does not prove the customer's shop works. This was read-only and changed nothing.`,
      { product: "bloomsites", kind: "site.integration_health", result: (data ?? null) as JsonObject });
  } catch (error) {
    console.error("[bloom-assist] integration health read failed", error instanceof Error ? error.message : error);
    return toolResult(false, explainReadFailure("site.read", error), null, "suite_read_failed");
  }
}

export function suiteToolImplementation(toolName: ToolName) {
  if (!SUITE_TOOL_SET.has(toolName)) return null;
  if (toolName === "verify_bloomsites_integrations") {
    return (params: JsonObject, context: ToolExecutionContext) =>
      verifyBloomsitesIntegrations(params, context, DEFAULT_DEPS);
  }
  return (params: JsonObject, context: ToolExecutionContext) => readSuiteData(params, context, DEFAULT_DEPS);
}

export function isSuiteTool(toolName: string): boolean {
  return SUITE_TOOL_SET.has(toolName);
}
