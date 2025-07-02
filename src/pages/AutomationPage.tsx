import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { AutomationRules } from "@/components/automation/AutomationRules";

const AutomationPage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <AutomationRules />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default AutomationPage;