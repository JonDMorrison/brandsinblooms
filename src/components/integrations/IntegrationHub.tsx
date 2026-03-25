import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Zap,
  Plus,
  Settings,
  Webhook,
  Mail,
  Users,
  BarChart3,
  Smartphone,
  Check,
  AlertCircle,
  Facebook,
  Instagram,
  Store,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { GoogleAnalyticsConnection } from "./GoogleAnalyticsConnection";
import { LightspeedIntegration } from "./LightspeedIntegration";
import { LightspeedDebug } from "./LightspeedDebug";
import { SquareIntegration } from "./SquareIntegration";
import { useQuery } from "@tanstack/react-query";
import { MigrationStatusIndicator } from "@/components/migrations/MigrationStatusIndicator";
import { IntegrationSection } from "./IntegrationSection";
import { IntegrationCard } from "./IntegrationCard";
import { FeaturedCard } from "./FeaturedCard";

const APP_ORIGIN = window.location.origin;

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "social" | "automation" | "email" | "crm" | "analytics";
  icon: React.ReactNode;
  isConnected: boolean;
  provider: string;
  setupUrl?: string;
  webhookUrl?: string;
  apiKey?: string;
  isActive: boolean;
}

interface UserIntegration {
  id: string;
  user_id: string;
  integration_type: string;
  provider: string;
  configuration: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const IntegrationHub = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("marketplace");
  const [providerConnections, setProviderConnections] = useState<any[]>([]);
  const oauthPopupRef = useRef<Window | null>(null);

  // Check for Lightspeed connection status
  const { data: lightspeedConnection } = useQuery({
    queryKey: ["lightspeed-connection-status"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data: userRecord } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userData.user.id)
        .single();

      if (!userRecord?.tenant_id) return null;

      const { data, error } = await supabase
        .from("lightspeed_connections")
        .select("*")
        .eq("tenant_id", userRecord.tenant_id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const hasValidLightspeedConnection =
    lightspeedConnection &&
    lightspeedConnection.encrypted_access_token !== "pending";

  // Available integrations marketplace
  const availableIntegrations: Integration[] = [
    {
      id: "facebook",
      name: "Facebook",
      description: "Publish posts and manage your Facebook Pages",
      category: "social",
      icon: <Facebook className="w-6 h-6 text-blue-600" />,
      isConnected: false,
      provider: "facebook",
      setupUrl: "/social-accounts",
      isActive: true,
    },
    {
      id: "instagram",
      name: "Instagram",
      description:
        "Share photos and stories to your Instagram Business account",
      category: "social",
      icon: <Instagram className="w-6 h-6 text-pink-600" />,
      isConnected: false,
      provider: "instagram",
      setupUrl: "/social-accounts",
      isActive: true,
    },
    {
      id: "zapier",
      name: "Zapier",
      description: "Connect to 6000+ apps with automated workflows",
      category: "automation",
      icon: <Zap className="w-6 h-6 text-orange-600" />,
      isConnected: false,
      provider: "zapier",
      setupUrl: "/integrations/zapier",
      isActive: true,
    },
    {
      id: "mailchimp",
      name: "Mailchimp",
      description: "Sync leads and send targeted email campaigns",
      category: "email",
      icon: <Mail className="w-6 h-6 text-yellow-600" />,
      isConnected: false,
      provider: "mailchimp",
      isActive: true,
    },
    {
      id: "hubspot",
      name: "HubSpot",
      description: "Sync contacts and track lead engagement",
      category: "crm",
      icon: <Users className="w-6 h-6 text-orange-500" />,
      isConnected: false,
      provider: "hubspot",
      isActive: true,
    },
    {
      id: "google_analytics",
      name: "Google Analytics",
      description: "Track website traffic from social media",
      category: "analytics",
      icon: <BarChart3 className="w-6 h-6 text-blue-600" />,
      isConnected: false,
      provider: "google",
      isActive: true,
    },
    {
      id: "webhook_custom",
      name: "Custom Webhooks",
      description: "Create custom webhook endpoints for any integration",
      category: "automation",
      icon: <Webhook className="w-6 h-6 text-purple-600" />,
      isConnected: false,
      provider: "custom",
      isActive: true,
    },
    {
      id: "slack",
      name: "Slack",
      description: "Get notifications and manage content in Slack",
      category: "automation",
      icon: <Smartphone className="w-6 h-6 text-purple-500" />,
      isConnected: false,
      provider: "slack",
      isActive: true,
    },
  ];

  const fetchProviderConnections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("provider_connections")
        .select("*")
        .eq("status", "connected");

      if (error) throw error;
      setProviderConnections(data || []);
    } catch (error) {
      console.error("Error fetching provider connections:", error);
    }
  };

