import React from "react";
import { EmailDomainManagement } from "@/components/crm/settings/EmailDomainManagement";
import { TenantEmailHealthDashboardCard } from "@/components/crm/settings/TenantEmailHealthDashboardCard";
import { DomainHealthBanner } from "@/components/crm/email/DomainHealthBanner";

const EmailSendingSettings: React.FC = () => {
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      <DomainHealthBanner />
      <TenantEmailHealthDashboardCard />
      <EmailDomainManagement />
    </div>
  );
};

export default EmailSendingSettings;
