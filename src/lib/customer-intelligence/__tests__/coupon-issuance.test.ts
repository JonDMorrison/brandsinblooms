import {resolveCouponReminderSchedule} from '../../../../supabase/functions/_shared/customer-intelligence/coupon-reminder-schedule';
import {checkCouponOutboxReminder} from '../../../../supabase/functions/_shared/customer-intelligence/coupon-reminder-guard';
import {describe,it,expect} from 'vitest';
import {queueCompletedCouponIssuance} from '../../../../supabase/functions/_shared/customer-intelligence/queue-coupon-issuance';
import {triggerCatalog} from '../../automation/triggerCatalog';
const now='2026-10-20T12:00:00Z';
function fixture(status='completed',redeemed=false,failTable=''){
 const issues=[{id:'issue',tenant_id:'tenant',customer_id:'customer',import_id:'import',source:'ideal',event_type:'coupon_issued',coupon_code:'00001',occurred_at:'2026-10-01T12:00:00Z',expires_at:'2026-10-22T12:00:00Z',external_transaction_id:null,source_fingerprint:'stable',created_at:'2026-10-02T12:00:00Z'}];
 const rows:Record<string,Array<Record<string,unknown>>>= {
  customer_intelligence_imports:[{id:'import',tenant_id:'tenant',source:'ideal',status,report_type:'coupons_issued',completed_at:'2026-10-02T12:00:00Z'}],
  customer_intelligence_source_events:[...issues,...(redeemed?[{...issues[0],id:'redemption',event_type:'coupon_redeemed',source_fingerprint:'redemption'}]:[])],
  crm_customers:[{id:'customer',tenant_id:'tenant',deleted_at:null,merged_into_customer_id:null}],
  crm_automations:[{id:'automation',name:'Synthetic coupon reminder',tenant_id:'tenant',is_active:true,trigger_type:'ideal.coupon_issued',trigger_conditions:{},persona_targeting:{}}],
 };
 const writes=new Map<string,Record<string,unknown>>();const upsertOptions:unknown[]=[];const calls:unknown[][]=[];
 const client={from:(table:string)=>{let filtered=[...(rows[table]??[])];const result=()=>({data:filtered,error:table===failTable?{message:'Synthetic failure'}:null});const q={
  is:(key:string,value:unknown)=>{filtered=filtered.filter(r=>r[key]===value);return q;},select:()=>q,eq:(key:string,value:unknown)=>{calls.push([table,'eq',key,value]);if(!key.includes('.'))filtered=filtered.filter(r=>r[key]===value);return q;},
  in:(key:string,value:unknown[])=>{filtered=filtered.filter(r=>value.includes(r[key]));return q;},lte:()=>q,order:()=>q,
  range:async(from:number,to:number)=>({data:filtered.slice(from,to+1),error:null}),
  maybeSingle:async()=>({data:filtered[0]??null,error:null}),single:async()=>({data:filtered[0]??null,error:table===failTable?{message:'Synthetic failure'}:null}),
  then:(resolve:(v:ReturnType<typeof result>)=>unknown)=>Promise.resolve(result()).then(resolve),
  upsert:async(value:Record<string,unknown>,options:unknown)=>{upsertOptions.push(options);writes.set(String(value.tenant_id)+'|'+String(value.automation_id)+'|'+String(value.source_event_key),value);return {error:null};},
 };return q;}} as unknown as Parameters<typeof queueCompletedCouponIssuance>[0];
 return {client,writes,upsertOptions,calls,rows};
}
describe('completed Ideal coupon issuance trigger producer',()=>{
 it('queues only the issued customer and exact persisted event, idempotently on replay',async()=>{const f=fixture();expect(await queueCompletedCouponIssuance(f.client,'tenant','import',now)).toEqual({considered:1,eligible:1});await queueCompletedCouponIssuance(f.client,'tenant','import',now);expect(f.writes.size).toBe(1);expect([...f.writes.values()][0]).toMatchObject({tenant_id:'tenant',customer_id:'customer',event_type:'ideal.coupon_issued',source_event_key:'ideal:ideal.coupon_issued:coupon-issued:stable:',metadata:{provider_event:{coupon_issued_event_id:'issue',coupon_code:'00001',source_import_id:'import'}}});expect(f.upsertOptions[0]).toEqual({onConflict:'tenant_id,automation_id,source_event_key',ignoreDuplicates:true});});
 it.each(['processing','completed_with_errors','failed'])('never queues an uncertified %s import',async status=>{const f=fixture(status);expect(await queueCompletedCouponIssuance(f.client,'tenant','import',now)).toEqual({considered:0,eligible:0});expect(f.writes.size).toBe(0);});
 it('does not enroll a known redeemed coupon or another tenant',async()=>{const redeemed=fixture('completed',true);expect((await queueCompletedCouponIssuance(redeemed.client,'tenant','import',now)).eligible).toBe(0);const other=fixture();expect((await queueCompletedCouponIssuance(other.client,'other','import',now)).eligible).toBe(0);expect(other.writes.size).toBe(0);});
 it.each(['crm_automations','crm_customers'])('surfaces %s read failures so completed-import replay can repair queueing',async table=>{const f=fixture('completed',false,table);await expect(queueCompletedCouponIssuance(f.client,'tenant','import',now)).rejects.toThrow('Cannot read');expect(f.writes.size).toBe(0);});
 it('connects completed import to scoped queued trigger, two reminder schedules and fresh redemption suppression without sending',async()=>{
  const f=fixture();await queueCompletedCouponIssuance(f.client,'tenant','import',now);
  const queued=[...f.writes.values()][0];const trigger=(queued.metadata as {provider_event:Record<string,unknown>}).provider_event;
  const first=await resolveCouponReminderSchedule(f.client,'tenant','customer',trigger,{days_before_expiry:2},now);
  const second=await resolveCouponReminderSchedule(f.client,'tenant','customer',trigger,{days_before_expiry:1},now);
  expect(first.allowed).toBe(true);expect(second).toMatchObject({allowed:false,reason:'coupon_not_due',scheduled_at:'2026-10-21T12:00:00.000Z'});
  f.rows.crm_outbox=[{id:'second',tenant_id:'tenant',customer_id:'customer',template_data:{coupon_reminder:second.metadata}}];
  f.rows.customer_intelligence_source_events.push({...f.rows.customer_intelligence_source_events[0],id:'redeemed',event_type:'coupon_redeemed',source_fingerprint:'redeem',occurred_at:'2026-10-20T13:00:00Z'});
  expect(await checkCouponOutboxReminder(f.client,{tenantId:'tenant',customerId:'customer',outboxId:'second'},'2026-10-21T12:00:00Z')).toMatchObject({allowed:false,reason:'coupon_redeemed'});
 });
 it('does not enroll archived customers and suppresses a queued reminder after merge',async()=>{const f=fixture();f.rows.crm_customers[0].deleted_at=now;expect((await queueCompletedCouponIssuance(f.client,'tenant','import',now)).eligible).toBe(0);f.rows.crm_customers[0].deleted_at=null;f.rows.crm_customers[0].merged_into_customer_id='replacement';f.rows.crm_outbox=[{id:'queued',tenant_id:'tenant',customer_id:'customer',template_data:{coupon_reminder:{days_before_expiry:2,issued_event_id:'issue'}}}];expect(await checkCouponOutboxReminder(f.client,{tenantId:'tenant',customerId:'customer',outboxId:'queued'},now)).toMatchObject({allowed:false,reason:'coupon_customer_unavailable'});});
 it('exposes an event-scoped email-only trigger in authoring',()=>{expect(triggerCatalog.find(t=>t.id==='ideal.coupon_issued')).toMatchObject({audienceType:'event',channels:['email']});});
});
