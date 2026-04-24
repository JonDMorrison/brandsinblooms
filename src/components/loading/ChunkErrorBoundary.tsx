import { Component, type ErrorInfo, type ReactNode } from "react";
import Box from "@mui/joy/Box";
import Link from "@mui/joy/Link";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";

interface ChunkErrorBoundaryProps {
  children: ReactNode;
  dashboardHref?: string;
  linkLabel?: string;
}

interface ChunkErrorBoundaryState {
  error: Error | null;
}

const CHUNK_ERROR_SIGNATURES = [
  "Loading chunk",
  "dynamically imported module",
  "Failed to fetch",
];

export function isChunkLoadError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "ChunkLoadError" ||
    CHUNK_ERROR_SIGNATURES.some((signature) =>
      error.message.includes(signature),
    )
  );
}

export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    if (isChunkLoadError(error)) {
      console.warn("Lazy-loaded chunk failed to load.", error);
    }
  }

  render() {
    const {
      children,
      dashboardHref = "/dashboard",
      linkLabel = "Go to Dashboard",
    } = this.props;
    const { error } = this.state;

    if (!error) {
      return children;
    }

    if (!isChunkLoadError(error)) {
      throw error;
    }

    return (
      <Box
        data-testid="chunk-error-boundary"
        sx={{
          width: "100%",
          minHeight: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <JoyCard variant="outlined" sx={{ width: "100%", maxWidth: 760 }}>
          <JoyCardHeader
            startDecorator={
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: "999px",
                  backgroundColor: "danger.softBg",
                  color: "danger.600",
                }}
              >
                <AlertTriangle size={20} />
              </Box>
            }
            title="This page failed to load."
            description="This usually means a new version was deployed."
          />
          <JoyCardContent>
            <Stack spacing={2.5}>
              <Typography level="body-sm" color="neutral">
                Retry will refresh the application and fetch the latest page
                assets.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <JoyButton onClick={() => window.location.reload()}>
                  <RefreshCw size={16} />
                  Retry
                </JoyButton>
                <Link
                  href={dashboardHref}
                  underline="hover"
                  sx={{
                    alignSelf: { xs: "flex-start", sm: "center" },
                    fontWeight: 600,
                  }}
                >
                  {linkLabel}
                </Link>
              </Stack>
            </Stack>
          </JoyCardContent>
        </JoyCard>
      </Box>
    );
  }
}

export default ChunkErrorBoundary;
