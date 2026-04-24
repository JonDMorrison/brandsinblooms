import {
  type ElementType,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboardShell } from "@/components/layout/DashboardShell";
import {
  getActiveBranchIds,
  getDashboardSidebarGroups,
  isDashboardSidebarItemActive,
  matchesNavigationPatterns,
  type DashboardShellMode,
  type DashboardSidebarBranchItem,
  type DashboardSidebarGroup,
  type DashboardSidebarLinkItem,
} from "@/components/navigation/sidebarNavigation";
import logoImage from "@/assets/bloomsuite-logo-correct.png";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

const EXPANDED_BRANCHES_STORAGE_KEY = "dashboard-sidebar:expanded-branches";
const SIDEBAR_TOUCH_TARGET = 48;
const SIDEBAR_ICON_SIZE = 20;
const SIDEBAR_ROW_RADIUS = "6px";
const SIDEBAR_GROUP_GAP = 2;
const SIDEBAR_ITEM_GAP = 0.5;
const SIDEBAR_TRANSITION = "200ms cubic-bezier(0.4, 0, 0.2, 1)";
const SIDEBAR_COLLAPSE_LAYOUT_DELAY_MS = 200;
const SIDEBAR_LABEL_TRANSITION =
  "opacity 150ms ease, transform 150ms ease, max-width 150ms ease";
const SIDEBAR_INTERACTIVE_TRANSITION =
  "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease";
const SIDEBAR_ACTIVE_BG = "rgba(104, 190, 185, 0.15)";
const SIDEBAR_ACTIVE_HOVER_BG = "rgba(104, 190, 185, 0.20)";

const getActiveNavPalette = (compact: boolean) => {
  if (compact) {
    return {
      backgroundColor: SIDEBAR_ACTIVE_BG,
      hoverBackgroundColor: SIDEBAR_ACTIVE_HOVER_BG,
      iconColor: "var(--joy-palette-primary-500)",
      labelColor: "var(--joy-palette-common-white)",
      chevronColor: "var(--joy-palette-primary-500)",
    };
  }

  return {
    backgroundColor: SIDEBAR_ACTIVE_BG,
    hoverBackgroundColor: SIDEBAR_ACTIVE_HOVER_BG,
    iconColor: "var(--joy-palette-primary-500)",
    labelColor: "var(--joy-palette-common-white)",
    chevronColor: "var(--joy-palette-common-white)",
  };
};

const sidebarFocusRingSx = {
  outline: 0,
  boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
};

const createCollapsibleContentSx = (visible: boolean, maxWidth: number) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? "translateX(0)" : "translateX(-8px)",
  maxWidth: visible ? maxWidth : 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  transition: SIDEBAR_LABEL_TRANSITION,
});

const collapsedLabelSx = createCollapsibleContentSx(false, 0);
const expandedLabelSx = createCollapsibleContentSx(true, 220);
const collapsedBadgeSx = createCollapsibleContentSx(false, 0);
const expandedBadgeSx = createCollapsibleContentSx(true, 84);
const collapsedHeaderContentSx = createCollapsibleContentSx(false, 0);
const expandedHeaderContentSx = createCollapsibleContentSx(true, 180);
const collapsedUserContentSx = createCollapsibleContentSx(false, 0);
const expandedUserContentSx = createCollapsibleContentSx(true, 200);

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

const renderSidebarIcon = (Icon: ElementType, size = SIDEBAR_ICON_SIZE) => (
  <Box
    component={Icon as never}
    aria-hidden="true"
    sx={{
      width: size,
      height: size,
      fontSize: size,
      flexShrink: 0,
    }}
  />
);

const tooltipWrap = (showTooltip: boolean, label: string, child: ReactNode) => {
  if (!showTooltip) {
    return child;
  }

  return (
    <Tooltip
      arrow
      enterDelay={300}
      leaveDelay={0}
      modifiers={[{ name: "offset", options: { offset: [0, 12] } }]}
      placement="right"
      title={label}
      variant="solid"
      sx={{
        "--Tooltip-bg": "var(--joy-palette-neutral-800)",
        "--Tooltip-radius": "var(--joy-radius-sm)",
        "--Tooltip-arrowSize": "8px",
        boxShadow: "var(--joy-shadow-md)",
        fontSize: "var(--joy-fontSize-xs)",
        fontWeight: "var(--joy-fontWeight-medium)",
        color: "var(--joy-palette-common-white)",
        maxWidth: 220,
      }}
    >
      <Box sx={{ display: "block", width: "100%" }}>{child}</Box>
    </Tooltip>
  );
};

