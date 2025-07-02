import { SidebarLayout } from "@/components/SidebarLayout";
import { ZapierIntegration } from "@/components/integrations/ZapierIntegration";

const ZapierPage = () => {
  return (
    <SidebarLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <ZapierIntegration />
        </div>
      </div>
    </SidebarLayout>
  );
};

export default ZapierPage;