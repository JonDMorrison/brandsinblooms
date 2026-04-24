export interface SegmentRuleCondition {
  id?: string;
  kind?: "rule";
  fieldId?: string | null;
  field?: string | null;
  operatorId?: string | null;
  operator?: string | null;
  value: unknown;
}

export interface SegmentRuleGroup {
  id?: string;
  kind?: "group";
  operator?: "AND" | "OR";
  logic?: "AND" | "OR";
  children?: SegmentRuleNode[];
  conditions?: SegmentRuleCondition[];
}

export type SegmentRuleNode = SegmentRuleCondition | SegmentRuleGroup;

export interface SegmentEvaluationContext {
  customerSegmentsByCustomerId?: Map<string, Set<string>>;
}

interface SegmentBetweenValue {
  min?: number | string | null;
  max?: number | string | null;
}

interface SegmentRelativeDateValue {
  amount: number;
  unit: "days" | "weeks" | "months";
}

function normalizeString(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    if ("amount" in (value as Record<string, unknown>)) {
      return Number((value as SegmentRelativeDateValue).amount) > 0;
    }

    if (
      "min" in (value as Record<string, unknown>) ||
      "max" in (value as Record<string, unknown>)
    ) {
      const range = value as SegmentBetweenValue;
      return hasValue(range.min) && hasValue(range.max);
    }
  }

  return true;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  if (value === null || value === undefined || value === "") {
    return [];
  }

  return [String(value)];
}

function daysBetween(left: Date, right: Date) {
  return Math.floor((left.getTime() - right.getTime()) / 86400000);
}

function subtractRelativeDate(value: SegmentRelativeDateValue) {
  const amount = Number(value.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const date = new Date();
  if (value.unit === "months") {
    date.setMonth(date.getMonth() - amount);
    return date;
  }

  if (value.unit === "weeks") {
    date.setDate(date.getDate() - amount * 7);
    return date;
  }

  date.setDate(date.getDate() - amount);
  return date;
}

function getCustomerLifecycleStage(customer: Record<string, unknown>) {
  if (customer.is_vip) {
    return "VIP";
  }

  const orders = toNumber(customer.pos_order_count) ?? 0;
  const lastPurchaseDate = parseDate(customer.last_purchase_date);
  const createdAt = parseDate(customer.created_at);
  const daysSincePurchase = lastPurchaseDate
    ? daysBetween(new Date(), lastPurchaseDate)
    : null;
  const daysSinceCreated = createdAt
    ? daysBetween(new Date(), createdAt)
    : null;

  if (orders === 0 && (daysSinceCreated ?? 999) <= 30) {
    return "New";
  }
  if ((daysSincePurchase ?? 999) <= 30 && orders >= 3) {
    return "Active";
  }
  if ((daysSincePurchase ?? 999) <= 45) {
    return "Engaged";
  }
  if ((daysSincePurchase ?? 999) <= 90) {
    return "At Risk";
  }

  return "Dormant";
}

function getCustomerEngagementScore(customer: Record<string, unknown>) {
  const stored = toNumber(customer.email_engagement_score);
  if (stored !== null) {
    return Math.max(0, Math.min(100, stored));
  }

  const opens = toNumber(customer.total_emails_opened) ?? 0;
  const clicks = toNumber(customer.total_emails_clicked) ?? 0;
  const sent = Math.max(toNumber(customer.total_emails_sent) ?? 0, 1);
  const score = ((opens * 0.6 + clicks * 1.4) / sent) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getCustomerRiskScore(customer: Record<string, unknown>) {
  const lastPurchaseDate = parseDate(customer.last_purchase_date);
  const daysSincePurchase = lastPurchaseDate
    ? daysBetween(new Date(), lastPurchaseDate)
    : 90;
  const suppressedRisk = customer.suppressed || customer.opt_out ? 30 : 0;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(Math.min(70, daysSincePurchase / 2) + suppressedRisk),
    ),
  );
}

function getCustomerHealthScore(customer: Record<string, unknown>) {
  const engagementScore = getCustomerEngagementScore(customer);
  const riskScore = getCustomerRiskScore(customer);
  const spendScore = Math.min(
    100,
    Math.round(
      (toNumber(customer.total_spent) ??
        toNumber(customer.lifetime_value) ??
        0) / 10,
    ),
  );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        engagementScore * 0.45 + spendScore * 0.35 + (100 - riskScore) * 0.2,
      ),
    ),
  );
}

