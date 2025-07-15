import React from 'react';
import { SubscriptionCard } from './SubscriptionCard';
import { UsageAnalytics } from './UsageAnalytics';
import { PaymentMethods } from './PaymentMethods';
import { BillingHistory } from './BillingHistory';

export const BillingDashboard = () => {
  return (
    <div className="space-y-8">
      {/* Top Row - Subscription Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SubscriptionCard />
        </div>
        <div>
          <PaymentMethods />
        </div>
      </div>

      {/* Middle Row - Usage Analytics */}
      <UsageAnalytics />

      {/* Bottom Row - Billing History */}
      <BillingHistory />
    </div>
  );
};