import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Skeleton from "@mui/joy/Skeleton";
import Typography from "@mui/joy/Typography";
import { ChevronDown, Maximize2, Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { DASHBOARD_TOPBAR_HEIGHT } from "@/components/navigation/DashboardTopBar";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useAskBloom } from "@/providers/AskBloomProvider";

const TRIGGER_MAX_WIDTH = 220;
const DISPLAY_NAME_MAX_LENGTH = 40;
const RECENT_LIMIT = 5;
const SEARCH_LIMIT = 10;
const FETCH_LIMIT = 50;
const GROUP_THRESHOLD = 5;

interface AskBloomConversationListItem {
  id: string;
  title: string | null;
  preview: string | null;
  updatedAt: string;
}

type ConversationGroupLabel =
  | "Today"
  | "Yesterday"
  | "Past week"
  | "Past month"
  | "Older";

const GROUP_ORDER: ConversationGroupLabel[] = [
  "Today",
  "Yesterday",
  "Past week",
  "Past month",
  "Older",
];

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;

const resolveItemName = (item: AskBloomConversationListItem): string => {
  const title = item.title?.trim();
  if (title) {
    return truncate(title, DISPLAY_NAME_MAX_LENGTH);
  }

  const preview = item.preview?.trim();
  if (preview) {
    return truncate(preview, DISPLAY_NAME_MAX_LENGTH);
  }

  return "Untitled conversation";
};

