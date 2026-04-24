import * as React from "react";
import Box from "@mui/joy/Box";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import Typography from "@mui/joy/Typography";
import { Check, ChevronDown, X } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import { FilterPopover } from "./FilterPopover";
import type { FilterDefinition, FilterValue, SortChipOption } from "./types";

type FilterChipFilterProps = {
  filter: FilterDefinition;
  onChange: (value: FilterValue) => void;
  value: FilterValue;
  variant?: "filter";
};

type FilterChipSortProps = {
  label: string;
  onChange: (value: string) => void;
  options: SortChipOption[];
  value: string;
  variant: "sort";
};

export type FilterChipProps = FilterChipFilterProps | FilterChipSortProps;

function getFilterChipLabel(filter: FilterDefinition, value: FilterValue) {
  if (value.selectedIds.length === 0) {
    return filter.label;
  }

  if (value.selectedIds.length === 1) {
    const option = filter.options.find(
      (item) => item.id === value.selectedIds[0],
    );
    return option?.label ?? filter.label;
  }

  return `${filter.label} · ${value.selectedIds.length}`;
}

const sharedChipSx = {
  minHeight: 32,
  px: 1.5,
  gap: 0.5,
  borderRadius: "20px",
  fontWeight: "md",
  lineHeight: 1,
  cursor: "pointer",
  transition:
    "background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease",
  "&:focus-visible": {
    outline: 0,
    boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
  },
};

function useAnchoredOverlayDismissal({
  anchorEl,
  menuRef,
  onClose,
  open,
}: {
  anchorEl: HTMLElement | null;
  menuRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
}) {
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const ownerDocument = anchorEl?.ownerDocument ?? document;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (anchorEl?.contains(target)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    ownerDocument.addEventListener("pointerdown", handlePointerDown, true);
    ownerDocument.addEventListener("keydown", handleKeyDown);

    return () => {
      ownerDocument.removeEventListener("pointerdown", handlePointerDown, true);
      ownerDocument.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorEl, menuRef, onClose, open]);
}

export function FilterChip(props: FilterChipProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const menuRef = React.useRef<HTMLUListElement | null>(null);
  const closeMenu = React.useCallback(() => {
    setAnchorEl(null);
  }, []);

  useAnchoredOverlayDismissal({
    anchorEl,
    menuRef,
    onClose: closeMenu,
    open: Boolean(anchorEl),
  });

  if (props.variant === "sort") {
    const selectedOption =
      props.options.find((option) => option.id === props.value) ??
      props.options[0];

    return (
      <>
        <JoyChip
          variant="plain"
          color="neutral"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          endDecorator={<ChevronDown size={14} />}
          sx={{
            ...sharedChipSx,
            backgroundColor: anchorEl ? "neutral.100" : "background.level1",
            color: "neutral.700",
            border: "1px solid",
            borderColor: anchorEl ? "primary.200" : "neutral.200",
            boxShadow: anchorEl ? "sm" : "none",
            "&:hover": {
              backgroundColor: "neutral.100",
              borderColor: "neutral.300",
            },
          }}
        >
          {selectedOption?.label ?? props.label}
        </JoyChip>
        <Menu
          ref={menuRef}
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={closeMenu}
          placement="bottom-start"
          size="sm"
          sx={{
            mt: 0.75,
            p: 1,
            minWidth: 200,
            borderRadius: "lg",
            borderColor: "neutral.200",
            boxShadow: "lg",
            backgroundColor: "background.surface",
          }}
        >
          {props.options.map((option) => {
            const selected = option.id === props.value;

            return (
              <MenuItem
                key={option.id}
                selected={selected}
                onClick={() => {
                  props.onChange(option.id);
                  setAnchorEl(null);
                }}
                sx={{
                  minHeight: 40,
                  borderRadius: "md",
                  px: 1.25,
                  py: 0.875,
                  gap: 1.5,
                  fontSize: "sm",
                  backgroundColor: selected ? "primary.50" : "transparent",
                  fontWeight: selected ? "md" : "regular",
                  "&:hover": {
                    backgroundColor: selected ? "primary.50" : "neutral.100",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      width: 16,
                      height: 16,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      color: "neutral.500",
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "currentColor",
                      }}
                    />
                  </Box>
                  <Typography level="body-sm" sx={{ flex: 1 }}>
                    {option.label}
                  </Typography>
                  {selected ? (
                    <Check
                      size={14}
                      style={{ color: "var(--joy-palette-primary-500)" }}
                    />
                  ) : null}
                </Box>
              </MenuItem>
            );
          })}
        </Menu>
      </>
    );
  }

  const active = props.value.selectedIds.length > 0;

  return (
    <>
      <JoyChip
        variant={active ? "soft" : "outlined"}
        color={active ? "primary" : "neutral"}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        startDecorator={
          active ? (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "primary.500",
              }}
            />
          ) : undefined
        }
        endDecorator={
          active ? (
            <Box
              component="span"
              onClick={(event) => {
                event.stopPropagation();
                props.onChange({
                  mode: "include",
                  selectedIds: [],
                });
              }}
              onMouseDown={(event) => event.stopPropagation()}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "primary.600",
                "&:hover": {
                  color: "primary.700",
                },
              }}
            >
              <X size={14} />
            </Box>
          ) : (
            <ChevronDown size={14} />
          )
        }
        sx={{
          ...sharedChipSx,
          backgroundColor: active
            ? "rgba(var(--joy-palette-primary-mainChannel) / 0.12)"
            : "background.surface",
          borderColor: active ? "transparent" : "neutral.300",
          boxShadow: active ? "sm" : "none",
          "&:hover": {
            borderColor: active ? "transparent" : "neutral.400",
            backgroundColor: active ? "primary.100" : "neutral.50",
          },
        }}
      >
        {getFilterChipLabel(props.filter, props.value)}
      </JoyChip>
      <FilterPopover
        anchorEl={anchorEl}
        filter={props.filter}
        menuRef={menuRef}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        onChange={props.onChange}
        value={props.value}
      />
    </>
  );
}
