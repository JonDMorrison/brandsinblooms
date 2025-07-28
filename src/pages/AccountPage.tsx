
import React, { useState } from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { BillingDashboard } from '@/components/billing/BillingDashboard';
import { UsageAnalytics } from '@/components/billing/UsageAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const AccountPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  return (
    <ProtectedPageWrapper>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences, billing, and subscription details
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="billing">Billing & Subscription</TabsTrigger>
              <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
              <TabsTrigger value="danger">Danger Zone</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={user?.email || ''} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Display Name</Label>
                      <Input id="name" type="text" placeholder="Enter your display name" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" type="text" placeholder="UTC" />
                  </div>
                  <Button>Save Changes</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose how you want to be notified about important updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Notification settings coming soon...
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <BillingDashboard />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <UsageAnalytics />
            </TabsContent>

            <TabsContent value="danger" className="space-y-6">
              <DeleteAccountSection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default AccountPage;
