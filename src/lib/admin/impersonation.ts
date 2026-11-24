import { supabase } from "@/integrations/supabase/client";
import { IMPERSONATION_CALLBACK_PATH } from "@/integrations/supabase/tabAuthSession";

interface ImpersonateUserResponse {
  success?: boolean;
  token_hash?: string;
  type?: string;
  target_email?: string;
  error?: string;
}

export interface ImpersonationRequest {
  targetEmail: string;
  targetTenantId: string | null;
  origin: string;
}

/**
 * Asks admin-impersonate-user (which verifies the caller is a master admin and
 * writes the audit log) for a one-time link, and returns the callback URL that
 * redeems it. The callback tab keeps the resulting customer session to itself.
 */
export async function requestImpersonationCallbackUrl({
  targetEmail,
  targetTenantId,
  origin,
}: ImpersonationRequest): Promise<string> {
  const { data, error } = await supabase.functions.invoke<ImpersonateUserResponse>(
    "admin-impersonate-user",
    {
      body: {
        target_user_email: targetEmail,
        target_tenant_id: targetTenantId,
        redirect_origin: origin,
      },
    },
  );

  if (
    error ||
    data?.error ||
    !data?.success ||
    !data?.token_hash ||
    !data?.type ||
    !data?.target_email
  ) {
    throw new Error(data?.error || error?.message || "Impersonation failed");
  }

  const callbackParams = new URLSearchParams({
    token_hash: data.token_hash,
    type: data.type,
    target_email: data.target_email,
  });
  if (targetTenantId) {
    callbackParams.set("target_tenant_id", targetTenantId);
  }

  return `${origin}${IMPERSONATION_CALLBACK_PATH}?${callbackParams.toString()}`;
}
