import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type EmailDomainRow = Database["public"]["Tables"]["email_domains"]["Row"];

/** Domain statuses the send path accepts (see useSenderConfiguration). */
const SENDABLE_DOMAIN_STATUSES = ["active", "warming_up"] as const;

export type SenderDomain = Pick<
  EmailDomainRow,
  | "id"
  | "domain"
  | "status"
  | "default_from_email"
  | "default_from_name"
  | "default_reply_to"
  | "created_at"
>;

export interface DraftSenderDefaults {
  senderName: string;
  senderEmail: string;
  replyTo: string;
  fromEmailDomainId: string | null;
  /** Which rule produced the sender, for tests and diagnostics. */
  source: "tenant_default" | "company_profile" | "verified_domain" | "none";
}

export interface DraftSenderInputs {
  /** tenants.default_from_email_domain_id */
  tenantDefaultDomainId: string | null;
  /** The tenant's email_domains rows (any status). */
  domains: SenderDomain[];
  companyName: string | null;
  companyEmail: string | null;
  tenantName: string | null;
}

const EMPTY_SENDER: DraftSenderDefaults = {
  senderName: "",
  senderEmail: "",
  replyTo: "",
  fromEmailDomainId: null,
  source: "none",
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

function isSendable(domain: SenderDomain) {
  return (SENDABLE_DOMAIN_STATUSES as readonly string[]).includes(domain.status);
}

/**
 * Sender a brand-new draft starts with, in this order:
 *   1. the tenant's default sender: a verified domain with a configured From
 *      address (tenants.default_from_email_domain_id first);
 *   2. company_profiles.company_name + company_email, when that email's domain
 *      is a verified email_domains row for the tenant;
 *   3. the newest verified domain's mail@ address (what Review & Send already
 *      offers through useSenderConfiguration);
 *   otherwise nothing: the sender stays empty and Review & Send asks for it.
 */
export function resolveDraftSenderDefaults(
  inputs: DraftSenderInputs,
): DraftSenderDefaults {
  const sendable = inputs.domains
    .filter(isSendable)
    .sort((a, b) => clean(b.created_at).localeCompare(clean(a.created_at)));
  if (sendable.length === 0) return EMPTY_SENDER;

  const fallbackName = clean(inputs.companyName) || clean(inputs.tenantName);

  const configured = [
    ...sendable.filter((d) => d.id === inputs.tenantDefaultDomainId),
    ...sendable.filter((d) => d.id !== inputs.tenantDefaultDomainId),
  ].find((d) => clean(d.default_from_email) !== "");
  if (configured) {
    const email = clean(configured.default_from_email);
    return {
      senderName: clean(configured.default_from_name) || fallbackName,
      senderEmail: email,
      replyTo: clean(configured.default_reply_to) || email,
      fromEmailDomainId: configured.id,
      source: "tenant_default",
    };
  }

  const companyEmail = clean(inputs.companyEmail);
  const companyDomain = emailDomain(companyEmail);
  const companyMatch = companyDomain
    ? sendable.find((d) => d.domain.toLowerCase() === companyDomain)
    : undefined;
  if (companyMatch && clean(inputs.companyName)) {
    return {
      senderName: clean(companyMatch.default_from_name) || clean(inputs.companyName),
      senderEmail: companyEmail,
      replyTo: clean(companyMatch.default_reply_to) || companyEmail,
      fromEmailDomainId: companyMatch.id,
      source: "company_profile",
    };
  }

  const preferred =
    sendable.find((d) => d.id === inputs.tenantDefaultDomainId) ?? sendable[0];
  const email = `mail@${preferred.domain}`;
  return {
    senderName: clean(preferred.default_from_name) || fallbackName,
    senderEmail: email,
    replyTo: clean(preferred.default_reply_to) || email,
    fromEmailDomainId: preferred.id,
    source: "verified_domain",
  };
}

/** Loads the inputs for {@link resolveDraftSenderDefaults} for one tenant. */
export async function loadDraftSenderDefaults(params: {
  tenantId: string;
  userId: string;
}): Promise<DraftSenderDefaults> {
  const [tenantResult, domainsResult, profileResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, default_from_email_domain_id")
      .eq("id", params.tenantId)
      .maybeSingle(),
    supabase
      .from("email_domains")
      .select(
        "id, domain, status, default_from_email, default_from_name, default_reply_to, created_at",
      )
      .eq("tenant_id", params.tenantId),
    supabase
      .from("company_profiles")
      .select("company_name, company_email")
      .eq("user_id", params.userId)
      .maybeSingle(),
  ]);

  if (domainsResult.error) {
    console.warn("Sender defaults: email domains could not be loaded", domainsResult.error);
    return EMPTY_SENDER;
  }

  return resolveDraftSenderDefaults({
    tenantDefaultDomainId: tenantResult.data?.default_from_email_domain_id ?? null,
    domains: domainsResult.data ?? [],
    companyName: profileResult.data?.company_name ?? null,
    companyEmail: profileResult.data?.company_email ?? null,
    tenantName: tenantResult.data?.name ?? null,
  });
}
