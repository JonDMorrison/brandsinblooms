import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { motion } from "framer-motion";
import { MessageSquare, Pin, Search, X } from "lucide-react";
import { useBloom } from "@/components/bloom/BloomContext";
import type { BloomConversation } from "@/hooks/bloom/types";
import { useBloomMessageSearch } from "@/hooks/bloom/useBloomMessageSearch";

interface BloomSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

type DateGroupKey = "today" | "yesterday" | "pastWeek" | "pastMonth" | "older";
type SearchGroupKey = "pinned" | DateGroupKey;

interface ConversationPreview {
  text: string;
  empty: boolean;
}

interface SearchResultItem {
  conversation: BloomConversation;
  index: number;
  preview: ConversationPreview;
}

interface SearchResultGroup {
  key: SearchGroupKey;
  label: string;
  pinned: boolean;
  items: SearchResultItem[];
}

const RECENT_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;
const PREVIEW_CHARACTER_LIMIT = 80;
const SEARCH_GROUP_ORDER: SearchGroupKey[] = [
  "pinned",
  "today",
  "yesterday",
  "pastWeek",
  "pastMonth",
  "older",
];
const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {
  pinned: "Pinned",
  today: "Today",
  yesterday: "Yesterday",
  pastWeek: "Past week",
  pastMonth: "Past month",
  older: "Older",
};

const MotionModalDialog = motion.create(ModalDialog);

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

const getDateGroupKey = (value: string): DateGroupKey => {
  const dayDifference = getDayDifference(value);

  if (dayDifference <= 0) {
    return "today";
  }

  if (dayDifference === 1) {
    return "yesterday";
  }

  if (dayDifference <= 7) {
    return "pastWeek";
  }

  if (dayDifference <= 30) {
    return "pastMonth";
  }

  return "older";
};

const matchesTitle = (conversation: BloomConversation, query: string) =>
  conversation.title.toLowerCase().includes(query.toLowerCase());

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripPreviewText = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>#*_~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const truncatePreview = (value: string) => {
  if (value.length <= PREVIEW_CHARACTER_LIMIT) {
    return value;
  }

  return `${value.slice(0, PREVIEW_CHARACTER_LIMIT).trimEnd()}...`;
};

const createPreview = (
  conversation: BloomConversation,
  searchPreview: string | undefined,
): ConversationPreview => {
  const source =
    searchPreview ??
    (conversation.messageCount > 0 ? conversation.lastMessagePreview : "");
  const text = truncatePreview(stripPreviewText(source));

  if (!text) {
    return { text: "No messages yet", empty: true };
  }

  return { text, empty: false };
};

const renderHighlightedTitle = (text: string, query: string) => {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return text;
  }

  const matcher = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi");
  const parts = text.split(matcher);
  const normalizedQueryLower = normalizedQuery.toLowerCase();

  return parts.map((part, partIndex) => {
    if (part.toLowerCase() !== normalizedQueryLower) {
      return part;
    }

    return (
      <Typography
        key={`${part}-${partIndex}`}
        component="span"
        sx={{ color: "primary.600", fontWeight: 700 }}
      >
        {part}
      </Typography>
    );
  });
};

const groupSearchResults = (items: SearchResultItem[]): SearchResultGroup[] => {
  const buckets = new Map<SearchGroupKey, SearchResultItem[]>();

  SEARCH_GROUP_ORDER.forEach((groupKey) => buckets.set(groupKey, []));

  items.forEach((item) => {
    const groupKey =
      item.conversation.status === "pinned"
        ? "pinned"
        : getDateGroupKey(item.conversation.updatedAt);
    buckets.get(groupKey)?.push(item);
  });

  return SEARCH_GROUP_ORDER.flatMap((groupKey) => {
    const groupItems = buckets.get(groupKey) ?? [];

    if (groupItems.length === 0) {
      return [];
    }

    return [
      {
        key: groupKey,
        label: SEARCH_GROUP_LABELS[groupKey],
        pinned: groupKey === "pinned",
        items: groupItems,
      },
    ];
  });
};

