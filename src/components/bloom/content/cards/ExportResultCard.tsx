import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Download } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";
import {
  exportResultMetadata,
  formatDate,
  formatLabel,
  formatNumber,
  resultCardActions,
  type NormalizedToolResult,
} from "@/components/bloom/content/cards/cardUtils";

export function ExportResultCard({
  onAction,
  result,
}: {
  onAction?: (prompt: string) => void;
  result: NormalizedToolResult;
}) {
  const metadata = exportResultMetadata(result);
  const actions = resultCardActions(result);

  if (!metadata) {
    return null;
  }

  const rowLabel =
    metadata.rowCount !== null ? formatNumber(metadata.rowCount) : null;
  const totalLabel =
    metadata.totalMatchingCount !== null
      ? formatNumber(metadata.totalMatchingCount)
      : null;

  return (
    <ResultCardShell
      icon={<Download size={15} strokeWidth={1.9} />}
      title="Export"
      meta={metadata.fileSizeLabel ?? result.message ?? "Ready"}
    >
      <Stack spacing={1.25}>
        <Stack spacing={0.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={0.75}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography
              level="body-sm"
              sx={{
                color: "neutral.900",
                fontWeight: 600,
                overflowWrap: "anywhere",
              }}
            >
              {metadata.fileName ?? "Export file"}
            </Typography>
            <JoyChip
              color={metadata.truncated ? "warning" : "success"}
              size="sm"
              variant="soft"
            >
              {metadata.truncated ? "Partial export" : "Ready"}
            </JoyChip>
          </Stack>
          <Typography
            level="body-xs"
            sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
          >
            {[
              metadata.entityLabel,
              metadata.format ? formatLabel(metadata.format) : null,
              rowLabel ? `${rowLabel} rows` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{ flexWrap: "wrap" }}
        >
          {totalLabel ? (
            <JoyChip color="neutral" size="sm" variant="soft">
              {metadata.truncated
                ? `${rowLabel ?? totalLabel} of ${totalLabel}`
                : totalLabel}{" "}
              exported
            </JoyChip>
          ) : null}
          {metadata.expiresAt ? (
            <JoyChip color="neutral" size="sm" variant="soft">
              Expires {formatDate(metadata.expiresAt) ?? metadata.expiresAt}
            </JoyChip>
          ) : null}
          {metadata.generatedAt ? (
            <JoyChip color="neutral" size="sm" variant="soft">
              Generated{" "}
              {formatDate(metadata.generatedAt) ?? metadata.generatedAt}
            </JoyChip>
          ) : null}
        </Stack>

        {actions.length > 0 ? (
          <>
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
            />
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {actions.map((action, index) => {
                if (action.href && action.type !== "prompt") {
                  return (
                    <JoyButton
                      key={`${action.label}-${index}`}
                      color={action.type === "download" ? "primary" : "neutral"}
                      component="a"
                      download={
                        action.type === "download"
                          ? (action.downloadName ?? true)
                          : undefined
                      }
                      href={action.href}
                      rel="noopener noreferrer"
                      size="sm"
                      target="_blank"
                      variant={index === 0 ? "soft" : "plain"}
                    >
                      {action.label}
                    </JoyButton>
                  );
                }

                return (
                  <JoyButton
                    key={`${action.label}-${index}`}
                    color="neutral"
                    size="sm"
                    variant="plain"
                    onClick={() => onAction?.(action.prompt)}
                  >
                    {action.label}
                  </JoyButton>
                );
              })}
            </Stack>
          </>
        ) : null}
      </Stack>
    </ResultCardShell>
  );
}
