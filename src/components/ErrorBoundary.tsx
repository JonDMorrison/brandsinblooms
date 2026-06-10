import React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Link from "@mui/joy/Link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { logReactError } from "@/utils/devErrorLogger";

const SUPPORT_EMAIL = "support@brandsinblooms.com";

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
        "[ErrorBoundary] Failed to load telemetry:",
        reportingError,
      );
    });
};

/**
 * Short, human-readable reference for an incident. Customers paste this into
 * support email; we use it to find the matching trace in telemetry. Not a
 * security token — just a stable handle for one rendered failure.
 */
function makeIncidentRef(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `${now}-${rand}`;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  incidentRef: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error | null;
    resetError: () => void;
  }>;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      incidentRef: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, incidentRef: makeIncidentRef() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    console.group(
      "%c🔴 [REACT ERROR BOUNDARY]",
      "color: #ff4444; font-weight: bold; font-size: 14px;",
    );
    console.error(
      "%cError:",
      "color: #ff6b6b; font-weight: bold;",
      error.message,
    );
    console.error("%cStack Trace:", "color: #ffa94d; font-weight: bold;");
    console.error(error.stack);
    console.error("%cComponent Stack:", "color: #74c0fc; font-weight: bold;");
    console.error(errorInfo.componentStack);
    console.error(
      "%cIncident:",
      "color: #69db7c; font-weight: bold;",
      this.state.incidentRef,
    );
    console.error(
      "%cTimestamp:",
      "color: #69db7c; font-weight: bold;",
      new Date().toISOString(),
    );
    console.groupEnd();

    logReactError(
      error,
      errorInfo.componentStack || undefined,
      "ErrorBoundary",
    );

    reportException(error, {
      componentStack: errorInfo.componentStack,
      context: "ErrorBoundary",
      incidentRef: this.state.incidentRef,
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      incidentRef: null,
    });
  };

  goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  };

  reload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const Fallback = this.props.fallback;
        return (
          <Fallback error={this.state.error} resetError={this.resetError} />
        );
      }

      const { incidentRef } = this.state;
      const mailSubject = encodeURIComponent(
        `BloomSuite hiccup — reference ${incidentRef ?? ""}`,
      );
      const mailBody = encodeURIComponent(
        [
          "Hi BloomSuite team,",
          "",
          "I ran into a page that wouldn't load. Here's what I was doing:",
          "",
          "(briefly describe what you were trying to do)",
          "",
          `Reference: ${incidentRef ?? "(none)"}`,
        ].join("\n"),
      );

      return (
        <Box
          role="alert"
          aria-live="assertive"
          sx={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
            py: 6,
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 520,
              borderRadius: "var(--joy-radius-lg)",
              border: "1px solid",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
              boxShadow: "var(--joy-shadow-sm)",
              p: { xs: 3, sm: 4 },
            }}
          >
            <Stack spacing={2.5} alignItems="flex-start">
              <Box
                aria-hidden
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "999px",
                  backgroundColor: "warning.softBg",
                  color: "warning.solidBg",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={22} strokeWidth={1.8} />
              </Box>

              <Stack spacing={1}>
                <Typography
                  level="h3"
                  sx={{ fontSize: "20px", fontWeight: 600, color: "neutral.800" }}
                >
                  This page didn't load right
                </Typography>
                <Typography
                  level="body-md"
                  sx={{ color: "neutral.600", lineHeight: 1.55 }}
                >
                  Something on our end stopped this screen from finishing. Your
                  work isn't lost — saved drafts and sent campaigns are safe.
                  Try the page again, or head back and come at it from a
                  different angle.
                </Typography>
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                sx={{ width: "100%", pt: 0.5 }}
              >
                <JoyButton
                  variant="solid"
                  color="primary"
                  onClick={this.resetError}
                  startDecorator={<RefreshCw size={16} strokeWidth={2} />}
                  sx={{ flex: { sm: 1 } }}
                >
                  Try this page again
                </JoyButton>
                <JoyButton
                  variant="outlined"
                  color="neutral"
                  onClick={this.goBack}
                  startDecorator={<ArrowLeft size={16} strokeWidth={2} />}
                  sx={{ flex: { sm: 1 } }}
                >
                  Go back
                </JoyButton>
              </Stack>

              <Box
                sx={{
                  width: "100%",
                  mt: 1,
                  pt: 2,
                  borderTop: "1px solid",
                  borderColor: "neutral.100",
                }}
              >
                <Typography
                  level="body-sm"
                  sx={{ color: "neutral.500", lineHeight: 1.5 }}
                >
                  Still stuck? Email{" "}
                  <Link
                    href={`mailto:${SUPPORT_EMAIL}?subject=${mailSubject}&body=${mailBody}`}
                    sx={{ fontWeight: 500 }}
                  >
                    {SUPPORT_EMAIL}
                  </Link>{" "}
                  with a quick note about what you were doing.
                </Typography>
                {incidentRef ? (
                  <Typography
                    level="body-xs"
                    sx={{
                      mt: 1,
                      color: "neutral.400",
                      fontFamily:
                        "var(--joy-fontFamily-code, ui-monospace, SFMono-Regular, Menlo, monospace)",
                    }}
                  >
                    Reference: {incidentRef}
                  </Typography>
                ) : null}
                <Typography
                  level="body-xs"
                  sx={{ mt: 1.5, color: "neutral.400" }}
                >
                  Or{" "}
                  <Link
                    component="button"
                    type="button"
                    onClick={this.reload}
                    sx={{ fontWeight: 500 }}
                  >
                    reload the whole app
                  </Link>{" "}
                  if the page keeps acting up.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
