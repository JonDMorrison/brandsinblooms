
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
// Removed sonner import - using global toast replacement
import { Settings, Mail, RefreshCw, CheckCircle } from "lucide-react";

interface AnalyticsSettings {
  auto_sync_enabled: boolean;
  sync_frequency: 'daily' | 'weekly';
  email_reports_enabled: boolean;
  email_frequency: 'weekly' | 'monthly';
}

export const AnalyticsSetupWizard = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AnalyticsSettings>({
    auto_sync_enabled: true,
    sync_frequency: 'daily',
    email_reports_enabled: true,
    email_frequency: 'weekly'
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveSettings = async () => {
    if (!user) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('analytics_settings')
        .upsert({
          user_id: user.id,
          ...settings
        });

      if (error) throw error;

      setSaved(true);
      toast.success('Analytics setup completed successfully!');
      
      // Reset saved state after 2 seconds
      setTimeout(() => setSaved(false), 2000);

    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save analytics settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Analytics Settings
        </CardTitle>
        <CardDescription>
          Configure how and when your analytics data is collected and reported
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Auto Sync Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Automatic Data Sync</Label>
              <p className="text-xs text-gray-600">
                Automatically fetch new analytics data from your connected accounts
              </p>
            </div>
            <Switch
              checked={settings.auto_sync_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, auto_sync_enabled: checked }))
              }
            />
          </div>

          {settings.auto_sync_enabled && (
            <div className="ml-4 space-y-2">
              <Label className="text-sm">Sync Frequency</Label>
              <NativeSelect
                label="Sync Frequency"
                value={settings.sync_frequency}
                onChange={(e) => setSettings(prev => ({ ...prev, sync_frequency: e.target.value as 'daily' | 'weekly' }))}
                className="w-48"
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' }
                ]}
              />
              <p className="text-xs text-gray-500">
                {settings.sync_frequency === 'daily' 
                  ? 'Data will be updated every day at midnight'
                  : 'Data will be updated every Monday morning'
                }
              </p>
            </div>
          )}
        </div>

        {/* Email Reports */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Reports
              </Label>
              <p className="text-xs text-gray-600">
                Receive analytics summaries and insights in your inbox
              </p>
            </div>
            <Switch
              checked={settings.email_reports_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, email_reports_enabled: checked }))
              }
            />
          </div>

          {settings.email_reports_enabled && (
            <div className="ml-4 space-y-2">
              <Label className="text-sm">Report Frequency</Label>
              <NativeSelect
                label="Report Frequency"
                value={settings.email_frequency}
                onChange={(e) => setSettings(prev => ({ ...prev, email_frequency: e.target.value as 'weekly' | 'monthly' }))}
                className="w-48"
                options={[
                  { value: 'weekly', label: 'Weekly Summary' },
                  { value: 'monthly', label: 'Monthly Report' }
                ]}
              />
              <p className="text-xs text-gray-500">
                {settings.email_frequency === 'weekly' 
                  ? 'Receive a summary every Monday morning'
                  : 'Receive a detailed report on the 1st of each month'
                }
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </Button>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">💡 Pro Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Daily sync gives you the most up-to-date insights</li>
            <li>• Weekly email reports help you stay on top of trends</li>
            <li>• You can manually sync data anytime from the connections panel</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
