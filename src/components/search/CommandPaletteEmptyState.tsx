import Button from "@mui/joy/Button";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Grid from "@mui/joy/Grid";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, Clock3, Sparkles, X } from "lucide-react";
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
import {
  getCommandIdFromSearchItem,
  type PaletteExecutableAction,
} from "@/components/search/searchActionRegistry";

const ASK_BLOOM_COMMAND_ID = "ask-bloom";

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

interface AskBloomSuggestionCardProps {
  item: SearchResultItem;
  isActive: boolean;
  onHover: (itemId: string) => void;
  onSelect: (item: SearchResultItem) => void;
}

/**
 * Premium, brand-forward entry point for the Ask Bloom assistant. Rendered as a
 * full-width hero above the generic route suggestions so the AI surface reads as
 * the primary call to action rather than one more outlined button.
 */
function AskBloomSuggestionCard({
  item,
  isActive,
  onHover,
  onSelect,
}: AskBloomSuggestionCardProps) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={
        item.subtitle ? `${item.title} — ${item.subtitle}` : item.title
      }
      onClick={() => onSelect(item)}
      onFocus={() => onHover(item.id)}
      onMouseEnter={() => onHover(item.id)}
      onMouseDown={(event) => event.preventDefault()}
      sx={{
        appearance: "none",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        textAlign: "left",
        cursor: "pointer",
        p: 1.5,
        borderRadius: "var(--joy-radius-xl)",
        border: "1px solid",
        borderColor: isActive
          ? "rgba(var(--joy-palette-primary-mainChannel) / 0.55)"
          : "rgba(var(--joy-palette-primary-mainChannel) / 0.22)",
        color: "text.primary",
        backgroundColor: "background.surface",
        backgroundImage:
          "linear-gradient(135deg, rgba(var(--joy-palette-primary-mainChannel) / 0.16) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.05) 45%, rgba(var(--joy-palette-primary-mainChannel) / 0) 100%)",
        boxShadow: isActive
          ? "0 0 0 1px rgba(var(--joy-palette-primary-mainChannel) / 0.45), 0 18px 36px -18px rgba(var(--joy-palette-primary-mainChannel) / 0.6)"
          : "0 1px 2px rgba(var(--joy-palette-neutral-mainChannel) / 0.06)",
        transition:
          "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
          borderColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.5)",
          boxShadow:
            "0 0 0 1px rgba(var(--joy-palette-primary-mainChannel) / 0.35), 0 20px 40px -18px rgba(var(--joy-palette-primary-mainChannel) / 0.55)",
        },
        "&:hover .ask-bloom-suggestion-arrow": {
          transform: "translateX(3px)",
          opacity: 1,
        },
        "&:active": { transform: "translateY(0)" },
        "&:focus-visible": {
          outline: "none",
          boxShadow:
            "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.5), 0 18px 36px -18px rgba(var(--joy-palette-primary-mainChannel) / 0.55)",
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover": { transform: "none" },
          "&:hover .ask-bloom-suggestion-arrow": { transform: "none" },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -42,
          right: -28,
          width: 150,
          height: 150,
          borderRadius: "50%",
          backgroundImage:
            "radial-gradient(circle, rgba(var(--joy-palette-primary-mainChannel) / 0.22) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0) 70%)",
          pointerEvents: "none",
        }}
      />

      <Box
        aria-hidden
        sx={{
          position: "relative",
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: "14px",
          display: "grid",
          placeItems: "center",
          color: "common.white",
          backgroundColor: "primary.600",
          backgroundImage:
            "linear-gradient(140deg, var(--joy-palette-primary-400) 0%, var(--joy-palette-primary-600) 55%, var(--joy-palette-brandNavy-700) 100%)",
          boxShadow:
            "0 8px 18px -8px rgba(var(--joy-palette-primary-mainChannel) / 0.7), inset 0 1px 0 rgba(255 255 255 / 0.3)",
        }}
      >
        <Sparkles size={20} strokeWidth={2} />
      </Box>

      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, position: "relative" }}>
        <Typography
          level="title-sm"
          sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}
        >
          {item.title}
        </Typography>
        {item.subtitle ? (
          <Typography
            level="body-xs"
            sx={{ color: "text.secondary", lineHeight: 1.35 }}
          >
            {item.subtitle}
          </Typography>
        ) : null}
      </Stack>

      <Box
        aria-hidden
        className="ask-bloom-suggestion-arrow"
        sx={{
          position: "relative",
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: "999px",
          display: "grid",
          placeItems: "center",
          color: "var(--joy-palette-primary-700)",
          backgroundColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.12)",
          opacity: 0.85,
          transition: "transform 200ms ease, opacity 200ms ease",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <ArrowRight size={16} strokeWidth={2.2} />
      </Box>
    </Box>
  );
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
  const askBloomSuggestion = routeAwareSuggestions.find(
    (item) => getCommandIdFromSearchItem(item) === ASK_BLOOM_COMMAND_ID,
  );
  const otherSuggestions = routeAwareSuggestions.filter(
    (item) => item.id !== askBloomSuggestion?.id,
  );

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

        {askBloomSuggestion ? (
          <Box sx={{ mt: 1.25 }}>
            <AskBloomSuggestionCard
              item={askBloomSuggestion}
              isActive={activeItemId === askBloomSuggestion.id}
              onHover={onHoverItem}
              onSelect={onSelectItem}
            />
          </Box>
        ) : null}

        {otherSuggestions.length > 0 ? (
          <Grid container spacing={1} sx={{ mt: askBloomSuggestion ? 1 : 1.25 }}>
            {otherSuggestions.map((item) => {
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
        ) : null}

        {routeAwareSuggestions.length === 0 ? (
          <Typography level="body-sm" sx={{ mt: 1, color: "neutral.500" }}>
            Open a CRM, SMS, integrations, or settings page to get route-specific actions here.
          </Typography>
        ) : null}
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