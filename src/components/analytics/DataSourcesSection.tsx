import { useState } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { Globe, Mail, RefreshCw, Share2, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import {
  formatRelativeTimestamp,
  normalizePlatformLabel,
  normalizeProviderLabel,
} from "@/components/analytics/analyticsUtils";

type GASettingsSnapshot = {
  connection_status?: string;
  last_pull_at?: string | null;
  last_test_at?: string | null;
  property_name?: string | null;
};

type DataSourcesSectionProps = {
  gaError?: string | null;
  gaLoading?: boolean;
  gaSettings?: GASettingsSnapshot | null;
  onSyncComplete?: () => void | Promise<unknown>;
};

type DataSourceCard = {
  actionLabel: string;
  description: string;
  detail?: string;
  icon: React.ReactNode;
  id: string;
  lastSync?: string | null;
  route: string;
  status: "connected" | "error" | "not-connected";
  title: string;
};

export function DataSourcesSection({
  gaError,
  gaLoading = false,
  gaSettings,
  onSyncComplete,
}: DataSourcesSectionProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const { data, error, isLoading, refetch } = useQuery<DataSourceCard[]>({
    queryKey: [
      "analytics-data-sources",
      user?.id,
      tenant?.id,
      gaSettings?.last_pull_at,
    ],
    enabled: Boolean(user?.id && tenant?.id),
    queryFn: async () => {
      if (!user?.id || !tenant?.id) {
        return [];
      }

      const [
        socialConnections,
        providerConnections,
        squareConnections,
        cloverConnections,
      ] = await Promise.all([
        supabase
          .from("social_connections")
          .select("platform, platform_account_name, updated_at")
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase
          .from("provider_connections")
          .select("provider, provider_account_name, updated_at")
          .eq("tenant_id", tenant.id)
          .eq("status", "connected")
          .in("provider", ["mailchimp", "klaviyo"]),
        supabase
          .from("square_connections")
          .select("merchant_name, last_synced_at")
          .eq("tenant_id", tenant.id)
          .in("status", ["active", "connected"])
          .limit(1),
        supabase
          .from("clover_connections")
          .select("merchant_name, last_synced_at")
          .eq("tenant_id", tenant.id)
          .in("status", ["active", "connected"])
          .limit(1),
      ]);

      const activePosConnection =
        squareConnections.data?.[0] ?? cloverConnections.data?.[0] ?? null;
      const socialPlatforms = Array.from(
        new Set(
          (socialConnections.data ?? []).map((connection) =>
            normalizePlatformLabel(connection.platform),
          ),
        ),
      );
      const mostRecentSocialSync = (socialConnections.data ?? []).reduce<
        string | null
      >((latest, connection) => {
        if (!latest) {
          return connection.updated_at;
        }

        return new Date(connection.updated_at).getTime() >
          new Date(latest).getTime()
          ? connection.updated_at
          : latest;
      }, null);
      const mostRecentProviderSync = (providerConnections.data ?? []).reduce<
        string | null
      >((latest, connection) => {
        if (!latest) {
          return connection.updated_at;
        }

        return new Date(connection.updated_at).getTime() >
          new Date(latest).getTime()
          ? connection.updated_at
          : latest;
      }, null);

      return [
        {
          actionLabel: activePosConnection ? "Configure" : "Connect",
          description: "Customers, orders, and loyalty data",
          detail: activePosConnection?.merchant_name ?? undefined,
          icon: <Store size={20} />,
          id: "pos",
          lastSync: activePosConnection?.last_synced_at ?? null,
          route: "/crm/pos",
          status: activePosConnection ? "connected" : "not-connected",
          title: activePosConnection?.merchant_name
            ? `POS (${activePosConnection.merchant_name})`
            : "POS",
        },
        {
          actionLabel:
            gaSettings?.connection_status === "connected"
              ? "Configure"
              : "Connect",
          description: "Website traffic and visitor behavior",
          detail: gaSettings?.property_name ?? undefined,
          icon: <Globe size={20} />,
          id: "google-analytics",
          lastSync:
            gaSettings?.last_pull_at ?? gaSettings?.last_test_at ?? null,
          route: "/integrations",
          status:
            gaError || gaSettings?.connection_status === "error"
              ? "error"
              : gaSettings?.connection_status === "connected"
                ? "connected"
                : "not-connected",
          title: "Google Analytics",
        },
        {
          actionLabel: socialPlatforms.length ? "Configure" : "Connect",
          description: "Facebook, Instagram, and Google Business signals",
          detail: socialPlatforms.length
            ? socialPlatforms.join(", ")
            : undefined,
          icon: <Share2 size={20} />,
          id: "social-media",
          lastSync: mostRecentSocialSync,
          route: "/social-accounts",
          status: socialPlatforms.length ? "connected" : "not-connected",
          title: "Social Media",
        },
        {
          actionLabel:
            (providerConnections.data?.length ?? 0) > 0
              ? "Configure"
              : "Connect",
          description: "Provider-connected email and CRM delivery sources",
          detail:
            (providerConnections.data ?? [])
              .map((connection) => normalizeProviderLabel(connection.provider))
              .join(", ") || undefined,
          icon: <Mail size={20} />,
          id: "email-crm",
          lastSync: mostRecentProviderSync,
          route: "/integrations",
          status:
            (providerConnections.data?.length ?? 0) > 0
              ? "connected"
              : "not-connected",
          title: "Email / CRM",
        },
      ];
    },
  });

  const handleSyncSocialData = async () => {
    setSyncing(true);

    try {
      const { error } = await supabase.functions.invoke("sync-analytics");

      if (error) {
        throw error;
      }

      toast.success("Social data synced successfully");
      await refetch();
      await onSyncComplete?.();
    } catch (error) {
      console.error("Failed to sync social data", error);
      toast.error("Failed to sync social data");
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading || gaLoading) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader title="Data Sources" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {Array.from({ length: 4 }).map((_, index) => (
              <Sheet
                key={index}
                variant="outlined"
                sx={{ p: 1.5, borderRadius: "md", minWidth: 220 }}
              >
                <Typography level="body-sm" sx={{ color: "neutral.400" }}>
                  Loading source {index + 1}
                </Typography>
              </Sheet>
            ))}
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (error) {
    return (
      <JoyCard variant="soft" color="danger">
        <JoyCardHeader title="Data Sources" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm">
              Failed to load connected platform status.
            </Typography>
            <JoyButton
              size="sm"
              variant="soft"
              color="danger"
              onClick={() => void refetch()}
            >
              Retry
            </JoyButton>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Data Sources"
        description="Connected platforms and sync status"
        actions={
          <JoyTooltip title="This action currently syncs social analytics from connected social accounts.">
            <JoyButton
              size="sm"
              variant="soft"
              color="neutral"
              startDecorator={<RefreshCw size={14} />}
              onClick={() => void handleSyncSocialData()}
              loading={syncing}
            >
              Sync Social Data
            </JoyButton>
          </JoyTooltip>
        }
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {(data ?? []).map((source) => (
            <Sheet
              key={source.id}
              variant="outlined"
              sx={{
                borderRadius: "md",
                p: 1.5,
                minWidth: { xs: "100%", sm: 240 },
                flex: "1 1 240px",
              }}
            >
              <Stack spacing={1.1}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1.5}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Sheet
                      variant="soft"
                      color={
                        source.status === "connected"
                          ? "success"
                          : source.status === "error"
                            ? "danger"
                            : "neutral"
                      }
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {source.icon}
                    </Sheet>
                    <Stack spacing={0.2}>
                      <Typography
                        level="body-sm"
                        sx={{ color: "neutral.900", fontWeight: 700 }}
                      >
                        {source.title}
                      </Typography>
                      {source.detail ? (
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          {source.detail}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                  <JoyChip
                    size="sm"
                    variant="soft"
                    color={
                      source.status === "connected"
                        ? "success"
                        : source.status === "error"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {source.status === "connected"
                      ? "Connected"
                      : source.status === "error"
                        ? "Error"
                        : "Not Connected"}
                  </JoyChip>
                </Stack>

                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  {source.description}
                </Typography>
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  Last synced {formatRelativeTimestamp(source.lastSync)}
                </Typography>

                <JoyButton
                  size="sm"
                  variant="plain"
                  color="primary"
                  onClick={() => navigate(source.route)}
                >
                  {source.actionLabel}
                </JoyButton>
              </Stack>
            </Sheet>
          ))}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
