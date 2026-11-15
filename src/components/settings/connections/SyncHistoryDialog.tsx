import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, BookOpen, History, RefreshCw } from "lucide-react";
import { POS_SYNC_LOG_HISTORY_LIMIT } from "@/hooks/usePOSConnections";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDialog, JoyDialogActions, JoyDialogContent } from "@/components/joy/JoyDialog";
import { formatDateTimeValue, formatDuration } from "@/components/integrations/shared/dataTabPrimitives";
import { SettingsEmptyState } from "../SettingsSurface";
import {
  type ConnectionInsight,
  formatImportSummary,
  getFailureGuidance,
  getLogOutcome,
  type SyncLogOutcome,
} from "./connectionsModel";
import { HealthChip, IntegrationLogo } from "./ConnectionsPrimitives";
import { softPressSx } from "./connectionsStyles";

const OUTCOME_CHIP: Record<SyncLogOutcome, { label: string; color: "success" | "danger" | "primary" | "neutral" }> = {
  success: { label: "Succeeded", color: "success" },
  failed: { label: "Failed", color: "danger" },
  running: { label: "In progress", color: "primary" },
  unknown: { label: "Unknown", color: "neutral" },
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <Sheet variant="soft" sx={{ borderRadius: "14px", p: 1.5, minWidth: 0 }}>
    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
      {label}
    </Typography>
    <Typography level="title-sm" sx={{ color: "text.primary", wordBreak: "break-word" }}>
      {value}
    </Typography>
  </Sheet>
);

interface SyncHistoryDialogProps {
  insight: ConnectionInsight | null;
  syncDisabled: boolean;
  onClose: () => void;
  onSync: () => void;
  onOpenGuide: () => void;
}

export const SyncHistoryDialog = ({ insight, syncDisabled, onClose, onSync, onOpenGuide }: SyncHistoryDialogProps) => {
  const latestLog = insight?.latestLog ?? null;
  const displayName = insight ? insight.connection.name || insight.platform.name : "";
  const guidance = insight?.health === "attention" ? getFailureGuidance(insight.platform, insight.errorMessage) : null;
  const latestOutcome = latestLog ? getLogOutcome(latestLog) : null;
  const latestDuration = latestLog ? formatDuration(latestLog.started_at, latestLog.completed_at) : null;

  return (
    <JoyDialog
      description={insight ? `${insight.platform.name} · last ${POS_SYNC_LOG_HISTORY_LIMIT} syncs` : undefined}
      onClose={onClose}
      open={Boolean(insight)}
      size="md"
      startDecorator={insight ? <IntegrationLogo logo={insight.platform.logo} name={insight.platform.name} size={36} /> : null}
      title={insight ? `${displayName} sync history` : "Sync history"}
    >
      <JoyDialogContent>
        {insight ? (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                Current status
              </Typography>
              <HealthChip health={insight.health} />
            </Stack>

            {guidance ? (
              <Alert color="danger" startDecorator={<AlertTriangle size={18} />} sx={{ alignItems: "flex-start", borderRadius: "14px" }} variant="soft">
                <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                  <Typography level="title-sm" sx={{ color: "inherit" }}>
                    {guidance.summary}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "inherit" }}>
                    {guidance.nextStep}
                  </Typography>
                  {insight.errorMessage ? (
                    <Box
                      component="details"
                      sx={{ "& summary": { cursor: "pointer", fontSize: "xs", fontWeight: "md" } }}
                    >
                      <summary>Technical details</summary>
                      <Typography
                        component="pre"
                        level="body-xs"
                        sx={{ mt: 0.75, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "code", color: "inherit" }}
                      >
                        {insight.errorMessage}
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}

            {latestLog && latestOutcome ? (
              <Stack spacing={1}>
                <Typography level="title-sm" sx={{ color: "text.primary" }}>Latest sync</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                  <Fact label="Result" value={OUTCOME_CHIP[latestOutcome].label} />
                  <Fact label="Started" value={formatDateTimeValue(latestLog.started_at)} />
                  <Fact
                    label="Completed"
                    value={latestLog.completed_at ? `${formatDateTimeValue(latestLog.completed_at)}${latestDuration ? ` (${latestDuration})` : ""}` : "—"}
                  />
                  <Fact label="Imported" value={formatImportSummary(latestLog) ?? "—"} />
                </Box>
              </Stack>
            ) : null}

            {insight.logs.length > 0 ? (
              <Stack spacing={1}>
                <Typography level="title-sm" sx={{ color: "text.primary" }}>Recent activity</Typography>
                <Sheet variant="outlined" sx={{ borderRadius: "14px", overflow: "hidden" }}>
                  <List size="sm" sx={{ "--ListItem-paddingY": "10px", "--ListItem-paddingX": "14px", py: 0 }}>
                    {insight.logs.map((log, index) => {
                      const outcome = OUTCOME_CHIP[getLogOutcome(log)];
                      return (
                        <ListItem
                          key={log.id}
                          sx={{ borderTop: index === 0 ? 0 : "1px solid", borderColor: "divider", alignItems: "flex-start" }}
                        >
                          <Stack direction="row" spacing={1.5} justifyContent="space-between" sx={{ width: "100%", minWidth: 0 }}>
                            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                              <Typography level="body-sm" sx={{ color: "text.primary" }}>
                                {formatDateTimeValue(log.started_at)}
                              </Typography>
                              <Typography level="body-xs" sx={{ color: "text.tertiary", wordBreak: "break-word" }}>
                                {getLogOutcome(log) === "failed"
                                  ? (log.error_message ?? "Sync did not finish")
                                  : (formatImportSummary(log) ?? (log.sync_type ? `${log.sync_type} sync` : ""))}
                              </Typography>
                            </Stack>
                            <Chip color={outcome.color} size="sm" sx={{ flexShrink: 0 }} variant="soft">
                              {outcome.label}
                            </Chip>
                          </Stack>
                        </ListItem>
                      );
                    })}
                  </List>
                </Sheet>
              </Stack>
            ) : (
              <SettingsEmptyState
                description="No sync has been recorded for this connection yet. Run a sync when you're ready and its results will show up here."
                icon={History}
                title="No sync history yet"
              />
            )}
          </Stack>
        ) : null}
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton color="neutral" onClick={onOpenGuide} startDecorator={<BookOpen size={15} />} sx={softPressSx} variant="plain">
          Setup guide
        </JoyButton>
        <JoyButton
          disabled={syncDisabled || !insight?.connection.is_active}
          loading={insight?.health === "syncing"}
          loadingPosition="start"
          onClick={onSync}
          startDecorator={<RefreshCw size={15} />}
          sx={softPressSx}
        >
          {guidance ? "Retry sync" : "Sync now"}
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
};
