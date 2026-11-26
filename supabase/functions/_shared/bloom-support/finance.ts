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
/** The read-only key exists but Stripe refused this resource. Staff can fix this in Stripe; it is not an outage. */
export class StripeAccessError extends Error {
  constructor(public readonly resource:string){super("Stripe read-only key cannot read "+resource);}
}
async function stripeGet(path: string, key:string, resource="payouts"): Promise<Record<string,unknown>> {
  let response:Response;
  try {
    response=await fetch("https://api.stripe.com"+path,{
      headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(10000)
    });
  }catch {throw new BloomError(502,"stripe_network","Stripe payout reporting is temporarily unavailable");}
  if(response.status===401||response.status===403){await response.body?.cancel();throw new StripeAccessError(resource);}
  if(!response.ok) throw new BloomError(502,"stripe_report_error","Stripe payout report was not available");
  const data=await response.json().catch(()=>null);
  if(!data||typeof data!=="object"||Array.isArray(data))
    throw new BloomError(502,"stripe_invalid_response","Stripe report was malformed");
  return data as Record<string,unknown>;
}
async function platformKey():Promise<string>{
  const key=env("BLOOM_SUPPORT_STRIPE_READONLY_KEY");
  if(!key) throw new BloomError(503,"not_configured","Stripe read-only reporting credential missing");
  const account=await stripeGet("/v1/account",key,"the account");
  if(account.id!==PLATFORM_ACCOUNT) throw new BloomError(403,"wrong_stripe_account","Stripe account is not Brands in Blooms");
  return key;
}
async function fetchPayouts(key:string,nowSeconds:number):Promise<Payout[]>{
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
    if(data.has_more!==true)return payouts;
    cursor=rows.at(-1)?.id as string|undefined;
    if(!cursor)throw new BloomError(502,"stripe_pagination","Incomplete Stripe payout data");
  }
  throw new BloomError(502,"stripe_pagination","Too many payouts for a complete report; review Stripe directly");
}
export async function stripeDailyPayoutBrief(nowSeconds=Math.floor(Date.now()/1000)):Promise<string>{
  return payoutBrief(await fetchPayouts(await platformKey(),nowSeconds),nowSeconds);
}

