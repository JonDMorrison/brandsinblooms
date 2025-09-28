
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CRMCampaignCreator } from '@/components/crm/CRMCampaignCreator';

export const CRMCampaignCreatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // Extract campaign slug and content task ID from URL params
  const campaignSlug = searchParams.get('slug') || 'new';
  const contentTaskId = searchParams.get('contentTaskId') || undefined;
  
  return <CRMCampaignCreator campaignSlug={campaignSlug} contentTaskId={contentTaskId} />;
};
