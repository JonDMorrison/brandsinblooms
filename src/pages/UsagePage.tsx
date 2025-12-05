import { UsageDashboard } from "@/components/subscription/UsageDashboard";
import { UsageWarningBanner } from "@/components/subscription/UsageWarningBanner";

const UsagePage = () => {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <UsageWarningBanner dismissible={false} />
      <UsageDashboard />
    </div>
  );
};

export default UsagePage;
