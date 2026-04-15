import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { ChevronDown, ChevronLeft, ChevronRight, LifeBuoy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useDashboardShell } from "@/components/layout/DashboardShell";
import logoImage from "@/assets/bloomsuite-logo-correct.png";
import {
  getActiveBranchIds,
  getDashboardSidebarGroups,
  isDashboardSidebarItemActive,
  matchesNavigationPatterns,
  type DashboardShellMode,
  type DashboardSidebarBranchItem,
  type DashboardSidebarGroup,
  type DashboardSidebarItem,
  type DashboardSidebarLinkItem,
} from "@/components/navigation/sidebarNavigation";

const EXPANDED_BRANCHES_STORAGE_KEY = "dashboard-sidebar:expanded-branches";

const collapsedContentSx = {
  opacity: 0,
  transform: "translateX(-8px)",
  maxWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  transition: "opacity 200ms ease, transform 200ms ease, max-width 200ms ease",
};

const expandedContentSx = {
  opacity: 1,
  transform: "translateX(0)",
  maxWidth: 220,
  overflow: "hidden",
  whiteSpace: "nowrap",
  transition: "opacity 200ms ease, transform 200ms ease, max-width 200ms ease",
};

const getStoredExpandedBranches = () => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  const rawValue = window.sessionStorage.getItem(EXPANDED_BRANCHES_STORAGE_KEY);

  if (!rawValue) {
    return [] as string[];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  } catch {
    return [] as string[];
  }
};

const getUserDisplayName = (
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

const getInitials = (value: string) => {
  const parts = value.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");

  return initials || "BS";
};

const moveFocusWithinScope = (
  event: KeyboardEvent<HTMLElement>,
  scopeId: string,
) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }

  const currentTarget = event.currentTarget as HTMLElement;
  const focusScope = currentTarget.closest<HTMLElement>(
    `[data-dashboard-sidebar-focus-scope="${scopeId}"]`,
  );

  if (!focusScope) {
    return;
  }

  const focusableElements = Array.from(
    focusScope.querySelectorAll<HTMLElement>(
      '[data-dashboard-sidebar-focusable="true"]',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));

  const currentIndex = focusableElements.indexOf(currentTarget);

  if (currentIndex === -1) {
    return;
  }

  event.preventDefault();
  const direction = event.key === "ArrowDown" ? 1 : -1;
  const targetIndex =
    (currentIndex + direction + focusableElements.length) %
    focusableElements.length;
  focusableElements[targetIndex]?.focus();
};

const tooltipWrap = (showTooltip: boolean, label: string, child: ReactNode) => {
  if (!showTooltip) {
    return child;
  }

  return (
    <Tooltip
      placement="right"
      variant="solid"
      enterDelay={0}
      title={label}
      sx={{
        "--Tooltip-bg": "var(--joy-palette-brandNavy-700)",
        "--Tooltip-radius": "12px",
        fontSize: "0.75rem",
      }}
    >
      <Box sx={{ display: "block" }}>{child}</Box>
    </Tooltip>
  );
};

interface DashboardSidebarProps {
  mobile?: boolean;
  mode?: DashboardShellMode;
}

