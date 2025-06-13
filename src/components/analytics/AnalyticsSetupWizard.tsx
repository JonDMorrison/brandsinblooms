
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
      toast.success('Analytics settings saved successfully!');
      
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
              <Select
                value={settings.sync_frequency}
                onValueChange={(value: 'daily' | 'weekly') =>
                  setSettings(prev => ({ ...prev, sync_frequency: value }))
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
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
              <Select
                value={settings.email_frequency}
                onValueChange={(value: 'weekly' | 'monthly') =>
                  setSettings(prev => ({ ...prev, email_frequency: value }))
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly Summary</SelectItem>
                  <SelectItem value="monthly">Monthly Report</SelectItem>
                </SelectContent>
              </Select>
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
