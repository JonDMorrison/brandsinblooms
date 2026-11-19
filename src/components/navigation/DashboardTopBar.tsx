import { KeyboardEvent, Suspense, lazy, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  AppWindow,
  Bug,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu as MenuIcon,
  MessageSquareText,
  Search,
  Settings,
  Sparkles,
  UserCircle2,
  X,
} from "lucide-react";
import { useDashboardShell } from "@/components/layout/DashboardShell";
import { useOptionalAskBloom } from "@/providers/AskBloomProvider";
import type { SearchOpenSource } from "@/components/search/searchAnalytics";
import { useAuth } from "@/contexts/AuthContext";
import { ReportProblemDialog } from "@/components/bloomSupport/ReportProblemDialog";
import { signOutCompletely, supabase } from "@/integrations/supabase/client";
import {
  bloomsuiteAccountUrl,
  isBloomsuiteSession,
  reportSession,
  sessionIdFromAccessToken,
} from "@/integrations/bloomsuite/session";
import { useBloomsuiteApps } from "@/integrations/bloomsuite/useBloomsuiteApps";

const LazyReportProblemDialog = lazy(() =>
  import("@/components/reportProblem/ReportProblemDialog").then((module) => ({
    default: module.ReportProblemDialog,
  })),
);

export const DASHBOARD_TOPBAR_HEIGHT = 56;

const focusRingSx = {
  outline: 0,
  boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
} as const;

const iconButtonSx = {
  width: 32,
  height: 32,
  minWidth: 32,
  minHeight: 32,
  borderRadius: "999px",
  color: "neutral.500",
  bgcolor: "transparent",
  transition:
    "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 100ms ease",
  "&:hover": {
    bgcolor: "neutral.100",
    color: "neutral.700",
  },
  "&:active": {
    transform: "scale(0.98)",
  },
  "&.Mui-focusVisible, &:focus-visible": focusRingSx,
} as const;

const menuSx = {
  mt: 1,
  p: 0.5,
  gap: 0.5,
  borderRadius: "16px",
  borderColor: "neutral.200",
  boxShadow: "var(--joy-shadow-lg)",
  bgcolor: "background.popup",
  zIndex: "var(--joy-zIndex-popup)",
  "--List-padding": "0px",
} as const;

const menuItemSx = {
  minHeight: 44,
  borderRadius: "12px",
  px: 1.25,
  py: 0.75,
  gap: 1.25,
  fontSize: "13px",
  fontWeight: 500,
  color: "neutral.700",
  transition:
    "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 100ms ease",
  "&:hover": {
    bgcolor: "neutral.100",
  },
  "&.Mui-focusVisible, &:focus-visible": focusRingSx,
} as const;

const resolveUserDisplayName = (
  fullName: string | undefined,
  email: string | undefined,
) => {
  if (fullName?.trim()) {
    return fullName.trim();
  }

  if (email?.trim()) {
    return email.split("@")[0] ?? email;
  }

  return "BloomSuite";
};

const resolveInitials = (displayName: string) => {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "BS";
};

interface DashboardTopBarProps {
  pageTitle?: string;
  onOpenCommandPalette?: (source: SearchOpenSource) => void;
}

const getCommandPaletteShortcutLabel = () => {
  if (typeof navigator === "undefined") {
    return "Ctrl K";
  }

  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? "⌘K" : "Ctrl K";
};

const getAskBloomToggleShortcutLabel = () => {
  if (typeof navigator === "undefined") {
    return "Ctrl+Shift+B";
  }

  const platform = `${navigator.platform} ${navigator.userAgent}`;
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘⇧B" : "Ctrl+Shift+B";
};

