import {describe,it,expect} from 'vitest';
import {campaignEvidence,loadCampaignSupplement,type CampaignInteraction,type CampaignMessage} from '../../../../supabase/functions/_shared/loyalty/programme-campaign-evidence';
import {capturePeriod,captureProgrammeBaseline,compareProgrammePeriod} from '../../../../supabase/functions/_shared/loyalty/programme-measurement';
import type {CouponEvent} from '../../../../supabase/functions/_shared/customer-intelligence/coupon-lifecycle';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
const tenant='tenant',campaign='campaign',cutoff='2026-02-28T23:59:59Z',window={start:'2026-02-01',end:'2026-02-28'};
const message:CampaignMessage={id:'send',tenant_id:tenant,campaign_id:campaign,customer_id:'a',sent_at:'2026-02-03T12:00:00Z',resend_id:'provider-message'};
const interaction:CampaignInteraction={id:'open',tenant_id:tenant,campaign_id:campaign,customer_id:'a',provider_message_id:'provider-message',event_type:'opened',event_ts_provider:'2026-02-03T13:00:00Z',created_at:'2026-02-03T13:00:01Z',is_mpp_guess:false};
const coupon:CouponEvent={id:'redemption',tenant_id:tenant,customer_id:'a',import_id:'complete-import',source:'ideal',event_type:'coupon_redeemed',coupon_code:'00009',occurred_at:'2026-02-05T12:00:00Z',expires_at:null,external_transaction_id:'exact-source-receipt',source_fingerprint:'fingerprint'};
const run=(messages=[message],interactions=[interaction],coupons=[coupon])=>campaignEvidence(tenant,campaign,['a','b'],['a','b'],messages,interactions,coupons,cutoff,window,'UTC');
describe('selected campaign closed-loop observations',()=>{
 it('integrates selected/sent/engaged/redemption/subsequent purchase evidence without sending or attributing cause',()=>{
  const settings={currency:'CAD' as const,timezone:'UTC',spendWeight:50,transactionsWeight:50},coverage={status:'reviewed_complete' as const,evidence:'Synthetic complete order fixture',reviewedAt:cutoff};
  const order=(id:string,date:string,amount:number)=>({id,tenant_id:tenant,crm_customer_id:'a',order_date:date,created_at:date,total_amount:amount,refund_amount:0,currency:'CAD',status:'paid'});
  const previous=capturePeriod([order('baseline','2026-01-10T12:00:00Z',100)],['a','b'],['a','b'],tenant,{start:'2026-01-01',end:'2026-01-28'},settings,cutoff,coverage);
  const current=capturePeriod([order('after-message','2026-02-05T12:00:00Z',120)],['a','b'],['a','b'],tenant,window,settings,cutoff,coverage);
  const comparison=compareProgrammePeriod(captureProgrammeBaseline(previous,[],[]),current,[],[],[message],false);
  const evidence=run([message,message],[interaction,{...interaction,id:'click',event_type:'clicked'},interaction],[coupon,coupon]);
  expect(comparison.summary).toMatchObject({originalCohort:2,contactedCustomers:1,recordedPostMessageSpendMinor:12000});
  expect(evidence.summary).toMatchObject({selectedCustomers:2,sentCustomers:1,customersWithRecordedOpens:1,customersWithRecordedClicks:1,customersWithRecordedRedemptionsAfterSend:1});
  expect(evidence.rows.get('a')).toMatchObject({sentMessageIds:['send'],recordedOpenEventIds:['open'],recordedClickEventIds:['click'],couponRedemptionEventIds:['redemption'],couponReceiptReferences:['exact-source-receipt']});
  expect(evidence.rows.get('b')?.sentMessageIds).toEqual([]);expect(evidence.summary.limitations.join(' ')).toContain('does not establish');
 });
 it('does not equate missing sent, privacy opens, unlinked provider events, future or outside-window facts with engagement',()=>{
  const r=run([message,{...message,id:'draft',customer_id:'b',sent_at:null}],[{...interaction,is_mpp_guess:true},{...interaction,id:'unlinked',provider_message_id:'unknown'},{...interaction,id:'after-window',event_ts_provider:'2026-03-01T00:00:00Z'}],[{...coupon,occurred_at:'2026-01-31T12:00:00Z'}]);
  expect(r.summary).toMatchObject({sentCustomers:1,customersWithRecordedOpens:0,unmatchedInteractionCount:1,customersWithRecordedRedemptionsAfterSend:0});expect(r.rows.get('a')?.privacyOpenEventIds).toEqual(['open']);
 });
 it('rejects conflicting send instants for one provider message regardless of input order',()=>{const conflicting={...message,id:'another-ledger-row',sent_at:'2026-02-04T12:00:00Z'};for(const messages of [[message,conflicting],[conflicting,message]])expect(()=>run(messages)).toThrow('Provider message identity is ambiguous');const identical={...message,id:'identical-copy'};expect(run([message,identical]).summary.customersWithRecordedOpens).toBe(1);});
 it('keeps missing coupon identity unknown rather than counting a redemption',()=>{const r=run([message],[interaction],[{...coupon,coupon_code:null}]);expect(r.summary).toMatchObject({customersWithRecordedRedemptionsAfterSend:0,unresolvedCouponEvidenceCount:1});});
 it('excludes inaccessible customers and rejects cross-scope or conflicting facts',()=>{
  expect(campaignEvidence(tenant,campaign,['a'],[],[message],[interaction],[coupon],cutoff,window,'UTC').summary.sentCustomers).toBe(0);
  expect(()=>run([{...message,tenant_id:'other'}])).toThrow('Cross-company');expect(()=>run([message],[{...interaction,campaign_id:'other'}])).toThrow('Cross-company');expect(()=>run([message],[interaction],[{...coupon,tenant_id:'other'}])).toThrow('Cross-company');
  expect(()=>run([message,{...message,sent_at:'2026-02-04T12:00:00Z'}])).toThrow('Conflicting');expect(()=>run([message],[interaction],[coupon,{...coupon,external_transaction_id:'changed'}])).toThrow('Conflicting');
 });
 it('loads only current-tenant campaign interactions and completed coupon imports at the cutoff',async()=>{
  const calls:unknown[][]=[];const client={from:(table:string)=>{calls.push(['from',table]);const q={select:()=>q,eq:(key:string,v:unknown)=>{calls.push([table,'eq',key,v]);return q;},lte:(key:string,v:unknown)=>{calls.push([table,'lte',key,v]);return q;},order:()=>q,range:async()=>({data:[],error:null})};return q;}} as unknown as PersistenceClient;
  await loadCampaignSupplement(client,tenant,campaign,cutoff);
  expect(calls).toContainEqual(['email_tracking_events','eq','tenant_id',tenant]);expect(calls).toContainEqual(['email_tracking_events','eq','campaign_id',campaign]);expect(calls).toContainEqual(['customer_intelligence_source_events','eq','source','ideal']);expect(calls).toContainEqual(['customer_intelligence_source_events','eq','customer_intelligence_imports.status','completed']);expect(calls).toContainEqual(['customer_intelligence_source_events','lte','customer_intelligence_imports.completed_at',cutoff]);
 });
});

