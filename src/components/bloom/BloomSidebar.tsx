import * as React from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Input from "@mui/joy/Input";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { toast } from "sonner";
import {
  Archive,
  BarChart3,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  Search,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import { BloomConversationContextMenu } from "@/components/bloom/BloomConversationContextMenu";
import { BloomEmptyState } from "@/components/bloom/BloomEmptyState";
import { BloomSearchDialog } from "@/components/bloom/BloomSearchDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { BloomBookmarksSidebar } from "@/components/bloom/BloomBookmarksSidebar";
import { useBloom } from "@/components/bloom/BloomContext";
import type { BloomConversation } from "@/hooks/bloom/types";
import { useBloomBookmarks } from "@/hooks/bloom/useBloomBookmarks";
import { useBloomConversations } from "@/hooks/bloom/useBloomConversations";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

type ConversationSectionKey =
  | "pinned"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "older";

interface ConversationSection {
  key: ConversationSectionKey;
  label: string;
  conversations: BloomConversation[];
}

const sectionLabels: Record<ConversationSectionKey, string> = {
  pinned: "Pinned",
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 Days",
  last30: "Last 30 Days",
  older: "Older",
};

const SIDEBAR_TRANSITION = "200ms cubic-bezier(0.4, 0, 0.2, 1)";
const LONG_PRESS_MS = 300;
const SIDEBAR_ITEM_HOVER_BG = "rgba(255,255,255,0.08)";
const SIDEBAR_ITEM_SELECTED_BG = "rgba(255,255,255,0.12)";
const SIDEBAR_ITEM_ACTIVE_BG = "rgba(255,255,255,0.16)";
const SIDEBAR_ITEM_HOVER_BORDER = "rgba(255,255,255,0.12)";
const SIDEBAR_ITEM_SELECTED_BORDER = "rgba(255,255,255,0.14)";
const SIDEBAR_ITEM_ACTION_SURFACE = "rgba(16, 40, 62, 0.9)";
const SIDEBAR_ITEM_ACTION_HOVER_BG = "rgba(255,255,255,0.12)";
const SIDEBAR_ITEM_TITLE_COLOR = "rgba(255,255,255,0.92)";
const SIDEBAR_ITEM_TITLE_ACTIVE_COLOR = "rgba(255,255,255,0.98)";
const SIDEBAR_ITEM_PREVIEW_COLOR = "rgba(255,255,255,0.68)";
const SIDEBAR_ITEM_PREVIEW_ACTIVE_COLOR = "rgba(255,255,255,0.76)";

type SidebarNavigationItem = {
  kind: "conversation";
  conversation: BloomConversation;
};

const startOfDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const getDayDifference = (value: string) => {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(new Date(timestamp)).getTime();

  return Math.floor((today - target) / 86_400_000);
};

const getConversationSectionKey = (
  conversation: BloomConversation,
): ConversationSectionKey => {
  if (conversation.status === "pinned") {
    return "pinned";
  }

  const dayDifference = getDayDifference(conversation.updatedAt);

  if (dayDifference <= 0) {
    return "today";
  }

  if (dayDifference === 1) {
    return "yesterday";
  }

  if (dayDifference <= 7) {
    return "last7";
  }

  if (dayDifference <= 30) {
    return "last30";
  }

  return "older";
};

const groupConversations = (
  conversations: BloomConversation[],
  searchTerm: string,
): ConversationSection[] => {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const buckets: Record<ConversationSectionKey, BloomConversation[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    last7: [],
    last30: [],
    older: [],
  };

  conversations
    .filter((conversation) => conversation.status !== "archived")
    .filter((conversation) =>
      normalizedSearch
        ? conversation.title.toLowerCase().includes(normalizedSearch)
        : true,
    )
    .forEach((conversation) => {
      buckets[getConversationSectionKey(conversation)].push(conversation);
    });

  return (["pinned", "today", "yesterday", "last7", "last30", "older"] as const)
    .map((key) => ({
      key,
      label: sectionLabels[key],
      conversations: buckets[key],
    }))
    .filter((section) => section.conversations.length > 0);
};

const createPreview = (value: string) => value.trim() || "No messages yet";

const stopActionPropagation = (event: React.MouseEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();
};

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" || tagName === "textarea" || target.isContentEditable
  );
};

