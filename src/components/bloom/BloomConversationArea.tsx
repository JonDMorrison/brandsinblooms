import * as React from "react";
import { useLocation } from "react-router-dom";
import Box from "@mui/joy/Box";
import { BloomHomeState } from "@/components/bloom/BloomHomeState";
import {
  BloomMessageList,
  type BloomMessageListHandle,
  BloomMessageSkeletons,
} from "@/components/bloom/BloomMessageList";
import { BloomScrollToBottom } from "@/components/bloom/BloomScrollToBottom";
import { useBloom } from "@/components/bloom/BloomContext";

const NEAR_BOTTOM_THRESHOLD = 100;
const TOP_PAGINATION_THRESHOLD = 24;

interface BloomConversationAreaProps {
  prioritizePageContext?: boolean;
}

const messageIdFromHash = (hash: string) => {
  if (!hash.startsWith("#")) {
    return null;
  }

  const value = hash.slice(1);
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function BloomConversationArea({
  prioritizePageContext = true,
}: BloomConversationAreaProps) {
  const location = useLocation();
  const {
    activeConversationId,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isStreaming,
    messages,
    messagesLoading,
  } = useBloom();
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const messageListRef = React.useRef<BloomMessageListHandle | null>(null);
  const previousMessageLengthRef = React.useRef(0);
  const activeConversationRef = React.useRef<string | null>(
    activeConversationId,
  );
  const nearBottomRef = React.useRef(true);
  const paginationAnchorRef = React.useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const scrollTargetMessageId = React.useMemo(
    () => messageIdFromHash(location.hash),
    [location.hash],
  );

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (messageListRef.current) {
        messageListRef.current.scrollToBottom(behavior);
      } else {
        const container = scrollRef.current;
        if (!container) {
          return;
        }

        container.scrollTo({ top: container.scrollHeight, behavior });
      }
      nearBottomRef.current = true;
      setShowScrollToBottom(false);
    },
    [],
  );

  const handleTopBoundaryVisible = React.useCallback(() => {
    const container = scrollRef.current;
    if (
      !container ||
      !hasNextPage ||
      isFetchingNextPage ||
      paginationAnchorRef.current
    ) {
      return;
    }

    paginationAnchorRef.current = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
    };
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const updateScrollState = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    nearBottomRef.current = nearBottom;
    setShowScrollToBottom(
      !nearBottom && container.scrollHeight > container.clientHeight,
    );
  }, []);

  const handleScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    updateScrollState();

    if (messageListRef.current?.isVirtualized()) {
      return;
    }

    if (
      container.scrollTop <= TOP_PAGINATION_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage &&
      !paginationAnchorRef.current
    ) {
      paginationAnchorRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, updateScrollState]);

  React.useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (paginationAnchorRef.current && !isFetchingNextPage) {
      const anchor = paginationAnchorRef.current;
      paginationAnchorRef.current = null;
      container.scrollTop =
        container.scrollHeight - anchor.scrollHeight + anchor.scrollTop;
      updateScrollState();
      return;
    }

    if (activeConversationRef.current !== activeConversationId) {
      activeConversationRef.current = activeConversationId;
      previousMessageLengthRef.current = messages.length;
      if (!scrollTargetMessageId) {
        requestAnimationFrame(() => scrollToBottom("auto"));
      }
      return;
    }

    const previousMessageLength = previousMessageLengthRef.current;
    const messageAdded = messages.length > previousMessageLength;
    previousMessageLengthRef.current = messages.length;

    if (
      messageAdded &&
      (nearBottomRef.current || previousMessageLength === 0)
    ) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  }, [
    activeConversationId,
    isFetchingNextPage,
    messages.length,
    scrollToBottom,
    scrollTargetMessageId,
    updateScrollState,
  ]);

  React.useEffect(() => {
    if (
      !activeConversationId ||
      !scrollTargetMessageId ||
      messagesLoading ||
      typeof document === "undefined"
    ) {
      return;
    }

    if (messageListRef.current?.scrollToMessage(scrollTargetMessageId)) {
      requestAnimationFrame(() => {
        updateScrollState();
      });
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [
    activeConversationId,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    messages.length,
    messagesLoading,
    scrollTargetMessageId,
    updateScrollState,
  ]);

  const showHomeState =
    !activeConversationId ||
    (!messagesLoading && messages.length === 0 && !isStreaming);

  if (showHomeState) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          backgroundColor: "neutral.50",
        }}
      >
        <BloomHomeState prioritizePageContext={prioritizePageContext} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        backgroundColor: "neutral.50",
      }}
    >
      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{
          height: "100%",
          backgroundColor: "neutral.50",
          overflowY: "auto",
          overflowX: "hidden",
          scrollBehavior: "smooth",
          overscrollBehavior: "contain",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--joy-palette-neutral-300) transparent",
          "&::-webkit-scrollbar": { width: 6, height: 6 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--joy-palette-neutral-300)",
            borderRadius: 999,
          },
          "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "var(--joy-palette-neutral-400)",
          },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        }}
      >
        {messagesLoading && messages.length === 0 ? (
          <BloomMessageSkeletons />
        ) : (
          <BloomMessageList
            ref={messageListRef}
            messages={messages}
            isStreaming={isStreaming}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onTopBoundaryVisible={handleTopBoundaryVisible}
            scrollContainerRef={scrollRef}
          />
        )}
      </Box>
      <BloomScrollToBottom
        visible={showScrollToBottom}
        onClick={() => scrollToBottom("smooth")}
      />
    </Box>
  );
}
