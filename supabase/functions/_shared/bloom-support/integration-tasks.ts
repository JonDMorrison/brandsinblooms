/**
 * One canonical Bloom Support ticket for each explicit, authorized integration
 * investigation. The existing ticket/engineering workflow owns status, human
 * approval and any subsequent repair. Slack remains a transport, not an admin.
 */
import { BloomError, type Caller, rpc } from "./runtime.ts";
import { runRead } from "./operations.ts";
import { formatIntegrationEvidence, formatProviderEvidence } from "./integration-diagnostics.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THREAD = /^\d{10}\.\d{6}$/;
export type TaskSource =
  | { channel: "slack"; requestId: string; threadTs: string }
  | { channel: "dashboard"; requestId: string };

export type IntegrationTaskKind = "site.integration_health" | "site.provider_health";
export interface IntegrationTaskResult {
  ticket_id: string;
  number: number;
  duplicate: boolean;
  assessment: "needs_attention" | "not_fully_verified";
  evidence: unknown;
  message: string;
}

export function supportTaskUrl(ticketId: string): string {
  if (!UUID.test(ticketId)) throw new BloomError(400, "invalid", "Invalid support ticket");
  return "https://bloomsuite.app/admin/bloom-support?view=queue&ticket=" + ticketId;
}

/** Stored context is bounded and can be read by authorized staff in both UIs. */
export function taskContext(source: TaskSource, evidence: Record<string, unknown>, kind: IntegrationTaskKind = "site.integration_health"): Record<string, unknown> {
  if (!UUID.test(source.requestId)) throw new BloomError(400, "invalid", "Invalid operation request");
  if (source.channel === "slack" && !THREAD.test(source.threadTs)) {
    throw new BloomError(400, "invalid", "Invalid Slack message reference");
  }
  const assessed = evidence.assessment;
  if (assessed !== "needs_attention" && assessed !== "not_fully_verified")
    throw new BloomError(502, "invalid_evidence", "Unrecognized integration health result");
  return {
    bloom_task: {
      kind: kind === "site.provider_health" ? "provider_health" : "integration_health",
      source: source.channel,
      // The channel is constant and only ever #bloom-projects. We do not
      // accept a client-supplied Slack channel ID.
      ...(source.channel === "slack" ? { thread_ts: source.threadTs } : {}),
      assessment: assessed,
      checked_at: typeof evidence.checked_at === "string" && !Number.isNaN(Date.parse(evidence.checked_at))
        ? new Date(evidence.checked_at).toISOString() : null,
      customer_verified: false,
      repair_authorized: false,
    },
  };
}

const safeName = (value: unknown): string =>
  typeof value === "string" ? value.replace(/[<>@\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 75) || "client" : "client";

/**
 * Read using the real person's product permission before making any task.
 * A stable requestId keeps retries from creating duplicate tickets.
 * Ticket automation is always paused; no client email, code generation,
 * changes, deployment or repair is authorized by this call.
 */
export async function startIntegrationTask(
  caller: Caller,
  input: { accountId: string; siteId?: string; source: TaskSource; kind?: IntegrationTaskKind; provider?: "heartland" | "shipstation" | "both" },
): Promise<IntegrationTaskResult> {
  if (!UUID.test(input.accountId)) throw new BloomError(400, "invalid", "Select an existing client");
  const contextSource = input.source;
  const kind = input.kind ?? "site.integration_health";
  if (kind !== "site.integration_health" && kind !== "site.provider_health")
    throw new BloomError(400, "invalid", "Unknown diagnostic operation");
  if (kind === "site.provider_health" && !["heartland", "shipstation", "both"].includes(input.provider ?? ""))
    throw new BloomError(400, "invalid", "Select a supported provider");
  // Validate the idempotency and Slack thread reference before any remote read.
  taskContext(contextSource, { assessment: "not_fully_verified" }, kind);
  const evidence = await runRead(caller, {
    kind,
    account_id: input.accountId,
    inputs: {
      ...(input.siteId ? {site_id:input.siteId} : {}),
      ...(kind === "site.provider_health" ? {provider:input.provider} : {}),
    },
  }) as Record<string, unknown>;
  const details = taskContext(contextSource, evidence, kind);
  const account = await rpc<{id:string;name:string}>("get_account", {
    actor: caller.principalId, account_id: input.accountId,
  });
  if (!account || account.id !== input.accountId)
    throw new BloomError(403, "forbidden", "Cannot access that client");
  const name = safeName(account.name);
  const summary = kind === "site.provider_health" ? formatProviderEvidence(name,evidence) : formatIntegrationEvidence(name,evidence);
  const noteBody = summary.replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, "$1").slice(0, 2000);
  const taskMeta = details.bloom_task as Record<string, unknown>;
  // Preserve the original bounded evidence so a retry can restore the
  // original internal note without conflicting with a newer provider check.
  taskMeta.brief = noteBody;
  const key = `bloom-investigation:${contextSource.channel}:${kind}:${input.accountId}:${contextSource.requestId}`;
  const result = await rpc<{ticket_id:string;number:number;duplicate_delivery?:boolean}>("create_ticket", {
    actor: caller.principalId,
    ticket: {
      product: "cms",
      channel: "staff",
      kind_hint: evidence.assessment === "needs_attention" ? "bug" : "question",
      priority_hint: "normal",
      subject: `Integration investigation: ${name}`,
      body: kind === "site.provider_health" ? "Review Heartland and ShipStation integration evidence. Confirm real product and order workflows before resolving. Repairs require separate authorized review." : "Review CounterPoint and Open Plant Data integration evidence. Confirm the customer workflow before resolving. Repairs require separate authorized review.",
      account_id: account.id,
      context: details,
      automation: "paused",
      dedupe_key: key,
    },
  });
  if (!result || !UUID.test(result.ticket_id) || !Number.isSafeInteger(result.number))
    throw new BloomError(502, "invalid_receipt", "Support did not confirm the investigation");
  // If a prior attempt created the ticket but crashed before recording the
  // evidence note, replay the original stored brief (same idempotency bytes).
  const canonical = result.duplicate_delivery === true
    ? await rpc<Record<string, unknown>>("get_ticket", {
      actor: caller.principalId, ticket_id: result.ticket_id,
    }) : null;
  const meta = ((canonical?.context as Record<string, unknown> | undefined)?.bloom_task ?? null) as Record<string, unknown> | null;
  const stableNote = result.duplicate_delivery === true &&
    (meta?.kind === "integration_health" || meta?.kind === "provider_health") && typeof meta.brief === "string" &&
    meta.brief.length > 0 && meta.brief.length <= 2000 ? meta.brief : noteBody;
  await rpc("add_message", {
    actor: caller.principalId,
    ticket_id: result.ticket_id,
    message: {
      visibility: "internal", body: stableNote,
      purpose: "progress", notify_client: false,
      idempotency_key: "bloom-integration-evidence:" + contextSource.requestId,
    },
  });
  return {
    ticket_id: result.ticket_id, number: result.number,
    duplicate: result.duplicate_delivery === true,
    assessment: evidence.assessment as IntegrationTaskResult["assessment"],
    evidence,
    message: summary,
  };
}

