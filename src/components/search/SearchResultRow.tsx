import IconButton from "@mui/joy/IconButton";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ChevronRight } from "lucide-react";
import type { PaletteExecutableAction } from "@/components/search/searchActionRegistry";
import { buildHighlightedTextSegments } from "@/components/search/searchPresentation";
import { SearchResultActionMenu } from "@/components/search/SearchResultActionMenu";
import {
  getSearchIcon,
  type SearchResultItem,
} from "@/components/search/types";

interface SearchResultRowProps {
  activeActionIndex: number;
  actions: PaletteExecutableAction[];
  auxiliaryLabel?: string;
  copiedActionId?: string | null;
  errorMessage?: string;
  groupLabelId?: string;
  isActive: boolean;
  isActionMenuOpen?: boolean;
  isCurrent?: boolean;
  item: SearchResultItem;
  onCloseActionMenu: () => void;
  onHoverAction: (index: number) => void;
  onHover: (itemId: string) => void;
  onOpenActionMenu: (itemId?: string | null) => void;
  optionId?: string;
  onSelectAction: (item: SearchResultItem, action: PaletteExecutableAction) => void;
  onSelect: (item: SearchResultItem) => void;
  pendingActionId?: string | null;
  query?: string;
}

function renderHighlightedText(text: string, query: string | undefined) {
  return buildHighlightedTextSegments(text, query ?? "").map((segment, index) => (
    <Box
      key={`${segment.text}-${index}`}
      component={segment.matched ? "mark" : "span"}
      sx={
        segment.matched
          ? {
              px: 0.125,
              borderRadius: "4px",
              color: "primary.700",
              backgroundColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.14)",
            }
          : undefined
      }
    >
      {segment.text}
    </Box>
  ));
}

export function SearchResultRow({
  activeActionIndex,
  actions,
  auxiliaryLabel,
  copiedActionId,
  errorMessage,
  groupLabelId,
  isActive,
  isActionMenuOpen = false,
  isCurrent = false,
  item,
  onCloseActionMenu,
  onHoverAction,
  onHover,
  onOpenActionMenu,
  optionId,
  onSelectAction,
  onSelect,
  pendingActionId,
  query,
}: SearchResultRowProps) {
  const LeadingIcon = getSearchIcon(item.icon ?? item.categoryIcon);

  return (
    <Stack spacing={0.25}>
      <Sheet
        variant="plain"
        aria-current={isCurrent ? "page" : undefined}
        data-active={isActive ? "true" : "false"}
        sx={{
          width: "100%",
          borderRadius: "md",
          border: "1px solid transparent",
          backgroundColor: isActive
            ? "rgba(var(--joy-palette-primary-mainChannel) / 0.08)"
            : isCurrent
              ? "rgba(var(--joy-palette-neutral-mainChannel) / 0.05)"
              : "transparent",
          borderColor: isActive
            ? "rgba(var(--joy-palette-primary-mainChannel) / 0.16)"
            : "transparent",
          transition:
            "background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
          "&:hover": {
            backgroundColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.06)",
          },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => onSelect(item)}
            onFocus={() => onHover(item.id)}
            onMouseEnter={() => onHover(item.id)}
            onMouseDown={(event) => event.preventDefault()}
            aria-describedby={groupLabelId}
            aria-selected={isActive}
            id={optionId}
            role="option"
            tabIndex={isActive && !isActionMenuOpen ? 0 : -1}
            sx={{
              width: "100%",
              minHeight: 52,
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 1.25,
              px: 2,
              py: 1,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              "&:focus-visible": {
                outline: "none",
                borderRadius: "var(--joy-radius-md)",
                boxShadow:
                  "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.14)",
              },
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                display: "grid",
                placeItems: "center",
                borderRadius: "12px",
                color: isActive ? "primary.700" : "neutral.600",
                backgroundColor: isActive
                  ? "rgba(var(--joy-palette-primary-mainChannel) / 0.12)"
                  : "rgba(var(--joy-palette-neutral-mainChannel) / 0.06)",
              }}
            >
              <LeadingIcon size={18} strokeWidth={1.9} />
            </Box>

            <Stack spacing={0.125} sx={{ minWidth: 0 }}>
              <Typography
                level="body-sm"
                noWrap
                sx={{ color: "neutral.800", fontWeight: 600 }}
              >
                {renderHighlightedText(item.title, query)}
              </Typography>
              {item.subtitle ? (
                <Typography level="body-xs" noWrap sx={{ color: "neutral.500" }}>
                  {renderHighlightedText(item.subtitle, query)}
                </Typography>
              ) : null}
            </Stack>

            <Stack spacing={0.35} alignItems="flex-end">
              {isCurrent ? (
                <Chip
                  size="sm"
                  color="primary"
                  variant="soft"
                  sx={{ borderRadius: "999px", fontWeight: 600 }}
                >
                  You are here
                </Chip>
              ) : item.metadata ? (
                <Chip
                  size="sm"
                  variant="soft"
                  sx={{
                    borderRadius: "999px",
                    color: "neutral.600",
                    backgroundColor:
                      "rgba(var(--joy-palette-neutral-mainChannel) / 0.06)",
                  }}
                >
                  {item.metadata}
                </Chip>
              ) : null}
              {auxiliaryLabel ? (
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  {auxiliaryLabel}
                </Typography>
              ) : null}
            </Stack>
          </Box>

          {actions.length > 0 ? (
            <IconButton
              aria-controls={isActionMenuOpen ? `${optionId}-menu` : undefined}
              aria-expanded={isActionMenuOpen}
              aria-haspopup="menu"
              aria-label={`Actions for ${item.title}`}
              color="neutral"
              onClick={() =>
                isActionMenuOpen ? onCloseActionMenu() : onOpenActionMenu(item.id)
              }
              onFocus={() => onHover(item.id)}
              onMouseDown={(event) => event.preventDefault()}
              size="sm"
              tabIndex={-1}
              variant={isActionMenuOpen ? "soft" : "plain"}
              sx={{
                mr: 1,
                "@media (prefers-reduced-motion: reduce)": {
                  transition: "none",
                },
              }}
            >
              <ChevronRight
                size={16}
                strokeWidth={1.9}
                style={{
                  transform: isActionMenuOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 140ms ease",
                }}
              />
            </IconButton>
          ) : null}
        </Box>
      </Sheet>

      {isActionMenuOpen ? (
        <SearchResultActionMenu
          actions={actions}
          activeActionIndex={activeActionIndex}
          copiedActionId={copiedActionId}
          errorMessage={errorMessage}
          labelledById={optionId}
          menuId={optionId ? `${optionId}-menu` : undefined}
          onHoverAction={onHoverAction}
          onSelectAction={(action) => onSelectAction(item, action)}
          pendingActionId={pendingActionId}
        />
      ) : null}
    </Stack>
  );
}