import {
  moneyMinorUnits,
  type GrowthOrder,
} from "../customer-intelligence/customer-growth.ts";
import {
  assertDate,
  localDate,
} from "../customer-intelligence/purchase-exploration.ts";

/** Recorded facts only. A coverage assertion is a reviewed statement, not an AI inference. */
export interface MeasurementWindow {
  start: string;
  end: string;
}
export interface CoverageReview {
  status: "unverified" | "reviewed_complete";
  evidence: string;
  reviewedAt: string | null;
}
export interface MeasurementSettings {
  currency: "CAD" | "USD" | "GBP" | "EUR";
  timezone: string;
  spendWeight: number;
  transactionsWeight: number;
}
export interface MeasurementCustomer {
  id: string;
  created_at: string | null;
  email_opt_in: boolean | null;
  opt_out: boolean | null;
  suppressed: boolean | null;
  merged_into_customer_id?: string | null;
  deleted_at?: string | null;
}
export interface EnrollmentFact {
  customer_id: string;
  tenant_id: string;
  perks_enrolled_at: string | null;
  is_perks_member: boolean | null;
}
export interface MessageFact {
  id: string;
  tenant_id: string;
  customer_id: string;
  campaign_id: string;
  sent_at: string | null;
}
export interface OrderEvidence {
  id: string;
  date: string;
  netMinor: number;
  grossMinor: number;
  refundMinor: number;
  originalTimestamp: string;
}
export interface CustomerPeriod {
  customerId: string;
  recordedSpendMinor: number;
  recordedTransactions: number;
  knownEarlierTransactions: number;
  orders: OrderEvidence[];
  missingOrderIds: string[];
  otherCurrencyOrders: number;
  accessible: boolean;
}
export interface PeriodSnapshot {
  version: 1;
  tenantId: string;
  window: MeasurementWindow;
  settings: MeasurementSettings;
  sourceCutoff: string;
  coverage: CoverageReview;
  customers: CustomerPeriod[];
  unlinkedOrderIds: string[];
  ignoredOrderIds: string[];
  excludedFutureOrderIds: string[];
  populationCount: number;
}
export interface ProgrammeBaseline {
  version: 1;
  period: PeriodSnapshot;
  capturedEmailConsentCount: number;
  capturedMemberCount: number;
  membershipDatesMissing: number;
}
export type MeasurementState =
  | "growing"
  | "stable"
  | "declining"
  | "lapsed"
  | "reactivated"
  | "newly_observed"
  | "no_baseline"
  | "unknown"
  | "identity_review";
