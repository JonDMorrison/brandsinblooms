import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { IntegrationHub } from "@/components/integrations/IntegrationHub";

const IntegrationsPage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gray-50">
        <IntegrationHub />
      </div>
    </ProtectedPageWrapper>
  );
};

export default IntegrationsPage;