function getCustomerComparableValue(
  customer: Record<string, unknown>,
  fieldId: string,
  context: SegmentEvaluationContext,
) {
  if (fieldId.startsWith("custom:")) {
    const key = fieldId.slice("custom:".length);
    const customFields =
      (customer.custom_fields as Record<string, unknown> | null) ?? null;
    return customFields?.[key] ?? null;
  }

  switch (fieldId) {
    case "customer_since":
      return customer.created_at ?? null;
    case "last_activity_at": {
      const dates = [
        customer.updated_at,
        customer.last_open_at,
        customer.last_email_clicked_at,
        customer.last_purchase_date,
      ]
        .map(parseDate)
        .filter(Boolean) as Date[];
      return dates.length
        ? dates
            .sort((left, right) => right.getTime() - left.getTime())[0]
            .toISOString()
        : null;
    }
    case "average_order_value": {
      const total =
        toNumber(customer.total_spent) ??
        toNumber(customer.lifetime_value) ??
        0;
      const orders = toNumber(customer.pos_order_count) ?? 0;
      return orders > 0 ? total / orders : null;
    }
    case "days_since_last_purchase": {
      const lastPurchase = parseDate(customer.last_purchase_date);
      return lastPurchase ? daysBetween(new Date(), lastPurchase) : null;
    }
    case "lifecycle_stage":
      return getCustomerLifecycleStage(customer);
    case "engagement_score":
      return getCustomerEngagementScore(customer);
    case "risk_score":
      return getCustomerRiskScore(customer);
    case "health_score":
      return getCustomerHealthScore(customer);
    case "segment_membership": {
      const memberships = context.customerSegmentsByCustomerId?.get(
        String(customer.id),
      );
      return memberships ? Array.from(memberships) : [];
    }
    case "persona_membership":
      return customer.persona_id ?? customer.persona ?? null;
    case "tag_membership": {
      const tags = [
        ...toStringArray(customer.tags),
        ...toStringArray(customer.product_tags),
      ];
      return Array.from(new Set(tags));
    }
    default:
      return customer[fieldId] ?? null;
  }
}

function normalizeCondition(input: unknown): SegmentRuleCondition {
  const source = (input ?? {}) as Record<string, unknown>;

  return {
    id: typeof source.id === "string" ? source.id : undefined,
    kind: "rule",
    fieldId:
      typeof source.fieldId === "string"
        ? source.fieldId
        : typeof source.field === "string"
          ? source.field
          : null,
    operatorId:
      typeof source.operatorId === "string"
        ? source.operatorId
        : typeof source.operator === "string"
          ? source.operator
          : null,
    value: source.value ?? null,
  };
}

export function normalizeSegmentRuleGroup(
  input: unknown,
): Required<Pick<SegmentRuleGroup, "operator" | "children">> &
  SegmentRuleGroup {
  const source = (input ?? {}) as Record<string, unknown>;

  if (Array.isArray(source.children)) {
    return {
      id: typeof source.id === "string" ? source.id : undefined,
      kind: "group",
      operator: source.operator === "OR" ? "OR" : "AND",
      children: source.children.map((child) => {
        const maybeGroup = child as Record<string, unknown>;
        return Array.isArray(maybeGroup?.children) ||
          Array.isArray(maybeGroup?.conditions)
          ? normalizeSegmentRuleGroup(child)
          : normalizeCondition(child);
      }),
    };
  }

  if (Array.isArray(source.conditions)) {
    return {
      id: typeof source.id === "string" ? source.id : undefined,
      kind: "group",
      operator:
        source.logic === "OR" || source.operator === "OR" ? "OR" : "AND",
      children: source.conditions.map((condition) =>
        normalizeCondition(condition),
      ),
    };
  }

  return {
    kind: "group",
    operator: "AND",
    children: [],
  };
}

