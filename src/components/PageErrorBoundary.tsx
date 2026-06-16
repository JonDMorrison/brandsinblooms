/**
 * Page-scoped error boundary.
 *
 * Wraps a single route's content so a render-time exception is caught at the
 * page boundary instead of bubbling past `ChunkErrorBoundary` (which re-throws
 * non-chunk errors) and being caught by the App-level `<ErrorBoundary>` —
 * which replaces the entire route tree, sidebar and all.
 *
 * Use this on any route where a crash inside the page body shouldn't take
 * down the dashboard shell. The fallback renders inline inside the existing
 * layout: sidebar stays mounted, the customer can navigate to another page
 * or retry this one without a full reload.
 *
 * Telemetry behaviour mirrors the App-level boundary (PR #71): generates a
 * short incident reference, dev console group, Uptrace span if telemetry is
 * configured, pre-filled mailto for support.
 */

import * as React from "react";
import Box from "@mui/joy/Box";
import Link from "@mui/joy/Link";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { JoyButton } from "@/components/joy/JoyButton";
import { logReactError } from "@/utils/devErrorLogger";

const SUPPORT_EMAIL = "support@brandsinblooms.com";

function reportException(error: Error, context: Record<string, unknown>) {
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
        "[PageErrorBoundary] Failed to load telemetry:",
        reportingError,
      );
    });
}

function makeIncidentRef(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `${now}-${rand}`;
}

interface PageErrorBoundaryProps {
  /** The page content. */
  children: React.ReactNode;
  /** Optional label for the page in the fallback heading. Defaults to "This page". */
  pageLabel?: string;
  /** Optional context tag attached to telemetry events, e.g. "forms". */
  context?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  incidentRef: string | null;
}

export class PageErrorBoundary extends React.Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  state: PageErrorBoundaryState = {
    hasError: false,
    error: null,
    incidentRef: null,
  };

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error, incidentRef: makeIncidentRef() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const ref = this.state.incidentRef ?? makeIncidentRef();

    console.group(
      "%c🔶 [PAGE ERROR BOUNDARY]",
      "color: #ff9844; font-weight: bold; font-size: 14px;",
    );
    console.error(
      "%cError:",
      "color: #ff6b6b; font-weight: bold;",
      error.message,
    );
    console.error("%cStack:", "color: #ffa94d; font-weight: bold;");
    console.error(error.stack);
    console.error("%cComponent Stack:", "color: #74c0fc; font-weight: bold;");
    console.error(errorInfo.componentStack);
    console.error(
      "%cIncident:",
      "color: #69db7c; font-weight: bold;",
      ref,
    );
    console.groupEnd();

    logReactError(
      error,
      errorInfo.componentStack || undefined,
      `PageErrorBoundary${this.props.context ? `:${this.props.context}` : ""}`,
    );

    reportException(error, {
      componentStack: errorInfo.componentStack,
      context: `PageErrorBoundary${this.props.context ? `:${this.props.context}` : ""}`,
      incidentRef: ref,
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, incidentRef: null });
  };

  goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { incidentRef } = this.state;
    const pageLabel = this.props.pageLabel ?? "This page";
    const mailSubject = encodeURIComponent(
      `BloomSuite hiccup — reference ${incidentRef ?? ""}`,
    );
    const mailBody = encodeURIComponent(
      [
        "Hi BloomSuite team,",
        "",
        `I ran into a problem on ${pageLabel.toLowerCase()}. Here's what I was doing:`,
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
        data-testid="page-error-boundary"
        sx={{ px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}
      >
        <Box
          sx={{
            mx: "auto",
            width: "100%",
            maxWidth: 540,
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
                width: 40,
                height: 40,
                borderRadius: "999px",
                backgroundColor: "warning.softBg",
                color: "warning.solidBg",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={20} strokeWidth={1.8} />
            </Box>

            <Stack spacing={1}>
              <Typography
                level="h4"
                sx={{ fontSize: "18px", fontWeight: 600, color: "neutral.800" }}
              >
                {pageLabel} didn&apos;t load right
              </Typography>
              <Typography
                level="body-md"
                sx={{ color: "neutral.600", lineHeight: 1.55 }}
              >
                Something on our end stopped this screen from finishing. The
                rest of BloomSuite is still working — you can keep using the
                sidebar to head somewhere else, or try this page again.
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
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }
}
