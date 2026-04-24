import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export const CRMCampaignCreatorPage: React.FC = () => {
  const location = useLocation();

  return <Navigate replace to={`/crm/campaigns/new${location.search}`} />;
};
