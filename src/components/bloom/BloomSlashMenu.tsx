import * as React from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { toast } from "sonner";
import {
  executeSlashCommand,
  slashCommands,
  type BloomActionContext,
  type SlashCommand,
  type SlashCommandCategory,
} from "@/components/bloom/utils/slashCommandRegistry";

type SlashMenuPlacement = "top" | "bottom";

const categoryOrder: SlashCommandCategory[] = [
  "Query",
  "Analytics",
  "Utility",
  "Navigation",
  "Settings",
  "Management",
  "Help",
];

interface BloomSlashMenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  composerValue: string;
  actionContext: BloomActionContext;
  onAutocomplete: (value: string) => void;
  onClose: () => void;
  onExecuted: () => void;
}

export interface BloomSlashMenuHandle {
  autocompleteHighlighted: () => void;
  moveSelection: (direction: "next" | "previous") => void;
  selectHighlighted: () => void;
}

function parseSlashInput(input: string) {
  const trimmedInput = input.trimStart();
  if (!trimmedInput.startsWith("/")) {
    return { params: "", query: "" };
  }

  const remainder = trimmedInput.slice(1).trimStart();
  if (!remainder) {
    return { params: "", query: "" };
  }

  const [query = "", ...paramTokens] = remainder.split(/\s+/);
  return {
    params: paramTokens.join(" ").trim(),
    query,
  };
}

function buildAutocompleteValue(command: SlashCommand, params: string) {
  const normalizedParams = params.trim();
  if (normalizedParams) {
    return `${command.command} ${normalizedParams}`;
  }

  if (command.params === "none") {
    return command.command;
  }

  return `${command.command} `;
}

const groupedCommands = categoryOrder.map((category) => ({
  category,
  commands: slashCommands.filter((command) => command.category === category),
}));

export const BloomSlashMenu = React.forwardRef<
  BloomSlashMenuHandle,
  BloomSlashMenuProps
