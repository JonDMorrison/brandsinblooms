import Badge from "@mui/joy/Badge";
import ButtonGroup from "@mui/joy/ButtonGroup";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  PanelRight,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import type { CalendarFilters } from "@/hooks/useUnifiedCalendarData";
import { CalendarPlanningFilters } from "./CalendarPlanningFilters";

type ViewMode = "month" | "week" | "list";

interface CalendarToolbarProps {
  currentDate: Date;
  viewMode: ViewMode;
  filters: CalendarFilters;
  filterOptions: {
    types: string[];
    platforms: string[];
    statuses: string[];
  };
  selectionCount: number;
  showPlanningPanel: boolean;
  isRefreshing: boolean;
  bulkCompleteLoading?: boolean;
  bulkDeleteLoading?: boolean;
  lastUpdated?: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onFiltersChange: (filters: Partial<CalendarFilters>) => void;
  onResetFilters: () => void;
  onTogglePlanningPanel: () => void;
  onBulkComplete?: () => void;
  onBulkDelete?: () => void;
}

const DEFAULT_TYPE_COUNT = 5;

function getFilterCount(filters: CalendarFilters) {
  let count = 0;

  if (filters.types.length !== DEFAULT_TYPE_COUNT) count += 1;
  if (filters.platforms.length > 0) count += 1;
  if (filters.statuses.length > 0) count += 1;
  if (!filters.showPublished) count += 1;
  if (filters.searchQuery.trim()) count += 1;

  return count;
}

function getRangeLabel(date: Date, viewMode: ViewMode) {
  if (viewMode === "month") {
    return format(date, "MMMM yyyy");
  }

  if (viewMode === "week") {
    return format(date, "'Week of' MMM d, yyyy");
  }

  return format(date, "MMMM yyyy");
}

export function CalendarToolbar({
  currentDate,
  viewMode,
  filters,
  filterOptions,
  selectionCount,
  showPlanningPanel,
  isRefreshing,
  bulkCompleteLoading = false,
  bulkDeleteLoading = false,
  lastUpdated,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
  onFiltersChange,
  onResetFilters,
  onTogglePlanningPanel,
  onBulkComplete,
  onBulkDelete,
}: CalendarToolbarProps) {
  const activeFilterCount = getFilterCount(filters);

  return (
    <Stack
      spacing={1.5}
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        py: { xs: 1.25, md: 1.5 },
        borderBottom: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      }}
    >
      <Stack
        direction={{ xs: "column", xl: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", xl: "center" }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <IconButton variant="soft" color="neutral" onClick={onPrevious}>
            <ChevronLeft size={16} />
          </IconButton>
          <Stack spacing={0.125} sx={{ minWidth: 0 }}>
            <Typography level="title-md">
              {getRangeLabel(currentDate, viewMode)}
            </Typography>
            <Typography level="body-xs" color="neutral">
              {lastUpdated
                ? `Updated ${format(new Date(lastUpdated), "MMM d, h:mm a")}`
                : "Planning calendar"}
            </Typography>
          </Stack>
          <IconButton variant="soft" color="neutral" onClick={onNext}>
            <ChevronRight size={16} />
          </IconButton>
          <JoyButton bloomVariant="outline" color="neutral" onClick={onToday}>
            Today
          </JoyButton>
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent={{ xs: "stretch", md: "flex-end" }}
        >
          <ButtonGroup
            variant="soft"
            color="neutral"
            sx={{ borderRadius: "lg" }}
          >
            <JoyButton
              variant={viewMode === "month" ? "solid" : "soft"}
              color={viewMode === "month" ? "primary" : "neutral"}
              startDecorator={<LayoutGrid size={14} />}
              onClick={() => onViewModeChange("month")}
            >
              Month
            </JoyButton>
            <JoyButton
              variant={viewMode === "week" ? "solid" : "soft"}
              color={viewMode === "week" ? "primary" : "neutral"}
              startDecorator={<CalendarRange size={14} />}
              onClick={() => onViewModeChange("week")}
            >
              Week
            </JoyButton>
            <JoyButton
              variant={viewMode === "list" ? "solid" : "soft"}
              color={viewMode === "list" ? "primary" : "neutral"}
              startDecorator={<List size={14} />}
              onClick={() => onViewModeChange("list")}
            >
              List
            </JoyButton>
          </ButtonGroup>

          <Stack
            direction="row"
            spacing={0.75}
            justifyContent={{ xs: "space-between", md: "flex-end" }}
          >
            <JoyDropdownMenu>
              <Badge
                badgeContent={activeFilterCount || undefined}
                color="primary"
                size="sm"
              >
                <JoyDropdownMenuTrigger aria-label="Open filters">
                  <Filter size={16} />
                </JoyDropdownMenuTrigger>
              </Badge>
              <JoyDropdownMenuContent
                sx={{ p: 0, width: 320, maxWidth: "calc(100vw - 24px)" }}
              >
                <CalendarPlanningFilters
                  compact
                  filters={filters}
                  filterOptions={filterOptions}
                  onFiltersChange={onFiltersChange}
                  onReset={onResetFilters}
                />
              </JoyDropdownMenuContent>
            </JoyDropdownMenu>

            <IconButton
              variant={showPlanningPanel ? "solid" : "soft"}
              color={showPlanningPanel ? "primary" : "neutral"}
              onClick={onTogglePlanningPanel}
            >
              <PanelRight size={16} />
            </IconButton>
          </Stack>
        </Stack>
      </Stack>

      {selectionCount > 0 ? (
        <Sheet
          variant="soft"
          color="primary"
          sx={{
            px: 1.25,
            py: 1,
            borderRadius: "lg",
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 1,
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Typography level="body-sm" fontWeight="lg">
            {selectionCount} {selectionCount === 1 ? "task" : "tasks"} selected
          </Typography>
          <Stack direction="row" spacing={0.75}>
            <JoyButton
              variant="solid"
              color="success"
              loading={bulkCompleteLoading}
              onClick={onBulkComplete}
            >
              Mark Complete
            </JoyButton>
            <JoyButton
              variant="solid"
              color="danger"
              loading={bulkDeleteLoading}
              onClick={onBulkDelete}
            >
              Delete
            </JoyButton>
          </Stack>
        </Sheet>
      ) : null}
    </Stack>
  );
}
