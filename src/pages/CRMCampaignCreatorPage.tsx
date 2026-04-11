import React from "react";
import { useSearchParams } from "react-router-dom";
import { CRMCampaignCreator } from "@/components/crm/CRMCampaignCreator";

export const CRMCampaignCreatorPage: React.FC = () => {
  // The CRMCampaignCreator component will handle prefill data directly from URL params
  // No need for localStorage handling in the page component anymore

  // Extract campaign slug and content task ID from URL params
  const campaignSlug = searchParams.get("slug") || "new";
  const contentTaskId = searchParams.get("contentTaskId") || undefined;

  return (
    <CRMCampaignCreator
      campaignSlug={campaignSlug}
      contentTaskId={contentTaskId}
    />
  );
};
