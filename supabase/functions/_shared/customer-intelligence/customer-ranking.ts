import {finiteNumber} from './purchase-exploration.ts';
export const SCORE_KEYS = ['value','quantity','breadth','frequency','overall','recency','trend'] as const;
export type ScoreKey = typeof SCORE_KEYS[number];
export type ScoreWeights = Record<ScoreKey, number>;
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {value:40, quantity:20, breadth:15, frequency:15, overall:10, recency:0, trend:0};
export interface RankingRow {
  customer_id: string; first_name?: string | null; last_name?: string | null; email?: string | null;
  lifetime_value: number | string | null; purchase_frequency: number | string | null;
  days_since_last_purchase: number | string | null; purchase_velocity: number | string | null;
  total_quantity: number | string | null; departments_shopped: number | string | null;
  category_spend: Record<string, unknown> | null; department_spend: Record<string, unknown> | null;
}
export function parseScoreWeights(value: unknown): ScoreWeights {
  if (value === undefined || value === null) return {...DEFAULT_SCORE_WEIGHTS};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Weights must be an object.');
  const provided = value as Record<string, unknown>;
  for (const key of Object.keys(provided)) if (!(SCORE_KEYS as readonly string[]).includes(key)) throw new Error(`Unknown scoring factor: ${key}.`);
  // Explicit weights replace the default, rather than silently adding other factors.
  const weights = Object.fromEntries(SCORE_KEYS.map((key) => [key, provided[key] ?? 0])) as ScoreWeights;
  if (!Object.values(weights).every((weight) => typeof weight === 'number' && Number.isFinite(weight) && weight >= 0 && weight <= 100) || Object.values(weights).reduce((a,b) => a+b,0) <= 0) throw new Error('Choose weights between 0 and 100 with a positive total.');
  return weights;
}
export function rankCustomerPopulation(rows: RankingRow[], input: {dimension?: string; dimension_value?: string; weights?: unknown; limit?: number} = {}) {
  const dimension = input.dimension ?? 'overall', value = input.dimension_value;
  if (!['overall','category','department'].includes(dimension)) throw new Error('Unsupported ranking dimension.');
  if (dimension !== 'overall' && !value?.trim()) throw new Error('Name the category or department to rank.');
  const weights = parseScoreWeights(input.weights), active = SCORE_KEYS.filter((key) => weights[key] > 0);
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('The result limit must be between 1 and 500.');
  const focused = (row: RankingRow) => {
    if (dimension === 'overall') return finiteNumber(row.lifetime_value);
    const entries = dimension === 'category' ? row.category_spend : row.department_spend;
    if (!entries || !Object.keys(entries).length) return null;
    const match = Object.keys(entries).find((key) => key.trim().toLowerCase() === value!.trim().toLowerCase());
    return match ? finiteNumber(entries[match]) : 0;
  };
  const candidates = rows.map((row) => ({row, raw: {value:focused(row), quantity:finiteNumber(row.total_quantity), breadth:finiteNumber(row.departments_shopped), frequency:finiteNumber(row.purchase_frequency), overall:finiteNumber(row.lifetime_value), recency:finiteNumber(row.days_since_last_purchase), trend:finiteNumber(row.purchase_velocity)}}));
  const eligible = candidates.filter(({raw}) => active.every((key) => raw[key] !== null));
  const ranges = Object.fromEntries(active.map((key) => [key, eligible.map(({raw}) => raw[key]!).sort((a,b) => a-b)])) as Partial<Record<ScoreKey, number[]>>;
  function percentile(key: ScoreKey, value: number): number {
    const values = ranges[key]!;
    if (values.length === 1 || values[0] === values[values.length-1]) return 50;
    let lo=0,hi=values.length;
    while(lo<hi){const m=(lo+hi)>>>1;if(values[m]<value)lo=m+1;else hi=m;}const first=lo;
    lo=0;hi=values.length;while(lo<hi){const m=(lo+hi)>>>1;if(values[m]<=value)lo=m+1;else hi=m;}
    const rank=(first+(lo-1))/2/(values.length-1)*100;
    return key === 'recency' ? 100-rank : rank;
  }
  const round = (number: number) => Math.round(number*100)/100;
  const scored = eligible.map(({row,raw}) => {
    const components = Object.fromEntries(active.map((key) => [key, percentile(key, raw[key]!)])) as Partial<Record<ScoreKey, number>>;
    const score = active.reduce((sum,key) => sum + components[key]! * weights[key],0)/active.reduce((sum,key)=>sum+weights[key],0);
    return {customer_id:row.customer_id, name:[row.first_name,row.last_name].filter(Boolean).join(' ') || row.email || 'Customer', score:round(score), components:Object.fromEntries(active.map(key=>[key,round(components[key]!)])), source_values:raw, weights};
  }).sort((a,b) => b.score-a.score || a.customer_id.localeCompare(b.customer_id));
  return {kind:'customer_ranking', dimension, dimension_value:value ?? null, weights,
    method:'Percentile ranks with average ranks for ties. Equal values score 50. Lower recency is better. Only focused spending changes with the selected category/department; the other factors describe the whole customer.',
    scanned_customers:rows.length, eligible_customers:scored.length, shown_customers:Math.min(limit,scored.length),
    omitted_by_limit:Math.max(0,scored.length-limit), rows:scored.slice(0,limit),
    unranked: candidates.filter(({raw})=>active.some(key=>raw[key]===null)).map(({row,raw})=>({customer_id:row.customer_id, missing_factors:active.filter(key=>raw[key]===null)})),
    no_hidden_filters:'No consent, persona, or contact-channel filters were applied. Campaign send eligibility is checked separately.'};
}
