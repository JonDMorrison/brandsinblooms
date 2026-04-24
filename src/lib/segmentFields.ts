import {
  Activity,
  CalendarDays,
  DollarSign,
  Mail,
  MessageSquare,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Tag,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  differenceInCalendarDays,
  isValid,
  parseISO,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type CustomerRow = Database["public"]["Tables"]["crm_customers"]["Row"];

export type SegmentBooleanValue = boolean | null;
export type SegmentRelativeDateValue = {
  amount: number;
  unit: "days" | "weeks" | "months";
};

export type SegmentBetweenValue = {
  min?: number | string | null;
  max?: number | string | null;
};

export type SegmentRuleValue =
  | string
  | number
  | string[]
  | SegmentBooleanValue
  | SegmentBetweenValue
  | SegmentRelativeDateValue
  | null;

export type SegmentDataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "relation";

export type SegmentOperatorId =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "between"
  | "is"
  | "is_not"
  | "is_one_of"
  | "is_none_of"
  | "before"
  | "after"
  | "within_last"
  | "not_within_last"
  | "is_empty"
  | "is_not_empty";

export interface SegmentOperatorDefinition {
  id: SegmentOperatorId;
  label: string;
  shortLabel: string;
  requiresValue: boolean;
  allowsMultiple?: boolean;
  allowsRange?: boolean;
  relativeDate?: boolean;
}

export interface SegmentField {
  id: string;
  label: string;
  category: string;
  icon: LucideIcon;
  dataType: SegmentDataType;
  operators: SegmentOperatorId[];
  description?: string;
  enumOptions?: string[];
  relationType?: "segment" | "persona" | "tag";
  customFieldKey?: string;
}

export interface SegmentRuleCondition {
  id: string;
  kind: "rule";
  fieldId: string | null;
  operatorId: SegmentOperatorId | null;
  value: SegmentRuleValue;
}

export interface SegmentRuleGroup {
  id: string;
  kind: "group";
  operator: "AND" | "OR";
  children: SegmentRuleNode[];
}

export type SegmentRuleNode = SegmentRuleCondition | SegmentRuleGroup;

export interface SegmentDependencySource {
  id: string;
  conditions: unknown;
}

export interface SegmentEvaluationContext {
  customerSegmentsByCustomerId?: Map<string, Set<string>>;
  currentSegmentId?: string | null;
}

export interface PreviewUsageItem {
  id: string;
  kind: "campaign" | "sms-campaign" | "automation";
  name: string;
  status?: string | null;
}

export interface SegmentPreviewCustomer extends CustomerRow {
  custom_fields: Record<string, unknown> | null;
}

export interface SegmentTemplate {
  id: string;
  name: string;
  description: string;
  group: SegmentRuleGroup;
}

export const SEGMENT_OPERATORS: Record<
  SegmentOperatorId,
  SegmentOperatorDefinition
> = {
  equals: {
    id: "equals",
    label: "equals",
    shortLabel: "=",
    requiresValue: true,
  },
  not_equals: {
    id: "not_equals",
    label: "does not equal",
    shortLabel: "!=",
    requiresValue: true,
  },
  contains: {
    id: "contains",
    label: "contains",
    shortLabel: "contains",
    requiresValue: true,
  },
  not_contains: {
    id: "not_contains",
    label: "does not contain",
    shortLabel: "not contains",
    requiresValue: true,
  },
  starts_with: {
    id: "starts_with",
    label: "starts with",
    shortLabel: "starts",
    requiresValue: true,
  },
  ends_with: {
    id: "ends_with",
    label: "ends with",
    shortLabel: "ends",
    requiresValue: true,
  },
  greater_than: {
    id: "greater_than",
    label: "greater than",
    shortLabel: ">",
    requiresValue: true,
  },
  less_than: {
    id: "less_than",
    label: "less than",
    shortLabel: "<",
    requiresValue: true,
  },
  between: {
    id: "between",
    label: "between",
    shortLabel: "between",
    requiresValue: true,
    allowsRange: true,
  },
  is: {
    id: "is",
    label: "is",
    shortLabel: "is",
    requiresValue: true,
  },
  is_not: {
    id: "is_not",
    label: "is not",
    shortLabel: "is not",
    requiresValue: true,
  },
  is_one_of: {
    id: "is_one_of",
    label: "is one of",
    shortLabel: "one of",
    requiresValue: true,
    allowsMultiple: true,
  },
  is_none_of: {
    id: "is_none_of",
    label: "is none of",
    shortLabel: "none of",
    requiresValue: true,
    allowsMultiple: true,
  },
  before: {
    id: "before",
    label: "is before",
    shortLabel: "before",
    requiresValue: true,
  },
  after: {
    id: "after",
    label: "is after",
    shortLabel: "after",
    requiresValue: true,
  },
  within_last: {
    id: "within_last",
    label: "is within last",
    shortLabel: "within last",
    requiresValue: true,
    relativeDate: true,
  },
  not_within_last: {
    id: "not_within_last",
    label: "is not within last",
    shortLabel: "not within",
    requiresValue: true,
    relativeDate: true,
  },
  is_empty: {
    id: "is_empty",
    label: "is empty",
    shortLabel: "empty",
    requiresValue: false,
  },
  is_not_empty: {
    id: "is_not_empty",
    label: "is not empty",
    shortLabel: "not empty",
    requiresValue: false,
  },
};

const stringOperators: SegmentOperatorId[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
];

const numberOperators: SegmentOperatorId[] = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "between",
  "is_empty",
  "is_not_empty",
];

