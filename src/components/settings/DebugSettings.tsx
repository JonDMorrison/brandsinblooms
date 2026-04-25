import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Link as RouterLink } from "react-router-dom";

const cardSx = {
  borderRadius: "lg",
  bgcolor: "background.surface",
  p: 2.5,
} as const;

const getRuntimeDetails = () => {
  if (typeof window === "undefined") {
    return {
      language: "Unknown",
      timeZone: "Unknown",
      origin: "Unavailable",
      pathname: "Unavailable",
      userAgent: "Unavailable",
    };
  }

  return {
    language: window.navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    origin: window.location.origin,
    pathname: window.location.pathname,
    userAgent: window.navigator.userAgent,
  };
};

export function DebugSettings() {
  const runtimeDetails = getRuntimeDetails();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography level="title-lg">Debug</Typography>
        <Typography level="body-sm" sx={{ color: "text.secondary", mt: 0.5 }}>
          Review lightweight diagnostics before escalating a support issue.
        </Typography>
      </Box>

      <Sheet variant="outlined" sx={cardSx}>
        <Stack spacing={1.25}>
          <Typography level="title-sm">Runtime Snapshot</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip size="sm" variant="soft">
              Language: {runtimeDetails.language}
            </Chip>
            <Chip size="sm" variant="soft">
              Timezone: {runtimeDetails.timeZone}
            </Chip>
            <Chip size="sm" variant="soft">
              Path: {runtimeDetails.pathname}
            </Chip>
          </Stack>

          <Stack spacing={0.75} sx={{ mt: 1 }}>
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              Origin
            </Typography>
            <Typography level="body-sm">{runtimeDetails.origin}</Typography>
          </Stack>

          <Stack spacing={0.75}>
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              User Agent
            </Typography>
            <Typography level="body-sm" sx={{ wordBreak: "break-word" }}>
              {runtimeDetails.userAgent}
            </Typography>
          </Stack>
        </Stack>
      </Sheet>

      <Sheet variant="outlined" sx={cardSx}>
        <Stack spacing={1.25}>
          <Typography level="title-sm">Troubleshooting Shortcuts</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Use these surfaces first when you need context for a bug report or support thread.
          </Typography>

          <Stack spacing={1}>
            <Typography component={RouterLink} level="body-sm" to="/support">
              Support
            </Typography>
            <Typography component={RouterLink} level="body-sm" to="/activity">
              Activity Center
            </Typography>
            <Typography component={RouterLink} level="body-sm" to="/helpdesk">
              Help Desk
            </Typography>
          </Stack>
        </Stack>
      </Sheet>
    </Stack>
  );
}