export function DashboardTopBar({
  pageTitle,
  onOpenCommandPalette,
}: DashboardTopBarProps) {
  const navigate = useNavigate();
  const askBloom = useOptionalAskBloom();
  const { user, session, loading } = useAuth();
  // "Get help" goes to Bloom Support (shared with BloomSites and POS) instead of the Jira collector.
  const [reportOpen, setReportOpen] = useState(false);
  const {
    isMobile,
    isMobileSidebarOpen,
    isSidebarCollapseLocked,
    toggleSidebar,
  } = useDashboardShell();
  const [isReportProblemOpen, setIsReportProblemOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // BloomSuite central login: a linked session gets the BloomSuite account link and the app switcher.
  const isLinked = isBloomsuiteSession(session);
  const bloomsuiteAccountHref = isLinked ? bloomsuiteAccountUrl() : null;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const bloomsuiteApps = useBloomsuiteApps(
    isLinked && isUserMenuOpen,
    session ? sessionIdFromAccessToken(session.access_token) : null,
  );
  const otherApps = bloomsuiteApps.apps.filter((app) => app.id !== "crm" && app.home_url);

  const fullName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;
  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : undefined;
  const displayName = useMemo(
    () => resolveUserDisplayName(fullName, user?.email),
    [fullName, user?.email],
  );
  const userInitials = useMemo(
    () => resolveInitials(displayName),
    [displayName],
  );
  const showCenteredTitle = Boolean(pageTitle && !isMobile);
  const commandPaletteShortcutLabel = useMemo(
    () => getCommandPaletteShortcutLabel(),
    [],
  );
  const askBloomToggleShortcutLabel = useMemo(
    () => getAskBloomToggleShortcutLabel(),
    [],
  );

  const openCommandPalette = () => {
    onOpenCommandPalette?.("click");
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenCommandPalette?.("keyboard");
    }
  };

  const handleLogout = async () => {
    setIsSigningOut(true);

    try {
      // This device only; a BloomSuite session tells BloomSuite ID first, while it can still sign the report.
      if (isLinked) await reportSession(supabase, "sign_out");
      await signOutCompletely();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <Sheet
        component="header"
        variant="plain"
        data-testid="dashboard-shell-topbar"
        sx={{
          gridColumn: isMobile ? "1" : "2",
          gridRow: "1",
          minWidth: 0,
          height: `${DASHBOARD_TOPBAR_HEIGHT}px`,
          borderBottom: "1px solid var(--joy-palette-neutral-200)",
          backgroundColor: "background.surface",
          zIndex: "var(--joy-zIndex-header)",
        }}
      >
        <Box sx={{ position: "relative", height: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: showCenteredTitle
                ? "minmax(0, 1fr) auto minmax(0, 1fr)"
                : "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 2,
              height: "100%",
              px: isMobile ? 4 : 6,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ minWidth: 0 }}
            >
              {isMobile && (
                <IconButton
                  aria-label={
                    isSidebarCollapseLocked
                      ? "Sidebar locked while Bloom is open"
                      : isMobileSidebarOpen
                        ? "Close sidebar"
                        : "Open sidebar"
                  }
                  color="neutral"
                  size="sm"
                  variant="plain"
                  disabled={isSidebarCollapseLocked}
                  onClick={toggleSidebar}
                  sx={iconButtonSx}
                >
                  {isMobileSidebarOpen ? (
                    <X size={18} strokeWidth={2} />
                  ) : (
                    <MenuIcon size={18} strokeWidth={2} />
                  )}
                </IconButton>
              )}

              {isMobile ? (
                <IconButton
                  aria-label="Open command palette"
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={openCommandPalette}
                  sx={iconButtonSx}
                >
                  <Search size={18} strokeWidth={1.9} />
                </IconButton>
              ) : (
                <Input
                  size="sm"
                  onClick={openCommandPalette}
                  placeholder="Search customers, campaigns, settings…"
                  readOnly
                  startDecorator={<Search size={18} strokeWidth={1.9} />}
                  endDecorator={
                    <Chip
                      size="sm"
                      variant="outlined"
                      sx={{
                        display: { xs: "none", md: "inline-flex" },
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "neutral.600",
                        pointerEvents: "none",
                      }}
                    >
                      {commandPaletteShortcutLabel}
                    </Chip>
                  }
                  slotProps={{
                    input: {
                      "aria-label": "Open command palette",
                      onKeyDown: handleTriggerKeyDown,
                      readOnly: true,
                    },
                  }}
                  sx={{
                    width: "17.5rem",
                    minWidth: 0,
                    maxWidth: "100%",
                    cursor: "pointer",
                    borderRadius: "var(--joy-radius-lg)",
                    borderColor: "transparent",
                    backgroundColor: "neutral.100",
                    "--Input-paddingInline": "14px",
                    "--Input-gap": "10px",
                    transition:
                      "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
                    "&:hover": {
                      backgroundColor: "neutral.50",
                    },
                    "&:focus-within": {
                      borderColor: "primary.400",
                      boxShadow:
                        "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
                    },
                    "& .MuiInput-input": {
                      fontSize: "14px",
                      cursor: "pointer",
                    },
                  }}
                />
              )}
            </Stack>

            {showCenteredTitle && (
              <Box sx={{ minWidth: 0, px: 1, textAlign: "center" }}>
                <Typography
                  level="title-md"
                  noWrap
                  sx={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "neutral.700",
                  }}
                >
                  {pageTitle}
                </Typography>
              </Box>
            )}

            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{ minWidth: 0, justifySelf: "end" }}
            >
              {askBloom ? (
                <Tooltip
                  arrow
                  placement="bottom"
                  title={`Toggle AI panel (${askBloomToggleShortcutLabel})`}
                >
                  <Button
                    variant="plain"
                    color="neutral"
                    size="sm"
                    startDecorator={<Sparkles size={16} />}
                    onClick={() => {
                      if (askBloom.state.isOpen) {
                        askBloom.close();
                        return;
                      }

                      askBloom.openGeneral();
                    }}
                    sx={{
                      minHeight: 32,
                      border: 0,
                      borderRadius: "999px",
                      fontWeight: 500,
                      fontSize: "13px",
                      px: 1.5,
                      py: 0.5,
                      color: askBloom.state.isOpen
                        ? "neutral.900"
                        : "text.secondary",
                      bgcolor: askBloom.state.isOpen
                        ? "neutral.100"
                        : "transparent",
                      boxShadow: askBloom.state.isOpen
                        ? "inset 0 1px 2px rgba(var(--joy-palette-neutral-mainChannel) / 0.18)"
                        : "none",
                      transition:
                        "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 100ms ease",
                      "&:hover": {
                        bgcolor: askBloom.state.isOpen
                          ? "neutral.100"
                          : "neutral.100",
                        color: askBloom.state.isOpen
                          ? "neutral.900"
                          : "neutral.800",
                      },
                      "&:active": {
                        transform: "scale(0.98)",
                      },
                      "&.Mui-focusVisible, &:focus-visible": focusRingSx,
                    }}
                  >
                    Ask Bloom
                  </Button>
                </Tooltip>
              ) : null}
              <Tooltip arrow placement="bottom" title="Get help or report a problem">
                <IconButton
                  aria-label="Get help or report a problem"
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={() => setReportOpen(true)}
                  sx={iconButtonSx}
                >
                  <MessageSquareText size={18} strokeWidth={1.9} />
                </IconButton>
              </Tooltip>
              <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
              <Dropdown open={isUserMenuOpen} onOpenChange={(_event, open) => setIsUserMenuOpen(open)}>
                <MenuButton
                  aria-label="Open user menu"
                  color="neutral"
                  size="sm"
                  variant="plain"
                  sx={{
                    minHeight: 44,
                    px: isMobile ? 0.5 : 1,
                    borderRadius: "999px",
                    bgcolor: "transparent",
                    gap: 0.75,
                    color: "neutral.700",
                    transition:
                      "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 100ms ease",
                    "&:hover": {
                      bgcolor: "neutral.50",
                    },
                    "&:active": {
                      transform: "scale(0.98)",
                    },
                    "&.Mui-focusVisible, &:focus-visible": focusRingSx,
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ minWidth: 0 }}
                  >
                    <Avatar
                      size="sm"
                      src={avatarUrl}
                      alt={displayName}
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: "primary.600",
                        color: "common.white",
                        fontWeight: 600,
                        "& img": {
                          objectFit: "cover",
                        },
                      }}
                    >
                      {userInitials}
                    </Avatar>
                    {!isMobile && (
                      <Typography
                        level="body-sm"
                        noWrap
                        sx={{
                          maxWidth: 160,
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "neutral.700",
                        }}
                      >
                        {displayName}
                      </Typography>
                    )}
                    {!isMobile && (
                      <ChevronDown
                        size={12}
                        strokeWidth={2}
                        color="var(--joy-palette-neutral-400)"
                      />
                    )}
                  </Stack>
                </MenuButton>
                <Menu
                  placement="bottom-end"
                  size="sm"
                  variant="plain"
                  sx={{ ...menuSx, minWidth: 240 }}
                >
                  <Box sx={{ px: 1.25, pt: 0.5, pb: 1 }}>
                    <Typography
                      level="title-sm"
                      sx={{ color: "neutral.800", fontWeight: 600 }}
                    >
                      {displayName}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      {user?.email ??
                        (loading ? "Loading profile..." : "Signed in")}
                    </Typography>
                  </Box>
                  {bloomsuiteAccountHref ? (
                    <MenuItem component="a" href={bloomsuiteAccountHref} sx={menuItemSx}>
                      <ListItemDecorator sx={{ color: "currentColor" }}>
                        <ExternalLink size={16} strokeWidth={1.9} />
                      </ListItemDecorator>
                      Manage your BloomSuite account
                    </MenuItem>
                  ) : null}
                  {isLinked ? (
                    <Box role="group" aria-label="Your BloomSuite apps" sx={{ px: 0.25 }}>
                      <Typography level="body-xs" sx={{ px: 1, pt: 0.75, pb: 0.25, color: "text.tertiary" }}>
                        Your BloomSuite apps
                      </Typography>
                      {bloomsuiteApps.status === "loading" || bloomsuiteApps.status === "idle" ? (
                        <MenuItem disabled sx={menuItemSx}>Loading your apps…</MenuItem>
                      ) : bloomsuiteApps.status === "error" ? (
                        <MenuItem disabled sx={menuItemSx}>Your apps couldn't load</MenuItem>
                      ) : otherApps.length === 0 ? (
                        <MenuItem disabled sx={menuItemSx}>No other BloomSuite apps yet</MenuItem>
                      ) : (
                        otherApps.map((app) => (
                          <MenuItem key={app.id} component="a" href={app.home_url ?? undefined} sx={menuItemSx}>
                            <ListItemDecorator sx={{ color: "currentColor" }}>
                              <AppWindow size={16} strokeWidth={1.9} />
                            </ListItemDecorator>
                            Open {app.name}
                          </MenuItem>
                        ))
                      )}
                    </Box>
                  ) : null}
                  <MenuItem onClick={() => navigate("/suite")} sx={menuItemSx}>BloomSuite products</MenuItem>
                  <MenuItem
                    onClick={() => navigate("/profile")}
                    sx={menuItemSx}
                  >
                    <ListItemDecorator sx={{ color: "currentColor" }}>
                      <UserCircle2 size={16} strokeWidth={1.9} />
                    </ListItemDecorator>
                    Profile
                  </MenuItem>
                  <MenuItem
                    onClick={() => navigate("/settings")}
                    sx={menuItemSx}
                  >
                    <ListItemDecorator sx={{ color: "currentColor" }}>
                      <Settings size={16} strokeWidth={1.9} />
                    </ListItemDecorator>
                    Settings
                  </MenuItem>
                  <MenuItem
                    onClick={() => setIsReportProblemOpen(true)}
                    sx={menuItemSx}
                  >
                    <ListItemDecorator sx={{ color: "currentColor" }}>
                      <Bug size={16} strokeWidth={1.9} />
                    </ListItemDecorator>
                    Report a Problem
                  </MenuItem>
                  <MenuItem
                    color="danger"
                    disabled={isSigningOut}
                    onClick={handleLogout}
                    sx={menuItemSx}
                  >
                    <ListItemDecorator sx={{ color: "currentColor" }}>
                      <LogOut size={16} strokeWidth={1.9} />
                    </ListItemDecorator>
                    {isSigningOut ? "Logging Out..." : "Log Out"}
                  </MenuItem>
                </Menu>
              </Dropdown>
            </Stack>
          </Box>
        </Box>
      </Sheet>

      {isReportProblemOpen ? (
        <Suspense fallback={null}>
          <LazyReportProblemDialog
            open={isReportProblemOpen}
            onOpenChange={setIsReportProblemOpen}
          />
        </Suspense>
      ) : null}
    </>
  );
}