const booleanOperators: SegmentOperatorId[] = ["is", "is_not"];
const dateOperators: SegmentOperatorId[] = [
  "equals",
  "before",
  "after",
  "between",
  "within_last",
  "not_within_last",
  "is_empty",
  "is_not_empty",
];
const enumOperators: SegmentOperatorId[] = [
  "is",
  "is_not",
  "is_one_of",
  "is_none_of",
];
const relationOperators = enumOperators;

export const BASE_SEGMENT_FIELDS: SegmentField[] = [
  {
    id: "first_name",
    label: "First name",
    category: "Profile",
    icon: User,
    dataType: "string",
    operators: stringOperators,
    description: "Customer first name.",
  },
  {
    id: "last_name",
    label: "Last name",
    category: "Profile",
    icon: User,
    dataType: "string",
    operators: stringOperators,
    description: "Customer last name.",
  },
  {
    id: "email",
    label: "Email",
    category: "Profile",
    icon: Mail,
    dataType: "string",
    operators: stringOperators,
    description: "Primary customer email address.",
  },
  {
    id: "phone",
    label: "Phone",
    category: "Profile",
    icon: MessageSquare,
    dataType: "string",
    operators: stringOperators,
    description: "Primary customer phone number.",
  },
  {
    id: "created_at",
    label: "Created date",
    category: "Profile",
    icon: CalendarDays,
    dataType: "date",
    operators: dateOperators,
    description: "When the contact was created in CRM.",
  },
  {
    id: "customer_since",
    label: "Customer since",
    category: "Profile",
    icon: CalendarDays,
    dataType: "date",
    operators: dateOperators,
    description: "Alias for created date for segmentation language.",
  },
  {
    id: "email_opt_in",
    label: "Email opt-in",
    category: "Engagement",
    icon: Mail,
    dataType: "boolean",
    operators: booleanOperators,
    description: "Whether the customer can receive marketing email.",
  },
  {
    id: "sms_opt_in",
    label: "SMS opt-in",
    category: "Engagement",
    icon: MessageSquare,
    dataType: "boolean",
    operators: booleanOperators,
    description: "Whether the customer can receive SMS messages.",
  },
  {
    id: "last_open_at",
    label: "Last email open",
    category: "Engagement",
    icon: Activity,
    dataType: "date",
    operators: dateOperators,
    description: "When the customer last opened an email.",
  },
  {
    id: "last_email_clicked_at",
    label: "Last email click",
    category: "Engagement",
    icon: Activity,
    dataType: "date",
    operators: dateOperators,
    description: "When the customer last clicked an email.",
  },
  {
    id: "total_emails_opened",
    label: "Total email opens",
    category: "Engagement",
    icon: Activity,
    dataType: "number",
    operators: numberOperators,
    description: "Total email opens recorded for this customer.",
  },
  {
    id: "total_emails_clicked",
    label: "Total email clicks",
    category: "Engagement",
    icon: Activity,
    dataType: "number",
    operators: numberOperators,
    description: "Total email clicks recorded for this customer.",
  },
  {
    id: "email_click_rate",
    label: "Email click rate",
    category: "Engagement",
    icon: Activity,
    dataType: "number",
    operators: numberOperators,
    description: "Email click rate percentage.",
  },
  {
    id: "last_activity_at",
    label: "Last activity date",
    category: "Engagement",
    icon: Activity,
    dataType: "date",
    operators: dateOperators,
    description: "Most recent known customer activity.",
  },
  {
    id: "pos_order_count",
    label: "Total purchases",
    category: "Purchase",
    icon: ShoppingBag,
    dataType: "number",
    operators: numberOperators,
    description: "Number of POS purchases tied to the customer.",
  },
  {
    id: "lifetime_value",
    label: "Lifetime value (LTV)",
    category: "Purchase",
    icon: DollarSign,
    dataType: "number",
    operators: numberOperators,
    description: "Lifetime value recorded for the customer.",
  },
  {
    id: "average_order_value",
    label: "Average order value (AOV)",
    category: "Purchase",
    icon: DollarSign,
    dataType: "number",
    operators: numberOperators,
    description: "Calculated average order value from spend and order count.",
  },
  {
    id: "last_purchase_date",
    label: "Last purchase date",
    category: "Purchase",
    icon: CalendarDays,
    dataType: "date",
    operators: dateOperators,
    description: "When the customer most recently purchased.",
  },
  {
    id: "days_since_last_purchase",
    label: "Days since last purchase",
    category: "Purchase",
    icon: CalendarDays,
    dataType: "number",
    operators: numberOperators,
    description: "Calculated days since the most recent purchase.",
  },
  {
    id: "first_purchase_date",
    label: "First purchase date",
    category: "Purchase",
    icon: CalendarDays,
    dataType: "date",
    operators: dateOperators,
    description: "When the customer first purchased.",
  },
  {
    id: "lifecycle_stage",
    label: "Lifecycle stage",
    category: "Lifecycle",
    icon: Sparkles,
    dataType: "enum",
    operators: enumOperators,
    enumOptions: ["New", "Engaged", "Active", "At Risk", "Dormant", "VIP"],
    description: "Derived customer lifecycle stage.",
  },
  {
    id: "health_score",
    label: "Health score",
    category: "Lifecycle",
    icon: Sparkles,
    dataType: "number",
    operators: numberOperators,
    description: "Derived blend of engagement and revenue recency.",
  },
  {
    id: "engagement_score",
    label: "Engagement score",
    category: "Lifecycle",
    icon: Activity,
    dataType: "number",
    operators: numberOperators,
    description: "Stored or derived engagement score.",
  },
  {
    id: "risk_score",
    label: "Risk score",
    category: "Lifecycle",
    icon: ShieldAlert,
    dataType: "number",
    operators: numberOperators,
    description: "Derived churn or suppression risk score.",
  },
  {
    id: "segment_membership",
    label: "In segment",
    category: "Membership",
    icon: Users,
    dataType: "relation",
    operators: relationOperators,
    relationType: "segment",
    description: "Whether the customer currently belongs to another segment.",
  },
  {
    id: "persona_membership",
    label: "Has persona",
    category: "Membership",
    icon: User,
    dataType: "relation",
    operators: relationOperators,
    relationType: "persona",
    description: "Persona currently assigned to the customer.",
  },
  {
    id: "tag_membership",
    label: "Has tag",
    category: "Membership",
    icon: Tag,
    dataType: "relation",
    operators: relationOperators,
    relationType: "tag",
    description: "Tags attached to the customer.",
  },
  {
    id: "preferred_channel",
    label: "Preferred channel",
    category: "Membership",
    icon: MessageSquare,
    dataType: "enum",
    operators: enumOperators,
    enumOptions: ["email", "sms", "none"],
    description: "Preferred messaging channel.",
  },
];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createEmptyRule(): SegmentRuleCondition {
  return {
    id: makeId("rule"),
    kind: "rule",
    fieldId: null,
    operatorId: null,
    value: null,
  };
}

