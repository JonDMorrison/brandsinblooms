import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { BarChart3, Check, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchOAuthConfig } from "@/lib/api/oauth";
import MetaConnectionSuccess from "@/components/social/MetaConnectionSuccess";
import { getOAuthRedirectUri } from "@/utils/environmentUtils";
import { formatRelativeTime } from "@/components/analytics/analyticsUtils";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import {
  PLATFORM_CONFIG,
  PLATFORM_ORDER,
  resolvePlatformKey,
  resolvePlatformIcon,
  type PlatformKey,
} from "@/utils/platformConfig";

export interface SocialConnection {
  id: string;
  platform: string;
  platform_account_id: string;
  platform_account_name: string;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  is_active: boolean;
  permissions: string[];
  created_at: string;
}

interface SocialConnectionManagerProps {
  onConnectionsChange?: (
    connections: SocialConnection[],
    loading: boolean,
  ) => void;
  onOpenAnalyticsTab?: () => void;
  onOpenSchedulingTab?: () => void;
  onOpenPublishingSurface?: () => void;
}

type DisconnectTarget = {
  id: string;
  platformName: string;
  accountName?: string | null;
};

const PLATFORM_BEHAVIOR: Record<
  PlatformKey,
  { comingSoon: boolean; policyRequired: boolean }
> = {
  facebook: { comingSoon: false, policyRequired: true },
  instagram: { comingSoon: false, policyRequired: true },
  google_my_business: { comingSoon: true, policyRequired: false },
};

const PLATFORM_DEFINITIONS = PLATFORM_ORDER.map((platformKey) => ({
  key: platformKey,
  ...PLATFORM_CONFIG[platformKey],
  icon: resolvePlatformIcon(PLATFORM_CONFIG[platformKey].icon),
  ...PLATFORM_BEHAVIOR[platformKey],
}));

const SkeletonBlock = ({
  width,
  height,
  radius = "sm",
}: {
  width: number | string;
  height: number;
  radius?: string;
}) => {
  return (
    <Box
      sx={{
        width,
        height,
        borderRadius: radius,
        position: "relative",
        overflow: "hidden",
        bgcolor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          transform: "translateX(-100%)",
          background:
            "linear-gradient(90deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.14) 50%, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 100%)",
          animation: "social-connection-shimmer 1.4s ease-in-out infinite",
        },
        "@keyframes social-connection-shimmer": {
          to: { transform: "translateX(100%)" },
        },
      }}
    />
  );
};

const LoadingActions = () => {
  return (
    <Stack direction="row" spacing={1} useFlexGap>
      <SkeletonBlock width={96} height={32} radius="md" />
      <SkeletonBlock width={118} height={32} radius="md" />
    </Stack>
  );
};

const LoadingCard = () => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "md",
        p: 2,
        bgcolor: "background.surface",
        boxShadow: "none",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <SkeletonBlock width={20} height={20} radius="999px" />

        <Stack spacing={0.6} sx={{ flex: 1, minWidth: 220 }}>
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <SkeletonBlock width={124} height={16} radius="sm" />
            <SkeletonBlock width={92} height={22} radius="999px" />
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <SkeletonBlock width={88} height={22} radius="999px" />
            <SkeletonBlock width={164} height={12} radius="999px" />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap sx={{ ml: "auto" }}>
          <SkeletonBlock width={104} height={32} radius="md" />
        </Stack>
      </Box>
    </Sheet>
  );
};