function evaluateCondition(
  customer: Record<string, unknown>,
  condition: SegmentRuleCondition,
  context: SegmentEvaluationContext,
) {
  const fieldId = condition.fieldId ?? condition.field ?? null;
  const operator = condition.operatorId ?? condition.operator ?? null;

  if (!fieldId || !operator) {
    return false;
  }

  const customerValue = getCustomerComparableValue(customer, fieldId, context);

  if (operator === "is_empty") {
    return !hasValue(customerValue);
  }

  if (operator === "is_not_empty") {
    return hasValue(customerValue);
  }

  if (operator === "within_last" || operator === "not_within_last") {
    const threshold = subtractRelativeDate(
      (condition.value ?? {}) as SegmentRelativeDateValue,
    );
    const customerDate = parseDate(customerValue);
    if (!threshold || !customerDate) {
      return false;
    }

    return operator === "within_last"
      ? customerDate >= threshold
      : customerDate < threshold;
  }

  if (operator === "between") {
    const range = (condition.value ?? {}) as SegmentBetweenValue;
    const customerDate = parseDate(customerValue);

    if (customerDate) {
      const minDate = parseDate(range.min);
      const maxDate = parseDate(range.max);
      if (!minDate || !maxDate) {
        return false;
      }
      return customerDate >= minDate && customerDate <= maxDate;
    }

    const numericValue = toNumber(customerValue);
    const min = toNumber(range.min);
    const max = toNumber(range.max);

    if (numericValue === null || min === null || max === null) {
      return false;
    }

    return numericValue >= min && numericValue <= max;
  }

  if (
    operator === "is_one_of" ||
    operator === "is_none_of" ||
    fieldId === "segment_membership" ||
    fieldId === "tag_membership"
  ) {
    const currentValues = toStringArray(customerValue).map((value) =>
      normalizeString(value),
    );
    const expectedValues = toStringArray(condition.value).map((value) =>
      normalizeString(value),
    );
    const matches = expectedValues.some((value) =>
      currentValues.includes(value),
    );
    return operator === "is_none_of" ? !matches : matches;
  }

  if (operator === "before" || operator === "after") {
    const customerDate = parseDate(customerValue);
    const ruleDate = parseDate(condition.value);
    if (!customerDate || !ruleDate) {
      return false;
    }
    return operator === "before"
      ? customerDate < ruleDate
      : customerDate > ruleDate;
  }

  if (
    operator === "equals" ||
    operator === "not_equals" ||
    operator === "is" ||
    operator === "is_not"
  ) {
    const exactMatch =
      normalizeString(customerValue) === normalizeString(condition.value);
    return operator === "not_equals" || operator === "is_not"
      ? !exactMatch
      : exactMatch;
  }

  if (operator === "contains" || operator === "not_contains") {
    const contains = normalizeString(customerValue).includes(
      normalizeString(condition.value),
    );
    return operator === "not_contains" ? !contains : contains;
  }

  if (operator === "starts_with") {
    return normalizeString(customerValue).startsWith(
      normalizeString(condition.value),
    );
  }

  if (operator === "ends_with") {
    return normalizeString(customerValue).endsWith(
      normalizeString(condition.value),
    );
  }

  const numericValue = toNumber(customerValue);
  const ruleNumber = toNumber(condition.value);
  if (numericValue === null || ruleNumber === null) {
    return false;
  }

  if (operator === "greater_than") {
    return numericValue > ruleNumber;
  }

  if (operator === "less_than") {
    return numericValue < ruleNumber;
  }

  return false;
}

export function evaluateSegmentRule(
  group: SegmentRuleGroup,
  customer: Record<string, unknown>,
  context: SegmentEvaluationContext = {},
) {
  const normalized = normalizeSegmentRuleGroup(group);
  if (!normalized.children.length) {
    return false;
  }

  const results = normalized.children.map((child) => {
    const maybeGroup = child as SegmentRuleGroup;
    return Array.isArray(maybeGroup.children)
      ? evaluateSegmentRule(maybeGroup, customer, context)
      : evaluateCondition(customer, child as SegmentRuleCondition, context);
  });

  return normalized.operator === "OR"
    ? results.some(Boolean)
    : results.every(Boolean);
}

export function collectReferencedSegmentIds(group: SegmentRuleGroup) {
  const references = new Set<string>();
  const normalized = normalizeSegmentRuleGroup(group);

  const visit = (node: SegmentRuleNode) => {
    const maybeGroup = node as SegmentRuleGroup;
    if (Array.isArray(maybeGroup.children)) {
      maybeGroup.children.forEach(visit);
      return;
    }

    const condition = node as SegmentRuleCondition;
    const fieldId = condition.fieldId ?? condition.field ?? null;
    if (fieldId !== "segment_membership") {
      return;
    }

    for (const value of toStringArray(condition.value)) {
      if (value) {
        references.add(value);
      }
    }
  };

  normalized.children.forEach(visit);
  return Array.from(references);
}
export interface SegmentRuleCondition {
  id?: string;
  kind?: "rule";
  fieldId?: string | null;
  field?: string | null;
  operatorId?: string | null;
  operator?: string | null;
  value: unknown;
}