export function createEmptyGroup(depth = 0): SegmentRuleGroup {
  return {
    id: makeId(`group-${depth}`),
    kind: "group",
    operator: "AND",
    children: [createEmptyRule()],
  };
}

export function isRuleGroup(
  node: SegmentRuleNode | unknown,
): node is SegmentRuleGroup {
  return (
    Boolean(node) &&
    typeof node === "object" &&
    (node as SegmentRuleGroup).kind === "group"
  );
}

export function isRuleCondition(
  node: SegmentRuleNode | unknown,
): node is SegmentRuleCondition {
  return (
    Boolean(node) &&
    typeof node === "object" &&
    (node as SegmentRuleCondition).kind === "rule"
  );
}

export function getFieldById(fields: SegmentField[], fieldId?: string | null) {
  return fields.find((field) => field.id === fieldId) ?? null;
}

export function getOperatorsForField(field?: SegmentField | null) {
  if (!field) {
    return [] as SegmentOperatorDefinition[];
  }

  return field.operators.map((operatorId) => SEGMENT_OPERATORS[operatorId]);
}

export function normalizeSegmentRuleGroup(input: unknown): SegmentRuleGroup {
  if (isRuleGroup(input)) {
    return {
      ...input,
      children: Array.isArray(input.children)
        ? input.children.map((child) =>
            isRuleGroup(child)
              ? normalizeSegmentRuleGroup(child)
              : normalizeSegmentRuleCondition(child),
          )
        : [createEmptyRule()],
    };
  }

  if (
    input &&
    typeof input === "object" &&
    Array.isArray((input as { conditions?: unknown[] }).conditions)
  ) {
    const legacy = input as {
      conditions: Array<{
        field?: string;
        operator?: SegmentOperatorId;
        value?: SegmentRuleValue;
      }>;
      logic?: "AND" | "OR";
    };

    return {
      id: makeId("group-legacy"),
      kind: "group",
      operator: legacy.logic === "OR" ? "OR" : "AND",
      children: legacy.conditions.map((condition) => ({
        id: makeId("rule-legacy"),
        kind: "rule",
        fieldId: condition.field ?? null,
        operatorId: condition.operator ?? null,
        value: condition.value ?? null,
      })),
    };
  }

  return createEmptyGroup();
}

