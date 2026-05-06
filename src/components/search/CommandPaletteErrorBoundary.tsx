import { Component, type ErrorInfo, type ReactNode } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle } from "lucide-react";

const reportException = (error: Error, context: Record<string, unknown>) => {
  const telemetryEnabled =
    Boolean(import.meta.env.VITE_UPTRACE_DSN) &&
    String(import.meta.env.VITE_DISABLE_TELEMETRY || "").toLowerCase() !==
      "true";

  if (!telemetryEnabled) {
    return;
  }

  import("@/utils/uptrace")
    .then(({ captureException }) => captureException(error, context))
    .catch((reportingError) => {
      console.error(
        "[CommandPaletteErrorBoundary] Failed to load telemetry:",
        reportingError,
      );
    });
};

interface CommandPaletteErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  resetKey: string;
}

interface CommandPaletteErrorBoundaryState {
  error: Error | null;
}

export class CommandPaletteErrorBoundary extends Component<
  CommandPaletteErrorBoundaryProps,
  CommandPaletteErrorBoundaryState
> {
  state: CommandPaletteErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(
    error: Error,
  ): CommandPaletteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportException(error, {
      component: "CommandPaletteErrorBoundary",
      componentStack: errorInfo.componentStack,
    });
  }

  componentDidUpdate(prevProps: CommandPaletteErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { children, onClose, open } = this.props;
    const { error } = this.state;

    if (!error) {
      return children;
    }

    if (!open) {
      return null;
    }

    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: "var(--joy-zIndex-modal)",
          display: "grid",
          placeItems: "start center",
          pt: { xs: "16px", md: "max(20vh, 72px)" },
          px: 2,
          backgroundColor: "rgba(15, 23, 42, 0.28)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Sheet
          variant="plain"
          sx={{
            width: "min(560px, calc(100vw - 16px))",
            p: 3,
            borderRadius: "var(--joy-radius-lg)",
            backgroundColor: "background.surface",
            border:
              "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.12)",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.18)",
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "999px",
                  backgroundColor: "danger.softBg",
                  color: "danger.600",
                }}
              >
                <AlertTriangle size={18} strokeWidth={1.9} />
              </Box>
              <Stack spacing={0.25}>
                <Typography level="title-md">
                  Search ran into a problem.
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  Close and reopen the palette to reset it.
                </Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button color="neutral" onClick={onClose} variant="soft">
                Close Search
              </Button>
            </Stack>
          </Stack>
        </Sheet>
      </Box>
    );
  }
}

export default CommandPaletteErrorBoundary;
