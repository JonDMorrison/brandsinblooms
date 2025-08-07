import React from 'react';
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
  onTestSend: () => void;
  isLoading?: boolean;
}

export const ReviewLaunchModal: React.FC<ReviewLaunchModalProps> = ({
  open,
  onOpenChange,
  automation,
  onLaunch,
  onTestSend,
  isLoading = false
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

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onTestSend}
              disabled={isLoading}
            >
              Send Test
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Back to Editor
            </Button>
            <Button
              onClick={onLaunch}
              disabled={isLoading || automation.flowSteps.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Activating...' : 'Activate Automation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};