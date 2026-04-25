import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
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
import { TrialBanner } from "@/components/TrialBanner";
import { HelpWidget } from "@/components/ui/HelpWidget";
import { useLocationBlockingGuard } from "@/hooks/useLocationBlockingGuard";

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

export { resolveAdminDashboardContentWidth };

type DashboardShellContextValue = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSidebarCollapsed: boolean;
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
}

export function DashboardShell({
  children,
  contentWidth,
  mode = "admin",
}: DashboardShellProps) {
  const { pathname } = useLocation();
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
  const { isBlocked: isLocationBlocked, isLoading: isLocationLoading } =
    useLocationBlockingGuard();
  const activeTitle = useMemo(
    () => resolveDashboardNavigationTitle(pathname, mode),
    [mode, pathname],
  );
  const resolvedContentWidth = useMemo(
    () => contentWidth ?? resolveDashboardContentWidth(pathname, mode),
    [contentWidth, mode, pathname],
  );

  useEffect(() => {
    if (storedPreferenceRef.current !== null) {
      setIsSidebarCollapsed(storedPreferenceRef.current);
      return;
    }

    setIsSidebarCollapsed(isTablet);
  }, [isTablet]);

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
  }, [pathname]);

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

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileSidebarOpen((currentValue) => !currentValue);
      return;
    }

    setIsSidebarCollapsed((currentValue) => !currentValue);
  };

  const sidebarWidth = isMobile
    ? SIDEBAR_EXPANDED_WIDTH
    : isSidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH;

  const contextValue = useMemo<DashboardShellContextValue>(
    () => ({
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      isSidebarCollapsed,
      isMobileSidebarOpen,
      sidebarWidth,
      toggleSidebar,
      closeMobileSidebar: () => setIsMobileSidebarOpen(false),
    }),
    [isMobile, isTablet, isSidebarCollapsed, isMobileSidebarOpen, sidebarWidth],
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
        <DashboardTopBar pageTitle={activeTitle} />
        <Box
          component="main"
          ref={contentRef}
          data-testid="dashboard-shell-content"
          sx={{
            gridColumn: isMobile ? "1" : "2",
            gridRow: "2",
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            scrollBehavior: "smooth",
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
          <Box
            sx={{
              width: "100%",
              height: "100%",
              minHeight: "100%",
              px: { xs: 4, md: 6 },
              py: 8,
              mx: "auto",
              maxWidth: resolvedContentWidth === "contained" ? "80rem" : "100%",
            }}
          >
            <Stack spacing={6} sx={{ height: "100%", minHeight: "100%" }}>
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
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {children}
              </Box>
            </Stack>
          </Box>
        </Box>
        {isMobile && (
          <DashboardMobileSidebarBackdrop open={isMobileSidebarOpen} />
        )}
        {isMobile && <DashboardMobileSidebarSlot mode={mode} />}
      </Box>
      <HelpWidget />
    </DashboardShellContext.Provider>
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
