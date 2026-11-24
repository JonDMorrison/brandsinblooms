/**
 * Showroom replacement for "@/integrations/supabase/client".
 * Same exports, no network. See showroom/README.md.
 */
import { DEMO_BLOCKED, QueryBuilder, ShowroomDatabase, type Row, type RpcHandler } from "./engine";
import { buildSeed, SHOWROOM_TENANT_ID, SHOWROOM_USER_EMAIL, SHOWROOM_USER_ID } from "./seed";

const DAY = 86_400_000;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function snapshot(db: ShowroomDatabase) {
  const customers = db.table("crm_customers").filter(c => !c.deleted_at);
  const campaigns = db.table("crm_campaigns");
  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const prevStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();
  const created = (c: Row) => Date.parse(String(c.created_at));
  const sent = campaigns.filter(c => c.status === "sent");
  const avg = (key: string) => (sent.length ? sent.reduce((s, c) => s + num(c[key]), 0) / sent.length : 0);
  const tagged = (tag: string) => customers.filter(c => (c.tags as string[] | null)?.includes(tag)).length;
  const lastPurchase = (c: Row) => (c.last_purchase_date ? Date.parse(String(c.last_purchase_date)) : 0);
  const buyers = customers.filter(c => num(c.pos_order_count) > 0);
  const personaCounts: Record<string, number> = {};
  for (const c of customers) personaCounts[String(c.persona)] = (personaCounts[String(c.persona)] ?? 0) + 1;
  return {
    total_customers: customers.length,
    recent_customers_30d: customers.filter(c => created(c) > now - 30 * DAY).length,
    total_customer_revenue: Math.round(customers.reduce((s, c) => s + num(c.total_spent), 0)),
    current_month_customers: customers.filter(c => created(c) >= monthStart).length,
    previous_month_customers: customers.filter(c => created(c) >= prevStart && created(c) < monthStart).length,
    current_month_customer_revenue: Math.round(customers.filter(c => lastPurchase(c) >= monthStart).reduce((s, c) => s + num(c.total_spent) / Math.max(num(c.pos_order_count), 1), 0)),
    previous_month_customer_revenue: Math.round(customers.filter(c => lastPurchase(c) >= prevStart && lastPurchase(c) < monthStart).reduce((s, c) => s + num(c.total_spent) / Math.max(num(c.pos_order_count), 1), 0)),
    total_campaigns: campaigns.length,
    active_campaigns: campaigns.filter(c => c.status === "scheduled" || c.status === "sending").length,
    current_month_campaigns: campaigns.filter(c => Date.parse(String(c.created_at)) >= monthStart).length,
    previous_month_campaigns: campaigns.filter(c => Date.parse(String(c.created_at)) >= prevStart && Date.parse(String(c.created_at)) < monthStart).length,
    avg_open_rate: Math.round(avg("open_rate") * 10) / 10,
    avg_click_rate: Math.round(avg("click_rate") * 10) / 10,
    overall_conversion_rate: customers.length ? Math.round((buyers.length / customers.length) * 1000) / 10 : 0,
    current_month_conversion_rate: 0,
    previous_month_conversion_rate: 0,
    segment_counts: {
      "perks-members": tagged("loyalty"), "loyalty-members": tagged("loyalty"),
      "high-value": customers.filter(c => num(c.total_spent) > 1200).length,
      "new-customers": customers.filter(c => created(c) > now - 30 * DAY).length,
      "lapsed-customers": customers.filter(c => lastPurchase(c) && lastPurchase(c) < now - 270 * DAY).length,
      "seasonal-shoppers": customers.filter(c => lastPurchase(c) > now - 120 * DAY).length,
      "frequent-buyers": customers.filter(c => num(c.pos_order_count) >= 6).length,
    },
    persona_counts: personaCounts,
  };
}

const ALL_PERMISSIONS = ["access.manage", "customers.read", "customers.write", "campaigns.read", "campaigns.write", "campaigns.send", "segments.manage", "automations.manage", "loyalty.read", "loyalty.write", "reports.read", "integrations.manage", "content.design"];

