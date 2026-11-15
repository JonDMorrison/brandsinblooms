import { forwardRef } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import ListDivider from "@mui/joy/ListDivider";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, BookOpen, History, MoreHorizontal, RefreshCw, Unplug } from "lucide-react";
import type { POSSyncLog } from "@/hooks/usePOSConnections";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { formatDateTimeValue } from "@/components/integrations/shared/dataTabPrimitives";
import {
  type ConnectionInsight,
  formatImportSummary,
  getFailureGuidance,
  getLogOutcome,
  type SyncLogOutcome,
} from "./connectionsModel";
import { DataScopeTags, HealthChip, IntegrationLogo, RelativeTime } from "./ConnectionsPrimitives";
import { interactiveSurfaceSx, softPressSx } from "./connectionsStyles";

const OUTCOME_COLOR: Record<SyncLogOutcome, string> = {
  success: "success.400",
  failed: "danger.400",
  running: "primary.300",
  unknown: "neutral.300",
};

const OUTCOME_LABEL: Record<SyncLogOutcome, string> = {
  success: "Succeeded",
  failed: "Failed",
  running: "In progress",
  unknown: "Unknown",
};

const describeLog = (log: POSSyncLog) => {
  const outcome = getLogOutcome(log);
  const counts = outcome === "success" ? formatImportSummary(log) : null;
  return [OUTCOME_LABEL[outcome], formatDateTimeValue(log.completed_at ?? log.started_at), counts]
    .filter(Boolean)
    .join(" · ");
};

/** Oldest → newest row of bars, one per recent sync. */
const SyncTimeline = ({ logs, onOpen }: { logs: POSSyncLog[]; onOpen: () => void }) => {
  if (logs.length === 0) return null;
  const chronological = [...logs].reverse();

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        Recent syncs
      </Typography>
      <Box
        aria-label={`Recent sync history: ${chronological.map((log) => OUTCOME_LABEL[getLogOutcome(log)]).join(", ")}. Open full history.`}
        component="button"
        onClick={onOpen}
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: "3px",
          p: 0.5,
          m: -0.5,
          border: 0,
          bgcolor: "transparent",
          borderRadius: "6px",
          cursor: "pointer",
          "&:focus-visible": { outline: "2px solid", outlineColor: "focusVisible", outlineOffset: 1 },
        }}
        type="button"
      >
        {chronological.map((log) => (
          <JoyTooltip key={log.id} size="sm" title={describeLog(log)}>
            <Box
              sx={{
                width: 6,
                height: getLogOutcome(log) === "failed" ? 16 : 12,
                borderRadius: "3px",
                bgcolor: OUTCOME_COLOR[getLogOutcome(log)],
              }}
            />
          </JoyTooltip>
        ))}
      </Box>
    </Stack>
  );
};

interface ConnectedIntegrationCardProps {
  insight: ConnectionInsight;
  syncDisabled: boolean;
  onSync: () => void;
  onOpenHistory: () => void;
  onOpenGuide: () => void;
  onDisconnect: () => void;
}

