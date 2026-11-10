import {describe,it,expect} from 'vitest';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
import {loadIdealMetricProjection} from '../../../../supabase/functions/_shared/customer-intelligence/load-ideal-metric-projection';
const scope={tenantId:'tenant',customerId:'customer',importId:'import',sourceSha256:'a'.repeat(64),startDate:'2025-01-01',endDate:'2025-12-31',timezone:'America/Vancouver',cutoff:'2026-10-22T00:00:00Z'};
const source={id:'import',tenant_id:'tenant',source:'ideal',status:'completed',report_type:'customer_sales',source_sha256:scope.sourceSha256,completed_at:'2026-10-20T00:00:00Z',source_period_start:null,source_period_end:null};
const row=(id:string)=>({id,tenant_id:'tenant',customer_id:'customer',import_id:'import',source:'ideal',created_at:'2026-10-19T00:00:00Z',product_code:'P',product_name:'Plant',sales_category:'Nursery',department:'Garden',net_amount:1,quantity:1,currency:'CAD',purchased_at:'2025-10-14T12:00:00Z',external_transaction_id:id,external_line_id:'1'});
type Row=Record<string,unknown>;
function fixture(rows:Row[],options:{source?:Row;truncate?:boolean;error?:boolean;missingCount?:boolean;changeLedger?:boolean;changeCount?:boolean}={}){
 const calls:unknown[][]=[];let reads=0;
 const client={from:(table:string)=>{
  calls.push(['from',table]);
  const q={abortSignal:(signal:AbortSignal)=>{calls.push(['abortSignal',signal]);return q;},select:(...args:unknown[])=>{calls.push(['select',...args]);return q;},eq:(...args:unknown[])=>{calls.push(['eq',...args]);return q;},lte:(...args:unknown[])=>{calls.push(['lte',...args]);return q;},order:(...args:unknown[])=>{calls.push(['order',...args]);return q;},maybeSingle:async()=>{reads++;return {data:{...(options.source??source),...(options.changeLedger&&reads>1?{source_period_end:'2026-01-01'}:{})},error:null};},range:async(from:number,to:number)=>{
   calls.push(['range',from,to]);return {data:rows.slice(from,options.truncate?from+1:to+1),error:options.error?{message:'private error'}:null,count:options.missingCount?null:rows.length+(options.changeCount&&from>0?1:0)};
  }};return q;
 }} as unknown as Pick<PersistenceClient,'from'>;
 return {client,calls};
}
describe('read-only Ideal projection loader',()=>{
 it('loads all stable pages with explicit scope, exact count, hash and cutoff',async()=>{
  const {client,calls}=fixture(Array.from({length:1001},(_,i)=>row(String(i))));
  expect(await loadIdealMetricProjection(client,scope)).toMatchObject({records:1001,observed_net_amount:1001,distinct_observed_transactions:1001});
  for(const call of [['eq','tenant_id','tenant'],['eq','customer_id','customer'],['eq','import_id','import'],['eq','source_sha256',scope.sourceSha256],['eq','status','completed'],['lte','created_at',scope.cutoff],['order','id'],['range',1000,1999]])expect(calls).toContainEqual(call);
  expect(calls.filter(c=>c[0]==='from').every(c=>['customer_intelligence_imports','customer_purchase_line_items'].includes(String(c[1])))).toBe(true);
 });
 it('uses annual source-event items, not an empty line-item table',async()=>{
  const event={id:'summary',tenant_id:'tenant',customer_id:'customer',import_id:'import',source:'ideal',created_at:'2026-10-19T00:00:00Z',raw_data:{kind:'purchase_summary',currency:'CAD',period_start:'2025-01-01',period_end:'2025-12-31',items:[['P','Plant','Nursery',2,10.25,1]]}};
  const {client,calls}=fixture([event],{source:{...source,report_type:'customer_sales_summary',source_period_start:scope.startDate,source_period_end:scope.endDate}});
  expect(await loadIdealMetricProjection(client,scope)).toMatchObject({observed_net_amount:10.25,observed_quantity:2,distinct_observed_transactions:null,evidence_kind:'period_summary'});
  expect(calls).toContainEqual(['from','customer_intelligence_source_events']);expect(calls).toContainEqual(['eq','event_type','purchase_summary']);
  expect(calls).not.toContainEqual(['from','customer_purchase_line_items']);
 });
 it('returns unknown rather than zero when no visible facts exist',async()=>{
  expect(await loadIdealMetricProjection(fixture([]).client,scope)).toMatchObject({records:0,observed_net_amount:null,distinct_observed_transactions:null});
 });
 it.each([{truncate:true},{error:true},{missingCount:true},{changeCount:true},{changeLedger:true}])('rejects incomplete or changing reads %j',async options=>{
  await expect(loadIdealMetricProjection(fixture(Array.from({length:1001},(_,i)=>row(String(i))),options).client,scope)).rejects.toThrow();
 });
 it('rejects mixed scope even if a client returns unexpected rows',async()=>{
  for(const patch of [{tenant_id:'other'},{customer_id:'other'},{import_id:'other'},{source:'pos'}])
   await expect(loadIdealMetricProjection(fixture([{...row('1'),...patch}]).client,scope)).rejects.toThrow('Mixed');
 });
 it('rejects foreign/changed source identity and repeated pagination rows',async()=>{
  for(const patch of [{tenant_id:'other'},{source_sha256:'b'.repeat(64)},{status:'processing'}])
   await expect(loadIdealMetricProjection(fixture([],{source:{...source,...patch}}).client,scope)).rejects.toThrow();
  await expect(loadIdealMetricProjection(fixture([row('1'),row('1')]).client,scope)).rejects.toThrow('repeated');
 });
 it('propagates query cancellation to ledger and fact reads',async()=>{
  const {client,calls}=fixture([]);const controller=new AbortController();
  await loadIdealMetricProjection(client,scope,controller.signal);
  expect(calls.filter(call=>call[0]==='abortSignal')).toHaveLength(3);
  expect(calls).toContainEqual(['abortSignal',controller.signal]);
 });

});
