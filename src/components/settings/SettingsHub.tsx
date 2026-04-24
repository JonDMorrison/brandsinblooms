import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import {
  Bug,
  CreditCard,
  HelpCircle,
  Settings,
  Globe,
  Link2,
  Shield,
  Store,
} from "lucide-react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { ConnectionsSettings } from "./ConnectionsSettings";
import { AccountBillingSettings } from "./AccountBillingSettings";
import { ComplianceSettings } from "./ComplianceSettings";
import { SupportSettings } from "./SupportSettings";
import { POSSetupWizard } from "@/components/crm/pos/POSSetupWizard";
import { usePOSConnection } from "@/hooks/usePOSConnection";
import { useConnectedAccounts } from "@/components/dashboard/ConnectedAccountChecker";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";
import { useDomains } from "@/hooks/useDomains";
import { SettingsInlineError } from "./SettingsSurface";

type SettingsTabId = "connections" | "account" | "compliance" | "support";

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "connections", label: "Connections" },
  { id: "account", label: "Account & Billing" },
  { id: "compliance", label: "Compliance & Privacy" },
  { id: "support", label: "Support" },
];

const validTabs = new Set<SettingsTabId>(
  SETTINGS_TABS.map((tab) => tab.id),
);

const statusItemSx = {
  width: "100%",
  minHeight: 96,
  p: 2,
  borderRadius: "18px",
  border: "1px solid",
  borderColor: "neutral.200",
  bgcolor: "background.level1",
  textAlign: "left",
  textDecoration: "none",
  color: "inherit",
  transition: "border-color 150ms ease, background-color 150ms ease, transform 150ms ease",
  cursor: "pointer",
  "&:hover": {
    borderColor: "neutral.300",
    bgcolor: "background.surface",
    transform: "translateY(-1px)",
  },
};

const toDisplayLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDomainStatusLabel = (status?: string | null) => {
  if (!status) {
    return "Setup required";
  }

  if (status === "active") {
    return "Verified";
  }

  return toDisplayLabel(status);
};

const normalizeTab = (value: string | null): SettingsTabId => {
  if (!value || !validTabs.has(value as SettingsTabId)) {
    return "connections";
  }

  return value as SettingsTabId;
};

const StatusValue = ({
  loading,
  color,
  label,
}: {
  loading: boolean;
  color: "success" | "warning" | "danger" | "neutral";
  label: string;
}) => {
  if (loading) {
    return (
      <Skeleton
        animation="wave"
        variant="rectangular"
        sx={{ width: 96, height: 26, borderRadius: "999px" }}
      />
    );
  }

  return (
    <Chip color={color} size="sm" variant="soft">
      {label}
    </Chip>
  );
};

const StatusStripContent = ({
  onOpenPosWizard,
  onOpenConnections,
}: {
  onOpenPosWizard: () => void;
  onOpenConnections: () => void;
}) => {
  const { hasPOSConnection, loading: posLoading } = usePOSConnection();
  const {
    data: socialConnections = [],
    isLoading: socialLoading,
    error: socialError,
    refetch: refetchSocial,
  } = useConnectedAccounts();
  const { senderConfig, loading: senderLoading } = useSenderConfiguration();
  const { domains, emailSenders, loading: domainsLoading } = useDomains();

  const activeDomains = useMemo(
    () => domains.filter((domain) => domain.status === "active"),
    [domains],
  );
  const verifiedSenders = useMemo(
    () => emailSenders.filter((sender) => sender.verified),
    [emailSenders],
  );

  const socialLabel = socialConnections.length
    ? `${socialConnections.length} connected`
    : "Not connected";
  const socialColor = socialConnections.length ? "success" : "warning";

  const hasDomainSetup = activeDomains.length > 0 || verifiedSenders.length > 0;
  const domainLabel = senderConfig?.isVerified
    ? "Verified"
    : hasDomainSetup
      ? "Configured"
      : formatDomainStatusLabel(senderConfig?.domainStatus);
  const domainColor = senderConfig?.isVerified || hasDomainSetup
    ? "success"
    : senderConfig?.domainStatus
      ? "warning"
      : "warning";

  const legacyEmailLabel = senderConfig?.isVerified
    ? "Domain verified"
    : formatDomainStatusLabel(senderConfig?.domainStatus);
  const legacyEmailColor = senderConfig?.isVerified ? "success" : "warning";

  return (
    <Stack spacing={1.5}>
      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "24px",
          borderColor: "neutral.200",
          boxShadow: "none",
          bgcolor: "background.surface",
          p: 1,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(4, minmax(0, 1fr))",
            },
            gap: 1,
          }}
        >
          <Box component="button" onClick={onOpenPosWizard} sx={statusItemSx} type="button">
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Store size={16} />
                <Typography level="body-sm" fontWeight="lg">
                  POS Connections
                </Typography>
              </Stack>
              <StatusValue
                color={hasPOSConnection ? "success" : "warning"}
                label={hasPOSConnection ? "Connected" : "Setup required"}
                loading={posLoading}
              />
            </Stack>
          </Box>

          <Box component="button" onClick={onOpenConnections} sx={statusItemSx} type="button">
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Link2 size={16} />
                <Typography level="body-sm" fontWeight="lg">
                  Social Accounts
                </Typography>
              </Stack>
              <StatusValue
                color={socialError ? "danger" : socialColor}
                label={socialError ? "Unavailable" : socialLabel}
                loading={socialLoading}
              />
            </Stack>
          </Box>

          <Box component={RouterLink} to="/domains" sx={statusItemSx}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Globe size={16} />
                <Typography level="body-sm" fontWeight="lg">
                  Domain Status
                </Typography>
              </Stack>
              <StatusValue
                color={domainColor}
                label={domainLabel}
                loading={domainsLoading || senderLoading}
              />
            </Stack>
          </Box>

          <Box component={RouterLink} to="/crm/settings/email-auth" sx={statusItemSx}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Bug size={16} />
                <Typography level="body-sm" fontWeight="lg">
                  Legacy Email
                </Typography>
              </Stack>
              <StatusValue
                color={legacyEmailColor}
                label={legacyEmailLabel}
                loading={senderLoading}
              />
            </Stack>
          </Box>
        </Box>
      </Sheet>

      {socialError ? (
        <SettingsInlineError
          message="Social account status could not be loaded."
          onRetry={() => {
            void refetchSocial();
          }}
        />
      ) : null}
    </Stack>
  );
};

