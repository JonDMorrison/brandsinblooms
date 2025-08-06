import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Link2, 
  CreditCard, 
  Shield, 
  HelpCircle,
  Store,
  Plug2,
  CheckCircle2,
  AlertCircle,
  Settings
} from 'lucide-react';

// Import existing components
import { BusinessProfileSettings } from './BusinessProfileSettings';
import { ConnectionsSettings } from './ConnectionsSettings';
import { AccountBillingSettings } from './AccountBillingSettings';
import { ComplianceSettings } from './ComplianceSettings';
import { SupportSettings } from './SupportSettings';
import { POSSetupWizard } from '@/components/crm/pos/POSSetupWizard';

// Import hooks for status checking
import { usePOSConnection } from '@/hooks/usePOSConnection';
import { useConnectedAccounts } from '@/components/dashboard/ConnectedAccountChecker';

export const SettingsHub = () => {
  const [activeTab, setActiveTab] = useState('business');
  const [showPOSWizard, setShowPOSWizard] = useState(false);
  
  // Status hooks
  const { hasPOSConnection, loading: posLoading } = usePOSConnection();
  const { data: socialConnections = [], isLoading: socialLoading } = useConnectedAccounts();

  const settingsTabs = [
    {
      id: 'business',
      label: 'Business Profile',
      icon: Building2,
      description: 'Company information, brand voice, and target audience',
    },
    {
      id: 'connections',
      label: 'Connections',
      icon: Link2,
      description: 'POS systems, social media, and third-party integrations',
      badge: getConnectionsStatusBadge()
    },
    {
      id: 'account',
      label: 'Account & Billing',
      icon: CreditCard,
      description: 'Subscription, usage, and billing information',
    },
    {
      id: 'compliance',
      label: 'Compliance & Privacy',
      icon: Shield,
      description: 'SMS settings, quiet hours, and data retention',
    },
    {
      id: 'support',
      label: 'Support',
      icon: HelpCircle,
      description: 'Help center, documentation, and contact support',
    },
  ];

  function getConnectionsStatusBadge() {
    if (posLoading || socialLoading) return null;
    
    const totalConnections = (hasPOSConnection ? 1 : 0) + socialConnections.length;
    
    if (totalConnections === 0) {
      return <Badge variant="secondary" className="ml-2">Setup Required</Badge>;
    }
    
    return <Badge variant="default" className="ml-2">{totalConnections} Connected</Badge>;
  }

  const handlePOSCardClick = () => {
    if (!hasPOSConnection) {
      setShowPOSWizard(true);
    } else {
      setActiveTab('connections');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your business profile, connections, account settings, and more
          </p>
        </div>

        {/* Quick Status Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Setup Status
            </CardTitle>
            <CardDescription>
              Quick overview of your account setup and connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* POS Connection Status */}
              <div 
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handlePOSCardClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePOSCardClick();
                  }
                }}
                aria-label={hasPOSConnection ? "View POS connections" : "Set up POS connection"}
              >
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span className="text-sm font-medium">POS System</span>
                </div>
                {posLoading ? (
                  <Badge variant="outline">Checking...</Badge>
                ) : hasPOSConnection ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Setup Required
                  </Badge>
                )}
              </div>

              {/* Social Media Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Plug2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Social Media</span>
                </div>
                {socialLoading ? (
                  <Badge variant="outline">Checking...</Badge>
                ) : socialConnections.length > 0 ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {socialConnections.length} Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Setup Required
                  </Badge>
                )}
              </div>

              {/* Integrations Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Integrations</span>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-5 h-auto p-2">
            {settingsTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex flex-col items-center gap-2 p-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <tab.icon className="h-5 w-5" />
                <div className="text-center">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium">{tab.label}</span>
                    {tab.badge}
                  </div>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="business" className="space-y-6">
            <BusinessProfileSettings />
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <ConnectionsSettings />
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <AccountBillingSettings />
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <ComplianceSettings onUpdate={() => {}} />
          </TabsContent>

          <TabsContent value="support" className="space-y-6">
            <SupportSettings />
          </TabsContent>
        </Tabs>

        {/* POS Setup Wizard Modal */}
        {showPOSWizard && (
          <POSSetupWizard
            platform="shopify"
            onSuccess={() => {
              setShowPOSWizard(false);
              setActiveTab('connections');
            }}
            onCancel={() => setShowPOSWizard(false)}
          />
        )}
      </div>
    </div>
  );
};