const getNavPalette = (active: boolean, compact: boolean) => {
  const activePalette = getActiveNavPalette(compact);

  if (compact) {
    if (active) {
      return {
        backgroundColor: activePalette.backgroundColor,
        hoverBackgroundColor: activePalette.hoverBackgroundColor,
        iconColor: activePalette.iconColor,
        hoverIconColor: activePalette.iconColor,
        labelColor: activePalette.labelColor,
        hoverLabelColor: activePalette.labelColor,
        chevronColor: activePalette.chevronColor,
        hoverChevronColor: activePalette.chevronColor,
      };
    }

    return {
      backgroundColor: "transparent",
      hoverBackgroundColor: activePalette.backgroundColor,
      iconColor: "var(--joy-palette-brandNavy-300)",
      hoverIconColor: activePalette.iconColor,
      labelColor: "var(--joy-palette-brandNavy-300)",
      hoverLabelColor: activePalette.labelColor,
      chevronColor: "var(--joy-palette-brandNavy-300)",
      hoverChevronColor: activePalette.chevronColor,
    };
  }

  if (active) {
    return {
      backgroundColor: activePalette.backgroundColor,
      hoverBackgroundColor: activePalette.hoverBackgroundColor,
      iconColor: activePalette.iconColor,
      hoverIconColor: activePalette.iconColor,
      labelColor: activePalette.labelColor,
      hoverLabelColor: activePalette.labelColor,
      chevronColor: activePalette.chevronColor,
      hoverChevronColor: activePalette.chevronColor,
    };
  }

  return {
    backgroundColor: "transparent",
    hoverBackgroundColor: activePalette.backgroundColor,
    iconColor: "var(--joy-palette-brandNavy-300)",
    hoverIconColor: activePalette.iconColor,
    labelColor: "var(--joy-palette-brandNavy-200)",
    hoverLabelColor: activePalette.labelColor,
    chevronColor: "var(--joy-palette-brandNavy-300)",
    hoverChevronColor: activePalette.chevronColor,
  };
};

const getItemFrameSx = (active: boolean, compact: boolean) => ({
  position: "relative",
  width: "100%",
  minHeight: SIDEBAR_TOUCH_TARGET,
  display: "flex",
  alignItems: "center",
  justifyContent: compact ? "center" : "stretch",
  "&::before": {
    content: '\"\"',
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    width: 3,
    borderRadius: "0 2px 2px 0",
    backgroundColor: "var(--joy-palette-primary-500)",
    opacity: active ? 1 : 0,
    transition: `opacity ${SIDEBAR_TRANSITION}`,
  },
});

const getSectionDividerSx = (compact: boolean) => ({
  height: 1,
  width: compact ? "60%" : "calc(100% - 24px)",
  mx: "auto",
  backgroundColor: "var(--joy-palette-brandNavy-600)",
});

