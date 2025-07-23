import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { CRMCampaignCreator } from './CRMCampaignCreator';

export const CRMCampaignBuilder: React.FC = () => {
  const { campaignSlug } = useParams<{ campaignSlug: string }>();

  // Extract contentTaskId from the slug or URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const contentTaskId = urlParams.get('contentTaskId');

  // If no slug provided, redirect to generic campaign creator
  if (!campaignSlug) {
    return <Navigate to="/crm/campaigns/new" replace />;
  }

  // Pass the slug and contentTaskId to the main creator component
  return <CRMCampaignCreator campaignSlug={campaignSlug} contentTaskId={contentTaskId} />;
};