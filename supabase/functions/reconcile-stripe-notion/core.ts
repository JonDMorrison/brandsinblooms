// Dependency-free reconciliation policy. No customer mutations belong here.
type Customer = { id: string; email?: string | null };
type Page = {
  id: string;
  external: string;
  email?: string | null;
  stage?: string | null;
};
type Subscription = { status: string };
type Invoice = {
  id: string;
  status: string;
  amount_remaining: number;
  amount_paid: number;
  currency: string;
};
type Mapping = { notion_page_id: string };
export const payingStages = [
  "Won",
  "Account Setup & Welcome",
  "Onboarding & Setup",
  "Active",
];
export function identity(customer: Customer, pages: Page[], mapping?: Mapping) {
  const exact = pages.filter((p) => p.external === customer.id);
  if (mapping) {
    const page = pages.find((p) =>
      p.id.replaceAll("-", "") === mapping.notion_page_id.replaceAll("-", "")
    );
    if (
      !page || (page.external && page.external !== customer.id) ||
      exact.some((p) => p.id !== page.id)
    ) {
      return { issue: "identity_conflict" };
    }
    return { page };
  }
  if (exact.length === 1) return { page: exact[0] };
  if (exact.length > 1) return { issue: "identity_conflict" };
  const candidates = pages.filter((p) =>
    customer.email && p.email?.toLowerCase() === customer.email.toLowerCase()
  );
  return {
    issue: candidates.length ? "identity_review" : "identity_unmatched",
  };
}
export function assess(
  customer: Customer,
  subscriptions: Subscription[],
  invoices: Invoice[],
  pages: Page[],
  mapping?: Mapping,
) {
  const match = identity(customer, pages, mapping);
  const stage = match.page?.stage || "UNMATCHED";
  const statuses = [...new Set(subscriptions.map((s) => s.status))].sort().join(
    ",",
  );
  const issues: {
    stripe_customer_id: string;
    customer_email: string | null;
    stripe_status: string;
    notion_stage: string;
    mismatch_type: string;
    detail: string;
  }[] = [];
  const add = (type: string, detail: string) =>
    issues.push({
      stripe_customer_id: customer.id,
      customer_email: customer.email || null,
      stripe_status: statuses,
      notion_stage: stage,
      mismatch_type: type,
      detail,
    });
  if (match.issue) {
    add(
      match.issue,
      "Review stable customer identifiers; email candidates are never linked automatically.",
    );
  }
  const active = subscriptions.some((s) => s.status === "active");
  const continuing = subscriptions.some((s) =>
    ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]
      .includes(s.status)
  );
  if (match.page && active && !payingStages.includes(stage)) {
    add(
      "active_wrong_stage",
      `Active subscription with pipeline stage ${stage}; review lifecycle separately from billing.`,
    );
  }
  if (
    match.page && !continuing &&
    subscriptions.some((s) => s.status === "canceled") &&
    payingStages.includes(stage)
  ) {
    add(
      "cancelled_still_active",
      "All subscriptions ended; review customer status. No automatic churn.",
    );
  }
  if (
    subscriptions.some((s) =>
      ["past_due", "unpaid", "incomplete"].includes(s.status)
    )
  ) {
    add("subscription_payment_attention", "Subscription payment needs review.");
  }
  const outstanding = invoices.filter((i) =>
    ["open", "uncollectible"].includes(i.status) && i.amount_remaining > 0
  )
    .map((i) =>
      `${i.id}: ${i.status}, ${i.amount_remaining} ${i.currency} minor units`
    ).sort();
  if (outstanding.length) add("outstanding_invoice", outstanding.join("; "));
  if (
    active && !invoices.some((i) => i.status === "paid" && i.amount_paid > 0)
  ) {
    add(
      "payment_unverified",
      "Active subscription found, but no paid nonzero invoice was found.",
    );
  }
  return issues;
}
export async function stripeList(
  get: (path: string) => Promise<any>,
  path: string,
  params: Record<string, string> = {},
) {
  const all = [];
  let cursor;
  do {
    const q = new URLSearchParams({
      ...params,
      limit: "100",
      ...(cursor ? { starting_after: cursor } : {}),
    });
    const r = await get(`${path}?${q}`);
    if (!Array.isArray(r.data) || typeof r.has_more !== "boolean") {
      throw new Error("Incomplete Stripe list response");
    }
    all.push(...r.data);
    if (!r.has_more) break;
    const next = r.data.at(-1)?.id;
    if (!next || next === cursor) throw new Error("Invalid Stripe pagination");
    cursor = next;
  } while (true);
  return all;
}
