import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Palette, 
  Building2, 
  Store, 
  Users, 
  Globe, 
  Rocket,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { SetupStepCard } from '@/components/account-setup/SetupStepCard';
import { SetupCelebration } from '@/components/account-setup/SetupCelebration';
import { useAccountSetupProgress } from '@/hooks/useAccountSetupProgress';

const AccountSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    progress,
    skippedSteps,
    isLoading,
    lastCompletedStep,
    skipStep,
    unskipStep,
    clearCelebration,
    getCompletionPercentage,
  } = useAccountSetupProgress();

  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const toggleStep = (stepId: string) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  const completionPercentage = getCompletionPercentage();
  const isAllComplete = completionPercentage === 100;

  const getCelebrationStepName = () => {
    switch (lastCompletedStep) {
      case 'colors': return 'Brand Colors';
      case 'profile': return 'Company Profile';
      case 'pos': return 'POS Integration';
      case 'clients': return 'Client Import';
      case 'domain': return 'Domain Setup';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Celebration overlay */}
      <SetupCelebration
        trigger={!!lastCompletedStep}
        stepName={getCelebrationStepName()}
        onComplete={clearCelebration}
      />

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
          <Rocket className="w-5 h-5 text-primary" />
          <span className="font-medium text-primary">Account Setup</span>
        </div>
        
        <h1 className="text-3xl font-bold">Let's get you set up for success!</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Complete these steps to unlock the full power of BloomSuite. 
          Don't worry — you can skip any step and come back later.
        </p>
      </div>

      {/* Progress Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isAllComplete ? (
                <div className="p-2 bg-primary rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
                </div>
              ) : (
                <div className="p-2 bg-primary/20 rounded-full">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
              )}
              <div>
                <h2 className="font-semibold text-lg">
                  {isAllComplete ? 'Setup Complete! 🎉' : 'Your Progress'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isAllComplete 
                    ? "You're ready to start growing your business!"
                    : `${completionPercentage}% complete`
                  }
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {completionPercentage}%
            </Badge>
          </div>
          <Progress value={completionPercentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <div className="space-y-4">
        {/* Step 1: Brand Colors */}
        <SetupStepCard
          icon={<Palette className="w-6 h-6" />}
          title="Confirm Your Brand Colors"
          description="Set your primary, secondary, and accent colors for consistent branding"
          helpText="Your brand colors will be used across all email campaigns, newsletters, and customer-facing content."
          completed={progress.colorsConfirmed}
          skipped={skippedSteps.includes('colors')}
          expanded={expandedStep === 'colors'}
          onToggle={() => toggleStep('colors')}
          onAction={() => navigate('/settings')}
          onSkip={() => skipStep('colors')}
          onUnskip={() => unskipStep('colors')}
          actionLabel="Set Up Colors"
        >
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-primary mx-auto mb-2" />
              <span className="text-xs text-muted-foreground">Primary</span>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-secondary mx-auto mb-2" />
              <span className="text-xs text-muted-foreground">Secondary</span>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-accent mx-auto mb-2" />
              <span className="text-xs text-muted-foreground">Accent</span>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-foreground mx-auto mb-2" />
              <span className="text-xs text-muted-foreground">Text</span>
            </div>
          </div>
        </SetupStepCard>

        {/* Step 2: Company Profile */}
        <SetupStepCard
          icon={<Building2 className="w-6 h-6" />}
          title="Complete Your Company Profile"
          description="Add your business details, brand voice, and target audience"
          helpText="A complete profile helps us generate better content tailored to your business and customers."
          completed={progress.companyProfileComplete}
          skipped={skippedSteps.includes('profile')}
          expanded={expandedStep === 'profile'}
          onToggle={() => toggleStep('profile')}
          onAction={() => navigate('/settings')}
          onSkip={() => skipStep('profile')}
          onUnskip={() => unskipStep('profile')}
          actionLabel="Edit Profile"
        />

        {/* Step 3: POS Integration */}
        <SetupStepCard
          icon={<Store className="w-6 h-6" />}
          title="Connect Your Point of Sale"
          description="Sync customers, orders, and purchase data from your POS system"
          helpText="Make sure your POS is collecting customer emails and phone numbers at checkout for best results!"
          completed={progress.posIntegrated}
          skipped={skippedSteps.includes('pos')}
          expanded={expandedStep === 'pos'}
          onToggle={() => toggleStep('pos')}
          onAction={() => navigate('/integrations/pos')}
          onSkip={() => skipStep('pos')}
          onUnskip={() => unskipStep('pos')}
          actionLabel="Connect POS"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-amber-800 mb-2">📋 Before you connect:</p>
            <ul className="text-amber-700 space-y-1 list-disc list-inside">
              <li>Ensure your POS is collecting customer <strong>email addresses</strong></li>
              <li>Enable <strong>phone number</strong> collection for SMS campaigns</li>
              <li>Review your customer opt-in settings for marketing consent</li>
            </ul>
          </div>
        </SetupStepCard>

        {/* Step 4: Import Clients */}
        <SetupStepCard
          icon={<Users className="w-6 h-6" />}
          title="Import Your Client List"
          description="Sync from a CRM partner or upload your existing customer list"
          helpText="The more customer data you import, the more personalized your marketing campaigns can be."
          completed={progress.clientListImported}
          skipped={skippedSteps.includes('clients')}
          expanded={expandedStep === 'clients'}
          onToggle={() => toggleStep('clients')}
          onAction={() => navigate('/integrations/crm')}
          onSkip={() => skipStep('clients')}
          onUnskip={() => unskipStep('clients')}
          actionLabel="Import Clients"
        >
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/integrations/crm')}
            >
              <span className="text-2xl">🔗</span>
              <span className="font-medium">Sync from CRM</span>
              <span className="text-xs text-muted-foreground">Mailchimp, Klaviyo, etc.</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/crm/customers')}
            >
              <span className="text-2xl">📤</span>
              <span className="font-medium">Upload CSV</span>
              <span className="text-xs text-muted-foreground">Import from file</span>
            </Button>
          </div>
        </SetupStepCard>

        {/* Step 5: Domain Setup */}
        <SetupStepCard
          icon={<Globe className="w-6 h-6" />}
          title="Set Up Your Email Domain"
          description="Configure your domain for better email deliverability"
          helpText="Sending from your own domain (like hello@yourbusiness.com) improves trust and deliverability."
          completed={progress.domainConfigured}
          skipped={skippedSteps.includes('domain')}
          expanded={expandedStep === 'domain'}
          onToggle={() => toggleStep('domain')}
          onAction={() => navigate('/domains')}
          onSkip={() => skipStep('domain')}
          onUnskip={() => unskipStep('domain')}
          actionLabel="Configure Domain"
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-blue-800 mb-2">✨ One-click setup with Entri</p>
            <p className="text-blue-700">
              We partner with Entri for automatic DNS configuration. 
              Just enter your domain and we'll handle the rest!
            </p>
          </div>
        </SetupStepCard>
      </div>

      {/* Bottom CTA */}
      {isAllComplete && (
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-foreground/20 rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">You're All Set! 🎉</h2>
            <p className="text-primary-foreground/80 mb-6">
              Your account is fully configured. Start creating amazing marketing campaigns!
            </p>
            <Button 
              variant="secondary" 
              size="lg"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Skip all option */}
      {!isAllComplete && (
        <div className="text-center pt-4">
          <Button 
            variant="ghost" 
            className="text-muted-foreground"
            onClick={() => navigate('/dashboard')}
          >
            Skip setup and go to dashboard
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AccountSetupPage;
