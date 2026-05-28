import {
  createContext,
  lazy,
  Suspense,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { LocationBlockingBanner } from "@/components/location/LocationBlockingBanner";
import { DashboardSidebar } from "@/components/navigation/DashboardSidebar";
import {
  DashboardTopBar,
  DASHBOARD_TOPBAR_HEIGHT,
} from "@/components/navigation/DashboardTopBar";
import {
  resolveAdminDashboardContentWidth,
  resolveDashboardContentWidth,
  resolveDashboardNavigationTitle,
  type DashboardShellMode,
  type DashboardShellContentWidth,
} from "@/components/navigation/sidebarNavigation";
import { getStaticSearchItemForPathname } from "@/components/search/staticSearchRegistry";
import { SendingStatusBanner } from "@/components/sending-status/SendingStatusBanner";
import { TrialBanner } from "@/components/TrialBanner";
import ChunkErrorBoundary from "@/components/loading/ChunkErrorBoundary";
import { CommandPaletteErrorBoundary } from "@/components/search/CommandPaletteErrorBoundary";
import {
  recordRecentItem,
  recordRecentItemRemote,
} from "@/components/search/searchHistory";
import type { SearchOpenSource } from "@/components/search/searchAnalytics";
import { useAuth } from "@/contexts/AuthContext";
import { HelpWidget } from "@/components/ui/HelpWidget";
import {
  BLOOM_COMPACT_ACTIVATION_EVENT,
  type BloomCompactActivationRequest,
} from "@/hooks/bloom/useBloomCompactMode";
import useMediaQuery from "@/hooks/use-media-query";
import { useLocationBlockingGuard } from "@/hooks/useLocationBlockingGuard";

const LazyCommandPalette = lazy(() =>
  import("@/components/search/CommandPalette").then((module) => ({
    default: module.CommandPalette,
  })),
);

const SIDEBAR_EXPANDED_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_WIDTH_TRANSITION = "200ms cubic-bezier(0.4, 0, 0.2, 1)";

const getSidebarStorageKey = (mode: DashboardShellMode) =>
  `dashboard-shell:sidebar-collapsed:${mode}`;

const getStoredCollapsedPreference = (storageKey: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (raw === null) {
    return null;
  }

  return raw === "true";
};

const isTextEntryShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox']",
    ),
  );
};

export { resolveAdminDashboardContentWidth };

type DashboardShellContextValue = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSidebarCollapsed: boolean;
  isSidebarCollapseLocked: boolean;
  isMobileSidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  closeMobileSidebar: () => void;
};

const DashboardShellContext = createContext<DashboardShellContextValue | null>(
  null,
);

export const useDashboardShell = () => {
  const context = useContext(DashboardShellContext);

  if (!context) {
    throw new Error("useDashboardShell must be used within DashboardShell.");
  }

  return context;
};

interface DashboardShellProps {
  children: ReactNode;
  contentWidth?: DashboardShellContentWidth;
  mode?: DashboardShellMode;
  contentLayout?: "default" | "split";
  rightPanel?: ReactNode;
}