const rpcs: Record<string, RpcHandler> = {
  get_current_crm_access: () => ({ tenantId: SHOWROOM_TENANT_ID, role: "owner_admin", locationIds: [], permissions: ALL_PERMISSIONS }),
  has_tenant_permission: () => true,
  get_crm_dashboard_snapshot: (_args, db) => [snapshot(db)],
  ensure_system_segments: () => null,
  get_forms_with_stats: (_args, db) => db.table("forms").map(f => ({ ...f, submission_count: f.status === "published" ? 40 + (String(f.id).charCodeAt(String(f.id).length - 1) % 9) * 37 : 0, last_submission_at: new Date(Date.now() - 2 * DAY).toISOString() })),
  segment_membership_summary: (_args, db) => db.table("crm_segments").map(s => ({ segment_id: s.id, member_count: s.customer_count })),
  get_next_message_sequence: () => 1,
  get_customer_catalog_stats: (_args, db) => {
    const rows = db.table("crm_customers").filter(c => !c.deleted_at);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return { totalCustomers: rows.length, newThisMonth: rows.filter(c => Date.parse(String(c.created_at)) >= monthStart).length, totalSpent: Math.round(rows.reduce((s, c) => s + num(c.total_spent), 0)) };
  },
  save_care_guide_design_draft: (args, db) => {
    const existing = db.table("care_guide_designs").find(row => row.tenant_id === args.p_tenant_id);
    if (existing) db.apply({ table: "care_guide_designs", op: "update", ids: [String(existing.id)], patch: { draft: args.p_draft } });
    else db.apply({ table: "care_guide_designs", op: "insert", rows: [{ id: `care-${SHOWROOM_TENANT_ID}`, tenant_id: args.p_tenant_id, draft: args.p_draft, published: null, published_version: 0 }] });
    return args.p_draft;
  },
  email_reachability_summary: (args, db) => {
    const ids = Array.isArray(args.p_customer_ids) ? new Set(args.p_customer_ids as string[]) : null;
    const rows = db.table("crm_customers").filter(c => !c.deleted_at && (!ids || ids.has(String(c.id))));
    const reachable = rows.filter(c => c.email_opt_in && !c.suppressed && !c.opt_out).length;
    const askedToStop = rows.filter(c => c.opt_out).length;
    const unsendable = rows.filter(c => c.suppressed && !c.opt_out).length;
    const neverOptedIn = rows.length - reachable - askedToStop - unsendable;
    return [{ total: rows.length, reachable, waiting: 0, stopped: askedToStop + neverOptedIn, asked_to_stop: askedToStop, never_opted_in: neverOptedIn, unsendable }];
  },
  get_email_campaign_reporting_snapshot: (args, db) => {
    const c = db.table("crm_campaigns").find(row => row.id === args.p_campaign_id);
    if (!c) return null;
    const sent = num(c.total_sent), opens = num(c.total_opens), clicks = num(c.total_clicks);
    const delivered = Math.round(sent * 0.985);
    return {
      metrics: { totals: { sent, delivered, opens, unique_opens: opens, clicks, unique_clicks: clicks, hard_bounces: sent - delivered, unsubscribes: Math.round(sent * 0.002), complaints: 0 }, rates: { open_rate: num(c.open_rate), click_rate: num(c.click_rate), delivery_rate: sent ? 98.5 : 0 } },
      timeline: sent ? Array.from({ length: 24 }, (_, hour) => ({ hour, opens: Math.round((opens / 6) * Math.exp(-hour / 5)), clicks: Math.round((clicks / 6) * Math.exp(-hour / 5)) })) : [],
      failure_reasons: [],
      sent_at: c.sent_at ?? null,
    };
  },
};

/** Anything that would send, publish, upload, charge or call AI is answered with a clear demo message. */
const blockedRpc = /send|publish|claim|schedule|retry|import|create_current_user_tenant|set_campaign|set_customer_marketing|save_pos_membership|review_bloomsuite/;

let db: ShowroomDatabase | null = null;
function database(): ShowroomDatabase { return (db ??= new ShowroomDatabase(buildSeed(), rpcs)); }

const user = {
  id: SHOWROOM_USER_ID, email: SHOWROOM_USER_EMAIL, aud: "authenticated", role: "authenticated",
  app_metadata: { provider: "showroom" }, user_metadata: { full_name: "Demo Owner" },
  created_at: new Date(Date.now() - 540 * DAY).toISOString(),
};
const session = { access_token: "showroom", refresh_token: "showroom", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86_400, user };
const demoError = (message = DEMO_BLOCKED) => ({ message, name: "ShowroomError", status: 403 });

function channel() {
  const c = { on: () => c, subscribe: (cb?: (status: string) => void) => { cb?.("SUBSCRIBED"); return c; }, unsubscribe: async () => "ok", send: async () => "ok", track: async () => "ok", presenceState: () => ({}) };
  return c;
}

