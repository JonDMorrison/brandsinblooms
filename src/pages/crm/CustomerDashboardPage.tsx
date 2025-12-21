import React from 'react';
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
import { useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

// Sample data for demonstration - in production, these would come from hooks
const sampleCustomer = {
  id: '1',
  name: 'Sarah Johnson',
  email: 'sarah.johnson@example.com',
  phone: '+1 555-123-4567',
  lifecycle_stage: 'At Risk',
  created_at: '2024-03-15',
};

const sampleMetrics = {
  engagementHealthScore: 42,
  engagementTrend: [65, 58, 52, 48, 42],
  intentScore: 78,
  intentLevel: 'warm',
  preferredChannel: 'sms',
  accountAgeDays: 280,
};

const sampleEvents = [
  { id: '1', type: 'opt_out' as const, timestamp: '2024-12-19', title: 'Opted out of SMS', description: 'After 3 messages with no engagement', impact: 'negative' as const },
  { id: '2', type: 'email_open' as const, timestamp: '2024-12-14', title: 'Opened "Summer Sale" email', description: 'Clicked 2 CTAs • Read for 45 seconds', impact: 'positive' as const },
  { id: '3', type: 'purchase' as const, timestamp: '2024-12-11', title: 'Purchase: $127.50', description: 'Premium Rose Bush (x2), Organic Fertilizer', impact: 'positive' as const },
  { id: '4', type: 'signup' as const, timestamp: '2024-03-15', title: 'Signup', description: 'Source: Facebook Ad • Campaign: Spring2024', impact: 'neutral' as const },
];

const CustomerDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [timeRange, setTimeRange] = React.useState<'7d' | '30d' | '90d' | 'lifetime'>('30d');
  const [loading] = React.useState(false);

  if (loading) {
    return (
      <CustomerDashboardLayout customerName="Loading...">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </CustomerDashboardLayout>
    );
  }

  return (
    <CustomerDashboardLayout
      customerName={sampleCustomer.name}
      customerId={id}
      selectedTimeRange={timeRange}
      onTimeRangeChange={setTimeRange}
    >
      {/* 1. Customer Snapshot (Header) */}
      <CustomerSnapshot
        customer={sampleCustomer}
        metrics={sampleMetrics}
      />

      {/* 2. Engagement Health Overview */}
      <EngagementHealthOverview
        metrics={{
          engagementScore: 42,
          engagementTrend: [65, 58, 52, 48, 42],
          daysSinceLastEngagement: 14,
          engagementVelocity: -12,
          emailInteractions7d: 3,
          smsInteractions7d: 1,
        }}
      />

      {/* 3. Customer Event Timeline (Hero) */}
      <CustomerEventTimeline
        events={sampleEvents}
        hasMore={true}
      />

      {/* 4. Channel Deep Dive */}
      <ChannelDeepDive
        emailMetrics={{
          sent: 45,
          delivered: 43,
          opened: 28,
          clicked: 12,
          converted: 3,
          openRate: 65,
          clickRate: 28,
          avgTimeToOpen: 138,
          isQuickOpener: true,
        }}
        smsMetrics={{
          sent: 18,
          delivered: 17,
          clicked: 8,
          replied: 3,
          deliveryRate: 94,
          clickRate: 47,
          replyRate: 18,
          avgTimeToResponse: 25,
        }}
      />

      {/* 5. Cross-Channel Intelligence */}
      <CrossChannelIntelligence
        metrics={{
          multiChannelScore: 72,
          emailEngagement: 45,
          smsEngagement: 78,
          loyaltyEngagement: 62,
          preferredChannel: 'sms',
          channelFatigueEmail: 80,
          channelFatigueSms: 30,
          daysSinceLastEmail: 14,
          daysSinceLastSms: 2,
          daysSinceLastLoyalty: 45,
        }}
      />

      {/* 6. Purchase & Value Behavior */}
      <PurchaseValueBehavior
        metrics={{
          totalPurchases: 23,
          totalRevenue: 1247,
          ltv: 1247,
          aov: 54,
          purchaseFrequency: 1.2,
          avgDaysBetweenPurchases: 21,
          repeatPurchaseRate: 78,
          fullPricePercentage: 60,
          discountedPercentage: 40,
          consecutiveDiscountPurchases: 4,
          firstPurchaseDate: '2024-04-02',
          lastPurchaseDate: '2024-12-11',
        }}
      />

      {/* 7. Loyalty & Incentives Impact */}
      <LoyaltyIncentivesImpact
        metrics={{
          isPerksEnrolled: true,
          currentTier: 'Gold',
          pointsEarned: 1250,
          pointsRedeemed: 800,
          pointsBalance: 450,
          avgRedemptionDelay: 12,
          perksRevenue: 524,
          totalRevenue: 1247,
          nextTier: 'Platinum',
          pointsToNextTier: 200,
        }}
      />

      {/* 8. Risk & Negative Signals */}
      <RiskNegativeSignals
        metrics={{
          overallRiskScore: 72,
          riskLevel: 'high',
          riskTrend: 'worsening',
          optOutRiskScore: 80,
          ignoreStreakRiskScore: 45,
          couponDependencyRiskScore: 85,
          bounceRiskScore: 20,
          riskFactors: [
            'Rapid opt-out (SMS) - 48 hours after signup',
            'Coupon-only purchasing (85% with discount)',
            'Message ignoring streak (5 consecutive)',
          ],
        }}
        recentEvents={[
          { id: '1', type: 'opt_out', timestamp: '2024-12-19', description: 'SMS Opt-Out (STOP keyword)' },
          { id: '2', type: 'ignoring', timestamp: '2024-12-14', description: 'Ignored email (no open after 72h)' },
        ]}
      />

      {/* 9. AI Insights & Next Best Actions */}
      <AIInsightsActions
        insights={[]}
        keyInsight="This customer's engagement dropped 40% after your Black Friday campaign ended. They appear discount-dependent and only engage when incentives are present."
        patterns={[
          'High intent on product pages (78 intent score)',
          'Responds better to SMS than email (2x click rate)',
          'Opens brand story content but ignores promotional emails',
          'Purchases peak in April-May (seasonal gardener)',
        ]}
      />
    </CustomerDashboardLayout>
  );
};

export default CustomerDashboardPage;