export function DashboardShell({
  children,
  contentLayout = "default",
  contentWidth,
  mode = "admin",
  rightPanel = null,
}: DashboardShellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const isTablet = useMediaQuery(
    "(min-width: 768px) and (max-width: 1023.95px)",
  );
  const storageKey = getSidebarStorageKey(mode);
  const storedPreferenceRef = useRef<boolean | null>(
    getStoredCollapsedPreference(storageKey),
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(
    storedPreferenceRef.current ?? false,
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteOpenSource, setCommandPaletteOpenSource] =
    useState<SearchOpenSource>("click");
  const [compactActivationRequest, setCompactActivationRequest] =
    useState<BloomCompactActivationRequest | null>(null);
  const [hasRequestedCommandPalette, setHasRequestedCommandPalette] =
    useState(false);
  const { isBlocked: isLocationBlocked, isLoading: isLocationLoading } =
    useLocationBlockingGuard();
  const activeTitle = useMemo(
    () => resolveDashboardNavigationTitle(pathname, mode),
    [mode, pathname],
  );
  const isBloomRoute = pathname.startsWith("/bloom");
  const resolvedContentWidth = useMemo(
    () => contentWidth ?? resolveDashboardContentWidth(pathname, mode),
    [contentWidth, mode, pathname],
  );
  const usesSplitContentLayout = contentLayout === "split";

  const openCommandPalette = useCallback(
    (source: SearchOpenSource = "click") => {
      setIsMobileSidebarOpen(false);
      setCommandPaletteOpenSource(source);
      setHasRequestedCommandPalette(true);
      setIsCommandPaletteOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (storedPreferenceRef.current !== null) {
      setIsSidebarCollapsed(storedPreferenceRef.current);
      return;
    }

    setIsSidebarCollapsed(isTablet);
  }, [isTablet]);

  useEffect(() => {
    const handleCompactActivationRequest = (event: Event) => {
      const request = (event as CustomEvent<BloomCompactActivationRequest>)
        .detail;

      if (!request) {
        return;
      }

      setCompactActivationRequest(request);
      openCommandPalette("click");
    };

    window.addEventListener(
      BLOOM_COMPACT_ACTIVATION_EVENT,
      handleCompactActivationRequest as EventListener,
    );

    return () => {
      window.removeEventListener(
        BLOOM_COMPACT_ACTIVATION_EVENT,
        handleCompactActivationRequest as EventListener,
      );
    };
  }, [openCommandPalette]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, String(isSidebarCollapsed));
    storedPreferenceRef.current = isSidebarCollapsed;
  }, [isSidebarCollapsed, storageKey]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setIsMobileSidebarOpen(false);
    setIsCommandPaletteOpen(false);

    const currentStaticItem = getStaticSearchItemForPathname(pathname);

    if (currentStaticItem) {
      recordRecentItem(user?.id, currentStaticItem);
      void recordRecentItemRemote(user?.id, currentStaticItem);
    }
  }, [pathname, user?.id]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      if (isTextEntryShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "k" && !event.shiftKey) {
        event.preventDefault();
        openCommandPalette("keyboard");
        return;
      }

      if (key !== "j") {
        return;
      }

      event.preventDefault();
      navigate(event.shiftKey ? "/bloom?new=true" : "/bloom");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate, openCommandPalette]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isBloomRoute) {
      return;
    }

    if (isMobile) {
      setIsMobileSidebarOpen((currentValue) => !currentValue);
      return;
    }

    setIsSidebarCollapsed((currentValue) => !currentValue);
  }, [isBloomRoute, isMobile]);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  const effectiveIsSidebarCollapsed = isBloomRoute || isSidebarCollapsed;
  const effectiveIsMobileSidebarOpen = isBloomRoute
    ? false
    : isMobileSidebarOpen;

  const sidebarWidth = isMobile
    ? SIDEBAR_EXPANDED_WIDTH
    : effectiveIsSidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH;

  const contextValue = useMemo<DashboardShellContextValue>(
    () => ({
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      isSidebarCollapsed: effectiveIsSidebarCollapsed,
      isSidebarCollapseLocked: isBloomRoute,
      isMobileSidebarOpen: effectiveIsMobileSidebarOpen,
      sidebarWidth,
      toggleSidebar,
      closeMobileSidebar,
    }),
    [
      closeMobileSidebar,
      effectiveIsMobileSidebarOpen,
      effectiveIsSidebarCollapsed,
      isBloomRoute,
      isMobile,
      isTablet,
      sidebarWidth,
      toggleSidebar,
    ],
  );

  return (
    <DashboardShellContext.Provider value={contextValue}>
      <Box
        data-testid="dashboard-shell-root"
        sx={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : `${sidebarWidth}px minmax(0, 1fr)`,
          gridTemplateRows: `${DASHBOARD_TOPBAR_HEIGHT}px minmax(0, 1fr)`,
          transition: `grid-template-columns ${SIDEBAR_WIDTH_TRANSITION}`,
          backgroundColor: "var(--joy-palette-sand-50)",
        }}
      >
        {!isMobile && <DashboardSidebarSlot mode={mode} />}
        <DashboardTopBar
          pageTitle={activeTitle}
          onOpenCommandPalette={openCommandPalette}
        />
        <Box
          component="main"
          ref={contentRef}
          data-testid="dashboard-shell-content"
          sx={{
            gridColumn: isMobile ? "1" : "2",
            gridRow: "2",
            minWidth: 0,
            minHeight: 0,
            overflowY: usesSplitContentLayout ? "hidden" : "auto",
            overflowX: "hidden",
            scrollBehavior: usesSplitContentLayout ? "auto" : "smooth",
            overscrollBehavior: "contain",
            backgroundColor: "var(--joy-palette-sand-50)",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--joy-palette-neutral-300) transparent",
            "&::-webkit-scrollbar": {
              width: "6px",
              height: "6px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "var(--joy-palette-neutral-300)",
              borderRadius: "999px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              backgroundColor: "var(--joy-palette-neutral-400)",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "transparent",
            },
          }}
        >
          {/*
           * Platform-wide sender-state banner. Lives OUTSIDE the
           * padded inner Box so `sticky top-0` pins it to the very
           * top of the main scroll viewport (which itself sits below
           * the DashboardTopBar grid row, so the banner is naturally
           * below the top nav). TrialBanner + LocationBlockingBanner
           * stay inside the padded Stack — they're not sticky and
           * benefit from the Stack's spacing rhythm.
           */}
          <SendingStatusBanner />
          <Box
            sx={{
              width: "100%",
              height: "100%",
              minHeight: "100%",
              px: isBloomRoute ? 0 : { xs: 4, md: 6 },
              py: isBloomRoute ? 0 : 8,
              mx: isBloomRoute ? 0 : "auto",
              maxWidth:
                isBloomRoute || resolvedContentWidth === "full"
                  ? "100%"
                  : "80rem",
            }}
          >
            <Stack
              spacing={isBloomRoute ? 0 : 6}
              sx={{ height: "100%", minHeight: "100%" }}
            >
              <TrialBanner />
              {!isLocationLoading && isLocationBlocked && (
                <LocationBlockingBanner />
              )}
              <Box
                sx={{
                  minWidth: 0,
                  height: "100%",
                  minHeight: 0,
                  flex: 1,
                  display: usesSplitContentLayout ? "flex" : "block",
                  flexDirection: "column",
                }}
              >
                {usesSplitContentLayout ? (
                  <Box
                    sx={{
                      display: "flex",
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        scrollBehavior: "smooth",
                        overscrollBehavior: "contain",
                        transition: "all 250ms ease",
                        scrollbarWidth: "thin",
                        scrollbarColor: "var(--joy-palette-neutral-300) transparent",
                        "&::-webkit-scrollbar": {
                          width: "6px",
                          height: "6px",
                        },
                        "&::-webkit-scrollbar-thumb": {
                          backgroundColor: "var(--joy-palette-neutral-300)",
                          borderRadius: "999px",
                        },
                        "&::-webkit-scrollbar-thumb:hover": {
                          backgroundColor: "var(--joy-palette-neutral-400)",
                        },
                        "&::-webkit-scrollbar-track": {
                          backgroundColor: "transparent",
                        },
                      }}
                    >
                      {children}
                    </Box>
                    {rightPanel}
                  </Box>
                ) : (
                  children
                )}
              </Box>
            </Stack>
          </Box>
        </Box>
        {isMobile && (
          <DashboardMobileSidebarBackdrop open={isMobileSidebarOpen} />
        )}
        {isMobile && <DashboardMobileSidebarSlot mode={mode} />}
      </Box>
      {hasRequestedCommandPalette ? (
        <ChunkErrorBoundary>
          <CommandPaletteErrorBoundary
            onClose={() => setIsCommandPaletteOpen(false)}
            open={isCommandPaletteOpen}
            resetKey={`${String(isCommandPaletteOpen)}:${pathname}`}
          >
            <Suspense
              fallback={
                isCommandPaletteOpen ? <CommandPaletteLoadingOverlay /> : null
              }
            >
              <LazyCommandPalette
                compactActivationRequest={compactActivationRequest}
                open={isCommandPaletteOpen}
                openSource={commandPaletteOpenSource}
                onClose={() => setIsCommandPaletteOpen(false)}
              />
            </Suspense>
          </CommandPaletteErrorBoundary>
        </ChunkErrorBoundary>
      ) : null}
      <HelpWidget />
    </DashboardShellContext.Provider>
  );
}

