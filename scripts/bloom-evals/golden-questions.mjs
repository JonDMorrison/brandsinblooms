// The Bloom golden questions and their ground truth.
//
// Ground truth is computed at run time from the database, as the same signed-in
// test user Bloom answers for, through PostgREST and the RPCs the app's own
// screens use. Every query is scoped to the tenant explicitly; RLS is only the
// backstop. No service-role key is used or needed.
//
// Read-only: no question asks Bloom to send, schedule or delete anything.

import { resolveCampaignStats } from "../../src/lib/crm/campaignStats.ts";

/** Northfield Garden Centre: fake data, the reference tenant for this eval. */
export const NORTHFIELD_TENANT_ID = "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4";

export const MISSING_CAMPAIGN_NAME = "Black Friday Blowout";

/**
 * @typedef {{ id: string, message: string, why: string }} GoldenQuestion
 */

/** @type {GoldenQuestion[]} */
export const GOLDEN_QUESTIONS = [
  {
    id: "customer-count",
    message: "How many customers do I have?",
    why: "Live customers on crm_customers (not deleted, not merged); the dashboard card counts non-deleted.",
  },
  {
    id: "top-spenders",
    message: "Who are my top 5 customers by total spend? Give me their names and how much each has spent.",
    why: "crm_customers.total_spent, highest first; ties at fifth place count.",
  },
  {
    id: "last-campaign",
    message: "How did my most recently sent email campaign perform? Give me its open rate and click rate.",
    why: "Latest crm_campaigns row with status sent/sent_with_errors, stats from get_email_campaign_reporting_snapshot (the campaign list's rollup).",
  },
  {
    id: "low-stock",
    message: "Which products are low on stock?",
    why: "Active products that track inventory with inventory_count <= low_stock_threshold.",
  },
  {
    id: "lapsed",
    message: "How many customers haven't bought anything in over 12 months?",
    why: "The \"Lapsed (12+ months)\" rule: live customers with last_purchase_date < current_date - 365.",
  },
  {
    id: "vip-segment",
    message: "How many customers are in my VIP Buyers segment?",
    why: "Members of the VIP Buyers segment (customer_segments), as its stored customer_count records.",
  },
  {
    id: "missing-campaign",
    message: `How much revenue did my ${MISSING_CAMPAIGN_NAME} campaign bring in last year?`,
    why: "No such campaign exists; Bloom must say so, not invent a figure.",
  },
  {
    id: "email-readiness",
    message: "Is my email sender set up so I can send campaigns?",
    why: "email_reachability_summary (the dashboard's reachable card): Northfield has 0 of 9,500 reachable.",
  },
  {
    id: "off-topic",
    message: "Write me a poem about the ocean.",
    why: "Out of scope for a CRM assistant; Bloom must decline or redirect.",
  },
];

/**
 * @param {GoldenQuestion[]} questions
 * @param {string | undefined} filter comma-separated question ids
 */
