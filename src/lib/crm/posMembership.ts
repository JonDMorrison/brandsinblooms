import {supabase} from "@/integrations/supabase/client";
export interface MembershipPolicy {
  id: string; key_id: string; store_id: string; programme_id: string; programme_version_id: string;
  version: number; authority: "NATIVE" | "PROVIDER"; terms_version: string; terms: string;
  email_statement: string; sms_statement: string; enabled: boolean;
}
export interface MembershipRequest {
  id: string; policy_id: string; store_id: string; customer_id: string | null;
  state: "REVIEW_REQUIRED" | "PROVIDER_PENDING" | "CONFIRMED" | "REJECTED";
  source_event_id: string; purchase_result: "pending" | "linked" | "review_required";
  observed_at: string; email_result: string; sms_result: string; review_reason: string | null;
  identity_result: Record<string, unknown>;
  evidence: {firstName?: string; lastName?: string; email?: string; phone?: string; termsVersion?: string; membershipAgreed?: boolean; emailConsent?: boolean; smsConsent?: boolean};
}
export interface MembershipWorkspace {
  role: string;
  programmes: Array<{id: string; name: string; versionId: string}>;
  connections: Array<{keyId: string; posTenantId: string}>;
  policies: MembershipPolicy[]; requests: MembershipRequest[];
}
const rpcClient = supabase as unknown as {rpc(name: string, args?: Record<string, unknown>): PromiseLike<{data: unknown; error: {message: string} | null}>};
export async function loadMembershipWorkspace(tenantId: string): Promise<MembershipWorkspace> {
  const [{data: access, error: accessError}, {data, error}] = await Promise.all([rpcClient.rpc("get_current_crm_access"), rpcClient.rpc("pos_membership_workspace")]);
  if (accessError || !access || typeof access !== "object" || !("tenantId" in access) || access.tenantId !== tenantId) throw new Error("Refresh your session in the selected business to view POS membership.");
  if (error || !data || typeof data !== "object" || !("policies" in data) || !Array.isArray(data.policies)) throw new Error("POS membership requires a current owner or marketing staff session.");
  return data as MembershipWorkspace;
}
export function latestMembershipPolicies(policies: MembershipPolicy[]): MembershipPolicy[] {
  const latest = new Map<string, MembershipPolicy>();
  for (const policy of policies) {
    const key = `${policy.key_id}:${policy.store_id}`;
    if (!latest.has(key) || latest.get(key)!.version < policy.version) latest.set(key, policy);
  }
  return [...latest.values()];
}
export interface MembershipPolicyInput {
  keyId: string; storeId: string; programmeVersionId: string; expectedVersion: number | null;
  authority: "NATIVE" | "PROVIDER" | ""; termsVersion: string; terms: string; emailStatement: string; smsStatement: string; enabled: boolean;
}
export function validateMembershipPolicy(input: MembershipPolicyInput): string | null {
  if (!input.authority || !input.keyId || !input.programmeVersionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.storeId)) return "Select a connected POS, programme and valid POS store ID.";
  if (!input.termsVersion.trim() || input.termsVersion.trim().length > 120 || input.terms.trim().length < 20 || input.terms.trim().length > 12000) return "Enter the actual membership terms and their version.";
  if ([input.emailStatement, input.smsStatement].some(value => value.trim().length < 20 || value.trim().length > 2000)) return "Provide separate email and text marketing statements of 20–2000 characters.";
  return null;
}
export async function saveMembershipPolicy(input: MembershipPolicyInput): Promise<void> {
  const invalid = validateMembershipPolicy(input); if (invalid) throw new Error(invalid);
  const {error} = await rpcClient.rpc("save_pos_membership_policy", {p_key: input.keyId, p_store: input.storeId, p_programme_version: input.programmeVersionId, p_expected_version: input.expectedVersion, p_authority: input.authority, p_terms_version: input.termsVersion.trim(), p_terms: input.terms.trim(), p_email_statement: input.emailStatement.trim(), p_sms_statement: input.smsStatement.trim(), p_enabled: input.enabled});
  if (error) throw new Error(error.message);
}
export async function reviewMembershipRequest(tenantId: string, requestId: string, reject: boolean, reason: string): Promise<void> {
  const {data, error} = await supabase.functions.invoke("pos-membership-review", {body: {tenantId, requestId, reject, reason: reason.trim()}});
  if (error || !data?.reviewed) throw new Error(data?.error || "The request could not be reviewed. Refresh and check its identity evidence.");
}