function CommandPaletteLoadingOverlay() {
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--joy-zIndex-modal)",
        display: "grid",
        placeItems: "start center",
        pt: { xs: "16px", md: "max(20vh, 72px)" },
        px: 2,
        backgroundColor: "rgba(15, 23, 42, 0.28)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Sheet
        variant="solid"
        sx={{
          width: "min(680px, calc(100vw - 16px))",
          py: 3,
          px: 3,
          borderRadius: "var(--joy-radius-lg)",
          boxShadow: "var(--joy-shadow-lg)",
          display: "grid",
          placeItems: "center",
          gap: 1,
          backgroundColor: "background.surface",
        }}
      >
        <CircularProgress size="sm" />
      </Sheet>
    </Box>
  );
}

function DashboardSidebarSlot({ mode }: { mode: DashboardShellMode }) {
  const { isSidebarCollapsed } = useDashboardShell();

  return (
    <Sheet
      component="aside"
      variant="solid"
      data-testid="dashboard-shell-sidebar"
      sx={{
        gridColumn: "1",
        gridRow: "1 / span 2",
        width: isSidebarCollapsed
          ? `${SIDEBAR_COLLAPSED_WIDTH}px`
          : `${SIDEBAR_EXPANDED_WIDTH}px`,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        backgroundColor: "var(--joy-palette-brandNavy-800)",
        color: "var(--joy-palette-common-white)",
        transition: `width ${SIDEBAR_WIDTH_TRANSITION}`,
        display: "flex",
        flexDirection: "column",
        zIndex: "var(--joy-zIndex-sidebar)",
      }}
    >
      <DashboardSidebar mode={mode} />
    </Sheet>
  );
}

function DashboardMobileSidebarBackdrop({ open }: { open: boolean }) {
  const { closeMobileSidebar } = useDashboardShell();

  return (
    <Box
      data-testid="dashboard-shell-backdrop"
      role="presentation"
      onClick={closeMobileSidebar}
      sx={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.44)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 200ms ease",
        zIndex: 29,
      }}
    />
  );
}

function DashboardMobileSidebarSlot({ mode }: { mode: DashboardShellMode }) {
  const { isMobileSidebarOpen } = useDashboardShell();

  return (
    <Sheet
      component="aside"
      variant="solid"
      data-testid="dashboard-shell-sidebar-mobile"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: `${SIDEBAR_EXPANDED_WIDTH}px`,
        maxWidth: "calc(100vw - 32px)",
        backgroundColor: "var(--joy-palette-brandNavy-800)",
        color: "var(--joy-palette-common-white)",
        transform: isMobileSidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 200ms ease",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--joy-shadow-lg)",
      }}
    >
      <DashboardSidebar mobile mode={mode} />
    </Sheet>
  );
}