const getNavButtonSx = (options: {
  active: boolean;
  compact: boolean;
  nested?: boolean;
}) => {
  const { active, compact, nested = false } = options;
  const palette = getNavPalette(active, compact);

  return {
    "--ListItemButton-radius": SIDEBAR_ROW_RADIUS,
    // Override Joy's variant hover CSS variables — Joy's internal
    // :not(.Mui-selected):hover selector has higher specificity (0,2,1)
    // than our &:hover (0,1,1), so we must feed the teal color through
    // the CSS variables Joy actually reads.
    "--variant-plainHoverBg": palette.hoverBackgroundColor,
    "--variant-plainHoverColor": palette.hoverLabelColor,
    "--sidebar-icon-color": palette.iconColor,
    "--sidebar-label-color": palette.labelColor,
    "--sidebar-label-weight": active ? 600 : 400,
    "--sidebar-chevron-color": palette.chevronColor,
    "--sidebar-badge-color": "var(--joy-palette-brandNavy-400)",
    width: compact ? SIDEBAR_TOUCH_TARGET : "calc(100% - 24px)",
    minWidth: compact ? SIDEBAR_TOUCH_TARGET : 0,
    maxWidth: compact ? SIDEBAR_TOUCH_TARGET : "none",
    minHeight: SIDEBAR_TOUCH_TARGET,
    mx: compact ? "auto" : 1.5,
    px: compact ? 0 : 1.5,
    pl: compact ? 0 : nested ? 3 : 1.5,
    pr: compact ? 0 : 1.5,
    py: 0,
    borderRadius: SIDEBAR_ROW_RADIUS,
    justifyContent: compact ? "center" : "flex-start",
    alignItems: "center",
    backgroundColor: palette.backgroundColor,
    color: palette.labelColor,
    transition: `${SIDEBAR_INTERACTIVE_TRANSITION}, margin ${SIDEBAR_TRANSITION}`,
    "&:hover": {
      backgroundColor: palette.hoverBackgroundColor,
      color: palette.hoverLabelColor,
      "--sidebar-icon-color": palette.hoverIconColor,
      "--sidebar-label-color": palette.hoverLabelColor,
      "--sidebar-label-weight": 600,
      "--sidebar-chevron-color": palette.hoverChevronColor,
      "--sidebar-badge-color": "var(--joy-palette-common-white)",
    },
    "&.Mui-focusVisible, &:focus-visible": sidebarFocusRingSx,
  };
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
  const [collapsedContentHidden, setCollapsedContentHidden] =
    useState(collapsed);
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
  const { navigationGroups, footerSettingsItem } = useMemo(() => {
    if (mode !== "tenant") {
      return {
        navigationGroups: sidebarGroups,
        footerSettingsItem: null as DashboardSidebarLinkItem | null,
      };
    }

    let extractedSettingsItem: DashboardSidebarLinkItem | null = null;
    const nextGroups = sidebarGroups
      .map((group) => {
        if (group.id !== "settings") {
          return group;
        }

        const items = group.items.filter((item) => {
          if (item.kind === "link" && item.id === "settings") {
            extractedSettingsItem = item;
            return false;
          }

          return true;
        });

        return {
          ...group,
          items,
        } satisfies DashboardSidebarGroup;
      })
      .filter((group) => group.items.length > 0);

    return {
      navigationGroups: nextGroups,
      footerSettingsItem: extractedSettingsItem,
    };
  }, [mode, sidebarGroups]);
  const flyoutBranch = useMemo(
    () =>
      navigationGroups
        .flatMap((group) => group.items)
        .find(
          (item): item is DashboardSidebarBranchItem =>
            item.kind === "branch" && item.id === flyoutBranchId,
        ) ?? null,
    [flyoutBranchId, navigationGroups],
  );
  const shouldRenderCollapsedContent = !collapsed || !collapsedContentHidden;
  const headerContentSx = collapsed
    ? collapsedHeaderContentSx
    : expandedHeaderContentSx;
  const userContentSx = collapsed
    ? collapsedUserContentSx
    : expandedUserContentSx;
  const workspaceLabel =
    mode === "admin" ? "Admin workspace" : "Tenant workspace";

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
    const activeBranchIds = getActiveBranchIds(pathname, navigationGroups);

    if (activeBranchIds.length === 0) {
      return;
    }

    setExpandedBranches((currentValue) =>
      Array.from(new Set([...currentValue, ...activeBranchIds])),
    );
  }, [pathname, navigationGroups]);

  useEffect(() => {
    if (collapsed) {
      const timer = window.setTimeout(
        () => setCollapsedContentHidden(true),
        SIDEBAR_COLLAPSE_LAYOUT_DELAY_MS,
      );

      return () => window.clearTimeout(timer);
    }

    setCollapsedContentHidden(false);
  }, [collapsed]);

  useEffect(() => {
    if (!collapsed) {
      setFlyoutBranchId(null);
    }
  }, [collapsed]);

  useEffect(() => {
    setFlyoutBranchId(null);
  }, [pathname]);

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
    options?: {
      context?: "main" | "footer" | "flyout";
      focusScopeId?: string;
      nested?: boolean;
    },
  ) => {
    const context = options?.context ?? "main";
    const compact = context === "flyout" ? false : collapsed;
    const nested = Boolean(options?.nested) && context !== "footer";
    const isActive = matchesNavigationPatterns(pathname, item.patterns);
    const labelSx = compact ? collapsedLabelSx : expandedLabelSx;
    const badgeSx = compact ? collapsedBadgeSx : expandedBadgeSx;
    const renderCompactContent = !compact || shouldRenderCollapsedContent;
    const iconSize = compact
      ? SIDEBAR_ICON_SIZE
      : nested
        ? 18
        : SIDEBAR_ICON_SIZE;
    const showTooltip = compact && context !== "flyout";

    const button = (
      <ListItemButton
        component={RouterLink}
        to={item.to}
        aria-current={isActive ? "page" : undefined}
        aria-label={compact ? item.label : undefined}
        data-dashboard-sidebar-focusable="true"
        onClick={handleLinkClick}
        onKeyDown={(event) =>
          moveFocusWithinScope(event, options?.focusScopeId ?? "sidebar-main")
        }
        sx={getNavButtonSx({ active: isActive, compact, nested })}
      >
        <ListItemDecorator
          sx={{
            minInlineSize: 0,
            mr: compact ? 0 : 1.5,
            justifyContent: "center",
            color: "var(--sidebar-icon-color)",
            transition: SIDEBAR_INTERACTIVE_TRANSITION,
          }}
        >
          {renderSidebarIcon(item.icon, iconSize)}
        </ListItemDecorator>
        {renderCompactContent ? (
          <ListItemContent sx={labelSx}>
            <Typography
              className="dashboard-sidebar-label"
              level="body-sm"
              noWrap
              sx={{
                color: "var(--sidebar-label-color)",
                fontSize: "0.875rem",
                fontWeight: "var(--sidebar-label-weight)",
                transition: SIDEBAR_INTERACTIVE_TRANSITION,
              }}
            >
              {item.label}
            </Typography>
          </ListItemContent>
        ) : null}
        {item.badge && renderCompactContent ? (
          <Box sx={badgeSx}>
            <Typography
              level="body-xs"
              sx={{
                color: "var(--sidebar-badge-color)",
                fontWeight: 700,
                textTransform: "uppercase",
                transition: SIDEBAR_INTERACTIVE_TRANSITION,
              }}
            >
              {item.badge}
            </Typography>
          </Box>
        ) : null}
      </ListItemButton>
    );

    return (
      <ListItem key={item.id} sx={{ p: 0, width: "100%" }}>
        {tooltipWrap(
          showTooltip,
          item.label,
          <Box sx={getItemFrameSx(isActive, compact)}>{button}</Box>,
        )}
      </ListItem>
    );
  };

  const renderBranchItem = (item: DashboardSidebarBranchItem) => {
    const branchIsActive = isDashboardSidebarItemActive(pathname, item);
    const branchIsExpanded = expandedBranches.includes(item.id);
    const compact = collapsed;
    const renderCompactContent = !compact || shouldRenderCollapsedContent;

    const button = (
      <ListItemButton
        aria-expanded={compact ? flyoutBranchId === item.id : branchIsExpanded}
        aria-label={compact ? item.label : undefined}
        data-dashboard-sidebar-focusable="true"
        onClick={(event) => handleBranchClick(item, event.currentTarget)}
        onKeyDown={(event) => moveFocusWithinScope(event, "sidebar-main")}
        sx={getNavButtonSx({ active: branchIsActive, compact })}
      >
        <ListItemDecorator
          sx={{
            minInlineSize: 0,
            mr: compact ? 0 : 1.5,
            justifyContent: "center",
            color: "var(--sidebar-icon-color)",
            transition: SIDEBAR_INTERACTIVE_TRANSITION,
          }}
        >
          {renderSidebarIcon(item.icon, SIDEBAR_ICON_SIZE)}
        </ListItemDecorator>
        {renderCompactContent ? (
          <ListItemContent sx={compact ? collapsedLabelSx : expandedLabelSx}>
            <Typography
              level="body-sm"
              noWrap
              sx={{
                color: "var(--sidebar-label-color)",
                fontSize: "0.875rem",
                fontWeight: "var(--sidebar-label-weight)",
                transition: SIDEBAR_INTERACTIVE_TRANSITION,
              }}
            >
              {item.label}
            </Typography>
          </ListItemContent>
        ) : null}
        {!compact ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              color: "var(--sidebar-chevron-color)",
              transition: SIDEBAR_INTERACTIVE_TRANSITION,
            }}
          >
            <ChevronDown
              aria-hidden="true"
              size={18}
              style={{
                transform: branchIsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: `transform ${SIDEBAR_TRANSITION}`,
              }}
            />
          </Box>
        ) : null}
      </ListItemButton>
    );

    return (
      <Stack key={item.id} spacing={SIDEBAR_ITEM_GAP} sx={{ width: "100%" }}>
        <ListItem sx={{ p: 0, width: "100%" }}>
          {tooltipWrap(
            compact,
            item.label,
            <Box sx={getItemFrameSx(branchIsActive, compact)}>{button}</Box>,
          )}
        </ListItem>
        {!compact && branchIsExpanded ? (
          <List
            size="sm"
            sx={{
              gap: SIDEBAR_ITEM_GAP,
              width: "100%",
              "--List-padding": "0px",
            }}
          >
            {item.children.map((child) =>
              renderLinkItem(child, {
                context: "main",
                focusScopeId: "sidebar-main",
                nested: true,
              }),
            )}
          </List>
        ) : null}
      </Stack>
    );
  };

  const renderToggleItem = () => {
    const buttonLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
    const renderCompactContent = !collapsed || shouldRenderCollapsedContent;

    const button = (
      <ListItemButton
        aria-label={buttonLabel}
        data-dashboard-sidebar-focusable="true"
        onClick={toggleSidebar}
        onKeyDown={(event) => moveFocusWithinScope(event, "sidebar-footer")}
        sx={getNavButtonSx({ active: false, compact: collapsed })}
      >
        <ListItemDecorator
          sx={{
            minInlineSize: 0,
            mr: collapsed ? 0 : 1.5,
            justifyContent: "center",
            color: "var(--sidebar-icon-color)",
            transition: SIDEBAR_INTERACTIVE_TRANSITION,
          }}
        >
          {collapsed
            ? renderSidebarIcon(ChevronRight, SIDEBAR_ICON_SIZE)
            : renderSidebarIcon(ChevronLeft, SIDEBAR_ICON_SIZE)}
        </ListItemDecorator>
        {renderCompactContent ? (
          <ListItemContent sx={collapsed ? collapsedLabelSx : expandedLabelSx}>
            <Typography
              level="body-sm"
              noWrap
              sx={{
                color: "var(--sidebar-label-color)",
                fontSize: "0.875rem",
                fontWeight: "var(--sidebar-label-weight)",
                transition: SIDEBAR_INTERACTIVE_TRANSITION,
              }}
            >
              {buttonLabel}
            </Typography>
          </ListItemContent>
        ) : null}
      </ListItemButton>
    );

    return (
      <ListItem sx={{ p: 0, width: "100%" }}>
        {tooltipWrap(
          collapsed,
          buttonLabel,
          <Box sx={getItemFrameSx(false, collapsed)}>{button}</Box>,
        )}
      </ListItem>
    );
  };

  return (
    <Stack
      data-dashboard-sidebar-root="true"
      sx={{
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
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
          pt: 2.5,
          pb: 2,
          px: collapsed ? 0 : 1.5,
          borderBottom: "1px solid var(--joy-palette-brandNavy-600)",
        }}
      >
        <Box
          component="img"
          src={logoImage}
          alt="BloomSuite"
          sx={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
        />
        {shouldRenderCollapsedContent ? (
          <Stack sx={headerContentSx}>
            <Typography level="title-md" noWrap sx={{ color: "common.white" }}>
              BloomSuite
            </Typography>
            <Typography
              level="body-xs"
              noWrap
              sx={{
                color: "var(--joy-palette-brandNavy-400)",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {workspaceLabel}
            </Typography>
          </Stack>
        ) : null}
      </Stack>

      <Stack
        data-dashboard-sidebar-focus-scope="sidebar-main"
        spacing={SIDEBAR_GROUP_GAP}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          px: 0,
          py: 2,
          scrollbarWidth: "thin",
          scrollbarColor: "transparent transparent",
          "&::-webkit-scrollbar": {
            width: 4,
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "transparent",
            borderRadius: 999,
          },
          "&:hover": {
            scrollbarColor: "var(--joy-palette-brandNavy-600) transparent",
          },
          "&:hover::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--joy-palette-brandNavy-600)",
          },
        }}
      >
        {navigationGroups.map((group, index) => (
          <Stack
            key={group.id}
            spacing={SIDEBAR_ITEM_GAP}
            sx={{ width: "100%" }}
          >
            {collapsed ? (
              index > 0 ? (
                <Box sx={getSectionDividerSx(true)} />
              ) : null
            ) : (
              <Typography
                level="body-xs"
                sx={{
                  mt: index === 0 ? 0 : 2.5,
                  mb: 1,
                  px: 1.5,
                  color: "var(--joy-palette-brandNavy-400)",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </Typography>
            )}
            <List
              size="sm"
              sx={{
                gap: SIDEBAR_ITEM_GAP,
                width: "100%",
                "--List-padding": "0px",
              }}
            >
              {group.items.map((item) =>
                item.kind === "branch"
                  ? renderBranchItem(item)
                  : renderLinkItem(item, {
                      context: "main",
                      focusScopeId: "sidebar-main",
                    }),
              )}
            </List>
          </Stack>
        ))}
      </Stack>

      <Stack sx={{ mt: "auto", px: 0, pb: 0.5, pt: 1.5, gap: 1.5 }}>
        <Box sx={getSectionDividerSx(collapsed)} />

        <Stack
          data-dashboard-sidebar-focus-scope="sidebar-footer"
          spacing={SIDEBAR_ITEM_GAP}
          sx={{ width: "100%" }}
        >
          {footerSettingsItem ? (
            <List
              size="sm"
              sx={{
                gap: SIDEBAR_ITEM_GAP,
                width: "100%",
                "--List-padding": "0px",
              }}
            >
              {renderLinkItem(footerSettingsItem, {
                context: "footer",
                focusScopeId: "sidebar-footer",
              })}
            </List>
          ) : null}

          {tooltipWrap(
            collapsed,
            displayName,
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.25}
              sx={{
                px: collapsed ? 0 : 1.5,
                minHeight: collapsed ? 48 : 56,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Avatar
                sx={{
                  width: collapsed ? 40 : 32,
                  height: collapsed ? 40 : 32,
                  bgcolor: "rgba(104, 190, 185, 0.20)",
                  color: "common.white",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {userInitials}
              </Avatar>
              {shouldRenderCollapsedContent ? (
                <Stack sx={userContentSx}>
                  <Typography
                    level="body-sm"
                    noWrap
                    sx={{ color: "common.white", fontWeight: 600 }}
                  >
                    {displayName}
                  </Typography>
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ color: "var(--joy-palette-brandNavy-300)" }}
                  >
                    {user?.email ?? "Signed in"}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>,
          )}

          <List
            size="sm"
            sx={{
              gap: SIDEBAR_ITEM_GAP,
              width: "100%",
              "--List-padding": "0px",
            }}
          >
            {renderToggleItem()}
          </List>
        </Stack>
      </Stack>

      {collapsed && flyoutBranch ? (
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
              width: 256,
              maxHeight: "min(420px, calc(100vh - 32px))",
              overflowY: "auto",
              py: 1,
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backgroundColor: "var(--joy-palette-brandNavy-700)",
              boxShadow: "var(--joy-shadow-lg)",
              zIndex: 32,
            }}
          >
            <Stack
              spacing={1}
              data-dashboard-sidebar-focus-scope="sidebar-flyout"
              sx={{ width: "100%" }}
            >
              <Typography
                level="body-xs"
                sx={{
                  px: 1.5,
                  pt: 0.25,
                  color: "var(--joy-palette-brandNavy-400)",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {flyoutBranch.label}
              </Typography>
              <List
                size="sm"
                sx={{
                  gap: SIDEBAR_ITEM_GAP,
                  width: "100%",
                  "--List-padding": "0px",
                }}
              >
                {flyoutBranch.children.map((child) =>
                  renderLinkItem(child, {
                    context: "flyout",
                    focusScopeId: "sidebar-flyout",
                  }),
                )}
              </List>
            </Stack>
          </Sheet>
        </>
      ) : null}
    </Stack>
  );
}