const getVisibleSectionConversations = (
  sections: ConversationSection[],
  olderExpanded: boolean,
  searchTerm: string,
) =>
  sections.flatMap((section) => {
    const showOlderItems =
      section.key !== "older" || olderExpanded || Boolean(searchTerm.trim());

    return showOlderItems ? section.conversations : [];
  });

function SidebarSkeletonList() {
  return (
    <Stack spacing={1.25} sx={{ px: 1.5, py: 1 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Stack key={index} spacing={0.75} sx={{ px: 1.5, py: 1.25 }}>
          <Skeleton
            variant="text"
            animation="wave"
            sx={{ bgcolor: "brandNavy.700", width: "72%" }}
          />
          <Skeleton
            variant="text"
            animation="wave"
            sx={{ bgcolor: "brandNavy.700", width: "92%" }}
          />
        </Stack>
      ))}
    </Stack>
  );
}

function InlineRenameInput({
  conversation,
  onCancel,
  onSave,
}: {
  conversation: BloomConversation;
  onCancel: () => void;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = React.useState(conversation.title);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    const nextValue = value.trim();
    if (!nextValue || nextValue === conversation.title) {
      onCancel();
      return;
    }

    onSave(nextValue);
  };

  return (
    <Input
      size="sm"
      value={value}
      slotProps={{ input: { ref: inputRef } }}
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onClick={(event) => event.stopPropagation()}
      sx={{
        minHeight: 30,
        backgroundColor: "brandNavy.700",
        borderColor: "brandNavy.500",
        color: "common.white",
        "--Input-focusedThickness": "0px",
        "&:focus-within": {
          borderColor: "primary.400",
        },
        "& .MuiInput-input": {
          color: "common.white",
          fontSize: "var(--joy-fontSize-sm)",
        },
      }}
    />
  );
}

