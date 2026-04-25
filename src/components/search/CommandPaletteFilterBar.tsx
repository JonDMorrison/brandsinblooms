import type { KeyboardEvent, MutableRefObject } from "react";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { SEARCH_GROUP_METADATA, type SearchGroupKey } from "@/components/search/types";
import type { SearchFilterValue } from "@/components/search/searchFilters";

interface CommandPaletteFilterBarProps {
  activeFilter: SearchFilterValue;
  counts: Partial<Record<SearchGroupKey | "all", number>>;
  filterRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  filters: SearchFilterValue[];
  onFocusFilter: (index: number) => void;
  onKeyDownFilter: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onSelectFilter: (filter: SearchFilterValue) => void;
  tabListId: string;
}

function getFilterLabel(filter: SearchFilterValue) {
  return filter === "all" ? "All" : SEARCH_GROUP_METADATA[filter].title;
}

export function CommandPaletteFilterBar({
  activeFilter,
  counts,
  filterRefs,
  filters,
  onFocusFilter,
  onKeyDownFilter,
  onSelectFilter,
  tabListId,
}: CommandPaletteFilterBarProps) {
  return (
    <Sheet
      variant="plain"
      sx={{
        px: 1.5,
        py: 1.25,
        borderBottom: "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <Stack
        id={tabListId}
        direction="row"
        spacing={1}
        role="tablist"
        aria-label="Search result filters"
        useFlexGap
        sx={{ flexWrap: "wrap" }}
      >
        {filters.map((filter, index) => {
          const isActive = filter === activeFilter;

          return (
            <Button
              key={filter}
              ref={(element: HTMLButtonElement | null) => {
                filterRefs.current[index] = element;
              }}
              variant={isActive ? "solid" : "soft"}
              color={isActive ? "primary" : "neutral"}
              onClick={() => onSelectFilter(filter)}
              onFocus={() => onFocusFilter(index)}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
                onKeyDownFilter(event, index)
              }
              id={`${tabListId}-${filter}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              size="sm"
              sx={{
                borderRadius: "999px",
                fontWeight: 600,
                flexShrink: 0,
                minHeight: 32,
                px: 1.25,
              }}
            >
              {getFilterLabel(filter)}
              {typeof counts[filter] === "number" ? ` (${counts[filter]})` : ""}
            </Button>
          );
        })}
      </Stack>
    </Sheet>
  );
}