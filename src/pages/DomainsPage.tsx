
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              Better Deliverability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Custom domains improve email deliverability rates and reduce the chance 
              of emails landing in spam folders.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              DMARC Protection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Automatic DMARC setup protects your domain from spoofing and phishing 
              attempts while maintaining compliance.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-purple-600" />
              Brand Consistency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Send emails from your own domain to maintain professional branding 
              and build customer trust.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <EmailDomainsList />
    </div>
  );
};

export default DomainsPage;
