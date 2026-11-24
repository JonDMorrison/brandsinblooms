import {validateCandidates,websiteBuyerIds} from './website-care-followup.ts';
// This guard is mandatory at queue creation and before the provider request.
export async function careFollowupAllowed(client:any,campaignId:string,recipients:Array<{customerId:string;email:string}>):Promise<Set<string>|null>{
 const {data,error}=await client.rpc('care_followup_delivery_guard',{p_campaign:campaignId,p_recipients:recipients});
 if(error)throw Error('Care follow-up eligibility could not be verified');
 if(data===null)return null;
 if(data&&typeof data==='object'&&!Array.isArray(data)&&data.kind==='website'){
  const candidates=validateCandidates(data.candidates);
  if(!candidates.length)return new Set();
  if(Deno.env.get('CARE_GUIDE_WEBSITE_FOLLOWUP_ENABLED')!=='true')throw Error('Website follow-up not enabled');
  return new Set(await websiteBuyerIds({siteId:data.siteId,tenantId:data.tenantId,productId:data.productId,from:data.from,until:data.until},candidates,Deno.env.get('CARE_GUIDE_DESIGN_SYNC_SECRET')||''));
 }
 if(!Array.isArray(data)||data.some(id=>typeof id!=='string'))throw Error('Invalid care follow-up eligibility result');
 return new Set(data);
}
