// This guard is mandatory at queue creation and before the provider request.
export async function careFollowupAllowed(client:any,campaignId:string,recipients:Array<{customerId:string;email:string}>):Promise<Set<string>|null>{
 const {data,error}=await client.rpc('care_followup_delivery_guard',{p_campaign:campaignId,p_recipients:recipients});
 if(error)throw Error('Care follow-up eligibility could not be verified');
 if(data===null)return null;
 if(!Array.isArray(data)||data.some(id=>typeof id!=='string'))throw Error('Invalid care follow-up eligibility result');
 return new Set(data);
}
