import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BugReportRounded from "@mui/icons-material/BugReportRounded";
import CampaignRounded from "@mui/icons-material/CampaignRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import Avatar from "@mui/joy/Avatar";
import Badge from "@mui/joy/Badge";
import Box from "@mui/joy/Box";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ReportProblemDialog } from "@/components/reportProblem/ReportProblemDialog";
import { useDashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/contexts/AuthContext";
import { signOutCompletely } from "@/integrations/supabase/client";

export const DASHBOARD_TOPBAR_HEIGHT = 64;

const notificationItems = [
  {
    id: "newsletter-ready",
    title: "Newsletter ready to review",
    description: "Your April campaign draft finished processing.",
    timestamp: "2m ago",
    icon: CampaignRounded,
  },
  {
    id: "analytics-sync",
    title: "Analytics sync completed",
    description: "Yesterday's store metrics are now available.",
    timestamp: "18m ago",
    icon: CheckCircleRounded,
  },
  {
    id: "problem-reply",
    title: "Problem report updated",
    description: "Support replied to your most recent ticket.",
    timestamp: "1h ago",
    icon: WarningAmberRounded,
  },
] as const;

const iconButtonSx = {
  borderRadius: "12px",
  color: "var(--joy-palette-brandNavy-700)",
  bgcolor: "transparent",
  transition: "background-color 160ms ease, color 160ms ease",
  "&:hover": {
    bgcolor: "var(--joy-palette-neutral-100)",
    color: "var(--joy-palette-brandNavy-800)",
  },
  "&:focus-visible": {
    outline: "2px solid var(--joy-palette-primary-500)",
    outlineOffset: 2,
  },
} as const;

const menuSx = {
  mt: 1,
  p: 0.75,
  gap: 0.5,
  borderRadius: "16px",
  borderColor: "var(--joy-palette-neutral-200)",
  boxShadow: "var(--joy-shadow-lg)",
  bgcolor: "#FFFFFF",
  zIndex: "var(--joy-zIndex-popup)",
  "--List-padding": "0px",
} as const;

const menuItemSx = {
  minHeight: 44,
  borderRadius: "12px",
  px: 1.25,
  py: 1,
  gap: 1.25,
  "&:focus-visible": {
    outline: "2px solid var(--joy-palette-primary-500)",
    outlineOffset: -2,
  },
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

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;

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
    <Input
      value={searchQuery}
      onChange={handleSearchChange}
      placeholder="Search something..."
      startDecorator={<SearchRounded fontSize="small" />}
      size="sm"
      slotProps={{
        input: {
          "aria-label": "Search something...",
          autoComplete: "off",
          autoFocus: isMobile && isMobileSearchOpen,
          onKeyDown: handleSearchKeyDown,
        },
      }}
      sx={{
        width: fullWidth ? "100%" : isMobile ? "100%" : "19rem",
        minWidth: 0,
        borderRadius: "14px",
        bgcolor: "var(--joy-palette-neutral-100)",
        borderColor: "var(--joy-palette-neutral-200)",
        boxShadow: "none",
        "--Input-paddingInline": "14px",
        "--Input-gap": "10px",
        "&:hover": {
          bgcolor: "#FFFFFF",
          borderColor: "var(--joy-palette-neutral-300)",
        },
        "&:focus-within": {
          bgcolor: "#FFFFFF",
          borderColor: "var(--joy-palette-primary-500)",
          boxShadow: "0 0 0 3px rgba(104, 190, 185, 0.18)",
        },
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
          backgroundColor: "#FFFFFF",
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
                px: 2,
                backgroundColor: "#FFFFFF",
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
                <CloseRounded fontSize="small" />
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
              px: isMobile ? 2 : 3,
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
                    <CloseRounded fontSize="small" />
                  ) : (
                    <MenuRounded fontSize="small" />
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
                  <SearchRounded fontSize="small" />
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
                    color: "var(--joy-palette-brandNavy-800)",
                    fontWeight: "lg",
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
                  >
                    <NotificationsRounded fontSize="small" />
                  </Badge>
                </MenuButton>
                <Menu
                  placement="bottom-end"
                  size="sm"
                  variant="outlined"
                  sx={{ ...menuSx, minWidth: 320 }}
                >
                  <Typography
                    level="title-sm"
                    sx={{
                      px: 1.25,
                      pt: 0.5,
                      pb: 1,
                      color: "var(--joy-palette-brandNavy-800)",
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
                            minInlineSize: 30,
                            mt: 0.125,
                            color: "var(--joy-palette-brandNavy-600)",
                          }}
                        >
                          <Icon fontSize="small" />
                        </ListItemDecorator>
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography
                            level="body-sm"
                            sx={{
                              color: "var(--joy-palette-brandNavy-800)",
                              fontWeight: 600,
                            }}
                          >
                            {item.title}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "var(--joy-palette-neutral-700)" }}
                          >
                            {item.description}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "var(--joy-palette-neutral-500)" }}
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
                    minHeight: 44,
                    px: isMobile ? 0.5 : 1,
                    borderRadius: "999px",
                    bgcolor: "transparent",
                    gap: 1,
                    color: "var(--joy-palette-brandNavy-800)",
                    transition: "background-color 160ms ease, color 160ms ease",
                    "&:hover": {
                      bgcolor: "var(--joy-palette-neutral-100)",
                    },
                    "&:focus-visible": {
                      outline: "2px solid var(--joy-palette-primary-500)",
                      outlineOffset: 2,
                    },
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
                        bgcolor: "var(--joy-palette-primary-500)",
                        color: "var(--joy-palette-brandNavy-800)",
                        fontWeight: 700,
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
                          fontWeight: 600,
                          color: "var(--joy-palette-brandNavy-800)",
                        }}
                      >
                        {displayName}
                      </Typography>
                    )}
                  </Stack>
                </MenuButton>
                <Menu
                  placement="bottom-end"
                  size="sm"
                  variant="outlined"
                  sx={{ ...menuSx, minWidth: 240 }}
                >
                  <Box sx={{ px: 1.25, pt: 0.5, pb: 1 }}>
                    <Typography
                      level="title-sm"
                      sx={{ color: "var(--joy-palette-brandNavy-800)" }}
                    >
                      {displayName}
                    </Typography>
                    <Typography
                      level="body-xs"
                      sx={{ color: "var(--joy-palette-neutral-600)" }}
                    >
                      {user?.email ??
                        (loading ? "Loading profile..." : "Signed in")}
                    </Typography>
                  </Box>
                  <MenuItem
                    onClick={() => navigate("/profile")}
                    sx={menuItemSx}
                  >
                    <ListItemDecorator
                      sx={{ color: "var(--joy-palette-brandNavy-600)" }}
                    >
                      <PersonRounded fontSize="small" />
                    </ListItemDecorator>
                    Profile
                  </MenuItem>
                  <MenuItem
                    onClick={() => navigate("/settings")}
                    sx={menuItemSx}
                  >
                    <ListItemDecorator
                      sx={{ color: "var(--joy-palette-brandNavy-600)" }}
                    >
                      <SettingsRounded fontSize="small" />
                    </ListItemDecorator>
                    Settings
                  </MenuItem>
                  <MenuItem
                    onClick={() => setIsReportProblemOpen(true)}
                    sx={menuItemSx}
                  >
                    <ListItemDecorator
                      sx={{ color: "var(--joy-palette-brandNavy-600)" }}
                    >
                      <BugReportRounded fontSize="small" />
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
                      <LogoutRounded fontSize="small" />
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
