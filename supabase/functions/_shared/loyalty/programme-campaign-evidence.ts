import {assertDate,localDate} from '../customer-intelligence/purchase-exploration.ts';
import type { MessageFact, MeasurementWindow } from './programme-measurement.ts';
import type { CouponEvent } from '../customer-intelligence/coupon-lifecycle.ts';
import type { PersistenceClient } from '../../bloom-assist/types.ts';
import { readAllPages } from '../customer-intelligence/query-pages.ts';

export interface CampaignMessage extends MessageFact {resend_id?:string|null;}
export interface CampaignInteraction {
 id:string;tenant_id:string|null;campaign_id:string;customer_id:string|null;
 provider_message_id:string|null;event_type:string;event_ts_provider:string|null;
 created_at:string;is_mpp_guess:boolean;
}
export interface CustomerCampaignEvidence {
 sentMessageIds:string[];recordedOpenEventIds:string[];recordedClickEventIds:string[];
 privacyOpenEventIds:string[];couponRedemptionEventIds:string[];couponReceiptReferences:string[];
}
export interface CampaignEvidenceSummary {
 selectedCustomers:number;sentCustomers:number;customersWithRecordedOpens:number;
 customersWithRecordedClicks:number;customersWithRecordedRedemptionsAfterSend:number;
 unmatchedInteractionCount:number;unresolvedCouponEvidenceCount:number;limitations:string[];
}
const time=(v:string|null|undefined):number|null=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))return null;try{assertDate(v.slice(0,10));return Date.parse(v);}catch{return null;}};
const empty=():CustomerCampaignEvidence=>({sentMessageIds:[],recordedOpenEventIds:[],recordedClickEventIds:[],privacyOpenEventIds:[],couponRedemptionEventIds:[],couponReceiptReferences:[]});
/** Observational evidence for the frozen selected cohort, never marketing consent or causal attribution. */
export function campaignEvidence(tenantId:string,campaignId:string,selectedIds:string[],accessibleIds:string[],messages:CampaignMessage[],interactions:CampaignInteraction[],coupons:CouponEvent[],cutoff:string,window:MeasurementWindow,timezone:string){
 assertDate(window.start);assertDate(window.end);if(window.end<window.start)throw Error('Invalid campaign window');
 const inWindow=(timestamp:string)=>{const date=localDate(timestamp,timezone);return date!==null&&date>=window.start&&date<=window.end;};
 const end=time(cutoff);if(end===null||!tenantId||!campaignId||new Set(selectedIds).size!==selectedIds.length)throw Error('Invalid campaign evidence scope');
 const accessible=new Set(accessibleIds),rows=new Map(selectedIds.map(id=>[id,empty()])),firstSent=new Map<string,number>(),providers=new Map<string,CampaignMessage>(),seenMessages=new Map<string,string>();
 for(const message of messages){
  if(message.tenant_id!==tenantId||message.campaign_id!==campaignId)throw Error('Cross-company or cross-campaign message rejected');
  const serialized=JSON.stringify(message);if(seenMessages.has(message.id)){if(seenMessages.get(message.id)!==serialized)throw Error('Conflicting campaign message');continue;}seenMessages.set(message.id,serialized);
  const sent=time(message.sent_at);if(sent===null||sent>end||(localDate(message.sent_at!,timezone)??'9999')>window.end||!rows.has(message.customer_id)||!accessible.has(message.customer_id))continue;
  rows.get(message.customer_id)!.sentMessageIds.push(message.id);firstSent.set(message.customer_id,Math.min(firstSent.get(message.customer_id)??Infinity,sent));
  if(message.resend_id){const prior=providers.get(message.resend_id);if(prior&&(prior.customer_id!==message.customer_id||prior.campaign_id!==message.campaign_id||time(prior.sent_at)!==sent))throw Error('Provider message identity is ambiguous');if(!prior)providers.set(message.resend_id,message);}
 }
 let unmatchedInteractionCount=0;const seenEvents=new Map<string,string>(),semantic=new Map<string,string>();
 for(const event of interactions){
  if(event.tenant_id!==tenantId||event.campaign_id!==campaignId)throw Error('Cross-company or cross-campaign interaction rejected');
  const serialized=JSON.stringify(event);if(seenEvents.has(event.id)){if(seenEvents.get(event.id)!==serialized)throw Error('Conflicting interaction evidence');continue;}seenEvents.set(event.id,serialized);
  if(!['opened','clicked','email.opened','email.clicked'].includes(event.event_type))continue;
  const at=time(event.event_ts_provider),created=time(event.created_at);if(at===null||created===null||at>end||created>end||!inWindow(event.event_ts_provider!))continue;
  if(event.customer_id&&(!rows.has(event.customer_id)||!accessible.has(event.customer_id)))continue;
  const message=event.provider_message_id?providers.get(event.provider_message_id):undefined;
  if(!message||event.customer_id!==message.customer_id||at<time(message.sent_at)!){unmatchedInteractionCount++;continue;}
  const kind=event.event_type.includes('clicked')?'click':'open';
  const key=JSON.stringify([event.provider_message_id,kind,event.event_ts_provider]);
  const meaning=JSON.stringify([event.customer_id,event.is_mpp_guess]);if(semantic.has(key)){if(semantic.get(key)!==meaning)throw Error('Conflicting duplicate interaction');continue;}semantic.set(key,meaning);
  const row=rows.get(message.customer_id)!;
  (kind==='click'?row.recordedClickEventIds:event.is_mpp_guess?row.privacyOpenEventIds:row.recordedOpenEventIds).push(event.id);
 }
 let unresolvedCouponEvidenceCount=0;const seenCoupons=new Map<string,string>();
 for(const event of coupons){
  if(event.tenant_id!==tenantId)throw Error('Cross-company coupon rejected');
  if(event.event_type!=='coupon_redeemed')continue;
  if(!event.id||!event.source||!event.source_fingerprint)throw Error('Coupon provenance is incomplete');
  const key=event.source+'\0'+event.source_fingerprint,meaning=JSON.stringify([event.customer_id,event.event_type,event.coupon_code,event.occurred_at,event.external_transaction_id]);
  if(seenCoupons.has(key)){if(seenCoupons.get(key)!==meaning)throw Error('Conflicting coupon evidence');continue;}seenCoupons.set(key,meaning);
  const at=time(event.occurred_at),sent=event.customer_id?firstSent.get(event.customer_id):undefined;
  if(sent===undefined||!event.customer_id)continue;
  if(at===null||!event.coupon_code){unresolvedCouponEvidenceCount++;continue;}
  if(at>end||at<=sent||!inWindow(event.occurred_at!))continue;
  const row=rows.get(event.customer_id)!;row.couponRedemptionEventIds.push(event.id);
  if(event.external_transaction_id&&!row.couponReceiptReferences.includes(event.external_transaction_id))row.couponReceiptReferences.push(event.external_transaction_id);
 }
 const values=[...rows.values()];const summary:CampaignEvidenceSummary={selectedCustomers:selectedIds.length,sentCustomers:values.filter(r=>r.sentMessageIds.length).length,customersWithRecordedOpens:values.filter(r=>r.recordedOpenEventIds.length).length,customersWithRecordedClicks:values.filter(r=>r.recordedClickEventIds.length).length,customersWithRecordedRedemptionsAfterSend:values.filter(r=>r.couponRedemptionEventIds.length).length,unmatchedInteractionCount,unresolvedCouponEvidenceCount,
 limitations:['Opens and clicks are recorded tracking signals, not proof of human attention; privacy-prefetch opens are listed separately.','Coupon redemptions occurred after a campaign message; this does not establish that the campaign issued the coupon or caused the redemption.','Receipt references remain source identifiers. No coupon-to-order or item linkage is inferred without a verified crosswalk.','Missing tracking or coupon records do not prove non-engagement or non-redemption; manual imports can lag POS activity.']};
 return {rows,summary};
}
export async function loadCampaignSupplement(client:Pick<PersistenceClient,'from'>,tenantId:string,campaignId:string,cutoff:string){
 const [interactions,coupons]=await Promise.all([
  readAllPages<CampaignInteraction>((from,to)=>client.from('email_tracking_events').select('id,tenant_id,campaign_id,customer_id,provider_message_id,event_type,event_ts_provider,created_at,is_mpp_guess').eq('tenant_id',tenantId).eq('campaign_id',campaignId).lte('created_at',cutoff).order('id').range(from,to)),
  readAllPages<CouponEvent>((from,to)=>client.from('customer_intelligence_source_events').select('id,tenant_id,customer_id,import_id,source,event_type,coupon_code,occurred_at,expires_at,external_transaction_id,source_fingerprint,customer_intelligence_imports!inner(id)').eq('tenant_id',tenantId).eq('source','ideal').eq('event_type','coupon_redeemed').eq('customer_intelligence_imports.tenant_id',tenantId).eq('customer_intelligence_imports.status','completed').lte('customer_intelligence_imports.completed_at',cutoff).lte('created_at',cutoff).order('id').range(from,to))
 ]);return {interactions,coupons};
}
