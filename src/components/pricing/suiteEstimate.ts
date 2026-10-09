export const SUITE_PRICE_BOOK = Object.freeze({
  version: "suite-exploration-2026-10-09-v1", currency: "USD", status: "proposal",
  site: 7900, commerce: 5000, crm: [19900, 29900, 49900], pos: 19900,
  extraRegister: 2900, growthDiscount: 2900, completeDiscount: 7800,
  emailAllowances: [30000, 90000, 150000], smsSegment: 3, emailOverage: 0.2,
  annualMultiplier: 0.85,
} as const);

export type PosChoice = "keep" | "replace" | "none" | "unsure";
export interface SuiteConfiguration {
  site: boolean; commerce: boolean; crm: boolean; pos: PosChoice; provider: string;
  annual: boolean; websites: number; contacts: number; locations: number;
  registers: number; emails: number; sms: number; segments: number;
  retained: number; current: number; setup: number; hardware: number;
  cardVolume: number; transactions: number; oldRate: number; newRate: number;
  oldFixed: number; newFixed: number; orderValue: number; grossMargin: number;
  platformVolume: number; oldPlatform: number; newPlatform: number;
}
export const DEFAULT_SUITE_CONFIGURATION: SuiteConfiguration = {
  site: true, commerce: false, crm: true, pos: "keep", provider: "CounterPoint",
  annual: false, websites: 1, contacts: 5000, locations: 1, registers: 2,
  emails: 20000, sms: 0, segments: 1, retained: 0, current: 0, setup: 0, hardware: 0,
  cardVolume: 0, transactions: 0, oldRate: 2.5, newRate: 2.5,
  oldFixed: 0.1, newFixed: 0.1, orderValue: 50, grossMargin: 40,
  platformVolume: 0, oldPlatform: 0, newPlatform: 0,
};
const bounded = (value: number, max: number, min = 0) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const integer = (value: number, max: number, min = 0) => Math.floor(bounded(value, max, min));
const cents = (value: number) => Math.round(bounded(value, 100000000) * 100);
export const usd = (value: number) => new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 2}).format(value / 100);

export function normalizeConfiguration(c: SuiteConfiguration): SuiteConfiguration {
  return {
    ...c, site: c.site || c.commerce,
    websites: integer(c.websites, 20, 1), contacts: integer(c.contacts, 1000000),
    locations: integer(c.locations, 100, 1), registers: integer(c.registers, 20, 1),
    emails: integer(c.emails, 10000000), sms: integer(c.sms, 10000000), segments: integer(c.segments, 3, 1),
    retained: bounded(c.retained, 1000000), current: bounded(c.current, 1000000),
    setup: bounded(c.setup, 1000000), hardware: bounded(c.hardware, 1000000),
    cardVolume: bounded(c.cardVolume, 100000000), transactions: integer(c.transactions, 10000000),
    oldRate: bounded(c.oldRate, 20), newRate: bounded(c.newRate, 20),
    oldFixed: bounded(c.oldFixed, 10), newFixed: bounded(c.newFixed, 10),
    orderValue: bounded(c.orderValue, 1000000), grossMargin: bounded(c.grossMargin, 100),
    platformVolume: bounded(c.platformVolume, 100000000), oldPlatform: bounded(c.oldPlatform, 20), newPlatform: bounded(c.newPlatform, 20),
  };
}

