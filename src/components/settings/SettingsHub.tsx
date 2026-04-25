import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tab, { tabClasses } from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { Globe, Mail, type LucideIcon, Share2, Store } from "lucide-react";
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
type StatusChipColor = "success" | "warning" | "neutral";
type StatusChipVariant = "soft" | "outlined";

interface StatusDescriptor {
  color: StatusChipColor;
  label: string;
  variant: StatusChipVariant;
}

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "connections", label: "Connections" },
  { id: "account", label: "Account & Billing" },
  { id: "compliance", label: "Compliance" },
  { id: "support", label: "Support" },
];

const validTabs = new Set<SettingsTabId>(SETTINGS_TABS.map((tab) => tab.id));

const statusItemSx = {
  minWidth: { xs: "100%", sm: 180 },
  flex: "1 1 180px",
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  p: 0,
  border: 0,
  bgcolor: "transparent",
  textDecoration: "none",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  "&:hover .settings-status-icon": {
    bgcolor: "background.level2",
  },
};

const normalizeTab = (value: string | null): SettingsTabId => {
  if (!value || !validTabs.has(value as SettingsTabId)) {
    return "connections";
  }

  return value as SettingsTabId;
};

const getNeutralStatus = (label: string): StatusDescriptor => ({
  color: "neutral",
  label,
  variant: "outlined",
});

const SettingsPanelSkeleton = () => {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Skeleton variant="text" width={200} />
        <Skeleton variant="text" level="body-sm" width={350} />
      </Stack>
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: "lg" }} />

      <Stack spacing={0.75}>
        <Skeleton variant="text" width={180} />
        <Skeleton variant="text" level="body-sm" width={300} />
      </Stack>
      <Skeleton variant="rectangular" height={160} sx={{ borderRadius: "lg" }} />
    </Stack>
  );
};

const SettingsPageSkeleton = () => {
  return (
    <Stack spacing={3}>
      <Box>
        <Skeleton variant="text" level="h3" width="120px" />
        <Skeleton variant="text" level="body-sm" width="380px" />
      </Box>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "lg",
          bgcolor: "background.surface",
          p: 2,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          flexWrap: { xs: "nowrap", sm: "wrap" },
          gap: 3,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            width={180}
            height={52}
            sx={{ borderRadius: "md", maxWidth: "100%" }}
          />
        ))}
      </Sheet>

      <Skeleton variant="rectangular" width={420} height={40} sx={{ borderRadius: "xl" }} />
      <SettingsPanelSkeleton />
    </Stack>
  );
};

const SettingsStatusItem = ({
  icon: Icon,
  label,
  status,
  component = "button",
  onClick,
  to,
}: {
  icon: LucideIcon;
  label: string;
  status: StatusDescriptor;
  component?: React.ElementType;
  onClick?: () => void;
  to?: string;
}) => {
  return (
    <Box
      component={component}
      onClick={onClick}
      sx={statusItemSx}
      to={to}
      type={component === "button" ? "button" : undefined}
    >
      <Box
        className="settings-status-icon"
        sx={{
          width: 36,
          height: 36,
          borderRadius: "md",
          bgcolor: "background.level1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background-color 150ms ease",
        }}
      >
        <Icon size={18} style={{ color: "var(--joy-palette-text-tertiary)" }} />
      </Box>

      <Stack spacing={0.25}>
        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
        <Chip color={status.color} size="sm" variant={status.variant}>
          {status.label}
        </Chip>
      </Stack>
    </Box>
  );
};

