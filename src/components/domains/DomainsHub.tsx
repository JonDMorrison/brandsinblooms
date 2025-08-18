
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Globe, 
  Mail, 
  Plus, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Zap
} from 'lucide-react';
import { useDomains } from '@/hooks/useDomains';
import { QuickStartCard } from './QuickStartCard';
import { AddDomainWizard } from './AddDomainWizard';
import { EmailSendersTab } from './EmailSendersTab';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export const DomainsHub = () => {
  const { domains, emailSenders, loading } = useDomains();
  const { tenant } = useTenant();
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const systemDomain = domains.find(d => d.type === 'system_path');
  const customDomains = domains.filter(d => d.type === 'custom');
  const verifiedEmailSenders = emailSenders.filter(s => s.verified);

  const getStatusBadge = (status: string, type: 'dns' | 'tls' | 'general' = 'general') => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock, text: 'Pending' },
      active: { variant: 'default' as const, icon: CheckCircle2, text: 'Active' },
      verified: { variant: 'default' as const, icon: CheckCircle2, text: 'Verified' },
      propagating: { variant: 'outline' as const, icon: Clock, text: 'Propagating' },
      error: { variant: 'destructive' as const, icon: AlertCircle, text: 'Error' },
      unknown: { variant: 'secondary' as const, icon: AlertCircle, text: 'Unknown' }
    };

    const config = variants[status as keyof typeof variants] || variants.unknown;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Domains & Email</h1>
            </div>
            <Button onClick={() => setShowAddDomain(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </div>
          <p className="text-muted-foreground">
            Manage your domains, landing pages, and email sending configuration
          </p>
        </div>

        {/* Quick Status Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Status
            </CardTitle>
            <CardDescription>
              Overview of your domain and email setup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* System Domain Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium">Quick Start Domain</span>
                </div>
                {systemDomain ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Setup Available
                  </Badge>
                )}
              </div>

              {/* Custom Domains Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium">Custom Domains</span>
                </div>
                {customDomains.length > 0 ? (
                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                    {customDomains.length} Domain{customDomains.length !== 1 ? 's' : ''}
                  </Badge>
                ) : (
                  <Badge variant="secondary">None Added</Badge>
                )}
              </div>

              {/* Email Senders Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm font-medium">Email Senders</span>
                </div>
                {verifiedEmailSenders.length > 0 ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {verifiedEmailSenders.length} Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Setup Required
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 h-auto p-2">
            <TabsTrigger value="overview" className="flex flex-col gap-2 p-4">
              <Globe className="h-5 w-5" />
              <span className="text-xs font-medium">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="domains" className="flex flex-col gap-2 p-4">
              <Globe className="h-5 w-5" />
              <span className="text-xs font-medium">Domains</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex flex-col gap-2 p-4">
              <Mail className="h-5 w-5" />
              <span className="text-xs font-medium">Email</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Start Card */}
              <QuickStartCard 
                systemDomain={systemDomain}
                tenantSlug={tenant?.slug || 'your-site'}
              />

              {/* Custom Domains Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Custom Domains
                  </CardTitle>
                  <CardDescription>
                    Your custom domain configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customDomains.length > 0 ? (
                    <div className="space-y-3">
                      {customDomains.slice(0, 3).map((domain) => (
                        <div key={domain.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{domain.domain}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(domain.dns_status, 'dns')}
                                {getStatusBadge(domain.tls_status, 'tls')}
                              </div>
                            </div>
                          </div>
                          {domain.status === 'active' && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                      {customDomains.length > 3 && (
                        <p className="text-sm text-muted-foreground text-center">
                          +{customDomains.length - 3} more domains
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No custom domains added yet</p>
                      <Button variant="outline" onClick={() => setShowAddDomain(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Domain
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="domains" className="space-y-6">
            <div className="space-y-6">
              {/* System Domain */}
              {systemDomain && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-600" />
                      Quick Start Domain
                    </CardTitle>
                    <CardDescription>
                      Your instant-ready BloomSuite subdomain
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">
                            {systemDomain.domain}{systemDomain.path_prefix}
                          </p>
                          <p className="text-sm text-muted-foreground">Ready to use immediately</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(`https://${systemDomain.domain}${systemDomain.path_prefix}`, 'URL')}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy URL
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a 
                            href={`https://${systemDomain.domain}${systemDomain.path_prefix}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Domains */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Custom Domains
                  </CardTitle>
                  <CardDescription>
                    Manage your custom domain configurations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {customDomains.length > 0 ? (
                    <div className="space-y-4">
                      {customDomains.map((domain) => (
                        <div key={domain.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Globe className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{domain.domain}</p>
                                <p className="text-sm text-muted-foreground">
                                  Added {new Date(domain.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {domain.status === 'active' && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">DNS:</span>
                              {getStatusBadge(domain.dns_status, 'dns')}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">TLS:</span>
                              {getStatusBadge(domain.tls_status, 'tls')}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Status:</span>
                              {getStatusBadge(domain.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No custom domains added yet</p>
                      <Button onClick={() => setShowAddDomain(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Domain
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <EmailSendersTab emailSenders={emailSenders} />
          </TabsContent>
        </Tabs>

        {/* Add Domain Wizard */}
        {showAddDomain && (
          <AddDomainWizard onClose={() => setShowAddDomain(false)} />
        )}
      </div>
    </div>
  );
};
