/** Deterministic customer exploration. Missing evidence is not a negative match. */
export interface PurchaseFact {
  id: string; tenant_id: string; customer_id: string | null;
  product_code: string | null; product_name: string | null;
  sales_category: string | null; department: string | null;
  quantity: number | string | null; net_amount: number | string | null;
  currency: string | null; purchased_at: string | null; created_at: string;
  source: string; import_id?: string | null; external_transaction_id?: string | null;
}
export interface PurchaseRule {
  mode: 'all' | 'purchased' | 'not_purchased'; product?: string;
  product_match?: 'contains' | 'exact' | 'sku'; category?: string; department?: string;
  start_date?: string; end_date?: string; within_days?: number;
}
export type MatchReason = 'all_customers' | 'matching_purchase' | 'no_matching_purchase' | 'no_purchase_history' | 'missing_fields';
export interface SearchStep {
  set_id: string; label: string; rule: PurchaseRule; input: number;
  included: number; excluded: number; unknown: number; source_read_at: string;
}
export interface CustomerSet {
  version: 1; id: string; parent_id: string | null; tenant_id: string; user_id: string;
  conversation_id: string; captured_at: string; timezone: string;
  included_ids: string[]; excluded_ids: string[]; unknown_ids: string[];
  reasons: Record<string, MatchReason>; evidence_ids: Record<string, string[]>;
  anchors: Record<string, number[]>; trail: SearchStep[];
}
export const MATCH_REASONS: Record<MatchReason, string> = {
  all_customers: 'Included in the explicitly selected starting population.',
  matching_purchase: 'At least one recorded purchase satisfies every rule.',
  no_matching_purchase: 'No qualifying purchase was found in the available records. This does not prove that the export contains the complete purchase history.',
  no_purchase_history: 'No purchase records are available for this customer. Not treated as a non-buyer.',
  missing_fields: 'A required field is missing or invalid, so a reliable inclusion/exclusion decision cannot be made.',
};
export function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error('Dates must be real calendar dates in YYYY-MM-DD format.');
  }
}
export function localDate(value: string | null, timezone: string): string | null {
  // Validate the time zone even when a record has no date.
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const parts = formatter.formatToParts(new Date(value));
  const part = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const RULE_KEYS = new Set(['mode', 'product', 'product_match', 'category', 'department', 'start_date', 'end_date', 'within_days']);
export function validatePurchaseRule(value: unknown): PurchaseRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Purchase rules are required.');
  const rule = value as Record<string, unknown>;
  for (const key of Object.keys(rule)) if (!RULE_KEYS.has(key)) throw new Error(`Unsupported rule: ${key}. It was not silently ignored.`);
  if (!['all', 'purchased', 'not_purchased'].includes(String(rule.mode))) throw new Error('Choose all, purchased, or not_purchased.');
  for (const key of ['product', 'category', 'department']) {
    if (rule[key] !== undefined && (typeof rule[key] !== 'string' || !(rule[key] as string).trim() || (rule[key] as string).length > 180)) throw new Error(`A non-empty ${key} of up to 180 characters is required.`);
  }
  if (rule.product_match !== undefined && !['contains', 'exact', 'sku'].includes(String(rule.product_match))) throw new Error('Unsupported product matching method.');
  for (const key of ['start_date', 'end_date']) if (rule[key] !== undefined) assertDate(String(rule[key]));
  if (rule.start_date && rule.end_date && String(rule.start_date) > String(rule.end_date)) throw new Error('The start date must not follow the end date.');
  if (rule.within_days !== undefined && (!Number.isInteger(rule.within_days) || Number(rule.within_days) < 0 || Number(rule.within_days) > 3650)) throw new Error('within_days must be an integer from 0 to 3650.');
  if (rule.mode === 'all' && Object.keys(rule).some((key) => key !== 'mode')) throw new Error('The all rule cannot contain hidden purchase filters.');
  if (rule.product_match !== undefined && !rule.product) throw new Error('Choose a product before specifying its matching method.');
  return rule as unknown as PurchaseRule;
}
const normalized = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en-CA');
function matchFact(fact: PurchaseFact, rule: PurchaseRule, timezone: string, anchors?: number[]): boolean | null {
  let missing = false;
  const quantity = finiteNumber(fact.quantity);
  if (quantity !== null && quantity <= 0) return false; // Returns are not fresh purchases.
  if (quantity === null) missing = true;
  if (rule.product) {
    const values = rule.product_match === 'sku' ? [fact.product_code] : [fact.product_name, fact.product_code];
    const available = values.filter((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    if (available.length === 0) missing = true;
    else {
      const query = normalized(rule.product);
      const found = available.some((value) => rule.product_match === 'contains' || !rule.product_match ? normalized(value).includes(query) : normalized(value) === query);
      if (!found) {
        if (rule.product_match !== 'sku' && !fact.product_name?.trim()) missing = true;
        else return false;
      }
    }
  }
  for (const [expected, actual] of [[rule.category, fact.sales_category], [rule.department, fact.department]]) {
    if (!expected) continue;
    if (!actual?.trim()) missing = true;
    else if (normalized(expected) !== normalized(actual)) return false;
  }
  if (rule.start_date || rule.end_date || rule.within_days !== undefined) {
    const date = localDate(fact.purchased_at, timezone);
    if (!date) missing = true;
    else {
      if (rule.start_date && date < rule.start_date) return false;
      if (rule.end_date && date > rule.end_date) return false;
      if (rule.within_days !== undefined) {
        const timestamp = Date.parse(fact.purchased_at!);
        if (!anchors?.length) missing = true;
        else if (!anchors.some((anchor) => timestamp >= anchor && timestamp - anchor <= rule.within_days! * 86400000)) return false;
      }
    }
  }
  return missing ? null : true;
}
export function explorePurchases(input: {
  tenantId: string; userId: string; conversationId: string; timezone: string;
  population: string[]; facts: PurchaseFact[]; rule: PurchaseRule; label: string;
  previous?: CustomerSet | null; now?: string; id?: string;
}): CustomerSet {
  const rule = validatePurchaseRule(input.rule), now = input.now ?? new Date().toISOString();
  if (!input.label.trim() || input.label.length > 180) throw new Error('Name the customer search in 180 characters or fewer.');
  if (!localDate(now, input.timezone)) throw new Error('A valid source-read time is required.');
  const previous = input.previous;
  if (previous && (previous.tenant_id !== input.tenantId || previous.user_id !== input.userId || previous.conversation_id !== input.conversationId)) throw new Error('The earlier result is outside this user, company, or conversation.');
  if (rule.within_days !== undefined && (!previous || !Object.values(previous.anchors).some((dates) => dates.length))) throw new Error('A within-days search requires an earlier result with dated matching purchases.');
  if (previous && previous.trail.length >= 30) throw new Error('This search has 30 steps. Save the audience before starting a new exploration.');
  const visible = new Set(input.population);
  // Fail rather than silently dropping customers whose visibility has changed.
  if (previous?.included_ids.some((id) => !visible.has(id))) throw new Error('Some customers in that result are no longer accessible. Start a new search; the earlier audience has not been silently changed.');
  const population = [...new Set(previous ? previous.included_ids : input.population)].sort();
  const byCustomer = new Map<string, PurchaseFact[]>();
  const seen = new Map<string, string>();
  for (const fact of input.facts) {
    if (fact.tenant_id !== input.tenantId) throw new Error('Cross-company purchase data was rejected.');
    const signature = JSON.stringify(fact);
    if (seen.has(fact.id)) {
      if (seen.get(fact.id) !== signature) throw new Error('Conflicting versions of a purchase record were returned. Retry the search.');
      continue;
    }
    seen.set(fact.id, signature);
    if (!fact.customer_id || !visible.has(fact.customer_id) || Date.parse(fact.created_at) > Date.parse(now)) continue;
    const group = byCustomer.get(fact.customer_id) ?? [];
    group.push(fact); byCustomer.set(fact.customer_id, group);
  }
  const set: CustomerSet = { version: 1, id: input.id ?? crypto.randomUUID(), parent_id: previous?.id ?? null,
    tenant_id: input.tenantId, user_id: input.userId, conversation_id: input.conversationId,
    captured_at: now, timezone: input.timezone, included_ids: [], excluded_ids: [], unknown_ids: [],
    reasons: {}, evidence_ids: {}, anchors: {}, trail: [...(previous?.trail ?? [])] };
  for (const customerId of population) {
    const facts = byCustomer.get(customerId) ?? [];
    if (rule.mode === 'all') { set.included_ids.push(customerId); set.reasons[customerId] = 'all_customers'; continue; }
    if (!facts.length) { set.unknown_ids.push(customerId); set.reasons[customerId] = 'no_purchase_history'; continue; }
    const matched: PurchaseFact[] = []; let unknown = false;
    for (const fact of facts) {
      const decision = matchFact(fact, rule, input.timezone, previous?.anchors[customerId]);
      if (decision === true) matched.push(fact);
      else if (decision === null) unknown = true;
    }
    if (matched.length) {
      (rule.mode === 'purchased' ? set.included_ids : set.excluded_ids).push(customerId);
      set.reasons[customerId] = 'matching_purchase';
      set.evidence_ids[customerId] = matched.map((fact) => fact.id).sort();
      set.anchors[customerId] = matched.map((fact) => fact.purchased_at ? Date.parse(fact.purchased_at) : NaN).filter(Number.isFinite).sort((a, b) => a - b);
    } else if (unknown) { set.unknown_ids.push(customerId); set.reasons[customerId] = 'missing_fields'; }
    else { (rule.mode === 'not_purchased' ? set.included_ids : set.excluded_ids).push(customerId); set.reasons[customerId] = 'no_matching_purchase'; }
  }
  set.trail.push({ set_id: set.id, label: input.label, rule, input: population.length,
    included: set.included_ids.length, excluded: set.excluded_ids.length, unknown: set.unknown_ids.length, source_read_at: now });
  return set;
}
export function analyzeBasket(facts: PurchaseFact[], customerIds: string[], tenantId: string) {
  const customers = new Set(customerIds), products = new Map<string, Set<string>>(); let unnamed = 0;
  for (const fact of facts) {
    if (fact.tenant_id !== tenantId) throw new Error('Cross-company purchase data was rejected.');
    if (!fact.customer_id || !customers.has(fact.customer_id) || (finiteNumber(fact.quantity) ?? 0) <= 0) continue;
    const label = fact.product_name?.trim() || fact.product_code?.trim();
    if (!label) { unnamed++; continue; }
    const buyers = products.get(label) ?? new Set<string>(); buyers.add(fact.customer_id); products.set(label, buyers);
  }
  return { denominator: customers.size, unnamed_purchase_rows: unnamed, products: [...products].map(([product, buyers]) => ({ product, customers: buyers.size, percent: customers.size ? Math.round(buyers.size / customers.size * 10000) / 100 : null })).sort((a, b) => b.customers - a.customers || a.product.localeCompare(b.product)) };
}
