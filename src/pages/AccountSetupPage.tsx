import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { Progress } from '@/components/ui-legacy/progress';
import { Badge } from '@/components/ui-legacy/badge';
import {
  Palette,
  Building2,
  Store,
  Users,
  Globe,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Share2,
  BarChart3,
  MessageSquare,
  Mail,
  Send,
  Zap,
  Tags,
  Newspaper
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
    const names: Record<string, string> = {
      colors: 'Brand Colors',
      profile: 'Company Profile',
      pos: 'POS Integration',
      clients: 'Client Import',
      domain: 'Domain Setup',
      social: 'Social Media',
      analytics: 'Google Analytics',
      sms: 'SMS Setup',
      'first-email': 'First Email Campaign',
      'first-post': 'First Social Post',
      'first-automation': 'First Automation',
      segments: 'Customer Segments',
      newsletter: 'Newsletter',
    };
    return names[lastCompletedStep || ''] || '';
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
          tourStep="pos"
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
            <p className="font-medium text-blue-800 mb-2">One-click setup with Entri</p>
            <p className="text-blue-700">
              We partner with Entri for automatic DNS configuration.
              Just enter your domain and we'll handle the rest!
            </p>
          </div>
        </SetupStepCard>

        {/* Step 6: Social Media Connections */}
        <SetupStepCard
          icon={<Share2 className="w-6 h-6" />}
          title="Connect Social Media"
          description="Link your Facebook and Instagram accounts for one-click posting"
          helpText="Once connected, you can create and schedule posts directly from BloomSuite."
          completed={progress.socialConnected}
          skipped={skippedSteps.includes('social')}
          expanded={expandedStep === 'social'}
          onToggle={() => toggleStep('social')}
          onAction={() => navigate('/social-accounts')}
          onSkip={() => skipStep('social')}
          onUnskip={() => unskipStep('social')}
          actionLabel="Connect Accounts"
        />

        {/* Step 7: Google Analytics */}
        <SetupStepCard
          icon={<BarChart3 className="w-6 h-6" />}
          title="Connect Google Analytics"
          description="Track website traffic and campaign performance in one place"
          helpText="See which campaigns drive the most traffic and conversions to your website."
          completed={progress.googleAnalyticsConnected}
          skipped={skippedSteps.includes('analytics')}
          expanded={expandedStep === 'analytics'}
          onToggle={() => toggleStep('analytics')}
          onAction={() => navigate('/analytics')}
          onSkip={() => skipStep('analytics')}
          onUnskip={() => unskipStep('analytics')}
          actionLabel="Connect Analytics"
        />

        {/* Step 8: SMS/Twilio Setup */}
        <SetupStepCard
          icon={<MessageSquare className="w-6 h-6" />}
          title="Set Up SMS Messaging"
          description="Send text message campaigns and automated SMS sequences"
          helpText="SMS has 98% open rates — perfect for flash sales, event reminders, and time-sensitive offers."
          completed={progress.smsSetupComplete}
          skipped={skippedSteps.includes('sms')}
          expanded={expandedStep === 'sms'}
          onToggle={() => toggleStep('sms')}
          onAction={() => navigate('/sms')}
          onSkip={() => skipStep('sms')}
          onUnskip={() => unskipStep('sms')}
          actionLabel="Set Up SMS"
        />

        {/* Step 9: First Email Campaign */}
        <SetupStepCard
          icon={<Mail className="w-6 h-6" />}
          title="Send Your First Email Campaign"
          description="Create and send your first marketing email to customers"
          helpText="Start with a simple announcement or seasonal promotion to get familiar with the campaign builder."
          completed={progress.firstEmailCampaignSent}
          skipped={skippedSteps.includes('first-email')}
          expanded={expandedStep === 'first-email'}
          onToggle={() => toggleStep('first-email')}
          onAction={() => navigate('/newsletters/new')}
          onSkip={() => skipStep('first-email')}
          onUnskip={() => unskipStep('first-email')}
          actionLabel="Create Campaign"
        />

        {/* Step 10: First Social Post */}
        <SetupStepCard
          icon={<Send className="w-6 h-6" />}
          title="Publish Your First Social Post"
          description="Create and publish a post to your connected social accounts"
          helpText="Our AI will help you write engaging content tailored to your business and audience."
          completed={progress.firstSocialPostPublished}
          skipped={skippedSteps.includes('first-post')}
          expanded={expandedStep === 'first-post'}
          onToggle={() => toggleStep('first-post')}
          onAction={() => navigate('/publish')}
          onSkip={() => skipStep('first-post')}
          onUnskip={() => unskipStep('first-post')}
          actionLabel="Create Post"
        />

        {/* Step 11: First Automation */}
        <SetupStepCard
          icon={<Zap className="w-6 h-6" />}
          title="Create Your First Automation"
          description="Set up an automated welcome email or birthday campaign"
          helpText="Automations run 24/7 so you never miss an opportunity to engage customers."
          completed={progress.firstAutomationCreated}
          skipped={skippedSteps.includes('first-automation')}
          expanded={expandedStep === 'first-automation'}
          onToggle={() => toggleStep('first-automation')}
          onAction={() => navigate('/crm/automations/new')}
          onSkip={() => skipStep('first-automation')}
          onUnskip={() => unskipStep('first-automation')}
          actionLabel="Build Automation"
        />

        {/* Step 12: Customer Segments */}
        <SetupStepCard
          icon={<Tags className="w-6 h-6" />}
          title="Create Customer Segments"
          description="Group customers by behavior, purchase history, or demographics"
          helpText="Targeted campaigns to specific segments perform 3-5x better than mass emails."
          completed={progress.customerSegmentsCreated}
          skipped={skippedSteps.includes('segments')}
          expanded={expandedStep === 'segments'}
          onToggle={() => toggleStep('segments')}
          onAction={() => navigate('/crm/segments')}
          onSkip={() => skipStep('segments')}
          onUnskip={() => unskipStep('segments')}
          actionLabel="Create Segment"
        />

        {/* Step 13: Newsletter */}
        <SetupStepCard
          icon={<Newspaper className="w-6 h-6" />}
          title="Send Your First Newsletter"
          description="Design and send a professional newsletter to your subscriber list"
          helpText="Newsletters keep your brand top-of-mind and drive repeat visits to your garden center."
          completed={progress.newsletterTemplateSent}
          skipped={skippedSteps.includes('newsletter')}
          expanded={expandedStep === 'newsletter'}
          onToggle={() => toggleStep('newsletter')}
          onAction={() => navigate('/newsletters/new')}
          onSkip={() => skipStep('newsletter')}
          onUnskip={() => unskipStep('newsletter')}
          actionLabel="Create Newsletter"
        />
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
