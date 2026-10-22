export interface CouponEvent {
  id:string; tenant_id:string; customer_id:string|null; import_id:string; source:string;
  event_type:'coupon_issued'|'coupon_redeemed'; coupon_code:string|null;
  occurred_at:string|null; expires_at:string|null; external_transaction_id:string|null;
  source_fingerprint:string;
}
export interface CouponLifecycle {
  coupon_code:string; state:'redeemed'|'expired'|'issued_no_known_redemption'|'unknown';
  issued_event_id:string|null; issued_at:string|null; expires_at:string|null;
  redeemed_at:string|null; transaction_ids:string[]; source_event_ids:string[];
  import_ids:string[]; reason:string;
}
const timestamp=(v:string|null)=>v!==null&&Number.isFinite(Date.parse(v));
/** Customer-scoped source evidence, never inferred issuance from a redemption or a shared promotion code. */
export function couponLifecycles(events:CouponEvent[],tenantId:string,customerId:string,now:string):CouponLifecycle[]{
  if(!timestamp(now))throw new Error('Invalid coupon review time');
  const unique=new Map<string,CouponEvent>();
  for(const event of events){
    if(event.tenant_id!==tenantId||event.customer_id!==customerId)throw new Error('Coupon evidence is outside the selected customer');
    const key=event.source+'\0'+event.source_fingerprint;
    const previous=unique.get(key);
    const comparable=(v:CouponEvent)=>JSON.stringify([v.tenant_id,v.customer_id,v.source,v.event_type,v.coupon_code,v.occurred_at,v.expires_at,v.external_transaction_id]);
    if(previous&&comparable(previous)!==comparable(event))throw new Error('Conflicting duplicate coupon evidence');
    if(!previous)unique.set(key,event);
  }
  const groups=new Map<string,CouponEvent[]>();
  for(const event of unique.values())if(event.coupon_code){const key=event.source+'\0'+event.coupon_code;groups.set(key,[...(groups.get(key)??[]),event]);}
  return [...groups.values()].map(rows=>{
    const issues=rows.filter(r=>r.event_type==='coupon_issued');
    const redemptions=rows.filter(r=>r.event_type==='coupon_redeemed');
    const issue=issues.length===1?issues[0]:null;
    const validIssue=issue&&timestamp(issue.occurred_at)&&Date.parse(issue.occurred_at!)<=Date.parse(now);
    const validExpiry=validIssue&&timestamp(issue.expires_at)&&Date.parse(issue.expires_at!)>=Date.parse(issue.occurred_at!);
    const validRedemptions=redemptions.filter(r=>timestamp(r.occurred_at)&&Date.parse(r.occurred_at!)<=Date.parse(now));
    // Any known redemption conservatively suppresses reminders, including ambiguous reuse.
    const state=validRedemptions.length?'redeemed':!validIssue||!validExpiry||issues.length!==1||redemptions.length?'unknown':Date.parse(issue.expires_at!)<=Date.parse(now)?'expired':'issued_no_known_redemption';
    return {coupon_code:rows[0].coupon_code!,state,issued_event_id:issue?.id??null,issued_at:issue?.occurred_at??null,expires_at:issue?.expires_at??null,
      redeemed_at:validRedemptions.map(r=>r.occurred_at!).sort()[0]??null,
      transaction_ids:[...new Set(redemptions.map(r=>r.external_transaction_id).filter((v):v is string=>Boolean(v)))],
      source_event_ids:rows.map(r=>r.id),import_ids:[...new Set(rows.map(r=>r.import_id))],
      reason:state==='redeemed'?'Redemption recorded; further reminders suppressed.':state==='unknown'?'Issuance, expiry or coupon identity is incomplete or ambiguous.':state==='expired'?'The recorded expiry has passed.':'Issued; no redemption is known from completed imports. Manual sync can lag POS activity.'} satisfies CouponLifecycle;
  }).sort((a,b)=>a.coupon_code.localeCompare(b.coupon_code));
}
export interface CouponReminderConfig {days_before_expiry:number;}
export function parseCouponReminderConfig(value:unknown):CouponReminderConfig|null{
  if(value===null||value===undefined)return null;
  if(typeof value!=='object'||Array.isArray(value))throw new Error('Invalid coupon reminder configuration');
  const days=(value as Record<string,unknown>).days_before_expiry;
  if(typeof days!=='number'||!Number.isInteger(days)||days<0||days>365)throw new Error('Choose a whole-number reminder offset from 0 to 365 days');
  return {days_before_expiry:days};
}
export function couponReminderDecision(rows:CouponLifecycle[],issuedEventId:string,config:CouponReminderConfig,now:string){
  parseCouponReminderConfig(config);
  const row=rows.find(r=>r.issued_event_id===issuedEventId);
  if(!row||row.state!=='issued_no_known_redemption'||!row.expires_at)return {allowed:false,reason:row?.state==='redeemed'?'coupon_redeemed':row?.state==='expired'?'coupon_expired':'coupon_evidence_unknown',scheduled_at:null};
  if(!timestamp(now)||!timestamp(row.issued_at)||!timestamp(row.expires_at)||Date.parse(row.issued_at!)>Date.parse(now)||Date.parse(row.expires_at)<Date.parse(row.issued_at!))return {allowed:false,reason:'coupon_evidence_unknown',scheduled_at:null};
  if(Date.parse(now)>=Date.parse(row.expires_at))return {allowed:false,reason:'coupon_expired',scheduled_at:null};
  const scheduled=Date.parse(row.expires_at)-config.days_before_expiry*86400000;
  if(scheduled<Date.parse(row.issued_at!))return {allowed:false,reason:'coupon_window_before_issue',scheduled_at:null};
  return {allowed:Date.parse(now)>=scheduled,reason:Date.parse(now)>=scheduled?'coupon_due':'coupon_not_due',scheduled_at:new Date(scheduled).toISOString()};
}
export function parseCouponReminderForChannel(value:unknown,channel:string):CouponReminderConfig|null{
 const config=parseCouponReminderConfig(value);
 if(config&&channel!=='email')throw new Error('Coupon reminders currently support email only');
 return config;
}
