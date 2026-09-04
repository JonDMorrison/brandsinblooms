import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903142617_atomic_channel_consent_management.sql",
  "utf8",
);
const authorizationMigration = readFileSync(
  "supabase/migrations/20260903235000_authorize_staff_consent_changes.sql",
  "utf8",
);
const contactCard = readFileSync(
  "src/components/crm/customer-dashboard/CustomerContactCard.tsx",
  "utf8",
);
const editDialog = readFileSync(
  "src/components/crm/customer-dashboard/EditCustomerDialog.tsx",
  "utf8",
);
const consentCard = readFileSync(
  "src/components/crm/customer-dashboard/CustomerConsentCard.tsx",
  "utf8",
);
const updateHook = readFileSync("src/hooks/useUpdateCustomer.ts", "utf8");
const consentHook = readFileSync(
  "src/hooks/useCustomerMarketingConsent.ts",
  "utf8",
);
const sendCampaign = readFileSync(
  "supabase/functions/send-sms-campaign/index.ts",
  "utf8",
);
const enqueueWorker = readFileSync(
  "supabase/functions/sms-campaign-enqueue-worker/index.ts",
  "utf8",
);
const retryWorker = readFileSync(
  "supabase/functions/sms-retry-failed/index.ts",
  "utf8",
);

describe("atomic channel consent release gate", () => {
  it("records customer, canonical consent, suppression, and history in one transaction", () => {
    expect(migration).toContain("FUNCTION public.set_customer_marketing_consent");
    expect(migration).toContain("FOR UPDATE OF customer");
    expect(migration).toContain("UPDATE public.crm_customers");
    expect(migration).toContain("INSERT INTO public.customer_consents");
    expect(migration).toContain("INSERT INTO public.crm_email_consent_events");
    expect(migration).toContain("INSERT INTO public.crm_sms_consent_events");
    expect(migration).toContain("INSERT INTO public.suppression_list");
    expect(migration).toContain("actor_user_id");
    expect(migration).toContain("consent_basis");
    expect(migration).toContain("evidence");
  });

  it("requires a lawful basis and meaningful evidence before staff opt-in", () => {
    expect(migration).toContain("p_opt_in AND v_basis NOT IN ('express', 'implied')");
    expect(migration).toContain("p_opt_in AND length(v_evidence) < 10");
    expect(migration).toContain("IF p_opt_in IS NULL");
    expect(migration).toContain("v_channel text := lower(trim(coalesce(p_channel, '')))");
    expect(consentCard).toContain("At least 10 characters are required.");
    expect(consentCard).toContain("Express consent");
    expect(consentCard).toContain("Implied consent");
  });

  it("prevents generic profile forms from silently changing consent", () => {
    expect(contactCard).not.toContain("email_opt_in");
    expect(contactCard).not.toContain("sms_opt_in");
    expect(editDialog).not.toContain("email_opt_in");
    expect(editDialog).not.toContain("sms_opt_in");
    expect(updateHook).not.toContain("email_opt_in?:");
    expect(updateHook).not.toContain("sms_opt_in?:");
    expect(consentHook).toContain(
      '"set_customer_marketing_consent_authorized"',
    );
  });

  it("keeps email opt-out state out of SMS audience decisions", () => {
    expect(migration).toContain("email opt-out state is intentionally ignored");
    expect(migration).not.toContain("coalesce(v_customer.opt_out, false)");
    expect(sendCampaign).not.toContain(".eq('opt_out', false)");
    expect(sendCampaign).not.toContain(".eq('crm_customers.opt_out', false)");
    expect(enqueueWorker).not.toContain(".eq('opt_out', false)");
    expect(enqueueWorker).not.toContain(".eq('crm_customers.opt_out', false)");
    expect(retryWorker).not.toContain("customer.opt_out");
  });

  it("cancels queued SMS immediately on opt-out and preserves other suppressions", () => {
    expect(migration).toContain("error_code = 'SMS_OPTED_OUT'");
    expect(migration).toContain("AND status = 'queued'");
    expect(migration).toContain("suppression_type = 'unsubscribed'");
    expect(migration).not.toContain("suppression_type IN");
  });

  it("uses tenant authorization and fixed function search paths", () => {
    expect(migration).toContain("app_user.id = v_actor_id");
    expect(migration).toContain("app_user.tenant_id = customer.tenant_id");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("enforces role and assigned-location access before invoking the writer", () => {
    expect(authorizationMigration).toContain("public.get_current_crm_access()");
    expect(authorizationMigration).toContain(
      "v_role NOT IN ('owner_admin', 'marketing', 'store_manager')",
    );
    expect(authorizationMigration).toContain(
      "public.customer_location_activity",
    );
    expect(authorizationMigration).toContain(
      "FROM PUBLIC, anon, authenticated",
    );
    expect(authorizationMigration).toContain(
      "set_customer_marketing_consent_authorized",
    );
  });
});