export function taskStatusText(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ticket = value as Record<string, unknown>;
  const context = ticket.context && typeof ticket.context === "object"
    ? ticket.context as Record<string, unknown> : {};
  const task = context.bloom_task && typeof context.bloom_task === "object"
    ? context.bloom_task as Record<string, unknown> : {};
  if (!["integration_health","provider_health"].includes(String(task.kind)) || typeof ticket.id !== "string" || !UUID.test(ticket.id)) return null;
  const number = typeof ticket.number === "number" && Number.isSafeInteger(ticket.number)
    ? ticket.number : null;
  const status = String(ticket.status ?? "");
  const labels: Record<string,string> = {
    new: "Recorded, awaiting review", working: "Being investigated",
    waiting: "Waiting on the team or a dependency", needs_owner: "Needs an administrator",
    resolved: "Recorded as resolved; verify customer evidence",
  };
  const label = labels[status] ?? "Status not confirmed";
  const link = supportTaskUrl(ticket.id);
  return `*Bloom investigation${number === null ? "" : " #" + number}*\n*Status:* ${label}\n*Customer workflow:* Not verified by this status alone.\n<${link}|Open the same task in Bloom Support>`;
}

/** Asking for review never authorizes an engineering agent or a release. */
export function repairReviewTaskNumber(question: unknown): number | null {
  if (typeof question !== "string" || question.length > 500) return null;
  const match = /\b(?:request|ask\s+(?:for|the\s+team\s+to))\s+(?:a\s+)?(?:repair|fix)\s+review\s+(?:for|of|on)\s+(?:task|ticket|investigation)\s*#?(\d{1,8})\b/i.exec(question) ??
    /\b(?:task|ticket|investigation)\s*#?(\d{1,8})\s+(?:needs|requires)\s+(?:a\s+)?(?:repair|fix)\s+review\b/i.exec(question);
  const number = Number(match?.[1]);
  return match && Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** Follow-up requests retrieve the canonical Support ticket, not a Slack copy. */
export function taskNumberFromQuestion(question: unknown): number | null {
  if (typeof question !== "string" || question.length > 500) return null;
  const match = /\b(?:status|progress|update)\s+(?:(?:of|for|on)\s+)?(?:task|ticket|investigation)\s*#?(\d{1,8})\b/i.exec(question) ??
    /\b(?:task|ticket|investigation)\s*#?(\d{1,8})\s+(?:status|progress|update)\b/i.exec(question);
  const number = Number(match?.[1]);
  return match && Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function taskThreadFromTicket(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ticket = value as Record<string, unknown>;
  const context = ticket.context && typeof ticket.context === "object"
    ? ticket.context as Record<string, unknown> : {};
  const task = context.bloom_task && typeof context.bloom_task === "object"
    ? context.bloom_task as Record<string, unknown> : {};
  return ["integration_health","provider_health"].includes(String(task.kind)) && task.source === "slack" &&
    typeof task.thread_ts === "string" && THREAD.test(task.thread_ts) ? task.thread_ts : null;
}
