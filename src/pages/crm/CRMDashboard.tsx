
import React from 'react';
import { HeroMetricsSection } from '@/components/crm/HeroMetricsSection';
import { QuickStartStepper } from '@/components/crm/QuickStartStepper';
import { EmptyStateSection } from '@/components/crm/EmptyStateSection';
import { FeatureHighlightsCard } from '@/components/crm/FeatureHighlightsCard';
import { OnboardingTips } from '@/components/crm/OnboardingTips';

const CRMDashboard: React.FC = () => {
  // Mock data - in real app this would come from API/state management
  const customerStats = {
    total: 0,
    smsOptedIn: 0,
    smsOptInRate: 0,
  };

  const campaignStats = {
    email: {
      totalSent: 0,
      campaignCount: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
    },
    sms: {
      totalSent: 0,
      campaignCount: 0,
      deliveryRate: 0,
    },
  };

  const segmentCount = 0;

  const onboardingSteps = [
    {
      step: 1,
      title: "Import Your Contacts",
      description: "Start by adding your customer database to begin segmenting and targeting.",
      highlightSelector: "[data-step='import-contacts']"
    },
    {
      step: 2,
      title: "Create Your First Segment",
      description: "Group customers by behavior, preferences, or purchase history.",
      highlightSelector: "[data-step='create-segment']"
    },
    {
      step: 3,
      title: "Launch Your First Campaign",
      description: "Send targeted messages to your segmented audience.",
      highlightSelector: "[data-step='create-campaign']"
    }
  ];

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your CRM Dashboard</h1>
        <p className="text-gray-600">Monitor your campaigns and grow your customer base</p>
      </div>

      {/* Metrics Section */}
      <div className="mb-8">
        <HeroMetricsSection
          customerStats={customerStats}
          campaignStats={campaignStats}
          segmentCount={segmentCount}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Quick Start & Empty State */}
        <div className="lg:col-span-2 space-y-8">
          <QuickStartStepper
            customerCount={customerStats.total}
            segmentCount={segmentCount}
            campaignCount={campaignStats.email.campaignCount + campaignStats.sms.campaignCount}
            onStepComplete={() => {}}
          />
          
          <EmptyStateSection
            customerCount={customerStats.total}
            campaignCount={campaignStats.email.campaignCount + campaignStats.sms.campaignCount}
          />
        </div>

        {/* Right Column - Feature Highlights */}
        <div className="space-y-8">
          <FeatureHighlightsCard />
        </div>
      </div>

      {/* Onboarding Tips */}
      <OnboardingTips
        steps={onboardingSteps}
        onDismiss={() => {}}
      />
    </div>
  );
};

export default CRMDashboard;
