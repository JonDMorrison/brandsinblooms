import {supabase} from '@/integrations/supabase/client';
import {MANUAL_SYNC_MAX_BYTES,MANUAL_SYNC_FAMILIES,type ManualSyncJob} from '../../../supabase/functions/_shared/customer-intelligence/manual-sync-job-contract';
export type ManualSyncFamily=typeof MANUAL_SYNC_FAMILIES[number];
export class ManualSyncUncertainError extends Error {constructor(public readonly jobId:string|null){super('The request outcome is uncertain. Refresh jobs and inspect the recorded state before any further action.');}}
function job(value:unknown,tenantId:string):ManualSyncJob{
 if(!value||typeof value!=='object'||!('tenant_id'in value)||value.tenant_id!==tenantId||!('id'in value)||typeof value.id!=='string')throw Error('Job company scope could not be confirmed.');
 return value as ManualSyncJob;
}
async function request(tenantId:string,body:Record<string,unknown>,signal?:AbortSignal){
 signal?.throwIfAborted();
 if(!tenantId)throw Error('Select a company first.');
 const {data,error}=await supabase.functions.invoke('ideal-manual-sync-job',{body:{...body,expectedTenantId:tenantId},...(signal?{signal}:{})});
 if(error||!data||typeof data!=='object')throw new ManualSyncUncertainError(typeof body.jobId==='string'?body.jobId:null);
 return data as {job?:unknown;jobs?:unknown[];upload?:{bucket:string;path:string;token:string}};
}
export async function listManualSyncJobs(tenantId:string,signal?:AbortSignal){const result=await request(tenantId,{action:'list'},signal);if(!Array.isArray(result.jobs))throw Error('Job history was not confirmed.');return result.jobs.map(v=>job(v,tenantId));}
export async function getManualSyncJob(tenantId:string,jobId:string){return job((await request(tenantId,{action:'status',jobId})).job,tenantId);}
export async function stageManualSyncFile(tenantId:string,file:File,reportFamily:ManualSyncFamily,encoding:'utf-8'|'windows-1252',onCreated:(value:ManualSyncJob)=>void,signal?:AbortSignal){
 signal?.throwIfAborted();
 if(!file.size||file.size>MANUAL_SYNC_MAX_BYTES)throw Error('Choose an original file between 1 byte and 128 MiB.');
 if(!/\.(xls|xlsx|csv|txt|tsv)$/i.test(file.name)||/[\\/]/.test(file.name))throw Error('Choose an original Excel, CSV or text report with a plain filename.');
 const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());const sourceSha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 const result=await request(tenantId,{action:'create',filename:file.name,sourceSha256,sourceBytes:file.size,reportFamily,encoding},signal);const created=job(result.job,tenantId);signal?.throwIfAborted();onCreated(created);
 if(created.source_sha256!==sourceSha256||created.source_bytes!==file.size)throw new ManualSyncUncertainError(created.id);
 if(created.status!=='uploading')return created;
 const expectedPath=`${tenantId}/${created.id}/${sourceSha256}/original.${created.source_filename.split('.').pop()?.toLowerCase()}`;
 if(!result.upload||result.upload.bucket!=='ideal-import-staging'||result.upload.path!==expectedPath)throw new ManualSyncUncertainError(created.id);
 const {error}=await supabase.storage.from(result.upload.bucket).uploadToSignedUrl(result.upload.path,result.upload.token,file,{upsert:false});
 if(error||signal?.aborted)throw new ManualSyncUncertainError(created.id);
 return job((await request(tenantId,{action:'stage',jobId:created.id},signal)).job,tenantId);
}
export async function approveManualSyncJob(tenantId:string,value:ManualSyncJob){
 if(value.tenant_id!==tenantId||value.status!=='review_required'||!value.plan_sha256||!value.approval_sha256||!value.manifest_sha256||!['annual_sales','customer_sales'].includes(value.report_family)||!value.review_summary||value.review_summary.failures.length)throw Error('This exact job is not eligible for approval.');
 return job((await request(tenantId,{action:'approve',jobId:value.id,manifestSha256:value.manifest_sha256,planSha256:value.plan_sha256,approvalSha256:value.approval_sha256})).job,tenantId);
}
export async function cancelManualSyncJob(tenantId:string,jobId:string){return job((await request(tenantId,{action:'cancel',jobId})).job,tenantId);}

export function formatManualSyncAmount(cents:number):string{if(!Number.isSafeInteger(cents))return 'Unknown';const value=BigInt(cents),absolute=value<0n?-value:value;return `${value<0n?'-':''}${absolute/100n}.${String(absolute%100n).padStart(2,'0')}`;}
