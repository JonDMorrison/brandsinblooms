import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Mail, MessageSquare, Globe, Zap, ArrowRight } from "lucide-react";

interface UpgradePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: string;
  suggestedTier: string;
  reason: 'email_limit' | 'sms_limit' | 'both_limit' | 'approaching';
  emailRemaining?: number;
  smsRemaining?: number;
  recipientsNeeded?: number;
}

const tierBenefits: Record<string, { emails: string; sms: string; website: boolean; price: number }> = {
  seed: { emails: '10,000', sms: '1,000', website: false, price: 199 },
  sprout: { emails: '20,000', sms: '2,000', website: true, price: 349 },
  bloom: { emails: '100,000', sms: '5,000', website: true, price: 699 },
  thrive: { emails: 'Unlimited', sms: '50,000 (Fair Use)', website: true, price: 1199 },
};

const tierLabels: Record<string, string> = {
  seed: 'Seed',
  sprout: 'Sprout',
  bloom: 'Bloom',
  thrive: 'Thrive',
};

export const UpgradePromptModal = ({
  open,
  onOpenChange,
  currentTier,
  suggestedTier,
  reason,
  emailRemaining = 0,
  smsRemaining = 0,
  recipientsNeeded = 0,
}: UpgradePromptModalProps) => {
  const navigate = useNavigate();
  const suggested = tierBenefits[suggestedTier];
  const current = tierBenefits[currentTier];

  const getTitle = () => {
    switch (reason) {
      case 'email_limit':
        return 'Email Limit Reached';
      case 'sms_limit':
        return 'SMS Limit Reached';
      case 'both_limit':
        return 'Usage Limits Reached';
      case 'approaching':
        return 'Approaching Your Limit';
      default:
        return 'Upgrade Your Plan';
    }
  };

  const getDescription = () => {
    switch (reason) {
      case 'email_limit':
        return `You've used all your emails this month. Upgrade to continue sending campaigns.`;
      case 'sms_limit':
        return `You've used all your SMS messages this month. Upgrade to continue sending.`;
      case 'both_limit':
        return `You've reached both your email and SMS limits. Upgrade to unlock more capacity.`;
      case 'approaching':
        return `You're running low on credits. Upgrade now to avoid interruption.`;
      default:
        return 'Unlock more capacity for your growing business.';
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/pricing?tier=${suggestedTier}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{getTitle()}</DialogTitle>
          </div>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          {reason !== 'approaching' && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              {reason === 'email_limit' && (
                <p>You need {recipientsNeeded} emails but have {emailRemaining} remaining.</p>
              )}
              {reason === 'sms_limit' && (
                <p>You need {recipientsNeeded} SMS but have {smsRemaining} remaining.</p>
              )}
              {reason === 'both_limit' && (
                <p>Both email ({emailRemaining} left) and SMS ({smsRemaining} left) limits reached.</p>
              )}
            </div>
          )}

          {/* Upgrade Benefits */}
          {suggested && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Upgrade to</span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  {tierLabels[suggestedTier]}
                </Badge>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{suggested.emails} emails/month</span>
                  {current && (
                    <span className="text-muted-foreground">(up from {current.emails})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span>{suggested.sms} SMS/month</span>
                  {current && (
                    <span className="text-muted-foreground">(up from {current.sms})</span>
                  )}
                </div>
                {suggested.website && !current?.website && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Globe className="h-4 w-4" />
                    <span>Website + Ecommerce included</span>
                    <Zap className="h-3 w-3" />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t">
                <p className="text-lg font-semibold">
                  ${suggested.price}<span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Not Now
          </Button>
          <Button className="flex-1" onClick={handleUpgrade}>
            Upgrade
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
