import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import CardContent from "@mui/joy/CardContent";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
} from "date-fns";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Plus,
  RefreshCw,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchOAuthConfig } from "@/lib/api/oauth";
import { getOAuthRedirectUri } from "@/utils/environmentUtils";
import { resolvePlatformKey } from "@/utils/platformConfig";

export type SocialConnection =
  Database["public"]["Tables"]["social_connections"]["Row"];

interface SocialConnectionManagerProps {
  onConnectionsChange?: (
    connections: SocialConnection[],
    loading: boolean,
  ) => void;
}

type DisconnectTarget = {
  id: string;
  platformName: string;
  accountName?: string | null;
};

type SupportedPlatformKey = "facebook" | "instagram";

type SupportedPlatformDefinition = {
  key: SupportedPlatformKey;
  label: string;
  icon: LucideIcon;
  avatarSx: SxProps;
  connectLabel: string;
  description: string;
};

type ConnectionStatus = {
  color: "danger" | "neutral" | "success" | "warning";
  dotColor: string;
  label: string;
};

const SUPPORTED_PLATFORMS: SupportedPlatformDefinition[] = [
  {
    key: "facebook",
    label: "Facebook",
    icon: Facebook,
    connectLabel: "Connect Facebook",
    description:
      "Link your Facebook Page to publish content and sync performance data.",
    avatarSx: {
      bgcolor: "#4267B2",
      color: "#FFFFFF",
      boxShadow: "sm",
    },
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    connectLabel: "Connect via Facebook",
    description:
      "Instagram Business accounts authenticate through your linked Facebook Page. We request only the scopes needed to publish to Instagram.",
    avatarSx: {
      background:
        "linear-gradient(135deg, #F58529 0%, #DD2A7B 52%, #515BD4 100%)",
      color: "#FFFFFF",
      boxShadow: "sm",
    },
  },
];

const getSupportedPlatform = (
  platform: string,
): SupportedPlatformDefinition | null => {
  const resolvedKey = resolvePlatformKey(platform);

  if (resolvedKey !== "facebook" && resolvedKey !== "instagram") {
    return null;
  }

  return SUPPORTED_PLATFORMS.find((entry) => entry.key === resolvedKey) ?? null;
};

const formatConnectionDate = (value: string) => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return format(parsedDate, "MMM d, yyyy");
};

const formatExpiryText = (expiresAt: string | null) => {
  if (!expiresAt) {
    return "Token expiry: No expiry provided";
  }

  const expiryDate = new Date(expiresAt);

  if (Number.isNaN(expiryDate.getTime())) {
    return "Token expiry: Not available";
  }

  const formattedDate = format(expiryDate, "MMM d, yyyy");
  const daysRemaining = differenceInCalendarDays(expiryDate, new Date());

  if (daysRemaining < 0) {
    return `Token expired: ${formattedDate} (${formatDistanceToNowStrict(
      expiryDate,
      {
        addSuffix: true,
      },
    )})`;
  }

  if (daysRemaining === 0) {
    return `Token expires: ${formattedDate} (today)`;
  }

  return `Token expires: ${formattedDate} (${formatDistanceToNowStrict(expiryDate)})`;
};

const resolveConnectionStatus = (
  connection: SocialConnection,
  disconnectingId: string | null,
): ConnectionStatus => {
  if (disconnectingId === connection.id) {
    return {
      label: "Disconnecting...",
      color: "neutral",
      dotColor: "neutral.500",
    };
  }

  if (!connection.is_active) {
    return {
      label: "Disconnected",
      color: "neutral",
      dotColor: "neutral.500",
    };
  }

  if (connection.expires_at) {
    const expiryDate = new Date(connection.expires_at);

    if (!Number.isNaN(expiryDate.getTime())) {
      const daysRemaining = differenceInCalendarDays(expiryDate, new Date());

      if (daysRemaining < 0) {
        return {
          label: "Expired",
          color: "danger",
          dotColor: "danger.500",
        };
      }

      if (daysRemaining <= 7) {
        return {
          label: "Expiring Soon",
          color: "warning",
          dotColor: "warning.500",
        };
      }
    }
  }

  return {
    label: "Connected",
    color: "success",
    dotColor: "success.500",
  };
};

