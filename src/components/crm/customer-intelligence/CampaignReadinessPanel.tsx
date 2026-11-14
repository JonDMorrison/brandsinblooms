import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Sheet, Stack, Typography } from "@mui/joy";
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
    <Sheet variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: "lg" }}>
      <Stack spacing={1.5}>
        <Typography level="title-lg">Newsletter audience readiness</Typography>
        <Typography level="body-sm" color="neutral">
          Check contact details and recorded permission before planning a send.
          An email on file does not mean the customer agreed to newsletters.
        </Typography>
        {(health.isLoading || population.isLoading) && <Typography level="body-sm">Checking customer information…</Typography>}
        {(health.isError || population.isError || mismatch) && (
          <Alert color="neutral" role="alert">
            {mismatch || "Readiness could not be verified. No audience size is assumed."}
          </Alert>
        )}
        {data && (
          <>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1 }}>
              {([
                ["Active customers", data.activeCustomers],
                ["Email on file", data.withEmailToReview],
                ["Needs contact review", data.needsEmailReview],
                ["Recorded send permission", data.verifiedOptIn],
              ] as const).map(([label, count]) => (
                <Sheet key={label} variant="soft" color="neutral" sx={{ p: 1.25, borderRadius: "md" }}>
                  <Typography level="h4" sx={{ fontVariantNumeric: "tabular-nums" }}>{format(count)}</Typography>
                  <Typography level="body-xs">{label}</Typography>
                </Sheet>
              ))}
            </Box>
            <Typography level="body-sm" color="neutral">
              {format(data.needsConsentReview)} customers with an email need consent or suppression review
              before they can be counted as ready to receive newsletters.
            </Typography>
          </>
        )}
        <Alert color="neutral" variant="soft">
          Counts are a planning guide, not a send approval. Placeholder emails are excluded.
          The campaign's final checks also review delivery suppressions, verified consent and sending-domain readiness.
          Importing VIP or newsletter tags never grants marketing permission.
        </Alert>
        <Button variant="outlined" color="neutral" sx={{ alignSelf: "flex-start" }}
          onClick={() => { void health.refetch(); void population.refetch(); }}>
          Refresh readiness
        </Button>
      </Stack>
    </Sheet>
  );
}
