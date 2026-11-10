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
 const db={from:(table:string)=>{let imported=false;const q={select:()=>q,eq:()=>q,neq:()=>q,lte:()=>q,order:()=>q,in:()=>{imported=true;return q;},range:async()=>({data:table==='customer_purchase_line_items'?dated:imported?[{id:'ideal-ledger',source:'ideal'},{id:'shop-ledger',source:'shopify'}]:[],error:null})};return q;}} as unknown as PersistenceClient;
 expect((await loadCompanyAnalysisFacts(db,'t','2026-02-01T00:00:00Z')).map(row=>row.id)).toEqual(['native','pos']);
});

it('reproduces the legacy completed YTD shape without row-level source hash',async()=>{
 const legacy={...old,id:'legacy-ytd',source_filename:'original-ytd.csv',source_sha256:'a'.repeat(64),source_period_start:'2026-01-01',source_period_end:'2026-10-14',created_at:'2026-10-16T00:00:00Z',completed_at:'2026-10-16T00:00:00Z'};
 const legacyEvent={...event,import_id:legacy.id,created_at:'2026-10-16T00:00:00Z',raw_data:{kind:'purchase_summary',currency:'CAD',period_start:legacy.source_period_start,period_end:legacy.source_period_end,source_filename:legacy.source_filename,dated_transactions:false,columns:[],items:[['p','Pot','Nursery',1,10,1]]}};
 await expect(loadReportedEvidence(client([legacyEvent],[legacy]),'t','2026-10-22T00:00:00Z',{historicalImportIds:[legacy.id]})).rejects.toThrow('Report facts do not match their completed source ledger.');
});