const StatusDot = ({ color }: { color: string }) => {
  return (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: color,
      }}
    />
  );
};

const ConnectionCardSkeleton = () => {
  return (
    <Skeleton
      variant="rectangular"
      sx={{
        height: 180,
        borderRadius: "lg",
      }}
    />
  );
};

const ConnectPlatformCard = ({
  connected,
  loading,
  onClick,
  platform,
}: {
  connected: boolean;
  loading: boolean;
  onClick: () => void;
  platform: SupportedPlatformDefinition;
}) => {
  const Icon = platform.icon;

  return (
    <Card
      component="button"
      type="button"
      variant="soft"
      color="neutral"
      onClick={() => {
        if (!loading) {
          onClick();
        }
      }}
      sx={{
        width: "100%",
        p: 2.5,
        textAlign: "left",
        borderRadius: "lg",
        cursor: loading ? "progress" : "pointer",
        transition: "all 0.2s ease",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.level1",
        "&:hover": {
          bgcolor: "background.level2",
          boxShadow: "sm",
        },
        "&:focus-visible": {
          outline:
            "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.35)",
          outlineOffset: 2,
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar size="md" sx={platform.avatarSx}>
          <Icon size={18} />
        </Avatar>

        <Stack spacing={0.35} sx={{ flex: 1, minWidth: 0 }}>
          <Typography level="title-sm">{platform.label}</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {connected ? "Connect another account" : platform.description}
          </Typography>
        </Stack>

        {loading ? (
          <CircularProgress size="sm" />
        ) : (
          <ArrowRight
            size={16}
            style={{ color: "var(--joy-palette-text-tertiary)" }}
          />
        )}
      </Stack>
    </Card>
  );
};

const SocialConnectionManager = ({
  onConnectionsChange,
}: SocialConnectionManagerProps) => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<SupportedPlatformKey | null>(
    null,
  );
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(
    null,
  );
  const [disconnectTarget, setDisconnectTarget] =
    useState<DisconnectTarget | null>(null);
  const redirectUri = getOAuthRedirectUri();

  const fetchConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("social_connections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setConnections(data ?? []);
    } catch (error) {
      console.error("Error fetching connections:", error);
      toast.error("Unable to load your social connections right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const supportedConnections = useMemo(() => {
    return connections
      .filter(
        (connection) => getSupportedPlatform(connection.platform) !== null,
      )
      .sort((left, right) => {
        const leftTime = new Date(left.created_at).getTime();
        const rightTime = new Date(right.created_at).getTime();

        return rightTime - leftTime;
      });
  }, [connections]);

  useEffect(() => {
    onConnectionsChange?.(supportedConnections, loading);
  }, [loading, onConnectionsChange, supportedConnections]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === "SOCIAL_OAUTH_SUCCESS") {
        const platform =
          typeof event.data.platform === "string"
            ? event.data.platform
            : "social account";

        toast.success(`${platform} connected successfully.`);
        setConnecting(null);
        void fetchConnections();
      }

      if (event.data.type === "SOCIAL_OAUTH_ERROR") {
        const errorMessage =
          typeof event.data.error === "string"
            ? event.data.error
            : "Unable to finish the social connection flow.";

        toast.error(errorMessage);
        setConnecting(null);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [fetchConnections]);

  useEffect(() => {
    const pendingSuccess = sessionStorage.getItem("social_oauth_success");
    const pendingError = sessionStorage.getItem("social_oauth_error");

    if (pendingSuccess) {
      sessionStorage.removeItem("social_oauth_success");
      toast.success(pendingSuccess);
      setConnecting(null);
      void fetchConnections();
    }

    if (pendingError) {
      sessionStorage.removeItem("social_oauth_error");
      toast.error(pendingError);
      setConnecting(null);
    }
  }, [fetchConnections]);

  const connectMeta = useCallback(
    async (platformKey: SupportedPlatformKey) => {
      const platformLabel =
        platformKey === "instagram" ? "Instagram" : "Facebook";

      setConnecting(platformKey);

      try {
        sessionStorage.removeItem("oauth_state");
        localStorage.removeItem("oauth_state_backup");
        sessionStorage.removeItem("processed_oauth_codes");

        const state = crypto.randomUUID();
        const timestamp = Date.now().toString();
        const combinedState = `${state}-${timestamp}`;

        sessionStorage.setItem("oauth_state", combinedState);
        localStorage.setItem("oauth_state_backup", combinedState);

        const configData = await fetchOAuthConfig();
        const clientId = configData.clientId;
        const scope =
          "pages_read_engagement,pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights";
        const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");

        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("scope", scope);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("state", combinedState);

        const oauthTab = window.open(authUrl.toString(), "_blank");

        if (!oauthTab) {
          toast.error(
            `Please allow new tabs to connect ${platformLabel}. Click the button again after allowing.`,
          );
          setConnecting(null);
          return;
        }

        // Safety net: if the popup completes without postMessage (network
        // blip, cross-origin restriction, or the user closes the popup),
        // clear the connecting state on close and refetch so any successful
        // connection that didn't message back still appears.
        const pollInterval = window.setInterval(() => {
          if (oauthTab.closed) {
            window.clearInterval(pollInterval);
            setConnecting(null);
            void fetchConnections();
          }
        }, 500);
      } catch (error) {
        console.error(`Failed to connect ${platformKey}:`, error);
        toast.error(`Failed to connect ${platformLabel}. Please try again.`);
        setConnecting(null);
      }
    },
    [fetchConnections, redirectUri],
  );

  const disconnectPlatform = useCallback(
    async (connectionId: string, platform: string) => {
      try {
        setDisconnectingId(connectionId);

        const { error } = await supabase
          .from("social_connections")
          .delete()
          .eq("id", connectionId);

        if (error) {
          throw error;
        }

        setConnections((currentConnections) =>
          currentConnections.filter(
            (connection) => connection.id !== connectionId,
          ),
        );
        setDisconnectTarget(null);
        toast.success(`${platform} disconnected.`);
      } catch (error) {
        console.error("Error disconnecting platform:", error);
        toast.error(`Unable to disconnect ${platform} right now.`);
      } finally {
        setDisconnectingId(null);
      }
    },
    [],
  );

  const syncAnalytics = useCallback(async () => {
    try {
      setSyncing(true);

      const { data, error } = await supabase.functions.invoke("sync-analytics");

      void data;

      if (error) {
        throw error;
      }

      toast.success("Analytics sync started.");
    } catch (error) {
      console.error("Error syncing analytics:", error);
      toast.error("Unable to sync analytics right now.");
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleSyncConnection = useCallback(
    async (connectionId: string) => {
      setSyncingConnectionId(connectionId);

      try {
        await syncAnalytics();
      } finally {
        setSyncingConnectionId(null);
      }
    },
    [syncAnalytics],
  );

  const connectedPlatformKeys = useMemo(() => {
    return new Set(
      supportedConnections
        .filter((connection) => connection.is_active)
        .map((connection) => resolvePlatformKey(connection.platform))
        .filter(
          (platformKey): platformKey is SupportedPlatformKey =>
            platformKey === "facebook" || platformKey === "instagram",
        ),
    );
  }, [supportedConnections]);

  return (
    <Stack spacing={3}>
      {loading && supportedConnections.length === 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
            gap: 2,
          }}
        >
          <ConnectionCardSkeleton />
          <ConnectionCardSkeleton />
        </Box>
      ) : null}

      {!loading && supportedConnections.length === 0 ? (
        <Sheet
          variant="plain"
          sx={{
            minHeight: 400,
            borderRadius: "xl",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.surface",
            boxShadow: "sm",
            px: { xs: 3, md: 6 },
            py: { xs: 5, md: 7 },
          }}
        >
          <Stack
            spacing={2.5}
            alignItems="center"
            justifyContent="center"
            sx={{ minHeight: 1, textAlign: "center" }}
          >
            <Sheet
              variant="soft"
              color="neutral"
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Share2
                size={48}
                style={{ color: "var(--joy-palette-text-tertiary)" }}
              />
            </Sheet>

            <Stack spacing={1} alignItems="center">
              <Typography level="h4" textAlign="center">
                Connect Your Social Accounts
              </Typography>
              <Typography
                level="body-md"
                textAlign="center"
                sx={{ color: "text.secondary", maxWidth: 420 }}
              >
                Link your Facebook and Instagram accounts to publish content
                directly from BloomSuite.
              </Typography>
            </Stack>

            <Stack spacing={1.25} sx={{ width: "100%", maxWidth: 320 }}>
              {SUPPORTED_PLATFORMS.map((platform) => {
                const Icon = platform.icon;

                return (
                  <Button
                    key={platform.key}
                    size="lg"
                    variant="solid"
                    color="neutral"
                    loading={connecting === platform.key}
                    onClick={() => {
                      void connectMeta(platform.key);
                    }}
                    startDecorator={<Icon size={18} />}
                  >
                    {platform.connectLabel}
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        </Sheet>
      ) : null}

      {supportedConnections.length > 0 ? (
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "xl",
            borderColor: "divider",
            bgcolor: "background.surface",
            boxShadow: "sm",
            overflow: "hidden",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            sx={{
              px: { xs: 2.5, md: 3 },
              py: { xs: 2.5, md: 3 },
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={0.5}>
              <Typography level="title-lg">Connected Accounts</Typography>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                Review account health, sync analytics, and manage connected
                Facebook and Instagram profiles.
              </Typography>
            </Stack>

            <Button
              color="neutral"
              size="sm"
              variant="soft"
              startDecorator={
                loading ? (
                  <CircularProgress size="sm" />
                ) : (
                  <RefreshCw size={14} />
                )
              }
              onClick={() => {
                void fetchConnections();
              }}
            >
              Refresh
            </Button>
          </Stack>

          <Stack spacing={2.5} sx={{ p: { xs: 2.5, md: 3 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
                gap: 2,
              }}
            >
              {supportedConnections.map((connection) => {
                const platform = getSupportedPlatform(connection.platform);

                if (!platform) {
                  return null;
                }

                const Icon = platform.icon;
                const connectionStatus = resolveConnectionStatus(
                  connection,
                  disconnectingId,
                );
                const displayHandle = connection.username
                  ? `@${connection.username.replace(/^@/, "")}`
                  : connection.page_id
                    ? null
                    : connection.platform_account_name;
                const pageLabel =
                  connection.page_id && connection.platform_account_name
                    ? `Page: ${connection.platform_account_name}`
                    : null;

                return (
                  <Card
                    key={connection.id}
                    variant="outlined"
                    sx={{
                      borderRadius: "lg",
                      boxShadow: "sm",
                      transition: "all 0.2s ease",
                      borderColor: "divider",
                      bgcolor: "background.surface",
                      "&:hover": {
                        boxShadow: "md",
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2.5}>
                        <Stack
                          direction="row"
                          spacing={2}
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Stack
                            direction="row"
                            spacing={2}
                            sx={{ flex: 1, minWidth: 0 }}
                          >
                            <Avatar size="lg" sx={platform.avatarSx}>
                              <Icon size={20} />
                            </Avatar>

                            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                level="title-md"
                                sx={{ fontWeight: "lg" }}
                              >
                                {platform.label}
                              </Typography>
                              {displayHandle ? (
                                <Typography
                                  level="body-sm"
                                  sx={{
                                    color: "text.secondary",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {displayHandle}
                                </Typography>
                              ) : null}
                              {pageLabel ? (
                                <Typography
                                  level="body-sm"
                                  sx={{
                                    color: "text.tertiary",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {pageLabel}
                                </Typography>
                              ) : null}
                            </Stack>
                          </Stack>

                          <Chip
                            color={connectionStatus.color}
                            size="sm"
                            variant="soft"
                            startDecorator={
                              <StatusDot color={connectionStatus.dotColor} />
                            }
                            sx={{ flexShrink: 0 }}
                          >
                            {connectionStatus.label}
                          </Chip>
                        </Stack>

                        <Stack spacing={0.5}>
                          <Typography
                            level="body-xs"
                            sx={{ color: "text.tertiary" }}
                          >
                            Connected since:{" "}
                            {formatConnectionDate(connection.created_at)}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "text.tertiary" }}
                          >
                            {formatExpiryText(connection.expires_at)}
                          </Typography>
                        </Stack>

                        <Divider />

                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <Button
                            color="neutral"
                            size="sm"
                            variant="soft"
                            startDecorator={
                              syncingConnectionId === connection.id ? (
                                <CircularProgress size="sm" thickness={2.5} />
                              ) : (
                                <RefreshCw size={14} />
                              )
                            }
                            disabled={
                              syncing && syncingConnectionId !== connection.id
                            }
                            onClick={() => {
                              void handleSyncConnection(connection.id);
                            }}
                          >
                            {syncingConnectionId === connection.id
                              ? "Syncing..."
                              : "Sync Now"}
                          </Button>

                          <Button
                            color="danger"
                            size="sm"
                            variant="soft"
                            startDecorator={<X size={14} />}
                            disabled={Boolean(disconnectingId)}
                            onClick={() => {
                              setDisconnectTarget({
                                id: connection.id,
                                platformName: platform.label,
                                accountName: connection.platform_account_name,
                              });
                            }}
                          >
                            Disconnect
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "xl",
                p: { xs: 2.5, md: 3 },
                bgcolor: "background.surface",
                boxShadow: "sm",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Plus
                    size={16}
                    style={{ color: "var(--joy-palette-text-secondary)" }}
                  />
                  <Typography level="title-sm">
                    Connect a new account
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                    gap: 1.5,
                  }}
                >
                  {SUPPORTED_PLATFORMS.map((platform) => (
                    <ConnectPlatformCard
                      key={platform.key}
                      connected={connectedPlatformKeys.has(platform.key)}
                      loading={connecting === platform.key}
                      platform={platform}
                      onClick={() => {
                        void connectMeta(platform.key);
                      }}
                    />
                  ))}
                </Box>
              </Stack>
            </Sheet>

            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              By connecting you agree to our{" "}
              <Box
                component="a"
                href="https://brandsinblooms.com/pages/bloomsuite-privacy"
                rel="noopener noreferrer"
                sx={{ color: "text.primary", textDecoration: "underline" }}
                target="_blank"
              >
                Privacy Policy
              </Box>{" "}
              and{" "}
              <Box
                component="a"
                href="https://brandsinblooms.com/pages/terms-of-service"
                rel="noopener noreferrer"
                sx={{ color: "text.primary", textDecoration: "underline" }}
                target="_blank"
              >
                Terms
              </Box>
              .
            </Typography>
          </Stack>
        </Sheet>
      ) : null}

      <Modal
        open={Boolean(disconnectTarget)}
        onClose={() => {
          if (!disconnectingId) {
            setDisconnectTarget(null);
          }
        }}
      >
        <ModalDialog
          role="alertdialog"
          variant="outlined"
          sx={{
            minWidth: { xs: "calc(100vw - 32px)", sm: 440 },
            borderRadius: "lg",
            boxShadow: "lg",
            bgcolor: "background.surface",
          }}
        >
          <DialogTitle>
            {`Disconnect ${disconnectTarget?.platformName ?? "account"}?`}
          </DialogTitle>
          <DialogContent>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              {disconnectTarget
                ? `This will remove your ${disconnectTarget.platformName} connection${disconnectTarget.accountName ? ` for ${disconnectTarget.accountName}` : ""}. Scheduled posts for this account will not be published. You can reconnect at any time.`
                : "This will remove the selected connection. Scheduled posts for this account will not be published. You can reconnect at any time."}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ pt: 1.5 }}>
            <Button
              color="neutral"
              disabled={Boolean(disconnectingId)}
              variant="plain"
              onClick={() => setDisconnectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              disabled={disconnectingId === disconnectTarget?.id}
              variant="solid"
              startDecorator={
                disconnectingId === disconnectTarget?.id ? (
                  <CircularProgress size="sm" thickness={2.5} />
                ) : (
                  <X size={14} />
                )
              }
              onClick={() => {
                if (!disconnectTarget) {
                  return;
                }

                void disconnectPlatform(
                  disconnectTarget.id,
                  disconnectTarget.platformName,
                );
              }}
            >
              {disconnectingId === disconnectTarget?.id
                ? "Disconnecting..."
                : "Disconnect"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </Stack>
  );
};

export default SocialConnectionManager;
