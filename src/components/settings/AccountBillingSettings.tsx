import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BillingDashboard } from '@/components/billing/BillingDashboard';
import { UsageAnalytics } from '@/components/billing/UsageAnalytics';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, BarChart3, AlertTriangle } from 'lucide-react';

export const AccountBillingSettings = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Account & Billing
          </CardTitle>
          <CardDescription>
            Manage your subscription, view usage analytics, and handle account settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="billing" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="billing">Billing & Subscription</TabsTrigger>
              <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
              <TabsTrigger value="danger">Account Management</TabsTrigger>
            </TabsList>

            <TabsContent value="billing" className="space-y-6">
              <BillingDashboard />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <UsageAnalytics />
            </TabsContent>

            <TabsContent value="danger" className="space-y-6">
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Irreversible actions that will permanently affect your account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DeleteAccountSection />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};