export interface SegmentRuleGroup {
  id?: string;
  kind?: "group";
  operator?: "AND" | "OR";
  logic?: "AND" | "OR";
  children?: SegmentRuleNode[];
  conditions?: SegmentRuleCondition[];
}

export type SegmentRuleNode = SegmentRuleCondition | SegmentRuleGroup;

export interface SegmentEvaluationContext {
  customerSegmentsByCustomerId?: Map<string, Set<string>>;
}

interface SegmentBetweenValue {
  min?: number | string | null;
  max?: number | string | null;
}

interface SegmentRelativeDateValue {
  amount: number;
  unit: "days" | "weeks" | "months";
}

function normalizeString(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    if ("amount" in (value as Record<string, unknown>)) {
      return Number((value as SegmentRelativeDateValue).amount) > 0;
    }

    if (
      "min" in (value as Record<string, unknown>) ||
      "max" in (value as Record<string, unknown>)
    ) {
      const range = value as SegmentBetweenValue;
      return hasValue(range.min) && hasValue(range.max);
    }
  }

  return true;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  if (value === null || value === undefined || value === "") {
    return [];
  }

  return [String(value)];
}

function daysBetween(left: Date, right: Date) {
  return Math.floor((left.getTime() - right.getTime()) / 86400000);
}

function subtractRelativeDate(value: SegmentRelativeDateValue) {
  const amount = Number(value.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const date = new Date();
  if (value.unit === "months") {
    date.setMonth(date.getMonth() - amount);
    return date;
  }

  if (value.unit === "weeks") {
    date.setDate(date.getDate() - amount * 7);
    return date;
  }

  date.setDate(date.getDate() - amount);
  return date;
}

function getCustomerLifecycleStage(customer: Record<string, unknown>) {
  if (customer.is_vip) {
    return "VIP";
  }

  const orders = toNumber(customer.pos_order_count) ?? 0;
  const lastPurchaseDate = parseDate(customer.last_purchase_date);
  const createdAt = parseDate(customer.created_at);
  const daysSincePurchase = lastPurchaseDate
    ? daysBetween(new Date(), lastPurchaseDate)
    : null;
  const daysSinceCreated = createdAt
    ? daysBetween(new Date(), createdAt)
    : null;

  if (orders === 0 && (daysSinceCreated ?? 999) <= 30) {
    return "New";
  }
  if ((daysSincePurchase ?? 999) <= 30 && orders >= 3) {
    return "Active";
  }
  if ((daysSincePurchase ?? 999) <= 45) {
    return "Engaged";
  }
  if ((daysSincePurchase ?? 999) <= 90) {
    return "At Risk";
  }

  return "Dormant";
}

function getCustomerEngagementScore(customer: Record<string, unknown>) {
  const stored = toNumber(customer.email_engagement_score);
  if (stored !== null) {
    return Math.max(0, Math.min(100, stored));
  }

  const opens = toNumber(customer.total_emails_opened) ?? 0;
  const clicks = toNumber(customer.total_emails_clicked) ?? 0;
  const sent = Math.max(toNumber(customer.total_emails_sent) ?? 0, 1);
  const score = ((opens * 0.6 + clicks * 1.4) / sent) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getCustomerRiskScore(customer: Record<string, unknown>) {
  const lastPurchaseDate = parseDate(customer.last_purchase_date);
  const daysSincePurchase = lastPurchaseDate
    ? daysBetween(new Date(), lastPurchaseDate)
    : 90;
  const suppressedRisk = customer.suppressed || customer.opt_out ? 30 : 0;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(Math.min(70, daysSincePurchase / 2) + suppressedRisk),
    ),
  );
}

function getCustomerHealthScore(customer: Record<string, unknown>) {
  const engagementScore = getCustomerEngagementScore(customer);
  const riskScore = getCustomerRiskScore(customer);
  const spendScore = Math.min(
    100,
    Math.round(
      (toNumber(customer.total_spent) ??
        toNumber(customer.lifetime_value) ??
        0) / 10,
    ),
  );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        engagementScore * 0.45 + spendScore * 0.35 + (100 - riskScore) * 0.2,
      ),
    ),
  );
}

