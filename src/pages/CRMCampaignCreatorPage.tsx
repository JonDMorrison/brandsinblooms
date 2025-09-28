
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CRMCampaignCreator } from '@/components/crm/CRMCampaignCreator';

export const CRMCampaignCreatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // EMERGENCY: Force immediate console output
  console.error('🚨🚨🚨 CRMCampaignCreatorPage MOUNTED - URL:', window.location.href);
  console.error('🚨 CRMCampaignCreatorPage - searchParams:', searchParams.toString());
  
  // Extract campaign slug and content task ID from URL params
  const campaignSlug = searchParams.get('slug') || 'new';
  const contentTaskId = searchParams.get('contentTaskId') || undefined;
  
  console.error('🚨 CRMCampaignCreatorPage - campaignSlug:', campaignSlug);
  console.error('🚨 CRMCampaignCreatorPage - contentTaskId:', contentTaskId);
  
  return <CRMCampaignCreator campaignSlug={campaignSlug} contentTaskId={contentTaskId} />;
};
