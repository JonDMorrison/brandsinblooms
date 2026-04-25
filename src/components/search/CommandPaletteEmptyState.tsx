import Button from "@mui/joy/Button";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Grid from "@mui/joy/Grid";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Clock3, X } from "lucide-react";
import type {
  RecentSearchItemEntry,
  RecentSearchQueryEntry,
} from "@/components/search/searchHistory";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import {
  getSearchIcon,
  isCurrentRouteMatch,
  type SearchResultItem,
} from "@/components/search/types";
import type { PaletteExecutableAction } from "@/components/search/searchActionRegistry";

interface CommandPaletteEmptyStateProps {
  activeItemId?: string | null;
  activeActionIndex: number;
  copiedActionId?: string | null;
  currentPathname: string;
  errorByItemId?: Record<string, string>;
  getItemActions: (item: SearchResultItem) => PaletteExecutableAction[];
  jumpTo: SearchResultItem[];
  onCloseActionMenu: () => void;
  onClearRecentSearches: () => void;
  onHoverAction: (index: number) => void;
  onHoverItem: (itemId: string) => void;
  onOpenActionMenu: (itemId?: string | null) => void;
  openActionItemId?: string | null;
  onRemoveRecentSearch: (query: string) => void;
  onSelectAction: (item: SearchResultItem, action: PaletteExecutableAction) => void;
  onSelectItem: (item: SearchResultItem) => void;
  onSuggestQuery: (query: string) => void;
  pendingActionId?: string | null;
  recentItems: RecentSearchItemEntry[];
  recentSearches: RecentSearchQueryEntry[];
  routeAwareSuggestions: SearchResultItem[];
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "Recently visited";
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60_000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function CommandPaletteEmptyState({
  activeItemId,
  activeActionIndex,
  copiedActionId,
  currentPathname,
  errorByItemId,
  getItemActions,
  jumpTo,
  onCloseActionMenu,
  onClearRecentSearches,
  onHoverAction,
  onHoverItem,
  onOpenActionMenu,
  openActionItemId,
  onRemoveRecentSearch,
  onSelectAction,
  onSelectItem,
  onSuggestQuery,
  pendingActionId,
  recentItems,
  recentSearches,
  routeAwareSuggestions,
}: CommandPaletteEmptyStateProps) {
  return (
    <Stack spacing={2.5} sx={{ p: 1.5 }}>
      <Box sx={{ px: 0.5, pt: 0.25 }}>
        <Typography level="title-sm" sx={{ color: "neutral.800" }}>
          Pick Up Where You Left Off
        </Typography>
        <Typography level="body-sm" sx={{ mt: 0.5, color: "neutral.500" }}>
          Recent searches and recently visited pages stay here between sessions. New workspaces start with quick actions and nearby pages.
        </Typography>
      </Box>

      <Box sx={{ px: 0.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography
            level="body-xs"
            sx={{ color: "neutral.600", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Recent Searches
          </Typography>
          {recentSearches.length > 0 ? (
            <Button
              color="neutral"
              onClick={onClearRecentSearches}
              size="sm"
              variant="plain"
            >
              Clear
            </Button>
          ) : null}
        </Stack>
        {recentSearches.length > 0 ? (
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {recentSearches.map((recentSearch) => (
              <Box
                key={recentSearch.normalizedQuery}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 1,
                  alignItems: "center",
                  px: 1,
                  py: 0.75,
                  borderRadius: "var(--joy-radius-md)",
                  border: "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
                  backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.02)",
                }}
              >
                <Button
                  color="neutral"
                  onClick={() => onSuggestQuery(recentSearch.query)}
                  size="sm"
                  startDecorator={<Clock3 size={14} strokeWidth={1.9} />}
                  variant="plain"
                  sx={{
                    justifyContent: "flex-start",
                    minWidth: 0,
                    px: 0,
                    color: "neutral.800",
                  }}
                >
                  <Stack spacing={0.125} sx={{ minWidth: 0, alignItems: "flex-start" }}>
                    <Typography level="body-sm" noWrap sx={{ fontWeight: 600 }}>
                      {recentSearch.query}
                    </Typography>
                    <Typography level="body-xs" noWrap sx={{ color: "neutral.500" }}>
                      {recentSearch.selectedResultTitle ?? "Recent search"}
                    </Typography>
                  </Stack>
                </Button>
                <IconButton
                  aria-label={`Remove ${recentSearch.query} from recent searches`}
                  color="neutral"
                  onClick={() => onRemoveRecentSearch(recentSearch.query)}
                  size="sm"
                  variant="plain"
                >
                  <X size={14} strokeWidth={1.9} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography level="body-sm" sx={{ mt: 1, color: "neutral.500" }}>
            Recent queries appear after you open a search result.
          </Typography>
        )}
      </Box>

      <Divider sx={{ mx: 0.5 }} />

      <Box sx={{ px: 0.5 }}>
        <Typography
          level="body-xs"
          sx={{ color: "neutral.500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Suggested Actions
        </Typography>
        <Typography level="body-sm" sx={{ mt: 0.5, color: "neutral.500" }}>
          These suggestions follow the page you are on right now.
        </Typography>

        {routeAwareSuggestions.length > 0 ? (
          <Grid container spacing={1} sx={{ mt: 1.25 }}>
            {routeAwareSuggestions.map((item) => {
              const SuggestionIcon = getSearchIcon(item.icon ?? item.categoryIcon);
              const isActive = activeItemId === item.id;

              return (
                <Grid key={item.id} xs={12} sm={6}>
                  <Button
                    color={isActive ? "primary" : "neutral"}
                    fullWidth
                    onClick={() => onSelectItem(item)}
                    onFocus={() => onHoverItem(item.id)}
                    onMouseEnter={() => onHoverItem(item.id)}
                    onMouseDown={(event) => event.preventDefault()}
                    size="lg"
                    startDecorator={<SuggestionIcon size={16} strokeWidth={1.9} />}
                    variant={isActive ? "soft" : "outlined"}
                    sx={{
                      justifyContent: "flex-start",
                      minHeight: 58,
                      borderRadius: "lg",
                    }}
                  >
                    <Stack spacing={0.25} sx={{ alignItems: "flex-start" }}>
                      <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      {item.subtitle ? (
                        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                          {item.subtitle}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Button>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Typography level="body-sm" sx={{ mt: 1, color: "neutral.500" }}>
            Open a CRM, SMS, integrations, or settings page to get route-specific actions here.
          </Typography>
        )}
      </Box>

      <Divider sx={{ mx: 0.5 }} />

      <Stack spacing={0.5}>
        <Typography
          level="body-xs"
          sx={{ px: 0.5, color: "neutral.500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Recently Visited
        </Typography>
        {recentItems.length > 0 ? (
          recentItems.map(({ item, lastVisitedAt }) => (
            <SearchResultRow
              key={item.id}
              activeActionIndex={activeActionIndex}
              actions={getItemActions(item)}
              auxiliaryLabel={formatRelativeTime(lastVisitedAt)}
              copiedActionId={copiedActionId}
              errorMessage={errorByItemId?.[item.id]}
              isActive={activeItemId === item.id}
              isActionMenuOpen={openActionItemId === item.id}
              isCurrent={isCurrentRouteMatch(currentPathname, item.route)}
              item={item}
              onCloseActionMenu={onCloseActionMenu}
              onHoverAction={onHoverAction}
              onHover={onHoverItem}
              onOpenActionMenu={onOpenActionMenu}
              onSelectAction={onSelectAction}
              onSelect={onSelectItem}
              pendingActionId={pendingActionId}
            />
          ))
        ) : (
          <Typography level="body-sm" sx={{ px: 0.5, color: "neutral.500" }}>
            Pages and records you open from search appear here for quick return visits.
          </Typography>
        )}
      </Stack>

      {jumpTo.length > 0 ? (
        <Stack spacing={0.5}>
          <Typography
            level="body-xs"
            sx={{ px: 0.5, color: "neutral.500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Jump To
          </Typography>
          {jumpTo.map((item) => (
            <SearchResultRow
              key={item.id}
              activeActionIndex={activeActionIndex}
              actions={getItemActions(item)}
              copiedActionId={copiedActionId}
              errorMessage={errorByItemId?.[item.id]}
              isActive={activeItemId === item.id}
              isActionMenuOpen={openActionItemId === item.id}
              isCurrent={isCurrentRouteMatch(currentPathname, item.route)}
              item={item}
              onCloseActionMenu={onCloseActionMenu}
              onHoverAction={onHoverAction}
              onHover={onHoverItem}
              onOpenActionMenu={onOpenActionMenu}
              onSelectAction={onSelectAction}
              onSelect={onSelectItem}
              pendingActionId={pendingActionId}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}