import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Label } from '@/components/ui-legacy/label';
import { Switch } from '@/components/ui-legacy/switch';
import { Slider } from '@/components/ui-legacy/slider';
import { NativeSelect } from '@/components/ui-legacy/NativeSelect';
import { Button } from '@/components/ui-legacy/button';
import { Bell, Mail, MessageSquare, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface UsageAlertSettings {
  email_warning_threshold: number;
  email_critical_threshold: number;
  sms_warning_threshold: number;
  sms_critical_threshold: number;
  email_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
  auto_pause_at_limit: boolean;
  pos_sync_frequency: string;
}

const defaultSettings: UsageAlertSettings = {
  email_warning_threshold: 80,
  email_critical_threshold: 100,
  sms_warning_threshold: 80,
  sms_critical_threshold: 100,
  email_notifications_enabled: true,
  in_app_notifications_enabled: true,
  auto_pause_at_limit: false,
  pos_sync_frequency: 'auto',
};

export function UsageAlertSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UsageAlertSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('usage_alert_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data) {
        setSettings({
          email_warning_threshold: data.email_warning_threshold,
          email_critical_threshold: data.email_critical_threshold,
          sms_warning_threshold: data.sms_warning_threshold,
          sms_critical_threshold: data.sms_critical_threshold,
          email_notifications_enabled: data.email_notifications_enabled,
          in_app_notifications_enabled: data.in_app_notifications_enabled,
          auto_pause_at_limit: data.auto_pause_at_limit,
          pos_sync_frequency: data.pos_sync_frequency,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Get tenant_id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('usage_alert_settings')
        .upsert({
          user_id: user.id,
          tenant_id: userData?.tenant_id,
          ...settings,
        }, { 
          onConflict: 'tenant_id,user_id' 
        });

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified about usage alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive alerts via email when approaching limits
              </p>
            </div>
            <Switch
              checked={settings.email_notifications_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, email_notifications_enabled: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show usage warnings in the dashboard
              </p>
            </div>
            <Switch
              checked={settings.in_app_notifications_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, in_app_notifications_enabled: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Alert Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Usage Alerts
          </CardTitle>
          <CardDescription>
            Set when you want to be alerted about email usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Warning Alert</Label>
              <span className="text-sm font-medium">{settings.email_warning_threshold}%</span>
            </div>
            <Slider
              value={[settings.email_warning_threshold]}
              onValueChange={([value]) => 
                setSettings(prev => ({ ...prev, email_warning_threshold: value }))
              }
              max={100}
              min={50}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Get notified when email usage reaches this percentage
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Critical Alert</Label>
              <span className="text-sm font-medium">{settings.email_critical_threshold}%</span>
            </div>
            <Slider
              value={[settings.email_critical_threshold]}
              onValueChange={([value]) => 
                setSettings(prev => ({ ...prev, email_critical_threshold: value }))
              }
              max={100}
              min={80}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Urgent notification when email usage reaches this percentage
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SMS Alert Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Usage Alerts
          </CardTitle>
          <CardDescription>
            Set when you want to be alerted about SMS usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Warning Alert</Label>
              <span className="text-sm font-medium">{settings.sms_warning_threshold}%</span>
            </div>
            <Slider
              value={[settings.sms_warning_threshold]}
              onValueChange={([value]) => 
                setSettings(prev => ({ ...prev, sms_warning_threshold: value }))
              }
              max={100}
              min={50}
              step={5}
              className="w-full"
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Critical Alert</Label>
              <span className="text-sm font-medium">{settings.sms_critical_threshold}%</span>
            </div>
            <Slider
              value={[settings.sms_critical_threshold]}
              onValueChange={([value]) => 
                setSettings(prev => ({ ...prev, sms_critical_threshold: value }))
              }
              max={100}
              min={80}
              step={5}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* POS Sync Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            POS Sync Frequency
          </CardTitle>
          <CardDescription>
            Control how often your POS data syncs (affects API usage)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <NativeSelect
              label="Sync Frequency"
              value={settings.pos_sync_frequency}
              onChange={(e) => 
                setSettings(prev => ({ ...prev, pos_sync_frequency: e.target.value }))
              }
              options={[
                { value: 'auto', label: 'Automatic (Recommended)' },
                { value: 'realtime', label: 'Real-time (Webhook-based)' },
                { value: 'hourly', label: 'Hourly' },
                { value: 'daily', label: 'Daily' },
                { value: 'manual', label: 'Manual Only' },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {settings.pos_sync_frequency === 'auto' && 'System adjusts based on your data volume'}
              {settings.pos_sync_frequency === 'realtime' && 'Updates immediately when changes occur'}
              {settings.pos_sync_frequency === 'hourly' && 'Syncs once per hour'}
              {settings.pos_sync_frequency === 'daily' && 'Most cost-effective option'}
              {settings.pos_sync_frequency === 'manual' && 'Only syncs when you click Sync Now'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Pause Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Budget Protection
          </CardTitle>
          <CardDescription>
            Automatically pause campaigns when limits are reached
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-pause at limit</Label>
              <p className="text-sm text-muted-foreground">
                Automatically pause sending when you reach 100% of your quota
              </p>
            </div>
            <Switch
              checked={settings.auto_pause_at_limit}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, auto_pause_at_limit: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