const SocialConnectionManager = ({
  onConnectionsChange,
  onOpenAnalyticsTab,
  onOpenSchedulingTab,
  onOpenPublishingSurface,
}: SocialConnectionManagerProps) => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnectTarget, setDisconnectTarget] =
    useState<DisconnectTarget | null>(null);
  const [showSuccessView, setShowSuccessView] = useState(true);
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

      setConnections((data as SocialConnection[]) ?? []);
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

  useEffect(() => {
    onConnectionsChange?.(connections, loading);
  }, [connections, loading, onConnectionsChange]);

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
    async (platformId: string) => {
      setConnecting(platformId);

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

        console.log(
          "🔗 [SocialConnectionManager] Redirect URI Configuration:",
          {
            redirectUri,
            origin: window.location.origin,
            hostname: window.location.hostname,
            environment: window.location.hostname.includes("localhost")
              ? "development"
              : "production",
            timestamp: new Date().toISOString(),
          },
        );

        const scope =
          "pages_read_engagement,pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights";
        const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("scope", scope);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("state", combinedState);

        const oauthUrlStr = authUrl.toString();
        const oauthTab = window.open(oauthUrlStr, "_blank");

        if (!oauthTab) {
          toast.error(
            "Please allow new tabs to connect Facebook. Click the button again after allowing.",
          );
        }
      } catch (error) {
        console.error(`Failed to connect ${platformId}:`, error);
        toast.error(`Failed to connect ${platformId}. Please try again.`);
        setConnecting(null);
      }
    },
    [redirectUri],
  );

  const connectGoogleBusiness = useCallback(async () => {
    setConnecting("google_my_business");

    const clientId = "YOUR_GOOGLE_CLIENT_ID";
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = "https://www.googleapis.com/auth/business.manage";

    const authUrl = `https://accounts.google.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&access_type=offline`;

    void authUrl;
    setConnecting(null);
  }, []);

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

  const handleConnectPlatform = useCallback(
    async (platformId: string) => {
      if (platformId === "google_my_business") {
        await connectGoogleBusiness();
        return;
      }

      await connectMeta(platformId);
    },
    [connectGoogleBusiness, connectMeta],
  );

  const platforms = useMemo(() => {
    return PLATFORM_DEFINITIONS.map((platform) => {
      const connection = connections.find(
        (entry) =>
          (resolvePlatformKey(entry.platform) ?? entry.platform) ===
          platform.key,
      );

      return {
        ...platform,
        connection,
        isConnected: Boolean(connection),
        isExpired: connection
          ? new Date(connection.expires_at).getTime() < Date.now()
          : false,
      };
    }).sort((left, right) => {
      if (left.isConnected !== right.isConnected) {
        return left.isConnected ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
  }, [connections]);

  const facebookConnection = connections.find(
    (connection) =>
      (resolvePlatformKey(connection.platform) ?? connection.platform) ===
        "facebook" && connection.is_active,
  );
  const instagramConnection = connections.find(
    (connection) =>
      (resolvePlatformKey(connection.platform) ?? connection.platform) ===
        "instagram" && connection.is_active,
  );
  const bothMetaConnected = Boolean(facebookConnection && instagramConnection);

  if (bothMetaConnected && showSuccessView) {
    return (
      <MetaConnectionSuccess
        facebookConnection={facebookConnection}
        instagramConnection={instagramConnection}
        onSyncAnalytics={syncAnalytics}
        onOpenAnalytics={onOpenAnalyticsTab}
        onOpenScheduling={onOpenSchedulingTab}
        onOpenPublishing={onOpenPublishingSurface}
        onManageConnections={() => {
          setShowSuccessView(false);
        }}
      />
    );
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Typography level="title-lg">Social Connections</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Connect your social accounts to unlock analytics, scheduling, and
            publishing readiness.
          </Typography>
        </Stack>

        {loading && connections.length === 0 ? (
          <LoadingActions />
        ) : (
          <Stack direction="row" spacing={1} useFlexGap>
            <JoyButton
              color="neutral"
              disabled={loading}
              loading={loading}
              loadingPosition="start"
              size="sm"
              startDecorator={<RefreshCw size={14} />}
              sx={{
                bgcolor: "background.surface",
                "&:hover": {
                  bgcolor: "background.surface",
                },
              }}
              variant="outlined"
              onClick={() => {
                void fetchConnections();
              }}
            >
              Refresh
            </JoyButton>
            <JoyButton
              color="primary"
              disabled={connections.length === 0 || syncing}
              loading={syncing}
              loadingPosition="start"
              size="sm"
              startDecorator={<BarChart3 size={14} />}
              variant="solid"
              onClick={() => {
                void syncAnalytics();
              }}
            >
              Sync Analytics
            </JoyButton>
          </Stack>
        )}
      </Stack>

      {loading && connections.length === 0 ? (
        <Stack spacing={1.5}>
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </Stack>
      ) : null}

      {!loading && connections.length === 0 ? (
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "md",
            p: { xs: 2.5, md: 3 },
            bgcolor: "background.surface",
            boxShadow: "none",
          }}
        >
          <JoyEmptyState
            icon={
              <Box
                sx={{
                  color: "text.tertiary",
                  display: "inline-flex",
                  "& > .lucide": {
                    width: 32,
                    height: 32,
                  },
                }}
              >
                <Link2 />
              </Box>
            }
            title="No social accounts connected"
            description="Connect your first account to start tracking performance and preparing content for scheduling."
            primaryAction={{
              label: "Connect Account",
              color: "primary",
              loading: connecting === "facebook",
              onClick: () => {
                void handleConnectPlatform("facebook");
              },
              size: "sm",
              variant: "solid",
            }}
          />
        </Sheet>
      ) : null}

      {connections.length > 0 ? (
        <Stack spacing={1.5}>
          {platforms.map((platform) => {
            const Icon = platform.icon;

            return (
              <Sheet
                key={platform.key}
                variant="outlined"
                sx={{
                  borderRadius: "md",
                  p: 2,
                  bgcolor: "background.surface",
                  boxShadow: "none",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: platform.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} strokeWidth={1.9} />
                  </Box>

                  <Stack spacing={0.45} sx={{ flex: 1, minWidth: 220 }}>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      useFlexGap
                      flexWrap="wrap"
                      alignItems="center"
                    >
                      <Typography level="title-sm">{platform.label}</Typography>
                      {platform.comingSoon ? (
                        <JoyChip color="neutral" size="sm" variant="outlined">
                          Coming Soon
                        </JoyChip>
                      ) : null}
                    </Stack>

                    {platform.isConnected && platform.connection ? (
                      <Stack
                        direction="row"
                        spacing={0.75}
                        useFlexGap
                        flexWrap="wrap"
                        alignItems="center"
                      >
                        <JoyChip
                          color="success"
                          size="sm"
                          startDecorator={<Check size={12} />}
                          variant="soft"
                        >
                          Connected
                        </JoyChip>
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.tertiary" }}
                        >
                          as {platform.connection.platform_account_name}{" "}
                          {"\u00b7"}{" "}
                          {formatRelativeTime(platform.connection.created_at)}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography
                        level="body-xs"
                        sx={{ color: "text.tertiary" }}
                      >
                        {platform.comingSoon
                          ? "Google Business Profile support is reserved for a later milestone."
                          : "Connect this channel to unlock analytics and scheduling."}
                      </Typography>
                    )}
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ ml: "auto" }}
                  >
                    {platform.isConnected && platform.connection ? (
                      <>
                        {platform.isExpired ? (
                          <JoyButton
                            color="neutral"
                            loading={connecting === platform.key}
                            loadingPosition="start"
                            size="sm"
                            variant="plain"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleConnectPlatform(platform.key);
                            }}
                          >
                            Reconnect
                          </JoyButton>
                        ) : null}
                        <JoyButton
                          color="neutral"
                          disabled={disconnectingId === platform.connection.id}
                          size="sm"
                          variant="outlined"
                          onClick={() =>
                            setDisconnectTarget({
                              id: platform.connection.id,
                              platformName: platform.label,
                              accountName:
                                platform.connection.platform_account_name,
                            })
                          }
                        >
                          Disconnect
                        </JoyButton>
                      </>
                    ) : platform.comingSoon ? (
                      <JoyButton
                        color="neutral"
                        disabled
                        size="sm"
                        variant="outlined"
                      >
                        Coming Soon
                      </JoyButton>
                    ) : (
                      <JoyButton
                        color="primary"
                        loading={connecting === platform.key}
                        loadingPosition="start"
                        size="sm"
                        variant="solid"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleConnectPlatform(platform.key);
                        }}
                      >
                        Connect
                      </JoyButton>
                    )}
                  </Stack>
                </Box>
              </Sheet>
            );
          })}
        </Stack>
      ) : null}

      {connections.length > 0 && !loading ? (
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
          sx={{
            minWidth: { xs: "calc(100vw - 32px)", sm: 420 },
            bgcolor: "background.surface",
            borderRadius: "md",
            boxShadow: "lg",
          }}
        >
          <DialogTitle>{`Disconnect ${disconnectTarget?.platformName ?? "account"}?`}</DialogTitle>
          <DialogContent>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              {disconnectTarget
                ? `This will remove access to ${disconnectTarget.platformName} analytics and publishing. You can reconnect at any time.`
                : "This will remove access to the selected platform analytics and publishing. You can reconnect at any time."}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ pt: 1.5 }}>
            <JoyButton
              color="neutral"
              disabled={Boolean(disconnectingId)}
              size="sm"
              variant="outlined"
              onClick={() => setDisconnectTarget(null)}
            >
              Cancel
            </JoyButton>
            <JoyButton
              color="danger"
              loading={disconnectingId === disconnectTarget?.id}
              loadingPosition="start"
              size="sm"
              variant="solid"
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
              Disconnect
            </JoyButton>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </Stack>
  );
};

export default SocialConnectionManager;