function normalizeSegmentRuleCondition(input: unknown): SegmentRuleCondition {
  if (isRuleCondition(input)) {
    return input;
  }

  if (input && typeof input === "object") {
    const legacy = input as {
      field?: string;
      operator?: SegmentOperatorId;
      value?: SegmentRuleValue;
    };

    return {
      id: makeId("rule-normalized"),
      kind: "rule",
      fieldId: legacy.field ?? null,
      operatorId: legacy.operator ?? null,
      value: legacy.value ?? null,
    };
  }

  return createEmptyRule();
}

export function getRuleDepth(group: SegmentRuleGroup, depth = 0): number {
  return group.children.reduce((maxDepth, child) => {
    if (!isRuleGroup(child)) {
      return maxDepth;
    }

    return Math.max(maxDepth, getRuleDepth(child, depth + 1));
  }, depth);
}

export function canAddNestedGroup(depth: number) {
  return depth < 3;
}

function hasValue(value: SegmentRuleValue) {
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
    if ("amount" in value) {
      return Number((value as SegmentRelativeDateValue).amount) > 0;
    }

    if ("min" in value || "max" in value) {
      const range = value as SegmentBetweenValue;
      return hasValue(range.min ?? null) && hasValue(range.max ?? null);
    }
  }

  return true;
}

export function isRuleComplete(
  rule: SegmentRuleCondition,
  fields: SegmentField[],
) {
  const field = getFieldById(fields, rule.fieldId);
  if (!field || !rule.operatorId) {
    return false;
  }

  const operator = SEGMENT_OPERATORS[rule.operatorId];
  if (!operator.requiresValue) {
    return true;
  }

  return hasValue(rule.value);
}

export function hasIncompleteRules(
  group: SegmentRuleGroup,
  fields: SegmentField[],
): boolean {
  return group.children.some((child) => {
    if (isRuleGroup(child)) {
      return hasIncompleteRules(child, fields);
    }

    return !isRuleComplete(child, fields);
  });
}