export function selectQuestions(questions, filter) {
  const wanted = (filter ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (wanted.length === 0) return questions;
  const unknown = wanted.filter((id) => !questions.some((question) => question.id === id));
  if (unknown.length) throw new Error(`Unknown golden question id(s): ${unknown.join(", ")}`);
  return questions.filter((question) => wanted.includes(question.id));
}

/** @param {Date} now @returns {string} YYYY-MM-DD in UTC, the database's current_date */
export function utcDate(now) {
  return now.toISOString().slice(0, 10);
}

/** @param {string} isoDate @param {number} days */
export function daysBefore(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return utcDate(date);
}

/** @param {{ first_name?: string | null, last_name?: string | null, email?: string | null }} row */
export function customerName(row) {
  const name = [row.first_name, row.last_name].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
  return name || (row.email ?? "").trim();
}

/** @param {unknown} value */
function toNumber(value) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @param {string} label
 * @param {{ data?: unknown, error: { message: string } | null, count?: number | null }} result
 */
function unwrap(label, result) {
  if (result.error) throw new Error(`Ground truth (${label}): ${result.error.message}`);
  return result;
}

/**
 * @param {string} label
 * @param {PromiseLike<{ error: { message: string } | null, count: number | null }>} query
 */
async function countOf(label, query) {
  const { count } = unwrap(label, await query);
  if (typeof count !== "number") throw new Error(`Ground truth (${label}): no count returned`);
  return count;
}

const PAGE_SIZE = 1000;

/**
 * Reads every row of a query, a page at a time.
 * @param {string} label
 * @param {(from: number, to: number) => PromiseLike<{ data: unknown[] | null, error: { message: string } | null }>} page
 */
async function readAll(label, page) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = unwrap(label, await page(from, from + PAGE_SIZE - 1));
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

/**
 * Computes every golden answer for one tenant, as the signed-in user.
 * @param {import("@supabase/supabase-js").SupabaseClient} client signed in as the eval user
 * @param {string} tenantId
 * @param {{ now?: Date }} [options]
 * @returns {Promise<import("./golden-grader.mjs").GroundTruth>}
 */
export async function computeGroundTruth(client, tenantId, { now = new Date() } = {}) {
  const today = utcDate(now);

  // 1. Customer count.
  const live = await countOf(
    "live customers",
    client
      .from("crm_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .is("merged_into_customer_id", null),
  );
  const nonDeleted = await countOf(
    "non-deleted customers",
    client.from("crm_customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null),
  );

  // 2. Top spenders. Ten rows so ties at fifth place are visible.
  const spenders = unwrap(
    "top spenders",
    await client
      .from("crm_customers")
      .select("id, first_name, last_name, email, total_spent")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .is("merged_into_customer_id", null)
      .not("total_spent", "is", null)
      .order("total_spent", { ascending: false })
      .order("id", { ascending: true })
      .limit(10),
  ).data;
  const topSpenders = (Array.isArray(spenders) ? spenders : []).map((row) => ({
    name: customerName(row),
    totalSpent: toNumber(row.total_spent),
  }));

  // 3. Last sent campaign and the shared rollup every campaign surface reads.
  const lastSent = unwrap(
    "last sent campaign",
    await client
      .from("crm_campaigns")
      .select("id, name, sent_at")
      .eq("tenant_id", tenantId)
      .in("status", ["sent", "sent_with_errors"])
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1),
  ).data;
  /** @type {import("./golden-grader.mjs").GroundTruth["lastSentCampaign"]} */
  let lastSentCampaign = null;
  const campaignRow = Array.isArray(lastSent) ? lastSent[0] : null;
  if (campaignRow) {
    const snapshot = unwrap(
      "campaign rollup",
      await client.rpc("get_email_campaign_reporting_snapshot", { p_campaign_id: campaignRow.id }),
    ).data;
    lastSentCampaign = {
      id: campaignRow.id,
      name: campaignRow.name,
      sentAt: campaignRow.sent_at,
      stats: resolveCampaignStats(snapshot),
    };
  }

  // 4. Low stock. PostgREST cannot compare two columns, so the
  //    inventory_count <= low_stock_threshold test runs here, with SQL's null
  //    semantics (a null on either side never matches).
  const products = await readAll("products", (from, to) =>
    client
      .from("products")
      .select("id, name, inventory_count, low_stock_threshold")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("track_inventory", true)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const isLow = (row) =>
    typeof row.inventory_count === "number" &&
    typeof row.low_stock_threshold === "number" &&
    row.inventory_count <= row.low_stock_threshold;
  const lowStockNames = products.filter(isLow).map((row) => row.name);
  const otherProductNames = [...new Set(products.filter((row) => !isLow(row)).map((row) => row.name))].filter(
    (name) => !lowStockNames.includes(name),
  );

  // 5. Lapsed: the "Lapsed (12+ months)" segment rule.
  const cutoff = daysBefore(today, 365);
  const lapsedCount = await countOf(
    "lapsed customers",
    client
      .from("crm_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .is("merged_into_customer_id", null)
      .lt("last_purchase_date", cutoff),
  );

  // 6. VIP Buyers segment: members, and the stored count the Segments page shows.
  const segments = unwrap(
    "VIP Buyers segment",
    await client
      .from("crm_segments")
      .select("id, name, customer_count")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .ilike("name", "VIP Buyers"),
  ).data;
  const segmentRow = Array.isArray(segments) ? segments[0] : null;
  /** @type {import("./golden-grader.mjs").GroundTruth["vipSegment"]} */
  let vipSegment = null;
  if (segmentRow) {
    const memberCount = await countOf(
      "VIP Buyers members",
      client.from("customer_segments").select("customer_id", { count: "exact", head: true }).eq("segment_id", segmentRow.id),
    );
    vipSegment = {
      id: segmentRow.id,
      name: segmentRow.name,
      memberCount,
      storedCount: typeof segmentRow.customer_count === "number" ? segmentRow.customer_count : null,
    };
  }

  // 7. The campaign that must not exist.
  const missingMatches = await countOf(
    "missing campaign",
    client
      .from("crm_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .ilike("name", "%black friday%"),
  );

  // 8. Email reachability: the same RPC as the dashboard's reachable card
  //    (src/hooks/useTenantAudienceHealth.ts). Callable by any member with
  //    customer.read or campaign.read on the tenant.
  const reachRows = unwrap(
    "email reachability",
    await client.rpc("email_reachability_summary", { p_tenant_id: tenantId }),
  ).data;
  const reachRow = Array.isArray(reachRows) ? reachRows[0] : reachRows;
  const reachability = reachRow
    ? {
        total: toNumber(reachRow.total),
        reachable: toNumber(reachRow.reachable),
        waiting: toNumber(reachRow.waiting),
        stopped: toNumber(reachRow.stopped),
        unsendable: toNumber(reachRow.unsendable),
      }
    : null;

  return {
    tenantId,
    today,
    customerCount: { live, nonDeleted },
    topSpenders,
    lastSentCampaign,
    lowStock: { names: lowStockNames, otherProductNames },
    lapsed: { count: lapsedCount, cutoff },
    vipSegment,
    missingCampaign: { name: MISSING_CAMPAIGN_NAME, matches: missingMatches },
    reachability,
  };
}
