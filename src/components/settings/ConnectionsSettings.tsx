import React, { useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import Dropdown from "@mui/joy/Dropdown";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowUpRight,
  Blocks,
  ChevronDown,
  FileSpreadsheet,
  HelpCircle,
  type LucideIcon,
  Plus,
  RefreshCw,
  ScrollText,
  Store,
  Trash2,
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { POSSetupWizard } from "@/components/crm/pos/POSSetupWizard";
import { POSConnectionHelp } from "@/components/crm/pos/POSConnectionHelp";
import { providerLogoAssets } from "@/components/integrations/providerLogoAssets";
import {
  type POSConnection,
  usePOSConnections,
} from "@/hooks/usePOSConnections";
import { JoyButton } from "@/components/joy/JoyButton";
import { useToast } from "@/hooks/use-toast";
import {
  SettingsInlineError,
  SettingsEmptyState,
  SettingsSectionCard,
} from "./SettingsSurface";

type LogoFit = "cover" | "contain";

interface PlatformLogoSource {
  /** Partner mark from the shared integrations logo registry. */
  src?: string;
  /** "cover" for full-bleed square marks (e.g. Zapier), "contain" for marks needing padding. */
  fit?: LogoFit;
  /** Used when no partner mark exists (CSV upload, unknown platforms). */
  fallbackIcon: LucideIcon;
}

interface POSPlatform {
  id: string;
  name: string;
  logo: PlatformLogoSource;
  description: string;
  category: "pos" | "integration";
}

interface IntegrationPreview {
  id: string;
  name: string;
  logo: PlatformLogoSource;
  description: string;
}

interface POSSyncLog {
  status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  customers_synced?: number | null;
  orders_synced?: number | null;
  error_message?: string | null;
}

type POSConnectionWithLogs = POSConnection & {
  pos_sync_logs?: POSSyncLog[];
};

type StatusColor = "success" | "neutral" | "warning" | "danger";

const LEGACY_SHOPIFY_DEPRECATED = true;

const LOGO_TILE_SIZE = 40;

const platformCardSx = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  borderRadius: "16px",
  borderColor: "neutral.outlinedBorder",
  bgcolor: "background.surface",
  p: 4,
  boxShadow: "none",
} as const;

const mutedPlatformCardSx = {
  ...platformCardSx,
  bgcolor: "background.level1",
  borderStyle: "dashed",
} as const;

const platformGridSx = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
  gap: 3,
} as const;

const formatPlatformLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const getLatestLog = (connection: POSConnectionWithLogs) => {
  const logs = connection.pos_sync_logs ?? [];

  return [...logs].sort((left, right) => {
    const leftTime = new Date(left.completed_at ?? left.started_at ?? 0).getTime();
    const rightTime = new Date(right.completed_at ?? right.started_at ?? 0).getTime();
    return rightTime - leftTime;
  })[0];
};

const PlatformLogo = ({ logo, name }: { logo: PlatformLogoSource; name: string }) => {
  const FallbackIcon = logo.fallbackIcon;
  const isCover = logo.fit === "cover";

  return (
    <Box
      sx={{
        width: LOGO_TILE_SIZE,
        height: LOGO_TILE_SIZE,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: "10px",
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        // Partner marks are designed for light backgrounds, so the tile stays
        // white in both colour schemes; icon fallbacks follow the theme.
        bgcolor: logo.src ? "common.white" : "neutral.softBg",
        color: "text.secondary",
      }}
    >
      {logo.src ? (
        <Box
          component="img"
          src={logo.src}
          alt={`${name} logo`}
          loading="lazy"
          sx={{
            width: isCover ? "100%" : "68%",
            height: isCover ? "100%" : "68%",
            objectFit: isCover ? "cover" : "contain",
            display: "block",
          }}
        />
      ) : (
        <FallbackIcon aria-hidden size={20} strokeWidth={1.8} />
      )}
    </Box>
  );
};

interface PlatformCardProps {
  logo: PlatformLogoSource;
  name: string;
  description: string;
  status?: { label: string; color: StatusColor; variant?: "soft" | "outlined" };
  action?: React.ReactNode;
  details?: React.ReactNode;
  footer?: React.ReactNode;
  muted?: boolean;
}

const PlatformCard = ({
  logo,
  name,
  description,
  status,
  action,
  details,
  footer,
  muted = false,
}: PlatformCardProps) => (
  <Sheet component="article" variant="outlined" sx={muted ? mutedPlatformCardSx : platformCardSx}>
    <Stack direction="row" spacing={3} alignItems="center">
      <PlatformLogo logo={logo} name={name} />
      <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
        <Typography level="title-sm" noWrap>
          {name}
        </Typography>
        {status ? (
          <Chip
            color={status.color}
            size="sm"
            variant={status.variant ?? "soft"}
            sx={{ alignSelf: "flex-start" }}
          >
            {status.label}
          </Chip>
        ) : null}
      </Stack>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Stack>

    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
      {description}
    </Typography>

    {details}

    {footer ? <Box sx={{ mt: "auto" }}>{footer}</Box> : null}
  </Sheet>
);

