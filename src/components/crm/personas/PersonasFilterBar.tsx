import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { SlidersHorizontal } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { useIsMobile } from "@/hooks/use-mobile";

export type PersonaViewFilter = "all" | "system" | "custom";
export type PersonaSortOption =
  | "customers-desc"
  | "value-desc"
  | "engagement-desc"
  | "name-asc"
  | "recent";

interface PersonasFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  view: PersonaViewFilter;
  onViewChange: (value: PersonaViewFilter) => void;
  sort: PersonaSortOption;
  onSortChange: (value: PersonaSortOption) => void;
  resultCount: number;
  totalCount: number;
  loading?: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const SORT_OPTIONS = [
  { value: "customers-desc", label: "Most assigned" },
  { value: "value-desc", label: "Highest value" },
  { value: "engagement-desc", label: "Highest engagement" },
  { value: "name-asc", label: "A-Z" },
  { value: "recent", label: "Newest custom" },
] as const;

const VIEW_OPTIONS = [
  { value: "all", label: "All" },
  { value: "system", label: "System" },
  { value: "custom", label: "Custom" },
] as const;

function FilterControls({
  view,
  onViewChange,
  sort,
  onSortChange,
  align = "row",
}: Pick<
  PersonasFilterBarProps,
  "view" | "onViewChange" | "sort" | "onSortChange"
> & {
  align?: "row" | "column";
}) {
  return (
    <Stack
      direction={align === "row" ? { xs: "column", md: "row" } : "column"}
      spacing={1}
      alignItems={align === "row" ? { md: "center" } : undefined}
    >
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {VIEW_OPTIONS.map((option) => (
          <JoyButton
            key={option.value}
            size="sm"
            variant={view === option.value ? "solid" : "plain"}
            color="neutral"
            onClick={() => onViewChange(option.value as PersonaViewFilter)}
          >
            {option.label}
          </JoyButton>
        ))}
      </Stack>

      <Box sx={{ minWidth: { xs: "100%", md: 180 } }}>
        <JoySelect
          label="Sort"
          value={sort}
          onValueChange={(value) => onSortChange(value as PersonaSortOption)}
          options={SORT_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </Box>
    </Stack>
  );
}

export function PersonasFilterBar({
  query,
  onQueryChange,
  view,
  onViewChange,
  sort,
  onSortChange,
  resultCount,
  totalCount,
  loading = false,
  hasActiveFilters,
  onClearFilters,
}: PersonasFilterBarProps) {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  return (
    <>
      <Stack spacing={1.25}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", lg: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ width: "100%", maxWidth: { lg: 420 } }}>
            <JoySearchInput
              value={query}
              placeholder="Search personas..."
              onDebouncedChange={onQueryChange}
              onClear={() => onQueryChange("")}
            />
          </Box>

          {isMobile ? (
            <JoyButton
              variant="plain"
              color="neutral"
              startDecorator={<SlidersHorizontal size={16} />}
              onClick={() => setFiltersOpen(true)}
            >
              Filters
            </JoyButton>
          ) : (
            <FilterControls
              view={view}
              onViewChange={onViewChange}
              sort={sort}
              onSortChange={onSortChange}
              align="row"
            />
          )}
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          useFlexGap
          flexWrap="wrap"
        >
          {loading ? (
            <Skeleton variant="text" width={132} height={14} animation="wave" />
          ) : (
            <Typography level="body-xs" color="neutral">
              {resultCount} of {totalCount} personas
            </Typography>
          )}
          {hasActiveFilters ? (
            <JoyButton
              variant="plain"
              color="primary"
              size="sm"
              sx={{ minHeight: "auto", px: 0 }}
              onClick={onClearFilters}
            >
              Clear filters
            </JoyButton>
          ) : null}
        </Stack>
      </Stack>

      <JoyDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter personas"
        description="Adjust the catalog without adding extra visual noise to the page."
        size="sm"
      >
        <Stack spacing={2}>
          <JoySearchInput
            value={query}
            placeholder="Search personas..."
            onDebouncedChange={onQueryChange}
            onClear={() => onQueryChange("")}
          />
          <Divider />
          <FilterControls
            view={view}
            onViewChange={onViewChange}
            sort={sort}
            onSortChange={onSortChange}
            align="column"
          />
          <JoyButton
            variant="plain"
            color="neutral"
            onClick={() => setFiltersOpen(false)}
          >
            Apply filters
          </JoyButton>
        </Stack>
      </JoyDrawer>
    </>
  );
}
