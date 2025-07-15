
import React from 'react';
import { BillingDashboard } from '@/components/billing/BillingDashboard';

const BillingPage = () => {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and handle billing details.
        </p>
      </div>

      {/* Main Dashboard */}
      <BillingDashboard />
    </div>
  );
};

export default BillingPage;
