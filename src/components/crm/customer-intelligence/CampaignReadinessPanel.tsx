import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Typography } from "@mui/joy";
import { Mail, MailCheck, RefreshCw, UserSearch, Users } from "lucide-react";
import { IntelligenceCard, IntelligenceStatRow } from "./IntelligenceLayout";
import { useTenantAudienceHealth } from "@/hooks/useTenantAudienceHealth";
import { supabase } from "@/integrations/supabase/client";
import { summarizeCampaignReadiness } from "@/lib/customer-intelligence/campaignReadinessSummary";

/** Read-only audience health; no imports, sends, or customer changes. */
export function CampaignReadinessPanel({ tenantId }: { tenantId: string }) {
  const health = useTenantAudienceHealth(tenantId);
  const population = useQuery({
    queryKey: ["campaign-readiness-active-customer-count", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 60000,
    queryFn: async () => {
      const { count, error } = await supabase.from("crm_customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .is("merged_into_customer_id", null);
      if (error || count == null) throw error ?? Error("Active customer count is unavailable.");
      return count;
    },
  });

  let data: ReturnType<typeof summarizeCampaignReadiness> | null = null;
  let mismatch = "";
  if (health.isSuccess && population.isSuccess) {
    try { data = summarizeCampaignReadiness(population.data, health.data); }
    catch (error) { mismatch = error instanceof Error ? error.message : "Readiness needs reconciliation."; }
  }
  const format = (value: number) => value.toLocaleString();
  return (
    <IntelligenceCard
      icon={<Mail />}
      title="Newsletter audience readiness"
      description="Check contact details and recorded permission before planning a send. An email on file does not mean the customer agreed to newsletters."
      headerActions={
        <Button size="sm" variant="outlined" color="neutral" startDecorator={<RefreshCw size={14} />}
          onClick={() => { void health.refetch(); void population.refetch(); }}>
          Refresh readiness
        </Button>
      }
      notes="Counts are a planning guide, not a send approval. Placeholder emails are excluded. The campaign's final checks also review delivery suppressions, verified consent and sending-domain readiness. Importing VIP or newsletter tags never grants marketing permission."
    >
        {(health.isLoading || population.isLoading) && <Typography level="body-sm">Checking customer information…</Typography>}
        {(health.isError || population.isError || mismatch) && (
          <Alert color="neutral" role="alert">
            {mismatch || "Readiness could not be verified. No audience size is assumed."}
          </Alert>
        )}
        {data && (
          <>
            <IntelligenceStatRow items={([

                ["Active customers", data.activeCustomers],
                ["Email on file", data.withEmailToReview],
                ["Needs contact review", data.needsEmailReview],
                ["Recorded send permission", data.verifiedOptIn],
              ] as const).map(([label, count], i) => ({ label, value: format(count), icon: [<Users key="a" />, <Mail key="b" />, <UserSearch key="c" />, <MailCheck key="d" />][i] }))} />
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              {format(data.needsConsentReview)} customers with an email need consent or suppression review
              before they can be counted as ready to receive newsletters.
            </Typography>
          </>
        )}
    </IntelligenceCard>
  );
}