  const fetchUserIntegrations = async () => {
    if (!user) return;

    try {
      await fetchProviderConnections();
      setUserIntegrations([]);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMailchimp = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "oauth-authorize",
        {
          body: { provider: "mailchimp" },
        },
      );

      if (error) throw error;

      const { authUrl } = data;
      const popup = window.open(authUrl, "oauth", "width=600,height=700");
      oauthPopupRef.current = popup;
    } catch (error: any) {
      console.error("Error initiating Mailchimp OAuth:", error);
      toast({
        title: "Connection Failed",
        description: getUserFacingIntegrationError(
          error,
          "Failed to connect to Mailchimp",
        ),
        variant: "destructive",
      });
    }
  };

  const handleConnectIntegration = async (integration: Integration) => {
    if (integration.provider === "mailchimp") {
      await handleConnectMailchimp();
    } else if (integration.setupUrl) {
      window.location.href = integration.setupUrl;
    } else {
      toast({
        title: "Coming Soon",
        description: `${integration.name} integration coming soon!`,
      });
    }
  };

  const handleDisconnectIntegration = async (integrationId: string) => {
    toast({
      title: "Coming Soon",
      description:
        "Integrations will be available once database setup is complete",
    });
  };

  const getConnectionStatus = (providerId: string) => {
    const providerConnection = providerConnections.find(
      (conn) => conn.provider === providerId,
    );
    if (providerConnection) return providerConnection;

    return userIntegrations.find(
      (int) => int.provider === providerId && int.is_active,
    );
  };

  useEffect(() => {
    fetchUserIntegrations();
  }, [user]);

  useEffect(() => {
    const handleOAuthMessage = (e: MessageEvent) => {
      if (e.origin !== APP_ORIGIN) return;

      if (e.data.type === "oauth-success") {
        toast({
          title: "Connected!",
          description: `Successfully connected to ${e.data.provider}`,
        });
        fetchProviderConnections();
      } else if (e.data.type === "oauth-error") {
        toast({
          title: "Connection Failed",
          description: getUserFacingIntegrationError(
            e.data.message,
            "Failed to connect",
          ),
          variant: "destructive",
        });
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [toast]);

  const getIntegrationsByCategory = (category: string) => {
    return availableIntegrations.filter((int) => int.category === category);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
        <div className="h-64 bg-muted animate-pulse rounded-lg"></div>
      </div>
    );
  }

  const connectedCount = userIntegrations.filter((int) => int.is_active).length;

  const renderIntegrationCard = (integration: Integration) => {
    const connection = getConnectionStatus(integration.provider);
    const isConnected = !!connection;

    return (
      <IntegrationCard
        key={integration.id}
        title={integration.name}
        description={integration.description}
        icon={integration.icon}
        isConnected={isConnected}
      >
        <Button
          size="sm"
          onClick={() => handleConnectIntegration(integration)}
          className="w-full"
          variant={isConnected ? "outline" : "default"}
        >
          {isConnected ? (
            <>
              <Settings className="w-4 h-4 mr-2" />
              Manage
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </>
          )}
        </Button>
      </IntegrationCard>
    );
  };

  return (
    <div className="space-y-8">
      {/* Global Migration Status Indicator */}
      <MigrationStatusIndicator />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your tools to sync data, automate workflows, and grow your
            business
          </p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            {connectedCount} Active
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {availableIntegrations.length} Available
          </Badge>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="marketplace">All Integrations</TabsTrigger>
          <TabsTrigger value="connected">My Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-8">
          {/* Featured Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Featured</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeaturedCard
                title="Data Migration Tool"
                description="One-time import from Mailchimp or Klaviyo with AI-powered mapping"
                icon={<Download className="w-6 h-6 text-primary" />}
                badge={{ label: "New" }}
                features={[
                  "✓ Contacts & Consent",
                  "✓ Tags & Segments",
                  "✓ AI Auto-Mapping",
                  "✓ Reconciliation Report",
                ]}
              >
                <Button
                  onClick={() =>
                    (window.location.href = "/integrations/migrations")
                  }
                  className="mt-2"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Start Migration
                </Button>
              </FeaturedCard>

              <FeaturedCard
                title="Point of Sale Overview"
                description="Connect your POS to sync customers, orders, and purchase data in real-time"
                icon={<Store className="w-6 h-6 text-primary" />}
                badge={{ label: "Popular", className: "bg-green-600" }}
                features={[
                  "✓ Customer Sync",
                  "✓ Order History",
                  "✓ Purchase Data",
                  "✓ Real-time Updates",
                ]}
              >
                <Button
                  onClick={() => (window.location.href = "/crm/pos")}
                  className="mt-2"
                >
                  <Store className="w-4 h-4 mr-2" />
                  Browse POS Options
                </Button>
              </FeaturedCard>
            </div>
          </section>

          {/* Point of Sale Section */}
          <IntegrationSection
            title="Point of Sale"
            description="Connect your POS systems to sync customer and sales data"
            icon={<Store className="w-5 h-5" />}
          >
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LightspeedIntegration />
              <SquareIntegration />
            </div>
            {/* Lightspeed Debug Tools - Only show when not connected */}
            {!hasValidLightspeedConnection && (
              <div className="col-span-full">
                <LightspeedDebug />
              </div>
            )}
          </IntegrationSection>

          {/* Marketing & CRM Section */}
          <IntegrationSection
            title="Marketing & CRM"
            description="Sync contacts and manage your marketing tools"
            icon={<Users className="w-5 h-5" />}
          >
            {renderIntegrationCard(
              availableIntegrations.find((i) => i.id === "mailchimp")!,
            )}
            {renderIntegrationCard(
              availableIntegrations.find((i) => i.id === "hubspot")!,
            )}
          </IntegrationSection>

          {/* Social Media Section */}
          <IntegrationSection
            title="Social Media"
            description="Connect your social accounts to publish and manage content"
            icon={<Smartphone className="w-5 h-5" />}
          >
            {getIntegrationsByCategory("social").map(renderIntegrationCard)}
          </IntegrationSection>

          {/* Analytics & Tracking Section */}
          <IntegrationSection
            title="Analytics & Tracking"
            description="Track performance and measure your marketing impact"
            icon={<BarChart3 className="w-5 h-5" />}
          >
            <GoogleAnalyticsConnection />
          </IntegrationSection>

          {/* Automation & Workflows Section */}
          <IntegrationSection
            title="Automation & Workflows"
            description="Automate tasks and connect to thousands of apps"
            icon={<Zap className="w-5 h-5" />}
          >
            {getIntegrationsByCategory("automation").map(renderIntegrationCard)}
          </IntegrationSection>
        </TabsContent>

        <TabsContent value="connected" className="space-y-6">
          {userIntegrations.filter((int) => int.is_active).length === 0 ? (
            <Card className="bg-card border border-border">
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No Connected Integrations
                </h3>
                <p className="text-muted-foreground mb-4">
                  Connect your first integration to start automating your
                  workflow
                </p>
                <Button onClick={() => setActiveTab("marketplace")}>
                  Browse Integrations
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* POS Connections */}
              <section className="space-y-3">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Point of Sale
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Would show connected POS integrations here */}
                </div>
              </section>

              {/* Other connected integrations */}
              <section className="space-y-3">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Other Integrations
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {userIntegrations
                    .filter((int) => int.is_active)
                    .map((integration) => (
                      <Card
                        key={integration.id}
                        className="bg-card border border-border"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <h3 className="font-medium capitalize">
                                  {integration.provider} Integration
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Connected on{" "}
                                  {new Date(
                                    integration.created_at,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleDisconnectIntegration(integration.id)
                                }
                              >
                                Disconnect
                              </Button>
                              <Button size="sm" variant="outline">
                                <Settings className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Webhook className="w-5 h-5" />
                <h3 className="font-semibold">Custom Webhooks</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Create custom webhook endpoints to integrate with any external
                service. Coming soon!
              </p>
              <Button disabled>
                <Plus className="w-4 h-4 mr-2" />
                Create Webhook
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
