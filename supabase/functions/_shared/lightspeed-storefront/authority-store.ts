import { asSourceRecord, type SourceRecord } from "./normalize.ts";
import { publicSigningKey } from "./bridge-protocol.ts";
import type { AuthorityGrant, AuthorityGrantStatus, AuthorityMutation, AuthorityRepository } from "./authority.ts";
export type LightspeedRpc = (name:string,args:SourceRecord)=>Promise<{data:unknown;error:unknown}>;
export class LightspeedStorageError extends Error {
  constructor(readonly code="platform_storage_unavailable") {super(code);this.name="LightspeedStorageError";}
}
export async function rpcValue(rpc:LightspeedRpc,name:string,args:SourceRecord):Promise<unknown> {
  const result=await rpc(name,args);
  if(result.error)throw new LightspeedStorageError();
  return result.data;
}
function grantRow(value:unknown):AuthorityGrant|null {
  if(value==null)return null;const row=asSourceRecord(value);
  if(!row || typeof row.id!=="string" || typeof row.site_id!=="string" ||
    typeof row.state_hash!=="string" || typeof row.prefix!=="string" || typeof row.status!=="string" ||
    !Number.isSafeInteger(row.version) || typeof row.expires_at!=="string")throw new LightspeedStorageError("invalid_grant_record");
  const stringOrNull=(v:unknown)=>typeof v==="string"?v:null;
  return {id:row.id,siteId:row.site_id,stateHash:row.state_hash,prefix:row.prefix,status:row.status as AuthorityGrantStatus,
    version:row.version as number,expiresAt:row.expires_at,publicKey:publicSigningKey(row.public_key),
    codeHash:stringOrNull(row.code_hash),tokenCiphertext:stringOrNull(row.token_ciphertext),
    receiptCiphertext:stringOrNull(row.receipt_ciphertext),receiptHash:stringOrNull(row.receipt_hash),
    retailerId:stringOrNull(row.retailer_id),currency:stringOrNull(row.currency),
    tokenExpiresAt:stringOrNull(row.token_expires_at),leaseId:stringOrNull(row.lease_id),leaseExpiresAt:stringOrNull(row.lease_expires_at)};
}
export class RpcLightspeedAuthorityRepository implements AuthorityRepository {
  constructor(private readonly rpc:LightspeedRpc) {}
  async create(input:Pick<AuthorityGrant,"siteId"|"stateHash"|"prefix"|"publicKey"|"expiresAt">):Promise<AuthorityGrant> {
    const row=grantRow(await rpcValue(this.rpc,"lightspeed_authority_create_v1",{p_context:input}));
    if(!row)throw new LightspeedStorageError();return row;
  }
  async get(id:string){return grantRow(await rpcValue(this.rpc,"lightspeed_authority_read_v1",{p_id:id,p_state_hash:null}));}
  async findByState(stateHash:string){return grantRow(await rpcValue(this.rpc,"lightspeed_authority_read_v1",{p_id:null,p_state_hash:stateHash}));}
  async compareAndSwap(grant:AuthorityGrant,mutation:AuthorityMutation) {
    return grantRow(await rpcValue(this.rpc,"lightspeed_authority_update_v1",{
      p_id:grant.id,p_version:grant.version,p_status:grant.status,p_patch:mutation}));
  }
  async consumeNonce(grantId:string,nonceHash:string,validUntil:string) {
    return await rpcValue(this.rpc,"lightspeed_authority_nonce_v1",{
      p_grant_id:grantId,p_nonce_hash:nonceHash,p_valid_until:validUntil})===true;
  }
}
