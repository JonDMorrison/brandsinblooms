// One read-only daily report for the Brands in Blooms *platform* Stripe account.
// Never aggregate or fetch individual garden centre/connected-account payouts.
import { BloomError, env } from "./runtime.ts";

const PLATFORM_ACCOUNT = "acct_1QFLpBDmtxsdhOlW";
const TIME_ZONE = "America/Vancouver";
export interface Payout {
  id: string; amount: number; currency: string; status: string;
  arrival_date: number; created: number;
}
export function localDate(timestamp: number, zone = TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date(timestamp*1000));
  const pick=(name:string)=>parts.find(p=>p.type===name)?.value ?? "";
  return pick("year")+"-"+pick("month")+"-"+pick("day");
}
export function payoutBrief(payouts: readonly Payout[], nowSeconds: number): string {
  const date = localDate(nowSeconds);
  const sameDay = payouts.filter(p=>localDate(p.arrival_date)===date);
  const currencies=[...new Set(sameDay.map(p=>p.currency.toUpperCase()))].sort();
  const output=["*Brands in Blooms · Stripe payout report*","Scheduled arrival date: "+date+" (Vancouver time)"];
  if(!currencies.length) output.push("No payouts currently scheduled for this date.");
  for(const currency of currencies){
    for(const status of ["paid","in_transit","pending","failed","canceled"]){
      const rows=sameDay.filter(p=>p.currency.toUpperCase()===currency && p.status===status);
      if(!rows.length) continue;
      const amount=rows.reduce((sum,p)=>sum+p.amount,0);
      const money=new Intl.NumberFormat("en-CA",{style:"currency",currency}).format(amount/100);
      const label=status==="paid"?"Stripe marked paid (expected available)"
        :status==="in_transit"?"On its way":status==="pending"?"Pending"
        :status==="failed"?"Payout failed":"Canceled";
      output.push(currency+" · "+label+": "+money+" ("+rows.length+" payout"+(rows.length===1?"":"s")+")");
    }
  }
  output.push("*Important:* Paid means Stripe expects the funds to be available; confirm actual bank settlement separately.");
  output.push("<https://dashboard.stripe.com/payouts|Open payout details in Stripe>");
  return output.join("\n");
}
async function stripeGet(path: string, key:string): Promise<Record<string,unknown>> {
  let response:Response;
  try {
    response=await fetch("https://api.stripe.com"+path,{
      headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(10000)
    });
  }catch {throw new BloomError(502,"stripe_network","Stripe payout reporting is temporarily unavailable");}
  if(!response.ok) throw new BloomError(502,"stripe_report_error","Stripe payout report was not available");
  const data=await response.json().catch(()=>null);
  if(!data||typeof data!=="object"||Array.isArray(data))
    throw new BloomError(502,"stripe_invalid_response","Stripe report was malformed");
  return data as Record<string,unknown>;
}
export async function stripeDailyPayoutBrief(nowSeconds=Math.floor(Date.now()/1000)):Promise<string>{
  const key=env("BLOOM_SUPPORT_STRIPE_READONLY_KEY");
  if(!key) throw new BloomError(503,"not_configured","Stripe read-only reporting credential missing");
  const account=await stripeGet("/v1/account",key);
  if(account.id!==PLATFORM_ACCOUNT) throw new BloomError(403,"wrong_stripe_account","Stripe account is not Brands in Blooms");
  const payouts:Payout[]=[];
  let cursor:string|undefined;
  // Stripe pages are newest first; 90-day lookback handles delayed settlement.
  const since=nowSeconds-90*24*3600;
  for(let page=0;page<5;page++){
    const params=new URLSearchParams({limit:"100","created[gte]":String(since)});
    if(cursor)params.set("starting_after",cursor);
    const data=await stripeGet("/v1/payouts?"+params.toString(),key);
    const rows=Array.isArray(data.data)?data.data as Array<Record<string,unknown>>:null;
    if(!rows)throw new BloomError(502,"stripe_invalid_payouts","Stripe payout data is malformed");
    for(const row of rows){
      if(typeof row.id!=="string"||typeof row.currency!=="string"||
         typeof row.status!=="string"||typeof row.amount!=="number"||
         typeof row.arrival_date!=="number"||typeof row.created!=="number")
        throw new BloomError(502,"stripe_invalid_payouts","Unexpected payout row");
      payouts.push({id:row.id,amount:row.amount,currency:row.currency,
        status:row.status,arrival_date:row.arrival_date,created:row.created});
    }
    if(data.has_more!==true)return payoutBrief(payouts,nowSeconds);
    cursor=rows.at(-1)?.id as string|undefined;
    if(!cursor)throw new BloomError(502,"stripe_pagination","Incomplete Stripe payout data");
  }
  throw new BloomError(502,"stripe_pagination","Too many payouts for a complete report; review Stripe directly");
}