const renderLoadingCards = (count: number) => (
  <Box sx={platformGridSx}>
    {Array.from({ length: count }).map((_, index) => (
      <Sheet key={index} variant="outlined" sx={platformCardSx}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Skeleton
            variant="rectangular"
            width={LOGO_TILE_SIZE}
            height={LOGO_TILE_SIZE}
            sx={{ borderRadius: "10px" }}
          />
          <Stack spacing={1} sx={{ flex: 1 }}>
            <Skeleton animation="wave" variant="text" width={120} />
            <Skeleton animation="wave" variant="text" width={72} />
          </Stack>
          <Skeleton variant="rectangular" width={84} height={32} sx={{ borderRadius: "md" }} />
        </Stack>
        <Skeleton animation="wave" variant="text" width="100%" />
        <Skeleton animation="wave" variant="text" width="64%" />
      </Sheet>
    ))}
  </Box>
);

const getPosPlatformConfig = (platformId: string, availablePlatforms: POSPlatform[]): POSPlatform => {
  return (
    availablePlatforms.find((platform) => platform.id === platformId) ?? {
      id: platformId,
      name: formatPlatformLabel(platformId),
      description: "Connected platform",
      logo: { src: providerLogoAssets[platformId], fit: "contain", fallbackIcon: Store },
      category: "pos" as const,
    }
  );
};

