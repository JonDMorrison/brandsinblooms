import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { Mail, MessageSquare, AlertTriangle, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreSendQuotaCheckProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'email' | 'sms';
  recipientCount: number;
  onProceed: (action: 'send_all' | 'send_partial' | 'schedule_later') => void;
  campaignName?: string;
}

export const PreSendQuotaCheck = ({
  open,
  onOpenChange,
  type,
  recipientCount,
  onProceed,
  campaignName,
}: PreSendQuotaCheckProps) => {
  const navigate = useNavigate();
  const { usage, checkCanSend, formatNumber } = useUsageTracking();

  if (!usage) return null;

  const { canSend, remaining, overageNeeded } = checkCanSend(type, recipientCount);
  const stats = type === 'email' ? usage.email : usage.sms;
  const Icon = type === 'email' ? Mail : MessageSquare;
  const typeLabel = type === 'email' ? 'emails' : 'SMS messages';

  // If can send all, show confirmation
  if (canSend) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 rounded-full">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <DialogTitle>Ready to Send</DialogTitle>
            </div>
            <DialogDescription>
              {campaignName && <span className="font-medium">{campaignName}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Recipients</span>
              </div>
              <span className="font-medium">{formatNumber(recipientCount)}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-sm text-emerald-800">Remaining after send</span>
              <span className="font-medium text-emerald-700">
                {stats.unlimited ? '∞' : formatNumber(remaining - recipientCount)} {typeLabel}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onProceed('send_all')}>
              Send Campaign
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Need to show quota exceeded options
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-full">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>Quota Check</DialogTitle>
          </div>
          <DialogDescription>
            This campaign needs more {typeLabel} than you have remaining.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Current Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">Campaign recipients</span>
              <span className="font-medium">{formatNumber(recipientCount)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-sm text-amber-800">Your remaining quota</span>
              <span className="font-medium text-amber-700">{formatNumber(remaining)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <span className="text-sm text-destructive">Additional needed</span>
              <span className="font-medium text-destructive">{formatNumber(overageNeeded)}</span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Your options:</p>
            
            <button 
              onClick={() => {
                onOpenChange(false);
                navigate('/pricing');
              }}
              className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Upgrade your plan</p>
                  <p className="text-xs text-muted-foreground">Get more {typeLabel} instantly</p>
                </div>
                <Badge className="bg-primary">Recommended</Badge>
              </div>
            </button>

            {remaining > 0 && (
              <button 
                onClick={() => onProceed('send_partial')}
                className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">Send to {formatNumber(remaining)} recipients</p>
                  <p className="text-xs text-muted-foreground">Send to as many as your quota allows</p>
                </div>
              </button>
            )}

            <button 
              onClick={() => onProceed('schedule_later')}
              className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Schedule for next month</p>
                  <p className="text-xs text-muted-foreground">Your quota resets on the 1st</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