export function calculateSuiteEstimate(raw: SuiteConfiguration) {
  const c = normalizeConfiguration(raw), p = SUITE_PRICE_BOOK;
  const pos = c.pos === "replace", band = c.contacts > 15000 ? 2 : c.contacts > 5000 ? 1 : 0;
  const siteCost = c.site ? c.websites * (p.site + (c.commerce ? p.commerce : 0)) : 0;
  const crmCost = c.crm ? p.crm[band] : 0;
  const posCost = pos ? c.locations * (p.pos + Math.max(0, c.registers - 2) * p.extraRegister) : 0;
  const discount = c.site && c.crm ? (pos ? p.completeDiscount : p.growthDiscount) : 0;
  const base = siteCost + crmCost + posCost - discount;
  const software = Math.round(base * (c.annual ? p.annualMultiplier : 1));
  const allowance = c.crm ? p.emailAllowances[band] : 0;
  const email = c.crm ? Math.round(Math.max(0, c.emails - allowance) * p.emailOverage) : 0;
  const segments = c.crm ? c.sms * c.segments : 0, sms = segments * p.smsSegment;
  const bloom = software + email + sms;
  const payments = Math.round(c.cardVolume * c.newRate + c.transactions * c.newFixed * 100 + c.platformVolume * c.newPlatform);
  const oldPayments = Math.round(c.cardVolume * c.oldRate + c.transactions * c.oldFixed * 100 + c.platformVolume * c.oldPlatform);
  const total = bloom + cents(c.retained) + payments;
  const firstYear = total * 12 + cents(c.setup) + cents(c.hardware);
  const difference = total - cents(c.current) - oldPayments;
  const profit = c.orderValue * c.grossMargin;
  const hasProducts = c.site || c.crm || pos;
  const name = !hasProducts ? "Choose your starting point" : c.site && c.crm ? pos ? "Complete" : "Growth" : c.site && !pos && !c.crm ? "Website" : !c.site && c.crm && !pos ? "CRM" : !c.site && !c.crm && pos ? "POS" : "Your combination";
  const quoteRequired = c.crm && c.contacts > 25000;
  const rows = [
    ...(c.site ? [{label: `BloomSites${c.commerce ? " + Commerce" : ""} · ${c.websites} website${c.websites > 1 ? "s" : ""}`, cents: siteCost}] : []),
    ...(c.crm ? [{label: `CRM · up to ${[5000, 15000, 25000][band].toLocaleString()} marketable contacts`, cents: crmCost}] : []),
    ...(pos ? [{label: `POS · ${c.locations} location${c.locations > 1 ? "s" : ""}, ${c.registers} registers each`, cents: posCost}] : []),
    ...(discount ? [{label: "Suite saving · applied once", cents: -discount}] : []),
    ...(c.annual ? [{label: "Annual software saving · 15%", cents: software - base}] : []),
    ...(c.crm ? [{label: `Email overage · ${allowance.toLocaleString()} sends included`, cents: email}, {label: `SMS · ${segments.toLocaleString()} segments at proposed $0.03`, cents: sms}] : []),
  ];
  return {c, name, hasProducts, quoteRequired, rows, software, allowance, email, sms, segments, bloom, total, payments, firstYear, difference,
    annualPrepayment: software * 12,
    recurringOrders: profit > 0 ? Math.ceil(Math.max(0, difference) / profit) : null,
    firstYearOrders: profit > 0 ? Math.ceil(Math.max(0, difference + (cents(c.setup) + cents(c.hardware)) / 12) / profit) : null,
  };
}

export function suiteEstimateSummary(c: SuiteConfiguration) {
  const e = calculateSuiteEstimate(c);
  return [
    `Please review my ${e.name} setup. Draft USD estimate, not a purchase.`,
    `Price book: ${SUITE_PRICE_BOOK.version}.`,
    `Website: ${e.c.site ? `${e.c.websites}${e.c.commerce ? " with commerce" : ""}` : "none"}. CRM: ${e.c.crm ? `${e.c.contacts} marketable contacts` : "none"}.`,
    `POS: ${e.c.pos}${e.c.pos === "keep" ? ` (${e.c.provider})` : e.c.pos === "replace" ? `, ${e.c.locations} locations / ${e.c.registers} registers each` : ""}.`,
    `Billing: ${e.c.annual ? "annual software" : "monthly"}; BloomSuite + entered messaging: ${usd(e.bloom)}/month${e.quoteRequired ? " budget floor; contact quote needed" : ""}.`,
    `Monthly usage: ${e.c.crm ? e.c.emails : 0} emails / ${e.segments} SMS segments.`,
    `Entered retained tools: ${usd(e.c.retained * 100)}/mo; payments/platform fees: ${usd(e.payments)}/mo.`,
    `Total budget: ${usd(e.total)}/mo; first year ${usd(e.firstYear)} with ${usd((e.c.setup + e.c.hardware) * 100)} entered setup/hardware.`,
    "Please confirm regional pricing, integrations, setup, hardware and payment costs.",
  ].join("\n");
}