export const ConnectionsSettings = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [posRetryKey, setPosRetryKey] = useState(0);
  const [selectedLogConnection, setSelectedLogConnection] =
    useState<POSConnectionWithLogs | null>(null);

  const availablePlatforms: POSPlatform[] = useMemo(
    () =>
      [
        {
          id: "shopify",
          name: "Shopify",
          logo: { src: providerLogoAssets.shopify, fit: "contain", fallbackIcon: Store },
          description: "Connect your Shopify store to sync customers and orders.",
          category: "pos",
        } satisfies POSPlatform,
        {
          id: "square",
          name: "Square",
          logo: { src: providerLogoAssets.square, fit: "contain", fallbackIcon: Store },
          description:
            "Connect your Square POS to sync customer, catalog, and transaction data.",
          category: "pos",
        } satisfies POSPlatform,
        {
          id: "vmx",
          name: "VMX / CSV Upload",
          logo: { fallbackIcon: FileSpreadsheet },
          description: "Upload customer data manually through CSV imports.",
          category: "pos",
        } satisfies POSPlatform,
      ].filter(
        (platform) => !(platform.id === "shopify" && LEGACY_SHOPIFY_DEPRECATED),
      ),
    [],
  );

  const integrationPreviews: IntegrationPreview[] = useMemo(
    () => [
      {
        id: "zapier",
        name: "Zapier",
        description: "Connect BloomSuite workflows to thousands of partner apps.",
        logo: { src: providerLogoAssets.zapier, fit: "cover", fallbackIcon: Blocks },
      },
      {
        id: "mailchimp",
        name: "Mailchimp",
        description: "Extend newsletter and audience sync workflows from the integration hub.",
        logo: { src: providerLogoAssets.mailchimp, fit: "cover", fallbackIcon: Blocks },
      },
    ],
    [],
  );

  const {
    connections: rawPosConnections,
    isLoading: posLoading,
    isSyncing,
    runSync,
    disconnectPOS,
  } = usePOSConnections();
  const { toast } = useToast();

  const posConnections = (rawPosConnections as POSConnectionWithLogs[] | undefined) ?? [];
  const posLoadFailed = !posLoading && rawPosConnections === undefined;
  const connectedPOSIds = new Set(posConnections.map((connection) => connection.platform));
  const unconnectedPlatforms = availablePlatforms.filter(
    (platform) => !connectedPOSIds.has(platform.id),
  );

  const handleConnectPOS = (platform: string) => {
    setSelectedPlatform(platform);
    setShowConnectionForm(true);
  };

  const handleShowHelp = (platform: string) => {
    setSelectedPlatform(platform);
    setShowHelp(true);
  };

  const handlePOSConnectionSuccess = () => {
    setShowConnectionForm(false);
    setSelectedPlatform(null);
    toast({
      title: "POS Connected",
      description:
        "Your POS system has been successfully connected and is ready to sync data.",
    });
  };

  const handleSyncPOS = (connectionId: string) => {
    runSync(connectionId);
  };

  const handleDisconnectPOS = (connectionId: string) => {
    disconnectPOS(connectionId);
  };

  const selectedLog = selectedLogConnection ? getLatestLog(selectedLogConnection) : null;

  const renderConnectionCard = (connection: POSConnectionWithLogs) => {
    const platform = getPosPlatformConfig(connection.platform, availablePlatforms);
    const latestLog = getLatestLog(connection);
    const needsAttention =
      latestLog?.status === "failed" || connection.sync_status === "failed";
    const statusColor: StatusColor = isSyncing
      ? "neutral"
      : !connection.is_active
        ? "warning"
        : needsAttention
          ? "danger"
          : "success";
    const statusLabel = isSyncing
      ? "Syncing"
      : !connection.is_active
        ? "Inactive"
        : needsAttention
          ? "Needs attention"
          : "Connected";
    const syncSummary = latestLog
      ? latestLog.status === "failed"
        ? latestLog.error_message ?? "The last sync did not complete successfully."
        : latestLog.status === "running"
          ? "A sync is currently in progress."
          : `Last sync imported ${latestLog.customers_synced ?? 0} customers and ${latestLog.orders_synced ?? 0} orders.`
      : connection.last_sync_at
        ? `Last synced ${formatTimestamp(connection.last_sync_at)}.`
        : "Run your first sync to import customer and sales data.";

    return (
      <PlatformCard
        key={connection.id}
        action={
          <Dropdown>
            <MenuButton
              color="neutral"
              endDecorator={<ChevronDown size={14} />}
              size="sm"
              variant="outlined"
            >
              Manage
            </MenuButton>
            <Menu
              placement="bottom-end"
              size="sm"
              sx={{
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "neutral.outlinedBorder",
                bgcolor: "background.surface",
                boxShadow: "md",
              }}
            >
              <MenuItem disabled={isSyncing} onClick={() => handleSyncPOS(connection.id)}>
                <ListItemDecorator>
                  <RefreshCw size={15} />
                </ListItemDecorator>
                Sync Now
              </MenuItem>
              <MenuItem onClick={() => setSelectedLogConnection(connection)}>
                <ListItemDecorator>
                  <ScrollText size={15} />
                </ListItemDecorator>
                View Logs
              </MenuItem>
              <MenuItem color="danger" onClick={() => handleDisconnectPOS(connection.id)}>
                <ListItemDecorator>
                  <Trash2 size={15} />
                </ListItemDecorator>
                Disconnect
              </MenuItem>
            </Menu>
          </Dropdown>
        }
        description={platform.description}
        details={
          <Stack
            spacing={1}
            sx={{
              pt: 3,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              level="body-xs"
              sx={{ color: needsAttention ? "danger.plainColor" : "text.tertiary" }}
            >
              {syncSummary}
            </Typography>
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              Last sync:{" "}
              {formatTimestamp(latestLog?.completed_at ?? latestLog?.started_at ?? connection.last_sync_at)}
            </Typography>
          </Stack>
        }
        logo={platform.logo}
        name={connection.name || platform.name}
        status={{ label: statusLabel, color: statusColor }}
      />
    );
  };

  return (
    <Stack spacing={3} key={posRetryKey}>
      <SettingsSectionCard
        description="Connect one or more POS platforms to keep customer, catalog, and order data in sync."
        headerActions={
          <Chip color={posConnections.length > 0 ? "success" : "neutral"} size="sm" variant="soft">
            {posConnections.length} connected
          </Chip>
        }
        startDecorator={<Store size={18} />}
        title="POS Connections"
      >
        {posLoading ? (
          renderLoadingCards(2)
        ) : posLoadFailed ? (
          <SettingsInlineError
            message="POS connections could not be loaded."
            onRetry={() => setPosRetryKey((current) => current + 1)}
          />
        ) : (
          <Stack spacing={3}>
            {posConnections.length === 0 ? (
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                No POS platform is connected yet. Start with Square, or upload a CSV to bring
                customer data into BloomSuite.
              </Typography>
            ) : null}

            <Box sx={platformGridSx}>
              {posConnections.map(renderConnectionCard)}

              {unconnectedPlatforms.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  action={
                    <JoyButton
                      onClick={() => handleConnectPOS(platform.id)}
                      size="sm"
                      startDecorator={<Plus size={16} />}
                    >
                      Connect
                    </JoyButton>
                  }
                  description={platform.description}
                  footer={
                    <JoyButton
                      onClick={() => handleShowHelp(platform.id)}
                      size="sm"
                      startDecorator={<HelpCircle size={14} />}
                      variant="link"
                    >
                      Setup guide
                    </JoyButton>
                  }
                  logo={platform.logo}
                  name={platform.name}
                />
              ))}
            </Box>
          </Stack>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        description="More partner integrations are on the way. Explore everything available today in the integration hub."
        headerActions={
          <Box component={RouterLink} sx={{ textDecoration: "none" }} to="/integrations">
            <JoyButton endDecorator={<ArrowUpRight size={16} />} size="sm" variant="outline">
              Open Integration Hub
            </JoyButton>
          </Box>
        }
        startDecorator={<Blocks size={18} />}
        title="Integrations"
      >
        <Box sx={platformGridSx}>
          {integrationPreviews.map((integration) => (
            <PlatformCard
              key={integration.id}
              description={integration.description}
              logo={integration.logo}
              muted
              name={integration.name}
              action={
                <Chip color="neutral" size="sm" variant="outlined">
                  Coming soon
                </Chip>
              }
            />
          ))}
        </Box>
      </SettingsSectionCard>

      {showConnectionForm && selectedPlatform && (
        <POSSetupWizard
          platform={selectedPlatform}
          onSuccess={handlePOSConnectionSuccess}
          onCancel={() => {
            setShowConnectionForm(false);
            setSelectedPlatform(null);
          }}
        />
      )}

      {showHelp && selectedPlatform && (
        <Modal onClose={() => setShowHelp(false)} open={showHelp}>
          <ModalDialog
            sx={{
              maxWidth: 960,
              width: "calc(100vw - 32px)",
              maxHeight: "88vh",
              overflowY: "auto",
              borderRadius: "24px",
              bgcolor: "background.surface",
            }}
            variant="outlined"
          >
            <ModalClose />
            <DialogTitle>Setup Guide</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5}>
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                  Step-by-step instructions for connecting your POS system.
                </Typography>
                <POSConnectionHelp platform={selectedPlatform} />
                <Divider />
                <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                  <JoyButton color="neutral" onClick={() => setShowHelp(false)} variant="outline">
                    Close
                  </JoyButton>
                  <JoyButton
                    onClick={() => {
                      setShowHelp(false);
                      handleConnectPOS(selectedPlatform);
                    }}
                    startDecorator={<Plus size={16} />}
                  >
                    Start Setup
                  </JoyButton>
                </Stack>
              </Stack>
            </DialogContent>
          </ModalDialog>
        </Modal>
      )}

      <Modal onClose={() => setSelectedLogConnection(null)} open={Boolean(selectedLogConnection)}>
        <ModalDialog
          sx={{
            maxWidth: 520,
            width: "calc(100vw - 32px)",
            borderRadius: "24px",
            bgcolor: "background.surface",
          }}
          variant="outlined"
        >
          <ModalClose />
          <DialogTitle>Latest Sync Log</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                {selectedLogConnection
                  ? `${getPosPlatformConfig(selectedLogConnection.platform, availablePlatforms).name} connection activity`
                  : "Connection activity"}
              </Typography>

              {selectedLog ? (
                <>
                  {selectedLog.status === "failed" && selectedLog.error_message ? (
                    <Alert color="danger" size="sm" variant="soft">
                      {selectedLog.error_message}
                    </Alert>
                  ) : null}

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "minmax(0, 1fr)",
                        sm: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 1.5,
                    }}
                  >
                    <Sheet variant="soft" sx={{ borderRadius: "18px", p: 1.5 }}>
                      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                        Status
                      </Typography>
                      <Typography level="title-sm">{formatPlatformLabel(selectedLog.status ?? "unknown")}</Typography>
                    </Sheet>
                    <Sheet variant="soft" sx={{ borderRadius: "18px", p: 1.5 }}>
                      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                        Started
                      </Typography>
                      <Typography level="title-sm">{formatTimestamp(selectedLog.started_at)}</Typography>
                    </Sheet>
                    <Sheet variant="soft" sx={{ borderRadius: "18px", p: 1.5 }}>
                      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                        Completed
                      </Typography>
                      <Typography level="title-sm">{formatTimestamp(selectedLog.completed_at)}</Typography>
                    </Sheet>
                    <Sheet variant="soft" sx={{ borderRadius: "18px", p: 1.5 }}>
                      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                        Imported
                      </Typography>
                      <Typography level="title-sm">
                        {selectedLog.customers_synced ?? 0} customers • {selectedLog.orders_synced ?? 0} orders
                      </Typography>
                    </Sheet>
                  </Box>
                </>
              ) : (
                <SettingsEmptyState
                  description="No sync log has been recorded for this connection yet. Run a sync from the action menu when you are ready."
                  icon={ScrollText}
                  title="No sync log yet"
                />
              )}
            </Stack>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Stack>
  );
};
