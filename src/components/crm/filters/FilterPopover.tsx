import * as React from "react";
import Box from "@mui/joy/Box";
import Menu from "@mui/joy/Menu";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, Search } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import type { FilterDefinition, FilterOption, FilterValue } from "./types";

export interface FilterPopoverProps {
  anchorEl: HTMLElement | null;
  filter: FilterDefinition;
  menuRef?: React.Ref<HTMLUListElement>;
  open: boolean;
  onClose: () => void;
  onChange: (value: FilterValue) => void;
  value: FilterValue;
}

function matchesSearch(option: FilterOption, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [option.label, ...(option.keywords ?? [])]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function FilterPopover({
  anchorEl,
  filter,
  menuRef,
  open,
  onClose,
  onChange,
  value,
}: FilterPopoverProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return filter.options.filter((option) =>
      matchesSearch(option, normalizedQuery),
    );
  }, [filter.options, searchQuery]);

  const shouldShowSearch = Boolean(
    filter.searchable && filter.options.length > 5,
  );

  return (
    <Menu
      ref={menuRef}
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      placement="bottom-start"
      sx={{
        mt: 0.75,
        p: 1,
        minWidth: 280,
        maxWidth: 320,
        borderRadius: "lg",
        borderColor: "neutral.200",
        boxShadow: "lg",
        backgroundColor: "background.surface",
        zIndex: "modal",
        "--List-padding": "0px",
      }}
    >
      <Box component="li" sx={{ listStyle: "none" }}>
        <Sheet
          sx={{
            p: 0,
            backgroundColor: "transparent",
          }}
        >
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography level="title-sm" fontWeight="lg">
                {filter.label}
              </Typography>
              {value.selectedIds.length > 0 ? (
                <JoyButton
                  variant="plain"
                  color="primary"
                  size="sm"
                  sx={{ minHeight: "auto", px: 0 }}
                  onClick={() =>
                    onChange({
                      mode: "include",
                      selectedIds: [],
                    })
                  }
                >
                  Clear
                </JoyButton>
              ) : null}
            </Stack>

            <Stack spacing={0.75}>
              <Typography
                level="body-xs"
                sx={{ color: "neutral.500", fontWeight: "md" }}
              >
                Match
              </Typography>
              <Sheet
                variant="soft"
                color="neutral"
                sx={{
                  p: 0.5,
                  borderRadius: "xl",
                }}
              >
                <Stack direction="row" spacing={0.5}>
                  <JoyButton
                    variant={value.mode === "include" ? "soft" : "plain"}
                    color={value.mode === "include" ? "primary" : "neutral"}
                    size="sm"
                    sx={{ flex: 1, justifyContent: "center" }}
                    onClick={() => onChange({ ...value, mode: "include" })}
                  >
                    Include
                  </JoyButton>
                  <JoyButton
                    variant={value.mode === "exclude" ? "soft" : "plain"}
                    color={value.mode === "exclude" ? "primary" : "neutral"}
                    size="sm"
                    sx={{ flex: 1, justifyContent: "center" }}
                    onClick={() => onChange({ ...value, mode: "exclude" })}
                  >
                    Exclude
                  </JoyButton>
                </Stack>
              </Sheet>
            </Stack>

            {shouldShowSearch ? (
              <JoyInput
                size="sm"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  filter.searchPlaceholder ??
                  `Search ${filter.label.toLowerCase()}...`
                }
                startDecorator={<Search size={14} />}
                sx={{ width: "100%" }}
              />
            ) : null}

            <Stack spacing={0.5} sx={{ maxHeight: 280, overflowY: "auto" }}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const selected = value.selectedIds.includes(option.id);

                  return (
                    <Box
                      key={option.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const selectedIds = selected
                          ? value.selectedIds.filter((id) => id !== option.id)
                          : [...value.selectedIds, option.id];

                        onChange({
                          ...value,
                          selectedIds,
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          const selectedIds = selected
                            ? value.selectedIds.filter((id) => id !== option.id)
                            : [...value.selectedIds, option.id];

                          onChange({
                            ...value,
                            selectedIds,
                          });
                        }
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 1.25,
                        py: 0.875,
                        borderRadius: "md",
                        cursor: "pointer",
                        outline: 0,
                        backgroundColor: selected
                          ? "primary.50"
                          : "transparent",
                        transition:
                          "background-color 0.18s ease, color 0.18s ease",
                        "&:hover": {
                          backgroundColor: selected
                            ? "primary.50"
                            : "neutral.100",
                        },
                        "&:focus-visible": {
                          boxShadow:
                            "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
                        },
                      }}
                    >
                      <Box
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
                      <Typography
                        level="body-sm"
                        sx={{
                          flex: 1,
                          fontWeight: selected ? "md" : "regular",
                          color: "neutral.700",
                        }}
                      >
                        {option.label}
                      </Typography>
                      <Check
                        size={14}
                        style={{
                          opacity: selected ? 1 : 0,
                          color: "var(--joy-palette-primary-500)",
                        }}
                      />
                    </Box>
                  );
                })
              ) : (
                <Typography
                  level="body-sm"
                  sx={{ px: 1, py: 1.25, color: "neutral.500" }}
                >
                  No options found.
                </Typography>
              )}
            </Stack>
          </Stack>
        </Sheet>
      </Box>
    </Menu>
  );
}