const formatRelativeTime = (dateString: string): string => {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;
  const month = day * 30;

  if (diff < minute) {
    return "now";
  }
  if (diff < hour) {
    return `${Math.floor(diff / minute)}m`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)}h`;
  }
  if (diff < month) {
    return `${Math.floor(diff / day)}d`;
  }

  const months = Math.floor(diff / month);
  if (months < 12) {
    return `${months}mo`;
  }

  return `${Math.floor(months / 12)}y`;
};

const groupForDate = (dateString: string): ConversationGroupLabel => {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) {
    return "Older";
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const day = 86_400_000;

  if (timestamp >= startOfToday) {
    return "Today";
  }
  if (timestamp >= startOfToday - day) {
    return "Yesterday";
  }
  if (timestamp >= startOfToday - day * 7) {
    return "Past week";
  }
  if (timestamp >= startOfToday - day * 30) {
    return "Past month";
  }
  return "Older";
};

interface ConversationListProps {
  items: AskBloomConversationListItem[];
  isLoading: boolean;
  isSearching: boolean;
  searchQuery: string;
  activeConversationId: string | null;
  onSelect: (item: AskBloomConversationListItem) => void;
  registerItemRef: (index: number, element: HTMLDivElement | null) => void;
  onItemKeyDown: (
    event: React.KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => void;
}

function ConversationListSkeleton() {
  return (
    <Box sx={{ p: "4px" }}>
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            p: "8px 10px",
          }}
        >
          <Skeleton variant="text" level="body-sm" sx={{ width: "60%" }} />
          <Skeleton variant="text" level="body-xs" sx={{ width: 20 }} />
        </Box>
      ))}
    </Box>
  );
}

function ConversationList({
  items,
  isLoading,
  isSearching,
  searchQuery,
  activeConversationId,
  onSelect,
  registerItemRef,
  onItemKeyDown,
}: ConversationListProps) {
  if (isLoading) {
    return <ConversationListSkeleton />;
  }

  if (items.length === 0) {
    return (
      <Box sx={{ p: "20px" }}>
        <Typography
          level="body-sm"
          sx={{ color: "text.tertiary", textAlign: "center" }}
        >
          {isSearching
            ? `No results for "${searchQuery}"`
            : "No conversations found"}
        </Typography>
      </Box>
    );
  }

  const showGroups = !isSearching && items.length > GROUP_THRESHOLD;

  const renderItem = (item: AskBloomConversationListItem, index: number) => {
    const isActive = item.id === activeConversationId;

    return (
      <Box
        key={item.id}
        role="option"
        aria-selected={isActive}
        tabIndex={-1}
        ref={(element: HTMLDivElement | null) =>
          registerItemRef(index, element)
        }
        onClick={() => onSelect(item)}
        onKeyDown={(event) => onItemKeyDown(event, index)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          p: "8px 10px",
          borderRadius: "sm",
          cursor: "pointer",
          outline: "none",
          transition: "background 150ms ease",
          background: isActive ? "primary.softBg" : "transparent",
          "&:hover": {
            background: isActive ? "primary.softBg" : "background.level1",
          },
          "&:focus-visible": {
            background: isActive ? "primary.softBg" : "background.level1",
          },
        }}
      >
        <Typography
          level="body-sm"
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? "primary.plainColor" : "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {resolveItemName(item)}
        </Typography>
        <Typography
          level="body-xs"
          sx={{
            color: "text.tertiary",
            fontWeight: 400,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {formatRelativeTime(item.updatedAt)}
        </Typography>
      </Box>
    );
  };

  if (!showGroups) {
    return (
      <Box sx={{ p: "4px" }}>
        {items.map((item, index) => renderItem(item, index))}
      </Box>
    );
  }

  let runningIndex = 0;

  return (
    <Box sx={{ p: "4px" }}>
      {GROUP_ORDER.map((groupLabel) => {
        const groupItems = items.filter(
          (item) => groupForDate(item.updatedAt) === groupLabel,
        );

        if (groupItems.length === 0) {
          return null;
        }

        return (
          <Box key={groupLabel}>
            <Typography
              level="body-xs"
              sx={{
                fontWeight: 600,
                color: "text.tertiary",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                p: "6px 10px 4px",
              }}
            >
              {groupLabel}
            </Typography>
            {groupItems.map((item) => renderItem(item, runningIndex++))}
          </Box>
        );
      })}
    </Box>
  );
}

export function AskBloomHeader() {
  const askBloom = useAskBloom();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();

  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;

  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const { conversationId, messages } = askBloom.state;

  const conversationsQuery = useQuery({
    queryKey: ["ask-bloom-conversation-list", tenantId, userId],
    enabled: Boolean(isDropdownOpen && tenantId && userId),
    staleTime: 30_000,
    queryFn: async (): Promise<AskBloomConversationListItem[]> => {
      if (!tenantId || !userId) {
        return [];
      }

      const { data, error } = await supabase
        .from("bloom_conversations")
        .select("id, title, last_message_preview, updated_at")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .in("status", ["active", "pinned"])
        .order("updated_at", { ascending: false })
        .limit(FETCH_LIMIT);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        preview: row.last_message_preview,
        updatedAt: row.updated_at,
      }));
    },
  });

  const triggerLabel = React.useMemo(() => {
    if (!conversationId) {
      return "New conversation";
    }

    const currentConversation = (conversationsQuery.data ?? []).find(
      (item) => item.id === conversationId,
    );
    if (currentConversation) {
      return resolveItemName(currentConversation);
    }

    const firstUserMessage = messages.find(
      (message) => message.role === "user",
    );
    const text = firstUserMessage?.content?.trim();
    if (text) {
      return truncate(text, DISPLAY_NAME_MAX_LENGTH);
    }

    return "Untitled conversation";
  }, [conversationId, conversationsQuery.data, messages]);

  // Debounce the search input before filtering.
  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const isSearching = debouncedQuery.length > 0;

  const visibleItems = React.useMemo(() => {
    const allItems = conversationsQuery.data ?? [];

    if (!isSearching) {
      return allItems.slice(0, RECENT_LIMIT);
    }

    // TODO: Replace with server-side full-text search for performance at scale.
    const query = debouncedQuery.toLowerCase();
    const matches = allItems
      .map((item) => {
        const title = item.title?.toLowerCase() ?? "";
        const preview = item.preview?.toLowerCase() ?? "";
        const titleMatch = title.includes(query);
        const previewMatch = preview.includes(query);

        if (!titleMatch && !previewMatch) {
          return null;
        }

        return {
          item,
          rank: titleMatch ? 0 : 1,
          updatedAt: Date.parse(item.updatedAt) || 0,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          item: AskBloomConversationListItem;
          rank: number;
          updatedAt: number;
        } => entry !== null,
      )
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }
        return right.updatedAt - left.updatedAt;
      })
      .slice(0, SEARCH_LIMIT)
      .map((entry) => entry.item);

    return matches;
  }, [conversationsQuery.data, debouncedQuery, isSearching]);

  itemRefs.current = [];
  const registerItemRef = React.useCallback(
    (index: number, element: HTMLDivElement | null) => {
      itemRefs.current[index] = element;
    },
    [],
  );

  const closeDropdown = React.useCallback((returnFocus = false) => {
    setIsDropdownOpen(false);
    setSearchInput("");
    setDebouncedQuery("");
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  const openDropdown = React.useCallback(() => {
    setIsDropdownOpen(true);
  }, []);

  // Click-outside to close.
  React.useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      closeDropdown();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeDropdown, isDropdownOpen]);

  // Autofocus the search input on open.
  React.useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isDropdownOpen]);

  const handleSelectConversation = React.useCallback(
    (item: AskBloomConversationListItem) => {
      askBloom.loadConversation(item.id);
      closeDropdown();
    },
    [askBloom, closeDropdown],
  );

  const focusInput = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      const inputElement = document.querySelector<HTMLTextAreaElement>(
        "textarea[data-ask-bloom-panel-input]",
      );
      inputElement?.focus();
    });
  }, []);

  const handleNewConversation = React.useCallback(() => {
    askBloom.newConversation();
    closeDropdown();
    focusInput();
  }, [askBloom, closeDropdown, focusInput]);

  const handleOpenInBloom = React.useCallback(() => {
    const search = conversationId ? `?conversationId=${conversationId}` : "";
    navigate(`/bloom${search}`);
    askBloom.close();
  }, [askBloom, conversationId, navigate]);

  const handleTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown" && !isDropdownOpen) {
        event.preventDefault();
        openDropdown();
      }
    },
    [isDropdownOpen, openDropdown],
  );

  const handleSearchKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown(true);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        itemRefs.current[0]?.focus();
      }
    },
    [closeDropdown],
  );

  const handleItemKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown(true);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const item = visibleItems[index];
        if (item) {
          handleSelectConversation(item);
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        itemRefs.current[index + 1]?.focus();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (index === 0) {
          searchInputRef.current?.focus();
        } else {
          itemRefs.current[index - 1]?.focus();
        }
      }
    },
    [closeDropdown, handleSelectConversation, visibleItems],
  );

  const handleHeaderDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Double-clicking empty header space toggles collapse on desktop.
      // TODO: Consider adding collapse as a right-click context menu option or
      // long-press on mobile.
      const target = event.target as HTMLElement;
      if (target.closest("button") || target.closest("input")) {
        return;
      }
      askBloom.toggleCollapse();
    },
    [askBloom],
  );

  return (
    <Box
      onDoubleClick={handleHeaderDoubleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: "8px 12px",
        height: `${DASHBOARD_TOPBAR_HEIGHT}px`,
        borderBottom: "1px solid",
        borderColor: "divider",
        background: "white",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <Box
        component="button"
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-label="Switch conversation"
        onClick={() => (isDropdownOpen ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          p: "4px 8px",
          border: "none",
          borderRadius: "sm",
          background: "transparent",
          cursor: "pointer",
          maxWidth: TRIGGER_MAX_WIDTH,
          minWidth: 0,
          font: "inherit",
          transition: "background 150ms ease",
          "&:hover": { background: "background.level1" },
          "&:focus-visible": {
            outline: "2px solid var(--joy-palette-focusVisible)",
            outlineOffset: "2px",
          },
        }}
      >
        <Typography
          level="body-sm"
          noWrap
          sx={{
            fontWeight: 600,
            color: "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {triggerLabel}
        </Typography>
        <Box
          component={ChevronDown}
          size={14}
          strokeWidth={2}
          sx={{
            color: "text.tertiary",
            flexShrink: 0,
            transition: "transform 200ms ease",
            transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <JoyTooltip title="New conversation" placement="bottom">
          <IconButton
            aria-label="New conversation"
            variant="plain"
            color="neutral"
            size="sm"
            onClick={handleNewConversation}
            sx={{
              borderRadius: "sm",
              opacity: 0.6,
              "&:hover": { opacity: 1, background: "background.level1" },
            }}
          >
            <Plus size={16} strokeWidth={2} />
          </IconButton>
        </JoyTooltip>

        <JoyTooltip title="Open in Bloom" placement="bottom">
          <IconButton
            aria-label="Open in Bloom"
            variant="plain"
            color="neutral"
            size="sm"
            onClick={handleOpenInBloom}
            sx={{
              borderRadius: "sm",
              opacity: 0.6,
              "&:hover": { opacity: 1, background: "background.level1" },
            }}
          >
            <Maximize2 size={16} strokeWidth={2} />
          </IconButton>
        </JoyTooltip>

        <JoyTooltip title="Close" placement="bottom">
          <IconButton
            aria-label="Close"
            variant="plain"
            color="neutral"
            size="sm"
            onClick={askBloom.close}
            sx={{
              borderRadius: "sm",
              opacity: 0.6,
              "&:hover": { opacity: 1, background: "background.level1" },
            }}
          >
            <X size={16} strokeWidth={2} />
          </IconButton>
        </JoyTooltip>
      </Box>

      {isDropdownOpen ? (
        <Box
          ref={dropdownRef}
          role="listbox"
          aria-label="Conversations"
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            mt: "4px",
            width: 320,
            maxWidth: "calc(100% - 24px)",
            background: "white",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            borderRadius: "md",
            boxShadow: "lg",
            overflow: "hidden",
            zIndex: 1300,
            "@keyframes askBloomDropdownIn": {
              from: { opacity: 0, transform: "translateY(-4px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
            animation: "askBloomDropdownIn 150ms ease",
          }}
        >
          <Box sx={{ p: "8px 10px" }}>
            <Input
              slotProps={{ input: { ref: searchInputRef } }}
              variant="plain"
              size="sm"
              placeholder="Search..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              startDecorator={
                <Search size={14} color="var(--joy-palette-text-tertiary)" />
              }
              endDecorator={
                searchInput ? (
                  <IconButton
                    aria-label="Clear search"
                    variant="plain"
                    color="neutral"
                    size="sm"
                    onClick={() => {
                      setSearchInput("");
                      setDebouncedQuery("");
                      searchInputRef.current?.focus();
                    }}
                    sx={{ minHeight: 0, minWidth: 0, p: "2px" }}
                  >
                    <X size={14} strokeWidth={2} />
                  </IconButton>
                ) : null
              }
              sx={{
                "--Input-focusedThickness": "0px",
                background: "transparent",
                fontSize: "sm",
              }}
            />
          </Box>

          <Divider />

          <Box
            sx={{
              maxHeight: 240,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <ConversationList
              items={visibleItems}
              isLoading={conversationsQuery.isLoading}
              isSearching={isSearching}
              searchQuery={debouncedQuery}
              activeConversationId={conversationId}
              onSelect={handleSelectConversation}
              registerItemRef={registerItemRef}
              onItemKeyDown={handleItemKeyDown}
            />
          </Box>

          <Divider />

          <Box sx={{ p: "6px 10px" }}>
            <Box
              component="button"
              type="button"
              onClick={handleNewConversation}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                p: "8px",
                border: "none",
                borderRadius: "sm",
                background: "transparent",
                cursor: "pointer",
                font: "inherit",
                transition: "background 150ms ease",
                "&:hover": { background: "background.level1" },
                "&:focus-visible": {
                  outline: "2px solid var(--joy-palette-focusVisible)",
                  outlineOffset: "2px",
                },
              }}
            >
              <Box
                component={Plus}
                size={14}
                sx={{ color: "text.secondary" }}
              />
              <Typography
                level="body-sm"
                sx={{ fontWeight: 500, color: "text.secondary" }}
              >
                New conversation
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
