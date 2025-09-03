import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, Mail, MessageSquare, Facebook, Instagram, AlertTriangle, Rocket } from 'lucide-react';
import { format } from 'date-fns';
import { usePlanWizard } from '../PlanWizardContext';
import { useTwilioSetup } from '@/components/dashboard/TwilioSetupChecker';
import { useDashboardData } from '@/hooks/useDashboardData';

interface PlanStepReviewProps {
  onBack: () => void;
  onLaunch: () => void;
  isLaunching?: boolean;
}

const typeConfig = {
  email: { icon: Mail, color: 'bg-blue-500', label: 'Email' },
  sms: { icon: MessageSquare, color: 'bg-green-500', label: 'SMS' },
  facebook: { icon: Facebook, color: 'bg-blue-600', label: 'Facebook' },
  instagram: { icon: Instagram, color: 'bg-pink-500', label: 'Instagram' }
};

export const PlanStepReview: React.FC<PlanStepReviewProps> = ({ 
  onBack, 
  onLaunch, 
  isLaunching = false 
}) => {
  const { state } = usePlanWizard();
  const { data: twilioData } = useTwilioSetup();
  const { data: dashboardData } = useDashboardData();

  const enabledItems = state.items.filter(item => item.enabled);
  
  // Group items by type
  const itemsByType = enabledItems.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, typeof state.items>);

  // Check guardrails
  const isTwilioConnected = twilioData?.isSetup || false;
  const isDomainVerified = dashboardData?.socialConnections?.some(conn => conn.platform === 'email') || false;
  
  const emailItems = itemsByType.email || [];
  const smsItems = itemsByType.sms || [];
  const socialItems = [...(itemsByType.facebook || []), ...(itemsByType.instagram || [])];

  const hasBlockedEmail = emailItems.length > 0 && !isDomainVerified;
  const hasBlockedSMS = smsItems.length > 0 && !isTwilioConnected;
  const hasAnyContent = enabledItems.length > 0;

  const monthName = state.month ? format(new Date(state.month), 'MMMM yyyy') : '';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <h2 className="text-3xl font-bold">Review Your Plan</h2>
        </div>
        <p className="text-muted-foreground text-lg">
          Your {state.theme?.label} marketing plan for {monthName} is ready to launch.
        </p>
      </div>

      {/* Guardrails Warnings */}
      {(hasBlockedEmail || hasBlockedSMS) && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-amber-800">Setup Required</p>
              <ul className="text-sm space-y-1 text-amber-700">
                {hasBlockedEmail && (
                  <li>• Email items require domain verification in Settings</li>
                )}
                {hasBlockedSMS && (
                  <li>• SMS items require Twilio connection in Settings</li>
                )}
              </ul>
              <p className="text-sm text-amber-700">
                Items that can't be created will be skipped during launch.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Content Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Email Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Mail className="h-4 w-4 text-white" />
              </div>
              Email Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{emailItems.length}</span>
              {hasBlockedEmail && (
                <Badge variant="destructive" className="text-xs">
                  Setup Required
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              {emailItems.slice(0, 3).map(item => (
                <div key={item.id} className="text-sm text-muted-foreground">
                  {format(item.date, 'MMM d')} - {item.title}
                </div>
              ))}
              {emailItems.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{emailItems.length - 3} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SMS Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              SMS Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{smsItems.length}</span>
              {hasBlockedSMS && (
                <Badge variant="destructive" className="text-xs">
                  Setup Required
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              {smsItems.slice(0, 3).map(item => (
                <div key={item.id} className="text-sm text-muted-foreground">
                  {format(item.date, 'MMM d')} - {item.title}
                </div>
              ))}
              {smsItems.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{smsItems.length - 3} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Social Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-pink-500 rounded-full flex items-center justify-center">
                <Facebook className="h-4 w-4 text-white" />
              </div>
              Social Posts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{socialItems.length}</span>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                Ready
              </Badge>
            </div>
            <div className="space-y-1">
              {socialItems.slice(0, 3).map(item => (
                <div key={item.id} className="text-sm text-muted-foreground">
                  {format(item.date, 'MMM d')} - {item.type} post
                </div>
              ))}
              {socialItems.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{socialItems.length - 3} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Launch Info */}
      <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-green-800">Ready to Launch</h3>
              <p className="text-sm text-green-700">
                Your content will be saved as drafts and scheduled items. No content will be sent immediately - 
                you can review and publish each item when you're ready.
              </p>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Clock className="h-4 w-4" />
                <span>Total items: {enabledItems.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button variant="outline" onClick={onBack} size="lg" className="px-8" disabled={isLaunching}>
          Back
        </Button>
        <Button 
          onClick={onLaunch} 
          disabled={!hasAnyContent || isLaunching}
          size="lg" 
          className="px-8 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
        >
          {isLaunching ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Launching Plan...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              Launch Plan
            </>
          )}
        </Button>
      </div>
    </div>
  );
};