function ConversationRow({
  conversation,
  editingId,
  selected,
  onArchive,
  onDelete,
  onEdit,
  onEditCancel,
  onPinToggle,
  onRename,
  onSelect,
  onUnarchive,
}: {
  conversation: BloomConversation;
  editingId: string | null;
  selected: boolean;
  onArchive: (conversation: BloomConversation) => void;
  onDelete: (conversation: BloomConversation) => void;
  onEdit: (conversation: BloomConversation) => void;
  onEditCancel: () => void;
  onPinToggle: (conversation: BloomConversation) => void;
  onRename: (conversation: BloomConversation, title: string) => void;
  onSelect: (conversation: BloomConversation) => void;
  onUnarchive?: (conversation: BloomConversation) => void;
}) {
  const { activeConversationId, switchConversation } = useBloom();
  const active = activeConversationId === conversation.id;
  const isEditing = editingId === conversation.id;
  const isArchived = conversation.status === "archived";
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const longPressTimerRef = React.useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  const suppressNextClickRef = React.useRef(false);

  const clearLongPress = React.useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => clearLongPress, [clearLongPress]);

  const openContextMenu = React.useCallback(() => {
    if (isEditing) {
      return;
    }

    onSelect(conversation);
    setContextMenuOpen(true);
  }, [conversation, isEditing, onSelect]);

  const handleClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    onSelect(conversation);
    switchConversation(conversation.id);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" || isEditing) {
      return;
    }

    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;
      openContextMenu();
    }, LONG_PRESS_MS);
  };

  const closeMenu = () => setContextMenuOpen(false);

  return (
    <ListItem
      sx={{
        position: "relative",
        px: 0.5,
        py: 0.25,
        "&:hover [data-bloom-row-actions='true'], &:focus-within [data-bloom-row-actions='true']":
          {
            opacity: 1,
            pointerEvents: "auto",
          },
        "@media (hover: none)": {
          "& [data-bloom-row-actions='true']": {
            opacity: 1,
            pointerEvents: "auto",
          },
        },
        opacity: isArchived ? 0.6 : 1,
        transition: `opacity ${SIDEBAR_TRANSITION}`,
        "&:hover, &:focus-within": {
          opacity: 1,
        },
      }}
    >
      <ListItemButton
        id={`bloom-sidebar-conversation-${conversation.id}`}
        aria-current={active ? "page" : undefined}
        aria-selected={active || selected || undefined}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={clearLongPress}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        sx={{
          "--variant-plainHoverBg": active
            ? SIDEBAR_ITEM_ACTIVE_BG
            : selected
              ? SIDEBAR_ITEM_SELECTED_BG
              : SIDEBAR_ITEM_HOVER_BG,
          "--variant-plainActiveBg": active
            ? SIDEBAR_ITEM_ACTIVE_BG
            : selected
              ? SIDEBAR_ITEM_ACTIVE_BG
              : SIDEBAR_ITEM_SELECTED_BG,
          "--ListItemButton-selectedBg": active
            ? SIDEBAR_ITEM_ACTIVE_BG
            : SIDEBAR_ITEM_SELECTED_BG,
          width: "100%",
          minHeight: 56,
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--joy-radius-lg)",
          border: "1px solid",
          borderColor: active
            ? "rgba(var(--joy-palette-primary-mainChannel) / 0.34)"
            : selected
              ? SIDEBAR_ITEM_SELECTED_BORDER
              : "transparent",
          backgroundColor: active
            ? SIDEBAR_ITEM_ACTIVE_BG
            : selected
              ? SIDEBAR_ITEM_SELECTED_BG
              : "transparent",
          color:
            active || selected
              ? SIDEBAR_ITEM_TITLE_ACTIVE_COLOR
              : SIDEBAR_ITEM_TITLE_COLOR,
          pl: 1.75,
          pr: isArchived ? 9 : 5.5,
          py: 0.85,
          boxShadow: active
            ? "inset 0 0 0 1px rgba(var(--joy-palette-primary-mainChannel) / 0.16), 0 8px 18px rgba(0, 0, 0, 0.18)"
            : selected
              ? "inset 0 0 0 1px rgba(255, 255, 255, 0.04)"
              : "none",
          transition:
            "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            backgroundColor: active
              ? SIDEBAR_ITEM_ACTIVE_BG
              : selected
                ? SIDEBAR_ITEM_SELECTED_BG
                : SIDEBAR_ITEM_HOVER_BG,
            borderColor: active
              ? "rgba(var(--joy-palette-primary-mainChannel) / 0.4)"
              : selected
                ? SIDEBAR_ITEM_SELECTED_BORDER
                : SIDEBAR_ITEM_HOVER_BORDER,
          },
          "&.Mui-focusVisible, &:focus-visible": {
            outline: 0,
            boxShadow:
              "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.22)",
          },
        }}
      >
        <ListItemContent sx={{ minWidth: 0 }}>
          {isEditing ? (
            <InlineRenameInput
              conversation={conversation}
              onCancel={onEditCancel}
              onSave={(title) => onRename(conversation, title)}
            />
          ) : (
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography
                level="body-sm"
                noWrap
                sx={{
                  color:
                    active || selected
                      ? SIDEBAR_ITEM_TITLE_ACTIVE_COLOR
                      : SIDEBAR_ITEM_TITLE_COLOR,
                  fontWeight: active ? 650 : selected ? 600 : 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {conversation.title}
              </Typography>
              <Typography
                level="body-xs"
                noWrap
                sx={{
                  color:
                    active || selected
                      ? SIDEBAR_ITEM_PREVIEW_ACTIVE_COLOR
                      : SIDEBAR_ITEM_PREVIEW_COLOR,
                }}
              >
                {createPreview(conversation.lastMessagePreview)}
              </Typography>
            </Stack>
          )}
        </ListItemContent>
      </ListItemButton>

      {!isEditing ? (
        <Stack
          data-bloom-row-actions="true"
          direction="row"
          spacing={0.25}
          onClick={(event) => event.stopPropagation()}
          sx={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            opacity: { xs: 1, md: 0 },
            pointerEvents: { xs: "auto", md: "none" },
            transition: `opacity ${SIDEBAR_TRANSITION}`,
            backgroundColor: SIDEBAR_ITEM_ACTION_SURFACE,
            border: "1px solid",
            borderColor: "rgba(255,255,255,0.08)",
            borderRadius: "var(--joy-radius-md)",
            boxShadow: "0 8px 18px rgba(0, 0, 0, 0.2)",
          }}
        >
          {isArchived && onUnarchive ? (
            <ArchivedActionButton
              onClick={(event) => {
                stopActionPropagation(event);
                onUnarchive(conversation);
              }}
            />
          ) : null}
          <BloomConversationContextMenu
            conversation={conversation}
            open={contextMenuOpen}
            onOpenChange={setContextMenuOpen}
            onRename={() => {
              closeMenu();
              onEdit(conversation);
            }}
            onPin={() => {
              closeMenu();
              onPinToggle(conversation);
            }}
            onUnpin={() => {
              closeMenu();
              onPinToggle(conversation);
            }}
            onArchive={() => {
              closeMenu();
              onArchive(conversation);
            }}
            onUnarchive={
              onUnarchive
                ? () => {
                    closeMenu();
                    onUnarchive(conversation);
                  }
                : undefined
            }
            onDelete={() => {
              closeMenu();
              onDelete(conversation);
            }}
          />
        </Stack>
      ) : null}
    </ListItem>
  );
}

