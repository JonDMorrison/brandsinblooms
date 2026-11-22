export interface NativeRewardBalance {
  mappingId: string; programmeId: string; programmeVersionId: string; programName: string;
  authority: "bloom_pos"; unit: "currency"; currency: string;
  status: "available" | "unavailable"; availableMinor: number | null; balanceMinor: number | null;
  observedAt: string | null; reason: string | null;
}
interface ReadContext {
  mappingId: string; programmeId: string; programmeVersionId: string; programName: string;
  currency: string; keyId: string; secret: string; posTenantId: string; crmTenantId: string;
  customerId: string; activationId: string; eligible: boolean;
}
export interface NativeBalanceClient {rpc(name: string,args: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}>}
export const NATIVE_BALANCE_URL = "https://aimphmbjuawmxyvkwipf.supabase.co/functions/v1/connected-native-reward-balance";
const purpose = "bloom-pos-native-reward-read:v1";
export async function nativeRewardSignature(secret: string, timestamp: string, body: string): Promise<string> {
  if (secret.length < 32) throw new Error("Signing key unavailable");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(purpose + "\n" + timestamp + "\n" + body)))).map(value => value.toString(16).padStart(2, "0")).join("");
}
function unavailable(context: ReadContext, reason: string): NativeRewardBalance {
  return {mappingId: context.mappingId, programmeId: context.programmeId, programmeVersionId: context.programmeVersionId, programName: context.programName,
    authority: "bloom_pos", unit: "currency", currency: context.currency, status: "unavailable", availableMinor: null, balanceMinor: null, observedAt: null, reason};
}
export async function readNativeRewardBalances(db: NativeBalanceClient, tenantId: string, customerId: string, fetcher: typeof fetch = fetch): Promise<NativeRewardBalance[]> {
  const {data, error} = await db.rpc("native_reward_read_context", {p_tenant: tenantId, p_customer: customerId});
  if (error || !Array.isArray(data) || data.length > 20) throw new Error("Native balances could not be checked");
  return await Promise.all(data.map(async (raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid balance context");
    const context = raw as ReadContext;
    if ([context.mappingId, context.programmeId, context.programmeVersionId, context.programName, context.keyId, context.secret, context.posTenantId, context.activationId].some(value => typeof value !== "string" || !value) || context.crmTenantId !== tenantId || context.customerId !== customerId || !["CAD", "USD"].includes(context.currency)) throw new Error("Invalid balance scope");
    if (context.eligible !== true) return unavailable(context, "membership_or_programme_requires_review");
    try {
      const body = JSON.stringify({purpose, posTenantId: context.posTenantId, crmTenantId: tenantId, customerId, activationId: context.activationId, currency: context.currency});
      const timestamp = String(Math.floor(Date.now() / 1000));
      const response = await fetcher(NATIVE_BALANCE_URL, {method: "POST", redirect: "error", signal: AbortSignal.timeout(7000), headers: {"Content-Type": "application/json", "x-bloom-key-id": context.keyId, "x-bloom-timestamp": timestamp, "x-bloom-signature": await nativeRewardSignature(context.secret, timestamp, body)}, body});
      if (!response.ok) return unavailable(context, "connection_unavailable");
      const payload = await response.json();
      if (payload?.status === "unavailable") return unavailable(context, ["customer_not_linked", "activation_or_currency_unavailable", "membership_not_enrolled"].includes(payload.reason) ? payload.reason : "balance_unavailable");
      if (payload?.status !== "available" || payload.authority !== "bloom_pos" || payload.unit !== "currency" || payload.activationId !== context.activationId || payload.currency !== context.currency || !Number.isSafeInteger(payload.availableMinor) || payload.availableMinor < 0 || !Number.isSafeInteger(payload.balanceMinor) || payload.availableMinor !== Math.max(payload.balanceMinor, 0) || typeof payload.observedAt !== "string" || !Number.isFinite(Date.parse(payload.observedAt)) || Math.abs(Date.now() - Date.parse(payload.observedAt)) > 300000) return unavailable(context, "invalid_balance_response");
      return {...unavailable(context, ""), status: "available" as const, availableMinor: payload.availableMinor, balanceMinor: payload.balanceMinor, observedAt: payload.observedAt, reason: null};
    } catch {return unavailable(context, "connection_unavailable");}
  }));
}
