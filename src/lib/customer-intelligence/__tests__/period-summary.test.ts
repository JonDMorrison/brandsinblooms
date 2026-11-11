import {describe,it,expect} from 'vitest';
import {periodSummaryFacts,currentSummaryImports} from '../../../../supabase/functions/_shared/customer-intelligence/period-summary';
import {explorePurchases} from '../../../../supabase/functions/_shared/customer-intelligence/purchase-exploration';
const event = {id:'source',tenant_id:'tenant-a',customer_id:'buyer',import_id:'import',source:'ideal',created_at:'2026-10-16T00:00:00Z',raw_data:{kind:'purchase_summary',currency:'CAD',period_start:'2026-01-01',period_end:'2026-10-14',items:[['POT','Outdoor pottery','Pottery',2,60,15]]}};
const facts=()=>periodSummaryFacts([event],'tenant-a');
function search(criteria: object) {return explorePurchases({tenantId:'tenant-a',userId:'user',conversationId:'conversation',timezone:'America/Vancouver',population:['buyer','unknown'],facts:facts(),label:'Pottery buyers',rule:{mode:'purchased',product:'pottery',...criteria},now:'2026-10-17T00:00:00Z'});}
describe('Reported period evidence',()=>{
 it('preserves the report period without fabricating a purchase date or transaction',()=>{expect(facts()[0]).toMatchObject({purchased_at:null,evidence_kind:'period_summary',source_period_start:'2026-01-01'});expect(facts()[0].external_transaction_id).toBeUndefined();});
 it('finds buyers across the complete source period and keeps missing history unknown',()=>{const r=search({start_date:'2026-01-01',end_date:'2026-10-14'});expect(r.included_ids).toEqual(['buyer']);expect(r.unknown_ids).toEqual(['unknown']);});
 it('does not claim a particular month from a year-to-date aggregate',()=>{expect(search({start_date:'2026-10-01',end_date:'2026-10-14'}).unknown_ids).toEqual(['buyer','unknown']);});
 it('can exclude a disjoint source period without inventing a date',()=>{expect(search({start_date:'2025-01-01',end_date:'2025-12-31'}).excluded_ids).toEqual(['buyer']);});
 it('rejects malformed source rows and another tenant',()=>{expect(()=>periodSummaryFacts([event],'tenant-b')).toThrow('Cross-company');expect(()=>periodSummaryFacts([{...event,raw_data:{...event.raw_data,items:[['bad']]}}],'tenant-a')).toThrow('invalid fields');});
});

it('does not double-count overlapping weekly cumulative exports',()=>{
 const row=(id:string,start:string,end:string)=>({id,source:'ideal',source_period_start:start,source_period_end:end});
 expect(currentSummaryImports([row('new','2026-01-01','2026-10-14'),row('old','2026-01-01','2026-10-07'),row('prior','2025-01-01','2025-12-31')]).map(r=>r.id)).toEqual(['new','prior']);
 expect(()=>currentSummaryImports([row('new','2026-05-01','2026-10-14'),row('old','2026-01-01','2026-06-30')])).toThrow('Overlapping');
});

it('explicit replacement wins regardless of ledger creation order and validates retired periods',()=>{
 const old={id:'old',source:'ideal',source_sha256:'old-hash',source_period_start:'2026-01-01',source_period_end:'2026-10-14'};
 const replacement={...old,id:'replacement',source_sha256:'new-hash',reconciliation:{superseded_sources:[{sourceSha:'old-hash',periodStart:old.source_period_start,periodEnd:old.source_period_end}]}};
 expect(currentSummaryImports([old,replacement]).map(r=>r.id)).toEqual(['replacement']);
 expect(()=>currentSummaryImports([{...old,source_period_start:'2026-02-30'},{...replacement,reconciliation:{superseded_sources:[{sourceSha:'old-hash',periodStart:'2026-02-30',periodEnd:old.source_period_end}]}}])).toThrow();
});