// ---------------------------------------------------------------------------
// Owner questions in Slack: payouts, commissions and client payments.
// Read-only, platform account only, aggregates only. Amounts are composed in
// code from Stripe's own records; the model never transcribes a figure.
// ---------------------------------------------------------------------------
export type FinanceKind="payouts"|"commissions"|"client_payments";
export interface Amount {currency:string;amount:number}
export interface FinanceResult {
  kind:FinanceKind; today:string; range?:{from:string;to:string}; partial?:boolean;
  upcoming?:Array<Amount&{arrival:string;status:string;count:number}>;
  recent?:Array<Amount&{arrival:string}>;
  balance?:{available:Amount[];pending:Amount[]}|null;
  totals?:Amount[]; count?:number;
  top?:Array<Amount&{name:string;count:number}>;
}
const ZERO_DECIMAL=new Set(["BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"]);
/** 123456 cad -> "1,234.56 CAD". Minor units in, plain text out. */
export function stripeMoney(amount:number,currency:string):string{
  const code=currency.toUpperCase();
  const value=ZERO_DECIMAL.has(code)?amount:amount/100;
  const [whole,cents]=Math.abs(value).toFixed(ZERO_DECIMAL.has(code)?0:2).split(".");
  return (value<0?"-":"")+whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")+(cents?"."+cents:"")+" "+code;
}
/** Which Stripe question this is, or null. Read-only either way, so a loose match is safe. */
export function financeIntent(question:string):FinanceKind|null{
  const q=question.toLowerCase();
  if(/\bpay[ -]?outs?\b|\bpaid out\b|\bstripe balance\b/.test(q))return "payouts";
  if(/\bcommissions?\b|\b(?:application|platform) fees?\b/.test(q))return "commissions";
  if(/\b(?:clients?|customers?|garden cent(?:re|er)s?|who)\b.{0,40}\b(?:paid|pays?|paying)\b.{0,30}\b(?:most|us|top)\b|\btop[- ]paying\b|\b(?:biggest|largest|top) (?:paying )?(?:clients?|customers?)\b|\bsubscription (?:revenue|income|payments?)\b/.test(q))return "client_payments";
  return null;
}
const day=(d:Date)=>d.toISOString().slice(0,10);
/** The period a staff member named, else the last 12 months. Dates are UTC days, inclusive. */
export function financeRange(question:string,today:string,from?:string|null,to?:string|null):{from:string;to:string}{
  if(from||to){const end=to??today;return {from:from??day(new Date(Date.parse(end+"T00:00:00Z")-365*864e5)),to:end};}
  const q=question.toLowerCase(), t=new Date(today+"T00:00:00Z"), y=t.getUTCFullYear(), m=t.getUTCMonth();
  const days=/\b(?:last|past) (\d{1,3}) days?\b/.exec(q);
  if(days)return {from:day(new Date(t.getTime()-Number(days[1])*864e5)),to:today};
  if(/\bthis month\b/.test(q))return {from:day(new Date(Date.UTC(y,m,1))),to:today};
  if(/\blast month\b/.test(q))return {from:day(new Date(Date.UTC(y,m-1,1))),to:day(new Date(Date.UTC(y,m,0)))};
  if(/\bthis year\b|\byear to date\b|\bytd\b/.test(q))return {from:y+"-01-01",to:today};
  if(/\blast year\b/.test(q))return {from:(y-1)+"-01-01",to:(y-1)+"-12-31"};
  if(/\b(?:this|past|last) week\b/.test(q))return {from:day(new Date(t.getTime()-7*864e5)),to:today};
  return {from:day(new Date(t.getTime()-365*864e5)),to:today};
}
const label=(v:unknown,max=60):string=>typeof v==="string"?v.replace(/[*_~`<>|@\n\r]/g," ").replace(/\s+/g," ").trim().slice(0,max):"";
const sumBy=(rows:Amount[]):Amount[]=>{
  const totals=new Map<string,number>();
  for(const r of rows)totals.set(r.currency.toUpperCase(),(totals.get(r.currency.toUpperCase())??0)+r.amount);
  return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,amount])=>({currency,amount}));
};
/** Payouts Stripe has created and not yet paid, the latest paid ones, and the balance still to be paid out. */
export function payoutOutlook(payouts:readonly Payout[],balance:FinanceResult["balance"],nowSeconds:number):FinanceResult{
  const groups=new Map<string,Amount&{arrival:string;status:string;count:number}>();
  for(const p of payouts.filter(p=>p.status==="pending"||p.status==="in_transit")){
    const arrival=localDate(p.arrival_date), key=arrival+"|"+p.currency+"|"+p.status;
    const g=groups.get(key)??{arrival,currency:p.currency.toUpperCase(),status:p.status,amount:0,count:0};
    g.amount+=p.amount;g.count++;groups.set(key,g);
  }
  const recent=payouts.filter(p=>p.status==="paid").sort((a,b)=>b.arrival_date-a.arrival_date).slice(0,3)
    .map(p=>({arrival:localDate(p.arrival_date),currency:p.currency.toUpperCase(),amount:p.amount}));
  return {kind:"payouts",today:localDate(nowSeconds),upcoming:[...groups.values()].sort((a,b)=>a.arrival.localeCompare(b.arrival)),recent,balance};
}
/** Totals per currency plus the ten largest names. Rows carry a display name, never a contact detail. */
export function rankPayments(kind:"commissions"|"client_payments",rows:Array<Amount&{name:string}>,range:{from:string;to:string},today:string,partial:boolean):FinanceResult{
  const groups=new Map<string,Amount&{name:string;count:number}>();
  for(const r of rows){
    const key=r.name+"|"+r.currency.toUpperCase();
    const g=groups.get(key)??{name:r.name,currency:r.currency.toUpperCase(),amount:0,count:0};
    g.amount+=r.amount;g.count++;groups.set(key,g);
  }
  return {kind,today,range,partial,count:rows.length,totals:sumBy(rows),
    top:[...groups.values()].sort((a,b)=>b.amount-a.amount).slice(0,10)};
}
/** Slack text for one result. Every amount here came from Stripe. */
export function financeFacts(r:FinanceResult):string{
  const lines:string[]=[];
  const list=(rows:Amount[])=>rows.length?rows.map(a=>stripeMoney(a.amount,a.currency)).join(" · "):"nothing";
  if(r.kind==="payouts"){
    lines.push("*Stripe payouts* (Brands in Blooms account, as of "+r.today+" Vancouver time)");
    if(r.upcoming?.length)for(const p of r.upcoming)
      lines.push("• "+(p.status==="in_transit"?"On its way":"Pending")+", arrives "+p.arrival+": "+stripeMoney(p.amount,p.currency)+" ("+p.count+" payout"+(p.count===1?"":"s")+")");
    else lines.push("• No payout is scheduled right now. Stripe creates each payout on the day it is sent.");
    if(r.balance){
      lines.push("• Balance waiting for the next payouts: "+list(r.balance.available)+" available, "+list(r.balance.pending)+" still settling");
    }else if(r.balance===null)lines.push("• Balance: the Stripe key Bloom uses cannot read it.");
    if(r.recent?.length)lines.push("• Last paid: "+r.recent.map(p=>stripeMoney(p.amount,p.currency)+" on "+p.arrival).join("; "));
    lines.push("Paid means Stripe expects the funds to be available. Confirm bank settlement separately.");
    return lines.join("\n");
  }
  const title=r.kind==="commissions"?"Stripe commissions (application fees, net of refunds)":"Paid Stripe invoices by client";
  lines.push("*"+title+"*, "+r.range?.from+" to "+r.range?.to);
  if(!r.count){lines.push("• Stripe has no "+(r.kind==="commissions"?"application fees":"paid invoices")+" on the Brands in Blooms account in this period.");return lines.join("\n");}
  lines.push("• Total: "+list(r.totals??[])+" ("+r.count+" "+(r.kind==="commissions"?"fee":"invoice")+(r.count===1?"":"s")+")");
  for(const [i,t] of (r.top??[]).entries())lines.push((i+1)+". "+t.name+": "+stripeMoney(t.amount,t.currency)+" ("+t.count+")");
  if(r.partial)lines.push("This covers the most recent 600 records only. Open Stripe for the full period.");
  if(r.kind==="client_payments")lines.push("Stripe invoices only. Payments taken outside Stripe invoices are not included.");
  return lines.join("\n");
}
async function stripeList(path:string,params:URLSearchParams,key:string,resource:string):Promise<{rows:Array<Record<string,unknown>>;partial:boolean}>{
  const rows:Array<Record<string,unknown>>=[];
  let cursor:string|undefined;
  for(let page=0;page<6;page++){
    const q=new URLSearchParams(params);q.set("limit","100");
    if(cursor)q.set("starting_after",cursor);
    const data=await stripeGet(path+"?"+q.toString(),key,resource);
    const batch=Array.isArray(data.data)?data.data as Array<Record<string,unknown>>:null;
    if(!batch)throw new BloomError(502,"stripe_invalid_response","Stripe report was malformed");
    rows.push(...batch);
    if(data.has_more!==true)return {rows,partial:false};
    cursor=typeof batch.at(-1)?.id==="string"?batch.at(-1)!.id as string:undefined;
    if(!cursor)throw new BloomError(502,"stripe_pagination","Incomplete Stripe data");
  }
  return {rows,partial:true};
}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const balanceRows=(v:unknown):Amount[]=>(Array.isArray(v)?v:[]).map(obj)
  .filter(b=>typeof b.amount==="number"&&typeof b.currency==="string"&&b.amount!==0)
  .map(b=>({amount:b.amount as number,currency:(b.currency as string).toUpperCase()}));
/** One read-only Stripe answer for an owner. Throws StripeAccessError when the key lacks that resource. */
export async function readPlatformFinance(kind:FinanceKind,range:{from:string;to:string},nowSeconds=Math.floor(Date.now()/1000)):Promise<FinanceResult>{
  const key=await platformKey();
  if(kind==="payouts"){
    const payouts=await fetchPayouts(key,nowSeconds);
    // The balance is useful, not required: a key without it still answers the payout question.
    const balance=await stripeGet("/v1/balance",key,"the balance")
      .then(b=>({available:balanceRows(b.available),pending:balanceRows(b.pending)}),e=>{if(e instanceof StripeAccessError)return null;throw e;});
    return payoutOutlook(payouts,balance,nowSeconds);
  }
  const created=new URLSearchParams({
    "created[gte]":String(Math.floor(Date.parse(range.from+"T00:00:00Z")/1000)),
    "created[lte]":String(Math.floor(Date.parse(range.to+"T23:59:59Z")/1000)),
  });
  const today=localDate(nowSeconds);
  if(kind==="commissions"){
    const withNames=new URLSearchParams(created);withNames.append("expand[]","data.account");
    // Account names need Connect read access; totals do not.
    const fees=await stripeList("/v1/application_fees",withNames,key,"application fees")
      .catch(e=>{if(e instanceof StripeAccessError)return stripeList("/v1/application_fees",created,key,"application fees");throw e;});
    const rows=fees.rows.filter(f=>typeof f.amount==="number"&&typeof f.currency==="string").map(f=>{
      const account=obj(f.account), id=typeof f.account==="string"?f.account:String(account.id??"");
      const name=label(obj(account.business_profile).name)||label(obj(obj(account.settings).dashboard).display_name)
        ||"Connected account ending "+(id.slice(-4)||"unknown");
      return {name,currency:f.currency as string,amount:(f.amount as number)-(typeof f.amount_refunded==="number"?f.amount_refunded:0)};
    });
    return rankPayments("commissions",rows,range,today,fees.partial);
  }
  const paid=new URLSearchParams(created);paid.set("status","paid");
  const invoices=await stripeList("/v1/invoices",paid,key,"invoices");
  const rows=invoices.rows.filter(i=>typeof i.amount_paid==="number"&&typeof i.currency==="string"&&(i.amount_paid as number)>0).map(i=>{
    const id=typeof i.customer==="string"?i.customer:String(obj(i.customer).id??"");
    return {name:label(i.customer_name)||"Customer ending "+(id.slice(-4)||"unknown"),currency:i.currency as string,amount:i.amount_paid as number};
  });
  return rankPayments("client_payments",rows,range,today,invoices.partial);
}