>(function BloomSlashMenu(
  {
    open,
    anchorRef,
    composerValue,
    actionContext,
    onAutocomplete,
    onClose,
    onExecuted,
  },
  ref,
) {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const commandRef = React.useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = React.useState<SlashMenuPlacement>("top");
  const { params, query } = React.useMemo(
    () => parseSlashInput(composerValue),
    [composerValue],
  );

  const getVisibleItems = React.useCallback(() => {
    if (!commandRef.current) {
      return [];
    }

    return Array.from(
      commandRef.current.querySelectorAll<HTMLElement>("[cmdk-item]"),
    ).filter((item) => !item.hasAttribute("hidden"));
  }, []);

  const getSelectedItem = React.useCallback(() => {
    if (!commandRef.current) {
      return null;
    }

    return commandRef.current.querySelector<HTMLElement>(
      "[cmdk-item][data-selected='true']",
    );
  }, []);

  const getSelectedCommand = React.useCallback(() => {
    const selectedElement = getSelectedItem() ?? getVisibleItems()[0] ?? null;
    const selectedCommandName = selectedElement?.getAttribute("data-command");
    if (!selectedCommandName) {
      return null;
    }

    return (
      slashCommands.find(
        (command) => command.command === selectedCommandName,
      ) ?? null
    );
  }, [getSelectedItem, getVisibleItems]);

  const dispatchCommandKey = React.useCallback((key: string) => {
    commandRef.current?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key,
      }),
    );
  }, []);

  const handleCommandSelect = React.useCallback(
    async (command: SlashCommand) => {
      try {
        await executeSlashCommand(command, params, actionContext);
        onExecuted();
      } catch (error) {
        if (error instanceof Error) {
          toast.error("Unable to run Bloom command", {
            description: error.message,
          });
        }
      }
    },
    [actionContext, onExecuted, params],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      autocompleteHighlighted: () => {
        const selectedCommand = getSelectedCommand();
        if (!selectedCommand) {
          return;
        }

        onAutocomplete(buildAutocompleteValue(selectedCommand, params));
      },
      moveSelection: (direction) => {
        const visibleItems = getVisibleItems();
        if (visibleItems.length === 0) {
          return;
        }

        if (!getSelectedItem()) {
          dispatchCommandKey("ArrowDown");
          if (direction === "previous") {
            dispatchCommandKey("ArrowUp");
          }
          return;
        }

        dispatchCommandKey(direction === "next" ? "ArrowDown" : "ArrowUp");
      },
      selectHighlighted: () => {
        if (!getSelectedItem()) {
          dispatchCommandKey("ArrowDown");
        }

        dispatchCommandKey("Enter");
      },
    }),
    [
      dispatchCommandKey,
      getSelectedCommand,
      getSelectedItem,
      getVisibleItems,
      onAutocomplete,
      params,
    ],
  );

  React.useLayoutEffect(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    const updatePlacement = () => {
      const anchorElement = anchorRef.current;
      const menuElement = menuRef.current;

      if (!anchorElement || !menuElement) {
        return;
      }

      const anchorRect = anchorElement.getBoundingClientRect();
      const menuHeight = Math.min(menuElement.scrollHeight, 300);
      const wouldOverflowTop = anchorRect.top - menuHeight - 4 < 8;

      setPlacement(wouldOverflowTop ? "bottom" : "top");
    };

    const frame = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [anchorRef, open, query]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (anchorRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <Card
      ref={menuRef}
      variant="outlined"
      sx={{
        position: "absolute",
        left: 0,
        width: "100%",
        zIndex: 1200,
        p: 0,
        overflow: "hidden",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "md",
        ...(placement === "top"
          ? { bottom: "calc(100% + 4px)" }
          : { top: "calc(100% + 4px)" }),
        "& [cmdk-group-heading]": {
          padding: "8px 12px 4px",
          color: "var(--joy-palette-neutral-400)",
          fontSize: "var(--joy-fontSize-xs)",
          fontWeight: "var(--joy-fontWeight-md)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        },
        "& [cmdk-item]": {
          transition:
            "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
        "& [cmdk-item][data-selected='true']": {
          backgroundColor: "neutral.100",
        },
      }}
    >
      <Command ref={commandRef} loop label="Bloom slash commands">
        <Command.Input
          aria-hidden="true"
          tabIndex={-1}
          value={query}
          onValueChange={() => undefined}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            px: 1.5,
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Box
            aria-hidden="true"
            sx={{ display: "inline-flex", color: "neutral.400" }}
          >
            <Search size={14} strokeWidth={2} />
          </Box>
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Type a command...
          </Typography>
        </Stack>

        <Command.List
          style={{
            maxHeight: 300,
            overflowY: "auto",
            padding: "6px",
          }}
        >
          <Command.Empty>
            <Typography
              level="body-sm"
              sx={{ px: 1.5, py: 2, color: "neutral.500", textAlign: "center" }}
            >
              No matching commands
            </Typography>
          </Command.Empty>

          {groupedCommands.map((group) => (
            <Command.Group key={group.category} heading={group.category}>
              {group.commands.map((command) => (
                <Command.Item
                  key={command.command}
                  value={command.command}
                  keywords={[
                    command.command.replace(/^\//, ""),
                    command.description,
                    command.category,
                    command.paramLabel ?? "",
                  ]}
                  data-command={command.command}
                  onSelect={() => {
                    void handleCommandSelect(command);
                  }}
                  style={{
                    borderRadius: "12px",
                    cursor: "pointer",
                    padding: "10px 12px",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ width: "100%", minWidth: 0 }}
                  >
                    <Stack direction="row" spacing={0.5} sx={{ minWidth: 0 }}>
                      <Typography
                        level="body-sm"
                        sx={{
                          color: "neutral.900",
                          fontFamily: "var(--joy-fontFamily-code, monospace)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {command.command}
                      </Typography>
                      {command.paramLabel ? (
                        <Typography
                          level="body-sm"
                          sx={{
                            color: "neutral.400",
                            fontFamily: "var(--joy-fontFamily-code, monospace)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {command.paramLabel}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: "neutral.500",
                        flexShrink: 0,
                        textAlign: "right",
                      }}
                    >
                      {command.description}
                    </Typography>
                  </Stack>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </Card>
  );
});
