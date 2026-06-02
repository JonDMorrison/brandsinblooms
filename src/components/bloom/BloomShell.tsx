import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import { Outlet, useLocation } from "react-router-dom";
import { BloomHeader } from "@/components/bloom/BloomHeader";
import { BloomMotionProvider } from "@/components/bloom/BloomMotionContext";
import { BloomProvider, useBloom } from "@/components/bloom/BloomContext";
import { BloomShortcutsPanel } from "@/components/bloom/BloomShortcutsPanel";
import { BloomSidebar } from "@/components/bloom/BloomSidebar";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { ChunkErrorBoundary } from "@/components/loading/ChunkErrorBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { useBloomShortcuts } from "@/hooks/bloom/useBloomShortcuts";
import useMediaQuery from "@/hooks/use-media-query";

export interface BloomShellOutletContext {
  prioritizePageContext: boolean;
}

const BLOOM_UTILITY_SEGMENTS = new Set(["admin", "knowledge", "settings"]);

const isBloomUtilityPath = (pathname: string) => {
  const [, bloomSegment, childSegment] = pathname.split("/");
  return bloomSegment === "bloom" && BLOOM_UTILITY_SEGMENTS.has(childSegment);
};

function BloomShellContent() {
  const location = useLocation();
  const { conversationStartCount, entitySummary, messages, pageContext } =
    useBloom();
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [pageContextPriorityDismissed, setPageContextPriorityDismissed] =
    React.useState(false);
  const [entityContextBadgeDismissed, setEntityContextBadgeDismissed] =
    React.useState(false);
  const isUtilityRoute = isBloomUtilityPath(location.pathname);
  const pageContextBadgeEligible = Boolean(
    pageContext &&
    pageContext.pageCategory !== "bloom" &&
    pageContext.pageCategory !== "other",
  );
  const entityContextKey =
    pageContext?.entityType && pageContext.entityId
      ? `${pageContext.entityType}:${pageContext.entityId}`
      : null;
  const entityContextBadgeEligible = Boolean(
    pageContext?.entityType &&
    pageContext.entityId &&
    entitySummary &&
    entitySummary.entityType === pageContext.entityType &&
    entitySummary.entityId === pageContext.entityId,
  );
  const pageContextPriorityActive =
    pageContextBadgeEligible &&
    !pageContextPriorityDismissed &&
    messages.length === 0;
  const showEntityContextBadge =
    entityContextBadgeEligible && !entityContextBadgeDismissed;
  const previousPageContextPathnameRef = React.useRef<string | null>(
    pageContext?.pathname ?? null,
  );
  const previousEntityContextKeyRef = React.useRef<string | null>(
    entityContextKey,
  );
  const previousConversationStartCountRef = React.useRef(
    conversationStartCount,
  );

  useBloomShortcuts({
    containerRef,
    isMobileSidebarOpen: mobileSidebarOpen,
    onCloseMobileSidebar: () => setMobileSidebarOpen(false),
  });

  React.useEffect(() => {
    const nextPathname = pageContext?.pathname ?? null;
    if (previousPageContextPathnameRef.current === nextPathname) {
      return;
    }

    previousPageContextPathnameRef.current = nextPathname;
    setPageContextPriorityDismissed(false);
    setMobileSidebarOpen(false);
  }, [pageContext?.pathname]);

  React.useEffect(() => {
    if (previousEntityContextKeyRef.current === entityContextKey) {
      return;
    }

    previousEntityContextKeyRef.current = entityContextKey;
    setEntityContextBadgeDismissed(false);
  }, [entityContextKey]);

  React.useEffect(() => {
    if (previousConversationStartCountRef.current === conversationStartCount) {
      return;
    }

    previousConversationStartCountRef.current = conversationStartCount;
    setEntityContextBadgeDismissed(true);
    setPageContextPriorityDismissed(true);
  }, [conversationStartCount]);

  const outlet = (
    <ChunkErrorBoundary dashboardHref="/bloom" linkLabel="Back to Bloom">
      <React.Suspense
        fallback={
          <PageSkeleton variant={isUtilityRoute ? "dashboard" : "default"} />
        }
      >
        <Outlet
          context={
            {
              prioritizePageContext: pageContextPriorityActive,
            } satisfies BloomShellOutletContext
          }
        />
      </React.Suspense>
    </ChunkErrorBoundary>
  );

  return (
    <BloomMotionProvider>
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : "280px minmax(0, 1fr)",
          overflow: "hidden",
          backgroundColor: "neutral.50",
        }}
      >
        {!isMobile ? (
          <Sheet
            variant="solid"
            sx={{
              minWidth: 0,
              minHeight: 0,
              borderRight: "1px solid",
              borderColor: "brandNavy.700",
              backgroundColor: "brandNavy.800",
            }}
          >
            <BloomSidebar />
          </Sheet>
        ) : null}

        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "neutral.50",
          }}
        >
          <BloomHeader
            onDismissEntityContextBadge={() =>
              setEntityContextBadgeDismissed(true)
            }
            onDismissPageContextBadge={() =>
              setPageContextPriorityDismissed(true)
            }
            showSidebarButton={isMobile}
            showEntityContextBadge={showEntityContextBadge}
            showPageContextBadge={
              pageContextPriorityActive && !entityContextBadgeEligible
            }
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />
          {isUtilityRoute ? (
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                backgroundColor: "neutral.50",
              }}
            >
              {outlet}
            </Box>
          ) : (
            outlet
          )}
        </Box>

        <JoyDrawer
          anchor="left"
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          hideCloseButton
          size="sm"
          contentSx={{ p: 0, backgroundColor: "brandNavy.800" }}
          slotProps={{
            content: {
              sx: {
                width: { xs: "min(100vw, 320px)", sm: "320px" },
                backgroundColor: "brandNavy.800",
              },
            },
          }}
        >
          <BloomSidebar />
        </JoyDrawer>

        <BloomShortcutsPanel />
      </Box>
    </BloomMotionProvider>
  );
}

export function BloomShell() {
  return (
    <BloomProvider>
      <BloomShellContent />
    </BloomProvider>
  );
}
