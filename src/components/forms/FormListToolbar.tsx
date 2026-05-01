import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import {
  AddRounded,
  CheckRounded,
  CloseRounded,
  SearchRounded,
  SortRounded,
} from "@mui/icons-material";
import { GridViewRounded, ViewListRounded } from "@mui/icons-material";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTooltip } from "@/components/joy/JoyTooltip";

type StatusFilter = "all" | "draft" | "published" | "archived";
type SortOption =
  | "updated-desc"
  | "name-asc"
  | "name-desc"
  | "submissions-desc"
  | "newest"
  | "oldest";
type ViewMode = "grid" | "list";

interface SortOptionConfig {
  value: SortOption;
  label: string;
}

interface FormListToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  sortValue: SortOption;
  onSortChange: (value: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewForm: () => void;
  onClearFilters: () => void;
  statusCounts: {
    all: number;
    draft: number;
    published: number;
    archived: number;
  };
  sortOptions: SortOptionConfig[];
  isLoading?: boolean;
  formCount?: number;
  filteredFormCount?: number;
}

const DEFAULT_SORT_OPTION = "updated-desc";

export function FormListToolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortValue,
  onSortChange,
  viewMode,
  onViewModeChange,
  onNewForm,
  onClearFilters,
  statusCounts,
  sortOptions,
  isLoading = false,
  formCount = 0,
  filteredFormCount = 0,
}: FormListToolbarProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [sortMenuAnchor, setSortMenuAnchor] =
    React.useState<HTMLElement | null>(null);
  const [showSearchHint, setShowSearchHint] = React.useState(true);

  const hasActiveFilters =
    Boolean(searchValue.trim()) ||
    statusFilter !== "all" ||
    sortValue !== DEFAULT_SORT_OPTION;
  const isNonDefaultSort = sortValue !== DEFAULT_SORT_OPTION;
  const sortLabel =
    sortOptions.find((opt) => opt.value === sortValue)?.label || "Sort";

  // Handle "/" keyboard shortcut to focus search
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchFocus = () => {
    setShowSearchHint(false);
  };

  const handleSearchBlur = () => {
    if (!searchValue.trim()) {
      setShowSearchHint(true);
    }
  };

  const handleSearchClear = () => {
    onSearchChange("");
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      if (searchValue.trim()) {
        handleSearchClear();
      } else {
        searchInputRef.current?.blur();
        setShowSearchHint(true);
      }
    }
  };

  const handleSortMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (sortMenuAnchor) {
      setSortMenuAnchor(null);
    } else {
      setSortMenuAnchor(event.currentTarget);
    }
  };

  const handleSortMenuClose = () => {
    setSortMenuAnchor(null);
  };

  const handleSortSelect = (option: SortOption) => {
    onSortChange(option);
    handleSortMenuClose();
  };

  const resultText = React.useMemo(() => {
    if (hasActiveFilters && filteredFormCount !== formCount) {
      return `Showing ${filteredFormCount} of ${formCount} ${formCount === 1 ? "form" : "forms"}`;
    }
    return `${formCount} ${formCount === 1 ? "form" : "forms"}`;
  }, [hasActiveFilters, formCount, filteredFormCount]);

  return (
    <Stack spacing={2}>
      {/* Main Toolbar Sheet */}
      <Sheet
        variant="outlined"
        sx={{
          bgcolor: "background.surface",
          borderColor: "neutral.200",
          borderRadius: "var(--joy-radius-lg)",
          p: 1.5,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 1.5,
          justifyContent: "space-between",
          transition: "all 150ms ease",
        }}
      >
        {/* Search Input */}
        <Input
          ref={searchInputRef}
          placeholder="Search forms…"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          onKeyDown={handleSearchKeyDown}
          disabled={isLoading}
          startDecorator={
            <SearchRounded sx={{ color: "neutral.500", fontSize: 18 }} />
          }
          endDecorator={
            searchValue.trim() ? (
              <JoyTooltip title="Clear search">
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  onClick={handleSearchClear}
                  sx={{ p: 0.5 }}
                >
                  <CloseRounded sx={{ fontSize: 16 }} />
                </IconButton>
              </JoyTooltip>
            ) : showSearchHint ? (
              <JoyChip
                size="sm"
                variant="plain"
                color="neutral"
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  pointerEvents: "none",
                }}
              >
                /
              </JoyChip>
            ) : null
          }
          variant="plain"
          size="sm"
          sx={{
            flex: "0 1 320px",
            minWidth: 180,
            maxWidth: 320,
            "--Input-focusedThickness": "0px",
            transition: "max-width 200ms ease",
            "&:focus-within": {
              maxWidth: 400,
            },
          }}
        />

        {/* Filters Container */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            display: "flex",
            flexShrink: 0,
            gap: 1.5,
          }}
        >
          {/* Status Filter Tabs */}
          <Tabs
            value={statusFilter}
            onChange={(_, newValue) => {
              if (
                newValue &&
                ["all", "draft", "published", "archived"].includes(
                  newValue as string,
                )
              ) {
                onStatusChange(newValue as StatusFilter);
              }
            }}
            size="sm"
            sx={{
              bgcolor: "transparent",
              display: { xs: "none", sm: "flex" },
            }}
          >
            <TabList
              disableUnderline
              sx={{
                bgcolor: "background.level1",
                borderRadius: "md",
                p: 0.5,
                gap: 0.5,
                boxShadow: "sm",
              }}
            >
              <Tab
                disableIndicator
                value="all"
                sx={{
                  borderRadius: "sm",
                  fontWeight: "md",
                  fontSize: "xs",
                  px: 1.5,
                  py: 0.5,
                  "&[aria-selected='true']": {
                    bgcolor: "background.surface",
                    boxShadow: "sm",
                    fontWeight: "lg",
                  },
                }}
              >
                All ({statusCounts.all})
              </Tab>
              <Tab
                disableIndicator
                value="draft"
                sx={{
                  borderRadius: "sm",
                  fontWeight: "md",
                  fontSize: "xs",
                  px: 1.5,
                  py: 0.5,
                  "&[aria-selected='true']": {
                    bgcolor: "background.surface",
                    boxShadow: "sm",
                    fontWeight: "lg",
                  },
                }}
              >
                Draft ({statusCounts.draft})
              </Tab>
              <Tab
                disableIndicator
                value="published"
                sx={{
                  borderRadius: "sm",
                  fontWeight: "md",
                  fontSize: "xs",
                  px: 1.5,
                  py: 0.5,
                  "&[aria-selected='true']": {
                    bgcolor: "background.surface",
                    boxShadow: "sm",
                    fontWeight: "lg",
                  },
                }}
              >
                Published ({statusCounts.published})
              </Tab>
              <Tab
                disableIndicator
                value="archived"
                sx={{
                  borderRadius: "sm",
                  fontWeight: "md",
                  fontSize: "xs",
                  px: 1.5,
                  py: 0.5,
                  "&[aria-selected='true']": {
                    bgcolor: "background.surface",
                    boxShadow: "sm",
                    fontWeight: "lg",
                  },
                }}
              >
                Archived ({statusCounts.archived})
              </Tab>
            </TabList>
          </Tabs>

          {/* Sort Selector */}
          <Box
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              position: "relative",
            }}
          >
            <JoyTooltip title="Sort forms">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={handleSortMenuOpen}
                disabled={isLoading}
                sx={{
                  position: "relative",
                  "&::after": isNonDefaultSort
                    ? {
                        content: '""',
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: "primary.500",
                      }
                    : undefined,
                }}
              >
                <SortRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </JoyTooltip>
          </Box>
          <Menu
            anchorEl={sortMenuAnchor}
            open={Boolean(sortMenuAnchor)}
            onClose={handleSortMenuClose}
            onBackdropClick={handleSortMenuClose}
            placement="bottom-end"
            sx={{
              "& .MuiMenu-paper": {
                bgcolor: "background.surface",
                minWidth: 180,
              },
            }}
          >
            {sortOptions.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => handleSortSelect(option.value)}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <span>{option.label}</span>
                {sortValue === option.value ? (
                  <CheckRounded sx={{ fontSize: 16, color: "primary.500" }} />
                ) : null}
              </MenuItem>
            ))}
          </Menu>

          {/* View Toggle */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.25,
              p: 0.25,
              borderRadius: "sm",
              bgcolor: "background.level1",
              boxShadow: "sm",
            }}
          >
            <JoyTooltip title="Grid view">
              <IconButton
                size="sm"
                variant={viewMode === "grid" ? "soft" : "plain"}
                color={viewMode === "grid" ? "neutral" : "neutral"}
                onClick={() => onViewModeChange("grid")}
                disabled={isLoading}
              >
                <GridViewRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </JoyTooltip>
            <JoyTooltip title="List view">
              <IconButton
                size="sm"
                variant={viewMode === "list" ? "soft" : "plain"}
                color={viewMode === "list" ? "neutral" : "neutral"}
                onClick={() => onViewModeChange("list")}
                disabled={isLoading}
              >
                <ViewListRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </JoyTooltip>
          </Box>

          {/* Divider */}
          <Divider
            orientation="vertical"
            sx={{
              height: 24,
              display: { xs: "none", sm: "block" },
            }}
          />

          {/* New Form Button */}
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<AddRounded sx={{ fontSize: 16 }} />}
            onClick={onNewForm}
            disabled={isLoading}
            sx={{
              display: { xs: "none", sm: "flex" },
            }}
          >
            New form
          </Button>

          {/* New Form Icon Button (Mobile) */}
          <JoyTooltip title="New form">
            <IconButton
              size="sm"
              variant="solid"
              color="primary"
              onClick={onNewForm}
              disabled={isLoading}
              sx={{
                display: { xs: "flex", sm: "none" },
              }}
            >
              <AddRounded sx={{ fontSize: 16 }} />
            </IconButton>
          </JoyTooltip>
        </Stack>
      </Sheet>

      {/* Active Filters Feedback Row */}
      {hasActiveFilters ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            animation: "fadeIn 150ms ease-out",
            "@keyframes fadeIn": {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          <Typography level="body-xs" color="neutral" sx={{ flexShrink: 0 }}>
            {resultText}
          </Typography>

          {searchValue.trim() ? (
            <JoyChip
              size="sm"
              variant="soft"
              color="neutral"
              endDecorator={
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  sx={{ p: 0.25 }}
                  onClick={() => handleSearchClear()}
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              }
              sx={{
                animation: "chipEnter 150ms ease-out",
                "@keyframes chipEnter": {
                  from: { transform: "scale(0.8)", opacity: 0 },
                  to: { transform: "scale(1)", opacity: 1 },
                },
              }}
            >
              {searchValue.trim()}
            </JoyChip>
          ) : null}

          {statusFilter !== "all" ? (
            <JoyChip
              size="sm"
              variant="soft"
              color="neutral"
              endDecorator={
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  sx={{ p: 0.25 }}
                  onClick={() => onStatusChange("all")}
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              }
              sx={{
                animation: "chipEnter 150ms ease-out",
                "@keyframes chipEnter": {
                  from: { transform: "scale(0.8)", opacity: 0 },
                  to: { transform: "scale(1)", opacity: 1 },
                },
              }}
            >
              {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
            </JoyChip>
          ) : null}

          {isNonDefaultSort ? (
            <JoyChip
              size="sm"
              variant="soft"
              color="neutral"
              endDecorator={
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  sx={{ p: 0.25 }}
                  onClick={() =>
                    onSortChange(DEFAULT_SORT_OPTION as SortOption)
                  }
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              }
              sx={{
                animation: "chipEnter 150ms ease-out",
                "@keyframes chipEnter": {
                  from: { transform: "scale(0.8)", opacity: 0 },
                  to: { transform: "scale(1)", opacity: 1 },
                },
              }}
            >
              {sortLabel}
            </JoyChip>
          ) : null}

          <Button
            size="sm"
            variant="plain"
            color="neutral"
            onClick={onClearFilters}
            sx={{
              ml: "auto",
              flexShrink: 0,
            }}
          >
            Clear all
          </Button>
        </Stack>
      ) : (
        <Typography level="body-xs" color="neutral">
          {resultText}
        </Typography>
      )}
    </Stack>
  );
}
