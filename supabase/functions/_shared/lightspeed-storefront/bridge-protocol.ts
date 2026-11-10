/**
 * Versioned proof-of-possession contract between BloomSites and the existing
 * BloomSuite Lightspeed authority. No Lightspeed credential crosses the bridge.
 * This file uses Web Crypto only and is shared with the Deno authority.
 */
export const LIGHTSPEED_BRIDGE_VERSION = "bloomsites-lightspeed-v1";
export const BLOOMSITES_ORIGIN = "https://bloomsites.app";
export const LIGHTSPEED_BRIDGE_ENDPOINT =
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/lightspeed-storefront-bridge";
export const LIGHTSPEED_SITE_CALLBACK_PATH = "/api/integrations/lightspeed/callback";
export const LIGHTSPEED_SITE_CONTEXT_PATH = "/api/integrations/lightspeed/context";
export const LIGHTSPEED_STATE_PATTERN = /^bs_[A-Za-z0-9_-]{43}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

export function encodeBase64Url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

export function decodeBase64Url(value: string, expectedBytes: number): Uint8Array {
  if (!BASE64URL.test(value) || value.length > expectedBytes * 2) throw new Error("Invalid proof encoding");
  const raw = atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length / 4) * 4,"="));
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  if (bytes.byteLength !== expectedBytes || encodeBase64Url(bytes) !== value) throw new Error("Invalid proof encoding");
  return bytes;
}

export async function sha256(value: string): Promise<string> {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export function randomProofToken(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function publicSigningKey(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid public signing key");
  const key = value as JsonWebKey;
  if (key.kty !== "EC" || key.crv !== "P-256" || key.d != null || !key.x || !key.y) {
    throw new Error("Invalid public signing key");
  }
  decodeBase64Url(key.x,32); decodeBase64Url(key.y,32);
  return {kty:"EC", crv:"P-256", x:key.x, y:key.y, ext:true, key_ops:["verify"]};
}

export async function createSigningKeyPair(): Promise<{publicKey:JsonWebKey;privateKey:JsonWebKey}> {
  const pair = await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  return {publicKey:publicSigningKey(await crypto.subtle.exportKey("jwk",pair.publicKey)),
    privateKey:await crypto.subtle.exportKey("jwk",pair.privateKey)};
}

function signingMessage(grantId:string,timestamp:string,nonce:string,bodyHash:string): Uint8Array {
  return encoder.encode([LIGHTSPEED_BRIDGE_VERSION,"POST",grantId,timestamp,nonce,bodyHash].join("\n"));
}

export async function signBridgeRequest(input: {
  grantId:string; privateKey:JsonWebKey; body:string; now?:number; nonce?:string;
}): Promise<Record<string,string>> {
  if (!UUID.test(input.grantId)) throw new Error("Invalid grant identity");
  const timestamp = String(Math.floor((input.now ?? Date.now()) / 1000));
  const nonce = input.nonce ?? randomProofToken();
  decodeBase64Url(nonce,32);
  const key = await crypto.subtle.importKey("jwk",input.privateKey,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const signature = await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,
    new Uint8Array(signingMessage(input.grantId,timestamp,nonce,await sha256(input.body))).buffer);
  return {"Content-Type":"application/json","X-Lightspeed-Grant":input.grantId,
    "X-Lightspeed-Time":timestamp,"X-Lightspeed-Nonce":nonce,
    "X-Lightspeed-Proof":encodeBase64Url(new Uint8Array(signature))};
}

/** Caller must atomically consume the returned nonce before executing the action. */
export async function verifyBridgeRequest(input: {
  headers:Headers; publicKey:unknown; expectedGrantId:string; body:string; now?:number;
}): Promise<{nonceHash:string;validUntil:string}|null> {
  try {
    const grantId=input.headers.get("X-Lightspeed-Grant");
    const timestamp=input.headers.get("X-Lightspeed-Time") ?? "";
    const nonce=input.headers.get("X-Lightspeed-Nonce") ?? "";
    const proof=input.headers.get("X-Lightspeed-Proof") ?? "";
    const now=input.now ?? Date.now();
    if (grantId !== input.expectedGrantId || !UUID.test(grantId) || !/^\d{10,11}$/.test(timestamp) ||
        !Number.isFinite(now) || Math.abs(now-Number(timestamp)*1000)>60_000) return null;
    decodeBase64Url(nonce,32);
    const signature=decodeBase64Url(proof,64);
    const key=await crypto.subtle.importKey("jwk",publicSigningKey(input.publicKey),
      {name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,new Uint8Array(signature).buffer,
      new Uint8Array(signingMessage(grantId,timestamp,nonce,await sha256(input.body))).buffer);
    return valid ? {nonceHash:await sha256(nonce),validUntil:new Date(now+5*60_000).toISOString()} : null;
  } catch { return null; }
}

export function isStorefrontLightspeedState(value:unknown): value is string {
  return typeof value === "string" && LIGHTSPEED_STATE_PATTERN.test(value);
}

export function validatedSiteCallback(value:unknown): string {
  if (typeof value !== "string") throw new Error("Invalid callback destination");
  const url = new URL(value);
  if (url.origin !== BLOOMSITES_ORIGIN || url.pathname !== LIGHTSPEED_SITE_CALLBACK_PATH ||
      url.username || url.password || url.hash || [...url.searchParams.keys()].some(k=>!["state","receipt","grant"].includes(k)) ||
      ["state","receipt","grant"].some(k=>url.searchParams.getAll(k).length !== 1) ||
      !isStorefrontLightspeedState(url.searchParams.get("state")) || !UUID.test(url.searchParams.get("grant") ?? "")) {
    throw new Error("Invalid callback destination");
  }
  decodeBase64Url(url.searchParams.get("receipt") ?? "",32);
  return url.toString();
}
