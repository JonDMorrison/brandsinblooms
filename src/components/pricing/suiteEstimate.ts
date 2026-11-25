// Public USD proposal only. Never use this client-side estimate as a billing authority.
export const SUITE_PRICE_BOOK = Object.freeze({
 version: "suite-preview-2026-11-25-v2", currency: "USD", status: "proposal",
 product: 9900, complete: 25000, emailIncluded: 20000, emailPerThousand: 300,
 smsSegment: 4.5, extraWebsite: 9900, extraLocation: 7900, extraRegister: 2900,
 includedRegisters: 1, onlineFeePercent: 0.5, advancedAi: 2900,
} as const);
export const PRODUCTS = [
 {id:"site",name:"BloomSites",promise:"Sell more plants.",description:"Your website, plant catalogue and online selling.",features:["Website builder & hosting","Plant discovery & catalogue","Online commerce, subject to setup"]},
 {id:"pos",name:"BloomSuite POS",promise:"Make life easier.",description:"The checkout and operations tools built for garden retail.",features:["Register & checkout","Inventory and receiving","One location and one register"]},
 {id:"crm",name:"BloomSuite CRM",promise:"Keep customers coming back.",description:"Customer relationships, marketing and insights.",features:["Customer database & segmentation","Email campaigns & automations","20,000 emails per month"]},
] as const;
export interface SuiteConfiguration {
 site:boolean; pos:boolean; crm:boolean; websites:number; locations:number; registers:number;
 emails:number; sms:number; segments:number; onlineSales:number; advancedAi:boolean;
}
export const DEFAULT_SUITE_CONFIGURATION:SuiteConfiguration = {
 site:true,pos:true,crm:true,websites:1,locations:1,registers:1,emails:20000,sms:0,segments:1,onlineSales:0,advancedAi:false,
};
const bound=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:min));
const int=(v:number,min:number,max:number)=>Math.floor(bound(v,min,max));
export const usd=(cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(cents/100);
export function normalizeConfiguration(c:SuiteConfiguration):SuiteConfiguration{
 return {...c,websites:int(c.websites,1,20),locations:int(c.locations,1,100),registers:int(c.registers,1,20),
 emails:int(c.emails,0,10000000),sms:int(c.sms,0,10000000),segments:int(c.segments,1,10),onlineSales:bound(c.onlineSales,0,100000000)};
}
export function calculateSuiteEstimate(raw:SuiteConfiguration){
 const c=normalizeConfiguration(raw),p=SUITE_PRICE_BOOK;
 const count=Number(c.site)+Number(c.pos)+Number(c.crm);
 const base=count*p.product,discount=count===3?base-p.complete:0;
 const websites=c.site?(c.websites-1)*p.extraWebsite:0;
 const locations=c.pos?(c.locations-1)*p.extraLocation:0;
 const registers=c.pos?c.locations*Math.max(0,c.registers-p.includedRegisters)*p.extraRegister:0;
 const ai=c.crm&&c.advancedAi?p.advancedAi:0;
 const email=c.crm?Math.round(Math.max(0,c.emails-p.emailIncluded)*p.emailPerThousand/1000):0;
 const segments=c.crm?c.sms*c.segments:0,sms=Math.round(segments*p.smsSegment);
 const commerce=c.site?Math.round(c.onlineSales*p.onlineFeePercent):0;
 const software=base-discount+websites+locations+registers+ai;
 const bloom=software+email+sms+commerce;
 const rows=[
 ...PRODUCTS.filter(x=>c[x.id]).map(x=>({label:x.name,cents:p.product})),
 ...(discount?[{label:"Complete suite saving",cents:-discount}]:[]),
 ...(websites?[{label:"Additional websites",cents:websites}]:[]),
 ...(locations?[{label:"Additional POS locations",cents:locations}]:[]),
 ...(registers?[{label:"Additional registers",cents:registers}]:[]),
 ...(ai?[{label:"Advanced AI allowance (from)",cents:ai}]:[]),
 ...(c.crm?[{label:"Additional email",cents:email},{label:"SMS segments",cents:sms}]:[]),
 ...(c.site&&commerce?[{label:"Estimated online commerce fee",cents:commerce}]:[]),
 ];
 return {c,count,hasProducts:count>0,software,discount,email,sms,segments,commerce,bloom,rows,quoteRequired:c.crm&&(c.emails>250000||segments>20000)};
}
export function suiteEstimateSummary(raw:SuiteConfiguration){
 const e=calculateSuiteEstimate(raw),c=e.c;
 return [
 "Please review my BloomSuite setup. Proposed USD estimate, not a purchase or binding quote.",
 "Price book: "+SUITE_PRICE_BOOK.version,
 "Products: "+PRODUCTS.filter(x=>c[x.id]).map(x=>x.name).join(", "),
 "Websites: "+(c.site?c.websites:0)+". POS locations: "+(c.pos?c.locations:0)+", registers per location: "+(c.pos?c.registers:0)+".",
 "Monthly CRM emails: "+(c.crm?c.emails:0)+", SMS segments: "+e.segments+". Advanced AI: "+(c.crm&&c.advancedAi?"yes":"no")+".",
 "Eligible online sales estimate: "+usd(Math.round((c.site?c.onlineSales:0)*100))+".",
 "Software: "+usd(e.software)+"/mo. Estimated messaging and commerce: "+usd(e.email+e.sms+e.commerce)+"/mo. Total: "+usd(e.bloom)+"/mo.",
 "Confirm messaging costs, regional pricing, processing, integrations, hardware and setup before purchase. "+(e.quoteRequired?"High-volume quote requested.":"")
 ].join("\n");
}
