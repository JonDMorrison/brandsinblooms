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
      // Map known content task IDs based on short ID
      const contentTaskMappings: Record<string, string> = {
        'dfe675': 'dfe67554-2a5b-4afd-bb5f-1d4bea38a617', // National Honey Month
        '01408f': '01408f9b-292e-4dc4-ae85-250a93d76478', // Hydrangea Focus Week
      };
      
      if (contentTaskMappings[shortId]) {
        contentTaskId = contentTaskMappings[shortId];
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
    if (!currentParams.get('contentTaskId')) {
      currentParams.set('contentTaskId', contentTaskId);
    }
    if (!currentParams.get('type')) {
      currentParams.set('type', 'newsletter');
    }
    
    // Update URL without page reload if parameters are missing
    const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
    if (window.location.href !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }
  
  return <CRMCampaignCreator campaignSlug={campaignSlug} contentTaskId={contentTaskId} />;
};