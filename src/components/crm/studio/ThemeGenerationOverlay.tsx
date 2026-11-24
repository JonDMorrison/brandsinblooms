import Alert from "@mui/joy/Alert";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import type { WeeklyThemeImage } from "@/lib/studio/weeklyThemeSeed";

function TextLines({ lines }: { lines: number }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          variant="text"
          level="body-sm"
          width={index === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </Stack>
  );
}

function ThemePhoto({ image }: { image: WeeklyThemeImage | undefined }) {
  return (
    <AspectRatio ratio="16/9" sx={{ borderRadius: "md", overflow: "hidden" }}>
      {image ? (
        <Box
          component="img"
          src={image.url}
          alt=""
          sx={{ objectFit: "cover", opacity: 0.55, filter: "saturate(0.7)" }}
        />
      ) : (
        <Skeleton variant="overlay" />
      )}
    </AspectRatio>
  );
}

/**
 * Covers the canvas while generate-theme-newsletter writes the draft: the
 * theme photos laid out as skeleton blocks. Solid surface; the draft below
 * stays intact in case generation fails.
 */
export function ThemeGenerationOverlay({
  images,
  canvasWidth,
}: {
  images: WeeklyThemeImage[];
  canvasWidth: number;
}) {
  const [hero, story] = images;
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="theme-generation-overlay"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        overflowY: "auto",
        bgcolor: "background.level1",
        px: 2,
        // Clear the canvas's sticky "Your email" bar.
        pt: 8,
        pb: 3,
      }}
    >
      <Stack spacing={2} sx={{ maxWidth: canvasWidth, mx: "auto" }}>
        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="center">
          <CircularProgress size="sm" />
          <Typography level="title-md">Writing this week's newsletter…</Typography>
        </Stack>
        <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2.5, bgcolor: "background.surface" }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="circular" width={44} height={44} />
              <Box sx={{ flex: 1 }}>
                <TextLines lines={2} />
              </Box>
            </Stack>
            <ThemePhoto image={hero} />
            <TextLines lines={4} />
            <Stack direction="row" spacing={2}>
              <Box sx={{ width: "45%" }}>
                <ThemePhoto image={story ?? hero} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <TextLines lines={5} />
              </Box>
            </Stack>
            <Stack alignItems="center" spacing={1}>
              <Skeleton variant="text" level="title-md" width="50%" />
              <Skeleton variant="rectangular" width={160} height={36} sx={{ borderRadius: "sm" }} />
            </Stack>
          </Stack>
        </Sheet>
      </Stack>
    </Box>
  );
}

/** Non-blocking notice when the newsletter couldn't be written. */
export function ThemeGenerationFailedNotice({
  onRetry,
  onDismiss,
}: {
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Alert
      color="warning"
      variant="soft"
      data-testid="theme-generation-failed"
      startDecorator={<AlertTriangle size={18} aria-hidden />}
      endDecorator={
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="sm" variant="solid" color="warning" startDecorator={<RefreshCw size={14} />} onClick={onRetry}>
            Retry
          </Button>
          <IconButton size="sm" variant="plain" color="warning" aria-label="Dismiss" onClick={onDismiss}>
            <X size={16} />
          </IconButton>
        </Stack>
      }
      sx={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 6, width: "min(560px, calc(100% - 32px))", boxShadow: "md" }}
    >
      We couldn't write this one, try again.
    </Alert>
  );
}
