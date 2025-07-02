import { SidebarLayout } from "@/components/SidebarLayout";
import { IntegrationHub } from "@/components/integrations/IntegrationHub";

const IntegrationsPage = () => {
  return (
    <SidebarLayout>
      <div className="py-6">
        <IntegrationHub />
      </div>
    </SidebarLayout>
  );
};

export default IntegrationsPage;