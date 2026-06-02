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

/**
 * Subtle dotted-grid backdrop with a cursor-following radial glow.
 *
 * The dot pattern is a pure CSS radial-gradient (no canvas, no SVG, no DOM
 * node per dot). The glow is positioned via direct DOM writes inside a
 * requestAnimationFrame callback so cursor tracking never triggers a React
 * re-render. The whole layer is non-interactive (`pointerEvents: none`) and
 * sits behind the chat content, so clicks, scrolling, text selection and
 * drag-and-drop all pass straight through to the messages above it.
 */
function DotGridHighlight() {
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const highlightRef = React.useRef<HTMLDivElement | null>(null);
  const brightDotsRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Skip cursor tracking entirely on touch devices — there is no hover.
    if (
      typeof window === "undefined" ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    ) {
      return;
    }

    // Track movement on the positioned surface (our parent) so the glow keeps
    // following the cursor even while it is over messages and cards.
    const surface = gridRef.current?.parentElement ?? null;
    const highlight = highlightRef.current;
    const brightDots = brightDotsRef.current;
    if (!surface || !highlight || !brightDots) {
      return;
    }

    let frameId: number | null = null;

    const handlePointerMove = (event: MouseEvent) => {
      const rect = surface.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        // Move both the ambient glow and the bright dot overlay together.
        highlight.style.left = `${x}px`;
        highlight.style.top = `${y}px`;
        brightDots.style.left = `${x}px`;
        brightDots.style.top = `${y}px`;

        // The bright dot overlay (300px wide, half = 150) is centered on the
        // cursor, so its background origin drifts as the cursor moves. Counter
        // that drift so its dots land exactly on the base grid (which starts at
        // 10px with 20px spacing). The `+ 20) % 20` keeps the result positive.
        const bpX = (((160 - x) % 20) + 20) % 20;
        const bpY = (((160 - y) % 20) + 20) % 20;
        brightDots.style.backgroundPosition = `${bpX}px ${bpY}px`;
      });
    };

    const showGlow = () => {
      highlight.style.opacity = "1";
      brightDots.style.opacity = "1";
    };

    const hideGlow = () => {
      highlight.style.opacity = "0";
      brightDots.style.opacity = "0";
    };

    surface.addEventListener("mousemove", handlePointerMove, { passive: true });
    surface.addEventListener("mouseenter", showGlow);
    surface.addEventListener("mouseleave", hideGlow);

    return () => {
      surface.removeEventListener("mousemove", handlePointerMove);
      surface.removeEventListener("mouseenter", showGlow);
      surface.removeEventListener("mouseleave", hideGlow);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <Box
      ref={gridRef}
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        // Base dot grid — faint, neutral.
        backgroundImage: (theme) => {
          const dotColor =
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.07)";
          return `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`;
        },
        backgroundSize: "20px 20px",
        backgroundPosition: "10px 10px",
      }}
    >
      {/* Layer 1: ambient Navy Green glow tinting the space between dots. */}
      <Box
        ref={highlightRef}
        sx={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0,
          transition: "opacity 300ms ease",
          pointerEvents: "none",
          willChange: "left, top",
          background: (theme) => {
            const isDark = theme.palette.mode === "dark";
            const glowCore = isDark
              ? "rgba(74, 222, 128, 0.10)"
              : "rgba(45, 107, 79, 0.08)";
            const glowMid = isDark
              ? "rgba(74, 222, 128, 0.04)"
              : "rgba(45, 107, 79, 0.03)";
            return `radial-gradient(circle, ${glowCore} 0%, ${glowMid} 45%, transparent 70%)`;
          },
        }}
      />

      {/* Layer 2: brighter Navy Green dots, masked so they only show near the
          cursor and fade back into the neutral base grid at the edges. */}
      <Box
        ref={brightDotsRef}
        sx={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0,
          transition: "opacity 300ms ease",
          pointerEvents: "none",
          willChange: "left, top",
          backgroundImage: (theme) => {
            const isDark = theme.palette.mode === "dark";
            const brightDot = isDark
              ? "rgba(134, 239, 172, 0.45)"
              : "rgba(45, 107, 79, 0.30)";
            return `radial-gradient(circle, ${brightDot} 1px, transparent 1px)`;
          },
          backgroundSize: "20px 20px",
          backgroundPosition: "10px 10px",
          maskImage:
            "radial-gradient(circle, black 0%, black 25%, transparent 65%)",
          WebkitMaskImage:
            "radial-gradient(circle, black 0%, black 25%, transparent 65%)",
        }}
      />
    </Box>
  );
}

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
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          backgroundColor: "neutral.50",
        }}
      >
        <DotGridHighlight />
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            overflowY: "auto",
            // Clearance so content isn't hidden behind the floating composer.
            pb: { xs: "180px", sm: "220px" },
          }}
        >
          <BloomHomeState prioritizePageContext={prioritizePageContext} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        backgroundColor: "neutral.50",
      }}
    >
      <DotGridHighlight />
      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          backgroundColor: "transparent",
          overflowY: "auto",
          overflowX: "hidden",
          // Clearance so the last message isn't hidden behind the floating
          // composer that now overlays the bottom of the conversation.
          pb: { xs: "180px", sm: "220px" },
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
