import {assert,assertEquals,assertStringIncludes,assertFalse,assertRejects} from "@std/assert";
import {StripeAccessError,financeFacts,financeIntent,financeRange,payoutBrief,payoutOutlook,localDate,rankPayments,readPlatformFinance,stripeMoney,type Payout} from "./finance.ts";
const at=(iso:string)=>Math.floor(Date.parse(iso)/1000);
Deno.test("Payout brief distinguishes CAD/USD, paid vs in transit, and bank settlement",()=>{
 const payouts:Payout[]=[
 {id:"po1",amount:12999,currency:"cad",status:"paid",arrival_date:at("2026-11-07T15:00:00Z"),created:at("2026-11-06T15:00:00Z")},
 {id:"po2",amount:20250,currency:"usd",status:"in_transit",arrival_date:at("2026-11-07T15:00:00Z"),created:at("2026-11-06T15:00:00Z")},
 {id:"po3",amount:500,currency:"cad",status:"failed",arrival_date:at("2026-11-07T15:00:00Z"),created:at("2026-11-06T15:00:00Z")},
 ];
 const msg=payoutBrief(payouts,at("2026-11-07T18:00:00Z"));
 assertStringIncludes(msg,"CAD");
 assertStringIncludes(msg,"USD");
 assertStringIncludes(msg,"Stripe marked paid (expected available)");
 assertStringIncludes(msg,"On its way");
 assertStringIncludes(msg,"bank settlement");
 assertFalse(msg.includes("po1"));
});
Deno.test("Pacific local date handles UTC boundaries",()=>{
 assertEquals(localDate(at("2026-11-08T01:00:00Z")),"2026-11-07");
 assertEquals(localDate(at("2026-11-08T09:00:00Z")),"2026-11-08");
});

