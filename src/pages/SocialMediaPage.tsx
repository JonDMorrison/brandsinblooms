import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tab, { tabClasses } from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import PostPerformanceTracker from "@/components/analytics/PostPerformanceTracker";
import SocialConnectionManager, {
  type SocialConnection,
} from "@/components/analytics/SocialConnectionManager";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import AutoScheduler from "@/components/scheduling/AutoScheduler";
import { resolvePlatformKey } from "@/utils/platformConfig";

const AVAILABLE_PLATFORM_COUNT = 3;

type ConnectionSnapshot = {
  connections: SocialConnection[];
  loading: boolean;
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
        minWidth: 108,
        borderRadius: "sm",
        px: 1.5,
        py: 1,
        bgcolor: "background.surface",
        boxShadow: "none",
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

const SocialMediaPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [activeTab, setActiveTab] = useState("connections");
  const [connectionSnapshot, setConnectionSnapshot] =
    useState<ConnectionSnapshot>({
      connections: [],
      loading: true,
    });

  const justConnected = searchParams.get("connected");
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    if (!justConnected) {
      return;
    }

    setShowSuccessMessage(true);
    setSearchParams({}, { replace: true });

    const timer = window.setTimeout(() => {
      setShowSuccessMessage(false);

      if (returnTo) {
        navigate(returnTo);
      }
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [justConnected, navigate, returnTo, setSearchParams]);

  const handleConnectionsChange = useCallback(
    (connections: SocialConnection[], loading: boolean) => {
      setConnectionSnapshot({ connections, loading });
    },
    [],
  );

  const connectionStats = useMemo(() => {
    const activePlatforms = new Set(
      connectionSnapshot.connections
        .filter((connection) => connection.is_active)
        .map(
          (connection) =>
            resolvePlatformKey(connection.platform) ?? connection.platform,
        ),
    );

    if (connectionSnapshot.loading) {
      return {
        connectedCount: "-",
        platformCount: String(AVAILABLE_PLATFORM_COUNT),
        healthLabel: "-",
        healthColor: "text.primary",
      };
    }

    const connectedCount = activePlatforms.size;
    const healthLabel =
      connectedCount === AVAILABLE_PLATFORM_COUNT
        ? "Healthy"
        : "Needs attention";

    return {
      connectedCount: String(connectedCount),
      platformCount: String(AVAILABLE_PLATFORM_COUNT),
      healthLabel,
      healthColor:
        connectedCount === AVAILABLE_PLATFORM_COUNT
          ? "success.plainColor"
          : "warning.plainColor",
    };
  }, [connectionSnapshot.connections, connectionSnapshot.loading]);

  return (
    <ProtectedPageWrapper>
      <Box sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", lg: "flex-start" },
                gap: 2,
              }}
            >
              <Stack spacing={0.5} sx={{ maxWidth: 720 }}>
                <Typography level="h3" sx={{ fontWeight: "lg" }}>
                  Social Media
                </Typography>
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                  Connect, monitor, and automate your social presence.
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  justifyContent: { xs: "flex-start", lg: "flex-end" },
                  width: { xs: "100%", lg: "auto" },
                }}
              >
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
              </Box>
            </Box>

            <Typography
              level="body-xs"
              sx={{ mt: 1.5, color: "text.tertiary" }}
            >
              Keep connections current, monitor real performance, and manage
              scheduling from this workspace.
            </Typography>
          </Box>

          {showSuccessMessage ? (
            <Alert
              color="success"
              size="sm"
              variant="soft"
              endDecorator={
                <IconButton
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={() => setShowSuccessMessage(false)}
                >
                  <X size={14} />
                </IconButton>
              }
              sx={{ alignItems: "center" }}
            >
              Social account connected successfully.
            </Alert>
          ) : null}

          <Tabs
            aria-label="Social account tabs"
            value={activeTab}
            onChange={(_event, value) => {
              if (typeof value === "string") {
                setActiveTab(value);
              }
            }}
            sx={{ bgcolor: "transparent" }}
          >
            <Box
              sx={{
                mb: 3,
                p: 0.75,
                borderRadius: "xl",
                bgcolor: "neutral.100",
                width: "fit-content",
              }}
            >
              <TabList
                disableUnderline
                sx={{
                  p: 0.5,
                  gap: 0.5,
                  borderRadius: "lg",
                  bgcolor: "transparent",
                  width: "fit-content",
                  [`& .${tabClasses.root}`]: {
                    borderRadius: "lg",
                    minHeight: 36,
                    px: 2,
                    color: "neutral.600",
                  },
                  [`& .${tabClasses.root}[aria-selected="true"]`]: {
                    boxShadow: "sm",
                    bgcolor: "common.white",
                    color: "neutral.800",
                  },
                }}
              >
                <Tab disableIndicator value="connections">
                  Connections
                </Tab>
                <Tab disableIndicator value="analytics">
                  Analytics
                </Tab>
                <Tab disableIndicator value="scheduling">
                  Auto-Scheduling
                </Tab>
              </TabList>
            </Box>

            <TabPanel value="connections" sx={{ px: 0 }}>
              <SocialConnectionManager
                onConnectionsChange={handleConnectionsChange}
                onOpenAnalyticsTab={() => setActiveTab("analytics")}
                onOpenSchedulingTab={() => setActiveTab("scheduling")}
                onOpenPublishingSurface={() => navigate("/crm/campaigns")}
              />
            </TabPanel>

            <TabPanel value="analytics" sx={{ px: 0 }}>
              <PostPerformanceTracker />
            </TabPanel>

            <TabPanel value="scheduling" sx={{ px: 0 }}>
              <AutoScheduler />
            </TabPanel>
          </Tabs>
        </Stack>
      </Box>
    </ProtectedPageWrapper>
  );
};

export default SocialMediaPage;
