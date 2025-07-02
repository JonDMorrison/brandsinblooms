import { SidebarLayout } from "@/components/SidebarLayout";
import { RetentionDashboard } from "@/components/retention/RetentionDashboard";

const SuccessPage = () => {
  return (
    <SidebarLayout>
      <div className="p-6">
        <RetentionDashboard />
      </div>
    </SidebarLayout>
  );
};

export default SuccessPage;