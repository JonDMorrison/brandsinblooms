import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Mail, MessageSquare, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export const AddOnSection = () => {
  const { subscription, loading } = useSubscription();
  const [processingCRM, setProcessingCRM] = useState(false);
  const [processingSMS, setProcessingSMS] = useState(false);

  const handleToggleAddOn = async (addOnType: 'crm' | 'sms', enabled: boolean) => {
    if (enabled) {
      // Enable add-on via Stripe checkout
      const setLoading = addOnType === 'crm' ? setProcessingCRM : setProcessingSMS;
      setLoading(true);
      
      try {
        const priceId = addOnType === 'crm' ? 'crm_addon_monthly' : 'sms_addon_monthly';
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { 
            plan: priceId,
            billing_interval: 'monthly'
          }
        });
        
        if (error) throw error;
        
        if (data?.url) {
          window.open(data.url, '_blank');
        } else {
          throw new Error('No checkout URL received');
        }
      } catch (error) {
        console.error(`Error enabling ${addOnType} add-on:`, error);
        alert(`Failed to enable ${addOnType} add-on. Please try again.`);
      } finally {
        setLoading(false);
      }
    } else {
      // Disable add-on via customer portal
      try {
        const { data, error } = await supabase.functions.invoke('customer-portal');
        
        if (error) throw error;
        
        if (data?.url) {
          window.open(data.url, '_blank');
        } else {
          throw new Error('No portal URL received');
        }
      } catch (error) {
        console.error('Error accessing customer portal:', error);
        alert('Failed to access billing portal. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add-Ons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const crmEnabled = subscription?.crm_enabled || false;
  const smsEnabled = subscription?.sms_enabled || false;
  
  const emailUsage = subscription?.email_usage || 0;
  const emailQuota = subscription?.email_quota || 1000;
  const emailUsagePercent = (emailUsage / emailQuota) * 100;
  
  const smsUsage = subscription?.sms_usage || 0;
  const smsQuota = subscription?.sms_quota || 250;
  const smsUsagePercent = (smsUsage / smsQuota) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Add-Ons
          <Badge variant="outline" className="ml-2">Optional</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enhance your account with CRM and SMS marketing capabilities
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CRM Add-On */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium">CRM + Email Marketing</h3>
                <Badge variant="secondary" className="text-xs">$29/month</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Customer management, email campaigns, and analytics
              </p>
              {crmEnabled && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Email usage this month:</span>
                    <span className="font-medium">{emailUsage} / {emailQuota}</span>
                  </div>
                  <Progress value={emailUsagePercent} className="h-2" />
                  {emailUsagePercent > 80 && (
                    <div className="flex items-center space-x-2 text-orange-600 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>You're nearing your email limit</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {crmEnabled ? (
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Enabled</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleAddOn('crm', false)}
                  className="ml-2"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Manage via Stripe
                </Button>
              </div>
            ) : (
              <Switch
                checked={false}
                onCheckedChange={(checked) => handleToggleAddOn('crm', checked)}
                disabled={processingCRM}
              />
            )}
          </div>
        </div>

        {/* SMS Add-On */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium">SMS Marketing</h3>
                <Badge variant="secondary" className="text-xs">$19/month</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Text message campaigns and customer notifications
              </p>
              {smsEnabled && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>SMS usage this month:</span>
                    <span className="font-medium">{smsUsage} / {smsQuota}</span>
                  </div>
                  <Progress value={smsUsagePercent} className="h-2" />
                  {smsUsagePercent > 80 && (
                    <div className="flex items-center space-x-2 text-orange-600 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>You're nearing your SMS limit</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {smsEnabled ? (
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Enabled</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleAddOn('sms', false)}
                  className="ml-2"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Manage via Stripe
                </Button>
              </div>
            ) : (
              <Switch
                checked={false}
                onCheckedChange={(checked) => handleToggleAddOn('sms', checked)}
                disabled={processingSMS}
              />
            )}
          </div>
        </div>

        {/* Usage Overview */}
        {(crmEnabled || smsEnabled) && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-3">Monthly Usage Overview</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {crmEnabled && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Emails</span>
                    <span className="font-medium">{emailUsage} / {emailQuota}</span>
                  </div>
                  <Progress value={emailUsagePercent} className="h-1" />
                </div>
              )}
              {smsEnabled && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>SMS Messages</span>
                    <span className="font-medium">{smsUsage} / {smsQuota}</span>
                  </div>
                  <Progress value={smsUsagePercent} className="h-1" />
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};