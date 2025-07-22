import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Clock, Zap, RefreshCw } from 'lucide-react';

interface CampaignAutomationSettingsProps {
  initialEnabled?: boolean;
  onSettingsChange?: (enabled: boolean) => void;
}

export const CampaignAutomationSettings: React.FC<CampaignAutomationSettingsProps> = ({
  initialEnabled = true,
  onSettingsChange
}) => {
  const [autoCreateEnabled, setAutoCreateEnabled] = useState(initialEnabled);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleToggleAutoCreate = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('company_profiles')
        .update({
          feature_flags: {
            auto_create_weekly_campaigns: enabled
          }
        })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      setAutoCreateEnabled(enabled);
      onSettingsChange?.(enabled);
      
      toast.success(
        enabled 
          ? 'Auto-generation enabled for weekly campaigns' 
          : 'Auto-generation disabled'
      );
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update automation settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTestGeneration = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-generate-weekly-campaigns', {
        body: { test_mode: true }
      });

      if (error) throw error;

      if (data.campaignsCreated > 0) {
        toast.success(`Test successful! Created ${data.campaignsCreated} draft campaigns`);
      } else {
        toast.info('Test completed - no campaigns were created (this is normal if themes are not available)');
      }
    } catch (error) {
      console.error('Test generation failed:', error);
      toast.error('Test failed - check your theme setup');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Campaign Automation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-generation toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="auto-create">Auto-create weekly newsletters</Label>
            <p className="text-sm text-muted-foreground">
              Automatically create draft CRM campaigns from your weekly themes every Monday at 8am PST
            </p>
          </div>
          <Switch
            id="auto-create"
            checked={autoCreateEnabled}
            onCheckedChange={handleToggleAutoCreate}
            disabled={isUpdating}
          />
        </div>

        <Separator />

        {/* How it works */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">How it works:</Label>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Runs every Monday at 8am PST</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Uses AI to generate subject lines and preheaders</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Creates draft campaigns ready for review</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Test button */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Test automation:</Label>
          <Button
            variant="outline"
            onClick={handleTestGeneration}
            disabled={isTesting}
            className="w-full"
          >
            {isTesting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Test Auto-Generation
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            This will attempt to create draft campaigns based on your current themes
          </p>
        </div>
      </CardContent>
    </Card>
  );
};