export const SettingsHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("connections");
  const [showPOSWizard, setShowPOSWizard] = useState(false);
  const tabParam = searchParams.get("tab");

  const { hasPOSConnection, loading: posLoading } = usePOSConnection();
  const {
    data: socialConnections = [],
    isLoading: socialLoading,
    error: socialError,
    refetch: refetchSocial,
  } = useConnectedAccounts();
  const { senderConfig, loading: senderLoading } = useSenderConfiguration();
  const { domains, emailSenders, loading: domainsLoading } = useDomains();

  const verifiedDomains = useMemo(
    () => domains.filter((domain) => domain.status === "active"),
    [domains],
  );
  const pendingDomains = useMemo(
    () => domains.filter((domain) => domain.status !== "active"),
    [domains],
  );
  const verifiedSenders = useMemo(
    () => emailSenders.filter((sender) => sender.verified),
    [emailSenders],
  );
  const pendingSenders = useMemo(
    () => emailSenders.filter((sender) => !sender.verified),
    [emailSenders],
  );

  const socialStatus = useMemo<StatusDescriptor>(() => {
    if (socialError) {
      return {
        color: "warning",
        label: "Unavailable",
        variant: "soft",
      };
    }

    if (socialConnections.length > 0) {
      return {
        color: "success",
        label: `${socialConnections.length} connected`,
        variant: "soft",
      };
    }

    return getNeutralStatus("Not connected");
  }, [socialConnections.length, socialError]);

  const domainStatus = useMemo<StatusDescriptor>(() => {
    if (senderConfig?.isVerified || verifiedDomains.length > 0 || verifiedSenders.length > 0) {
      return {
        color: "success",
        label: "Verified",
        variant: "soft",
      };
    }

    if (
      (senderConfig?.domainStatus && senderConfig.domainStatus !== "active") ||
      pendingDomains.length > 0 ||
      pendingSenders.length > 0
    ) {
      return {
        color: "warning",
        label: "Pending",
        variant: "soft",
      };
    }

    return getNeutralStatus("Not configured");
  }, [pendingDomains.length, pendingSenders.length, senderConfig, verifiedDomains.length, verifiedSenders.length]);

  const emailStatus = useMemo<StatusDescriptor>(() => {
    if (senderConfig?.isVerified || verifiedSenders.length > 0) {
      return {
        color: "success",
        label: "Configured",
        variant: "soft",
      };
    }

    return getNeutralStatus("Not configured");
  }, [senderConfig?.isVerified, verifiedSenders.length]);

  const isHubDataLoading = posLoading || socialLoading || domainsLoading || senderLoading;

  useEffect(() => {
    if (tabParam && !validTabs.has(tabParam as SettingsTabId)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "connections");
      setSearchParams(nextParams, { replace: true });
      setActiveTab("connections");
      return;
    }

    const nextTab = normalizeTab(tabParam);
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [searchParams, setSearchParams, tabParam]);

  const handleTabChange = (newTab: SettingsTabId) => {
    setActiveTab(newTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", newTab);
    setSearchParams(nextParams, { replace: true });
  };

  if (isHubDataLoading) {
    return <SettingsPageSkeleton />;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography level="h3">Settings</Typography>
        <Typography level="body-sm" sx={{ color: "text.secondary", mt: 0.5 }}>
          Manage connections, billing, compliance, and support from one place.
        </Typography>
      </Box>

      <Stack spacing={1.5}>
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "lg",
            bgcolor: "background.surface",
            p: 2,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: { xs: "nowrap", sm: "wrap" },
            gap: 3,
          }}
        >
          <SettingsStatusItem
            icon={Store}
            label="POS"
            onClick={() => setShowPOSWizard(true)}
            status={
              hasPOSConnection
                ? { color: "success", label: "Connected", variant: "soft" }
                : getNeutralStatus("Not connected")
            }
          />
          <SettingsStatusItem
            icon={Share2}
            label="Social"
            onClick={() => handleTabChange("connections")}
            status={socialStatus}
          />
          <SettingsStatusItem
            component={RouterLink}
            icon={Globe}
            label="Domains"
            status={domainStatus}
            to="/domains"
          />
          <SettingsStatusItem
            component={RouterLink}
            icon={Mail}
            label="Email"
            status={emailStatus}
            to="/crm/settings/email-auth"
          />
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

      <Tabs
        aria-label="Settings sections"
        value={activeTab}
        onChange={(_, newValue) => {
          if (typeof newValue === "string" && validTabs.has(newValue as SettingsTabId)) {
            handleTabChange(newValue as SettingsTabId);
          }
        }}
        sx={{ bgcolor: "transparent" }}
      >
        <TabList
          disableUnderline
          sx={{
            p: 0.5,
            gap: 0.5,
            borderRadius: "xl",
            bgcolor: "background.level1",
            width: "fit-content",
            maxWidth: "100%",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            flexWrap: "nowrap",
            [`& .${tabClasses.root}`]: {
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontSize: "sm",
              fontWeight: "md",
              px: 2,
              py: 0.75,
              borderRadius: "lg",
              transition: "all 150ms ease",
              [`&[aria-selected="true"]`]: {
                bgcolor: "background.surface",
                boxShadow: "sm",
                fontWeight: "lg",
              },
              [`&:not([aria-selected="true"]):hover`]: {
                bgcolor: "background.level2",
              },
            },
          }}
        >
          {SETTINGS_TABS.map((tab) => (
            <Tab disableIndicator key={tab.id} value={tab.id}>
              {tab.label}
            </Tab>
          ))}
        </TabList>

        <TabPanel value="connections" sx={{ p: 0, pt: 2.5 }}>
          <ConnectionsSettings />
        </TabPanel>

        <TabPanel value="account" sx={{ p: 0, pt: 2.5 }}>
          <AccountBillingSettings />
        </TabPanel>

        <TabPanel value="compliance" sx={{ p: 0, pt: 2.5 }}>
          <ComplianceSettings onUpdate={() => undefined} />
        </TabPanel>

        <TabPanel value="support" sx={{ p: 0, pt: 2.5 }}>
          <SupportSettings />
        </TabPanel>
      </Tabs>

      {showPOSWizard ? (
        <POSSetupWizard
          platform="square"
          onSuccess={() => {
            setShowPOSWizard(false);
            handleTabChange("connections");
          }}
          onCancel={() => setShowPOSWizard(false)}
        />
      ) : null}
    </Stack>
  );
};
