import {describe,it,expect} from 'vitest';
import {projectIdealCustomerMetrics,type IdealProjectionFact,type IdealProjectionImport} from '../../../../supabase/functions/_shared/customer-intelligence/ideal-metric-projection';
const scope={tenantId:'tenant',customerId:'customer',startDate:'2026-01-01',endDate:'2026-10-14',timezone:'America/Vancouver',cutoff:'2026-10-22T00:00:00Z'};
const source:IdealProjectionImport={id:'source',tenant_id:'tenant',source:'ideal',status:'completed',report_type:'customer_sales',source_sha256:'a'.repeat(64),completed_at:'2026-10-20T00:00:00Z',source_period_start:null,source_period_end:null};
const fact=(patch:Partial<IdealProjectionFact>={}):IdealProjectionFact=>({id:'line',tenant_id:'tenant',customer_id:'customer',import_id:'source',source:'ideal',created_at:'2026-10-19T00:00:00Z',product_code:'0001',product_name:'Plant',sales_category:'Nursery',department:'Garden',net_amount:'10.25',quantity:'2',currency:'CAD',purchased_at:'2026-10-14T12:00:00-07:00',external_transaction_id:'0001',external_line_id:'01',...patch});
describe('evidence-scoped Ideal metric projection',()=>{
 it('counts distinct observed transactions, not product lines, and preserves unknown business metrics',()=>{
  const result=projectIdealCustomerMetrics(scope,source,[fact(),fact({id:'line2',external_line_id:'02',net_amount:-1.25,quantity:-1})]);
  expect(result).toMatchObject({observed_net_amount:9,observed_quantity:1,distinct_observed_transactions:1,last_observed_purchase_date:'2026-10-14',lifetime_value:null,visits:null,average_transaction_value:null,category_net_amount:{Nursery:9},source_sha256:'a'.repeat(64)});
 });
 it('deduplicates matching line identity and rejects changed duplicates',()=>{
  expect(projectIdealCustomerMetrics(scope,source,[fact(),fact({id:'copy'})])).toMatchObject({records:1,duplicate_records:1,observed_net_amount:10.25});
  expect(()=>projectIdealCustomerMetrics(scope,source,[fact(),fact({id:'copy',net_amount:11})])).toThrow('Conflicting duplicate');
  expect(()=>projectIdealCustomerMetrics(scope,source,[fact(),fact({external_line_id:'changed'})])).toThrow('Conflicting duplicate source row');
  expect(()=>projectIdealCustomerMetrics(scope,source,[fact({quantity:'1'}),fact({id:'copy',quantity:'1.0000000000000000001'})])).toThrow('precision');
  expect(projectIdealCustomerMetrics(scope,source,[fact({quantity:'1'}),fact({id:'copy',quantity:'1.00'})]).records).toBe(1);
 });
 it('projects exact summary totals without invented dates or transactions',()=>{
  const summary={...source,report_type:'customer_sales_summary',source_period_start:scope.startDate,source_period_end:scope.endDate};
  const row=fact({evidence_kind:'period_summary',source_period_start:scope.startDate,source_period_end:scope.endDate,purchased_at:null,external_transaction_id:null,external_line_id:null});
  expect(projectIdealCustomerMetrics(scope,summary,[row])).toMatchObject({observed_net_amount:10.25,distinct_observed_transactions:null,last_observed_purchase_date:null});
  expect(()=>projectIdealCustomerMetrics({...scope,startDate:'2026-02-01'},summary,[row])).toThrow('exact original');
  expect(()=>projectIdealCustomerMetrics(scope,summary,[fact()])).toThrow('cannot be combined');
 });
 it.each(['processing','completed_with_errors','failed'])('rejects %s imports',status=>{
  expect(()=>projectIdealCustomerMetrics(scope,{...source,status},[fact()])).toThrow('completed');
 });
 it('rejects cross-tenant/customer/import/source facts and mixed overlapping snapshots',()=>{
  for(const patch of [{tenant_id:'other'},{customer_id:'other'},{import_id:'annual-source'},{source:'pos'}])
   expect(()=>projectIdealCustomerMetrics(scope,source,[fact(),fact(patch)])).toThrow('Mixed');
 });
 it('enforces ledger/source cutoff and explicit timezone evidence',()=>{
  expect(()=>projectIdealCustomerMetrics(scope,{...source,completed_at:'2026-10-23T00:00:00Z'},[fact()])).toThrow();
  expect(()=>projectIdealCustomerMetrics(scope,source,[fact({created_at:'2026-10-23T00:00:00Z'})])).toThrow('cutoff');
  expect(()=>projectIdealCustomerMetrics(scope,source,[fact({purchased_at:'2026-10-14T12:00:00'})])).toThrow('offset');
  expect(projectIdealCustomerMetrics(scope,source,[fact({purchased_at:'2026-10-15T06:59:00Z'})]).records).toBe(1);
  expect(projectIdealCustomerMetrics(scope,source,[fact({purchased_at:'2026-10-15T07:00:00Z'})]).records).toBe(0);
 });
 it('returns unknown for no records and missing transaction IDs',()=>{
  expect(projectIdealCustomerMetrics(scope,source,[])).toMatchObject({observed_net_amount:null,distinct_observed_transactions:null,currency:null});
  expect(projectIdealCustomerMetrics(scope,source,[fact({external_transaction_id:null,sales_category:null})])).toMatchObject({distinct_observed_transactions:null,missing_category_records:1});
 });
 it('rejects incompatible currencies, invalid amounts, and contradictory transaction dates',()=>{
  for(const patch of [{currency:'USD'},{net_amount:NaN},{net_amount:1.001},{quantity:Infinity},{purchased_at:'2026-10-13T12:00:00Z'}])
   expect(()=>projectIdealCustomerMetrics(scope,source,[fact(),fact({id:'second',external_line_id:'02',...patch})])).toThrow();
 });
 it('keeps annual and current evidence separate rather than manufacturing lifetime totals',()=>{
  const annualScope={...scope,startDate:'2025-01-01',endDate:'2025-12-31'};
  const annualSource={...source,id:'annual',report_type:'customer_sales_summary',source_period_start:annualScope.startDate,source_period_end:annualScope.endDate};
  const annual=projectIdealCustomerMetrics(annualScope,annualSource,[fact({import_id:'annual',evidence_kind:'period_summary',purchased_at:null,source_period_start:annualScope.startDate,source_period_end:annualScope.endDate})]);
  expect(annual.observed_net_amount).toBe(10.25);expect(annual.lifetime_value).toBeNull();
  expect(()=>projectIdealCustomerMetrics(scope,annualSource,[fact()])).toThrow();
 });
 it('uses exact decimal cents and quantities rather than floating multiplication',()=>{
  expect(projectIdealCustomerMetrics(scope,source,[fact({net_amount:'90071992547409.90'})]).observed_net_cents).toBe(9007199254740990);
  expect(projectIdealCustomerMetrics(scope,source,[fact({quantity:0.1}),fact({id:'two',external_line_id:'02',quantity:0.2})]).observed_quantity).toBe(0.3);
 });
 it('rejects impossible dates, offset-less timestamps, and bucket overflow even when total offsets',()=>{
  for(const invalid of ['2026-02-30T12:00:00Z','2026-02-01T12:00:00']){
   expect(()=>projectIdealCustomerMetrics(scope,source,[fact({purchased_at:invalid})])).toThrow();
   expect(()=>projectIdealCustomerMetrics({...scope,cutoff:invalid},source,[fact()])).toThrow();
   expect(()=>projectIdealCustomerMetrics(scope,{...source,completed_at:invalid},[fact()])).toThrow();
  }
  const huge='90071992547409.90';
  expect(()=>projectIdealCustomerMetrics(scope,source,[fact({net_amount:huge}),fact({id:'negative',external_line_id:'02',net_amount:'-'+huge,sales_category:'Other',department:'Other'}),fact({id:'overflow',external_line_id:'03',net_amount:1})])).toThrow('bucket');
 });
});
