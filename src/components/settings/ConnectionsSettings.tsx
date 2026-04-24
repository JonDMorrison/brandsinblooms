import React, { useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
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
  CheckCircle2,
  ExternalLink,
  Facebook,
  FileText,
  Instagram,
  HelpCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ScrollText,
  Square,
  Store,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { POSSetupWizard } from "@/components/crm/pos/POSSetupWizard";
import { POSConnectionHelp } from "@/components/crm/pos/POSConnectionHelp";
import {
  type POSConnection,
  usePOSConnections,
} from "@/hooks/usePOSConnections";
import {
  useConnectedAccounts,
  getConnectionStatus,
} from "@/components/dashboard/ConnectedAccountChecker";
import { JoyButton } from "@/components/joy/JoyButton";
import { useToast } from "@/hooks/use-toast";
import {
  SettingsEmptyState,
  SettingsInlineError,
  SettingsSectionCard,
} from "./SettingsSurface";

interface POSPlatform {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: "pos" | "social" | "integration";
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

const LEGACY_SHOPIFY_DEPRECATED = true;

const panelCardSx = {
  borderRadius: "20px",
  border: "1px solid",
  borderColor: "neutral.200",
  bgcolor: "background.level1",
  p: 2,
  boxShadow: "none",
};

const platformGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
  },
  gap: 1.5,
};

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

const renderLoadingCards = (count: number) => (
  <Box sx={platformGridSx}>
    {Array.from({ length: count }).map((_, index) => (
      <Sheet key={index} variant="outlined" sx={panelCardSx}>
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" spacing={1.5}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Skeleton variant="circular" width={36} height={36} />
              <Stack spacing={0.5}>
                <Skeleton animation="wave" variant="text" width={120} />
                <Skeleton animation="wave" variant="text" width={96} />
              </Stack>
            </Stack>
            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: "999px" }} />
          </Stack>
          <Skeleton animation="wave" variant="text" width="100%" />
          <Skeleton animation="wave" variant="text" width="74%" />
          <Skeleton variant="rectangular" width={116} height={34} sx={{ borderRadius: "md" }} />
        </Stack>
      </Sheet>
    ))}
  </Box>
);

