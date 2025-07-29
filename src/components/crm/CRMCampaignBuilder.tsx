import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { CRMCampaignCreator } from './CRMCampaignCreator';

export const CRMCampaignBuilder: React.FC = () => {
  const { campaignId, campaignSlug } = useParams<{ campaignId?: string; campaignSlug?: string }>();

  // Use campaignId from route or campaignSlug if available
  const activeSlug = campaignId || campaignSlug;
  
  // Check if activeSlug is a valid UUID (existing campaign ID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isExistingCampaign = activeSlug && uuidRegex.test(activeSlug);

  // Extract contentTaskId from URL parameters for new campaigns
  const urlParams = new URLSearchParams(window.location.search);
  let contentTaskId = urlParams.get('contentTaskId');

  // Try to extract contentTaskId from activeSlug if not in URL params (for new campaigns only)
  if (!contentTaskId && activeSlug && !isExistingCampaign) {
    // Look for pattern like "newsletter-campaign-7252025-dfe675" where dfe675 is start of UUID
    const slugMatch = activeSlug.match(/.*-([a-f0-9]{6})$/);
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
  if (!activeSlug) {
    return <Navigate to="/crm/campaigns/new" replace />;
  }

  // Handle existing campaign editing (UUID as slug)
  if (isExistingCampaign) {
    console.log('🔄 Loading existing campaign for editing:', activeSlug);
    return <CRMCampaignCreator campaignSlug={activeSlug} contentTaskId={null} />;
  }

  // Handle new campaign creation from content task
  // For newsletter campaigns, add the necessary URL parameters
  if (contentTaskId && activeSlug?.includes('newsletter-campaign')) {
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
  
  return <CRMCampaignCreator campaignSlug={activeSlug} contentTaskId={contentTaskId} />;
};