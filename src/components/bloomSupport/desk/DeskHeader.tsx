import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import { AlertTriangle, CirclePause, Plus, ShieldAlert, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { bloomState, deskAlerts, type DeskAlert, type DeskAlertKind, type DeskAlertTarget, type DeskSummary } from "./deskModel";

const ALERT_ICON: Record<DeskAlertKind, ReactNode> = {
  paused: <CirclePause size={20} aria-hidden />,
  failed: <AlertTriangle size={20} aria-hidden />,
  urgent: <ShieldAlert size={20} aria-hidden />,
  admin: <UserRound size={20} aria-hidden />,
};

export function DeskHeader({ summary, summaryFailed, urgent, onNewRequest, onAlert }: {
  summary: DeskSummary | undefined;
  summaryFailed: boolean;
  urgent: number;
  onNewRequest: () => void;
  onAlert: (target: DeskAlertTarget) => void;
}) {
  const state = bloomState(summary, summaryFailed);
  const alerts = deskAlerts(summary, urgent);
  return (
    <Stack spacing={4} component="header">
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={4}>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography level="h1" component="h1">Support desk</Typography>
            <BloomPill tone={state.tone} label={state.label} />
          </Stack>
          <Typography level="body-lg" textColor="text.secondary" sx={{ maxWidth: 640 }}>
            Bloom handles the routine work. You make the few calls that need a person.
          </Typography>
        </Stack>
        <Button variant="outlined" color="neutral" startDecorator={<Plus size={18} aria-hidden />} onClick={onNewRequest} sx={{ borderRadius: "xl", minHeight: 48, px: 5, bgcolor: "background.surface", flexShrink: 0 }}>
          New request
        </Button>
      </Stack>
      {alerts.length > 0 && (
        <Stack spacing={2} role="region" aria-label="Needs attention now">
          {alerts.map((a) => <AlertRow key={a.kind} alert={a} onAction={() => onAlert(a.target)} />)}
        </Stack>
      )}
    </Stack>
  );
}

function BloomPill({ tone, label }: { tone: "primary" | "danger" | "neutral"; label: string }) {
  const dot = tone === "primary" ? "primary.500" : tone === "danger" ? "danger.500" : "neutral.400";
  return (
    <Box
      role="status"
      sx={{
        display: "inline-flex", alignItems: "center", gap: 2, px: 3, py: 1, borderRadius: 999,
        bgcolor: tone === "danger" ? "danger.50" : tone === "primary" ? "primary.50" : "neutral.100",
        border: "1px solid", borderColor: tone === "danger" ? "danger.200" : tone === "primary" ? "primary.200" : "neutral.200",
        color: tone === "danger" ? "danger.700" : tone === "primary" ? "primary.900" : "text.secondary",
        fontFamily: "body", fontSize: "0.9375rem", fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 10, height: 10, borderRadius: "50%", bgcolor: dot, position: "relative",
          ...(tone === "primary" ? {
            "&::after": { content: '""', position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid", borderColor: "primary.400", animation: "deskPulse 2s ease-out infinite" },
            "@keyframes deskPulse": { "0%": { opacity: 0.8, transform: "scale(0.6)" }, "100%": { opacity: 0, transform: "scale(1.4)" } },
            "@media (prefers-reduced-motion: reduce)": { "&::after": { animation: "none", display: "none" } },
          } : {}),
        }}
      />
      {label}
    </Box>
  );
}

function AlertRow({ alert, onAction }: { alert: DeskAlert; onAction: () => void }) {
  const danger = alert.tone === "danger";
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 3, sm: 4 }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      sx={{
        p: 4, borderRadius: "xl", border: "1px solid",
        bgcolor: danger ? "danger.50" : "warning.50",
        borderColor: danger ? "danger.200" : "warning.200",
      }}
    >
      <Stack direction="row" spacing={3} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ color: danger ? "danger.600" : "warning.700", display: "flex", pt: 0.5 }}>{ALERT_ICON[alert.kind]}</Box>
        <Stack spacing={0.5}>
          <Typography level="title-md" textColor={danger ? "danger.800" : "warning.800"}>{alert.title}</Typography>
          <Typography level="body-md" textColor="text.secondary">{alert.body}</Typography>
        </Stack>
      </Stack>
      <Button variant="outlined" color={danger ? "danger" : "warning"} onClick={onAction} sx={{ borderRadius: "xl", bgcolor: "background.surface", flexShrink: 0 }}>
        {alert.action}
      </Button>
    </Stack>
  );
}
