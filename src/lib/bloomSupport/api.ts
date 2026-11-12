import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/config";
import { checkAttachments, safeSupportTrackingUrl } from "@/lib/bloomSupport/constants";
import type { TrackReplyInput, TrackResponse, TrackView } from "@/lib/bloomSupport/trackView";

export type SupportStatus = "new" | "working" | "waiting" | "needs_owner" | "resolved";
/**
 * What a client sees. The server (bloom_support.client_status) projects every
 * non-staff ticket read to these four states, so routing states such as
 * needs_owner never reach a client.
 */
export type ClientStatus = "received" | "in_progress" | "waiting_on_you" | "resolved";
/** A ticket status as returned by the API: raw for staff, projected for clients. */
export type TicketStatus = SupportStatus | ClientStatus;

export type KnowledgeProduct = "platform" | "crm" | "cms" | "pos";
export interface PublicKnowledgeArticle {
  id: string;
  product: KnowledgeProduct;
  title: string;
  body: string;
  updated_at: string;
}
export interface KnowledgeArticle extends PublicKnowledgeArticle {
  audience: "client" | "internal";
  approved: boolean;
  approved_by: string | null;
}
export interface KnowledgeWrite {
  id?: string;
  expected_updated_at?: string;
  product?: KnowledgeProduct;
  title?: string;
  body?: string;
  audience?: "client" | "internal";
  approved?: boolean;
}

export const STATUS_LABEL: Record<SupportStatus, string> = {
  new: "New",
  working: "Working",
  waiting: "Waiting",
  needs_owner: "Needs admin",
  resolved: "Resolved",
};

/** Client-facing labels; match customerStatusLabel in the support emails. */
export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  waiting_on_you: "Waiting for your reply",
  resolved: "Resolved",
};

const CLIENT_STATUSES = new Set<string>(Object.keys(CLIENT_STATUS_LABEL));

export function isClientStatus(status: string): status is ClientStatus {
  return CLIENT_STATUSES.has(status);
}

/**
 * The client view of any status. The server already projects client reads;
 * this keeps a client surface safe if it is ever handed a raw status.
 */
export function clientStatusOf(status: string, waitingReason?: string | null): ClientStatus {
  if (isClientStatus(status)) return status;
  if (status === "new") return "received";
  if (status === "waiting" && waitingReason === "customer") return "waiting_on_you";
  return "in_progress";
}

/** Staff label for a raw status; client label otherwise. */
export function statusLabel(status: TicketStatus, audience: "staff" | "client" = "staff"): string {
  if (audience === "client") return CLIENT_STATUS_LABEL[clientStatusOf(status)];
  return (STATUS_LABEL as Record<string, string>)[status] ?? CLIENT_STATUS_LABEL[status as ClientStatus] ?? status;
}

export const PRODUCT_LABEL: Record<string, string> = {
  cms: "BloomSites",
  crm: "BloomSuite CRM",
  pos: "BloomSuite POS",
  platform: "Platform",
  unknown: "Unclassified",
};

export interface TicketSummary {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  product: string;
  kind: string;
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  conversation_id: string;
  account: { id: string; name: string } | null;
  requester: { id: string; name: string | null; email: string | null } | null;
  resolution_summary: string | null;
  // Staff-only fields
  stage?: string;
  category?: string | null;
  impact?: string;
  automation?: "auto" | "paused" | "human";
  next_action?: string | null;
  version?: number;
  channel?: string;
  owner?: { id: string; name: string | null; role: string } | null;
  taken_over_by?: { id: string; name: string | null } | null;
  engineering_issue_id?: string | null;
  feature_request_id?: string | null;
  reopen_count?: number;
  duplicate_of?: string | null;
  resolution_verified?: boolean;
  waiting_reason?: WaitingReason | null;
  merged_into?: string | null;
  merged_into_number?: number | null;
  progress?: string;
  executor?: "bloom" | "person";
  executor_person?: { id: string; name: string | null } | null;
  next_action_due_at?: string | null;
  due_at?: string | null;
  tags?: string[];
  spam?: boolean;
  pending_review?: string | null;
  problem_id?: string | null;
  environment?: string;
  source_ref?: string | null;
  first_response_at?: string | null;
  last_customer_message_at?: string | null;
  last_team_message_at?: string | null;
  flags?: { overdue: boolean; due_soon: boolean; stalled: boolean; unassigned: boolean; clock_paused: boolean; response_due_at: string | null; next_due_at: string | null; targets_are_internal: boolean };
}

