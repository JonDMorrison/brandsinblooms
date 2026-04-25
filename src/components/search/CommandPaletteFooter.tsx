import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CircleHelp } from "lucide-react";
import { SEARCH_GROUP_METADATA } from "@/components/search/types";
import type { SearchFilterValue } from "@/components/search/searchFilters";

interface CommandPaletteFooterProps {
  activeFilter: SearchFilterValue;
  onToggleShortcuts: () => void;
  resultCount: number;
  shortcutsOpen: boolean;
}

function getFilterLabel(filter: SearchFilterValue) {
  return filter === "all" ? "All" : SEARCH_GROUP_METADATA[filter].title;
}

export function CommandPaletteFooter({
  activeFilter,
  onToggleShortcuts,
  resultCount,
  shortcutsOpen,
}: CommandPaletteFooterProps) {
  const countLabel =
    shortcutsOpen
      ? "Keyboard shortcuts"
      : activeFilter === "all"
      ? `${resultCount} results`
      : `${resultCount} results in ${getFilterLabel(activeFilter)}`;

  return (
    <Sheet
      variant="plain"
      sx={{
        display: { xs: "none", md: "block" },
        position: "sticky",
        bottom: 0,
        zIndex: 2,
        px: 1.5,
        py: 1.25,
        backgroundColor: "hsl(var(--card))",
        borderTop: "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Chip
          size="sm"
          variant="soft"
          sx={{ borderRadius: "999px", fontWeight: 600 }}
        >
          {countLabel}
        </Chip>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            aria-pressed={shortcutsOpen}
            color="neutral"
            onClick={onToggleShortcuts}
            size="sm"
            variant={shortcutsOpen ? "soft" : "plain"}
          >
            <CircleHelp size={15} strokeWidth={1.9} />
          </IconButton>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Tab Filters
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            ↑↓ Navigate
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            → Actions
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Ctrl/Cmd+Enter New Tab
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            ? Shortcuts
          </Typography>
        </Stack>
      </Stack>
    </Sheet>
  );
}