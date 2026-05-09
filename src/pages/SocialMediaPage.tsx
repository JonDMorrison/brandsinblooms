import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CheckCircle2, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import PostPerformanceTracker from "@/components/analytics/PostPerformanceTracker";
import SocialConnectionManager, {
  type SocialConnection,
} from "@/components/analytics/SocialConnectionManager";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import AutoScheduler from "@/components/scheduling/AutoScheduler";
import { resolvePlatformKey } from "@/utils/platformConfig";

const IMPLEMENTED_PLATFORM_COUNT = 2;
const SUCCESS_ALERT_AUTO_DISMISS_MS = 5000;
const SUCCESS_ALERT_FADE_MS = 240;

type ConnectionSnapshot = {
  connections: SocialConnection[];
  loading: boolean;
};

type SuccessAlertState = {
  message: string;
  returnTo: string | null;
};

const HeaderStat = ({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        minWidth: 112,
        borderRadius: "lg",
        px: 2,
        py: 1.25,
        bgcolor: "background.surface",
        boxShadow: "sm",
        borderColor: "divider",
      }}
    >
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        {label}
      </Typography>
      <Typography level="title-sm" sx={{ color: valueColor ?? "text.primary" }}>
        {value}
      </Typography>
    </Sheet>
  );
};

const parseConnectionSuccessMessage = (rawValue: string | null) => {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { message?: string };

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    if (rawValue.trim()) {
      return rawValue.trim();
    }
  }

  return "Social account connected successfully.";
};

const SocialMediaPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("connections");
  const [successAlert, setSuccessAlert] = useState<SuccessAlertState | null>(
    null,
  );
  const [isSuccessAlertClosing, setIsSuccessAlertClosing] = useState(false);
  const [connectionSnapshot, setConnectionSnapshot] =
    useState<ConnectionSnapshot>({
      connections: [],
      loading: true,
    });

  const justConnected = searchParams.get("connected");
  const alertMessage = searchParams.get("message");
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    if (!justConnected) {
      return;
    }

    setSuccessAlert({
      message:
        typeof alertMessage === "string" && alertMessage.trim()
          ? alertMessage.trim()
          : "Social account connected successfully.",
      returnTo,
    });
    setSearchParams({}, { replace: true });
  }, [alertMessage, justConnected, returnTo, setSearchParams]);

  useEffect(() => {
    if (justConnected) {
      return;
    }

    const pendingSuccess = sessionStorage.getItem("social_connection_success");

    if (!pendingSuccess) {
      return;
    }

    sessionStorage.removeItem("social_connection_success");

    const message = parseConnectionSuccessMessage(pendingSuccess);

    if (message) {
      setSuccessAlert({ message, returnTo: null });
    }
  }, [justConnected]);

  useEffect(() => {
    if (!successAlert) {
      return;
    }

    setIsSuccessAlertClosing(false);

    const fadeTimer = window.setTimeout(() => {
      setIsSuccessAlertClosing(true);
    }, SUCCESS_ALERT_AUTO_DISMISS_MS - SUCCESS_ALERT_FADE_MS);

    const dismissTimer = window.setTimeout(() => {
      const redirectTarget = successAlert.returnTo;

      setSuccessAlert(null);
      setIsSuccessAlertClosing(false);

      if (redirectTarget) {
        navigate(redirectTarget);
      }
    }, SUCCESS_ALERT_AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [navigate, successAlert]);

  const handleDismissSuccessAlert = useCallback(() => {
    setIsSuccessAlertClosing(true);

    window.setTimeout(() => {
      setSuccessAlert(null);
      setIsSuccessAlertClosing(false);
    }, SUCCESS_ALERT_FADE_MS);
  }, []);

  const handleConnectionsChange = useCallback(
    (connections: SocialConnection[], loading: boolean) => {
      setConnectionSnapshot({ connections, loading });
    },
    [],
  );

  const connectionStats = useMemo(() => {
    const activePlatforms = new Set(
      connectionSnapshot.connections
        .filter((connection) => {
          const platformKey = resolvePlatformKey(connection.platform);

          return (
            connection.is_active &&
            (platformKey === "facebook" || platformKey === "instagram")
          );
        })
        .map((connection) => resolvePlatformKey(connection.platform)),
    );

    if (
      connectionSnapshot.loading &&
      connectionSnapshot.connections.length === 0
    ) {
      return {
        connectedCount: "-",
        platformCount: String(IMPLEMENTED_PLATFORM_COUNT),
        healthLabel: "-",
        healthColor: "text.primary",
      };
    }

    const connectedCount = activePlatforms.size;
    let healthLabel = "Needs attention";
    let healthColor = "warning.700";

    if (connectedCount === IMPLEMENTED_PLATFORM_COUNT) {
      healthLabel = "Healthy";
      healthColor = "success.700";
    } else if (connectedCount === 0) {
      healthLabel = "Not connected";
      healthColor = "neutral.700";
    }

    return {
      connectedCount: String(connectedCount),
      platformCount: String(IMPLEMENTED_PLATFORM_COUNT),
      healthLabel,
      healthColor,
    };
  }, [connectionSnapshot.connections, connectionSnapshot.loading]);

  return (
    <ProtectedPageWrapper>
      <PageContainer sx={{ py: 3 }}>
        <Stack spacing={3}>
          <JoyPageHeaderBand
            title="Social Media"
            description="Manage your social accounts and content"
            metadata={
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <HeaderStat
                  label="Connected"
                  value={connectionStats.connectedCount}
                />
                <HeaderStat
                  label="Platforms"
                  value={connectionStats.platformCount}
                />
                <HeaderStat
                  label="Health"
                  value={connectionStats.healthLabel}
                  valueColor={connectionStats.healthColor}
                />
              </Stack>
            }
            sx={{
              background: "none",
              bgcolor: "background.surface",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "sm",
            }}
          />

          {successAlert ? (
            <Box
              sx={{
                opacity: isSuccessAlertClosing ? 0 : 1,
                transform: isSuccessAlertClosing
                  ? "translateY(-6px)"
                  : "translateY(0)",
                transition: `opacity ${SUCCESS_ALERT_FADE_MS}ms ease, transform ${SUCCESS_ALERT_FADE_MS}ms ease`,
              }}
            >
              <Alert
                color="success"
                variant="soft"
                startDecorator={<CheckCircle2 size={16} />}
                endDecorator={
                  <IconButton
                    color="neutral"
                    size="sm"
                    variant="plain"
                    onClick={handleDismissSuccessAlert}
                  >
                    <X size={14} />
                  </IconButton>
                }
                sx={{
                  alignItems: "center",
                  borderRadius: "lg",
                  boxShadow: "sm",
                }}
              >
                {successAlert.message}
              </Alert>
            </Box>
          ) : null}

          <JoyTabs
            aria-label="Social media workspace tabs"
            value={activeTab}
            onValueChange={(value) => {
              if (typeof value === "string") {
                setActiveTab(value);
              }
            }}
          >
            <JoyTabsList
              sx={{
                alignSelf: "flex-start",
                width: "fit-content",
                maxWidth: "100%",
                flexWrap: "wrap",
                gap: 1,
                p: 0,
                border: "none",
                borderRadius: 0,
                bgcolor: "transparent",
                boxShadow: "none",
                [`& .MuiTab-root`]: {
                  minHeight: 40,
                  px: 2.5,
                  borderRadius: "lg",
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.surface",
                  boxShadow: "xs",
                  whiteSpace: "nowrap",
                  flex: "0 0 auto",
                },
                [`& .Mui-selected`]: {
                  bgcolor: "background.level1",
                  color: "text.primary",
                  borderColor: "primary.200",
                },
              }}
            >
              <JoyTabsTrigger value="connections">Connections</JoyTabsTrigger>
              <JoyTabsTrigger value="analytics">Analytics</JoyTabsTrigger>
              <JoyTabsTrigger value="scheduling">
                Auto-Scheduling
              </JoyTabsTrigger>
            </JoyTabsList>

            <JoyTabsContent value="connections">
              <SocialConnectionManager
                onConnectionsChange={handleConnectionsChange}
              />
            </JoyTabsContent>

            <JoyTabsContent value="analytics">
              <PostPerformanceTracker />
            </JoyTabsContent>

            <JoyTabsContent value="scheduling">
              <AutoScheduler />
            </JoyTabsContent>
          </JoyTabs>
        </Stack>
      </PageContainer>
    </ProtectedPageWrapper>
  );
};

export default SocialMediaPage;
