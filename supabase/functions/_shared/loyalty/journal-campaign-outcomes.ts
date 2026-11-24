import {journalBusinessDay,journalCoverage,type ObservedJournalPeriod} from '../customer-intelligence/observed-ideal-journal.ts';

export type JournalCampaignMessage={id:string;tenant_id:string;campaign_id:string;customer_id:string;sent_at:string|null;resend_id:string|null;delivery_reconciliation_required:boolean};
const stamp=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
const add=(a:number,b:number)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error('Recorded total exceeds exact arithmetic range.');return n;};
/** Read-only observation over an immutable baseline audience; absence is unknown.
 * Do not equate provider-accepted sends with delivery, or observed purchases with lift. */
export function observedJournalCampaignOutcome(period:ObservedJournalPeriod,cohort:string[],campaignId:string,messages:JournalCampaignMessage[],baselineCapturedAt:string,productCode:string|null){
 if(!period.receiptEvidence||!stamp(period.cutoff)||!stamp(baselineCapturedAt)||!campaignId||!cohort.length||new Set(cohort).size!==cohort.length||cohort.length>100000)throw Error('A frozen customer audience and reviewed journal evidence are required.');
 const allowed=new Set(cohort),firstSent=new Map<string,number>(),outside=new Set<string>(),unknown=new Set<string>(),seen=new Map<string,string>(),providers=new Map<string,string>();
 let acceptedSendRecords=0,unverifiedSendRecords=0;
 const cutoff=Date.parse(period.cutoff);
 for(const m of messages){
  if(m.tenant_id!==period.tenantId||m.campaign_id!==campaignId)throw Error('Cross-company or cross-campaign message rejected.');
  const serial=JSON.stringify(m);if(seen.has(m.id)){if(seen.get(m.id)!==serial)throw Error('Conflicting message evidence.');continue;}seen.set(m.id,serial);
  if(!stamp(m.sent_at)||!m.resend_id||m.delivery_reconciliation_required){unverifiedSendRecords++;if(allowed.has(m.customer_id))unknown.add(m.customer_id);continue;}
  const sent=Date.parse(m.sent_at),day=journalBusinessDay(m.sent_at,period.source,period.timezone);
  if(sent>cutoff||!day||day>period.window.end)continue;
  const meaning=JSON.stringify([m.customer_id,sent]);
  if(providers.has(m.resend_id)){if(providers.get(m.resend_id)!==meaning)throw Error('Conflicting provider message identity.');continue;}providers.set(m.resend_id,meaning);
  acceptedSendRecords++;
  if(!allowed.has(m.customer_id)){outside.add(m.customer_id);continue;}
  firstSent.set(m.customer_id,Math.min(firstSent.get(m.customer_id)??Infinity,sent));
 }
 if(!firstSent.size)throw Error('No verified provider-accepted send records for this frozen audience and period. Campaign purchases cannot be established.');
 const receipts=new Set<string>(),buyers=new Set<string>(),paidDays=new Set<string>(),featuredBuyers=new Set<string>();
 let netMinor=0,positiveReceipts=0,featuredQuantityMilli=0,unknownFeaturedReceipts=0,observedReceipts=0;
 for(const r of period.receiptEvidence){
  if(!r.id.startsWith(period.source.id+':')||receipts.has(r.id)||!stamp(r.timestamp)||r.day!==journalBusinessDay(r.timestamp,period.source,period.timezone)||r.day<period.window.start||r.day>period.window.end||Date.parse(r.timestamp)>cutoff||!Number.isSafeInteger(r.netMinor))throw Error('Journal receipt evidence is inconsistent.');
  receipts.add(r.id);
  const sent=firstSent.get(r.customerId);if(sent===undefined||Date.parse(r.timestamp)<=sent)continue;
  observedReceipts++;netMinor=add(netMinor,r.netMinor);
  if(r.netMinor>0){buyers.add(r.customerId);positiveReceipts++;paidDays.add(r.customerId+'\0'+r.day);}
  if(productCode){
   if(r.featuredNetQuantityMilli===null)unknownFeaturedReceipts++;
   else {featuredQuantityMilli=add(featuredQuantityMilli,r.featuredNetQuantityMilli);if(r.paidFeaturedPurchase&&r.netMinor>0)featuredBuyers.add(r.customerId);}
  }
 }
 return {version:1 as const,mode:'observed_journal_campaign_preview' as const,campaignId,window:period.window,currency:period.currency,timezone:period.timezone,cutoff:period.cutoff,source:{id:period.source.id,filename:period.source.source_filename,sha256:period.source.source_sha256},
  coverage:journalCoverage(period.source),
  frozenCustomers:cohort.length,verifiedSentCustomers:firstSent.size,acceptedSendRecords,outsideFrozenAudienceSentCustomers:outside.size,unverifiedSendRecords,customersWithUnverifiedSend:unknown.size,
  baselineCapturedBeforeFirstSend:[...firstSent.values()].every(sent=>Date.parse(baselineCapturedAt)<=sent),
  customersWithObservedPositivePurchase:buyers.size,positiveReceipts,observedPositivePurchaseDays:paidDays.size,observedReceipts,observedNetSpendMinor:observedReceipts?netMinor:null,
  sentCustomersWithoutObservedPositivePurchase:firstSent.size-buyers.size,excludedSourceReceipts:period.excludedReceipts,
  featured:productCode?{productCode,customersWithObservedPositivePricedItem:featuredBuyers.size,observedSignedQuantityMilli:observedReceipts&&unknownFeaturedReceipts===0?featuredQuantityMilli:null,unknownFeaturedReceipts}:null,
  limitations:['This is an observed source preview, not proof of campaign causation, delivery or complete POS coverage.','No observed purchase is not proof of inactivity. Refund-only and free receipts do not count as paid purchase days.','Signed net spending includes recorded refunds after the send. Featured signed quantities include zero-priced items and returns; positive-priced buyer counts require a positive-net receipt.','The frozen audience is not expanded to include people outside it. A baseline captured after send is a retrospective intersection, not original targeting evidence.']};
}
export type ObservedJournalCampaignOutcome=ReturnType<typeof observedJournalCampaignOutcome>;
