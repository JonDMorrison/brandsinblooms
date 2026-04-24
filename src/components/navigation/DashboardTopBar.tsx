import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Avatar from "@mui/joy/Avatar";
import Badge from "@mui/joy/Badge";
import Box from "@mui/joy/Box";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Bell,
  Bug,
  CheckCircle2,
  ChevronDown,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  Search,
  Settings,
  TriangleAlert,
  UserCircle2,
  X,
} from "lucide-react";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { ReportProblemDialog } from "@/components/reportProblem/ReportProblemDialog";
import { useDashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/contexts/AuthContext";
import { signOutCompletely } from "@/integrations/supabase/client";

export const DASHBOARD_TOPBAR_HEIGHT = 56;

const notificationItems = [
  {
    id: "newsletter-ready",
    title: "Newsletter ready to review",
    description: "Your April campaign draft finished processing.",
    timestamp: "2m ago",
    icon: Megaphone,
  },
  {
    id: "analytics-sync",
    title: "Analytics sync completed",
    description: "Yesterday's store metrics are now available.",
    timestamp: "18m ago",
    icon: CheckCircle2,
  },
  {
    id: "problem-reply",
    title: "Problem report updated",
    description: "Support replied to your most recent ticket.",
    timestamp: "1h ago",
    icon: TriangleAlert,
  },
] as const;

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
  minHeight: 36,
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
  onSearch?: (query: string) => void;
}

export function DashboardTopBar({ pageTitle, onSearch }: DashboardTopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const { isMobile, isMobileSidebarOpen, toggleSidebar } = useDashboardShell();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDesktopSearchFocused, setIsDesktopSearchFocused] = useState(false);
  const [isReportProblemOpen, setIsReportProblemOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  useEffect(() => {
    if (!isMobile || isMobileSidebarOpen) {
      setIsMobileSearchOpen(false);
    }
  }, [isMobile, isMobileSidebarOpen]);

  useEffect(() => {
    setIsMobileSearchOpen(false);
  }, [pathname]);

  const handleSearchChange = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    onSearch?.(nextQuery);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && isMobileSearchOpen) {
      setIsMobileSearchOpen(false);
    }
  };

  const handleLogout = async () => {
    setIsSigningOut(true);

    try {
      await signOutCompletely();
    } finally {
      setIsSigningOut(false);
    }
  };

  const renderSearchInput = (fullWidth = false) => (
    <JoySearchInput
      appearance="topbar"
      value={searchQuery}
      onValueChange={handleSearchChange}
      clearable={false}
      placeholder="Search something..."
      size="sm"
      slotProps={{
        input: {
          "aria-label": "Search something...",
          autoComplete: "off",
          autoFocus: isMobile && isMobileSearchOpen,
          onKeyDown: handleSearchKeyDown,
          onFocus: () => {
            if (!isMobile && !fullWidth) {
              setIsDesktopSearchFocused(true);
            }
          },
          onBlur: () => {
            if (!isMobile && !fullWidth) {
              setIsDesktopSearchFocused(false);
            }
          },
        },
      }}
      sx={{
        width: fullWidth
          ? "100%"
          : isMobile
            ? "100%"
            : isDesktopSearchFocused
              ? "22.5rem"
              : "17.5rem",
        minWidth: 0,
        maxWidth: "100%",
        transition: "width 200ms ease",
        "--Input-paddingInline": "14px",
        "--Input-gap": "10px",
      }}
    />
  );

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
          {isMobile && isMobileSearchOpen && (
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                position: "absolute",
                inset: 0,
                px: 4,
                backgroundColor: "background.surface",
                zIndex: 2,
              }}
            >
              {renderSearchInput(true)}
              <IconButton
                aria-label="Close search"
                color="neutral"
                size="sm"
                variant="plain"
                onClick={() => setIsMobileSearchOpen(false)}
                sx={iconButtonSx}
              >
                <X size={18} strokeWidth={2} />
              </IconButton>
            </Stack>
          )}

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
                    isMobileSidebarOpen ? "Close sidebar" : "Open sidebar"
                  }
                  color="neutral"
                  size="sm"
                  variant="plain"
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
                  aria-label="Open search"
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={() => setIsMobileSearchOpen(true)}
                  sx={iconButtonSx}
                >
                  <Search size={18} strokeWidth={1.9} />
                </IconButton>
              ) : (
                renderSearchInput()
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
              <Dropdown>
                <MenuButton
                  slots={{ root: IconButton }}
                  slotProps={{
                    root: {
                      "aria-label": "Open notifications",
                      color: "neutral",
                      size: "sm",
                      variant: "plain",
                      sx: iconButtonSx,
                    },
                  }}
                >
                  <Badge
                    badgeContent={notificationItems.length}
                    color="danger"
                    size="sm"
                    variant="solid"
                    slotProps={{
                      badge: {
                        sx: {
                          minWidth: 16,
                          height: 16,
                          px: 0.5,
                          fontSize: "10px",
                          fontWeight: 700,
                          boxShadow:
                            "0 0 0 2px var(--joy-palette-background-surface)",
                        },
                      },
                    }}
                  >
                    <Bell size={20} strokeWidth={1.9} />
                  </Badge>
                </MenuButton>
                <Menu
                  placement="bottom-end"
                  size="sm"
                  variant="plain"
                  sx={{ ...menuSx, minWidth: 320 }}
                >
                  <Typography
                    level="title-sm"
                    sx={{
                      px: 1.25,
                      pt: 0.5,
                      pb: 1,
                      color: "neutral.800",
                      fontWeight: 600,
                    }}
                  >
                    Notifications
                  </Typography>
                  {notificationItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <MenuItem
                        key={item.id}
                        sx={{ ...menuItemSx, alignItems: "flex-start" }}
                      >
                        <ListItemDecorator
                          sx={{
                            minInlineSize: 24,
                            mt: 0.125,
                            color: "neutral.500",
                          }}
                        >
                          <Icon size={18} strokeWidth={1.9} />
                        </ListItemDecorator>
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography
                            level="body-sm"
                            sx={{
                              color: "neutral.800",
                              fontWeight: 600,
                            }}
                          >
                            {item.title}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.600" }}
                          >
                            {item.description}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            {item.timestamp}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </Menu>
              </Dropdown>

              <Dropdown>
                <MenuButton
                  aria-label="Open user menu"
                  color="neutral"
                  size="sm"
                  variant="plain"
                  sx={{
                    minHeight: 32,
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

      <ReportProblemDialog
        open={isReportProblemOpen}
        onOpenChange={setIsReportProblemOpen}
      />
    </>
  );
}
