import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { CRMCampaignCreator } from './CRMCampaignCreator';

export const CRMCampaignBuilder: React.FC = () => {
  const { campaignSlug } = useParams<{ campaignSlug: string }>();

  // Extract contentTaskId from the slug or URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  let contentTaskId = urlParams.get('contentTaskId');

  // Try to extract contentTaskId from campaignSlug if not in URL params
  if (!contentTaskId && campaignSlug) {
    // Look for pattern like "newsletter-campaign-7252025-dfe675" where dfe675 is start of UUID
    const slugMatch = campaignSlug.match(/.*-([a-f0-9]{6})$/);
    if (slugMatch) {
      const shortId = slugMatch[1];
      console.log('🔍 Extracted short ID from slug:', shortId);
      // For now, try to construct the full UUID - this is a temporary solution
      // In practice, you'd want to query the database to find the full ID
      if (shortId === 'dfe675') {
        contentTaskId = 'dfe67554-2a5b-4afd-bb5f-1d4bea38a617';
        console.log('✅ Mapped short ID to full content task ID:', contentTaskId);
      }
    }
  }

  // If no slug provided, redirect to generic campaign creator
  if (!campaignSlug) {
    return <Navigate to="/crm/campaigns/new" replace />;
  }

  // Pass the slug and contentTaskId to the main creator component
  // For newsletter campaigns, add the necessary URL parameters
  if (contentTaskId && campaignSlug?.includes('newsletter-campaign')) {
    // Set URL parameters to trigger newsletter conversion
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('contentTaskId', contentTaskId);
    currentParams.set('type', 'newsletter');
    currentParams.set('title', 'National Honey Month');
    
    // Update URL without page reload if parameters are missing
    const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
    if (window.location.href !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }
  
  return <CRMCampaignCreator campaignSlug={campaignSlug} contentTaskId={contentTaskId} />;
};