export function deriveCustomSegmentFields(
  customFieldObjects: Array<Record<string, unknown> | null | undefined>,
) {
  const fieldRegistry = new Map<string, unknown[]>();

  for (const fieldObject of customFieldObjects) {
    if (!fieldObject || typeof fieldObject !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(fieldObject)) {
      const next = fieldRegistry.get(key) ?? [];
      next.push(value);
      fieldRegistry.set(key, next);
    }
  }

  return Array.from(fieldRegistry.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, values]) => {
      const normalizedValues = values.filter(
        (value) => value !== null && value !== undefined,
      );
      const stringValues = normalizedValues.filter(
        (value) => typeof value === "string",
      ) as string[];
      const numberValues = normalizedValues.filter(
        (value) => typeof value === "number",
      );
      const booleanValues = normalizedValues.filter(
        (value) => typeof value === "boolean",
      );
      const distinctStrings = Array.from(
        new Set(stringValues.map((value) => value.trim()).filter(Boolean)),
      );

      let dataType: SegmentDataType = "string";
      let operators = stringOperators;
      let enumOptions: string[] | undefined;

      if (
        booleanValues.length &&
        booleanValues.length === normalizedValues.length
      ) {
        dataType = "boolean";
        operators = booleanOperators;
      } else if (
        numberValues.length &&
        numberValues.length === normalizedValues.length
      ) {
        dataType = "number";
        operators = numberOperators;
      } else if (
        stringValues.length &&
        stringValues.length === normalizedValues.length &&
        distinctStrings.every((value) => !Number.isNaN(Date.parse(value)))
      ) {
        dataType = "date";
        operators = dateOperators;
      } else if (distinctStrings.length > 0 && distinctStrings.length <= 8) {
        dataType = "enum";
        operators = enumOperators;
        enumOptions = distinctStrings;
      }

      return {
        id: `custom:${key}`,
        label: key
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
        category: "Custom",
        icon: Sparkles,
        dataType,
        operators,
        enumOptions,
        customFieldKey: key,
        description: `Custom field stored at custom_fields.${key}.`,
      } satisfies SegmentField;
    });
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function normalizeString(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getArrayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [String(value)];
}

export function buildCustomerName(
  customer: Pick<CustomerRow, "first_name" | "last_name" | "email">,
) {
  const fullName =
    `${String(customer.first_name ?? "").trim()} ${String(customer.last_name ?? "").trim()}`.trim();
  return fullName || customer.email || "Customer";
}

