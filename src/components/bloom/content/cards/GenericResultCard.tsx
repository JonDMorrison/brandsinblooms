import * as React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { Diamond } from "lucide-react";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";
import {
  formatLabel,
  formatToolTitle,
  isRecord,
  type NormalizedToolResult,
  rowsFromResult,
  valueToText,
} from "@/components/bloom/content/cards/cardUtils";

const HIDDEN_KEYS = new Set([
  "id",
  "tenant_id",
  "user_id",
  "created_at",
  "updated_at",
]);

function entriesFor(result: NormalizedToolResult) {
  const rows = rowsFromResult(result);
  const source = rows[0] ?? (isRecord(result.data) ? result.data : null);
  if (!source) {
    return [];
  }

  return Object.entries(source)
    .filter(([key, value]) => !HIDDEN_KEYS.has(key) && valueToText(value))
    .slice(0, 8);
}

export function GenericResultCard({
  result,
}: {
  result: NormalizedToolResult;
}) {
  const entries = entriesFor(result);

  return (
    <ResultCardShell
      icon={<Diamond size={15} strokeWidth={1.9} />}
      title={formatToolTitle(result.toolName)}
      meta={
        result.count !== null
          ? `${result.count.toLocaleString()} result${result.count === 1 ? "" : "s"}`
          : "Result"
      }
    >
      {entries.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "140px minmax(0, 1fr)" },
            columnGap: 1.5,
            rowGap: 0.75,
          }}
        >
          {entries.map(([key, value]) => (
            <React.Fragment key={key}>
              <Typography
                level="body-xs"
                sx={{ color: "neutral.500", fontWeight: 500 }}
              >
                {formatLabel(key)}
              </Typography>
              <Typography
                level="body-xs"
                sx={{
                  color: "neutral.800",
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                }}
              >
                {valueToText(value)}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
      ) : (
        <Typography level="body-sm" sx={{ color: "neutral.500" }}>
          {result.message ??
            "Bloom returned a result without displayable fields."}
        </Typography>
      )}
    </ResultCardShell>
  );
}
