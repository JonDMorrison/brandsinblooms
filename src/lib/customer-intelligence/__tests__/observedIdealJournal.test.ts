import {describe,expect,it} from 'vitest';
import {selectObservedJournalSource,summarizeObservedJournal,compareObservedJournalPeriods,journalCoverage,journalBusinessDay,observedDeclineReview,type JournalSource,type JournalLine,type JournalCustomer} from '../../../../supabase/functions/_shared/customer-intelligence/observed-ideal-journal';
const tenant='synthetic-tenant',timezone='America/Vancouver',cutoff='2026-11-23T20:00:00Z',sha='a'.repeat(64);
const source=(year:string):JournalSource=>({id:'journal-'+year,tenant_id:tenant,source:'ideal',report_type:'journal',status:'completed',source_period_start:year+'-01-01',source_period_end:year+'-12-31',source_filename:'Synthetic journal',source_sha256:sha,created_at:'2026-11-01T00:00:00Z',completed_at:'2026-11-01T01:00:00Z',reconciliation:{timezone,applied:{lines:20,net_cents:1000},expected:{lines:20,net_cents:1000,sha256:sha}}});
const win=(year:string)=>({start:year+'-10-01',end:year+'-10-31'});
const customers:JournalCustomer[]=[{id:'a',tenant_id:tenant,external_id:'0001',first_name:'A',last_name:'Customer'},{id:'b',tenant_id:tenant,external_id:'0002',first_name:'B',last_name:'Customer'}];
function line(year:string,id:string,receipt:string,amount:number,customerId='a',code='0001'):JournalLine{return {id,tenant_id:tenant,import_id:'journal-'+year,source:'ideal',customer_id:customerId,external_customer_code:code,external_transaction_id:receipt,external_line_id:id,purchased_at:year+'-10-10T18:00:00Z',created_at:'2026-11-01T00:00:00Z',currency:'CAD',net_amount:amount};}
const partial=():JournalSource=>{
 const expected={sha256:sha,lines:3,receipts:2,customers:1,source_receipts:4,excluded_receipts:2,positive:1,zero:1,negative:0,net_cents:1000,rounding_cents:0,tax_cents:50,tender_cents:1050};
 return {...source('2026'),report_type:'journal_partial',status:'completed_with_errors',source_period_end:'2026-11-02',reconciliation:{version:1,timezone,coverage_mode:'reconciled_customer_cohort',coverage_complete:false,timestamp_rule:'BC 2026 March 8 final transition; explicit original wall-clock offset; no November fallback',verified_at:'2026-11-01T01:00:00Z',control_source_sha256:'b'.repeat(64),cohort_control_sha256:'c'.repeat(64),expected,applied:{...expected,coverage_complete:false,invalid_receipts:0,invalid_identities:0,matched_customers:1,customer_controls_verified:1,control_digest:'c'.repeat(64)},chunk_hashes:['d'.repeat(64)],verified_chunks:{'1':{sha256:'d'.repeat(64),lines:3,receipts:2,customers:1,net_cents:1000}}}};
};
describe('observed IdealPOS journal evidence',()=>{
 it('accepts only the explicitly reconciled partial cohort and never treats it as complete',()=>{
  const s=partial();
  expect(selectObservedJournalSource([s],tenant,win('2026'),timezone,cutoff)).toBe(s);
  expect(journalCoverage(s)).toMatchObject({mode:'reconciled_customer_cohort',complete:false,sourceReceipts:4,includedReceipts:2,excludedReceipts:2,includedCustomers:1});
  for(const change of [{coverage_complete:true},{verified_chunks:{}},{cohort_control_sha256:'e'.repeat(64)},{applied:{...(s.reconciliation as any).applied,invalid_identities:1}},{applied:{...(s.reconciliation as any).applied,customer_controls_verified:0}}]){
   expect(()=>selectObservedJournalSource([{...s,reconciliation:{...(s.reconciliation as object),...change}}],tenant,win('2026'),timezone,cutoff)).toThrow('Missing coverage is unknown');
  }
  expect(()=>selectObservedJournalSource([s,source('2026')],tenant,win('2026'),timezone,cutoff)).toThrow('Overlapping');
 });
 it('preserves original BC wall time and rejects altered receipt amounts or offsets',()=>{
  const s=partial(),window={start:'2026-11-02',end:'2026-11-02'};
  const raw={coverage_mode:'reconciled_customer_cohort',local_timestamp:'2026-11-02T00:30:00-07:00',receipt_source:'S1:100:3',receipt_net_cents:1000,receipt_rounding_cents:0,receipt_tax_cents:50,receipt_tender_cents:1050};
  const receipt={...line('2026','1','r',10),purchased_at:'2026-11-02T07:30:00+00:00',raw_data:raw};
  expect(journalBusinessDay(receipt.purchased_at,s,timezone)).toBe('2026-11-02');
  expect(summarizeObservedJournal([receipt],customers,s,tenant,window,'CAD',timezone,cutoff)).toMatchObject({validReceipts:1,positiveReceipts:1});
  for(const changes of [{receipt_net_cents:999},{local_timestamp:'2026-11-01T23:30:00-08:00'},{receipt_tender_cents:1051}]){
   expect(summarizeObservedJournal([{...receipt,raw_data:{...raw,...changes}}],customers,s,tenant,window,'CAD',timezone,cutoff)).toMatchObject({validReceipts:0,excludedReceipts:1});
  }
 });
 it('does not substitute annual summary-only sources or invent absent 2026 coverage',()=>{
  expect(selectObservedJournalSource([source('2025')],tenant,win('2025'),timezone,cutoff).id).toBe('journal-2025');
  const summary={...source('2025'),reconciliation:{timezone,applied:{dated_lines_stored:false},expected:{lines:20}}};
  expect(()=>selectObservedJournalSource([summary],tenant,win('2025'),timezone,cutoff)).toThrow('No completed dated');
  expect(()=>selectObservedJournalSource([source('2025')],tenant,win('2026'),timezone,cutoff)).toThrow('Missing coverage is unknown');
  expect(()=>selectObservedJournalSource([source('2025'),{...source('2025'),id:'duplicate'}],tenant,win('2025'),timezone,cutoff)).toThrow('Overlapping');
 });
 it('nets full receipt lines, excludes free and refund-only activity, and quarantines identity conflicts',()=>{
  const lines=[line('2025','1','sale',25),line('2025','2','sale',-5),line('2025','3','free',0),line('2025','4','refund',-4),line('2025','5','mixed',10),line('2025','6','mixed',5,'b','0002'),line('2025','7','wrong-code',12,'b','NOT-0002')];
  const result=summarizeObservedJournal(lines,customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff);
  expect(result).toMatchObject({validReceipts:3,positiveReceipts:1,zeroReceipts:1,negativeReceipts:1,excludedReceipts:2});
  expect(result.customers.find(c=>c.id==='a')).toMatchObject({netMinor:1600,positiveReceipts:1,validReceipts:3,invalidReceipts:1});
  expect(result.customers.find(c=>c.id==='b')).toMatchObject({validReceipts:0,invalidReceipts:2});
  expect(()=>summarizeObservedJournal([...lines,lines[0]],customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff)).toThrow('Duplicate');
 });
 it('scores only customers observed in both periods and leaves one-sided evidence unknown',()=>{
  const before=summarizeObservedJournal([line('2024','1','a',20),line('2024','2','b',10,'b','0002')],customers,source('2024'),tenant,win('2024'),'CAD',timezone,cutoff);
  const after=summarizeObservedJournal([line('2025','3','a',40),line('2025','4','a2',10)],customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff);
  const result=compareObservedJournalPeriods(before,after,{baseline_start:win('2024').start,baseline_end:win('2024').end,current_start:win('2025').start,current_end:win('2025').end,currency:'CAD',timezone,data_cutoff:cutoff,spend_weight:50,visits_weight:50});
  expect(result).toMatchObject({comparable:1,unscored:1,baselineObservedBuyers:2,currentObservedBuyers:1});
  expect(result.rows.find(r=>r.id==='a')).toMatchObject({baselineReceipts:1,currentReceipts:2,baselinePurchaseDays:1,currentPurchaseDays:1,observedGrowth:75});
  expect(result.rows.find(r=>r.id==='b')).toMatchObject({currentSpend:null,currentReceipts:null,observedGrowth:null});
 });
 it('binds decline review to exact source, customer membership and values rather than count or read time',async()=>{
  const args={baseline_start:win('2024').start,baseline_end:win('2024').end,current_start:win('2025').start,current_end:win('2025').end,currency:'CAD',timezone,data_cutoff:cutoff,spend_weight:50,visits_weight:50};
  const before=summarizeObservedJournal([line('2024','1','a',20),line('2024','2','b',20,'b','0002')],customers,source('2024'),tenant,win('2024'),'CAD',timezone,cutoff);
  const after=summarizeObservedJournal([line('2025','3','a',10),line('2025','4','b',30,'b','0002')],customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff);
  const first=await observedDeclineReview(before,after,args);
  expect(first.memberIds).toEqual(['a']);
  const swapped=summarizeObservedJournal([line('2025','3','a',30),line('2025','4','b',10,'b','0002')],customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff);
  expect((await observedDeclineReview(before,swapped,args)).memberIds).toEqual(['b']);
  expect((await observedDeclineReview(before,swapped,args)).digest).not.toBe(first.digest);
  const later='2026-11-24T20:00:00Z';
  expect((await observedDeclineReview({...before,cutoff:later},{...after,cutoff:later},{...args,data_cutoff:later})).digest).toBe(first.digest);
 });
 it('counts each local date once, excludes free and refund-only days, and retains separate receipt totals',()=>{
  const lines=[line('2025','1','r1',10),line('2025','2','r2',20),
    {...line('2025','3','r3',30),purchased_at:'2025-10-11T18:00:00Z'},
    {...line('2025','4','free',0),purchased_at:'2025-10-12T18:00:00Z'},
    {...line('2025','5','refund',-5),purchased_at:'2025-10-13T18:00:00Z'}];
  const result=summarizeObservedJournal(lines,customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff);
  expect(result.customers[0]).toMatchObject({positiveReceipts:3,positivePurchaseDays:2,netMinor:5500});
 });
 it('never accepts a cross-tenant line, mismatched receipt timestamp or unknown currency as valid activity',()=>{
  const other={...line('2025','a','r',20),tenant_id:'other'};
  expect(()=>summarizeObservedJournal([other],customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff)).toThrow('out-of-scope');
  const conflicted=[line('2025','1','r',20),{...line('2025','2','r',10),purchased_at:'2025-11-01T18:00:00Z'}, {...line('2025','3','r2',20),currency:null}];
  expect(summarizeObservedJournal(conflicted,customers,source('2025'),tenant,win('2025'),'CAD',timezone,cutoff)).toMatchObject({validReceipts:0,excludedReceipts:2,positiveReceipts:0});
 });
});
