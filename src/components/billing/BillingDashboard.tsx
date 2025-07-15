import React from 'react';
import { SubscriptionCard } from './SubscriptionCard';
import { UsageAnalytics } from './UsageAnalytics';
import { PaymentMethods } from './PaymentMethods';
import { BillingHistory } from './BillingHistory';

export const BillingDashboard = () => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Section - Subscription Status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          <SubscriptionCard />
        </div>
        <div className="space-y-6">
          <PaymentMethods />
        </div>
      </div>


      {/* History Section */}
      <BillingHistory />
    </div>
  );
};