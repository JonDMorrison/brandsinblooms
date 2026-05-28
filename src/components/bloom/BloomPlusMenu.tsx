import * as React from "react";
import List from "@mui/joy/List";
import ListDivider from "@mui/joy/ListDivider";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Check,
  Keyboard,
  Microscope,
  Palette,
  Paperclip,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BloomMode, BloomModelPreference } from "@/hooks/bloom/types";

interface BloomPlusMenuModeOption {
  mode: BloomMode;
  label: string;
  description: string;
  shortcut: string;
}

interface BloomPlusMenuModelOption {
  value: BloomModelPreference;
  label: string;
  description: string;
}

interface BloomPlusMenuProps {
  activeMode: BloomMode;
  activeModel: BloomModelPreference;
  modelOptions: BloomPlusMenuModelOption[];
  onAttachFiles: () => void;
  onClose: () => void;
  onOpenShortcuts: () => void;
  onSelectMode: (mode: BloomMode) => void;
  onSelectModel: (model: BloomModelPreference) => void;
  open: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  visibleModeOptions: BloomPlusMenuModeOption[];
}

const modeIcons: Record<BloomMode, LucideIcon> = {
  standard: Zap,
  reasoning: Brain,
  research: Microscope,
  image: Palette,
};

const sectionHeaderSx = {
  px: 2,
  pt: 1,
  pb: 0.25,
  color: "neutral.500",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
} as const;

const listItemSx = {
  p: 0,
} as const;

const listItemButtonSx = {
  px: 2,
  py: 0.75,
  borderRadius: 0,
  alignItems: "center",
  "&.Mui-selected": {
    bgcolor: "neutral.100",
  },
  "&.Mui-selected:hover": {
    bgcolor: "neutral.100",
  },
  "&:hover": {
    bgcolor: "neutral.50",
  },
  "&.Mui-focusVisible, &:focus-visible": {
    outline: 0,
    boxShadow:
      "inset 0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
  },
} as const;

export function BloomPlusMenu({
  activeMode,
  activeModel,
  modelOptions,
  onAttachFiles,
  onClose,
  onOpenShortcuts,
  onSelectMode,
  onSelectModel,
  open,
  triggerRef,
  visibleModeOptions,
}: BloomPlusMenuProps) {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const firstItemRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, triggerRef]);

  React.useEffect(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() =>
      firstItemRef.current?.focus(),
    );

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[data-plus-menu-item="true"]',
      ) ?? [],
    );

    if (menuItems.length === 0) {
      return;
    }

    const activeIndex = menuItems.indexOf(
      document.activeElement as HTMLElement,
    );
    const nextIndex =
      event.key === "ArrowDown"
        ? (activeIndex + 1 + menuItems.length) % menuItems.length
        : (activeIndex - 1 + menuItems.length) % menuItems.length;

    event.preventDefault();
    menuItems[nextIndex]?.focus();
  };

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            transformOrigin: "bottom left",
          }}
        >
          <Sheet
            ref={menuRef}
            variant="outlined"
            role="menu"
            aria-label="Bloom actions"
            onKeyDown={handleMenuKeyDown}
            sx={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              minWidth: 300,
              maxWidth: 340,
              borderRadius: 0,
              bgcolor: "background.surface",
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
              border: "1px solid",
              borderColor: "neutral.200",
              overflow: "hidden",
              pointerEvents: "auto",
              zIndex: 1000,
            }}
          >
            <List size="sm" sx={{ "--List-padding": "8px", gap: 0 }}>
              <ListItem sx={listItemSx}>
                <ListItemButton
                  ref={firstItemRef}
                  role="menuitem"
                  data-plus-menu-item="true"
                  onClick={onAttachFiles}
                  sx={{ ...listItemButtonSx, py: 1 }}
                >
                  <ListItemDecorator
                    sx={{ color: "neutral.600", minInlineSize: 28 }}
                  >
                    <Paperclip size={18} strokeWidth={1.9} />
                  </ListItemDecorator>
                  <ListItemContent sx={{ minWidth: 0 }}>
                    <Typography level="body-sm" fontWeight={500}>
                      Attach files
                    </Typography>
                  </ListItemContent>
                </ListItemButton>
              </ListItem>

              <ListDivider sx={{ my: 0.5 }} />

              <ListItem sx={listItemSx}>
                <Typography level="body-xs" sx={sectionHeaderSx}>
                  Mode
                </Typography>
              </ListItem>

              {visibleModeOptions.map((option) => {
                const active = activeMode === option.mode;
                const Icon = modeIcons[option.mode];

                return (
                  <ListItem key={option.mode} sx={listItemSx}>
                    <ListItemButton
                      role="menuitem"
                      data-plus-menu-item="true"
                      selected={active}
                      onClick={() => onSelectMode(option.mode)}
                      sx={listItemButtonSx}
                    >
                      <ListItemDecorator
                        sx={{
                          color: active ? "primary.600" : "neutral.500",
                          minInlineSize: 28,
                        }}
                      >
                        {active ? (
                          <Check size={16} strokeWidth={2} />
                        ) : (
                          <Icon size={16} strokeWidth={1.9} />
                        )}
                      </ListItemDecorator>
                      <ListItemContent sx={{ minWidth: 0 }}>
                        <Typography level="body-sm" fontWeight={500}>
                          {option.label}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          {option.description}
                        </Typography>
                      </ListItemContent>
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.400",
                          fontFamily: "code",
                          flexShrink: 0,
                          ml: 2,
                        }}
                      >
                        {option.shortcut}
                      </Typography>
                    </ListItemButton>
                  </ListItem>
                );
              })}

              <ListDivider sx={{ my: 0.5 }} />

              <ListItem sx={listItemSx}>
                <Typography level="body-xs" sx={sectionHeaderSx}>
                  Model
                </Typography>
              </ListItem>

              {modelOptions.map((option) => {
                const active = activeModel === option.value;

                return (
                  <ListItem key={option.value} sx={listItemSx}>
                    <ListItemButton
                      role="menuitem"
                      data-plus-menu-item="true"
                      selected={active}
                      onClick={() => onSelectModel(option.value)}
                      sx={listItemButtonSx}
                    >
                      <ListItemDecorator sx={{ minInlineSize: 28 }}>
                        {active ? (
                          <Check
                            size={16}
                            strokeWidth={2}
                            color="var(--joy-palette-primary-600)"
                          />
                        ) : null}
                      </ListItemDecorator>
                      <ListItemContent sx={{ minWidth: 0 }}>
                        <Typography level="body-sm" fontWeight={500}>
                          {option.label}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          {option.description}
                        </Typography>
                      </ListItemContent>
                    </ListItemButton>
                  </ListItem>
                );
              })}

              <ListDivider sx={{ my: 0.5 }} />

              <ListItem sx={listItemSx}>
                <ListItemButton
                  role="menuitem"
                  data-plus-menu-item="true"
                  onClick={onOpenShortcuts}
                  sx={{ ...listItemButtonSx, py: 1 }}
                >
                  <ListItemDecorator
                    sx={{ color: "neutral.600", minInlineSize: 28 }}
                  >
                    <Keyboard size={18} strokeWidth={1.9} />
                  </ListItemDecorator>
                  <ListItemContent sx={{ minWidth: 0 }}>
                    <Typography level="body-sm" fontWeight={500}>
                      Keyboard shortcuts
                    </Typography>
                  </ListItemContent>
                </ListItemButton>
              </ListItem>
            </List>
          </Sheet>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