function ArchivedActionButton({
  onClick,
}: {
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <Tooltip arrow title="Unarchive" variant="solid" placement="top">
      <JoyButton
        aria-label="Unarchive"
        size="icon"
        color="neutral"
        bloomVariant="ghost"
        onClick={onClick}
        sx={{
          width: 28,
          height: 28,
          minHeight: 28,
          color: "rgba(255,255,255,0.72)",
          borderRadius: "var(--joy-radius-sm)",
          "&:hover": {
            backgroundColor: SIDEBAR_ITEM_ACTION_HOVER_BG,
            color: "common.white",
          },
        }}
      >
        <Archive size={14} strokeWidth={1.9} />
      </JoyButton>
    </Tooltip>
  );
}

function ConversationSectionList({
  section,
  editingId,
  olderExpanded,
  searchTerm,
  selectedConversationId,
  onArchive,
  onDelete,
  onEdit,
  onEditCancel,
  onPinToggle,
  onRename,
  onSelect,
  onToggleOlder,
  onUnarchive,
}: {
  section: ConversationSection;
  editingId: string | null;
  olderExpanded: boolean;
  searchTerm: string;
  selectedConversationId: string | null;
  onArchive: (conversation: BloomConversation) => void;
  onDelete: (conversation: BloomConversation) => void;
  onEdit: (conversation: BloomConversation) => void;
  onEditCancel: () => void;
  onPinToggle: (conversation: BloomConversation) => void;
  onRename: (conversation: BloomConversation, title: string) => void;
  onSelect: (conversation: BloomConversation) => void;
  onToggleOlder: () => void;
  onUnarchive?: (conversation: BloomConversation) => void;
}) {
  const showOlderItems =
    section.key !== "older" || olderExpanded || Boolean(searchTerm.trim());

  return (
    <Stack spacing={0.5}>
      {section.key === "older" ? (
        <ListItem sx={{ px: 1.5 }}>
          <ListItemButton
            onClick={onToggleOlder}
            sx={{
              "--variant-plainHoverBg": "brandNavy.700",
              "--variant-plainActiveBg": "brandNavy.600",
              minHeight: 28,
              borderRadius: "var(--joy-radius-sm)",
              px: 1,
              color: "brandNavy.200",
              "&:hover": { backgroundColor: "brandNavy.700" },
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              {showOlderItems ? (
                <ChevronDown size={14} strokeWidth={1.9} />
              ) : (
                <ChevronRight size={14} strokeWidth={1.9} />
              )}
              <Typography level="body-sm" sx={{ color: "brandNavy.200" }}>
                {section.label}
              </Typography>
            </Stack>
          </ListItemButton>
        </ListItem>
      ) : (
        <Typography
          level="body-sm"
          sx={{ px: 3, pt: 1.25, pb: 0.25, color: "brandNavy.300" }}
        >
          {section.label}
        </Typography>
      )}

      {showOlderItems
        ? section.conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              editingId={editingId}
              selected={selectedConversationId === conversation.id}
              onArchive={onArchive}
              onDelete={onDelete}
              onEdit={onEdit}
              onEditCancel={onEditCancel}
              onPinToggle={onPinToggle}
              onRename={onRename}
              onSelect={onSelect}
              onUnarchive={onUnarchive}
            />
          ))
        : null}
    </Stack>
  );
}

