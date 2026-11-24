import {describe,it,expect} from 'vitest';
import {observedJournalCampaignOutcome,type JournalCampaignMessage} from '../../../../supabase/functions/_shared/loyalty/journal-campaign-outcomes';
import type {ObservedJournalPeriod,JournalReceiptEvidence} from '../../../../supabase/functions/_shared/customer-intelligence/observed-ideal-journal';
const t='tenant',campaign='campaign',cutoff='2025-10-20T19:00:00Z';
const source={id:'journal',tenant_id:t,source:'ideal',report_type:'journal',status:'completed',source_period_start:'2025-01-01',source_period_end:'2025-12-31',source_filename:'synthetic',source_sha256:'a'.repeat(64),created_at:cutoff,completed_at:cutoff,reconciliation:{}};
const r=(id:string,customerId:string,day:string,netMinor:number,featuredNetQuantityMilli=0,paidFeaturedPurchase=false):JournalReceiptEvidence=>({id:'journal:'+id,customerId,day,timestamp:day+'T18:00:00Z',netMinor,featuredNetQuantityMilli,paidFeaturedPurchase});
const m=(id:string,customer_id:string,sent_at='2025-10-10T17:00:00Z'):JournalCampaignMessage=>({id,tenant_id:t,campaign_id:campaign,customer_id,sent_at,resend_id:'provider-'+id,delivery_reconciliation_required:false});
const period=(receiptEvidence:JournalReceiptEvidence[]):ObservedJournalPeriod=>({tenantId:t,window:{start:'2025-10-01',end:'2025-10-19'},currency:'CAD',timezone:'America/Vancouver',cutoff,source,customers:[],validReceipts:receiptEvidence.length,positiveReceipts:0,zeroReceipts:0,negativeReceipts:0,excludedReceipts:2,receiptEvidence});
describe('observed journal campaign outcomes',()=>{
 it('uses actual sends and the fixed cohort, excludes free and refund-only activity from paid days, and keeps net refunds',()=>{
  const p=period([r('before','a','2025-10-09',9999),r('sale1','a','2025-10-10',1000,1000,true),r('sale2','a','2025-10-10',2000,2000,true),r('refund','a','2025-10-11',-500,-1000),r('free','b','2025-10-12',0,1000),r('outsider','x','2025-10-12',9000,1000,true)]);
  const result=observedJournalCampaignOutcome(p,['a','b','c'],campaign,[m('1','a'),m('2','b'),m('3','x')],'2025-10-01T17:00:00Z','SKU');
  expect(result).toMatchObject({frozenCustomers:3,verifiedSentCustomers:2,outsideFrozenAudienceSentCustomers:1,customersWithObservedPositivePurchase:1,positiveReceipts:2,observedPositivePurchaseDays:1,observedNetSpendMinor:2500,sentCustomersWithoutObservedPositivePurchase:1,featured:{customersWithObservedPositivePricedItem:1,observedSignedQuantityMilli:3000,unknownFeaturedReceipts:0}});
 });
 it('does not claim campaign outcomes when provider send evidence is missing, ambiguous or outside the cohort',()=>{
  for(const messages of [[],[m('1','outside')],[{...m('1','a'),resend_id:null}],[{...m('1','a'),delivery_reconciliation_required:true}]])
   expect(()=>observedJournalCampaignOutcome(period([]),['a'],campaign,messages,'2025-10-01T17:00:00Z',null)).toThrow('No verified');
  expect(()=>observedJournalCampaignOutcome(period([]),['a'],campaign,[{...m('1','a'),tenant_id:'other'}],'2025-10-01T17:00:00Z',null)).toThrow('Cross-company');
 });
 it('reports missing observed purchase totals as unknown and marks retrospective baseline intersections',()=>{
  const result=observedJournalCampaignOutcome(period([]),['a'],campaign,[m('1','a')],'2025-10-11T17:00:00Z',null);
  expect(result).toMatchObject({observedNetSpendMinor:null,baselineCapturedBeforeFirstSend:false,sentCustomersWithoutObservedPositivePurchase:1});
 });
 it('does not infer featured quantities if an observed receipt is ambiguous',()=>{
  const result=observedJournalCampaignOutcome(period([{...r('sale','a','2025-10-12',1000),featuredNetQuantityMilli:null}]),['a'],campaign,[m('1','a')],'2025-10-01T17:00:00Z','SKU');
  expect(result.featured).toMatchObject({observedSignedQuantityMilli:null,unknownFeaturedReceipts:1});
 });
});