it('persists the integrated campaign evidence through the actual programme report command using synthetic clients',async()=>{
 const {executeProgrammeCommand}=await import('../../../../supabase/functions/_shared/loyalty/programme-service');
 const t='10000000-0000-0000-0000-000000000001',c='20000000-0000-0000-0000-000000000001',id='30000000-0000-0000-0000-000000000001';
 const settings={currency:'CAD' as const,timezone:'UTC',spendWeight:50,transactionsWeight:50},coverage={status:'reviewed_complete' as const,evidence:'Synthetic complete records',reviewedAt:cutoff};
 const baseline=captureProgrammeBaseline(capturePeriod([],['a'],['a'],t,{start:'2026-01-01',end:'2026-01-28'},settings,cutoff,coverage),[],[]);
 const records:Record<string,unknown>={loyalty_programme_baselines:{id,snapshot:baseline},crm_campaigns:{id:c},crm_customers:[{id:'a',email:'synthetic@example.invalid',first_name:'Synthetic',last_name:null}],pos_orders:[],customer_loyalty_metrics:[],email_messages:[{...message,tenant_id:t,campaign_id:c}],email_tracking_events:[{...interaction,tenant_id:t,campaign_id:c}],customer_intelligence_source_events:[{...coupon,tenant_id:t}]};
 const userClient={from:(table:string)=>{const q:Record<string,unknown>={};for(const method of ['select','eq','is','lte','order','range','not'])q[method]=()=>q;q.maybeSingle=async()=>({data:records[table],error:null});q.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:records[table]??[],error:null}).then(resolve);return q;}};
 let saved:Record<string,unknown>|null=null;const serviceClient={rpc:async(name:string,args:Record<string,unknown>)=>{expect(name).toBe('save_loyalty_run_v1');saved=args;return {data:{runId:'synthetic-run',result:args.p_result},error:null};}};
 type Context=Parameters<typeof executeProgrammeCommand>[1];
 const result=await executeProgrammeCommand({action:'run_report',expectedTenantId:t,baselineId:id,requestKey:id,window,coverage:{reviewedComplete:true,evidence:'Synthetic complete records'},normalizeDaily:false,campaignId:c},{tenantId:t,userId:'synthetic-user',now:new Date(cutoff),userClient,serviceClient} as unknown as Context);
 expect(saved).not.toBeNull();expect(result.result).toMatchObject({campaignEvidenceSummary:{selectedCustomers:1,sentCustomers:1,customersWithRecordedOpens:1,customersWithRecordedRedemptionsAfterSend:1},rows:[{customerId:'a',campaignEvidence:{sentMessageIds:['send'],couponRedemptionEventIds:['redemption']}}]});
});