export type WaitingReason = "customer" | "internal" | "third_party" | "deployment" | "scheduled";
export const WAITING_LABEL: Record<WaitingReason, string> = {
  customer: "Waiting on customer",
  internal: "Waiting on internal team",
  third_party: "Waiting on third party",
  deployment: "Waiting on deployment",
  scheduled: "Scheduled work",
};
export const KIND_LABEL: Record<string, string> = {
  question: "Question", bug: "Bug", change: "Content/config change", incident: "Incident", feature: "Feature request", other: "Other", unknown: "Unclassified",
};
export const QUEUE_VIEWS: Array<{ key: string; label: string }> = [
  { key: "needs_attention", label: "Needs attention" },
  { key: "mine", label: "Assigned to me" },
  { key: "open", label: "All open" },
  { key: "unassigned", label: "Unassigned" },
  { key: "urgent", label: "Urgent" },
  { key: "due_soon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
  { key: "waiting_customer", label: "Waiting on customer" },
  { key: "needs_owner", label: "Needs admin" },
  { key: "recently_resolved", label: "Recently resolved" },
];
export interface TicketPage { items: TicketSummary[]; total: number; next_cursor: string | null }

export interface TicketMessage {
  id: string;
  ticket_id: string | null;
  author_kind: "client" | "staff" | "bloom" | "system";
  visibility: "public" | "internal";
  direction: string;
  body: string;
  created_at: string;
  delivery?: string;
  author: { name: string | null; role?: string | null } | null;
}

export interface TicketDetail extends TicketSummary {
  summary: string;
  messages: TicketMessage[];
  attachments: Array<{ id: string; file_name: string; content_type: string; size_bytes: number; visibility: string; created_at: string }>;
  conversation_tickets: Array<{ id: string; number: number; subject: string; status: TicketStatus }>;
  context?: Record<string, unknown>;
  links?: Array<{ ticket_id: string; kind: string; number: number; subject: string; status: SupportStatus }>;
  activity?: Array<{ action: string; detail: Record<string, unknown>; created_at: string; actor: string | null }>;
  jobs?: Array<{ id: string; kind: string; status: string; attempts: number; last_error: string | null; run_after: string; updated_at: string }>;
  operations?: Array<Record<string, unknown>>;
  engineering?: Record<string, unknown> | null;
  feature_request?: Record<string, unknown> | null;
  escalations?: Array<Record<string, unknown>>;
  emails?: Array<{ purpose: string; to: string; cc?: string[]; status: string; created_at: string; error: string | null }>;
  timers?: Record<string, unknown>;
  history?: Array<{ kind: string; from: string | null; to: string | null; at: string; actor: string | null }>;
  problem?: { id: string; title: string; kind: string; status: string; tickets: number; accounts: number } | null;
  merged_tickets?: Array<{ id: string; number: number; subject: string }>;
  resolution_evidence?: Record<string, unknown> | null;
  account_history?: Array<{ id: string; number: number; subject: string; status: SupportStatus; created_at: string }>;
}

/** Bloom's plain-language summary of an escalation, for the Support desk. */
export interface EscalationPlain { problem: string; blocker: string | null }

export interface Whoami {
  id: string;
  name: string | null;
  email: string | null;
  role: "platform_admin" | "platform_operator" | "support" | "client" | "service";
  grants: string[];
  permissions: string[];
  accounts: Array<{ id: string; name: string }>;
}

export class BloomSupportError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface ReconcileTicketLinksInput {
  version: number;
  expected: { duplicate_of: string; merged_into: string | null; problem_id: string | null; engineering_issue_id: string | null; feature_request_id: string | null };
  clear_inherited: Array<"problem_id" | "engineering_issue_id" | "feature_request_id">;
  reason: string;
  next_action: string;
  idempotency_key: string;
}

export interface SignedSupportIntakeResult {
  received: true;
  duplicate_delivery: boolean;
  ticket_id: string;
  number: number;
  tracking_url?: string;
  attachments: { stored: number; failed: string[] };
}

export interface PublicSupportIntakeResult {
  received: true;
  duplicate_delivery: boolean;
  number: number;
  email_delivery: "pending";
  /** What happened to attached files. Absent only from a server that predates public attachments. */
  attachments?: { stored: number; failed: string[] };
}

export interface SupportMessageResult {
  message_id: string;
  duplicate: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const positiveRequestNumber = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

function invalidIntakeResponse(): never {
  throw new BloomSupportError(
    502,
    "invalid_response",
    "Bloom Support did not confirm your request. Please try again.",
  );
}

function invalidMessageResponse(): never {
  throw new BloomSupportError(
    502,
    "invalid_response",
    "Bloom Support did not confirm your reply. Please try again.",
  );
}

/** A 2xx response is successful only when intake confirms a saved request. */
export function parseSignedSupportIntake(
  value: unknown,
): SignedSupportIntakeResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalidIntakeResponse();
  }
  const body = value as Record<string, unknown>;
  if (
    body.received !== true ||
    typeof body.duplicate_delivery !== "boolean" ||
    !positiveRequestNumber(body.number) ||
    typeof body.ticket_id !== "string" ||
    !UUID_PATTERN.test(body.ticket_id)
  ) {
    return invalidIntakeResponse();
  }

  const attachments = parseAttachmentFacts(body.attachments);
  if (!attachments) return invalidIntakeResponse();
  const trackingUrl = safeSupportTrackingUrl(body.tracking_url);

  return {
    received: true,
    duplicate_delivery: body.duplicate_delivery,
    ticket_id: body.ticket_id,
    number: body.number,
    ...(trackingUrl ? { tracking_url: trackingUrl } : {}),
    attachments,
  };
}

