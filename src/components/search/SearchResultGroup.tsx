import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { PaletteExecutableAction } from "@/components/search/searchActionRegistry";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import {
  getSearchIcon,
  isCurrentRouteMatch,
  type SearchResultGroup as SearchResultGroupType,
  type SearchResultItem,
} from "@/components/search/types";

interface SearchResultGroupProps {
  activeItemId?: string | null;
  activeActionIndex: number;
  copiedActionId?: string | null;
  currentPathname: string;
  errorByItemId?: Record<string, string>;
  getItemActions: (item: SearchResultItem) => PaletteExecutableAction[];
  group: SearchResultGroupType;
  openActionItemId?: string | null;
  onCloseActionMenu: () => void;
  onHoverAction: (index: number) => void;
  onHoverItem: (itemId: string) => void;
  onOpenActionMenu: (itemId?: string | null) => void;
  optionIdForItem: (itemId: string) => string;
  onSelectAction: (item: SearchResultItem, action: PaletteExecutableAction) => void;
  onSelectItem: (item: SearchResultItem) => void;
  pendingActionId?: string | null;
  query?: string;
}

export function SearchResultGroup({
  activeItemId,
  activeActionIndex,
  copiedActionId,
  currentPathname,
  errorByItemId,
  getItemActions,
  group,
  openActionItemId,
  onCloseActionMenu,
  onHoverAction,
  onHoverItem,
  onOpenActionMenu,
  optionIdForItem,
  onSelectAction,
  onSelectItem,
  pendingActionId,
  query,
}: SearchResultGroupProps) {
  const GroupIcon = getSearchIcon(group.icon);
  const groupLabelId = `command-palette-group-${group.category}`;

  return (
    <Box>
      <Sheet
        variant="plain"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          px: 2,
          py: 1,
          backgroundColor: "hsl(var(--card))",
          borderBottom:
            "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 24,
              height: 24,
              display: "grid",
              placeItems: "center",
              borderRadius: "10px",
              color: "neutral.600",
              backgroundColor:
                "rgba(var(--joy-palette-neutral-mainChannel) / 0.05)",
            }}
          >
            <GroupIcon size={14} strokeWidth={2} />
          </Box>
          <Typography
            id={groupLabelId}
            level="body-xs"
            sx={{
              color: "neutral.600",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {group.title}
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.400" }}>
            {group.results.length}
          </Typography>
        </Stack>
      </Sheet>

      <Stack spacing={0.5} sx={{ p: 1 }}>
        {group.results.map((item) => (
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
            groupLabelId={groupLabelId}
            onCloseActionMenu={onCloseActionMenu}
            onHoverAction={onHoverAction}
            onHover={onHoverItem}
            onOpenActionMenu={onOpenActionMenu}
            optionId={optionIdForItem(item.id)}
            onSelectAction={onSelectAction}
            onSelect={onSelectItem}
            pendingActionId={pendingActionId}
            query={query}
          />
        ))}
      </Stack>
    </Box>
  );
}