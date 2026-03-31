import { Navigate, useLocation } from "react-router-dom";

import MigrationsPage from "@/pages/MigrationsPage";

export default function MigrationsRouteGate() {
  const location = useLocation();
  const provider = new URLSearchParams(location.search).get("provider");

  if (provider === "mailchimp") {
    return <Navigate to="/integrations/mailchimp" replace />;
  }

  return <MigrationsPage />;
}
