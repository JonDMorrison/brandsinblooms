import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Mail, MessageSquare } from 'lucide-react';

interface AlertRule {
  rule_type: 'high_roi' | 'low_roi' | 'high_redemption' | 'low_ctr';
  threshold_value: number;
  notification_channels: string[];
  is_active: boolean;
}

export const AlertSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    {
      rule_type: 'high_roi',
      threshold_value: 3.0,
      notification_channels: ['email'],
      is_active: true
    },
    {
      rule_type: 'low_roi',
      threshold_value: 0.1,
      notification_channels: ['email'],
      is_active: true
    },
    {
      rule_type: 'low_ctr',
      threshold_value: 2.0,
      notification_channels: ['email'],
      is_active: false
    },
    {
      rule_type: 'high_redemption',
      threshold_value: 15.0,
      notification_channels: ['email'],
      is_active: false
    }
  ]);

  const updateRule = (index: number, updates: Partial<AlertRule>) => {
    const newRules = [...alertRules];
    newRules[index] = { ...newRules[index], ...updates };
    setAlertRules(newRules);
  };

  const toggleNotificationChannel = (ruleIndex: number, channel: string) => {
    const rule = alertRules[ruleIndex];
    const channels = rule.notification_channels.includes(channel)
      ? rule.notification_channels.filter(c => c !== channel)
      : [...rule.notification_channels, channel];
    
    updateRule(ruleIndex, { notification_channels: channels });
  };

  const saveAlertRules = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userRecord?.tenant_id) throw new Error('No tenant found');

      // Store in company_profiles compliance_settings instead
      const { data: companyProfile } = await supabase
        .from('company_profiles')
        .select('compliance_settings')
        .eq('user_id', user.id)
        .single();

      const currentSettings = (companyProfile?.compliance_settings as any) || {};
      
      const { error } = await supabase
        .from('company_profiles')
        .update({ 
          compliance_settings: {
            ...currentSettings,
            alert_rules: alertRules
          }
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Alert rules saved successfully' });
    } catch (error) {
      toast({ 
        title: 'Error saving alert rules', 
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testAlert = async () => {
    try {
      const { error } = await supabase.functions.invoke('roi-alert-worker');
      if (error) throw error;
      
      toast({ title: 'Test alert triggered successfully' });
    } catch (error) {
      toast({ 
        title: 'Error testing alerts', 
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  };

  const getRuleTitle = (ruleType: string) => {
    switch (ruleType) {
      case 'high_roi': return 'High ROI Alert';
      case 'low_roi': return 'Low ROI Warning';
      case 'low_ctr': return 'Low Click Rate Warning';
      case 'high_redemption': return 'High Redemption Alert';
      default: return 'Alert Rule';
    }
  };

  const getRuleDescription = (ruleType: string) => {
    switch (ruleType) {
      case 'high_roi': return 'Get notified when campaigns exceed revenue per send threshold';
      case 'low_roi': return 'Get warned when campaigns underperform on revenue per send';
      case 'low_ctr': return 'Get alerted when click-through rates are below threshold';
      case 'high_redemption': return 'Celebrate high coupon redemption rates';
      default: return 'Configure alert conditions';
    }
  };

  const getThresholdLabel = (ruleType: string) => {
    switch (ruleType) {
      case 'high_roi':
      case 'low_roi': 
        return 'Revenue per send ($)';
      case 'low_ctr': 
        return 'Click rate (%)';
      case 'high_redemption': 
        return 'Redemption rate (%)';
      default: 
        return 'Threshold';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            ROI Alert Settings
          </CardTitle>
          <CardDescription>
            Configure automatic alerts for campaign performance thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {alertRules.map((rule, index) => (
              <Card key={rule.rule_type}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{getRuleTitle(rule.rule_type)}</CardTitle>
                      <CardDescription>{getRuleDescription(rule.rule_type)}</CardDescription>
                    </div>
                    <Switch 
                      checked={rule.is_active}
                      onCheckedChange={(checked) => updateRule(index, { is_active: checked })}
                    />
                  </div>
                </CardHeader>
                
                {rule.is_active && (
                  <CardContent className="space-y-4">
                    <div>
                      <Label>{getThresholdLabel(rule.rule_type)}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={rule.threshold_value}
                        onChange={(e) => updateRule(index, { threshold_value: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Notification Channels</Label>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`email-${index}`}
                            checked={rule.notification_channels.includes('email')}
                            onCheckedChange={() => toggleNotificationChannel(index, 'email')}
                          />
                          <Label htmlFor={`email-${index}`} className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            Email
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`slack-${index}`}
                            checked={rule.notification_channels.includes('slack')}
                            onCheckedChange={() => toggleNotificationChannel(index, 'slack')}
                          />
                          <Label htmlFor={`slack-${index}`} className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            Slack
                          </Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}

            <div className="flex gap-2">
              <Button onClick={saveAlertRules} disabled={loading}>
                {loading ? 'Saving...' : 'Save Alert Rules'}
              </Button>
              <Button variant="outline" onClick={testAlert}>
                Test Alerts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};