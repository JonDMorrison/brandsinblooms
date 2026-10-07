import {localDate} from '../../../supabase/functions/_shared/customer-intelligence/purchase-exploration';
type Row=Record<string,unknown>;
const isRow=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
const kinds=new Set(['customer_exploration','customer_growth','customer_evidence','customer_basket','customer_ranking','customer_opportunities']);
export function customerAnalysisPayload(value:unknown):Row|null {
  let current=value;
  for(let i=0;i<4;i++){if(!isRow(current))return null;if(kinds.has(String(current.kind)))return current;current=current.data??current.result;}
  return null;
}

export function defaultGrowthDates(now=new Date(),timezone='America/Vancouver') {
  const [y,m]=localDate(now.toISOString(),timezone)!.split('-').map(Number);
  const end=new Date(Date.UTC(y,m-1,0)),start=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),1));
  const oldStart=new Date(Date.UTC(start.getUTCFullYear()-1,start.getUTCMonth(),1)),oldEnd=new Date(Date.UTC(end.getUTCFullYear()-1,end.getUTCMonth()+1,0));
  return {current_start:start.toISOString().slice(0,10),current_end:end.toISOString().slice(0,10),baseline_start:oldStart.toISOString().slice(0,10),baseline_end:oldEnd.toISOString().slice(0,10)};
}
