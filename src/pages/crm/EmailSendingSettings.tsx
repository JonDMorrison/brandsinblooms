import React from 'react';
import { EmailDomainManagement } from '@/components/crm/settings/EmailDomainManagement';

const EmailSendingSettings: React.FC = () => {
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <EmailDomainManagement />
    </div>
  );
};

export default EmailSendingSettings;
