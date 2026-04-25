import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

interface CommandPaletteNoResultsProps {
  query: string;
}

export function CommandPaletteNoResults({ query }: CommandPaletteNoResultsProps) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ px: 4, py: 10, textAlign: "center" }}
    >
      <svg
        aria-hidden="true"
        width="84"
        height="84"
        viewBox="0 0 84 84"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="8" y="8" width="68" height="68" rx="22" fill="rgba(14, 116, 144, 0.08)" />
        <circle cx="38" cy="38" r="15" stroke="rgba(14, 116, 144, 0.85)" strokeWidth="4" />
        <path d="M49.5 49.5L61 61" stroke="rgba(30, 41, 59, 0.72)" strokeWidth="4" strokeLinecap="round" />
        <path d="M31 38H45" stroke="rgba(30, 41, 59, 0.72)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <Typography level="title-sm" sx={{ color: "neutral.800" }}>
        No matches for “{query}”
      </Typography>
      <Typography level="body-sm" sx={{ maxWidth: 320, color: "neutral.500" }}>
        Try a broader keyword, remove a filter, or open a nearby page from recent activity.
      </Typography>
    </Stack>
  );
}