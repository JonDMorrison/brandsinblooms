
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Plus, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  ExternalLink,
  Mail,
  RefreshCw
} from 'lucide-react';
import { EmailDomainWizard } from './EmailDomainWizard';
import { EmailDomainDetails } from './EmailDomainDetails';
import { useEmailDomains } from '@/hooks/useEmailDomains';
import { toast } from 'sonner';

export const EmailDomainsList = () => {
  const { emailDomains, loading, verifyEmailDomain } = useEmailDomains();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(new Set());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'verifying':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Verifying</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      setVerifyingDomains(prev => new Set(prev).add(domainId));
      const result = await verifyEmailDomain(domainId);
      
      if (result.allVerified) {
        toast.success('Domain verification completed successfully!');
      } else {
        toast.warning('Some DNS records are not yet configured correctly. Please check your DNS settings.');
      }
    } catch (error: any) {
      console.error('Error verifying domain:', error);
      toast.error(error.message || 'Failed to verify domain');
    } finally {
      setVerifyingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domainId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Email Domains
            </CardTitle>
            <Button 
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Domain
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {emailDomains.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No email domains configured</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Set up your own email domain to improve deliverability and maintain brand consistency 
                in your email campaigns.
              </p>
              <Button 
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Your First Domain
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {emailDomains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(domain.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{domain.domain}</span>
                        {getStatusBadge(domain.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-600">
                          Created {new Date(domain.created_at).toLocaleDateString()}
                        </span>
                        {domain.report_email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            Reports to: {domain.report_email}
                          </div>
                        )}
                      </div>
                      {domain.error && (
                        <p className="text-sm text-red-600 mt-1">{domain.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {domain.status !== 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyDomain(domain.id)}
                        disabled={verifyingDomains.has(domain.id)}
                        className="flex items-center gap-2"
                      >
                        {verifyingDomains.has(domain.id) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {verifyingDomains.has(domain.id) ? 'Verifying...' : 'Verify'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDomain(domain.id)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EmailDomainWizard 
        open={showWizard} 
        onOpenChange={setShowWizard} 
      />

      {selectedDomain && (
        <EmailDomainDetails
          domainId={selectedDomain}
          open={!!selectedDomain}
          onOpenChange={(open) => !open && setSelectedDomain(null)}
        />
      )}
    </>
  );
};