export function BloomSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    archiveConversation,
    conversations,
    conversationsLoading,
    createConversation,
    deleteConversation,
    pinConversation,
    renameConversation,
    switchConversation,
    unarchiveConversation,
    unpinConversation,
  } = useBloom();
  const [searchDialogOpen, setSearchDialogOpen] = React.useState(false);
  const [savedExpanded, setSavedExpanded] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [olderExpanded, setOlderExpanded] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<BloomConversation | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const sections = React.useMemo(
    () => groupConversations(conversations, ""),
    [conversations],
  );
  const allConversationsQuery = useBloomConversations({
    includeArchived: true,
  });
  const archivedConversations = React.useMemo(
    () =>
      (allConversationsQuery.data ?? []).filter(
        (conversation) => conversation.status === "archived",
      ),
    [allConversationsQuery.data],
  );
  const bookmarksQuery = useBloomBookmarks();
  const bookmarks = bookmarksQuery.data ?? [];
  const visibleGroupedConversations = React.useMemo(
    () => getVisibleSectionConversations(sections, olderExpanded, ""),
    [olderExpanded, sections],
  );
  const visibleConversationCount = sections.reduce(
    (count, section) => count + section.conversations.length,
    0,
  );
  const activeConversationCount = conversations.filter(
    (conversation) => conversation.status !== "archived",
  ).length;
  const archivedCount = archivedConversations.length;
  const archivedLoading = allConversationsQuery.isLoading;
  const hasNoConversations =
    activeConversationCount === 0 && archivedCount === 0 && !archivedLoading;
  const hasOnlyArchivedConversations =
    activeConversationCount === 0 && archivedCount > 0;
  const navigationItems = React.useMemo<SidebarNavigationItem[]>(
    () => [
      ...visibleGroupedConversations.map((conversation) => ({
        kind: "conversation" as const,
        conversation,
      })),
      ...(showArchived
        ? archivedConversations.map((conversation) => ({
            kind: "conversation" as const,
            conversation,
          }))
        : []),
    ],
    [archivedConversations, showArchived, visibleGroupedConversations],
  );
  const selectedNavigationItem =
    selectedIndex === null ? null : (navigationItems[selectedIndex] ?? null);
  const selectedConversationId =
    selectedNavigationItem?.kind === "conversation"
      ? selectedNavigationItem.conversation.id
      : null;
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const knowledgeActive = location.pathname === "/bloom/knowledge";
  const adminActive = location.pathname === "/bloom/admin";
  const settingsActive = location.pathname === "/bloom/settings";

  React.useEffect(() => {
    setSelectedIndex((currentIndex) => {
      if (currentIndex === null) {
        return null;
      }

      if (navigationItems.length === 0) {
        return null;
      }

      return Math.min(currentIndex, navigationItems.length - 1);
    });
  }, [navigationItems.length]);

  React.useEffect(() => {
    setSelectedIndex(null);
  }, [showArchived]);

  const handleCreateConversation = () => {
    void createConversation();
  };

  const handleRename = (conversation: BloomConversation, title: string) => {
    setEditingId(null);
    void renameConversation(conversation.id, title);
  };

  const handlePinToggle = (conversation: BloomConversation) => {
    if (conversation.status === "pinned") {
      void unpinConversation(conversation.id);
      return;
    }

    void pinConversation(conversation.id);
  };

  const handleArchiveConversation = React.useCallback(
    (conversation: BloomConversation) => {
      void archiveConversation(conversation.id)
        .then(() => {
          toast(`${conversation.title} archived`, {
            duration: 5000,
            action: {
              label: "Undo",
              onClick: () => {
                void unarchiveConversation(conversation.id);
              },
            },
          });
        })
        .catch(() => {
          // The mutation hook owns the user-facing error toast.
        });
    },
    [archiveConversation, unarchiveConversation],
  );

  const handleUnarchiveConversation = React.useCallback(
    (conversation: BloomConversation) => {
      void unarchiveConversation(conversation.id);
    },
    [unarchiveConversation],
  );

  const handleOpenConversation = React.useCallback(
    (conversation: BloomConversation) => {
      switchConversation(conversation.id);
    },
    [switchConversation],
  );

  const handleSelectConversation = React.useCallback(
    (conversation: BloomConversation) => {
      const nextIndex = navigationItems.findIndex(
        (item) =>
          item.kind === "conversation" &&
          item.conversation.id === conversation.id,
      );

      if (nextIndex >= 0) {
        setSelectedIndex(nextIndex);
      }
    },
    [navigationItems],
  );

  const openNavigationItem = React.useCallback(
    (item: SidebarNavigationItem) => {
      handleOpenConversation(item.conversation);
    },
    [handleOpenConversation],
  );

  const handleSidebarKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchDialogOpen(true);
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (navigationItems.length === 0) {
          return;
        }

        event.preventDefault();
        setSelectedIndex((currentIndex) => {
          if (currentIndex === null) {
            return event.key === "ArrowDown" ? 0 : navigationItems.length - 1;
          }

          return event.key === "ArrowDown"
            ? (currentIndex + 1) % navigationItems.length
            : (currentIndex - 1 + navigationItems.length) %
                navigationItems.length;
        });
        return;
      }

      if (event.key === "Enter" && selectedNavigationItem) {
        event.preventDefault();
        openNavigationItem(selectedNavigationItem);
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !isEditableKeyboardTarget(event.target) &&
        selectedNavigationItem?.kind === "conversation"
      ) {
        event.preventDefault();
        setDeleteTarget(selectedNavigationItem.conversation);
        return;
      }

      if (event.key === "Escape") {
        if (editingId) {
          event.preventDefault();
          setEditingId(null);
          return;
        }

        if (selectedIndex !== null) {
          event.preventDefault();
          setSelectedIndex(null);
        }
      }
    },
    [
      editingId,
      navigationItems.length,
      openNavigationItem,
      selectedIndex,
      selectedNavigationItem,
    ],
  );

  const handleBookmarkClick = (conversationId: string, messageId: string) => {
    navigate(`/bloom/${conversationId}#${encodeURIComponent(messageId)}`);
  };

  return (
    <Sheet
      variant="solid"
      tabIndex={0}
      onKeyDown={handleSidebarKeyDown}
      sx={{
        height: "100%",
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "brandNavy.700",
        color: "common.white",
        overflow: "hidden",
        "&:focus": { outline: 0 },
      }}
    >
      <Stack
        spacing={1.5}
        sx={{ px: 1.5, pt: 2, pb: 1.5, flexShrink: 0, mt: 2 }}
      >
        <Button
          fullWidth
          variant="solid"
          color="brandNavy"
          startDecorator={<Sparkles size={15} strokeWidth={1.9} />}
          onClick={handleCreateConversation}
          sx={{
            mt: 0.5,
            minHeight: 42,
            justifyContent: "center",
            borderRadius: 999,
            color: "common.white",
            backgroundColor: "brandNavy.900",
            fontWeight: 700,
            "--Button-gap": "0.5rem",
            "&:hover": {
              backgroundColor: "brandNavy.800",
            },
          }}
        >
          New Chat
        </Button>
        {/* <ListItemButton
          onClick={() => setSearchDialogOpen(true)}
          aria-label="Search conversations"
          sx={{
            minHeight: 32,
            justifyContent: "flex-start",
            borderRadius: "var(--joy-radius-md)",
            color: "brandNavy.200",
            gap: 1,
            px: 1,
            "&:hover": {
              backgroundColor: "brandNavy.700",
              color: "common.white",
            },
          }}
        >
          <Search size={15} strokeWidth={1.9} />
          <Typography
            level="body-sm"
            sx={{ color: "inherit", fontWeight: 500 }}
          >
            Search
          </Typography>
        </ListItemButton> */}
        <JoyButton
          onClick={() => setSearchDialogOpen(true)}
          fullWidth
          color="neutral"
          size="sm"
          variant="plain"
          startDecorator={<Search size={15} strokeWidth={1.9} />}
          sx={{
            minHeight: 36,
            justifyContent: "flex-start",
            color: savedExpanded ? "common.white" : "brandNavy.200",
            borderRadius: "var(--joy-radius-md)",
            "&:hover": {
              backgroundColor: "brandNavy.700",
              color: "common.white",
            },
          }}
        >
          <Typography
            level="body-sm"
            sx={{ color: "inherit", fontWeight: 500 }}
          >
            Search
          </Typography>
        </JoyButton>

        <JoyButton
          fullWidth
          color="neutral"
          size="sm"
          variant="plain"
          startDecorator={
            <Star
              size={15}
              strokeWidth={1.9}
              fill={savedExpanded ? "currentColor" : "none"}
            />
          }
          onClick={() => setSavedExpanded((current) => !current)}
          sx={{
            minHeight: 32,
            justifyContent: "flex-start",
            color: savedExpanded ? "common.white" : "brandNavy.200",
            borderRadius: "var(--joy-radius-md)",
            "&:hover": {
              backgroundColor: "brandNavy.700",
              color: "common.white",
            },
          }}
        >
          <Typography
            level="body-sm"
            sx={{ color: "inherit", fontWeight: 500 }}
          >
            Saved ({bookmarks.length})
          </Typography>
        </JoyButton>
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          pb: 1,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--joy-palette-brandNavy-500) transparent",
          "&::-webkit-scrollbar": { width: 6, height: 6 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--joy-palette-brandNavy-500)",
            borderRadius: 999,
          },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        }}
      >
        {savedExpanded ? (
          <BloomBookmarksSidebar
            bookmarks={bookmarks}
            isLoading={bookmarksQuery.isLoading}
            onBookmarkClick={handleBookmarkClick}
          />
        ) : null}

        {conversationsLoading ? <SidebarSkeletonList /> : null}

        {!conversationsLoading && hasNoConversations ? (
          <BloomEmptyState
            variant="no-conversations"
            onCreate={handleCreateConversation}
          />
        ) : null}

        {!conversationsLoading &&
        hasOnlyArchivedConversations &&
        !showArchived ? (
          <BloomEmptyState
            variant="all-archived"
            onCreate={handleCreateConversation}
            onShowArchived={() => setShowArchived(true)}
          />
        ) : null}

        {!conversationsLoading &&
        (visibleConversationCount > 0 ||
          (showArchived && archivedCount > 0)) ? (
          <List
            size="sm"
            sx={{
              "--ListItem-paddingY": 0,
              "--ListItem-paddingX": 0,
              "--List-gap": "2px",
            }}
          >
            {sections.map((section) => (
              <ConversationSectionList
                key={section.key}
                section={section}
                editingId={editingId}
                olderExpanded={olderExpanded}
                searchTerm=""
                selectedConversationId={selectedConversationId}
                onArchive={handleArchiveConversation}
                onDelete={setDeleteTarget}
                onEdit={(conversation) => {
                  setEditingId(conversation.id || null);
                }}
                onEditCancel={() => setEditingId(null)}
                onPinToggle={handlePinToggle}
                onRename={handleRename}
                onSelect={handleSelectConversation}
                onToggleOlder={() => setOlderExpanded((current) => !current)}
                onUnarchive={handleUnarchiveConversation}
              />
            ))}

            {showArchived && archivedCount > 0 ? (
              <Stack spacing={0.5}>
                <Typography
                  level="body-sm"
                  sx={{ px: 3, pt: 1.25, pb: 0.25, color: "brandNavy.300" }}
                >
                  Archived
                </Typography>
                {archivedConversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    editingId={editingId}
                    selected={selectedConversationId === conversation.id}
                    onArchive={handleArchiveConversation}
                    onDelete={setDeleteTarget}
                    onEdit={(nextConversation) => {
                      setEditingId(nextConversation.id || null);
                    }}
                    onEditCancel={() => setEditingId(null)}
                    onPinToggle={handlePinToggle}
                    onRename={handleRename}
                    onSelect={handleSelectConversation}
                    onUnarchive={handleUnarchiveConversation}
                  />
                ))}
              </Stack>
            ) : null}
          </List>
        ) : null}
      </Box>

      <Box
        sx={{
          px: 1.5,
          py: 2,
          borderTop: "1px solid",
          borderColor: "brandNavy.700",
        }}
      >
        <JoyButton
          fullWidth
          color="neutral"
          disabled={archivedCount === 0 && !showArchived}
          size="sm"
          variant="plain"
          startDecorator={<Archive size={15} strokeWidth={1.9} />}
          onClick={() => setShowArchived((current) => !current)}
          sx={{
            minHeight: 34,
            justifyContent: "flex-start",
            color: showArchived ? "common.white" : "brandNavy.200",
            borderRadius: "var(--joy-radius-md)",
            mb: 0.75,
            "&:hover": {
              backgroundColor: "brandNavy.700",
              color: "common.white",
            },
          }}
        >
          {showArchived
            ? `Hide Archived (${archivedCount})`
            : `Show Archived (${archivedCount})`}
        </JoyButton>
        <JoyButton
          fullWidth
          color="neutral"
          component={RouterLink as never}
          to="/bloom/knowledge"
          size="sm"
          variant="plain"
          startDecorator={<BookOpenText size={15} strokeWidth={1.9} />}
          sx={{
            minHeight: 32,
            justifyContent: "flex-start",
            mb: 0.75,
            color: knowledgeActive ? "common.white" : "brandNavy.200",
            borderRadius: "var(--joy-radius-md)",
            backgroundColor: knowledgeActive ? "brandNavy.700" : "transparent",
            "&:hover": {
              backgroundColor: "brandNavy.700",
              color: "common.white",
            },
          }}
        >
          <Typography
            level="body-sm"
            sx={{ color: "inherit", fontWeight: 500 }}
          >
            Knowledge Base
          </Typography>
        </JoyButton>
        <JoyButton
          fullWidth
          color="neutral"
          component={RouterLink as never}
          to="/bloom/settings"
          size="sm"
          variant="plain"
          startDecorator={<Settings size={15} strokeWidth={1.9} />}
          sx={{
            minHeight: 32,
            justifyContent: "flex-start",
            color: settingsActive ? "common.white" : "brandNavy.200",
            borderRadius: "var(--joy-radius-md)",
            backgroundColor: settingsActive ? "brandNavy.700" : "transparent",
            "&:hover": {
              backgroundColor: "brandNavy.700",
              color: "common.white",
            },
          }}
        >
          <Typography
            level="body-sm"
            sx={{ color: "inherit", fontWeight: 500 }}
          >
            Settings
          </Typography>
        </JoyButton>
        {isSuperAdmin ? (
          <JoyButton
            fullWidth
            color="neutral"
            component={RouterLink as never}
            to="/bloom/admin"
            size="sm"
            variant="plain"
            startDecorator={<BarChart3 size={15} strokeWidth={1.9} />}
            sx={{
              minHeight: 34,
              justifyContent: "flex-start",
              color: adminActive ? "common.white" : "brandNavy.200",
              borderRadius: "var(--joy-radius-md)",
              mt: 0.75,
              backgroundColor: adminActive ? "brandNavy.700" : "transparent",
              "&:hover": {
                backgroundColor: "brandNavy.700",
                color: "common.white",
              },
            }}
          >
            Admin
          </JoyButton>
        ) : null}
      </Box>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor:
                "rgba(var(--joy-palette-brandNavy-darkChannel) / 0.24)",
              backdropFilter: "blur(4px)",
            },
          },
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 1,
        }}
      >
        <ModalDialog
          role="alertdialog"
          aria-labelledby="bloom-delete-conversation-title"
          aria-describedby="bloom-delete-conversation-description"
          variant="outlined"
          maxWidth={420}
          sx={{
            width: "calc(100vw - 2rem)",
            borderRadius: "var(--joy-radius-lg)",
            backgroundColor: "background.surface",
            borderColor: "neutral.200",
            boxShadow: "var(--joy-shadow-xl)",
          }}
        >
          <DialogTitle id="bloom-delete-conversation-title">
            {deleteTarget
              ? `Delete '${deleteTarget.title}'?`
              : "Delete conversation?"}
          </DialogTitle>
          <DialogContent id="bloom-delete-conversation-description">
            This conversation and its messages will be permanently hidden.
          </DialogContent>
          <DialogActions>
            <JoyButton
              bloomVariant="ghost"
              color="neutral"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </JoyButton>
            <JoyButton
              bloomVariant="destructive"
              loading={deleting}
              onClick={async () => {
                if (!deleteTarget) {
                  return;
                }

                setDeleting(true);
                try {
                  await deleteConversation(deleteTarget.id);
                  setDeleteTarget(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Delete
            </JoyButton>
          </DialogActions>
        </ModalDialog>
      </Modal>

      <BloomSearchDialog
        open={searchDialogOpen}
        onClose={() => setSearchDialogOpen(false)}
      />
    </Sheet>
  );
}