function getCustomerComparableValue(
  customer: Record<string, unknown>,
  fieldId: string,
  context: SegmentEvaluationContext,
) {
  if (fieldId.startsWith("custom:")) {
    const key = fieldId.slice("custom:".length);
    const customFields =
      (customer.custom_fields as Record<string, unknown> | null) ?? null;
    return customFields?.[key] ?? null;
  }

  switch (fieldId) {
    case "customer_since":
      return customer.created_at ?? null;
    case "last_activity_at": {
      const dates = [
        customer.updated_at,
        customer.last_open_at,
        customer.last_email_clicked_at,
        customer.last_purchase_date,
      ]
        .map(parseDate)
        .filter(Boolean) as Date[];
      return dates.length
        ? dates
            .sort((left, right) => right.getTime() - left.getTime())[0]
            .toISOString()
        : null;
    }
    case "average_order_value": {
      const total =
        toNumber(customer.total_spent) ??
        toNumber(customer.lifetime_value) ??
        0;
      const orders = toNumber(customer.pos_order_count) ?? 0;
      return orders > 0 ? total / orders : null;
    }
    case "days_since_last_purchase": {
      const lastPurchase = parseDate(customer.last_purchase_date);
      return lastPurchase ? daysBetween(new Date(), lastPurchase) : null;
    }
    case "lifecycle_stage":
      return getCustomerLifecycleStage(customer);
    case "engagement_score":
      return getCustomerEngagementScore(customer);
    case "risk_score":
      return getCustomerRiskScore(customer);
    case "health_score":
      return getCustomerHealthScore(customer);
    case "segment_membership": {
      const memberships = context.customerSegmentsByCustomerId?.get(
        String(customer.id),
      );
      return memberships ? Array.from(memberships) : [];
    }
    case "persona_membership":
      return customer.persona_id ?? customer.persona ?? null;
    case "tag_membership": {
      const tags = [
        ...toStringArray(customer.tags),
        ...toStringArray(customer.product_tags),
      ];
      return Array.from(new Set(tags));
    }
    default:
      return customer[fieldId] ?? null;
  }
}

function normalizeCondition(input: unknown): SegmentRuleCondition {
  const source = (input ?? {}) as Record<string, unknown>;

  return {
    id: typeof source.id === "string" ? source.id : undefined,
    kind: "rule",
    fieldId:
      typeof source.fieldId === "string"
        ? source.fieldId
        : typeof source.field === "string"
          ? source.field
          : null,
    operatorId:
      typeof source.operatorId === "string"
        ? source.operatorId
        : typeof source.operator === "string"
          ? source.operator
          : null,
    value: source.value ?? null,
  };
}

export function normalizeSegmentRuleGroup(
  input: unknown,
): Required<Pick<SegmentRuleGroup, "operator" | "children">> &
  SegmentRuleGroup {
  const source = (input ?? {}) as Record<string, unknown>;

  if (Array.isArray(source.children)) {
    return {
      id: typeof source.id === "string" ? source.id : undefined,
      kind: "group",
      operator: source.operator === "OR" ? "OR" : "AND",
      children: source.children.map((child) => {
        const maybeGroup = child as Record<string, unknown>;
        return Array.isArray(maybeGroup?.children) ||
          Array.isArray(maybeGroup?.conditions)
          ? normalizeSegmentRuleGroup(child)
          : normalizeCondition(child);
      }),
    };
  }

  if (Array.isArray(source.conditions)) {
    return {
      id: typeof source.id === "string" ? source.id : undefined,
      kind: "group",
      operator:
        source.logic === "OR" || source.operator === "OR" ? "OR" : "AND",
      children: source.conditions.map((condition) =>
        normalizeCondition(condition),
      ),
    };
  }

  return {
    kind: "group",
    operator: "AND",
    children: [],
  };
}

