import {phoenixPeriod} from "./phoenix-periods";
import {localDate} from '../../../supabase/functions/_shared/customer-intelligence/purchase-exploration';
type Row=Record<string,unknown>;
const isRow=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
const kinds=new Set(['customer_exploration','customer_reported_comparison','customer_audience','customer_audiences','customer_growth','customer_evidence','customer_basket','customer_ranking','customer_opportunities']);
export function customerAnalysisPayload(value:unknown):Row|null {
  let current=value;
  for(let i=0;i<4;i++){if(!isRow(current))return null;if(kinds.has(String(current.kind)))return current;current=current.data??current.result;}
  return null;
}

export function defaultGrowthDates(now=new Date(), timezone="America/Vancouver") {
  const period = phoenixPeriod("mtd",now,timezone);
  return {current_start:period.current_start,current_end:period.current_end,baseline_start:period.baseline_start,baseline_end:period.baseline_end};
}