export const ConnectedIntegrationCard = forwardRef<HTMLDivElement, ConnectedIntegrationCardProps>(
  ({ insight, syncDisabled, onSync, onOpenHistory, onOpenGuide, onDisconnect }, ref) => {
    const { connection, platform, health, logs, lastSuccessAt, lastSuccessfulLog, errorMessage } = insight;
    const displayName = connection.name || platform.name;
    const isSyncing = health === "syncing";
    const importSummary = formatImportSummary(lastSuccessfulLog);
    const guidance = health === "attention" ? getFailureGuidance(platform, errorMessage) : null;

    return (
      <Sheet
        ref={ref}
        aria-label={`${displayName} connection`}
        component="article"
        tabIndex={-1}
        variant="outlined"
        sx={{
          ...interactiveSurfaceSx,
          position: "relative",
          overflow: "hidden",
          borderColor: health === "attention" ? "danger.outlinedBorder" : "neutral.outlinedBorder",
          "&:focus-visible": { outline: "2px solid", outlineColor: "focusVisible", outlineOffset: 2 },
        }}
      >
        <Stack spacing={2} sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "flex-start" }}
          >
            <Stack direction="row" spacing={1.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
              <IntegrationLogo logo={platform.logo} name={platform.name} />
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography level="title-md" sx={{ color: "text.primary", wordBreak: "break-word" }}>
                    {displayName}
                  </Typography>
                  <HealthChip health={health} />
                </Stack>
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                  {platform.name !== displayName ? `${platform.name} · ` : ""}
                  {platform.category}
                </Typography>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
              <JoyButton
                color="neutral"
                disabled={syncDisabled || !connection.is_active}
                loading={isSyncing}
                loadingPosition="start"
                onClick={onSync}
                size="sm"
                startDecorator={<RefreshCw size={15} />}
                sx={{ ...softPressSx, flex: { xs: 1, sm: "initial" } }}
                variant="outlined"
              >
                {isSyncing ? "Syncing…" : "Sync now"}
              </JoyButton>
              <Dropdown>
                <MenuButton
                  aria-label={`More actions for ${displayName}`}
                  slots={{ root: IconButton }}
                  slotProps={{ root: { color: "neutral", size: "sm", variant: "outlined", sx: softPressSx } }}
                >
                  <MoreHorizontal size={16} />
                </MenuButton>
                <Menu
                  placement="bottom-end"
                  size="sm"
                  sx={{ borderRadius: "14px", bgcolor: "background.surface", boxShadow: "md", minWidth: 200, zIndex: 1300 }}
                >
                  <MenuItem onClick={onOpenHistory}>
                    <ListItemDecorator>
                      <History size={15} />
                    </ListItemDecorator>
                    Sync history
                  </MenuItem>
                  <MenuItem onClick={onOpenGuide}>
                    <ListItemDecorator>
                      <BookOpen size={15} />
                    </ListItemDecorator>
                    Setup guide
                  </MenuItem>
                  <ListDivider />
                  <MenuItem color="danger" onClick={onDisconnect}>
                    <ListItemDecorator>
                      <Unplug size={15} />
                    </ListItemDecorator>
                    Disconnect…
                  </MenuItem>
                </Menu>
              </Dropdown>
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 1.25, md: 3 }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            sx={{ pl: { sm: "54px" } }}
          >
            <Stack spacing={0.75} sx={{ minWidth: 0 }}>
              <Typography level="body-sm" sx={{ color: "text.primary" }}>
                {isSyncing ? (
                  "Syncing now — new data will appear here shortly."
                ) : lastSuccessAt ? (
                  <>
                    <RelativeTime component="span" level="body-sm" prefix="Last synced" sx={{ color: "inherit" }} value={lastSuccessAt} />
                    {importSummary ? (
                      <Typography component="span" sx={{ color: "text.secondary" }}>
                        {" "}· {importSummary}
                      </Typography>
                    ) : null}
                  </>
                ) : health === "inactive" ? (
                  "This connection is turned off and is not syncing."
                ) : (
                  "Connected. Run your first sync to bring in customers and sales."
                )}
              </Typography>
              <DataScopeTags scopes={platform.dataScopes} />
            </Stack>
            <SyncTimeline logs={logs} onOpen={onOpenHistory} />
          </Stack>

          {guidance ? (
            <Alert
              color="danger"
              startDecorator={<AlertTriangle size={18} />}
              sx={{ alignItems: "flex-start", borderRadius: "14px", ml: { sm: "54px" } }}
              variant="soft"
            >
              <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                <Stack spacing={0.25}>
                  <Typography level="title-sm" sx={{ color: "inherit" }}>
                    {guidance.summary}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "inherit", opacity: 0.9 }}>
                    {guidance.nextStep}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyButton
                    color="danger"
                    disabled={syncDisabled}
                    onClick={guidance.reconnectRecommended ? onOpenGuide : onSync}
                    size="sm"
                    startDecorator={guidance.reconnectRecommended ? <BookOpen size={15} /> : <RefreshCw size={15} />}
                    sx={softPressSx}
                    variant="solid"
                  >
                    {guidance.reconnectRecommended ? "How to reconnect" : "Retry sync"}
                  </JoyButton>
                  <JoyButton
                    color="danger"
                    disabled={syncDisabled}
                    onClick={guidance.reconnectRecommended ? onSync : onOpenGuide}
                    size="sm"
                    sx={softPressSx}
                    variant="plain"
                  >
                    {guidance.reconnectRecommended ? "Retry sync" : "Setup guide"}
                  </JoyButton>
                  <JoyButton color="danger" onClick={onOpenHistory} size="sm" sx={softPressSx} variant="plain">
                    View details
                  </JoyButton>
                </Stack>
              </Stack>
            </Alert>
          ) : null}
        </Stack>

        {isSyncing ? (
          <LinearProgress
            aria-label={`Syncing ${displayName}`}
            color="primary"
            size="sm"
            sx={{ position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 0, "--LinearProgress-thickness": "3px" }}
            variant="soft"
          />
        ) : null}
      </Sheet>
    );
  },
);

ConnectedIntegrationCard.displayName = "ConnectedIntegrationCard";

export const ConnectedIntegrationCardSkeleton = () => (
  <Sheet aria-busy variant="outlined" sx={{ ...interactiveSurfaceSx, p: { xs: 2, md: 2.5 } }}>
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Stack direction="row" spacing={1.75} sx={{ flex: 1 }}>
          <Skeleton animation="wave" height={40} sx={{ borderRadius: "12px" }} variant="rectangular" width={40} />
          <Stack spacing={0.75} sx={{ flex: 1 }}>
            <Skeleton animation="wave" level="title-md" variant="text" width="40%" />
            <Skeleton animation="wave" level="body-sm" variant="text" width="25%" />
          </Stack>
        </Stack>
        <Skeleton animation="wave" height={32} sx={{ borderRadius: "8px" }} variant="rectangular" width={112} />
      </Stack>
      <Stack spacing={0.75} sx={{ pl: { sm: "54px" } }}>
        <Skeleton animation="wave" level="body-sm" variant="text" width="55%" />
        <Stack direction="row" spacing={0.5}>
          {[64, 56, 48].map((width) => (
            <Skeleton key={width} animation="wave" height={20} sx={{ borderRadius: "6px" }} variant="rectangular" width={width} />
          ))}
        </Stack>
      </Stack>
    </Stack>
  </Sheet>
);
