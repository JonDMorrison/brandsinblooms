import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

export const CRMCampaignBuilderPage: React.FC = () => {
  const location = useLocation();
  const { campaignId } = useParams<{ campaignId: string }>();

  return (
    <Navigate
      replace
      to={
        campaignId
          ? `/crm/campaigns/${campaignId}${location.search}`
          : `/crm/campaigns/new${location.search}`
      }
    />
  );
};
