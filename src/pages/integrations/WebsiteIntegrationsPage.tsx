import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Globe } from "lucide-react";
import { GoogleAnalyticsCard } from "@/components/analytics/GoogleAnalyticsCard";
import { GoogleAnalyticsConnection } from "@/components/integrations/GoogleAnalyticsConnection";
import { useGASettings } from "@/hooks/useGASettings";

export default function WebsiteIntegrationsPage() {
  const { propertyId } = useGASettings();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link
        to="/integrations"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          <Globe className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Website</h1>
          <p className="text-muted-foreground">
            Track traffic and measure your marketing impact
          </p>
        </div>
      </div>

      <div className="max-w-md">
        <GoogleAnalyticsConnection />
      </div>

      <GoogleAnalyticsCard propertyId={propertyId} />
    </div>
  );
}