/** The intake's per-file outcome: how many were stored, and a line for each one that was not. */
function parseAttachmentFacts(value: unknown): { stored: number; failed: string[] } | null {
  const facts = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const stored = facts?.stored;
  const failed = facts?.failed;
  return Number.isSafeInteger(stored) && (stored as number) >= 0 &&
      Array.isArray(failed) && failed.every((item) => typeof item === "string")
    ? { stored: stored as number, failed: failed as string[] }
    : null;
}

/** Public intake never exposes a ticket id, but must confirm a real request number. */
export function parsePublicSupportIntake(
  value: unknown,
): PublicSupportIntakeResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalidIntakeResponse();
  }
  const body = value as Record<string, unknown>;
  if (
    body.received !== true ||
    typeof body.duplicate_delivery !== "boolean" ||
    !positiveRequestNumber(body.number) ||
    body.email_delivery !== "pending"
  ) {
    return invalidIntakeResponse();
  }
  const attachments = parseAttachmentFacts(body.attachments);
  return {
    received: true,
    duplicate_delivery: body.duplicate_delivery,
    number: body.number,
    email_delivery: "pending",
    ...(attachments ? { attachments } : {}),
  };
}

/** A reply is complete only after the API confirms its durable message receipt. */
export function parseSupportMessageResult(
  value: unknown,
): SupportMessageResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalidMessageResponse();
  }
  const body = value as Record<string, unknown>;
  if (
    typeof body.message_id !== "string" ||
    !UUID_PATTERN.test(body.message_id) ||
    typeof body.duplicate !== "boolean"
  ) {
    return invalidMessageResponse();
  }
  return {
    message_id: body.message_id,
    duplicate: body.duplicate,
  };
}