function SearchGroupHeader({
  label,
  pinned,
}: {
  label: string;
  pinned: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ px: 2.5, pt: 1.5, pb: 0.5 }}
    >
      {pinned ? (
        <Pin size={12} strokeWidth={2} color="var(--joy-palette-neutral-500)" />
      ) : null}
      <Typography
        level="body-xs"
        sx={{
          color: "neutral.500",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

function SearchSkeletonRows() {
  return (
    <Stack sx={{ py: 1 }}>
      {Array.from({ length: 3 }).map((_, skeletonIndex) => (
        <Box
          key={skeletonIndex}
          sx={{ display: "flex", gap: 1.5, px: 2.5, py: 1.25, mx: 1 }}
        >
          <Skeleton
            variant="rectangular"
            width={32}
            height={32}
            sx={{ borderRadius: "var(--joy-radius-md)" }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" sx={{ width: "60%", mb: 0.5 }} />
            <Skeleton variant="text" sx={{ width: "85%" }} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function SearchEmptyState({
  type,
  onCreateConversation,
}: {
  type: "no-conversations" | "no-results";
  onCreateConversation?: () => void;
}) {
  const noConversations = type === "no-conversations";
  const Icon = noConversations ? MessageSquare : Search;

  return (
    <Stack
      spacing={1.25}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: 280, px: 3, py: 6, textAlign: "center" }}
    >
      <Icon
        size={40}
        strokeWidth={1.8}
        color="var(--joy-palette-neutral-300)"
      />
      <Stack spacing={0.35} alignItems="center">
        <Typography
          level="body-md"
          sx={{ color: "neutral.500", fontWeight: 500 }}
        >
          {noConversations ? "No conversations yet" : "No results found"}
        </Typography>
        <Typography level="body-sm" sx={{ color: "neutral.400" }}>
          {noConversations
            ? "Start a conversation with Bloom"
            : "Try different keywords"}
        </Typography>
      </Stack>
      {noConversations && onCreateConversation ? (
        <Button
          variant="soft"
          color="neutral"
          size="sm"
          onClick={onCreateConversation}
          sx={{ mt: 0.75, borderRadius: "var(--joy-radius-md)" }}
        >
          New Chat
        </Button>
      ) : null}
    </Stack>
  );
}

function SearchResultRow({
  item,
  highlighted,
  query,
  onHover,
  onSelect,
}: {
  item: SearchResultItem;
  highlighted: boolean;
  query: string;
  onHover: (index: number) => void;
  onSelect: (conversation: BloomConversation) => void;
}) {
  const title = item.conversation.title?.trim() || "Untitled conversation";

  return (
    <Box
      component="button"
      type="button"
      data-search-result-index={item.index}
      aria-selected={highlighted || undefined}
      onMouseEnter={() => onHover(item.index)}
      onClick={() => onSelect(item.conversation)}
      sx={{
        appearance: "none",
        width: "calc(100% - 16px)",
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        px: 2.5,
        py: 1.25,
        mx: 1,
        border: 0,
        borderRadius: "var(--joy-radius-md)",
        bgcolor: highlighted ? "neutral.50" : "transparent",
        color: "neutral.800",
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 120ms ease",
        "&:hover": {
          bgcolor: "neutral.50",
        },
        "&:active": {
          bgcolor: "neutral.100",
        },
        "&:focus-visible": {
          outline: 0,
          boxShadow:
            "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
        },
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: "var(--joy-radius-md)",
          bgcolor: "neutral.50",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <MessageSquare
          size={16}
          strokeWidth={1.9}
          color="var(--joy-palette-neutral-500)"
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          level="body-sm"
          noWrap
          sx={{
            color: "neutral.800",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {renderHighlightedTitle(title, query)}
        </Typography>
        <Typography
          level="body-xs"
          noWrap
          sx={{
            color: "neutral.400",
            fontStyle: item.preview.empty ? "italic" : "normal",
            fontWeight: 400,
            mt: 0.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.preview.text}
        </Typography>
      </Box>
    </Box>
  );
}

export function BloomSearchDialog({ open, onClose }: BloomSearchDialogProps) {
  const { conversations, createConversation, switchConversation } = useBloom();
  const [draft, setDraft] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setDraft("");
      setDebouncedQuery("");
      setHighlightedIndex(-1);
      return;
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setDebouncedQuery(draft.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timerId);
  }, [draft, open]);

  const draftQuery = draft.trim();
  const messageSearchQuery = useBloomMessageSearch(open ? debouncedQuery : "");
  const messageResults = messageSearchQuery.data ?? [];

  const activeConversations = React.useMemo(
    () =>
      conversations.filter(
        (conversation) => conversation.status !== "archived",
      ),
    [conversations],
  );

  const conversationById = React.useMemo(() => {
    const map = new Map<string, BloomConversation>();
    activeConversations.forEach((conversation) => {
      map.set(conversation.id, conversation);
    });
    return map;
  }, [activeConversations]);

  const messagePreviewByConversationId = React.useMemo(() => {
    const map = new Map<string, string>();
    messageResults.forEach((result) => {
      if (map.has(result.conversationId)) {
        return;
      }

      map.set(
        result.conversationId,
        `${result.snippet.before}${result.snippet.match}${result.snippet.after}`,
      );
    });
    return map;
  }, [messageResults]);

  const results = React.useMemo<BloomConversation[]>(() => {
    if (!debouncedQuery) {
      return activeConversations.slice(0, RECENT_LIMIT);
    }

    const seen = new Set<string>();
    const merged: BloomConversation[] = [];

    activeConversations.forEach((conversation) => {
      if (matchesTitle(conversation, debouncedQuery)) {
        seen.add(conversation.id);
        merged.push(conversation);
      }
    });

    messageResults.forEach((result) => {
      if (seen.has(result.conversationId)) {
        return;
      }

      const conversation = conversationById.get(result.conversationId);
      if (!conversation) {
        return;
      }

      seen.add(conversation.id);
      merged.push(conversation);
    });

    return merged;
  }, [activeConversations, conversationById, debouncedQuery, messageResults]);

  const resultItems = React.useMemo<SearchResultItem[]>(
    () =>
      results.map((conversation, index) => ({
        conversation,
        index,
        preview: createPreview(
          conversation,
          messagePreviewByConversationId.get(conversation.id),
        ),
      })),
    [messagePreviewByConversationId, results],
  );

  const groupedResults = React.useMemo(
    () => groupSearchResults(resultItems),
    [resultItems],
  );

  React.useEffect(() => {
    setHighlightedIndex((currentIndex) => {
      if (resultItems.length === 0) {
        return -1;
      }

      if (currentIndex < 0) {
        return draftQuery ? 0 : -1;
      }

      return Math.min(currentIndex, resultItems.length - 1);
    });
  }, [draftQuery, resultItems.length]);

  React.useEffect(() => {
    if (highlightedIndex < 0 || !listContainerRef.current) {
      return;
    }

    const activeButton = listContainerRef.current.querySelector<HTMLElement>(
      `[data-search-result-index='${highlightedIndex}']`,
    );

    activeButton?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, resultItems.length]);

  const handleSelect = React.useCallback(
    (conversation: BloomConversation) => {
      onClose();
      switchConversation(conversation.id);
    },
    [onClose, switchConversation],
  );

  const handleCreateConversation = React.useCallback(() => {
    void createConversation().then(() => onClose());
  }, [createConversation, onClose]);

  const handleDraftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDraft(nextValue);
    setHighlightedIndex(nextValue.trim() ? 0 : -1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      if (resultItems.length === 0) {
        return;
      }

      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex < 0 ? 0 : (currentIndex + 1) % resultItems.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      if (resultItems.length === 0) {
        return;
      }

      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex <= 0 ? resultItems.length - 1 : currentIndex - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      const target = resultItems[highlightedIndex];
      if (target) {
        event.preventDefault();
        handleSelect(target.conversation);
      }
    }
  };

  const isQueryActive = draftQuery.length > 0;
  const isSearchPending =
    isQueryActive &&
    (messageSearchQuery.isFetching || draftQuery !== debouncedQuery);
  const hasNoConversations = activeConversations.length === 0;
  const hasNoResults =
    isQueryActive && resultItems.length === 0 && !isSearchPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          },
        },
      }}
      sx={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
      }}
    >
      <MotionModalDialog
        variant="plain"
        aria-labelledby="bloom-search-dialog-title"
        initial={{ opacity: 0, x: "-50%", y: "calc(-50% - 8px)", scale: 0.98 }}
        animate={{ opacity: 1, x: "-50%", y: "-50%", scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        onKeyDown={handleKeyDown}
        sx={{
          position: "fixed",
          top: "50dvh",
          left: "50vw",
          width: "min(580px, calc(100vw - 32px))",
          maxWidth: "92vw",
          maxHeight: "min(600px, calc(100dvh - 32px), 75vh)",
          m: 0,
          p: 0,
          border: "none",
          borderRadius: "16px",
          bgcolor: "background.surface",
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 8px 16px -8px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transformOrigin: "center center",
        }}
      >
        <Typography
          id="bloom-search-dialog-title"
          level="body-xs"
          sx={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          Search conversations
        </Typography>

        <Box
          sx={{
            px: 2.5,
            py: 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            borderBottom: "1px solid",
            borderColor: "neutral.100",
          }}
        >
          <Search
            size={20}
            strokeWidth={2}
            color="var(--joy-palette-neutral-400)"
            style={{ flexShrink: 0 }}
          />
          <Input
            autoFocus
            slotProps={{ input: { ref: inputRef } }}
            variant="plain"
            value={draft}
            onChange={handleDraftChange}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            sx={{
              flex: 1,
              fontSize: "var(--joy-fontSize-md)",
              fontWeight: 400,
              "--Input-focusedThickness": "0px",
              bgcolor: "transparent",
              color: "neutral.800",
              "& .MuiInput-input": {
                px: 0,
                color: "neutral.800",
                "&::placeholder": {
                  color: "var(--joy-palette-neutral-400)",
                  fontWeight: 400,
                  opacity: 1,
                },
              },
            }}
          />
          <IconButton
            aria-label="Close search"
            size="sm"
            variant="plain"
            color="neutral"
            onClick={onClose}
            sx={{
              width: 28,
              height: 28,
              minWidth: 28,
              minHeight: 28,
              borderRadius: "50%",
              color: "neutral.600",
              "&:hover": { bgcolor: "neutral.100", color: "neutral.900" },
            }}
          >
            <X size={16} strokeWidth={2} />
          </IconButton>
        </Box>

        <Box
          ref={listContainerRef}
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            py: 1,
            "&::-webkit-scrollbar": { width: 5 },
            "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "neutral.200",
              borderRadius: 4,
            },
            "&::-webkit-scrollbar-thumb:hover": { bgcolor: "neutral.300" },
          }}
        >
          {hasNoConversations ? (
            <SearchEmptyState
              type="no-conversations"
              onCreateConversation={handleCreateConversation}
            />
          ) : isSearchPending ? (
            <SearchSkeletonRows />
          ) : hasNoResults ? (
            <SearchEmptyState type="no-results" />
          ) : (
            groupedResults.map((group) => (
              <Box key={group.key}>
                <SearchGroupHeader label={group.label} pinned={group.pinned} />
                {group.items.map((item) => (
                  <SearchResultRow
                    key={item.conversation.id}
                    item={item}
                    highlighted={item.index === highlightedIndex}
                    query={debouncedQuery}
                    onHover={setHighlightedIndex}
                    onSelect={handleSelect}
                  />
                ))}
              </Box>
            ))
          )}
        </Box>
      </MotionModalDialog>
    </Modal>
  );
}
