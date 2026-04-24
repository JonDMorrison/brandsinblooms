import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

export const CRMCampaignBuilder: React.FC = () => {
  const location = useLocation();
  const { campaignId, campaignSlug } = useParams<{
    campaignId?: string;
    campaignSlug?: string;
  }>();

  const activeSlug = campaignId || campaignSlug;

  return (
    <Navigate
      replace
      to={
        activeSlug
          ? `/crm/campaigns/${activeSlug}${location.search}`
          : `/crm/campaigns/new${location.search}`
      }
    />
  );
};
