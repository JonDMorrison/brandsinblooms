
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Play, Users, Clock, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ReviewLaunchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation: {
    name: string;
    triggerType: string;
    flowSteps: any[];
    selectedAudience: {
      personas: any[];
      segments: any[];
      totalContacts: number;
    };
  };
  onLaunch: () => void;
  onTestSend: (recipient?: string) => void;
  isLoading?: boolean;
  isTestSending?: boolean;
}

export const ReviewLaunchModal: React.FC<ReviewLaunchModalProps> = ({
  open,
  onOpenChange,
  automation,
  onLaunch,
  onTestSend,
  isLoading = false,
  isTestSending = false
}) => {
  const getTriggerDescription = (triggerType: string) => {
    switch (triggerType) {
      case 'new_customer':
        return 'When a new customer joins';
      case 'repeat_purchase_30d':
        return 'When customer hasn\'t purchased in 30 days';
      case 'repeat_purchase_180d':
        return 'When customer hasn\'t purchased in 180 days';
      case 'birthday':
        return 'On customer\'s birthday';
      default:
        return triggerType;
    }
  };

  const getStepDescription = (step: any) => {
    switch (step.type) {
      case 'email':
        return `Email: ${step.data?.subject || 'Untitled email'}`;
      case 'sms':
        return `SMS: ${step.data?.message?.substring(0, 30) || 'Untitled SMS'}...`;
      case 'delay':
        return `Wait ${step.data?.delay || 1} ${step.data?.unit || 'day'}(s)`;
      case 'split':
        return 'Split test';
      default:
        return step.type;
    }
  };
  const [testRecipient, setTestRecipient] = useState('');
  const [activating, setActivating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fallback: if parent didn't provide onLaunch, activate directly here
  const defaultActivate = async () => {
    if (!user?.id) {
      toast({ title: 'Not signed in', description: 'Please sign in to continue.', variant: 'destructive' });
      return;
    }
    if (!automation?.name) {
      toast({ title: 'Missing name', description: 'Please give your automation a name before activating.', variant: 'destructive' });
      return;
    }
    setActivating(true);

    // Fetch tenant_id for RLS
    const { data: tenantRow, error: tenantError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (tenantError) {
      console.error('Failed to fetch tenant_id:', tenantError);
      toast({ title: 'Error', description: 'Could not fetch workspace context.', variant: 'destructive' });
      setActivating(false);
      return;
    }

    const payload: any = {
      name: automation.name,
      is_active: true,
      trigger_type: automation.triggerType || 'manual',
      trigger_conditions: {},
      workflow_steps: automation.flowSteps || [],
      user_id: user.id,
      tenant_id: tenantRow?.tenant_id,
    };

    const { error } = await supabase
      .from('crm_automations')
      .insert(payload);

    if (error) {
      console.error('Activation error:', error);
      toast({ title: 'Activation failed', description: error.message, variant: 'destructive' });
      setActivating(false);
      return;
    }

    toast({ title: 'Activated', description: 'Automation has been activated successfully.' });
    setActivating(false);
    onOpenChange(false);
  };

  const handleActivateClick = () => {
    if (onLaunch) {
      onLaunch();
    } else {
      defaultActivate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Review & Launch Automation
          </DialogTitle>
          <DialogDescription>
            Review your automation setup before activating it for your customers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Automation Overview */}
          <div className="space-y-3">
            <h3 className="font-semibold">Automation Overview</h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Name:</span>
                <span className="font-medium">{automation.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Trigger:</span>
                <Badge variant="outline">{getTriggerDescription(automation.triggerType)}</Badge>
              </div>
            </div>
          </div>

          {/* Flow Steps */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Flow Steps ({automation.flowSteps.length})
            </h3>
            <div className="space-y-2">
              {automation.flowSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </div>
                  <span className="text-sm">{getStepDescription(step)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Audience Targeting */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Target Audience
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estimated Reach:</span>
                <Badge variant="secondary">
                  {automation.selectedAudience.totalContacts.toLocaleString()} contacts
                </Badge>
              </div>
              
              {automation.selectedAudience.personas.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Personas:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {automation.selectedAudience.personas.map((persona) => (
                      <Badge key={persona.id} variant="outline" className="text-xs">
                        {persona.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {automation.selectedAudience.segments.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Segments:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {automation.selectedAudience.segments.map((segment) => (
                      <Badge key={segment.id} variant="outline" className="text-xs">
                        {segment.name} ({segment.customer_count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timing Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timing & Schedule
            </h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                This automation will activate immediately and run continuously based on the trigger conditions.
                Customers who meet the criteria will enter the flow automatically.
              </p>
            </div>
          </div>

          <Separator />

          {/* Test recipient + Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
              <div className="flex-1">
                <label className="block text-sm text-muted-foreground mb-1">Send test to</label>
                <Input
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com (defaults to your login email)"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  aria-label="Test recipient email"
                />
              </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => onTestSend(testRecipient?.trim() || undefined)}
                disabled={isLoading || isTestSending || activating}
              >
                {isTestSending ? 'Sending...' : 'Send Test'}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || activating}
              >
                Back to Editor
              </Button>
              <Button
                onClick={handleActivateClick}
                disabled={isLoading || automation.flowSteps.length === 0 || activating}
                aria-label="Activate automation"
              >
                {isLoading || activating ? 'Activating...' : 'Activate Automation'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
