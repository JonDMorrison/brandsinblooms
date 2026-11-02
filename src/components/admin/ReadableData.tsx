import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import { labelFor, plainValue } from "./readableFormat";

/**
 * Shows stored data (API results, audit before/after, captured context) as labelled
 * rows a non-technical person can read, instead of raw JSON.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function ReadableData({ value, depth = 0, maxItems = 50 }: { value: unknown; depth?: number; maxItems?: number }) {
  if (Array.isArray(value)) {
    if (!value.length) return <Typography level="body-sm" textColor="text.tertiary">Nothing to show</Typography>;
    if (value.every((x) => !isPlainObject(x) && !Array.isArray(x))) return <Typography level="body-sm">{plainValue(value)}</Typography>;
    return (
      <Stack spacing={1}>
        {value.slice(0, maxItems).map((item, i) => (
          <Sheet key={i} variant="outlined" sx={{ p: 1.5, borderRadius: "md", bgcolor: "background.surface" }}>
            <ReadableData value={item} depth={depth + 1} maxItems={maxItems} />
          </Sheet>
        ))}
        {value.length > maxItems && <Typography level="body-xs" textColor="text.tertiary">And {value.length - maxItems} more</Typography>}
      </Stack>
    );
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return <Typography level="body-sm" textColor="text.tertiary">Nothing to show</Typography>;
    return (
      <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(120px, 34%) 1fr" }, columnGap: 2, rowGap: 0.75 }}>
        {entries.map(([k, v]) => (
          <Box key={k} sx={{ display: "contents" }}>
            <Typography component="dt" level="body-sm" textColor="text.tertiary">{labelFor(k)}</Typography>
            <Box component="dd" sx={{ m: 0, minWidth: 0, wordBreak: "break-word" }}>
              {(isPlainObject(v) || (Array.isArray(v) && v.some((x) => isPlainObject(x)))) && depth < 3
                ? <Box sx={{ pl: 1.5, borderLeft: "2px solid", borderColor: "neutral.200" }}><ReadableData value={v} depth={depth + 1} maxItems={maxItems} /></Box>
                : <Typography level="body-sm">{plainValue(v)}</Typography>}
            </Box>
          </Box>
        ))}
      </Box>
    );
  }
  return <Typography level="body-sm">{plainValue(value)}</Typography>;
}
