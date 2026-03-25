import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Webhook, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const automationIntegrations = [
  {
    name: "Zapier",
    description: "Connect to 6000+ apps with automated workflows",
    path: "/integrations/zapier",
    cta: "Open integration",
    icon: <Zap className="h-5 w-5 text-brand-navy" />,
    iconWrapClassName: "bg-brand-teal/10 text-brand-navy",
  },
  {
    name: "Custom Webhooks",
    description: "Create custom webhook endpoints for any integration",
    path: "/integrations/custom-webhooks",
    cta: "Open integration",
    icon: <Webhook className="h-5 w-5 text-brand-navy" />,
    iconWrapClassName: "bg-brand-teal/10 text-brand-navy",
  },
  {
    name: "Slack",
    description: "Get notifications and manage content in Slack",
    path: "/integrations/slack",
    cta: "Open integration",
    icon: <Bell className="h-5 w-5 text-brand-navy" />,
    iconWrapClassName: "bg-brand-teal/10 text-brand-navy",
  },
];

export default function AutomationsIntegrationsPage() {
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
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-muted-foreground">
            Automate tasks and connect to thousands of apps
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {automationIntegrations.map((integration) => (
          <Card
            key={integration.name}
            className="rounded-2xl border border-border/70 bg-card shadow-sm transition-colors hover:border-brand-teal/40"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-xl p-2 ${integration.iconWrapClassName}`}
                >
                  {integration.icon}
                </div>
                <div>
                  <CardTitle className="text-base text-brand-navy">
                    {integration.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {integration.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to={integration.path}>{integration.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