const auth = {
  getUser: async () => ({ data: { user }, error: null }),
  getSession: async () => ({ data: { session }, error: null }),
  refreshSession: async () => ({ data: { session, user }, error: null }),
  setSession: async () => ({ data: { session, user }, error: null }),
  onAuthStateChange: (callback: (event: string, s: typeof session) => void) => {
    setTimeout(() => callback("INITIAL_SESSION", session), 0);
    return { data: { subscription: { id: "showroom", unsubscribe: () => undefined, callback } } };
  },
  signOut: async () => ({ error: null }),
  signInWithPassword: async () => ({ data: { user: null, session: null }, error: demoError("Sign-in is not part of the demo.") }),
  signUp: async () => ({ data: { user: null, session: null }, error: demoError("Sign-up is not part of the demo.") }),
  signInWithOtp: async () => ({ data: {}, error: demoError("Sign-in is not part of the demo.") }),
  signInWithOAuth: async () => ({ data: {}, error: demoError("Sign-in is not part of the demo.") }),
  verifyOtp: async () => ({ data: {}, error: demoError() }),
  updateUser: async () => ({ data: { user }, error: demoError("Account settings cannot be changed in the demo.") }),
  resetPasswordForEmail: async () => ({ data: {}, error: demoError() }),
  resend: async () => ({ data: {}, error: demoError() }),
  exchangeCodeForSession: async () => ({ data: { session, user }, error: null }),
  startAutoRefresh: async () => undefined,
  stopAutoRefresh: async () => undefined,
  mfa: { listFactors: async () => ({ data: { all: [], totp: [] }, error: null }), getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }) },
  admin: new Proxy({}, { get: () => async () => ({ data: null, error: demoError() }) }),
};

const storageBucket = () => ({
  upload: async () => ({ data: null, error: demoError("Uploads are turned off in the demo. Choose a photo from the sample library instead.") }),
  update: async () => ({ data: null, error: demoError("Uploads are turned off in the demo.") }),
  remove: async () => ({ data: [], error: null }),
  list: async () => ({ data: [], error: null }),
  download: async () => ({ data: null, error: demoError() }),
  move: async () => ({ data: null, error: demoError() }),
  copy: async () => ({ data: null, error: demoError() }),
  createSignedUrl: async () => ({ data: null, error: demoError() }),
  createSignedUrls: async () => ({ data: [], error: null }),
  createSignedUploadUrl: async () => ({ data: null, error: demoError() }),
  getPublicUrl: (path: string) => ({ data: { publicUrl: path.startsWith("http") ? path : "" } }),
});

export const supabase = {
  from: (table: string) => new QueryBuilder(database(), table),
  schema: () => ({ from: (table: string) => new QueryBuilder(database(), table), rpc: (name: string, args?: Record<string, unknown>) => supabase.rpc(name, args) }),
  rpc: (name: string, args: Record<string, unknown> = {}) => {
    const handler = database().rpcs[name];
    const run = async () => {
      if (handler) return { data: handler(args, database()), error: null, count: null, status: 200 };
      if (blockedRpc.test(name)) return { data: null, error: demoError(), count: null, status: 403 };
      return { data: /^(get|list)_/.test(name) ? [] : null, error: null, count: null, status: 200 };
    };
    const promise = run();
    const chain = { then: promise.then.bind(promise), single: () => chain, maybeSingle: () => chain, select: () => chain, abortSignal: () => chain, returns: () => chain, throwOnError: () => chain, eq: () => chain, order: () => chain, limit: () => chain, range: () => chain };
    return chain;
  },
  functions: {
    invoke: async (name: string) => {
      // Segment counts are recalculated in the browser; report success without sending anything.
      if (/^(evaluate-(customer-)?segments|recompute-segment-memberships|recompute-campaign-metrics)$/.test(name)) return { data: { success: true, demo: true }, error: null };
      if (name === "check-subscription") return { data: { subscribed: true, subscription_tier: "Bloom", subscription_end: null, demo: true }, error: null };
      return { data: null, error: demoError(/ai|generate|enhance|thinking|insight|regenerate|analyze/.test(name) ? "AI generation is turned off in the demo. Try the sample content instead." : DEMO_BLOCKED) };
    },
    setAuth: () => undefined,
  },
  storage: { from: storageBucket, listBuckets: async () => ({ data: [], error: null }) },
  auth,
  channel,
  removeChannel: async () => "ok",
  removeAllChannels: async () => [],
  getChannels: () => [],
  realtime: { setAuth: () => undefined },
};

export const isImpersonationTab = false;
export const hasPersistedAuthState = () => true;
export const endImpersonationTab = async () => undefined;
export const cleanupAuthState = () => undefined;
export const forceLogout = async () => undefined;
export const signOutCompletely = async () => undefined;
export const signInWithCleanup = async () => ({ data: { user: null, session: null }, error: demoError("Sign-in is not part of the demo.") });
export const signUpWithCleanup = async () => ({ data: { user: null, session: null }, error: demoError("Sign-up is not part of the demo.") });

export function resetShowroomDatabase() { db = null; }
