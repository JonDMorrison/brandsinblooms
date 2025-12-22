import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CustomerDashboardLayout } from '@/components/crm/customer-dashboard/CustomerDashboardLayout';
import { CustomerSnapshot } from '@/components/crm/customer-dashboard/CustomerSnapshot';
import { EngagementHealthOverview } from '@/components/crm/customer-dashboard/EngagementHealthOverview';
import { CustomerEventTimeline } from '@/components/crm/customer-dashboard/CustomerEventTimeline';
import { ChannelDeepDive } from '@/components/crm/customer-dashboard/ChannelDeepDive';
import { CrossChannelIntelligence } from '@/components/crm/customer-dashboard/CrossChannelIntelligence';
import { PurchaseValueBehavior } from '@/components/crm/customer-dashboard/PurchaseValueBehavior';
import { LoyaltyIncentivesImpact } from '@/components/crm/customer-dashboard/LoyaltyIncentivesImpact';
import { RiskNegativeSignals } from '@/components/crm/customer-dashboard/RiskNegativeSignals';
import { AIInsightsActions } from '@/components/crm/customer-dashboard/AIInsightsActions';
import { EditCustomerDialog } from '@/components/crm/customer-dashboard/EditCustomerDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCustomerDashboard } from '@/hooks/useCustomerDashboard';
import {
  transformToSnapshotMetrics,
  transformToCustomerBasicInfo,
  transformToEngagementMetrics,
  transformToEmailMetrics,
  transformToSmsMetrics,
  transformToCrossChannelMetrics,
  transformToPurchaseMetrics,
  transformToLoyaltyMetrics,
  transformToRiskMetrics,
  transformToRecentRiskEvents,
  transformToTimelineEvents,
} from '@/lib/customerDashboardTransformers';

const CustomerDashboardPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'lifetime'>('30d');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const {
    customer,
    crossChannelMetrics,
    purchaseMetrics,
    postPurchaseMetrics,
    loyaltyMetrics,
    lifecycleMetrics,
    contentIntentMetrics,
    riskSignals,
    negativeEvents,
    timelineEvents,
    engagementTimeline,
    purchaseTimeline,
    emailHeatmapData,
    smsHeatmapData,
    channelTrend,
    engagementDecay,
    aiInsights,
    isAILoading,
    isAIRegenerating,
    regenerateAIInsights,
    isLoading,
    isCustomerLoading,
    hasError,
    refetch,
  } = useCustomerDashboard(customerId);

  // Transform data for components
  const customerInfo = transformToCustomerBasicInfo(customer, lifecycleMetrics ?? null);
  const snapshotMetrics = transformToSnapshotMetrics(customer, lifecycleMetrics ?? null, contentIntentMetrics ?? null, crossChannelMetrics ?? null);
  const engagementMetrics = transformToEngagementMetrics(customer, crossChannelMetrics ?? null, lifecycleMetrics ?? null);
  const emailMetrics = transformToEmailMetrics(customer);
  const smsMetrics = transformToSmsMetrics(customer);
  const crossChannelDisplayMetrics = transformToCrossChannelMetrics(crossChannelMetrics ?? null, customer, loyaltyMetrics ?? null);
  const purchaseDisplayMetrics = transformToPurchaseMetrics(purchaseMetrics ?? null, postPurchaseMetrics ?? null);
  const loyaltyDisplayMetrics = transformToLoyaltyMetrics(loyaltyMetrics ?? null, purchaseMetrics ?? null);
  const riskDisplayMetrics = transformToRiskMetrics(riskSignals ?? null);
  const recentRiskEvents = transformToRecentRiskEvents(negativeEvents);
  const timelineDisplayEvents = transformToTimelineEvents(timelineEvents);

  // Loading state
  if (isCustomerLoading) {
    return (
      <CustomerDashboardLayout customerName="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </CustomerDashboardLayout>
    );
  }

  // Error state
  if (hasError || !customer) {
    return (
      <CustomerDashboardLayout customerName="Customer Not Found">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unable to load customer data</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {hasError 
              ? "There was an error loading the customer data. Please try again."
              : "The customer you're looking for could not be found."}
          </p>
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </CustomerDashboardLayout>
    );
  }

  const customerName = customerInfo?.name || customer.email.split('@')[0];

  return (
    <>
      <CustomerDashboardLayout
        customerName={customerName}
        customerId={customerId}
        selectedTimeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onEditCustomer={() => setIsEditDialogOpen(true)}
      >
        {/* 1. Customer Snapshot (Header) */}
        <CustomerSnapshot
          customer={{
            id: customer.id,
            name: customerName,
            email: customer.email,
            phone: customer.phone || undefined,
            lifecycle_stage: lifecycleMetrics?.lifecycle_stage || 'New',
            created_at: customer.created_at,
          }}
          metrics={snapshotMetrics}
        />

        {/* 2. Engagement Health Overview */}
        <EngagementHealthOverview
          metrics={engagementMetrics}
          timelineData={engagementTimeline.map(d => ({
            date: d.date,
            engagement: d.engagement,
          }))}
        />

        {/* 3. Customer Event Timeline (Hero) */}
        <CustomerEventTimeline
          events={timelineDisplayEvents}
          hasMore={timelineEvents.length >= 50}
        />

        {/* 4. Channel Deep Dive */}
        <ChannelDeepDive
          emailMetrics={emailMetrics}
          smsMetrics={smsMetrics}
          emailHeatmapData={emailHeatmapData}
          smsHeatmapData={smsHeatmapData}
        />

        {/* 5. Cross-Channel Intelligence */}
        <CrossChannelIntelligence
          metrics={crossChannelDisplayMetrics}
          channelTrend={channelTrend}
        />

        {/* 6. Purchase & Value Behavior */}
        <PurchaseValueBehavior
          metrics={purchaseDisplayMetrics}
          purchaseTimeline={purchaseTimeline}
        />

        {/* 7. Loyalty & Incentives Impact */}
        <LoyaltyIncentivesImpact
          metrics={loyaltyDisplayMetrics}
        />

        {/* 8. Risk & Negative Signals */}
        <RiskNegativeSignals
          metrics={riskDisplayMetrics}
          recentEvents={recentRiskEvents}
          engagementDecay={engagementDecay}
        />

        {/* 9. AI Insights & Next Best Actions */}
        <AIInsightsActions
          insights={aiInsights}
          loading={isAILoading}
          regenerating={isAIRegenerating}
          onRegenerate={regenerateAIInsights}
        />
      </CustomerDashboardLayout>

      {/* Edit Customer Dialog */}
      {customerId && (
        <EditCustomerDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          customerId={customerId}
          initialData={{
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            email_opt_in: customer.email_opt_in,
            sms_opt_in: customer.sms_opt_in,
          }}
          onSuccess={refetch}
        />
      )}
    </>
  );
};

export default CustomerDashboardPage;