export const SettingsHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("connections");
  const [showPOSWizard, setShowPOSWizard] = useState(false);
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (tabParam && !validTabs.has(tabParam as SettingsTabId)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "connections");
      setSearchParams(nextParams, { replace: true });
      if (activeTab !== "connections") {
        setActiveTab("connections");
      }
      return;
    }

    const nextTab = normalizeTab(tabParam);
    if (activeTab !== nextTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, searchParams, setSearchParams, tabParam]);

  const handleTabChange = (newTab: SettingsTabId) => {
    setActiveTab(newTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", newTab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "16px",
              display: "grid",
              placeItems: "center",
              bgcolor: "background.level1",
              color: "text.secondary",
            }}
          >
            <Settings size={20} />
          </Box>
          <Typography level="h2" sx={{ fontSize: { xs: "1.75rem", md: "2rem" } }}>
            Settings
          </Typography>
        </Stack>

        <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 760 }}>
          Manage connected systems, account billing, compliance defaults, and
          support from one tenant-facing settings console.
        </Typography>
      </Stack>

      <StatusStripContent
        onOpenConnections={() => handleTabChange("connections")}
        onOpenPosWizard={() => setShowPOSWizard(true)}
      />

      <Tabs
        value={activeTab}
        onChange={(_, value) => {
          if (typeof value === "string" && validTabs.has(value as SettingsTabId)) {
            handleTabChange(value as SettingsTabId);
          }
        }}
        sx={{ bgcolor: "transparent" }}
      >
        <TabList
          sx={{
            p: 0.5,
            gap: 0.5,
            borderRadius: "24px",
            border: "1px solid",
            borderColor: "neutral.200",
            bgcolor: "background.level1",
            flexWrap: "wrap",
          }}
          variant="plain"
        >
          {SETTINGS_TABS.map((tab) => (
            <Tab
              disableIndicator={false}
              indicatorInset
              key={tab.id}
              sx={{
                flex: 1,
                minWidth: { xs: "calc(50% - 4px)", md: 0 },
                borderRadius: "18px",
                py: 1.25,
                fontWeight: 600,
              }}
              value={tab.id}
            >
              {tab.label}
            </Tab>
          ))}
        </TabList>

        <TabPanel sx={{ px: 0, pt: 3 }} value="connections">
          <ConnectionsSettings />
        </TabPanel>

        <TabPanel sx={{ px: 0, pt: 3 }} value="account">
          <AccountBillingSettings />
        </TabPanel>

        <TabPanel sx={{ px: 0, pt: 3 }} value="compliance">
          <ComplianceSettings onUpdate={() => undefined} />
        </TabPanel>

        <TabPanel sx={{ px: 0, pt: 3 }} value="support">
          <SupportSettings />
        </TabPanel>
      </Tabs>

      {showPOSWizard && (
        <POSSetupWizard
          platform="square"
          onSuccess={() => {
            setShowPOSWizard(false);
            handleTabChange("connections");
          }}
          onCancel={() => setShowPOSWizard(false)}
        />
      )}
    </Stack>
  );
};