function evaluateCondition(
  customer: Record<string, unknown>,
  condition: SegmentRuleCondition,
  context: SegmentEvaluationContext,
) {
  const fieldId = condition.fieldId ?? condition.field ?? null;
  const operator = condition.operatorId ?? condition.operator ?? null;

  if (!fieldId || !operator) {
    return false;
  }

  const customerValue = getCustomerComparableValue(customer, fieldId, context);

  if (operator === "is_empty") {
    return !hasValue(customerValue);
  }

  if (operator === "is_not_empty") {
    return hasValue(customerValue);
  }

  if (operator === "within_last" || operator === "not_within_last") {
    const threshold = subtractRelativeDate(
      (condition.value ?? {}) as SegmentRelativeDateValue,
    );
    const customerDate = parseDate(customerValue);
    if (!threshold || !customerDate) {
      return false;
    }

    return operator === "within_last"
      ? customerDate >= threshold
      : customerDate < threshold;
  }

  if (operator === "between") {
    const range = (condition.value ?? {}) as SegmentBetweenValue;
    const customerDate = parseDate(customerValue);

    if (customerDate) {
      const minDate = parseDate(range.min);
      const maxDate = parseDate(range.max);
      if (!minDate || !maxDate) {
        return false;
      }
      return customerDate >= minDate && customerDate <= maxDate;
    }

    const numericValue = toNumber(customerValue);
    const min = toNumber(range.min);
    const max = toNumber(range.max);

    if (numericValue === null || min === null || max === null) {
      return false;
    }

    return numericValue >= min && numericValue <= max;
  }

  if (
    operator === "is_one_of" ||
    operator === "is_none_of" ||
    fieldId === "segment_membership" ||
    fieldId === "tag_membership"
  ) {
    const currentValues = toStringArray(customerValue).map((value) =>
      normalizeString(value),
    );
    const expectedValues = toStringArray(condition.value).map((value) =>
      normalizeString(value),
    );
    const matches = expectedValues.some((value) =>
      currentValues.includes(value),
    );
    return operator === "is_none_of" ? !matches : matches;
  }

  if (operator === "before" || operator === "after") {
    const customerDate = parseDate(customerValue);
    const ruleDate = parseDate(condition.value);
    if (!customerDate || !ruleDate) {
      return false;
    }
    return operator === "before"
      ? customerDate < ruleDate
      : customerDate > ruleDate;
  }

  if (
    operator === "equals" ||
    operator === "not_equals" ||
    operator === "is" ||
    operator === "is_not"
  ) {
    const exactMatch =
      normalizeString(customerValue) === normalizeString(condition.value);
    return operator === "not_equals" || operator === "is_not"
      ? !exactMatch
      : exactMatch;
  }

  if (operator === "contains" || operator === "not_contains") {
    const contains = normalizeString(customerValue).includes(
      normalizeString(condition.value),
    );
    return operator === "not_contains" ? !contains : contains;
  }

  if (operator === "starts_with") {
    return normalizeString(customerValue).startsWith(
      normalizeString(condition.value),
    );
  }

  if (operator === "ends_with") {
    return normalizeString(customerValue).endsWith(
      normalizeString(condition.value),
    );
  }

  const numericValue = toNumber(customerValue);
  const ruleNumber = toNumber(condition.value);
  if (numericValue === null || ruleNumber === null) {
    return false;
  }

  if (operator === "greater_than") {
    return numericValue > ruleNumber;
  }

  if (operator === "less_than") {
    return numericValue < ruleNumber;
  }

  return false;
}

export function evaluateSegmentRule(
  group: SegmentRuleGroup,
  customer: Record<string, unknown>,
  context: SegmentEvaluationContext = {},
) {
  const normalized = normalizeSegmentRuleGroup(group);
  if (!normalized.children.length) {
    return false;
  }

  const results = normalized.children.map((child) => {
    const maybeGroup = child as SegmentRuleGroup;
    return Array.isArray(maybeGroup.children)
      ? evaluateSegmentRule(maybeGroup, customer, context)
      : evaluateCondition(customer, child as SegmentRuleCondition, context);
  });

  return normalized.operator === "OR"
    ? results.some(Boolean)
    : results.every(Boolean);
}

export function collectReferencedSegmentIds(group: SegmentRuleGroup) {
  const references = new Set<string>();
  const normalized = normalizeSegmentRuleGroup(group);

  const visit = (node: SegmentRuleNode) => {
    const maybeGroup = node as SegmentRuleGroup;
    if (Array.isArray(maybeGroup.children)) {
      maybeGroup.children.forEach(visit);
      return;
    }

    const condition = node as SegmentRuleCondition;
    const fieldId = condition.fieldId ?? condition.field ?? null;
    if (fieldId !== "segment_membership") {
      return;
    }

    for (const value of toStringArray(condition.value)) {
      if (value) {
        references.add(value);
      }
    }
  };

  normalized.children.forEach(visit);
  return Array.from(references);
}
