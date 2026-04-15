
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { EmailDomainsList } from '@/components/domains/EmailDomainsList';
import { Shield, Mail, CheckCircle } from 'lucide-react';

const DomainsPage = () => {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Domains</h1>
        <p className="text-gray-600 mt-2">
          Manage your email domains for improved deliverability and DMARC compliance
        </p>
      </div>


      {/* Main Content */}
      <EmailDomainsList />
    </div>
  );
};

export default DomainsPage;
