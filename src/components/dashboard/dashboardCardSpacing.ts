/**
 * Shared dashboard card rhythm, in Joy UI spacing units (1 = 8px).
 *
 * Action cards use a 32px desktop inset and 24px on smaller screens.
 * The fixed icon areas keep headings aligned even when text wraps.
 * Keep these dashboard-specific so other product surfaces do not drift.
 */
export const dashboardCardSpacing = {
  action: {
    px: { xs: 3, sm: 4 },
    py: { xs: 3, sm: 3.5 },
    minHeight: 136,
    iconSize: 52,
    iconRadius: "12px",
    iconGap: 2,
    arrowSize: 32,
    titleGap: 1,
  },
  metric: {
    px: { xs: 2.5, sm: 3 },
    py: 2,
    minHeight: 0,
    iconSize: 44,
    iconRadius: "10px",
    iconGap: 1.25,
    contentGap: 1,
  },
  banner: {
    px: { xs: 2.5, sm: 3 },
    py: { xs: 2.5, sm: 3 },
    iconSize: 52,
    iconRadius: "12px",
    iconGap: 2,
    actionGap: 2,
    minButtonHeight: 44,
  },
  latest: {
    px: { xs: 2.5, sm: 3 },
    py: { xs: 2.5, sm: 3 },
    iconSize: 44,
    iconRadius: "12px",
    iconGap: 2,
    minHeight: 0,
    minButtonHeight: 44,
  },
} as const;
