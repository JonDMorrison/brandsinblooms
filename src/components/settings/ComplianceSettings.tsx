import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ComplianceSettingsProps {
  settings?: {
    quiet_hours: { start: string; end: string };
    timezone: string;
    footer_enabled: boolean;
    footer_text: string;
    help_response: string;
  };
  onUpdate: (settings: any) => void;
}

export const ComplianceSettings = ({ settings, onUpdate }: ComplianceSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [quietHours, setQuietHours] = useState({
    start: settings?.quiet_hours?.start || '20:00',
    end: settings?.quiet_hours?.end || '08:00'
  });
  
  const [footerEnabled, setFooterEnabled] = useState(settings?.footer_enabled ?? true);
  const [footerText, setFooterText] = useState(
    settings?.footer_text || 'Reply STOP to opt out, HELP for help. Msg&Data Rates May Apply.'
  );
  const [helpResponse, setHelpResponse] = useState(
    settings?.help_response || 'For support, contact us at support@example.com or call 1-800-XXX-XXXX. Reply STOP to opt out.'
  );

  const handleSave = async () => {
    setLoading(true);
    try {
      const newSettings = {
        quiet_hours: quietHours,
        timezone: 'America/New_York',
        footer_enabled: footerEnabled,
        footer_text: footerText,
        help_response: helpResponse
      };

      const { error } = await supabase
        .from('company_profiles')
        .update({ compliance_settings: newSettings })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      onUpdate(newSettings);
      toast({ title: 'Compliance settings updated successfully' });
    } catch (error) {
      toast({ 
        title: 'Error updating settings', 
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Compliance Settings</CardTitle>
        <CardDescription>Configure TCPA/CTIA compliant messaging settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base font-medium">Quiet Hours</Label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={quietHours.start}
                onChange={(e) => setQuietHours(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={quietHours.end}
                onChange={(e) => setQuietHours(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Footer Injection</Label>
            <p className="text-sm text-muted-foreground">Automatically add compliance footer once per 24 hours</p>
          </div>
          <Switch checked={footerEnabled} onCheckedChange={setFooterEnabled} />
        </div>

        <div>
          <Label htmlFor="footer-text">Footer Text</Label>
          <Textarea
            id="footer-text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Reply STOP to opt out, HELP for help. Msg&Data Rates May Apply."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="help-response">HELP Keyword Response</Label>
          <Textarea
            id="help-response"
            value={helpResponse}
            onChange={(e) => setHelpResponse(e.target.value)}
            placeholder="For support, contact us at support@example.com"
            className="mt-1"
          />
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};