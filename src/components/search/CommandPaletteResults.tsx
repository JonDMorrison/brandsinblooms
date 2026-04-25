import { useEffect, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CircleAlert } from "lucide-react";
import { CommandPaletteEmptyState } from "@/components/search/CommandPaletteEmptyState";
import { CommandPaletteShortcutsPanel } from "@/components/search/CommandPaletteShortcutsPanel";
import { CommandPaletteNoResults } from "@/components/search/CommandPaletteNoResults";
import type {
  RecentSearchItemEntry,
  RecentSearchQueryEntry,
} from "@/components/search/searchHistory";
import type { PaletteExecutableAction } from "@/components/search/searchActionRegistry";
import { SearchResultGroup } from "@/components/search/SearchResultGroup";
import {
  type SearchResultGroup as SearchResultGroupType,
  type SearchResultItem,
} from "@/components/search/types";

function getPaletteOptionId(itemId: string) {
  return `command-palette-option-${itemId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

interface CommandPaletteResultsProps {
  activeItemId?: string | null;
  activeActionIndex: number;
  copiedActionId?: string | null;
  currentPathname: string;
  errorByItemId?: Record<string, string>;
  getItemActions: (item: SearchResultItem) => PaletteExecutableAction[];
  isDatabaseLoading: boolean;
  jumpTo: SearchResultItem[];
  listboxId: string;
  onCloseActionMenu: () => void;
  onClearRecentSearches: () => void;
  onHoverAction: (index: number) => void;
  onHoverItem: (itemId: string) => void;
  onOpenActionMenu: (itemId?: string | null) => void;
  onRemoveRecentSearch: (query: string) => void;
  onSelectAction: (item: SearchResultItem, action: PaletteExecutableAction) => void;
  onSelectItem: (item: SearchResultItem) => void;
  onSuggestQuery: (query: string) => void;
  openActionItemId?: string | null;
  pendingActionId?: string | null;
  query: string;
  recentItems: RecentSearchItemEntry[];
  recentSearches: RecentSearchQueryEntry[];
  results: SearchResultGroupType[];
  routeAwareSuggestions: SearchResultItem[];
  showShortcuts?: boolean;
  warning: string | null;
}

export function CommandPaletteResults({
  activeItemId,
  activeActionIndex,
  copiedActionId,
  currentPathname,
  errorByItemId,
  getItemActions,
  isDatabaseLoading,
  jumpTo,
  listboxId,
  onCloseActionMenu,
  onClearRecentSearches,
  onHoverAction,
  onHoverItem,
  onOpenActionMenu,
  onRemoveRecentSearch,
  onSelectAction,
  onSelectItem,
  onSuggestQuery,
  openActionItemId,
  pendingActionId,
  query,
  recentItems,
  recentSearches,
  results,
  routeAwareSuggestions,
  showShortcuts = false,
  warning,
}: CommandPaletteResultsProps) {
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);

  useEffect(() => {
    if (!isDatabaseLoading || results.length > 0) {
      setShowLoadingSkeleton(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowLoadingSkeleton(true);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isDatabaseLoading, results.length]);

  if (showShortcuts) {
    return <CommandPaletteShortcutsPanel />;
  }

  if (!query.trim()) {
    return (
      <CommandPaletteEmptyState
        activeItemId={activeItemId}
        activeActionIndex={activeActionIndex}
        copiedActionId={copiedActionId}
        currentPathname={currentPathname}
        errorByItemId={errorByItemId}
        getItemActions={getItemActions}
        jumpTo={jumpTo}
        onCloseActionMenu={onCloseActionMenu}
        onClearRecentSearches={onClearRecentSearches}
        onHoverAction={onHoverAction}
        onHoverItem={onHoverItem}
        onOpenActionMenu={onOpenActionMenu}
        onRemoveRecentSearch={onRemoveRecentSearch}
        openActionItemId={openActionItemId}
        onSelectAction={onSelectAction}
        onSelectItem={onSelectItem}
        onSuggestQuery={onSuggestQuery}
        pendingActionId={pendingActionId}
        recentItems={recentItems}
        recentSearches={recentSearches}
        routeAwareSuggestions={routeAwareSuggestions}
      />
    );
  }

  const showNoResults = results.length === 0 && !isDatabaseLoading;

  return (
    <Box
      id={listboxId}
      role="listbox"
      aria-busy={isDatabaseLoading}
      aria-label="Search results"
      sx={{ py: results.length > 0 ? 0.5 : 0 }}
    >
      {results.map((group) => (
        <SearchResultGroup
          key={group.category}
          activeItemId={activeItemId}
          activeActionIndex={activeActionIndex}
          copiedActionId={copiedActionId}
          currentPathname={currentPathname}
          errorByItemId={errorByItemId}
          getItemActions={getItemActions}
          group={group}
          openActionItemId={openActionItemId}
          onCloseActionMenu={onCloseActionMenu}
          onHoverAction={onHoverAction}
          onHoverItem={onHoverItem}
          onOpenActionMenu={onOpenActionMenu}
          onSelectAction={onSelectAction}
          onSelectItem={onSelectItem}
          optionIdForItem={getPaletteOptionId}
          pendingActionId={pendingActionId}
          query={query}
        />
      ))}

      {showLoadingSkeleton ? <CommandPaletteResultsSkeleton /> : null}

      {showNoResults ? <CommandPaletteNoResults query={query} /> : null}

      {isDatabaseLoading || warning ? (
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
            pt: results.length > 0 || showNoResults ? 0.75 : 1.5,
          }}
        >
          <Stack spacing={1}>
            {isDatabaseLoading && !showLoadingSkeleton ? (
              <Stack spacing={0.75}>
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  Searching records...
                </Typography>
                <LinearProgress
                  size="sm"
                  sx={{
                    borderRadius: "999px",
                    "--LinearProgress-radius": "999px",
                    "--LinearProgress-thickness": "2px",
                  }}
                />
              </Stack>
            ) : null}

            {warning ? (
              <Alert
                color="warning"
                startDecorator={<CircleAlert size={18} strokeWidth={1.9} />}
                sx={{ alignItems: "center" }}
              >
                {warning}
              </Alert>
            ) : null}
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

function CommandPaletteResultsSkeleton() {
  return (
    <Stack spacing={1.5} sx={{ px: 2, py: 1.5 }}>
      {[0, 1].map((groupIndex) => (
        <Stack key={groupIndex} spacing={0.75}>
          <Skeleton animation="wave" sx={{ borderRadius: "999px", height: 12, width: 124 }} />
          {[0, 1, 2].map((rowIndex) => (
            <Box
              key={rowIndex}
              sx={{
                display: "grid",
                gridTemplateColumns: "36px minmax(0, 1fr) 96px",
                gap: 1.25,
                alignItems: "center",
                px: 1,
                py: 0.75,
                borderRadius: "var(--joy-radius-md)",
                border: "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
              }}
            >
              <Skeleton animation="wave" sx={{ width: 32, height: 32, borderRadius: "12px" }} />
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Skeleton animation="wave" sx={{ height: 14, width: `${70 - rowIndex * 8}%` }} />
                <Skeleton animation="wave" sx={{ height: 10, width: `${54 - rowIndex * 6}%` }} />
              </Stack>
              <Skeleton animation="wave" sx={{ height: 20, width: 84, borderRadius: "999px" }} />
            </Box>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}