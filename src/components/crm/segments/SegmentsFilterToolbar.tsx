import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import { LayoutGrid, Table2 } from "lucide-react";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
import type {
  SegmentListFilters,
  SegmentSortKey,
  SegmentStatus,
  SegmentViewMode,
} from "@/hooks/useSegments";

const typeOptions = [
  { value: "all", label: "All types" },
  { value: "dynamic", label: "Dynamic" },
  { value: "static", label: "Static" },
] as const;

const statusOptions: Array<{ value: "all" | SegmentStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

const sortOptions: Array<{ value: SegmentSortKey; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "members-desc", label: "Most members" },
  { value: "members-asc", label: "Fewest members" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

export interface SegmentsFilterToolbarProps {
  filters: SegmentListFilters;
  onFiltersChange: (filters: SegmentListFilters) => void;
  viewMode: SegmentViewMode;
  onViewModeChange: (view: SegmentViewMode) => void;
}

export function SegmentsFilterToolbar({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
}: SegmentsFilterToolbarProps) {
  return (
    <Stack
      direction={{ xs: "column", xl: "row" }}
      spacing={1.5}
      sx={{ width: "100%" }}
    >
      <JoySearchInput
        appearance="page"
        debounceMs={250}
        onDebouncedChange={(search) => onFiltersChange({ ...filters, search })}
        placeholder="Search segments"
        sx={{ minWidth: 260, flex: 1 }}
        value={filters.search ?? ""}
      />
      <JoySelect
        onValueChange={(type) =>
          onFiltersChange({
            ...filters,
            type: (type || "all") as SegmentListFilters["type"],
          })
        }
        options={typeOptions.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        placeholder="Type"
        sx={{ minWidth: 160 }}
        value={filters.type ?? "all"}
      />
      <JoySelect
        onValueChange={(status) =>
          onFiltersChange({
            ...filters,
            status: (status || "all") as SegmentListFilters["status"],
          })
        }
        options={statusOptions.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        placeholder="Status"
        sx={{ minWidth: 160 }}
        value={filters.status ?? "all"}
      />
      <JoySelect
        onValueChange={(sort) =>
          onFiltersChange({
            ...filters,
            sort: (sort || "newest") as SegmentSortKey,
          })
        }
        options={sortOptions.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        placeholder="Sort"
        sx={{ minWidth: 180 }}
        value={filters.sort ?? "newest"}
      />
      <Stack direction="row" spacing={0.5} sx={{ ml: { xl: "auto" } }}>
        <Tooltip title="Grid view">
          <IconButton
            color={viewMode === "grid" ? "primary" : "neutral"}
            onClick={() => onViewModeChange("grid")}
            variant={viewMode === "grid" ? "soft" : "plain"}
          >
            <LayoutGrid size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Table view">
          <IconButton
            color={viewMode === "table" ? "primary" : "neutral"}
            onClick={() => onViewModeChange("table")}
            variant={viewMode === "table" ? "soft" : "plain"}
          >
            <Table2 size={18} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
