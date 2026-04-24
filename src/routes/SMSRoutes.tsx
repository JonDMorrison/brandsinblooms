import { Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui-legacy/loading-spinner";
import { lazyRetry } from "@/utils/lazyRetry";

// Lazy load SMS components
const SMSDashboard = lazyRetry(() => import("@/pages/sms/SMSDashboard"));
const SMSCampaignWizard = lazyRetry(
  () => import("@/pages/sms/SMSCampaignWizard"),
);
const SMSCampaignDetail = lazyRetry(
  () => import("@/pages/sms/SMSCampaignDetail"),
);
const SMSMessagesPage = lazyRetry(() => import("@/pages/sms/SMSMessagesPage"));
const SMSAutomationDashboard = lazyRetry(
  () => import("@/pages/sms/SMSAutomationDashboard"),
);
const SMSAutomationWizard = lazyRetry(
  () => import("@/pages/sms/SMSAutomationWizard"),
);

export default function SMSRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route index element={<SMSDashboard />} />
        <Route path="new" element={<SMSCampaignWizard />} />
        <Route path=":id" element={<SMSCampaignDetail />} />
        <Route path="messages" element={<SMSMessagesPage />} />
        <Route path="automations" element={<SMSAutomationDashboard />} />
        <Route path="automations/new" element={<SMSAutomationWizard />} />
        <Route path="automations/:id" element={<SMSAutomationWizard />} />
      </Routes>
    </Suspense>
  );
}