/** Bloom chat month-to-date model spend per company (micro-USD: 1 USD = 1,000,000). */
export interface ChatSpendRow {
  tenant_id: string;
  tenant_name: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  settled_micros: number;
  in_flight_micros: number;
  committed_micros: number;
  cap_micros: number;
  override: boolean;
  override_note: string | null;
}
export interface ChatSpendOverview { month: string; default_cap_micros: number; tenants: ChatSpendRow[] }

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function call<T>(
  fn: "bloom-support-api" | "bloom-support-intake",
  path: string,
  init: RequestInit = {},
  auth = true,
  validate?: (body: unknown) => T,
): Promise<T> {
  const headers: Record<string, string> = { ...(auth ? await authHeader() : {}), ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new BloomSupportError(res.status, body?.error ?? "error", body?.message ?? `Request failed (${res.status})`);
  return validate ? validate(body) : body as T;
}

const api = <T,>(path: string, init?: RequestInit) => call<T>("bloom-support-api", path, init);
const send = <T,>(method: string, path: string, body?: unknown) => api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const bloomSupport = {
  me: () => api<Whoami>("/me"),
  summary: () => api<Record<string, unknown>>("/summary"),
  health: () => api<{ missing_configuration: string[]; email: { configured: boolean; inbox: string | null }; ai: { provider: string; model: string }; operations: Record<string, { configured: boolean; missing: string[] }> }>("/health"),
  listTickets: (filters: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as Array<[string, string]>).toString();
    return api<TicketSummary[]>(`/tickets${qs ? `?${qs}` : ""}`);
  },
  getTicket: (id: string) => api<TicketDetail>(`/tickets/${id}`),
  pageTickets: (filters: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries({ ...filters, envelope: "true" }).filter(([, v]) => v) as Array<[string, string]>).toString();
    return api<TicketPage>(`/tickets?${qs}`);
  },
  bulk: (ticketIds: string[], bulk: Record<string, unknown>) => send<{ updated: string[]; failed: Array<{ id: string; error: string }> }>("POST", "/tickets/bulk", { ticket_ids: ticketIds, bulk }),
  merge: (id: string, targetId: string, reason?: string) => send("POST", `/tickets/${id}/merge`, { target_id: targetId, reason }),
  spam: (id: string, spam: boolean) => send("POST", `/tickets/${id}/spam`, { spam }),
  clientAction: (id: string, action: "confirm_resolved" | "still_broken" | "request_person", message?: string) => send("POST", `/tickets/${id}/client-action`, { action, message }),
  postReply: (id: string, decision: "reopen" | "new_ticket" | "dismiss" | "review", messageId?: string) => send("POST", `/tickets/${id}/post-reply`, { decision, message_id: messageId }),
  problems: () => api<Array<Record<string, unknown>>>("/problems"),
  createProblem: (input: Record<string, unknown>) => send<Record<string, unknown>>("POST", "/problems", input),
  reconcileTicketLinks: (id: string, input: ReconcileTicketLinksInput) => send<{ ticket_id: string; version: number; detached_duplicate: string; cleared_inherited: string[] }>("POST", `/tickets/${id}/reconcile-links`, input),
  linkProblem: (id: string, problemId: string) => send("POST", `/tickets/${id}/problem`, { problem_id: problemId }),
  views: () => api<Array<{ id: string; name: string; filters: Record<string, string>; shared: boolean }>>("/views"),
  saveView: (name: string, filters: Record<string, unknown>, shared = false) => send("POST", "/views", { name, filters, shared }),
  deleteView: (id: string) => send("DELETE", `/views/${id}`),
  metrics: (from?: string, to?: string) => api<Record<string, unknown>>(`/reports/metrics${from || to ? `?${new URLSearchParams(Object.entries({ from, to }).filter(([, v]) => v) as Array<[string, string]>)}` : ""}`),
  createTicket: (input: Record<string, unknown>) => send<{ ticket_id: string; number: number }>("POST", "/tickets", input),
  addMessage: (id: string, input: { body: string; visibility: "public" | "internal"; idempotency_key?: string }) =>
    call(
      "bloom-support-api",
      `/tickets/${id}/messages`,
      { method: "POST", body: JSON.stringify(input) },
      true,
      parseSupportMessageResult,
    ),
  sendAndSolve: (id: string, input: Record<string, unknown>) => send<{ message_id: string; status: "resolved" }>("POST", `/tickets/${id}/send-and-solve`, input),
  updateTicket: (id: string, patch: Record<string, unknown>) => send<TicketSummary>("PATCH", `/tickets/${id}`, patch),
  setAutomation: (id: string, mode: "human" | "auto" | "paused", reason?: string) => send("POST", `/tickets/${id}/automation`, { mode, reason }),
  link: (id: string, to: string, kind: string) => send("POST", `/tickets/${id}/link`, { to, kind }),
  related: (id: string) => api<Array<{ id: string; number: number; subject: string; status: SupportStatus; score: number }>>(`/tickets/${id}/related`),
  investigate: (id: string, note?: string) => send("POST", `/tickets/${id}/investigate`, { note }),
  routeFeature: (id: string, title?: string) => send("POST", `/tickets/${id}/feature`, { title }),
  escalate: (id: string, audience: "jon" | "jeff" | "both", reason: string) => send("POST", `/tickets/${id}/escalate`, { audience, reason }),
  attachmentUrl: (id: string) => api<{ url: string; file_name: string }>(`/attachments/${id}`),
  uploadAttachment: async (ticketId: string, file: File, visibility: "public" | "internal" = "public") => {
    const checked = checkAttachments([file]);
    if (checked.rejected.length || checked.accepted.length !== 1) {
      throw new BloomSupportError(400, "invalid_attachment", checked.rejected[0] ?? "This file cannot be attached");
    }
    const upload = await fileToUpload(file);
    return api(`/tickets/${ticketId}/attachments`, {
      method: "POST",
      body: JSON.stringify({ ...upload, visibility }),
    });
  },
  listAccounts: (q?: string) => api<Array<{ id: string; name: string; needs_review: boolean; open_tickets: number; links: Array<{ product: string; external_id: string; label: string | null }> }>>(`/accounts${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getAccount: (id: string) => api<Record<string, unknown>>(`/accounts/${id}`),
  updateAccount: (id: string, patch: Record<string, unknown>) => send("PATCH", `/accounts/${id}`, patch),
  engineering: (status?: string) => api<Array<Record<string, unknown>>>(`/engineering${status ? `?status=${status}` : ""}`),
  updateEngineering: (id: string, update: Record<string, unknown>) => send("PATCH", `/engineering/${id}`, update),
  features: () => api<Array<Record<string, unknown>>>("/features"),
  decideFeature: (id: string, decision: string, note?: string) => send("POST", `/features/${id}/decision`, { decision, note }),
  readiness: () => api<{ generated_at: string; live_evidence?: string; summary: { continuous_automation: string; owners_configured: boolean; worker: Record<string, unknown>; open_alerts: Array<Record<string, unknown>>; staff: Array<{ name: string | null; email: string | null; role: string }> }; capabilities: Array<{ key: string; label: string; implemented: boolean; configured: boolean; missing: string[]; tested: string; enabled: boolean | null; live: string | null; note?: string }> }>("/readiness"),
  acknowledgeEscalation: (id: string, note?: string) => send("POST", `/escalations/${id}/acknowledge`, { note }),
  escalations: (all = false) => api<Array<Record<string, unknown>>>(`/escalations${all ? "?all=true" : ""}`),
  resolveEscalation: (id: string, decision: string) => send("POST", `/escalations/${id}/resolve`, { decision }),
  /** A stored plain-language summary of an escalation, written once by Bloom. plain is null when none could be written. */
  explainEscalation: (id: string) => send<{ plain: EscalationPlain | null; reason?: string }>("POST", `/escalations/${id}/explain`),
  operationsCatalog: () => api<{ reads: Array<{ kind: string; permission: string }>; changes: Array<{ kind: string; permission: string; undo: boolean }>; remote: Record<string, { configured: boolean; missing: string[] }> }>("/operations/catalog"),
  readOperation: (input: Record<string, unknown>) => send("POST", "/operations/read", input),
  startIntegrationTask: (input: { account_id: string; site_id?: string; idempotency_key: string }) =>
    send<{ ticket_id: string; number: number; duplicate: boolean; assessment: string; evidence: Record<string, unknown>; message: string }>(
      "POST", "/operations/investigate", input),
  previewOperation: (input: Record<string, unknown>) => send<Record<string, unknown>>("POST", "/operations/preview", input),
  executeOperation: (id: string) => send<Record<string, unknown>>("POST", `/operations/${id}/execute`),
  undoOperation: (id: string) => send<Record<string, unknown>>("POST", `/operations/${id}/undo`),
  jobs: (status?: string) => api<Array<Record<string, unknown>>>(`/jobs${status ? `?status=${status}` : ""}`),
  controlJob: (id: string, action: "retry" | "cancel") => send("POST", `/jobs/${id}/${action}`),
  settings: () => api<Record<string, unknown>>("/settings"),
  setSetting: (key: string, value: unknown) => send("PUT", `/settings/${key}`, { value }),
  chatSpend: () => api<ChatSpendOverview>("/chat-spend"),
  setChatSpendCap: (tenantId: string, capUsd: number | null, note?: string) => send("PUT", `/chat-spend/${tenantId}`, { cap_usd: capUsd, note }),
  staff: () => api<Array<{ id: string; name: string | null; email: string | null; role: string; grants: string[]; kind: string; active: boolean }>>("/staff"),
  setRole: (principal: Record<string, unknown>) => send("POST", "/staff/role", principal),
  keys: () => api<Array<Record<string, unknown>>>("/keys"),
  createKey: (input: { label: string; scopes?: string[]; principal_id?: string; expires_days?: number }) => send<{ id: string; token: string }>("POST", "/keys", input),
  revokeKey: (id: string) => send("DELETE", `/keys/${id}`),
  createServiceIdentity: (name: string, scope: string) => send<string>("POST", "/service-identities", { name, scope }),
  notifications: () => api<Array<{ id: string; kind: string; title: string; ticket_id: string | null; read_at: string | null; created_at: string }>>("/notifications"),
  knowledge: () => api<KnowledgeArticle[]>("/knowledge"),
  saveKnowledge: (article: KnowledgeWrite) => send<KnowledgeArticle>("POST", "/knowledge", article),
  publicKnowledge: (product?: KnowledgeProduct) => call<PublicKnowledgeArticle[]>("bloom-support-api", `/help${product ? `?product=${encodeURIComponent(product)}` : ""}`, {}, false),

  /** Intake: the signed-in CRM user reports a problem or asks for help. */
  report: (input: { body: string; subject?: string; product?: string; context?: Record<string, unknown>; attachments?: Array<{ file_name: string; content_type: string; data_base64: string }>; idempotency_key?: string; conversation_id?: string }) =>
    call("bloom-support-intake", "/report", { method: "POST", body: JSON.stringify(input) }, true, parseSignedSupportIntake),
  /** Intake for people who cannot sign in. */
  publicRequest: (input: Record<string, unknown>) =>
    call("bloom-support-intake", "/public", { method: "POST", body: JSON.stringify(input) }, false, parsePublicSupportIntake),

  /** Public tracking page: the link in every support email is the only credential. */
  track: (token: string) => call<TrackResponse>("bloom-support-api", `/track/${encodeURIComponent(token)}`, {}, false),
  trackReply: (token: string, input: TrackReplyInput) =>
    call<{ message_id: string; duplicate: boolean; attachments: number; view: TrackView | null }>("bloom-support-api", `/track/${encodeURIComponent(token)}/reply`, { method: "POST", body: JSON.stringify(input) }, false),
  trackAction: (token: string, action: "confirm_resolved" | "still_broken", message?: string) =>
    call<{ ok: true; view: TrackView | null }>("bloom-support-api", `/track/${encodeURIComponent(token)}/action`, { method: "POST", body: JSON.stringify({ action, message }) }, false),
  trackAttachment: (token: string, attachmentId: string) =>
    call<{ url: string; file_name: string }>("bloom-support-api", `/track/${encodeURIComponent(token)}/attachments/${encodeURIComponent(attachmentId)}`, {}, false),
  trackRenew: (token: string) => call<{ ok: true }>("bloom-support-api", `/track/${encodeURIComponent(token)}/renew`, { method: "POST", body: "{}" }, false),
};

/** The current page without query/hash credentials such as reset or OAuth tokens. */
export function safeClientPageUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

/** Context captured automatically with a report. Browser globals are read only when called. */
export function captureClientContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (typeof window === "undefined") return extra;
  const nav = window.navigator;
  return {
    ...extra,
    // Query strings and fragments can contain reset, invite or OAuth tokens. The
    // route is enough to reproduce a UI problem, so never send those values to
    // the support desk as diagnostics.
    page_url: safeClientPageUrl(),
    route: window.location.pathname,
    user_agent: nav.userAgent.slice(0, 300),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    locale: nav.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: nav.onLine,
    app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ?? null,
  };
}

/** The subset of captureClientContext() that Bloom chat sends so a support report can say where it happened. */
export type BloomChatClientContext = { route: string | null; user_agent: string | null; viewport: string | null };

export function bloomChatClientContext(): BloomChatClientContext | null {
  if (typeof window === "undefined") return null;
  const captured = captureClientContext();
  const pick = (v: unknown) => (typeof v === "string" && v ? v : null);
  return { route: pick(captured.route), user_agent: pick(captured.user_agent), viewport: pick(captured.viewport) };
}

/** Diagnostics Bloom attached when it filed a ticket from chat (context.diagnostics). */
export interface BloomDiagnostics {
  capturedAt: string | null;
  company: string | null;
  filedByStaff: boolean;
  adminWorkspace: boolean;
  route: string | null;
  userAgent: string | null;
  viewport: string | null;
  conversationId: string | null;
  failedRunsStatus: "ok" | "unknown";
  failedRuns: Array<{ tool: string; at: string | null; error: string | null }>;
}

export function readBloomDiagnostics(context: Record<string, unknown> | null | undefined): BloomDiagnostics | null {
  const raw = context?.diagnostics;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const runs = Array.isArray(d.failed_tool_runs) ? d.failed_tool_runs : [];
  return {
    capturedAt: s(d.captured_at),
    company: s(d.account_name),
    filedByStaff: d.filed_by_staff === true,
    adminWorkspace: d.admin_workspace === true,
    route: s(d.route),
    userAgent: s(d.user_agent),
    viewport: s(d.viewport),
    conversationId: s(d.bloom_conversation_id),
    failedRunsStatus: d.failed_tool_runs_status === "unknown" ? "unknown" : "ok",
    failedRuns: runs
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
      .slice(0, 10)
      .map((r) => ({ tool: s(r.tool) ?? "unknown", at: s(r.at), error: s(r.error) })),
  };
}

export async function fileToUpload(file: File): Promise<{ file_name: string; content_type: string; data_base64: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { file_name: file.name, content_type: file.type || "application/octet-stream", data_base64: btoa(bin) };
}