export function DashboardSidebar({
  mobile = false,
  mode = "admin",
}: DashboardSidebarProps) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: isLoadingSuperAdmin } =
    useIsSuperAdmin();
  const {
    isSidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    closeMobileSidebar,
  } = useDashboardShell();
  const [expandedBranches, setExpandedBranches] = useState<string[]>(() =>
    getStoredExpandedBranches(),
  );
  const [flyoutBranchId, setFlyoutBranchId] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(88);
  const collapsed = !mobile && isSidebarCollapsed;
  const displayName = getUserDisplayName(
    user?.user_metadata?.full_name as string | undefined,
    user?.email,
  );
  const userInitials = getInitials(displayName);
  const sidebarGroups = useMemo(
    () =>
      getDashboardSidebarGroups({
        mode,
        isSuperAdmin: !isLoadingSuperAdmin && Boolean(isSuperAdmin),
      }),
    [isLoadingSuperAdmin, isSuperAdmin, mode],
  );
  const flyoutBranch = useMemo(
    () =>
      sidebarGroups
        .flatMap((group) => group.items)
        .find(
          (item): item is DashboardSidebarBranchItem =>
            item.kind === "branch" && item.id === flyoutBranchId,
        ) ?? null,
    [flyoutBranchId, sidebarGroups],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      EXPANDED_BRANCHES_STORAGE_KEY,
      JSON.stringify(expandedBranches),
    );
  }, [expandedBranches]);

  useEffect(() => {
    const activeBranchIds = getActiveBranchIds(pathname, sidebarGroups);

    if (activeBranchIds.length === 0) {
      return;
    }

    setExpandedBranches((currentValue) =>
      Array.from(new Set([...currentValue, ...activeBranchIds])),
    );
  }, [pathname, sidebarGroups]);

  useEffect(() => {
    if (!collapsed) {
      setFlyoutBranchId(null);
    }
  }, [collapsed]);

  useEffect(() => {
    setFlyoutBranchId(null);
  }, [pathname]);

  const labelSx = collapsed ? collapsedContentSx : expandedContentSx;
  const workspaceLabel =
    mode === "admin" ? "Admin workspace" : "Tenant workspace";

  const toggleBranch = (branchId: string) => {
    setExpandedBranches((currentValue) =>
      currentValue.includes(branchId)
        ? currentValue.filter((value) => value !== branchId)
        : [...currentValue, branchId],
    );
  };

  const handleLinkClick = () => {
    setFlyoutBranchId(null);
    closeMobileSidebar();
  };

  const handleBranchClick = (
    branch: DashboardSidebarBranchItem,
    buttonElement: HTMLElement,
  ) => {
    if (collapsed) {
      const buttonBounds = buttonElement.getBoundingClientRect();
      const nextTop = Math.max(
        16,
        Math.min(buttonBounds.top - 8, window.innerHeight - 340),
      );

      setFlyoutTop(nextTop);
      setFlyoutBranchId((currentValue) =>
        currentValue === branch.id ? null : branch.id,
      );
      return;
    }

    toggleBranch(branch.id);
  };

  const renderLinkItem = (
    item: DashboardSidebarLinkItem,
    options?: { nested?: boolean; focusScopeId?: string },
  ) => {
    const isActive = matchesNavigationPatterns(pathname, item.patterns);
    const contentColor = isActive
      ? "var(--joy-palette-primary-500)"
      : "var(--joy-palette-brandNavy-100)";
    const mutedColor = "var(--joy-palette-brandNavy-300)";
    const showTooltip = collapsed;

    const button = (
      <ListItemButton
        component={RouterLink}
        to={item.to}
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        data-dashboard-sidebar-focusable="true"
        onClick={handleLinkClick}
        onKeyDown={(event) =>
          moveFocusWithinScope(event, options?.focusScopeId ?? "sidebar-main")
        }
        sx={{
          position: "relative",
          minHeight: options?.nested ? 40 : 44,
          px: collapsed ? 1.25 : options?.nested ? 1.25 : 1.5,
          py: 1,
          pl: options?.nested && !collapsed ? 3 : undefined,
          borderRadius: "14px",
          justifyContent: collapsed ? "center" : "flex-start",
          alignItems: "center",
          color: contentColor,
          backgroundColor: isActive
            ? "rgba(104, 190, 185, 0.12)"
            : "transparent",
          transition:
            "background-color 200ms ease, color 200ms ease, padding 200ms ease",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 8,
            bottom: 8,
            left: 0,
            width: 3,
            borderRadius: "999px",
            backgroundColor: "var(--joy-palette-primary-500)",
            opacity: isActive ? 1 : 0,
            transition: "opacity 200ms ease",
          },
          "&:hover": {
            backgroundColor: isActive
              ? "rgba(104, 190, 185, 0.16)"
              : "var(--joy-palette-brandNavy-700)",
            color: isActive ? contentColor : "common.white",
          },
          "&:focus-visible": {
            outline: "2px solid var(--joy-palette-primary-500)",
            outlineOffset: 2,
          },
        }}
      >
        <ListItemDecorator
          sx={{
            minInlineSize: collapsed ? 0 : 30,
            mr: collapsed ? 0 : 1,
            justifyContent: "center",
            color: contentColor,
            transition: "color 200ms ease, margin 200ms ease",
          }}
        >
          <item.icon aria-hidden="true" size={18} />
        </ListItemDecorator>
        <ListItemContent sx={labelSx}>
          <Typography
            level="body-sm"
            sx={{ color: contentColor, fontWeight: 600, whiteSpace: "nowrap" }}
          >
            {item.label}
          </Typography>
        </ListItemContent>
        {item.badge && !collapsed && (
          <Box sx={expandedContentSx}>
            <Typography
              level="body-xs"
              sx={{
                color: mutedColor,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {item.badge}
            </Typography>
          </Box>
        )}
      </ListItemButton>
    );

    return (
      <ListItem sx={{ p: 0 }} key={item.id}>
        {tooltipWrap(showTooltip, item.label, button)}
      </ListItem>
    );
  };

  const renderBranchItem = (item: DashboardSidebarBranchItem) => {
    const branchIsActive = isDashboardSidebarItemActive(pathname, item);
    const branchIsExpanded = expandedBranches.includes(item.id);
    const flyoutOpen = flyoutBranchId === item.id;
    const showTooltip = collapsed;
    const branchColor = branchIsActive
      ? "var(--joy-palette-primary-500)"
      : "var(--joy-palette-brandNavy-100)";

    const button = (
      <ListItemButton
        aria-expanded={collapsed ? flyoutOpen : branchIsExpanded}
        aria-label={collapsed ? item.label : undefined}
        data-dashboard-sidebar-focusable="true"
        onClick={(event) => handleBranchClick(item, event.currentTarget)}
        onKeyDown={(event) => moveFocusWithinScope(event, "sidebar-main")}
        sx={{
          position: "relative",
          minHeight: 44,
          px: collapsed ? 1.25 : 1.5,
          py: 1,
          borderRadius: "14px",
          justifyContent: collapsed ? "center" : "flex-start",
          color: branchColor,
          backgroundColor: branchIsActive
            ? "rgba(104, 190, 185, 0.12)"
            : "transparent",
          transition: "background-color 200ms ease, color 200ms ease",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 8,
            bottom: 8,
            left: 0,
            width: 3,
            borderRadius: "999px",
            backgroundColor: "var(--joy-palette-primary-500)",
            opacity: branchIsActive ? 1 : 0,
            transition: "opacity 200ms ease",
          },
          "&:hover": {
            backgroundColor: branchIsActive
              ? "rgba(104, 190, 185, 0.16)"
              : "var(--joy-palette-brandNavy-700)",
            color: branchIsActive ? branchColor : "common.white",
          },
          "&:focus-visible": {
            outline: "2px solid var(--joy-palette-primary-500)",
            outlineOffset: 2,
          },
        }}
      >
        <ListItemDecorator
          sx={{
            minInlineSize: collapsed ? 0 : 30,
            mr: collapsed ? 0 : 1,
            justifyContent: "center",
            color: branchColor,
          }}
        >
          <item.icon aria-hidden="true" size={18} />
        </ListItemDecorator>
        <ListItemContent sx={labelSx}>
          <Typography
            level="body-sm"
            sx={{ color: branchColor, fontWeight: 600, whiteSpace: "nowrap" }}
          >
            {item.label}
          </Typography>
        </ListItemContent>
        <Box
          sx={{
            ...(collapsed ? collapsedContentSx : expandedContentSx),
            display: "flex",
            alignItems: "center",
          }}
        >
          <ChevronDown
            aria-hidden="true"
            size={16}
            style={{
              transform: branchIsExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          />
        </Box>
        {collapsed && (
          <Box
            sx={{
              position: "absolute",
              right: 8,
              bottom: 8,
              display: "flex",
              color: branchColor,
            }}
          >
            <ChevronRight aria-hidden="true" size={12} />
          </Box>
        )}
      </ListItemButton>
    );

    return (
      <Stack key={item.id} spacing={0.5}>
        <ListItem sx={{ p: 0 }}>
          {tooltipWrap(showTooltip, item.label, button)}
        </ListItem>
        {!collapsed && branchIsExpanded && (
          <List
            size="sm"
            sx={{
              gap: 0.5,
              "--List-padding": "0px",
            }}
          >
            {item.children.map((child) =>
              renderLinkItem(child, {
                nested: true,
                focusScopeId: "sidebar-main",
              }),
            )}
          </List>
        )}
      </Stack>
    );
  };

  return (
    <Stack
      data-dashboard-sidebar-root="true"
      sx={{
        height: "100%",
        minHeight: 0,
        color: "var(--joy-palette-brandNavy-100)",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={collapsed ? "center" : "flex-start"}
        spacing={collapsed ? 0 : 1.5}
        sx={{
          minHeight: 64,
          px: collapsed ? 1.5 : 2,
          borderBottom: "1px solid var(--joy-palette-brandNavy-600)",
        }}
      >
        <Box
          component="img"
          src={logoImage}
          alt="BloomSuite"
          sx={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }}
        />
        <Stack sx={collapsed ? collapsedContentSx : expandedContentSx}>
          <Typography level="title-md" sx={{ color: "common.white" }}>
            BloomSuite
          </Typography>
          <Typography
            level="body-xs"
            sx={{
              color: "var(--joy-palette-brandNavy-300)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {workspaceLabel}
          </Typography>
        </Stack>
      </Stack>

      <Stack
        data-dashboard-sidebar-focus-scope="sidebar-main"
        spacing={2}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          py: 2,
          scrollbarWidth: "thin",
          scrollbarColor:
            "var(--joy-palette-brandNavy-600) var(--joy-palette-brandNavy-800)",
          "&::-webkit-scrollbar": {
            width: 8,
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "var(--joy-palette-brandNavy-800)",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--joy-palette-brandNavy-600)",
            borderRadius: 999,
          },
        }}
      >
        {sidebarGroups.map((group, index) => (
          <Stack key={group.id} spacing={collapsed ? 1.25 : 1}>
            {collapsed ? (
              index > 0 ? (
                <Divider
                  sx={{ backgroundColor: "var(--joy-palette-brandNavy-600)" }}
                />
              ) : null
            ) : (
              <Typography
                level="body-xs"
                sx={{
                  px: 1,
                  color: "var(--joy-palette-brandNavy-300)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {group.label}
              </Typography>
            )}
            <List size="sm" sx={{ gap: 0.5, "--List-padding": "0px" }}>
              {group.items.map((item) =>
                item.kind === "branch"
                  ? renderBranchItem(item)
                  : renderLinkItem(item, { focusScopeId: "sidebar-main" }),
              )}
            </List>
          </Stack>
        ))}
      </Stack>

      <Stack sx={{ mt: "auto", px: 1.5, pb: 1.5 }}>
        <Divider
          sx={{ backgroundColor: "var(--joy-palette-brandNavy-600)", mb: 1.5 }}
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={collapsed ? "center" : "space-between"}
          spacing={1}
          sx={{ minHeight: 48, px: collapsed ? 0 : 0.5 }}
        >
          {tooltipWrap(
            collapsed,
            displayName,
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.25}
              sx={{ minWidth: 0 }}
            >
              <Avatar
                size="sm"
                sx={{
                  bgcolor: "rgba(255, 255, 255, 0.14)",
                  color: "common.white",
                }}
              >
                {userInitials}
              </Avatar>
              <Stack sx={collapsed ? collapsedContentSx : expandedContentSx}>
                <Typography
                  level="body-sm"
                  sx={{ color: "common.white", fontWeight: 600 }}
                >
                  {displayName}
                </Typography>
                <Typography
                  level="body-xs"
                  sx={{ color: "var(--joy-palette-brandNavy-300)" }}
                >
                  {user?.email ?? "Signed in"}
                </Typography>
              </Stack>
            </Stack>,
          )}
          {!collapsed && (
            <Tooltip
              placement="top"
              enterDelay={0}
              title="Support"
              variant="solid"
              sx={{ "--Tooltip-bg": "var(--joy-palette-brandNavy-700)" }}
            >
              <IconButton
                component={RouterLink}
                to="/support"
                aria-label="Support"
                data-dashboard-sidebar-focusable="true"
                onClick={handleLinkClick}
                onKeyDown={(event) =>
                  moveFocusWithinScope(event, "sidebar-footer")
                }
                sx={{
                  color: "var(--joy-palette-brandNavy-100)",
                  bgcolor: "transparent",
                  "&:hover": {
                    bgcolor: "var(--joy-palette-brandNavy-700)",
                    color: "common.white",
                  },
                }}
              >
                <LifeBuoy aria-hidden="true" size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Stack
          data-dashboard-sidebar-focus-scope="sidebar-footer"
          direction={collapsed ? "column" : "row"}
          spacing={1}
          sx={{ mt: 1 }}
        >
          {collapsed && (
            <Tooltip
              placement="right"
              enterDelay={0}
              title="Support"
              variant="solid"
              sx={{ "--Tooltip-bg": "var(--joy-palette-brandNavy-700)" }}
            >
              <IconButton
                component={RouterLink}
                to="/support"
                aria-label="Support"
                data-dashboard-sidebar-focusable="true"
                onClick={handleLinkClick}
                onKeyDown={(event) =>
                  moveFocusWithinScope(event, "sidebar-footer")
                }
                sx={{
                  alignSelf: "center",
                  color: "var(--joy-palette-brandNavy-100)",
                  bgcolor: "transparent",
                  "&:hover": {
                    bgcolor: "var(--joy-palette-brandNavy-700)",
                    color: "common.white",
                  },
                }}
              >
                <LifeBuoy aria-hidden="true" size={18} />
              </IconButton>
            </Tooltip>
          )}
          {tooltipWrap(
            collapsed,
            collapsed ? "Expand sidebar" : "Collapse sidebar",
            <ListItemButton
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              data-dashboard-sidebar-focusable="true"
              onClick={toggleSidebar}
              onKeyDown={(event) =>
                moveFocusWithinScope(event, "sidebar-footer")
              }
              sx={{
                minHeight: 44,
                px: collapsed ? 1.25 : 1.5,
                py: 1,
                borderRadius: "14px",
                justifyContent: collapsed ? "center" : "flex-start",
                color: "var(--joy-palette-brandNavy-100)",
                backgroundColor: "transparent",
                "&:hover": {
                  backgroundColor: "var(--joy-palette-brandNavy-700)",
                  color: "common.white",
                },
                "&:focus-visible": {
                  outline: "2px solid var(--joy-palette-primary-500)",
                  outlineOffset: 2,
                },
              }}
            >
              <ListItemDecorator
                sx={{
                  minInlineSize: collapsed ? 0 : 30,
                  mr: collapsed ? 0 : 1,
                  color: "inherit",
                  justifyContent: "center",
                }}
              >
                {collapsed ? (
                  <ChevronRight aria-hidden="true" size={18} />
                ) : (
                  <ChevronLeft aria-hidden="true" size={18} />
                )}
              </ListItemDecorator>
              <ListItemContent sx={labelSx}>
                <Typography
                  level="body-sm"
                  sx={{ color: "inherit", fontWeight: 600 }}
                >
                  {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                </Typography>
              </ListItemContent>
            </ListItemButton>,
          )}
        </Stack>
      </Stack>

      {collapsed && flyoutBranch && (
        <>
          <Box
            role="presentation"
            onClick={() => setFlyoutBranchId(null)}
            sx={{ position: "fixed", inset: 0, zIndex: 31 }}
          />
          <Sheet
            data-testid="dashboard-sidebar-flyout"
            variant="solid"
            sx={{
              position: "fixed",
              top: flyoutTop,
              left: sidebarWidth + 12,
              width: 248,
              maxHeight: "min(420px, calc(100vh - 32px))",
              overflowY: "auto",
              px: 1,
              py: 1,
              borderRadius: "18px",
              backgroundColor: "var(--joy-palette-brandNavy-700)",
              boxShadow: "var(--joy-shadow-lg)",
              zIndex: 32,
            }}
          >
            <Stack
              spacing={1}
              data-dashboard-sidebar-focus-scope="sidebar-flyout"
            >
              <Typography
                level="body-xs"
                sx={{
                  px: 1.25,
                  pt: 0.5,
                  color: "var(--joy-palette-brandNavy-300)",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {flyoutBranch.label}
              </Typography>
              <List size="sm" sx={{ gap: 0.5, "--List-padding": "0px" }}>
                {flyoutBranch.children.map((child) =>
                  renderLinkItem(child, { focusScopeId: "sidebar-flyout" }),
                )}
              </List>
            </Stack>
          </Sheet>
        </>
      )}
    </Stack>
  );
}
