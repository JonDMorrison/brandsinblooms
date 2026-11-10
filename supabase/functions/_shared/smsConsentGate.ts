import { createClient } from "npm:@supabase/supabase-js@2";

export type SmsEligibility = {
  allowed: boolean;
  code: string;
  reason: string;
};

type SmsEligibilityArgs = {
  tenantId: string | null | undefined;
  customerId: string | null | undefined;
  recipient: string;
};

const FAILED_CHECK: SmsEligibility = {
  allowed: false,
  code: "SMS_CONSENT_CHECK_FAILED",
  reason: "SMS consent could not be verified",
};

/**
 * Resolve SMS eligibility in the database immediately before provider send.
 * Errors fail closed: a delivery worker must never guess about consent.
 */
export async function checkSmsSendEligibility(
  supabase: ReturnType<typeof createClient>,
  args: SmsEligibilityArgs,
): Promise<SmsEligibility> {
  if (!args.tenantId || !args.customerId || !args.recipient) {
    return {
      allowed: false,
      code: "SMS_RECIPIENT_UNRESOLVED",
      reason: "SMS requires a tenant-scoped customer and recipient",
    };
  }

  const { data, error } = await supabase.rpc("check_sms_send_eligibility", {
    p_tenant_id: args.tenantId,
    p_customer_id: args.customerId,
    p_recipient: args.recipient,
  });

  if (error) {
    console.error("[sms-consent] Eligibility RPC failed:", error.message);
    return FAILED_CHECK;
  }

  if (
    !data ||
    typeof data !== "object" ||
    typeof data.allowed !== "boolean" ||
    typeof data.code !== "string" ||
    typeof data.reason !== "string"
  ) {
    console.error("[sms-consent] Eligibility RPC returned an invalid result");
    return FAILED_CHECK;
  }

  return {
    allowed: data.allowed,
    code: data.code,
    reason: data.reason,
  };
}

