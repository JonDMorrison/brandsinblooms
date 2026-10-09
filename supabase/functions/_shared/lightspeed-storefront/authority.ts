/**
 * Server-only behaviour expressed without runtime globals, for Deno and Node tests.
 * The authority owns retailer credentials. BloomSites receives only signed,
 * site-bound read access; this does not grant permission to alter a retailer's POS.
 */
import { asSourceRecord, sourceId, versionCursor, type SourceRecord } from "./normalize.ts";
import { buildLightspeedAuthorizationUrl, exchangeLightspeedToken,
  LIGHTSPEED_READ_SCOPES, LightspeedApiError, lightspeedRequest,
  lightspeedStoreOrigin, normalizeStorePrefix, type LightspeedTokenResponse } from "./client.ts";
import { BLOOMSITES_ORIGIN, LIGHTSPEED_SITE_CALLBACK_PATH, LIGHTSPEED_SITE_CONTEXT_PATH,
  decodeBase64Url, isStorefrontLightspeedState, publicSigningKey,
  randomProofToken, sha256, verifyBridgeRequest } from "./bridge-protocol.ts";

export const AUTHORITY_CALLBACK = "https://bloomsuite.app/integrations/lightspeed/callback";
export type AuthorityGrantStatus = "pending" | "authorizing" | "authorized" | "active" | "refreshing" | "reconnect_required" | "revoked";
export interface AuthorityGrant {
  id:string; siteId:string; stateHash:string; prefix:string; publicKey:JsonWebKey;
  expiresAt:string; status:AuthorityGrantStatus; version:number;
  codeHash:string|null; tokenCiphertext:string|null; receiptCiphertext:string|null;
  receiptHash:string|null; retailerId:string|null; currency:string|null;
  tokenExpiresAt:string|null; leaseId:string|null; leaseExpiresAt:string|null;
}
export interface AuthorityMutation {
  status?:AuthorityGrantStatus; codeHash?:string|null; tokenCiphertext?:string|null;
  receiptCiphertext?:string|null; receiptHash?:string|null; retailerId?:string|null;
  currency?:string|null; tokenExpiresAt?:string|null; leaseId?:string|null;
  leaseExpiresAt?:string|null; expiresAt?:string;
}
export interface AuthorityRepository {
  /** Unique state hash; returns the existing identical state on a racing retry. */
  create(input:Pick<AuthorityGrant,"siteId"|"stateHash"|"prefix"|"publicKey"|"expiresAt">):Promise<AuthorityGrant>;
  findByState(stateHash:string):Promise<AuthorityGrant|null>;
  get(id:string):Promise<AuthorityGrant|null>;
  /** Compare-and-swap always increments version and validates the expected state. */
  compareAndSwap(grant:AuthorityGrant,mutation:AuthorityMutation):Promise<AuthorityGrant|null>;
  consumeNonce(grantId:string,nonceHash:string,validUntil:string):Promise<boolean>;
}
export interface AuthorityCrypto {
  encrypt(value:string):Promise<string>;
  decrypt(value:string):Promise<string>;
}
export interface AuthorityDependencies {
  repository:AuthorityRepository;
  encryption:AuthorityCrypto;
  /** Existing approved BloomSuite production client, never selected by request origin. */
  credentials:()=>{clientId:string;clientSecret:string};
  fetcher?:typeof fetch;
  now?:()=>number;
}
class AuthorityError extends Error {
  constructor(readonly code:string,readonly status=400,readonly retryAfterMs:number|null=null) {
    super(code);this.name="AuthorityError";
  }
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenTTL=10*60_000;
const json=(body:unknown,status=200,retryMs:number|null=null)=>new Response(JSON.stringify(body),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
    "Referrer-Policy":"no-referrer","Access-Control-Allow-Origin":"https://bloomsuite.app",
    "Vary":"Origin",...(retryMs!==null?{"Retry-After":String(Math.max(1,Math.ceil(retryMs/1000)))}:{})},
});
function credentials(deps:AuthorityDependencies):{clientId:string;clientSecret:string} {
  const value=deps.credentials();
  if(!value.clientId || !value.clientSecret)throw new AuthorityError("platform_setup_required",503);
  return value;
}
function safeId(value:unknown):string {
  if(typeof value!=="string"||!UUID.test(value))throw new AuthorityError("invalid_request");
  return value;
}
function stateValue(value:unknown):string {
  if(!isStorefrontLightspeedState(value))throw new AuthorityError("invalid_request");
  return value;
}
function assertFresh(grant:AuthorityGrant,now:number):void {
  if(!Number.isFinite(Date.parse(grant.expiresAt))||Date.parse(grant.expiresAt)<=now) {
    throw new AuthorityError("authorization_expired",410);
  }
}
function identity(grant:AuthorityGrant):SourceRecord {
  return {grantId:grant.id,siteId:grant.siteId,prefix:grant.prefix,
    retailerId:grant.retailerId,currency:grant.currency,status:grant.status};
}
function requireScopes(tokens:LightspeedTokenResponse):void {
  if(LIGHTSPEED_READ_SCOPES.some(scope=>!tokens.scopes.includes(scope))) {
    throw new AuthorityError("insufficient_scope",403);
  }
}
async function boundedRequestText(req:Request):Promise<string> {
  if(!req.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    throw new AuthorityError("invalid_request",415);
  }
  if(!req.body)throw new AuthorityError("invalid_request");
  const reader=req.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try {while(true){const c=await reader.read();if(c.done)break;size+=c.value.length;
    if(size>16_384){await reader.cancel();throw new AuthorityError("request_too_large",413);}chunks.push(c.value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}
async function readPublicContext(state:string,deps:AuthorityDependencies,now:number) {
  // Request cannot supply a URL, site id, key, or retailer domain to the authority.
  const result=asSourceRecord(await lightspeedRequest(deps.fetcher??fetch,
    new URL(LIGHTSPEED_SITE_CONTEXT_PATH,BLOOMSITES_ORIGIN),{method:"POST",
      headers:{"Content-Type":"application/json"},body:JSON.stringify({state})},15_000));
  const siteId=safeId(result?.siteId);
  const prefix=normalizeStorePrefix(result?.prefix);
  const key=publicSigningKey(result?.publicKey);
  const expiresAt=typeof result?.expiresAt==="string"?result.expiresAt:"";
  const expires=Date.parse(expiresAt);
  if(result?.stateHash!==await sha256(state)||!Number.isFinite(expires)||expires<=now||expires>now+tokenTTL+60_000) {
    throw new AuthorityError("authorization_expired",410);
  }
  return {siteId,prefix,publicKey:key,stateHash:await sha256(state),expiresAt};
}
async function callbackUrl(grant:AuthorityGrant,state:string,deps:AuthorityDependencies):Promise<string> {
  if(!grant.receiptCiphertext)throw new AuthorityError("authorization_expired",410);
  const receipt=await deps.encryption.decrypt(grant.receiptCiphertext);
  decodeBase64Url(receipt,32);
  const url=new URL(LIGHTSPEED_SITE_CALLBACK_PATH,BLOOMSITES_ORIGIN);
  url.search=new URLSearchParams({state,grant:grant.id,receipt}).toString();return url.toString();
}
async function invalidate(grant:AuthorityGrant,deps:AuthorityDependencies):Promise<void> {
  await deps.repository.compareAndSwap(grant,{status:"reconnect_required",tokenCiphertext:null,
    tokenExpiresAt:null,leaseId:null,leaseExpiresAt:null,receiptCiphertext:null});
}
async function readTokens(grant:AuthorityGrant,deps:AuthorityDependencies):Promise<LightspeedTokenResponse> {
  if(!grant.tokenCiphertext)throw new AuthorityError("grant_not_active",409);
  const raw=asSourceRecord(JSON.parse(await deps.encryption.decrypt(grant.tokenCiphertext)));
  if(!raw || typeof raw.accessToken!=="string" || typeof raw.refreshToken!=="string" ||
    typeof raw.expiresAt!=="string" || raw.domainPrefix!==grant.prefix || !Array.isArray(raw.scopes)) {
    throw new AuthorityError("reconnect_required",409);
  }
  return raw as unknown as LightspeedTokenResponse;
}
async function refreshIfExpired(grant:AuthorityGrant,deps:AuthorityDependencies,now:number):Promise<AuthorityGrant> {
  if(grant.status==="refreshing") {
    // An expired lease means the token exchange outcome is uncertain. Never replay
    // a rotating refresh token after an isolate crashed; require re-authorization.
    if(Date.parse(grant.leaseExpiresAt??"")<=now){await invalidate(grant,deps);throw new AuthorityError("reconnect_required",409);}
    throw new AuthorityError("sync_busy",429,2_000);
  }
  if(grant.status!=="active")throw new AuthorityError("grant_not_active",409);
  if(Date.parse(grant.tokenExpiresAt??"")>now)return grant;
  const lease=await deps.repository.compareAndSwap(grant,{status:"refreshing",leaseId:crypto.randomUUID(),
    leaseExpiresAt:new Date(now+60_000).toISOString()});
  if(!lease)throw new AuthorityError("sync_busy",429,2_000);
  try {
    const existing=await readTokens(lease,deps);
    const tokens=await exchangeLightspeedToken({prefix:lease.prefix,...credentials(deps),
      redirectUri:AUTHORITY_CALLBACK,grant:{kind:"refresh_token",token:existing.refreshToken},fetcher:deps.fetcher,now});
    requireScopes(tokens);
    const saved=await deps.repository.compareAndSwap(lease,{status:"active",
      tokenCiphertext:await deps.encryption.encrypt(JSON.stringify(tokens)),tokenExpiresAt:tokens.expiresAt,
      leaseId:null,leaseExpiresAt:null});
    if(!saved)throw new AuthorityError("reconnect_required",409);
    return saved;
  } catch(error) {await invalidate(lease,deps);throw error;}
}

export function createLightspeedAuthority(deps:AuthorityDependencies):(req:Request)=>Promise<Response> {
  return async req=>{
    if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{
      "Access-Control-Allow-Origin":"https://bloomsuite.app","Access-Control-Allow-Methods":"POST",
      "Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"600","Vary":"Origin"}});
    if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
    try {
      const bodyText=await boundedRequestText(req);
      const body=asSourceRecord(JSON.parse(bodyText));
      if(!body||typeof body.action!=="string")throw new AuthorityError("invalid_request");
      const now=(deps.now??Date.now)();
      if(body.action==="start") {
        const state=stateValue(body.state);const app=credentials(deps);
        // A state is minted only by an authenticated site owner in BloomSites.
        const context=await readPublicContext(state,deps,now);
        const grant=await deps.repository.create(context);
        if(grant.status!=="pending"||grant.siteId!==context.siteId||grant.prefix!==context.prefix||
          JSON.stringify(publicSigningKey(grant.publicKey))!==JSON.stringify(context.publicKey)) {
          throw new AuthorityError("authorization_expired",410);
        }
        assertFresh(grant,now);
        return json({ok:true,authorizationUrl:buildLightspeedAuthorizationUrl({clientId:app.clientId,
          redirectUri:AUTHORITY_CALLBACK,state})});
      }
      if(body.action==="callback") {
        const state=stateValue(body.state);
        if(typeof body.code!=="string"||body.code.length<8||body.code.length>2048||/[\r\n]/.test(body.code)) {
          throw new AuthorityError("invalid_request");
        }
        const grant=await deps.repository.findByState(await sha256(state));
        if(!grant)throw new AuthorityError("authorization_expired",410);
        assertFresh(grant,now);
        if(body.domainPrefix != null && normalizeStorePrefix(body.domainPrefix)!==grant.prefix)throw new AuthorityError("wrong_retailer",409);
        const codeHash=await sha256(body.code);
        // X-Series returns code and state. A site-owner-minted, stored state
        // binds the retailer prefix before OAuth, so request data cannot switch
        // which store receives the code. The callback needs no prefix field.
        if((grant.status==="authorized"||grant.status==="active")&&grant.codeHash===codeHash) {
          return json({ok:true,returnUrl:await callbackUrl(grant,state,deps)});
        }
        if(grant.status!=="pending")throw new AuthorityError("authorization_expired",410);
        const claimed=await deps.repository.compareAndSwap(grant,{status:"authorizing",codeHash,
          leaseId:crypto.randomUUID(),leaseExpiresAt:new Date(now+60_000).toISOString()});
        if(!claimed)throw new AuthorityError("sync_busy",409);
        try {
          const tokens=await exchangeLightspeedToken({prefix:grant.prefix,...credentials(deps),redirectUri:AUTHORITY_CALLBACK,
            grant:{kind:"authorization_code",code:body.code},fetcher:deps.fetcher,now});
          requireScopes(tokens);
          const retailerResponse=asSourceRecord(await lightspeedRequest(deps.fetcher??fetch,
            new URL("/api/2.0/retailer",lightspeedStoreOrigin(grant.prefix)),{method:"GET",headers:{
              Accept:"application/json",Authorization:`Bearer ${tokens.accessToken}`}}));
          const retailer=asSourceRecord(retailerResponse?.data);
          const retailerId=sourceId(retailer?.id);
          const currency=typeof retailer?.currency==="string"?retailer.currency.toUpperCase():"";
          if(!retailerId||!/^[A-Z]{3}$/.test(currency))throw new AuthorityError("retailer_configuration_required",409);
          const receipt=randomProofToken();
          const saved=await deps.repository.compareAndSwap(claimed,{status:"authorized",
            tokenCiphertext:await deps.encryption.encrypt(JSON.stringify(tokens)),tokenExpiresAt:tokens.expiresAt,
            retailerId,currency,receiptHash:await sha256(receipt),receiptCiphertext:await deps.encryption.encrypt(receipt),
            expiresAt:new Date(now+tokenTTL).toISOString(),leaseId:null,leaseExpiresAt:null});
          if(!saved)throw new AuthorityError("authorization_expired",410);
          return json({ok:true,returnUrl:await callbackUrl(saved,state,deps)});
        } catch(error){await invalidate(claimed,deps);throw error;}
      }
      if(!["finalize","read","disconnect","status"].includes(body.action))throw new AuthorityError("invalid_request");
      const grantId=safeId(body.grantId);
      let grant=await deps.repository.get(grantId);
      if(!grant)throw new AuthorityError("invalid_proof",403);
      const proof=await verifyBridgeRequest({headers:req.headers,publicKey:grant.publicKey,expectedGrantId:grant.id,body:bodyText,now});
      if(!proof)throw new AuthorityError("invalid_proof",403);
      if(!await deps.repository.consumeNonce(grant.id,proof.nonceHash,proof.validUntil))throw new AuthorityError("replayed_request",409);
      if(body.action==="disconnect") {
        if(grant.status!=="revoked") {
          const saved=await deps.repository.compareAndSwap(grant,{status:"revoked",tokenCiphertext:null,tokenExpiresAt:null,
            receiptCiphertext:null,receiptHash:null,leaseId:null,leaseExpiresAt:null});
          if(!saved)throw new AuthorityError("sync_busy",409);
        }
        // OAuth consent may remain listed in Lightspeed; no invented revoke endpoint.
        return json({ok:true,status:"revoked",removeProviderConsentInLightspeed:true});
      }
      if(body.action==="finalize") {
        assertFresh(grant,now);
        if(typeof body.receipt!=="string")throw new AuthorityError("invalid_request");
        decodeBase64Url(body.receipt,32);
        if(await sha256(body.receipt)!==grant.receiptHash)throw new AuthorityError("invalid_proof",403);
        if(grant.status==="authorized") {
          const saved=await deps.repository.compareAndSwap(grant,{status:"active"});
          if(!saved)throw new AuthorityError("sync_busy",409);grant=saved;
        }
        if(grant.status!=="active")throw new AuthorityError("grant_not_active",409);
        return json({ok:true,...identity(grant)});
      }
      if(body.action==="status")return json({ok:true,...identity(grant)});
      const resource=body.resource;
      if(typeof resource!=="string"||!["products","inventory","outlets","retailer"].includes(resource)) {
        throw new AuthorityError("invalid_request");
      }
      const cursor=versionCursor(body.cursor);
      grant=await refreshIfExpired(grant,deps,now);
      const tokens=await readTokens(grant,deps);
      const url=new URL(`/api/2.0/${resource}`,lightspeedStoreOrigin(grant.prefix));
      if(resource!=="retailer") {url.searchParams.set("page_size","200");if(cursor!==null)url.searchParams.set("after",cursor);}
      try {
        const payload=await lightspeedRequest(deps.fetcher??fetch,url,{method:"GET",headers:{
          Accept:"application/json",Authorization:`Bearer ${tokens.accessToken}`}});
        return json({ok:true,payload});
      } catch(error) {
        if(error instanceof LightspeedApiError&&error.code==="unauthorized")await invalidate(grant,deps);
        throw error;
      }
    } catch(error) {
      if(error instanceof AuthorityError)return json({ok:false,error:error.code},error.status,error.retryAfterMs);
      if(error instanceof LightspeedApiError)return json({ok:false,error:error.code},
        error.status??502,error.retryAfterMs);
      // No raw database/provider error, request body, state, code, or token is logged.
      return json({ok:false,error:"invalid_request"},400);
    }
  };
}