export interface CustomerComparison {
  customerId: string;
  /** Presentation-only current name, never used in measurement or identity matching. */
  displayName?: string;
  baselineSpendMinor: number;
  currentSpendMinor: number;
  baselineTransactions: number;
  currentTransactions: number;
  spendChangePercent: number | null;
  transactionChangePercent: number | null;
  growthChangePercent: number | null;
  growthIndex: number | null;
  state: MeasurementState;
  reason: string;
  baselineEvidenceIds: string[];
  currentEvidenceIds: string[];
  missingOrderIds: string[];
  otherCurrencyOrders: number;
  receivedCampaign: boolean;
  purchasedAfterMessage: boolean;
  postMessageSpendMinor: number;
}
const accepted = new Set([
  "completed",
  "paid",
  "fulfilled",
  "partially_refunded",
  "refunded",
]);
const ignored = new Set([
  "draft",
  "pending",
  "failed",
  "void",
  "voided",
  "canceled",
  "cancelled",
]);
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const safeAdd = (a: number, b: number) => {
  const n = a + b;
  if (!Number.isSafeInteger(n))
    throw new Error("The recorded total exceeds the exact arithmetic limit.");
  return n;
};
function stamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  try {
    assertDate(value.slice(0, 10));
    return true;
  } catch {
    return false;
  }
}
export function measurementDays(w: MeasurementWindow): number {
  assertDate(w.start);
  assertDate(w.end);
  if (w.end < w.start)
    throw new Error("The end date must not precede the start date.");
  return (
    (Date.parse(w.end + "T00:00:00Z") - Date.parse(w.start + "T00:00:00Z")) /
      86_400_000 +
    1
  );
}
export function validateMeasurementSettings(s: MeasurementSettings): void {
  if (!["CAD", "USD", "GBP", "EUR"].includes(s.currency))
    throw new Error("Choose a supported single currency.");
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: s.timezone }).format(0);
  } catch {
    throw new Error("Choose a valid business timezone.");
  }
  if (
    ![s.spendWeight, s.transactionsWeight].every(
      (w) => Number.isInteger(w) && w >= 0 && w <= 100,
    ) ||
    s.spendWeight + s.transactionsWeight === 0
  ) {
    throw new Error(
      "Use weights from 0 to 100 with a positive combined weight.",
    );
  }
}
function checkCoverage(coverage: CoverageReview, cutoff: string) {
  if (
    !["unverified", "reviewed_complete"].includes(coverage.status) ||
    typeof coverage.evidence !== "string" ||
    coverage.evidence.length > 2000
  )
    throw new Error("Invalid coverage review.");
  if (
    coverage.status === "reviewed_complete" &&
    (!stamp(coverage.reviewedAt) ||
      Date.parse(coverage.reviewedAt) > Date.parse(cutoff) ||
      coverage.evidence.trim().length < 8)
  ) {
    throw new Error(
      "Complete coverage requires a dated review and an evidence description.",
    );
  }
}
/** Freeze amounts and contributing order evidence. Later edits to the ledger cannot rewrite this snapshot. */
export function capturePeriod(
  orders: GrowthOrder[],
  cohort: string[],
  accessibleCustomerIds: string[],
  tenantId: string,
  window: MeasurementWindow,
  settings: MeasurementSettings,
  sourceCutoff: string,
  coverage: CoverageReview,
): PeriodSnapshot {
  validateMeasurementSettings(settings);
  measurementDays(window);
  if (
    !stamp(sourceCutoff) ||
    window.end > (localDate(sourceCutoff, settings.timezone) ?? "")
  )
    throw new Error("The report cannot extend beyond its source cutoff.");
  checkCoverage(coverage, sourceCutoff);
  if (
    !tenantId ||
    cohort.length > 100000 ||
    new Set(cohort).size !== cohort.length ||
    cohort.some((id) => typeof id !== "string" || !id)
  )
    throw new Error("Use a unique, bounded, explicit customer cohort.");
  const accessible = new Set(accessibleCustomerIds),
    ids = new Set(cohort);
  const rows = new Map<string, CustomerPeriod>(
    cohort.map((id) => [
      id,
      {
        customerId: id,
        recordedSpendMinor: 0,
        recordedTransactions: 0,
        knownEarlierTransactions: 0,
        orders: [],
        missingOrderIds: [],
        otherCurrencyOrders: 0,
        accessible: accessible.has(id),
      },
    ]),
  );
  const unlinkedOrderIds: string[] = [],
    ignoredOrderIds: string[] = [],
    excludedFutureOrderIds: string[] = [];
  const seen = new Map<string, string>();
  for (const order of orders) {
    if (order.tenant_id !== tenantId)
      throw new Error("Cross-company order rejected.");
    const serial = JSON.stringify(order);
    if (seen.has(order.id)) {
      if (seen.get(order.id) !== serial)
        throw new Error(
          "Conflicting copies of an order. Retry after reconciliation.",
        );
      continue;
    }
    seen.set(order.id, serial);
    const day = stamp(order.order_date)
      ? localDate(order.order_date, settings.timezone)
      : null;
    // Invalid dates are not silently discarded; they may belong in this window.
    if (day && day > window.end) continue;
    if (
      stamp(order.created_at) &&
      Date.parse(order.created_at) > Date.parse(sourceCutoff)
    ) {
      excludedFutureOrderIds.push(order.id);
      continue;
    }
    if (!order.crm_customer_id) {
      if (!day || day >= window.start) unlinkedOrderIds.push(order.id);
      continue;
    }
    if (!ids.has(order.crm_customer_id)) continue;
    const row = rows.get(order.crm_customer_id)!;
    if (!row.accessible) continue;
    const status = order.status?.toLowerCase();
    if (ignored.has(status ?? "")) {
      ignoredOrderIds.push(order.id);
      continue;
    }
    if (!accepted.has(status ?? "") || !day || !stamp(order.created_at)) {
      row.missingOrderIds.push(order.id);
      continue;
    }
    if (!order.currency) {
      row.missingOrderIds.push(order.id);
      continue;
    }
    if (order.currency.toUpperCase() !== settings.currency) {
      if (day >= window.start) row.otherCurrencyOrders++;
      continue;
    }
    const gross = moneyMinorUnits(order.total_amount);
    const refund =
      order.refund_amount === null &&
      status !== "refunded" &&
      status !== "partially_refunded"
        ? 0
        : moneyMinorUnits(order.refund_amount);
    if (
      gross === null ||
      refund === null ||
      gross < 0 ||
      refund < 0 ||
      refund > gross ||
      (status === "refunded" && refund !== gross)
    ) {
      row.missingOrderIds.push(order.id);
      continue;
    }
    // A free or completely returned order is visible as evidence but is not a retained purchasing transaction.
    const net = gross - refund;
    if (day < window.start) {
      if (net > 0) row.knownEarlierTransactions++;
      continue;
    }
    row.orders.push({
      id: order.id,
      date: day,
      originalTimestamp: order.order_date,
      grossMinor: gross,
      refundMinor: refund,
      netMinor: net,
    });
    row.recordedSpendMinor = safeAdd(row.recordedSpendMinor, net);
    if (net > 0) row.recordedTransactions++;
  }
  return {
    version: 1,
    tenantId,
    window: { ...window },
    settings: { ...settings },
    sourceCutoff,
    coverage: { ...coverage },
    customers: [...rows.values()],
    populationCount: cohort.length,
    unlinkedOrderIds,
    ignoredOrderIds,
    excludedFutureOrderIds,
  };
}
export function captureProgrammeBaseline(
  period: PeriodSnapshot,
  contacts: MeasurementCustomer[],
  enrollments: EnrollmentFact[],
): ProgrammeBaseline {
  const ids = new Set(period.customers.map((c) => c.customerId));
  const allowed = contacts.filter(
    (c) => ids.has(c.id) && !c.deleted_at && !c.merged_into_customer_id,
  );
  const seen = new Set<string>();
  for (const e of enrollments) {
    if (e.tenant_id !== period.tenantId)
      throw new Error("Cross-company membership rejected.");
    if (seen.has(e.customer_id))
      throw new Error("Duplicate membership profile requires reconciliation.");
    seen.add(e.customer_id);
  }
  const members = enrollments.filter(
    (e) => ids.has(e.customer_id) && e.is_perks_member === true,
  );
  return {
    version: 1,
    period,
    capturedEmailConsentCount: allowed.filter(
      (c) =>
        c.email_opt_in === true &&
        c.opt_out === false &&
        c.suppressed === false,
    ).length,
    capturedMemberCount: members.length,
    membershipDatesMissing: members.filter((e) => !stamp(e.perks_enrolled_at))
      .length,
  };
}
export function compareProgrammePeriod(
  baseline: ProgrammeBaseline,
  current: PeriodSnapshot,
  contacts: MeasurementCustomer[],
  enrollments: EnrollmentFact[],
  messages: MessageFact[],
  normalizeDaily: boolean,
) {
  const before = baseline.period;
  if (
    before.tenantId !== current.tenantId ||
    before.settings.currency !== current.settings.currency ||
    before.settings.timezone !== current.settings.timezone
  )
    throw new Error(
      "Compare the same company, currency and business timezone.",
    );
  if (
    before.settings.spendWeight !== current.settings.spendWeight ||
    before.settings.transactionsWeight !== current.settings.transactionsWeight
  )
    throw new Error(
      "Programme weights are frozen with the baseline. Create a new version to change them.",
    );
  if (before.window.end >= current.window.start)
    throw new Error("Use non-overlapping baseline and comparison windows.");
  const oldDays = measurementDays(before.window),
    newDays = measurementDays(current.window);
  if (oldDays !== newDays && !normalizeDaily)
    throw new Error(
      "Use equal-length periods or explicitly compare daily rates.",
    );
  const oldIds = before.customers.map((c) => c.customerId),
    currentRows = new Map(current.customers.map((c) => [c.customerId, c]));
  if (
    currentRows.size !== oldIds.length ||
    oldIds.some((id) => !currentRows.has(id))
  )
    throw new Error("The original programme cohort must remain intact.");
  const messageTimes = new Map<string, number>();
  const msgIds = new Map<string, string>();
  for (const m of messages) {
    if (m.tenant_id !== before.tenantId)
      throw new Error("Cross-company campaign message rejected.");
    if (msgIds.has(m.id) && msgIds.get(m.id) !== JSON.stringify(m))
      throw new Error("Conflicting campaign evidence.");
    msgIds.set(m.id, JSON.stringify(m));
    if (!stamp(m.sent_at)) continue;
    const time = Date.parse(m.sent_at),
      day = localDate(m.sent_at, current.settings.timezone);
    if (
      !day ||
      day > current.window.end ||
      time > Date.parse(current.sourceCutoff) ||
      !currentRows.has(m.customer_id)
    )
      continue;
    messageTimes.set(
      m.customer_id,
      Math.min(messageTimes.get(m.customer_id) ?? Infinity, time),
    );
  }
  const complete =
    before.coverage.status === "reviewed_complete" &&
    current.coverage.status === "reviewed_complete" &&
    before.unlinkedOrderIds.length === 0 &&
    current.unlinkedOrderIds.length === 0;
  const factorBefore = normalizeDaily ? oldDays : 1,
    factorCurrent = normalizeDaily ? newDays : 1;
  const percent = (a: number, b: number) =>
    b > 0 ? round((a / factorCurrent / (b / factorBefore) - 1) * 100) : null;
  const rows: CustomerComparison[] = before.customers.map((b) => {
    const c = currentRows.get(b.customerId)!;
    const missingOrderIds = [
      ...new Set([...b.missingOrderIds, ...c.missingOrderIds]),
    ];
    const identityReview = !b.accessible || !c.accessible;
    const reliable =
      complete && !identityReview && missingOrderIds.length === 0;
    const spend = reliable
      ? percent(c.recordedSpendMinor, b.recordedSpendMinor)
      : null;
    const frequency = reliable
      ? percent(c.recordedTransactions, b.recordedTransactions)
      : null;
    const terms: [number, number | null][] = [
      [before.settings.spendWeight, spend],
      [before.settings.transactionsWeight, frequency],
    ];
    const chosen = terms.filter(([weight]) => weight > 0);
    const growth = chosen.every(([, value]) => value !== null)
      ? round(
          chosen.reduce((sum, [weight, value]) => sum + weight * value!, 0) /
            chosen.reduce((sum, [weight]) => sum + weight, 0),
        )
      : null;
    let state: MeasurementState = "unknown";
    let reason =
      "Source coverage or required order fields are incomplete. Recorded amounts are not a claim of complete spending.";
    if (identityReview) {
      state = "identity_review";
      reason =
        "An original cohort member was merged, deleted or is no longer accessible. The denominator has not been silently changed.";
    } else if (reliable) {
      if (b.recordedTransactions > 0 && c.recordedTransactions === 0)
        state = "lapsed";
      else if (b.recordedTransactions === 0 && c.recordedTransactions > 0)
        state =
          b.knownEarlierTransactions > 0 ? "reactivated" : "newly_observed";
      else if (growth === null) state = "no_baseline";
      else state = growth > 0 ? "growing" : growth < 0 ? "declining" : "stable";
      reason =
        growth === null
          ? "No positive baseline for every selected measure; no percentage was fabricated."
          : "Same customer, frozen baseline, recorded net spending and completed purchasing transactions.";
    }
    const received = messageTimes.get(b.customerId);
    const post =
      received === undefined
        ? []
        : c.orders.filter(
            (o) => Date.parse(o.originalTimestamp) > received && o.netMinor > 0,
          );
    return {
      customerId: b.customerId,
      baselineSpendMinor: b.recordedSpendMinor,
      currentSpendMinor: c.recordedSpendMinor,
      baselineTransactions: b.recordedTransactions,
      currentTransactions: c.recordedTransactions,
      spendChangePercent: spend,
      transactionChangePercent: frequency,
      growthChangePercent: growth,
      growthIndex: growth === null ? null : round(100 + growth),
      state,
      reason,
      baselineEvidenceIds: b.orders.map((o) => o.id),
      currentEvidenceIds: c.orders.map((o) => o.id),
      missingOrderIds,
      otherCurrencyOrders: b.otherCurrencyOrders + c.otherCurrencyOrders,
      receivedCampaign: received !== undefined,
      purchasedAfterMessage: post.length > 0,
      postMessageSpendMinor: post.reduce(
        (sum, o) => safeAdd(sum, o.netMinor),
        0,
      ),
    };
  });
  const cohort = new Set(oldIds),
    validContacts = contacts.filter(
      (c) => cohort.has(c.id) && !c.deleted_at && !c.merged_into_customer_id,
    );
  for (const e of enrollments)
    if (e.tenant_id !== before.tenantId)
      throw new Error("Cross-company membership rejected.");
  const enrolled = new Set(
    enrollments
      .filter(
        (e) =>
          stamp(e.perks_enrolled_at) &&
          (localDate(e.perks_enrolled_at!, current.settings.timezone) ?? "") >=
            current.window.start &&
          (localDate(e.perks_enrolled_at!, current.settings.timezone) ?? "") <=
            current.window.end &&
          Date.parse(e.perks_enrolled_at!) <= Date.parse(current.sourceCutoff),
      )
      .map((e) => e.customer_id),
  );
  const scored = rows.filter((r) => r.growthChangePercent !== null);
  const established = rows.filter(
    (r) =>
      r.baselineTransactions > 0 &&
      !["unknown", "identity_review"].includes(r.state),
  );
  const retained = established.filter((r) => r.currentTransactions > 0);
  const contacted = rows.filter((r) => r.receivedCampaign);
  return {
    version: 1,
    kind: "loyalty_programme_result",
    tenantId: current.tenantId,
    baselineCutoff: before.sourceCutoff,
    sourceCutoff: current.sourceCutoff,
    baselineWindow: before.window,
    currentWindow: current.window,
    settings: before.settings,
    normalizeDaily,
    rows,
    summary: {
      originalCohort: rows.length,
      comparableCustomers: scored.length,
      unscoredCustomers: rows.length - scored.length,
      meanCustomerGrowthPercent: scored.length
        ? round(
            scored.reduce((sum, r) => sum + r.growthChangePercent!, 0) /
              scored.length,
          )
        : null,
      establishedCustomers: established.length,
      retainedCustomers: retained.length,
      retentionPercent: established.length
        ? round((retained.length / established.length) * 100)
        : null,
      lapsedCustomers: rows.filter((r) => r.state === "lapsed").length,
      reactivatedCustomers: rows.filter((r) => r.state === "reactivated")
        .length,
      newlyObservedBuyers: rows.filter((r) => r.state === "newly_observed")
        .length,
      unknownCustomers: rows.filter((r) =>
        ["unknown", "identity_review"].includes(r.state),
      ).length,
      recordedBaselineSpendMinor: rows.reduce(
        (sum, r) => safeAdd(sum, r.baselineSpendMinor),
        0,
      ),
      recordedCurrentSpendMinor: rows.reduce(
        (sum, r) => safeAdd(sum, r.currentSpendMinor),
        0,
      ),
      cohortEmailConsentAtBaseline: baseline.capturedEmailConsentCount,
      cohortEmailConsentNow: validContacts.filter(
        (c) =>
          c.email_opt_in === true &&
          c.opt_out === false &&
          c.suppressed === false,
      ).length,
      recordedNewEnrollmentsAllCustomers: enrolled.size,
      contactedCustomers: contacted.length,
      customersPurchasingAfterMessage: contacted.filter(
        (r) => r.purchasedAfterMessage,
      ).length,
      recordedPostMessageSpendMinor: rows.reduce(
        (sum, r) => safeAdd(sum, r.postMessageSpendMinor),
        0,
      ),
    },
    coverage: {
      baseline: before.coverage,
      current: current.coverage,
      unlinkedBaselineOrders: before.unlinkedOrderIds.length,
      unlinkedCurrentOrders: current.unlinkedOrderIds.length,
    },
    limitations: [
      "Subsequent purchases are observed outcomes, not proof that a campaign caused them.",
      "A transaction is a recorded positive-net completed order; fully returned and zero-value orders are not counted as purchasing transactions.",
      "Refunds reduce the original order at the snapshot cutoff. Later source changes never rewrite the saved baseline.",
      "Recorded enrolments are distinct from new database records. Missing enrolment dates remain unknown.",
      "Other currencies are reported separately; no exchange rate or profit margin is assumed.",
    ],
  };
}
export type ProgrammeResult = ReturnType<typeof compareProgrammePeriod>;