Deno.test("finance questions map to one Stripe lookup; ordinary questions map to none",()=>{
 assertEquals(financeIntent("when is the next payout"),"payouts");
 assertEquals(financeIntent("When is our next payout"),"payouts");
 assertEquals(financeIntent("How much did we make in commissions"),"commissions");
 assertEquals(financeIntent("What clients has paid the most money to us"),"client_payments");
 assertEquals(financeIntent("who are our top paying clients this year"),"client_payments");
 assertEquals(financeIntent("How many open tickets"),null);
 assertEquals(financeIntent("how much revenue have we generated from events by garden center?"),null);
});
Deno.test("a named period is used; otherwise the last 12 months",()=>{
 assertEquals(financeRange("commissions this month","2026-11-26"),{from:"2026-11-01",to:"2026-11-26"});
 assertEquals(financeRange("commissions last month","2026-11-26"),{from:"2026-10-01",to:"2026-10-31"});
 assertEquals(financeRange("commissions this year","2026-11-26"),{from:"2026-01-01",to:"2026-11-26"});
 assertEquals(financeRange("commissions in the last 30 days","2026-11-26"),{from:"2026-10-27",to:"2026-11-26"});
 assertEquals(financeRange("How much did we make in commissions","2026-11-26"),{from:"2025-11-26",to:"2026-11-26"});
 assertEquals(financeRange("","2026-11-26","2026-03-01","2026-03-31"),{from:"2026-03-01",to:"2026-03-31"});
});
Deno.test("Stripe minor units become plain amounts with a currency code",()=>{
 assertEquals(stripeMoney(123456,"cad"),"1,234.56 CAD");
 assertEquals(stripeMoney(-500,"usd"),"-5.00 USD");
 assertEquals(stripeMoney(1200,"jpy"),"1,200 JPY");
});
Deno.test("payout answer lists payouts on their way, the waiting balance and the last paid payout",()=>{
 const payouts:Payout[]=[
 {id:"po1",amount:8940,currency:"cad",status:"in_transit",arrival_date:at("2026-11-27T15:00:00Z"),created:at("2026-11-26T15:00:00Z")},
 {id:"po2",amount:27600,currency:"cad",status:"paid",arrival_date:at("2026-11-18T15:00:00Z"),created:at("2026-11-17T15:00:00Z")},
 ];
 const text=financeFacts(payoutOutlook(payouts,{available:[{currency:"CAD",amount:1000}],pending:[{currency:"USD",amount:2525}]},at("2026-11-26T20:00:00Z")));
 assertStringIncludes(text,"On its way, arrives 2026-11-27: 89.40 CAD (1 payout)");
 assertStringIncludes(text,"10.00 CAD available, 25.25 USD still settling");
 assertStringIncludes(text,"Last paid: 276.00 CAD on 2026-11-18");
 assertFalse(text.includes("po1"));
 const none=financeFacts(payoutOutlook([],null,at("2026-11-26T20:00:00Z")));
 assertStringIncludes(none,"No payout is scheduled right now");
 assertStringIncludes(none,"cannot read it");
});
Deno.test("commissions and client payments total per currency and rank names without mixing currencies",()=>{
 const r=rankPayments("commissions",[{name:"Alpha Gardens",currency:"cad",amount:5000},{name:"Alpha Gardens",currency:"cad",amount:2500},{name:"Beta Nursery",currency:"usd",amount:9000}],{from:"2026-01-01",to:"2026-11-26"},"2026-11-26",false);
 const text=financeFacts(r);
 assertStringIncludes(text,"Total: 75.00 CAD · 90.00 USD (3 fees)");
 assertStringIncludes(text,"1. Beta Nursery: 90.00 USD (1)");
 assertStringIncludes(text,"2. Alpha Gardens: 75.00 CAD (2)");
 assertStringIncludes(financeFacts(rankPayments("client_payments",[],{from:"2026-01-01",to:"2026-11-26"},"2026-11-26",false)),"no paid invoices");
});
async function stripe(respond:(url:string)=>Response|unknown,run:()=>Promise<void>){
 const old=globalThis.fetch, prior=Deno.env.get("BLOOM_SUPPORT_STRIPE_READONLY_KEY");
 Deno.env.set("BLOOM_SUPPORT_STRIPE_READONLY_KEY","rk_test_placeholder");
 globalThis.fetch=(input)=>{const d=respond(String(input));return Promise.resolve(d instanceof Response?d:new Response(JSON.stringify(d)));};
 try{await run();}finally{globalThis.fetch=old;prior===undefined?Deno.env.delete("BLOOM_SUPPORT_STRIPE_READONLY_KEY"):Deno.env.set("BLOOM_SUPPORT_STRIPE_READONLY_KEY",prior);}
}
Deno.test("commissions read application fees net of refunds and name the connected account",async()=>{
 const urls:string[]=[];
 await stripe(url=>{urls.push(url);
  if(url.endsWith("/v1/account"))return {id:"acct_1QFLpBDmtxsdhOlW"};
  return {has_more:false,data:[{id:"fee_1",amount:1000,amount_refunded:250,currency:"cad",account:{id:"acct_x1",business_profile:{name:"Alpha Gardens"}}}]};
 },async()=>{
  const r=await readPlatformFinance("commissions",{from:"2026-11-01",to:"2026-11-26"},at("2026-11-26T20:00:00Z"));
  assertEquals(r.totals,[{currency:"CAD",amount:750}]);
  assertEquals(r.top?.[0].name,"Alpha Gardens");
 });
 assert(urls.some(u=>u.includes("/v1/application_fees?")&&u.includes("created%5Bgte%5D=")));
 assertFalse(urls.some(u=>u.includes("/v1/payouts")));
});
Deno.test("a Stripe key without access is reported as an access gap, and the wrong account is never read",async()=>{
 await stripe(url=>url.endsWith("/v1/account")?{id:"acct_1QFLpBDmtxsdhOlW"}:new Response("{}",{status:403}),async()=>{
  const e=await readPlatformFinance("client_payments",{from:"2026-11-01",to:"2026-11-26"}).catch(x=>x);
  assert(e instanceof StripeAccessError);
  assertEquals(e.resource,"invoices");
 });
 await stripe(()=>({id:"acct_other"}),async()=>{
  await assertRejects(()=>readPlatformFinance("payouts",{from:"2026-11-01",to:"2026-11-26"}));
 });
});
