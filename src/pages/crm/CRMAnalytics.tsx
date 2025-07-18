
import React from 'react';
import { CampaignAnalyticsDashboard } from '@/components/crm/CampaignAnalyticsDashboard';
import { CRMAccessGate } from '@/components/crm/CRMAccessGate';

const CRMAnalytics: React.FC = () => {
  return (
    <CRMAccessGate>
      <div className="py-6">
        <CampaignAnalyticsDashboard />
      </div>
    </CRMAccessGate>
  );
};

export default CRMAnalytics;
