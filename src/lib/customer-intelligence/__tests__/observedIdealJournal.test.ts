import {describe,expect,it} from 'vitest';
import {selectObservedJournalSource,summarizeObservedJournal,compareObservedJournalPeriods,type JournalSource,type JournalLine,type JournalCustomer} from '../../../../supabase/functions/_shared/customer-intelligence/observed-ideal-journal';
const tenant='synthetic-tenant',timezone='America/Vancouver',cutoff='2026-11-23T20:00:00Z',sha='a'.repeat(64);
const source=(year:string):JournalSource=>({id:'journal-'+year,tenant_id:tenant,source:'ideal',report_type:'journal',status:'completed',source_period_start:year+'-01-01',source_period_end:year+'-12-31',source_filename:'Synthetic journal',source_sha256:sha,created_at:'2026-11-01T00:00:00Z',completed_at:'2026-11-01T01:00:00Z',reconciliation:{timezone,applied:{lines:20,net_cents:1000},expected:{lines:20,net_cents:1000,sha256:sha}}});
const win=(year:string)=>({start:year+'-10-01',end:year+'-10-31'});
const customers:JournalCustomer[]=[{id:'a',tenant_id:tenant,external_id:'0001',first_name:'A',last_name:'Customer'},{id:'b',tenant_id:tenant,external_id:'0002',first_name:'B',last_name:'Customer'}];
function line(year:string,id:string,receipt:string,amount:number,customerId='a',code='0001'):JournalLine{return {id,tenant_id:tenant,import_id:'journal-'+year,source:'ideal',customer_id:customerId,external_customer_code:code,external_transaction_id:receipt,external_line_id:id,purchased_at:year+'-10-10T18:00:00Z',created_at:'2026-11-01T00:00:00Z',currency:'CAD',net_amount:amount};}
describe('observed IdealPOS journal evidence',()=>{
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