export function getCustomerLifecycleStage(customer: CustomerRow) {
  if (customer.is_vip) {
    return "VIP";
  }

  const orders = customer.pos_order_count ?? 0;
  const lastPurchaseDate = parseDate(customer.last_purchase_date);
  const createdDate = parseDate(customer.created_at);
  const daysSincePurchase = lastPurchaseDate
    ? differenceInCalendarDays(new Date(), lastPurchaseDate)
    : null;
  const daysSinceCreated = createdDate
    ? differenceInCalendarDays(new Date(), createdDate)
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

export function getCustomerEngagementScore(customer: CustomerRow) {
  if (typeof customer.email_engagement_score === "number") {
    return Math.max(0, Math.min(100, customer.email_engagement_score));
  }

  const opens = customer.total_emails_opened ?? 0;
  const clicks = customer.total_emails_clicked ?? 0;
  const sent = Math.max(customer.total_emails_sent ?? 0, 1);

  const score = ((opens * 0.6 + clicks * 1.4) / sent) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getCustomerRiskScore(customer: CustomerRow) {
  const daysSincePurchase = getCustomerComparableValue(
    customer,
    "days_since_last_purchase",
    {},
  );
  const suppressedRisk = customer.suppressed || customer.opt_out ? 30 : 0;
  const inactivityRisk =
    typeof daysSincePurchase === "number"
      ? Math.min(70, daysSincePurchase / 2)
      : 45;

  return Math.max(
    0,
    Math.min(100, Math.round(inactivityRisk + suppressedRisk)),
  );
}

export function getCustomerHealthScore(customer: CustomerRow) {
  const engagementScore = getCustomerEngagementScore(customer);
  const riskScore = getCustomerRiskScore(customer);
  const spendScore = Math.min(
    100,
    Math.round((customer.total_spent ?? customer.lifetime_value ?? 0) / 10),
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

export function getCustomerComparableValue(
  customer: CustomerRow,
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
      return customer.created_at;
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
      const total = customer.total_spent ?? customer.lifetime_value ?? 0;
      const orders = customer.pos_order_count ?? 0;
      return orders > 0 ? total / orders : null;
    }
    case "days_since_last_purchase": {
      const lastPurchase = parseDate(customer.last_purchase_date);
      return lastPurchase
        ? differenceInCalendarDays(new Date(), lastPurchase)
        : null;
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
        customer.id,
      );
      return memberships ? Array.from(memberships) : [];
    }
    case "persona_membership":
      return customer.persona_id ?? customer.persona ?? null;
    case "tag_membership":
      return customer.tags ?? customer.product_tags ?? [];
    default:
      return customer[fieldId as keyof CustomerRow] ?? null;
  }
}

function resolveRelativeDate(value: SegmentRelativeDateValue) {
  const amount = Number(value.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  switch (value.unit) {
    case "weeks":
      return subWeeks(new Date(), amount);
    case "months":
      return subMonths(new Date(), amount);
    default:
      return subDays(new Date(), amount);
  }
}

export function evaluateSegmentRule(
  group: SegmentRuleGroup,
  customer: CustomerRow,
  context: SegmentEvaluationContext = {},
) {
  const evaluations = group.children.map((child) => {
    if (isRuleGroup(child)) {
      return evaluateSegmentRule(child, customer, context);
    }

    return evaluateSegmentCondition(child, customer, context);
  });

  if (group.operator === "OR") {
    return evaluations.some(Boolean);
  }

  return evaluations.every(Boolean);
}

export function evaluateSegmentCondition(
  rule: SegmentRuleCondition,
  customer: CustomerRow,
  context: SegmentEvaluationContext = {},
) {
  if (!rule.fieldId || !rule.operatorId) {
    return false;
  }

  const customerValue = getCustomerComparableValue(
    customer,
    rule.fieldId,
    context,
  );
  const operator = rule.operatorId;

  if (operator === "is_empty") {
    return !hasValue(customerValue as SegmentRuleValue);
  }

  if (operator === "is_not_empty") {
    return hasValue(customerValue as SegmentRuleValue);
  }

  if (operator === "within_last" || operator === "not_within_last") {
    const threshold =
      typeof rule.value === "object" && rule.value && "amount" in rule.value
        ? resolveRelativeDate(rule.value as SegmentRelativeDateValue)
        : null;
    const customerDate =
      typeof customerValue === "string" ? parseDate(customerValue) : null;
    if (!threshold || !customerDate) {
      return false;
    }

    return operator === "within_last"
      ? customerDate >= threshold
      : customerDate < threshold;
  }

  if (operator === "between") {
    const range = rule.value as SegmentBetweenValue;
    const customerDate =
      typeof customerValue === "string" ? parseDate(customerValue) : null;

    if (customerDate) {
      const minDate = parseDate(String(range.min ?? ""));
      const maxDate = parseDate(String(range.max ?? ""));
      if (!minDate || !maxDate) {
        return false;
      }

      return customerDate >= minDate && customerDate <= maxDate;
    }

    const numericValue = toNumber(customerValue);
    const min = toNumber(range.min ?? null);
    const max = toNumber(range.max ?? null);

    if (numericValue === null || min === null || max === null) {
      return false;
    }

    return numericValue >= min && numericValue <= max;
  }

  if (
    operator === "is_one_of" ||
    operator === "is_none_of" ||
    rule.fieldId === "segment_membership" ||
    rule.fieldId === "tag_membership"
  ) {
    const currentValues = getArrayValue(customerValue).map((value) =>
      normalizeString(value),
    );
    const expectedValues = getArrayValue(rule.value).map((value) =>
      normalizeString(value),
    );
    const matches = expectedValues.some((value) =>
      currentValues.includes(value),
    );
    return operator === "is_none_of" ? !matches : matches;
  }

  const customerDate =
    typeof customerValue === "string" ? parseDate(customerValue) : null;
  const ruleDate =
    typeof rule.value === "string" ? parseDate(rule.value) : null;

  if (operator === "before" || operator === "after") {
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
    const normalizedCustomer = normalizeString(customerValue);
    const normalizedRule = normalizeString(rule.value);
    const exactMatch = normalizedCustomer === normalizedRule;
    return operator === "not_equals" || operator === "is_not"
      ? !exactMatch
      : exactMatch;
  }

  if (operator === "contains" || operator === "not_contains") {
    const contains = normalizeString(customerValue).includes(
      normalizeString(rule.value),
    );
    return operator === "not_contains" ? !contains : contains;
  }

  if (operator === "starts_with") {
    return normalizeString(customerValue).startsWith(
      normalizeString(rule.value),
    );
  }

  if (operator === "ends_with") {
    return normalizeString(customerValue).endsWith(normalizeString(rule.value));
  }

  const customerNumber = toNumber(customerValue);
  const ruleNumber = toNumber(rule.value);
  if (customerNumber === null || ruleNumber === null) {
    return false;
  }

  if (operator === "greater_than") {
    return customerNumber > ruleNumber;
  }

  if (operator === "less_than") {
    return customerNumber < ruleNumber;
  }

  return false;
}

export function collectReferencedSegmentIds(group: SegmentRuleGroup): string[] {
  const references = new Set<string>();

  const visit = (node: SegmentRuleNode) => {
    if (isRuleGroup(node)) {
      node.children.forEach(visit);
      return;
    }

    if (node.fieldId !== "segment_membership") {
      return;
    }

    for (const value of getArrayValue(node.value)) {
      if (value) {
        references.add(value);
      }
    }
  };

  visit(group);
  return Array.from(references);
}

export function createsCircularSegmentReference(
  currentSegmentId: string | null | undefined,
  candidateSegmentId: string,
  segments: SegmentDependencySource[],
) {
  if (!currentSegmentId) {
    return false;
  }

  if (candidateSegmentId === currentSegmentId) {
    return true;
  }

  const dependencyMap = new Map<string, string[]>();
  for (const segment of segments) {
    dependencyMap.set(
      segment.id,
      collectReferencedSegmentIds(
        normalizeSegmentRuleGroup(segment.conditions),
      ),
    );
  }

  const stack = [candidateSegmentId];
  const visited = new Set<string>();

  while (stack.length) {
    const next = stack.pop();
    if (!next || visited.has(next)) {
      continue;
    }

    visited.add(next);
    if (next === currentSegmentId) {
      return true;
    }

    for (const dependency of dependencyMap.get(next) ?? []) {
      if (!visited.has(dependency)) {
        stack.push(dependency);
      }
    }
  }

  return false;
}

export const SEGMENT_TEMPLATES: SegmentTemplate[] = [
  {
    id: "vip-customers",
    name: "VIP Customers",
    description: "High-spend repeat buyers with strong value history.",
    group: {
      id: makeId("template-group"),
      kind: "group",
      operator: "AND",
      children: [
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "pos_order_count",
          operatorId: "greater_than",
          value: 9,
        },
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "lifetime_value",
          operatorId: "greater_than",
          value: 1000,
        },
      ],
    },
  },
  {
    id: "at-risk-customers",
    name: "At-Risk Customers",
    description: "Customers slipping into inactivity after earlier engagement.",
    group: {
      id: makeId("template-group"),
      kind: "group",
      operator: "AND",
      children: [
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "days_since_last_purchase",
          operatorId: "greater_than",
          value: 59,
        },
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "pos_order_count",
          operatorId: "greater_than",
          value: 0,
        },
      ],
    },
  },
  {
    id: "newsletter-subscribers",
    name: "Newsletter Subscribers",
    description: "Customers who are opted in for email communication.",
    group: {
      id: makeId("template-group"),
      kind: "group",
      operator: "AND",
      children: [
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "email_opt_in",
          operatorId: "is",
          value: true,
        },
      ],
    },
  },
  {
    id: "recent-signups",
    name: "Recent Signups",
    description: "Contacts created within the last 30 days.",
    group: {
      id: makeId("template-group"),
      kind: "group",
      operator: "AND",
      children: [
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "created_at",
          operatorId: "within_last",
          value: { amount: 30, unit: "days" },
        },
      ],
    },
  },
  {
    id: "big-spenders",
    name: "Big Spenders",
    description: "Customers with strong revenue contribution.",
    group: {
      id: makeId("template-group"),
      kind: "group",
      operator: "AND",
      children: [
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "lifetime_value",
          operatorId: "greater_than",
          value: 500,
        },
      ],
    },
  },
  {
    id: "repeat-buyers",
    name: "Repeat Buyers",
    description: "Customers with at least three purchases.",
    group: {
      id: makeId("template-group"),
      kind: "group",
      operator: "AND",
      children: [
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "pos_order_count",
          operatorId: "greater_than",
          value: 2,
        },
      ],
    },
  },
  {
    id: "engaged-readers",
    name: "Engaged Readers",
    description: "People opening and clicking email recently.",
    group: {
      id: makeId("template-group"),
      kind: "group",
      operator: "AND",
      children: [
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "last_open_at",
          operatorId: "within_last",
          value: { amount: 14, unit: "days" },
        },
        {
          id: makeId("template-rule"),
          kind: "rule",
          fieldId: "email_click_rate",
          operatorId: "greater_than",
          value: 20,
        },
      ],
    },
  },
];
