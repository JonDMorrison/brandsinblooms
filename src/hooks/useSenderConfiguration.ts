import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

export interface SenderConfig {
  isVerified: boolean;
  senderEmail: string;
  displayName: string;
  deliveryMethod: "custom";
  companyName?: string;
  domain?: string;
  fromEmailDomainId?: string | null;
  domainStatus?: string;
  replyToEmail?: string;
}

export const useSenderConfiguration = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [senderConfig, setSenderConfig] = useState<SenderConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSenderConfiguration = useCallback(async () => {
    if (!user?.id || !tenant?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch company_profiles.company_name - this is the source of truth for display name
      const { data: companyProfile, error: companyError } = await supabase
        .from("company_profiles")
        .select(
          "company_name, custom_sender_email, email_auth_status, email_domain, dns_records_verified",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (companyError) {
        console.error("Error fetching company profile:", companyError);
      }

      // The display name comes from company_profiles.company_name
      const displayName =
        companyProfile?.company_name || tenant.name || "Your Business";

      // Fetch tenant-level default sending domain (if configured)
      const { data: tenantRow, error: tenantRowError } = await supabase
        .from("tenants")
        .select("default_from_email_domain_id")
        .eq("id", tenant.id)
        .maybeSingle();

      if (tenantRowError) {
      }

      const defaultFromEmailDomainId = (tenantRow as any)
        ?.default_from_email_domain_id as string | null | undefined;

      // Check for active/verified custom domain in email_domains table
      // Include 'warming_up' status as it's also usable for sending
      const { data: activeDomains, error: domainsError } = await supabase
        .from("email_domains")
        .select(
          "id, domain, status, default_from_email, default_from_name, default_reply_to",
        )
        .eq("tenant_id", tenant.id)
        .in("status", ["active", "warming_up"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (domainsError) {
        console.error("Error fetching email domains:", domainsError);
      }

      const hasActiveDomain = activeDomains && activeDomains.length > 0;
      const activeDomain = (() => {
        if (!hasActiveDomain) return null;
        if (defaultFromEmailDomainId) {
          const match = activeDomains.find(
            (d: any) => d?.id === defaultFromEmailDomainId,
          );
          if (match) return match;
        }
        return activeDomains[0];
      })();

      // If we have an active custom domain, use it
      if (activeDomain) {
        const domainEmail =
          activeDomain.default_from_email || `mail@${activeDomain.domain}`;
        const fromName = activeDomain.default_from_name || displayName;
        const replyToEmail = activeDomain.default_reply_to || domainEmail;

        setSenderConfig({
          isVerified: true,
          senderEmail: domainEmail,
          displayName: fromName,
          deliveryMethod: "custom",
          companyName: displayName,
          domain: activeDomain.domain,
          fromEmailDomainId: activeDomain.id,
          domainStatus: activeDomain.status,
          replyToEmail,
        });
        setLoading(false);
        return;
      }

      // Track latest domain status (so UI can show pending verification)
      const { data: latestDomains, error: latestDomainError } = await supabase
        .from("email_domains")
        .select("domain, status")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (latestDomainError) {
        console.error("Error fetching latest email domain:", latestDomainError);
      }

      const latestDomain =
        latestDomains && latestDomains.length > 0 ? latestDomains[0] : null;

      // Check legacy company_profiles verification
      const hasLegacyVerification =
        companyProfile?.email_auth_status === "verified" &&
        companyProfile?.custom_sender_email;

      if (hasLegacyVerification) {
        setSenderConfig({
          isVerified: true,
          senderEmail: companyProfile.custom_sender_email!,
          displayName: displayName,
          deliveryMethod: "custom",
          companyName: displayName,
          domain: companyProfile.email_domain,
          fromEmailDomainId: null,
          domainStatus: "active",
          replyToEmail: companyProfile.custom_sender_email!,
        });
        setLoading(false);
        return;
      }

      // No operational sender configured
      setSenderConfig({
        isVerified: false,
        senderEmail: "",
        displayName: displayName,
        deliveryMethod: "custom",
        companyName: displayName,
        domain: latestDomain?.domain,
        fromEmailDomainId: null,
        domainStatus: latestDomain?.status,
        replyToEmail: "",
      });
    } catch (error) {
      console.error("Error in fetchSenderConfiguration:", error);
      setSenderConfig({
        isVerified: false,
        senderEmail: "",
        displayName: "Your Business",
        deliveryMethod: "custom",
        fromEmailDomainId: null,
        replyToEmail: "",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, tenant?.id, tenant?.name]);

  useEffect(() => {
    fetchSenderConfiguration();
  }, [fetchSenderConfiguration]);

  // Auto-refresh when domains/tenant sender settings change (so campaigns switch to custom domain automatically)
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`sender-config-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_domains",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          fetchSenderConfiguration();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tenants",
          filter: `id=eq.${tenant.id}`,
        },
        () => {
          fetchSenderConfiguration();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, fetchSenderConfiguration]);

  return {
    senderConfig,
    loading,
    refetch: fetchSenderConfiguration,
  };
};
