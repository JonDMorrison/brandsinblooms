import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, AlertTriangle, CheckCircle2, TrendingUp, Sparkles, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

const tierLabels: Record<string, string> = {
  seed: 'Seed',
  sprout: 'Sprout',
  bloom: 'Bloom',
  thrive: 'Thrive',
  legacy: 'Legacy',
  free_trial: 'Free Trial',
};

const tierColors: Record<string, string> = {
  seed: 'bg-amber-100 text-amber-800 border-amber-300',
  sprout: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  bloom: 'bg-green-100 text-green-800 border-green-300',
  thrive: 'bg-primary/10 text-primary border-primary/30',
  legacy: 'bg-muted text-muted-foreground border-border',
  free_trial: 'bg-blue-100 text-blue-800 border-blue-300',
};

export const UsageDashboard = () => {
  const navigate = useNavigate();
  const { usage, loading, getThresholds, getUpgradeRecommendation, formatNumber } = useUsageTracking();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return null;
  }

  const thresholds = getThresholds();
  const recommendation = getUpgradeRecommendation();
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getStatusColor = (percent: number, unlimited: boolean) => {
    if (unlimited) return 'text-primary';
    if (percent >= 100) return 'text-destructive';
    if (percent >= 80) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getProgressColor = (percent: number, unlimited: boolean) => {
    if (unlimited) return 'bg-primary';
    if (percent >= 100) return 'bg-destructive';
    if (percent >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Usage Overview</h2>
          <p className="text-muted-foreground">{currentMonth}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("border", tierColors[usage.tier] || tierColors.legacy)}>
            <Leaf className="h-3 w-3 mr-1" />
            {tierLabels[usage.tier] || 'Unknown'}
          </Badge>
          {usage.isFoundingCustomer && (
            <Badge variant="secondary" className="bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-300">
              <Sparkles className="h-3 w-3 mr-1" />
              Founding Member
            </Badge>
          )}
        </div>
      </div>

      {/* Upgrade Recommendation */}
      {recommendation.shouldUpgrade && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-900">{recommendation.reason}</p>
                  {recommendation.suggestedTier && (
                    <p className="text-sm text-amber-700">
                      Upgrade to {tierLabels[recommendation.suggestedTier]} for more capacity
                    </p>
                  )}
                </div>
              </div>
              <Button 
                onClick={() => navigate('/pricing')}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Upgrade Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Email Usage */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Email Usage</CardTitle>
              </div>
              {usage.email.unlimited ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Unlimited
                </Badge>
              ) : thresholds.emailAt100 ? (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Limit Reached
                </Badge>
              ) : thresholds.emailAt80 ? (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Almost Full
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Good
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatNumber(usage.email.used)} of {usage.email.unlimited ? '∞' : formatNumber(usage.email.limit)} sent
                </span>
                <span className={cn("font-medium", getStatusColor(usage.email.percent, usage.email.unlimited))}>
                  {usage.email.unlimited ? 'Unlimited' : `${Math.round(usage.email.percent)}%`}
                </span>
              </div>
              <Progress 
                value={usage.email.unlimited ? 0 : Math.min(usage.email.percent, 100)} 
                className="h-2"
              />
            </div>
            
            {!usage.email.unlimited && (
              <p className="text-sm text-muted-foreground">
                {usage.email.remaining > 0 
                  ? `${formatNumber(usage.email.remaining)} emails remaining this month`
                  : 'No emails remaining this month'
                }
              </p>
            )}

            {usage.email.overageThisMonth > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Overage: {formatNumber(usage.email.overageThisMonth)} emails × ${usage.email.overageRate} = 
                  <span className="font-medium text-foreground ml-1">
                    ${(usage.email.overageThisMonth * usage.email.overageRate).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SMS Usage */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">SMS Usage</CardTitle>
              </div>
              {usage.sms.unlimited ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Fair Use
                </Badge>
              ) : thresholds.smsAt100 ? (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Limit Reached
                </Badge>
              ) : thresholds.smsAt80 ? (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Almost Full
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Good
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatNumber(usage.sms.used)} of {usage.sms.unlimited ? '50K fair use' : formatNumber(usage.sms.limit)} sent
                </span>
                <span className={cn("font-medium", getStatusColor(usage.sms.percent, usage.sms.unlimited))}>
                  {usage.sms.unlimited ? 'Fair Use' : `${Math.round(usage.sms.percent)}%`}
                </span>
              </div>
              <Progress 
                value={usage.sms.unlimited ? 0 : Math.min(usage.sms.percent, 100)} 
                className="h-2"
              />
            </div>
            
            {!usage.sms.unlimited && (
              <p className="text-sm text-muted-foreground">
                {usage.sms.remaining > 0 
                  ? `${formatNumber(usage.sms.remaining)} SMS remaining this month`
                  : 'No SMS remaining this month'
                }
              </p>
            )}

            {usage.sms.overageThisMonth > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Overage: {formatNumber(usage.sms.overageThisMonth)} SMS × ${usage.sms.overageRate} = 
                  <span className="font-medium text-foreground ml-1">
                    ${(usage.sms.overageThisMonth * usage.sms.overageRate).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan Details</CardTitle>
          <CardDescription>Your current subscription information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="font-medium">{tierLabels[usage.tier] || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing Cycle</p>
              <p className="font-medium capitalize">{usage.billingInterval}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Renewal</p>
              <p className="font-medium">
                {usage.endDate ? new Date(usage.endDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Want more capacity? Upgrade your plan to unlock higher limits.
            </p>
            <Button variant="outline" onClick={() => navigate('/pricing')}>
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
