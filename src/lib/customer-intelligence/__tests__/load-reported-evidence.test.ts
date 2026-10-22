import {it,expect} from 'vitest';
import {loadReportedEvidence} from '../../../../supabase/functions/_shared/customer-intelligence/load-reported-evidence';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
const old={id:'old',tenant_id:'t',source:'ideal',source_sha256:'oldhash',status:'completed',source_period_start:'2025-01-01',source_period_end:'2025-12-31',created_at:'2026-01-01T00:00:00Z',completed_at:'2026-01-02T00:00:00Z'};
const replacement={...old,id:'new',source_sha256:'newhash',reconciliation:{superseded_sources:[{sourceSha:'oldhash',periodStart:old.source_period_start,periodEnd:old.source_period_end}]}};
const event={id:'e',tenant_id:'t',source:'ideal',customer_id:'c',import_id:'old',created_at:'2026-01-02T00:00:00Z',raw_data:{kind:'purchase_summary',source_sha256:'oldhash',period_start:'2025-01-01',period_end:'2025-12-31',currency:'CAD',items:[['p','Pot','Nursery',1,10,1]]}};
function client(events:object[],ledger:object[]=[old,replacement]){return {from:(table:string)=>{let ids:string[]|undefined;const q={select:()=>q,eq:()=>q,lte:()=>q,order:()=>q,in:(_key:string,value:string[])=>{ids=value;return q;},range:async()=>({data:table==='customer_intelligence_imports'?ledger:events.filter(row=>!ids||ids.includes((row as typeof event).import_id)),error:null})};return q;}} as unknown as PersistenceClient;}
it('selects replacement globally before customer filtering without reviving omitted customers',async()=>{const result=await loadReportedEvidence(client([event]),'t','2026-02-01T00:00:00Z',{customerIds:['c']});expect(result.activeImportIds).toEqual(['new']);expect(result.facts).toEqual([]);});
it('explicit historical source preserves earlier evidence independently of active cumulative selection',async()=>{const result=await loadReportedEvidence(client([event]),'t','2026-02-01T00:00:00Z',{historicalImportIds:['old']});expect(result.facts).toHaveLength(1);expect(result.facts[0].purchased_at).toBeNull();});
it('rejects hash mismatch and invalid calendar cutoff',async()=>{await expect(loadReportedEvidence(client([{...event,raw_data:{...event.raw_data,source_sha256:'wrong'}}]),'t','2026-02-01T00:00:00Z',{historicalImportIds:['old']})).rejects.toThrow('ledger');await expect(loadReportedEvidence(client([]),'t','2026-02-30T00:00:00Z')).rejects.toThrow();});

import {loadCompanyAnalysisFacts} from '../../../../supabase/functions/_shared/customer-intelligence/load-analysis-facts';
it('excludes uncertified Ideal and mismatched native imports while retaining native confirmed and unimported facts',async()=>{
 const dated=[{id:'ideal-null',source:'ideal',import_id:null},{id:'ideal-complete',source:'ideal',import_id:'ideal-ledger'},{id:'wrong',source:'shopify',import_id:'ideal-ledger'},{id:'native',source:'shopify',import_id:'shop-ledger'},{id:'pos',source:'pos',import_id:null}].map(row=>({...row,tenant_id:'t',customer_id:'c'}));
 const db={from:(table:string)=>{let imported=false;const q={select:()=>q,eq:()=>q,lte:()=>q,order:()=>q,in:()=>{imported=true;return q;},range:async()=>({data:table==='customer_purchase_line_items'?dated:imported?[{id:'ideal-ledger',source:'ideal'},{id:'shop-ledger',source:'shopify'}]:[],error:null})};return q;}} as unknown as PersistenceClient;
 expect((await loadCompanyAnalysisFacts(db,'t','2026-02-01T00:00:00Z')).map(row=>row.id)).toEqual(['native','pos']);
});
