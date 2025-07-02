import { SidebarLayout } from "@/components/SidebarLayout";
import { AutomationRules } from "@/components/automation/AutomationRules";

const AutomationPage = () => {
  return (
    <SidebarLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <AutomationRules />
        </div>
      </div>
    </SidebarLayout>
  );
};

export default AutomationPage;