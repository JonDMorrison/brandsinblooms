import Stack from "@mui/joy/Stack";
import { CustomerIntelligenceSetupWizard } from "@/components/integrations/CustomerIntelligenceSetupWizard";
import { IntegrationCategoryLanding } from "@/components/integrations/IntegrationCategoryLanding";
import { PageContainer } from "@/components/joy/PageContainer";

export default function POSIntegrationsPage() {
  return (
    <PageContainer sx={{ py: { xs: 2, md: 3 } }}>
      <Stack spacing={4}>
        <CustomerIntelligenceSetupWizard />
        <IntegrationCategoryLanding
          category="pos-systems"
          title="Point of sale"
          description="Browse POS providers that sync customer, order, and revenue activity back into BloomSuite."
        />
      </Stack>
    </PageContainer>
  );
}
