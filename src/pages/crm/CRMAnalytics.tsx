import React from 'react';
import { CampaignAnalyticsDashboard } from '@/components/crm/CampaignAnalyticsDashboard';
import { CRMAccessGate } from '@/components/crm/CRMAccessGate';

const CRMAnalytics: React.FC = () => {
  return (
    <CRMAccessGate>
      <div className="container mx-auto p-6 max-w-7xl">
        <CampaignAnalyticsDashboard />
      </div>
    </CRMAccessGate>
  );
};

export default CRMAnalytics;