const getPosPlatformConfig = (platformId: string, availablePlatforms: POSPlatform[]) => {
  return (
    availablePlatforms.find((platform) => platform.id === platformId) ?? {
      id: platformId,
      name: formatPlatformLabel(platformId),
      description: "Connected platform",
      icon: <Store className="h-6 w-6 text-green-600" />,
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
          icon: <Store className="h-6 w-6 text-green-600" />,
          description: "Connect your Shopify store to sync customers and orders.",
          category: "pos",
        },
        {
          id: "square",
          name: "Square",
          icon: <Square className="h-6 w-6 text-blue-600" />,
          description:
            "Connect your Square POS to sync customer, catalog, and transaction data.",
          category: "pos",
        },
        {
          id: "vmx",
          name: "VMX / CSV Upload",
          icon: <FileText className="h-6 w-6 text-purple-600" />,
          description: "Upload customer data manually through CSV imports.",
          category: "pos",
        },
      ].filter(
        (platform) => !(platform.id === "shopify" && LEGACY_SHOPIFY_DEPRECATED),
      ),
    [],
  );

  const socialPlatforms = useMemo(
    () => [
      {
        id: "facebook",
        name: "Facebook",
        icon: <Facebook className="h-6 w-6 text-blue-600" />,
        description: "Publish posts and manage your connected Facebook Pages.",
      },
      {
        id: "instagram",
        name: "Instagram",
        icon: <Instagram className="h-6 w-6 text-pink-600" />,
        description: "Share posts and stories to your Instagram Business account.",
      },
    ],
    [],
  );

  const integrationPreviews = useMemo(
    () => [
      {
        id: "zapier",
        name: "Zapier",
        description: "Connect BloomSuite workflows to thousands of partner apps.",
        icon: <Zap className="h-6 w-6 text-orange-600" />,
      },
      {
        id: "mailchimp",
        name: "Mailchimp",
        description: "Extend newsletter and audience sync workflows from the integration hub.",
        icon: <Users className="h-6 w-6 text-blue-600" />,
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
  const {
    data: socialConnections = [],
    isLoading: socialLoading,
    error: socialError,
    refetch: refetchSocial,
  } = useConnectedAccounts();
  const { toast } = useToast();

  const posConnections = (rawPosConnections as POSConnectionWithLogs[] | undefined) ?? [];
  const posLoadFailed = !posLoading && rawPosConnections === undefined;
  const connectedPOSIds = new Set(posConnections.map((connection) => connection.platform));
  const connectionStatusData = getConnectionStatus(socialConnections);
  const connectedSocialPlatforms = new Set(connectionStatusData.connectedPlatforms);

  const handleConnectPOS = (platform: string) => {
    setSelectedPlatform(platform);
    setShowConnectionForm(true);
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
          <Stack spacing={2.5}>
            {posConnections.length > 0 ? (
              <Stack spacing={1.5}>
                {posConnections.map((connection) => {
                  const platform = getPosPlatformConfig(connection.platform, availablePlatforms);
                  const latestLog = getLatestLog(connection);
                  const needsAttention =
                    latestLog?.status === "failed" || connection.sync_status === "failed";
                  const statusColor = isSyncing
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
                    <Sheet key={connection.id} variant="outlined" sx={panelCardSx}>
                      <Stack
                        direction={{ xs: "column", lg: "row" }}
                        spacing={2}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", lg: "center" }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: "16px",
                              display: "grid",
                              placeItems: "center",
                              bgcolor: "background.surface",
                              flexShrink: 0,
                            }}
                          >
                            {platform.icon}
                          </Box>

                          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                              <Typography level="title-sm">{connection.name || platform.name}</Typography>
                              <Chip color={statusColor} size="sm" variant="soft">
                                {statusLabel}
                              </Chip>
                            </Stack>
                            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                              {platform.description}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                              {syncSummary}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                              Last sync: {formatTimestamp(latestLog?.completed_at ?? latestLog?.started_at ?? connection.last_sync_at)}
                            </Typography>
                          </Stack>
                        </Stack>

                        <Dropdown>
                          <MenuButton
                            slots={{ root: IconButton }}
                            slotProps={{
                              root: { color: "neutral", size: "sm", variant: "plain" },
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </MenuButton>
                          <Menu
                            placement="bottom-end"
                            size="sm"
                            sx={{
                              borderRadius: "16px",
                              border: "1px solid",
                              borderColor: "neutral.200",
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
                      </Stack>
                    </Sheet>
                  );
                })}
              </Stack>
            ) : (
              <SettingsEmptyState
                description="No POS platform is connected yet. Start with Square or use a CSV upload to bring customer data into BloomSuite."
                icon={Store}
                primaryAction={{
                  label: "Connect Square",
                  onClick: () => handleConnectPOS("square"),
                  startDecorator: <Plus size={16} />,
                }}
                secondaryAction={{
                  label: "View Setup Help",
                  onClick: () => {
                    setSelectedPlatform("square");
                    setShowHelp(true);
                  },
                  startDecorator: <HelpCircle size={16} />,
                  variant: "outline",
                  color: "neutral",
                }}
                title="No POS connected yet"
              />
            )}

            <Divider />

            <Stack spacing={1.25}>
              <Typography level="title-sm">Available Platforms</Typography>
              <Box sx={platformGridSx}>
                {availablePlatforms.map((platform) => {
                  const isConnected = connectedPOSIds.has(platform.id);

                  return (
                    <Sheet key={platform.id} variant="outlined" sx={panelCardSx}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: "16px",
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "background.surface",
                                flexShrink: 0,
                              }}
                            >
                              {platform.icon}
                            </Box>
                            <Stack spacing={0.25}>
                              <Typography level="title-sm">{platform.name}</Typography>
                              <Chip
                                color={isConnected ? "success" : "neutral"}
                                size="sm"
                                variant="soft"
                              >
                                {isConnected ? "Connected" : "Available"}
                              </Chip>
                            </Stack>
                          </Stack>

                          {!isConnected ? (
                            <IconButton
                              color="neutral"
                              onClick={() => {
                                setSelectedPlatform(platform.id);
                                setShowHelp(true);
                              }}
                              size="sm"
                              variant="plain"
                            >
                              <HelpCircle size={16} />
                            </IconButton>
                          ) : null}
                        </Stack>

                        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                          {platform.description}
                        </Typography>

                        <JoyButton
                          disabled={isConnected}
                          onClick={() => handleConnectPOS(platform.id)}
                          startDecorator={isConnected ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                          variant={isConnected ? "secondary" : "outline"}
                        >
                          {isConnected ? "Connected" : "Connect"}
                        </JoyButton>
                      </Stack>
                    </Sheet>
                  );
                })}
              </Box>
            </Stack>
          </Stack>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Connect Facebook and Instagram accounts to publish content and manage social workflows."
        headerActions={
          <Chip
            color={socialConnections.length > 0 ? "success" : "neutral"}
            size="sm"
            variant="soft"
          >
            {socialConnections.length > 0
              ? connectionStatusData.statusMessage
              : "No social accounts connected"}
          </Chip>
        }
        startDecorator={<Users size={18} />}
        title="Social Accounts"
      >
        {socialLoading ? (
          renderLoadingCards(2)
        ) : socialError ? (
          <SettingsInlineError
            message="Social account connections could not be loaded."
            onRetry={() => {
              void refetchSocial();
            }}
          />
        ) : (
          <Stack spacing={2.5}>
            {socialConnections.length === 0 ? (
              <SettingsEmptyState
                description="No social account is connected yet. Open the social accounts workspace to connect Facebook or Instagram."
                icon={Users}
                primaryAction={{
                  label: "Open Social Accounts",
                  onClick: () => undefined,
                  startDecorator: <ExternalLink size={16} />,
                }}
                title="No social accounts connected"
              />
            ) : null}

            <Box sx={platformGridSx}>
              {socialPlatforms.map((platform) => {
                const isConnected = connectedSocialPlatforms.has(platform.id);

                return (
                  <Sheet key={platform.id} variant="outlined" sx={panelCardSx}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: "16px",
                              display: "grid",
                              placeItems: "center",
                              bgcolor: "background.surface",
                              flexShrink: 0,
                            }}
                          >
                            {platform.icon}
                          </Box>
                          <Stack spacing={0.25}>
                            <Typography level="title-sm">{platform.name}</Typography>
                            <Chip
                              color={isConnected ? "success" : "neutral"}
                              size="sm"
                              variant="soft"
                            >
                              {isConnected ? "Connected" : "Not connected"}
                            </Chip>
                          </Stack>
                        </Stack>
                      </Stack>

                      <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                        {platform.description}
                      </Typography>

                      <Box component={RouterLink} sx={{ textDecoration: "none" }} to="/social-accounts">
                        <JoyButton
                          startDecorator={isConnected ? <ExternalLink size={16} /> : <Plus size={16} />}
                          variant="outline"
                        >
                          {isConnected ? "Manage" : "Connect"}
                        </JoyButton>
                      </Box>
                    </Stack>
                  </Sheet>
                );
              })}
            </Box>
          </Stack>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Explore additional workflow integrations and partner connections from the integration hub."
        headerActions={
          <Chip color="neutral" size="sm" variant="soft">
            Coming soon
          </Chip>
        }
        startDecorator={<Zap size={18} />}
        title="Integrations"
      >
        <Stack spacing={2.5}>
          <Box sx={platformGridSx}>
            {integrationPreviews.map((integration) => (
              <Sheet key={integration.id} variant="outlined" sx={panelCardSx}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "16px",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "background.surface",
                      }}
                    >
                      {integration.icon}
                    </Box>
                    <Stack spacing={0.25}>
                      <Typography level="title-sm">{integration.name}</Typography>
                      <Chip color="neutral" size="sm" variant="soft">
                        Preview
                      </Chip>
                    </Stack>
                  </Stack>

                  <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                    {integration.description}
                  </Typography>

                  <JoyButton disabled startDecorator={<Plus size={16} />} variant="outline">
                    Coming soon
                  </JoyButton>
                </Stack>
              </Sheet>
            ))}
          </Box>

          <Box component={RouterLink} sx={{ textDecoration: "none", alignSelf: "flex-start" }} to="/integrations">
            <JoyButton startDecorator={<ExternalLink size={16} />} variant="outline">
              Open Integration Hub
            </JoyButton>
          </Box>
        </Stack>
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