import {loadReportedCustomerGrowth,reportedCustomerGrowth} from '../../../../supabase/functions/_shared/customer-intelligence/reported-customer-growth';
const growthSource=(id:string,year:number,end=`${year}-12-31`)=>({...old,id,source_sha256:id+'-hash',source_filename:id+'.csv',source_period_start:`${year}-01-01`,source_period_end:end,report_type:'customer_sales_summary',created_at:'2026-10-20T00:00:00Z',completed_at:'2026-10-20T01:00:00Z',reconciliation:{coverage_complete:false}});
const growthSources=[growthSource('earlier',2023),growthSource('prior',2024),growthSource('current',2025)];
const growthEvent=(id:string,source:typeof growthSources[number],customer:string|null,amount:number,quantity=1)=>({...event,id,import_id:source.id,customer_id:customer,created_at:'2026-10-20T00:30:00Z',raw_data:{kind:'purchase_summary',source_sha256:source.source_sha256,period_start:source.source_period_start,period_end:source.source_period_end,currency:'CAD',items:[['p','Synthetic plant','Nursery',quantity,amount,1]]}});
const growthEvents=[growthEvent('earlier-rec',growthSources[0],'recovered',30),growthEvent('prior-ret',growthSources[1],'retained',80),growthEvent('prior-lost',growthSources[1],'absent',50),growthEvent('now-ret',growthSources[2],'retained',120),growthEvent('now-rec',growthSources[2],'recovered',90),growthEvent('now-first',growthSources[2],'first',60)];
const growthPopulation=['retained','absent','recovered','first'];
function growthClient(imports:object[],events:object[]){
 const calls:string[]=[];
 const db={from:(table:string)=>{calls.push(table);const filters:Array<[string,unknown]>=[];const q={select:()=>q,eq:(key:string,value:unknown)=>{filters.push([key,value]);return q;},lte:()=>q,order:()=>q,gt:()=>q,range:async()=>({data:(table==='customer_intelligence_imports'?imports:events).filter(row=>filters.every(([key,value])=>(row as Record<string,unknown>)[key]===value)),error:null})};return q;}} as unknown as PersistenceClient;
 return {db,calls};
}
const eventsForDb=(rows= growthEvents)=>rows.map(row=>({...row,event_type:'purchase_summary'}));
it('loads real summary architecture with no pos_orders or invented receipts',async()=>{
 const {db,calls}=growthClient(growthSources,eventsForDb());
 const result=await loadReportedCustomerGrowth(db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation);
 expect(result?.counts).toEqual({previous:2,current:3,retained:1,recovered:1,firstObserved:1,notReturned:1,net:1});
 expect(result?.averages).toEqual({retained:120,recovered:90,firstObserved:60});
 expect(result?.firstEver).toBeNull();expect(result?.estimatedAnnualSalesEffect).toBeNull();
 expect(calls).not.toContain('pos_orders');expect(calls).not.toContain('customer_purchase_line_items');
});
it('keeps Nov2 spending separate from Oct14 product-summary coverage and exposes unresolved source metadata',async()=>{
 const current=growthSource('ytd',2026,'2026-10-14');
 const spending={...growthSource('spending',2026,'2026-11-02'),report_type:'customer_spending',rejected_row_count:2,reconciliation:{coverage_complete:false,unmatched_source_rows:true,unmatched_amount:true}};
 const {db}=growthClient([growthSources[2],current,spending],eventsForDb([...growthEvents.filter(row => row.import_id === growthSources[2].id),growthEvent('ytd-ret',current,'retained',30)]));
 const result=await loadReportedCustomerGrowth(db,'t','2026-11-09T00:00:00Z',2026,'CAD',growthPopulation);
 expect(result?.current.source_period_end).toBe('2026-10-14');expect(result?.spendingSources[0].source_period_end).toBe('2026-11-02');
 expect(result?.spendingSources[0].reconciliation).toMatchObject({unmatched_source_rows:true,coverage_complete:false});
});
it('deduplicates exact facts, nets refunds, and excludes fully returned activity without calling first-observed first-ever',async()=>{
 const refund=growthEvent('refund',growthSources[2],'first',-60,-1);
 const {db}=growthClient(growthSources,eventsForDb([...growthEvents,refund]));
 const result=await loadReportedCustomerGrowth(db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation);
 expect(result?.counts.current).toBe(2);expect(result?.counts.firstObserved).toBe(0);expect(result?.firstEver).toBeNull();
});
it('shows excluded unknown identities rather than certifying their absence',async()=>{
 const {db}=growthClient(growthSources,eventsForDb([...growthEvents,growthEvent('unlinked',growthSources[2],null,50),growthEvent('deleted',growthSources[2],'unavailable',50)]));
 const result=await loadReportedCustomerGrowth(db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation);
 expect(result?.loadedFactExclusions).toEqual({unlinkedSummaries:1,unavailableCustomerIds:1});expect(result?.counts.current).toBe(3);
});
it('does not revive a replaced source or combine demo evidence',async()=>{
 const replacement={...growthSources[2],id:'replacement',source_sha256:'replacement-hash',reconciliation:{superseded_sources:[{sourceSha:growthSources[2].source_sha256,periodStart:'2025-01-01',periodEnd:'2025-12-31'}]}};
 const demo={...growthSources[2],id:'demo',source:'demo'};
 const {db}=growthClient([replacement,...growthSources,demo],eventsForDb([...growthEvents,growthEvent('replacement-ret',replacement,'retained',25),{...growthEvent('demo-row',demo,'first',999),source:'demo'}]));
 const result=await loadReportedCustomerGrowth(db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation);
 expect(result?.counts.current).toBe(1);expect(result?.averages.retained).toBe(25);
});
it('fails closed for unavailable annual pair, hash mismatch and partial overlap',async()=>{
 const missing=growthClient([growthSources[2]],eventsForDb());
 await expect(loadReportedCustomerGrowth(missing.db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation)).rejects.toThrow('No supported report pair');
 const bad=growthClient(growthSources,eventsForDb([{...growthEvents[0],raw_data:{...growthEvents[0].raw_data,source_sha256:'wrong'}},...growthEvents.slice(1)]));
 await expect(loadReportedCustomerGrowth(bad.db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation)).rejects.toThrow('ledger');
 const overlap={...growthSources[2],id:'overlap',source_period_start:'2024-06-01',source_period_end:'2025-06-30'};
 await expect(loadReportedCustomerGrowth(growthClient([overlap,...growthSources],eventsForDb()).db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation)).rejects.toThrow('Overlapping');
});
it('handles zero prior net purchasers without infinite contributions',()=>{
 const report=reportedCustomerGrowth([],growthPopulation,'t',growthSources,'current','prior','CAD');
 expect(report.percentages.net).toBeNull();expect(report.counts.current).toBe(0);
});

it('separates loaded-fact exclusions and per-source quarantined groups without inventing unique people',async()=>{
 const sources=growthSources.map((source,i)=>({...source,reconciliation:i===0?{}:{quarantinedGroups:i===1?0:3}}));
 const unlinked=growthEvent('anonymous-current',sources[2],null,20);
 unlinked.raw_data.items.push(['q','Synthetic pot','Nursery',1,30,2]);
 const extras=[unlinked,growthEvent('anonymous-prior',sources[1],null,10),growthEvent('unavailable-current',sources[2],'unavailable',30),growthEvent('unavailable-prior',sources[1],'unavailable',40)];
 const {db}=growthClient(sources,eventsForDb([...growthEvents,...extras]));
 const result=await loadReportedCustomerGrowth(db,'t','2026-11-09T00:00:00Z',2025,'CAD',growthPopulation);
 expect(result?.loadedFactExclusions).toEqual({unlinkedSummaries:2,unavailableCustomerIds:1});
 expect(result?.sourceQuarantines).toEqual([{importId:'earlier',groups:null},{importId:'prior',groups:0},{importId:'current',groups:3}]);
 expect(result?.counts.current).toBe(3);
});
it.each([-1,1.5,'3',null])('keeps invalid quarantine metadata %s unknown rather than zero',value=>{
 const sources=growthSources.map(source=>({...source,reconciliation:{quarantinedGroups:value}}));
 expect(reportedCustomerGrowth([],growthPopulation,'t',sources,'current','prior','CAD').sourceQuarantines.every(row=>row.groups===null)).toBe(true);
});
