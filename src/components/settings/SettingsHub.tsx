import React, { useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Building2,
  Link2,
  CreditCard,
  Shield,
  HelpCircle,
  Store,
  Plug2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Globe,
  Bug,
} from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";

// Import existing components
import { ConnectionsSettings } from "./ConnectionsSettings";
import { AccountBillingSettings } from "./AccountBillingSettings";
import { ComplianceSettings } from "./ComplianceSettings";
import { SupportSettings } from "./SupportSettings";
import { POSSetupWizard } from "@/components/crm/pos/POSSetupWizard";

// Import hooks for status checking
import { usePOSConnection } from "@/hooks/usePOSConnection";
import { useConnectedAccounts } from "@/components/dashboard/ConnectedAccountChecker";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";
import { useDomains } from "@/hooks/useDomains";
import { Link, useSearchParams } from "react-router-dom";

export const SettingsHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("connections");
  const [showPOSWizard, setShowPOSWizard] = useState(false);

  // Sync activeTab with URL parameters
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const validTabs = [
      "connections",
      "account",
      "compliance",
      "debug",
      "support",
    ];

    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
  };

  // Status hooks
  const { hasPOSConnection, loading: posLoading } = usePOSConnection();
  const { data: socialConnections = [], isLoading: socialLoading } =
    useConnectedAccounts();
  const { senderConfig, loading: senderLoading } = useSenderConfiguration();
  const { domains, emailSenders, loading: domainsLoading } = useDomains();

  // Calculate domain/email status
  const activeDomains = domains.filter((d) => d.status === "active");
  const verifiedSenders = emailSenders.filter((s) => s.verified);
  const hasDomainSetup = activeDomains.length > 0 || verifiedSenders.length > 0;

  const renderConnectionsStatusChip = () => {
    if (posLoading || socialLoading) {
      return null;
    }

    const totalConnections =
      (hasPOSConnection ? 1 : 0) + socialConnections.length;

    if (totalConnections === 0) {
      return (
        <JoyChip color="warning" variant="soft" size="sm">
          Setup required
        </JoyChip>
      );
    }

    return (
      <JoyChip color="success" variant="soft" size="sm">
        {totalConnections} connected
      </JoyChip>
    );
  };

  const settingsTabs = [
    {
      id: "connections",
      label: "Connections",
      icon: Link2,
      description: "POS systems, social media, and third-party integrations",
      badge: renderConnectionsStatusChip(),
    },
    {
      id: "account",
      label: "Account & Billing",
      icon: CreditCard,
      description: "Subscription, usage, and billing information",
    },
    {
      id: "compliance",
      label: "Compliance & Privacy",
      icon: Shield,
      description: "SMS settings, quiet hours, and data retention",
    },
    {
      id: "debug",
      label: "Debug",
      icon: Bug,
      description: "Error monitoring and debugging tools",
    },
    {
      id: "support",
      label: "Support",
      icon: HelpCircle,
      description: "Help center, documentation, and contact support",
    },
  ];

  const handlePOSCardClick = () => {
    if (!hasPOSConnection) {
      setShowPOSWizard(true);
    } else {
      setActiveTab("connections");
    }
  };

  const statusCards = [
    {
      title: "POS System",
      icon: Store,
      action: handlePOSCardClick,
      chip: posLoading ? (
        <JoyChip color="neutral" variant="soft">
          Checking...
        </JoyChip>
      ) : hasPOSConnection ? (
        <JoyChip color="success" variant="soft">
          Connected
        </JoyChip>
      ) : (
        <JoyChip color="warning" variant="soft">
          Setup required
        </JoyChip>
      ),
    },
    {
      title: "Social Media",
      icon: Plug2,
      chip: socialLoading ? (
        <JoyChip color="neutral" variant="soft">
          Checking...
        </JoyChip>
      ) : socialConnections.length > 0 ? (
        <JoyChip color="success" variant="soft">
          {socialConnections.length} connected
        </JoyChip>
      ) : (
        <JoyChip color="warning" variant="soft">
          Setup required
        </JoyChip>
      ),
    },
    {
      title: "Domains & Email",
      icon: Globe,
      to: "/domains",
      chip: domainsLoading ? (
        <JoyChip color="neutral" variant="soft">
          Checking...
        </JoyChip>
      ) : hasDomainSetup ? (
        <JoyChip color="success" variant="soft">
          Configured
        </JoyChip>
      ) : (
        <JoyChip color="warning" variant="soft">
          Setup required
        </JoyChip>
      ),
    },
    {
      title: "Legacy Email",
      icon: Settings,
      to: "/crm/settings/email-auth",
      chip: senderLoading ? (
        <JoyChip color="neutral" variant="soft">
          Checking...
        </JoyChip>
      ) : senderConfig?.isVerified ? (
        <JoyChip color="success" variant="soft">
          Domain verified
        </JoyChip>
      ) : (
        <JoyChip color="warning" variant="soft">
          Setup required
        </JoyChip>
      ),
    },
  ];

  return (
    <Stack spacing={3.5}>
      <JoyCard>
        <JoyCardHeader
          title="Settings"
          description="Manage connections, billing, compliance, and support from one tenant-facing Joy workspace."
          startDecorator={
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "16px",
                display: "grid",
                placeItems: "center",
                backgroundColor: "primary.50",
                color: "primary.700",
              }}
            >
              <Settings className="h-5 w-5" />
            </Box>
          }
        />
        <JoyCardContent>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {statusCards.map((card) => {
              const Icon = card.icon;
              const content = (
                <JoyCard
                  interactive={Boolean(card.action || card.to)}
                  onClick={card.action}
                  sx={{ height: "100%" }}
                >
                  <JoyCardContent sx={{ pt: 3 }}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        spacing={1.25}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: "14px",
                              display: "grid",
                              placeItems: "center",
                              backgroundColor: "neutral.100",
                              color: "brandNavy.700",
                            }}
                          >
                            <Icon className="h-4 w-4" />
                          </Box>
                          <Typography level="title-sm">{card.title}</Typography>
                        </Stack>
                      </Stack>
                      <Box>{card.chip}</Box>
                    </Stack>
                  </JoyCardContent>
                </JoyCard>
              );

              if (card.to) {
                return (
                  <Box
                    key={card.title}
                    component={Link}
                    to={card.to}
                    sx={{ textDecoration: "none" }}
                  >
                    {content}
                  </Box>
                );
              }

              return <Box key={card.title}>{content}</Box>;
            })}
          </Box>
        </JoyCardContent>
      </JoyCard>

      <JoyTabs
        value={activeTab}
        onValueChange={(value) => handleTabChange(String(value))}
      >
        <JoyTabsList
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "repeat(5, minmax(0, 1fr))",
            },
          }}
        >
          {settingsTabs.map((tab) => (
            <JoyTabsTrigger key={tab.id} value={tab.id}>
              <Stack
                spacing={0.5}
                alignItems="center"
                sx={{ textAlign: "center" }}
              >
                <tab.icon className="h-4 w-4" />
                <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                  {tab.label}
                </Typography>
                {tab.badge ? <Box>{tab.badge}</Box> : null}
              </Stack>
            </JoyTabsTrigger>
          ))}
        </JoyTabsList>

        <JoyTabsContent value="connections">
          <ConnectionsSettings />
        </JoyTabsContent>

        <JoyTabsContent value="account">
          <AccountBillingSettings />
        </JoyTabsContent>

        <JoyTabsContent value="compliance">
          <ComplianceSettings onUpdate={() => {}} />
        </JoyTabsContent>

        <JoyTabsContent value="debug">
          <JoyCard>
            <JoyCardHeader
              title="Debug Tools"
              description="Dedicated debug tools have been removed from the tenant dashboard."
            />
            <JoyCardContent>
              <Typography level="body-sm" color="neutral">
                Use browser developer tools and existing server logs when you
                need to inspect runtime issues.
              </Typography>
            </JoyCardContent>
          </JoyCard>
        </JoyTabsContent>

        <JoyTabsContent value="support">
          <SupportSettings />
        </JoyTabsContent>
      </JoyTabs>

      {showPOSWizard && (
        <POSSetupWizard
          platform="shopify"
          onSuccess={() => {
            setShowPOSWizard(false);
            setActiveTab("connections");
          }}
          onCancel={() => setShowPOSWizard(false)}
        />
      )}
    </Stack>
  );
};
