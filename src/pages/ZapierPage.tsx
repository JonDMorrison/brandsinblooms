import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { ZapierIntegration } from "@/components/integrations/ZapierIntegration";

const ZapierPage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <ZapierIntegration />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default ZapierPage;