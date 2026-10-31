import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/config";

export type SupportStatus = "new" | "working" | "waiting" | "needs_owner" | "resolved";

export const STATUS_LABEL: Record<SupportStatus, string> = {
  new: "New",
  working: "Working",
  waiting: "Waiting",
  needs_owner: "Needs Jon/Jeff",
  resolved: "Resolved",
};

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
  status: SupportStatus;
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
}

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
  conversation_tickets: Array<{ id: string; number: number; subject: string; status: SupportStatus }>;
  context?: Record<string, unknown>;
  links?: Array<{ ticket_id: string; kind: string; number: number; subject: string; status: SupportStatus }>;
  activity?: Array<{ action: string; detail: Record<string, unknown>; created_at: string; actor: string | null }>;
  jobs?: Array<{ id: string; kind: string; status: string; attempts: number; last_error: string | null; run_after: string; updated_at: string }>;
  operations?: Array<Record<string, unknown>>;
  engineering?: Record<string, unknown> | null;
  feature_request?: Record<string, unknown> | null;
  escalations?: Array<Record<string, unknown>>;
  emails?: Array<{ purpose: string; to: string; status: string; created_at: string; error: string | null }>;
  account_history?: Array<{ id: string; number: number; subject: string; status: SupportStatus; created_at: string }>;
}

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

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function call<T>(fn: "bloom-support-api" | "bloom-support-intake", path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { ...(auth ? await authHeader() : {}), ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new BloomSupportError(res.status, body?.error ?? "error", body?.message ?? `Request failed (${res.status})`);
  return body as T;
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
  createTicket: (input: Record<string, unknown>) => send<{ ticket_id: string; number: number }>("POST", "/tickets", input),
  addMessage: (id: string, input: { body: string; visibility: "public" | "internal"; idempotency_key?: string }) => send("POST", `/tickets/${id}/messages`, input),
  updateTicket: (id: string, patch: Record<string, unknown>) => send<TicketSummary>("PATCH", `/tickets/${id}`, patch),
  setAutomation: (id: string, mode: "human" | "auto" | "paused", reason?: string) => send("POST", `/tickets/${id}/automation`, { mode, reason }),
  link: (id: string, to: string, kind: string) => send("POST", `/tickets/${id}/link`, { to, kind }),
  related: (id: string) => api<Array<{ id: string; number: number; subject: string; status: SupportStatus; score: number }>>(`/tickets/${id}/related`),
  investigate: (id: string, note?: string) => send("POST", `/tickets/${id}/investigate`, { note }),
  routeFeature: (id: string, title?: string) => send("POST", `/tickets/${id}/feature`, { title }),
  escalate: (id: string, audience: "jon" | "jeff" | "both", reason: string) => send("POST", `/tickets/${id}/escalate`, { audience, reason }),
  attachmentUrl: (id: string) => api<{ url: string; file_name: string }>(`/attachments/${id}`),
  uploadAttachment: async (ticketId: string, file: File, visibility: "public" | "internal" = "public") => {
    const form = new FormData();
    form.append("file", file);
    form.append("visibility", visibility);
    return api(`/tickets/${ticketId}/attachments`, { method: "POST", body: form });
  },
  listAccounts: (q?: string) => api<Array<{ id: string; name: string; needs_review: boolean; open_tickets: number; links: Array<{ product: string; external_id: string; label: string | null }> }>>(`/accounts${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getAccount: (id: string) => api<Record<string, unknown>>(`/accounts/${id}`),
  updateAccount: (id: string, patch: Record<string, unknown>) => send("PATCH", `/accounts/${id}`, patch),
  engineering: (status?: string) => api<Array<Record<string, unknown>>>(`/engineering${status ? `?status=${status}` : ""}`),
  updateEngineering: (id: string, update: Record<string, unknown>) => send("PATCH", `/engineering/${id}`, update),
  features: () => api<Array<Record<string, unknown>>>("/features"),
  decideFeature: (id: string, decision: string, note?: string) => send("POST", `/features/${id}/decision`, { decision, note }),
  escalations: (all = false) => api<Array<Record<string, unknown>>>(`/escalations${all ? "?all=true" : ""}`),
  resolveEscalation: (id: string, decision: string) => send("POST", `/escalations/${id}/resolve`, { decision }),
  operationsCatalog: () => api<{ reads: Array<{ kind: string; permission: string }>; changes: Array<{ kind: string; permission: string; undo: boolean }>; remote: Record<string, { configured: boolean; missing: string[] }> }>("/operations/catalog"),
  readOperation: (input: Record<string, unknown>) => send("POST", "/operations/read", input),
  previewOperation: (input: Record<string, unknown>) => send<Record<string, unknown>>("POST", "/operations/preview", input),
  executeOperation: (id: string) => send<Record<string, unknown>>("POST", `/operations/${id}/execute`),
  undoOperation: (id: string) => send<Record<string, unknown>>("POST", `/operations/${id}/undo`),
  jobs: (status?: string) => api<Array<Record<string, unknown>>>(`/jobs${status ? `?status=${status}` : ""}`),
  controlJob: (id: string, action: "retry" | "cancel") => send("POST", `/jobs/${id}/${action}`),
  settings: () => api<Record<string, unknown>>("/settings"),
  setSetting: (key: string, value: unknown) => send("PUT", `/settings/${key}`, { value }),
  staff: () => api<Array<{ id: string; name: string | null; email: string | null; role: string; grants: string[]; kind: string; active: boolean }>>("/staff"),
  setRole: (principal: Record<string, unknown>) => send("POST", "/staff/role", principal),
  keys: () => api<Array<Record<string, unknown>>>("/keys"),
  createKey: (input: { label: string; scopes?: string[]; principal_id?: string; expires_days?: number }) => send<{ id: string; token: string }>("POST", "/keys", input),
  revokeKey: (id: string) => send("DELETE", `/keys/${id}`),
  createServiceIdentity: (name: string, scope: string) => send<string>("POST", "/service-identities", { name, scope }),
  notifications: () => api<Array<{ id: string; kind: string; title: string; ticket_id: string | null; read_at: string | null; created_at: string }>>("/notifications"),
  knowledge: () => api<Array<Record<string, unknown>>>("/knowledge"),
  saveKnowledge: (article: Record<string, unknown>) => send("POST", "/knowledge", article),

  /** Intake: the signed-in CRM user reports a problem or asks for help. */
  report: (input: { body: string; subject?: string; product?: string; context?: Record<string, unknown>; attachments?: Array<{ file_name: string; content_type: string; data_base64: string }>; idempotency_key?: string; conversation_id?: string }) =>
    call<{ received: boolean; ticket_id: string; number: number; tracking_url: string }>("bloom-support-intake", "/report", { method: "POST", body: JSON.stringify(input) }),
  /** Intake for people who cannot sign in. */
  publicRequest: (input: Record<string, unknown>) => call<{ received: boolean; number?: number; tracking_url?: string }>("bloom-support-intake", "/public", { method: "POST", body: JSON.stringify(input) }, false),
  track: (token: string) => call<{ number: number; subject: string; status: SupportStatus; created_at: string; updated_at: string; resolution_summary: string | null; messages: Array<{ from: string; body: string; created_at: string }> }>("bloom-support-api", `/track/${token}`, {}, false),
};

/** Context captured automatically with a report. Browser globals are read only when called. */
export function captureClientContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (typeof window === "undefined") return extra;
  const nav = window.navigator;
  return {
    page_url: window.location.href,
    route: window.location.pathname,
    user_agent: nav.userAgent.slice(0, 300),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    locale: nav.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: nav.onLine,
    app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ?? null,
    ...extra,
  };
}

export async function fileToUpload(file: File): Promise<{ file_name: string; content_type: string; data_base64: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { file_name: file.name, content_type: file.type || "application/octet-stream", data_base64: btoa(bin) };
}
