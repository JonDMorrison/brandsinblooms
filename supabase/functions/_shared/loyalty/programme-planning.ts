/**
 * Side-effect-free planning contract. A simulation is NOT a redemption approval.
 * Production callers must resolve identity, basket, event evidence, limits and
 * inventory on the server, then reserve/commit through a transactional authority.
 * No customer, coupon, consent, point balance, message or payment is written here.
 */
export const LOYALTY_CURRENCIES = ['CAD', 'USD', 'GBP', 'EUR'] as const;
export type LoyaltyCurrency = typeof LOYALTY_CURRENCIES[number];
export type Trigger = 'membership_join' | 'reviewed_audience' | 'purchase' | 'milestone' | 'referral' | 'birthday' | 'staff_kindness' | 'event';
export type Reward =
  | { kind: 'fixed'; amountMinor: number }
  | { kind: 'percentage'; basisPoints: number; capMinor: number }
  | { kind: 'gift'; sku: string; units: number; costMinor: number | null }
  | { kind: 'multi_buy'; groupSize: number; freeUnits: number; capMinor: number }
  | { kind: 'experience'; reference: string; costMinor: number | null };
export interface ProgrammeDraft {
  version: 1;
  templateId: string;
  name: string;
  audienceDescription: string;
  trigger: Trigger;
  membersOnly: boolean;
  currency: LoyaltyCurrency;
  timezone: string;
  startsOn: string;
  endsOn: string;
  minimumSpendMinor: number;
  threshold: 'at_least' | 'more_than';
  repeat: 'once_per_member' | 'per_qualifying_event';
  maxAwardsPerMember: number;
  maxAwardsTotal: number;
  budgetMinor: number | null;
  eligibleSkus: string[];
  eligibleDepartments: string[];
  excludeDiscounted: boolean;
  reward: Reward;
}
export interface BasketLine {
  id: string;
  sku: string;
  department: string | null;
  kind: 'goods' | 'gift_card' | 'tax' | 'shipping' | 'fee';
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
}
export interface PlanningScenario {
  occurredAt: string;
  currency: LoyaltyCurrency;
  isMember: boolean | null;
  matchesAudience: boolean | null;
  triggerVerified: boolean | null;
  memberAwards: number | null;
  totalAwards: number | null;
  remainingBudgetMinor: number | null;
  giftUnitsAvailable: number | null;
  placesAvailable: number | null;
  lines: BasketLine[];
}
export interface ProgrammePreview {
  simulationOnly: true;
  state: 'eligible' | 'ineligible' | 'needs_review';
  reason: string;
  eligibleSubtotalMinor: number;
  discountMinor: number;
  rewardCostMinor: number | null;
  giftUnits: number;
  excludedLineIds: string[];
  warnings: string[];
}
const MAX_MONEY = 1_000_000_000_000;
const TRIGGERS: Trigger[] = ['membership_join', 'reviewed_audience', 'purchase', 'milestone', 'referral', 'birthday', 'staff_kindness', 'event'];
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(`Unsupported fields: ${extra.join(', ')}.`);
}
function text(value: unknown, field: string, max = 180): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${field} is required (maximum ${max} characters).`);
  return value.trim();
}
function integer(value: unknown, field: string, min = 0, max = MAX_MONEY): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${field} must be a whole number from ${min} to ${max}.`);
  return value;
}
function optionalMoney(value: unknown, field: string): number | null { return value === null ? null : integer(value, field); }
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be true or false.`);
  return value;
}
function names(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${field} must be a list of at most 100 values.`);
  return [...new Set(value.map(item => text(item, field)))];
}
function date(value: unknown): string {
  const result = text(value, 'Date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result + 'T00:00:00Z')) || new Date(result + 'T00:00:00Z').toISOString().slice(0, 10) !== result) throw new Error('Use a real calendar date in YYYY-MM-DD format.');
  return result;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`Unsupported ${field}.`);
  return value as T;
}
export function parseReward(value: unknown): Reward {
  const r = record(value);
  switch (r.kind) {
    case 'fixed': keys(r, ['kind', 'amountMinor']); return { kind: r.kind, amountMinor: integer(r.amountMinor, 'Reward amount', 1) };
    case 'percentage': keys(r, ['kind', 'basisPoints', 'capMinor']); return { kind: r.kind, basisPoints: integer(r.basisPoints, 'Percentage in basis points', 1, 10000), capMinor: integer(r.capMinor, 'Discount cap', 1) };
    case 'gift': keys(r, ['kind', 'sku', 'units', 'costMinor']); return { kind: r.kind, sku: text(r.sku, 'Gift SKU'), units: integer(r.units, 'Gift units', 1, 100), costMinor: optionalMoney(r.costMinor, 'Actual gift cost per unit') };
    case 'multi_buy': {
      keys(r, ['kind', 'groupSize', 'freeUnits', 'capMinor']);
      const groupSize = integer(r.groupSize, 'Multi-buy group size', 2, 100);
      return { kind: r.kind, groupSize, freeUnits: integer(r.freeUnits, 'Free units', 1, groupSize - 1), capMinor: integer(r.capMinor, 'Discount cap', 1) };
    }
    case 'experience': keys(r, ['kind', 'reference', 'costMinor']); return { kind: r.kind, reference: text(r.reference, 'Experience reference'), costMinor: optionalMoney(r.costMinor, 'Actual experience cost') };
    default: throw new Error('Choose a supported reward type.');
  }
}
export function parseProgrammeDraft(value: unknown): ProgrammeDraft {
  const d = record(value);
  keys(d, ['version', 'templateId', 'name', 'audienceDescription', 'trigger', 'membersOnly', 'currency', 'timezone', 'startsOn', 'endsOn', 'minimumSpendMinor', 'threshold', 'repeat', 'maxAwardsPerMember', 'maxAwardsTotal', 'budgetMinor', 'eligibleSkus', 'eligibleDepartments', 'excludeDiscounted', 'reward']);
  if (d.version !== 1) throw new Error('Unsupported programme version.');
  const timezone = text(d.timezone, 'Timezone', 100);
  try { new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(0); } catch { throw new Error('Use a valid business timezone.'); }
  const startsOn = date(d.startsOn), endsOn = date(d.endsOn);
  if (endsOn < startsOn) throw new Error('The end date must not precede the start date.');
  const repeat = oneOf(d.repeat, ['once_per_member', 'per_qualifying_event'], 'repeat rule');
  const maxAwardsPerMember = integer(d.maxAwardsPerMember, 'Maximum awards per member', 1, 10000);
  if (repeat === 'once_per_member' && maxAwardsPerMember !== 1) throw new Error('A once-per-member programme must have a limit of one.');
  const eligibleSkus = names(d.eligibleSkus, 'Eligible SKUs'), eligibleDepartments = names(d.eligibleDepartments, 'Eligible departments');
  const reward = parseReward(d.reward), excludeDiscounted = boolean(d.excludeDiscounted, 'Exclude discounted products');
  if (reward.kind === 'multi_buy' && !eligibleSkus.length && !eligibleDepartments.length) throw new Error('Choose eligible products or departments for a multi-buy.');
  if (reward.kind === 'multi_buy' && !excludeDiscounted) throw new Error('Multi-buy stacking is not supported by this rule version. Exclude already-discounted products.');
  return {
    version: 1, templateId: text(d.templateId, 'Template'), name: text(d.name, 'Programme name', 120), audienceDescription: text(d.audienceDescription, 'Audience definition', 2000),
    trigger: oneOf(d.trigger, TRIGGERS, 'trigger'), membersOnly: boolean(d.membersOnly, 'Members only'), currency: oneOf(d.currency, LOYALTY_CURRENCIES, 'currency'), timezone, startsOn, endsOn,
    minimumSpendMinor: integer(d.minimumSpendMinor, 'Minimum eligible spend'), threshold: oneOf(d.threshold, ['at_least', 'more_than'], 'threshold comparison'), repeat, maxAwardsPerMember,
    maxAwardsTotal: integer(d.maxAwardsTotal, 'Maximum total awards', 1, 1000000), budgetMinor: optionalMoney(d.budgetMinor, 'Budget'), eligibleSkus, eligibleDepartments, excludeDiscounted, reward,
  };
}
/** Strict decimal input, no floating point multiplication or silent invalid->zero. */
export function parseMoneyInput(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a non-negative amount with at most two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  return integer(Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))), 'Amount');
}
export function formatLoyaltyMoney(minor: number, currency: LoyaltyCurrency): string {
  integer(minor, 'Amount');
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(minor / 100);
}
export function programmeRuleSummary(value: ProgrammeDraft): string[] {
  const d = parseProgrammeDraft(value), r = d.reward;
  const benefit = r.kind === 'fixed' ? `${formatLoyaltyMoney(r.amountMinor, d.currency)} off eligible goods.`
    : r.kind === 'percentage' ? `${r.basisPoints / 100}% off eligible goods, capped at ${formatLoyaltyMoney(r.capMinor, d.currency)}.`
    : r.kind === 'gift' ? `${r.units} gift item(s), SKU ${r.sku}; actual cost ${r.costMinor === null ? 'unknown' : formatLoyaltyMoney(r.costMinor, d.currency) + ' per unit'}.`
    : r.kind === 'multi_buy' ? `For every ${r.groupSize} eligible units, ${r.freeUnits} are free. Discount the cheapest units across the eligible basket, capped at ${formatLoyaltyMoney(r.capMinor, d.currency)}.`
    : `Experience: ${r.reference}. Booking capacity must be confirmed.`;
  return [benefit, `${d.threshold === 'more_than' ? 'More than' : 'At least'} ${formatLoyaltyMoney(d.minimumSpendMinor, d.currency)} of eligible merchandise after existing discounts and before tax.`,
    'Gift cards, tax, shipping, fees and the gift itself do not qualify toward merchandise spend.',
    d.eligibleSkus.length || d.eligibleDepartments.length ? `Products: ${d.eligibleSkus.join(', ') || 'any'}; departments: ${d.eligibleDepartments.join(', ') || 'any'}. When both are set, both must match.` : 'All otherwise-eligible merchandise.',
    d.excludeDiscounted ? 'Already-discounted merchandise is excluded.' : 'Existing discounts reduce qualifying spend; the POS must separately approve any stacking.',
    `${d.membersOnly ? 'Members only' : 'Reviewed audience'}; ${d.repeat === 'once_per_member' ? 'one award per member' : 'repeatable across distinct qualifying events'}, up to ${d.maxAwardsPerMember} per member and ${d.maxAwardsTotal} overall.`,
    `${d.startsOn} through ${d.endsOn}, inclusive, in ${d.timezone}.`, 'Audience eligibility and marketing consent are separate. This plan does not issue rewards or send messages.'];
}
export function requiredProgrammeCapabilities(d: ProgrammeDraft): string[] {
  const draft = parseProgrammeDraft(d);
  const required = ['reviewed audience and source coverage', 'versioned issuance and budget limits', 'atomic reservation/redemption and replay protection', 'refund/cancellation reconciliation'];
  if (draft.reward.kind === 'gift') required.push('verified gift inventory and actual unit cost');
  if (draft.reward.kind === 'experience') required.push('existing event/experience booking capacity');
  if (draft.reward.kind === 'multi_buy') required.push('POS support for the exact multi-buy allocation rule');
  if (draft.trigger === 'membership_join') required.push('verified membership event and second-visit rule');
  if (draft.trigger === 'milestone') required.push('verified qualifying transaction count and reversal policy');
  if (draft.trigger === 'referral') required.push('distinct member identities and approved referral qualification');
  if (draft.trigger === 'birthday') required.push('voluntary birthday data and once-per-year/leap-day rule');
  if (draft.trigger === 'staff_kindness') required.push('staff/location permissions and daily allowance');
  return required;
}
export function simulateProgramme(value: ProgrammeDraft, scenario: PlanningScenario): ProgrammePreview {
  const d = parseProgrammeDraft(value), s = record(scenario);
  const output: ProgrammePreview = { simulationOnly: true, state: 'needs_review', reason: '', eligibleSubtotalMinor: 0, discountMinor: 0, rewardCostMinor: null, giftUnits: 0, excludedLineIds: [], warnings: ['Simulation only. This is not a till authorization or an issued benefit.'] };
  const stop = (state: ProgrammePreview['state'], reason: string): ProgrammePreview => ({ ...output, state, reason });
  try {
    if (typeof s.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s.occurredAt) || !Number.isFinite(Date.parse(s.occurredAt))) return stop('needs_review', 'A valid timestamp with timezone is required.');
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: d.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(s.occurredAt));
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    if (day < d.startsOn || day > d.endsOn) return stop('ineligible', 'Outside the programme date window.');
    if (s.currency !== d.currency) return stop('needs_review', 'The basket and programme currencies must match; no conversion is assumed.');
    if (d.membersOnly && s.isMember !== true) return stop(s.isMember === false ? 'ineligible' : 'needs_review', 'Confirmed membership is required.');
    if (s.matchesAudience !== true) return stop(s.matchesAudience === false ? 'ineligible' : 'needs_review', 'The customer must match the reviewed audience.');
    if (s.triggerVerified !== true) return stop(s.triggerVerified === false ? 'ineligible' : 'needs_review', 'Qualifying event evidence is required.');
    if (s.memberAwards === null || s.totalAwards === null) return stop('needs_review', 'Award history is unknown.');
    const memberAwards = integer(s.memberAwards, 'Member awards'), totalAwards = integer(s.totalAwards, 'Total awards');
    if (memberAwards >= d.maxAwardsPerMember || totalAwards >= d.maxAwardsTotal) return stop('ineligible', 'An award limit has been reached.');
    if (!Array.isArray(s.lines) || s.lines.length > 1000) return stop('needs_review', 'Provide at most 1,000 verified basket lines.');
    const units: Array<{ price: number; quantity: number }> = [], ids = new Set<string>();
    let subtotal = 0;
    for (const value of s.lines) {
      const l = record(value), id = text(l.id, 'Line ID'), sku = text(l.sku, 'SKU');
      if (ids.has(id)) return stop('needs_review', 'Duplicate basket line IDs were supplied.');
      ids.add(id);
      const kind = oneOf(l.kind, ['goods', 'gift_card', 'tax', 'shipping', 'fee'], 'line type');
      const quantity = integer(l.quantity, 'Quantity', 1, 10000), price = integer(l.unitPriceMinor, 'Unit price'), discount = integer(l.discountMinor, 'Existing line discount');
      const gross = price * quantity;
      if (!Number.isSafeInteger(gross) || discount > gross) return stop('needs_review', 'A basket amount is unsafe or its discount exceeds its value.');
      if (kind !== 'goods' || (d.reward.kind === 'gift' && sku === d.reward.sku) || (d.excludeDiscounted && discount > 0) || (d.eligibleSkus.length && !d.eligibleSkus.includes(sku))) { output.excludedLineIds.push(id); continue; }
      if (d.eligibleDepartments.length) {
        if (typeof l.department !== 'string' || !l.department.trim()) return stop('needs_review', 'A required product department is missing.');
        if (!d.eligibleDepartments.includes(l.department.trim())) { output.excludedLineIds.push(id); continue; }
      }
      subtotal += gross - discount;
      if (!Number.isSafeInteger(subtotal) || subtotal > MAX_MONEY) return stop('needs_review', 'The eligible subtotal exceeds the supported exact arithmetic limit.');
      units.push({ price, quantity });
    }
    output.eligibleSubtotalMinor = subtotal;
    if (d.threshold === 'more_than' ? subtotal <= d.minimumSpendMinor : subtotal < d.minimumSpendMinor) return stop('ineligible', 'Minimum eligible merchandise spend was not reached.');
    const r = d.reward;
    if (r.kind === 'fixed') output.discountMinor = Math.min(r.amountMinor, subtotal);
    if (r.kind === 'percentage') output.discountMinor = Math.min(Number((BigInt(subtotal) * BigInt(r.basisPoints) + 5000n) / 10000n), r.capMinor, subtotal);
    if (r.kind === 'multi_buy') {
      let free = Math.floor(units.reduce((n, l) => n + l.quantity, 0) / r.groupSize) * r.freeUnits;
      if (!free) return stop('ineligible', 'Not enough eligible whole units for the multi-buy.');
      let saving = 0;
      for (const unit of units.sort((a, b) => a.price - b.price)) { const count = Math.min(free, unit.quantity); saving += count * unit.price; free -= count; if (!free) break; }
      output.discountMinor = Math.min(saving, r.capMinor, subtotal);
    }
    if (r.kind === 'gift') {
      if (s.giftUnitsAvailable === null || s.giftUnitsAvailable === undefined) return stop('needs_review', 'Gift availability has not been verified.');
      if (integer(s.giftUnitsAvailable, 'Available gifts') < r.units) return stop('ineligible', 'Not enough gift inventory.');
      output.giftUnits = r.units;
      output.rewardCostMinor = r.costMinor === null ? null : integer(r.units * r.costMinor, 'Total gift cost');
    } else if (r.kind === 'experience') {
      if (s.placesAvailable === null || s.placesAvailable === undefined) return stop('needs_review', 'Experience capacity has not been verified.');
      if (integer(s.placesAvailable, 'Available places') < 1) return stop('ineligible', 'No experience places remain.');
      output.rewardCostMinor = r.costMinor;
    } else {
      if (!output.discountMinor) return stop('ineligible', 'There is no positive eligible discount.');
      output.rewardCostMinor = output.discountMinor;
    }
    if (output.rewardCostMinor === null) output.warnings.push('Actual reward cost is unknown; profit and budget sufficiency cannot be calculated.');
    if (d.budgetMinor !== null) {
      if (output.rewardCostMinor === null || s.remainingBudgetMinor === null || s.remainingBudgetMinor === undefined) return stop('needs_review', 'Known reward cost and current budget availability are required.');
      const remaining = integer(s.remainingBudgetMinor, 'Remaining budget');
      if (remaining > d.budgetMinor) return stop('needs_review', 'Remaining budget exceeds the approved programme budget.');
      if (output.rewardCostMinor > remaining) return stop('ineligible', 'Insufficient remaining programme budget.');
    } else output.warnings.push('No programme budget is configured. Set and approve one before launch.');
    return stop('eligible', 'The supplied scenario satisfies these planning rules. Server-side verification and atomic redemption are still required.');
  } catch (error) { return stop('needs_review', error instanceof Error ? error.message : 'Invalid scenario data.'); }
}
