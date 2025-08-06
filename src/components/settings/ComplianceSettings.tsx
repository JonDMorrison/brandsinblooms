import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Clock, Database, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ComplianceSettingsProps {
  onUpdate?: () => void;
}

export const ComplianceSettings = ({ onUpdate }: ComplianceSettingsProps = {}) => {
  const [settings, setSettings] = useState({
    smsOptIn: true,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    dataRetentionDays: 365,
    unsubscribeText: 'Reply STOP to unsubscribe',
    complianceFooter: 'Msg&data rates may apply. Msg frequency varies.',
  });
  
  const { toast } = useToast();

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    toast({
      title: "Settings Saved",
      description: "Your compliance settings have been updated.",
    });
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance & Privacy
          </CardTitle>
          <CardDescription>
            Configure SMS compliance, quiet hours, data retention, and privacy settings to ensure legal compliance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SMS Compliance */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <h3 className="text-lg font-medium">SMS Compliance</h3>
            </div>
            
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="sms-opt-in">Require SMS Opt-in</Label>
                  <p className="text-sm text-muted-foreground">
                    Require explicit consent before sending SMS messages
                  </p>
                </div>
                <Switch
                  id="sms-opt-in"
                  checked={settings.smsOptIn}
                  onCheckedChange={(checked) => handleSettingChange('smsOptIn', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unsubscribe-text">Unsubscribe Instructions</Label>
                <Input
                  id="unsubscribe-text"
                  value={settings.unsubscribeText}
                  onChange={(e) => handleSettingChange('unsubscribeText', e.target.value)}
                  placeholder="Reply STOP to unsubscribe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="compliance-footer">Compliance Footer</Label>
                <Textarea
                  id="compliance-footer"
                  value={settings.complianceFooter}
                  onChange={(e) => handleSettingChange('complianceFooter', e.target.value)}
                  placeholder="Msg&data rates may apply. Msg frequency varies."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <h3 className="text-lg font-medium">Quiet Hours</h3>
            </div>
            
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
                  <p className="text-sm text-muted-foreground">
                    Prevent messages from being sent during specified hours
                  </p>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={settings.quietHoursEnabled}
                  onCheckedChange={(checked) => handleSettingChange('quietHoursEnabled', checked)}
                />
              </div>

              {settings.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quiet-start">Start Time</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={settings.quietHoursStart}
                      onChange={(e) => handleSettingChange('quietHoursStart', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet-end">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={settings.quietHoursEnd}
                      onChange={(e) => handleSettingChange('quietHoursEnd', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Data Retention */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <h3 className="text-lg font-medium">Data Retention</h3>
            </div>
            
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Label htmlFor="retention-days">Data Retention Period (Days)</Label>
                <Input
                  id="retention-days"
                  type="number"
                  value={settings.dataRetentionDays}
                  onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
                  min="30"
                  max="2555"
                />
                <p className="text-sm text-muted-foreground">
                  How long to keep customer data and interaction logs (minimum 30 days, maximum 7 years)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave}>Save Compliance Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};