import {assertEquals,assertStringIncludes,assertFalse} from "@std/assert";
import {payoutBrief,localDate,type Payout} from "./finance.ts";
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
