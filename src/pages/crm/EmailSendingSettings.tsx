import React from "react";
import { EmailDomainManagement } from "@/components/crm/settings/EmailDomainManagement";
import { SendingRecoveryPanel } from "@/components/crm/settings/SendingRecoveryPanel";
import { TenantEmailHealthDashboardCard } from "@/components/crm/settings/TenantEmailHealthDashboardCard";
import { DomainHealthBanner } from "@/components/crm/email/DomainHealthBanner";
import { PageHeader } from "@/components/joy/PageHeader";

const EmailSendingSettings: React.FC = () => {
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      <PageHeader
        title="Email sending"
        subtitle="Check your sending domains and keep your email delivering."
      />
      <SendingRecoveryPanel />
      <DomainHealthBanner />
      <TenantEmailHealthDashboardCard />
      <EmailDomainManagement />
    </div>
  );
};

export default EmailSendingSettings;
