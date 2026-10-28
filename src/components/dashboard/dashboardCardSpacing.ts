/**
 * Shared dashboard card rhythm, in Joy UI spacing units (1 = 8px).
 *
 * Desktop cards use a 24px content inset; smaller screens use 20px.
 * The fixed icon areas keep headings aligned even when text wraps.
 * Keep these dashboard-specific so other product surfaces do not drift.
 */
export const dashboardCardSpacing = {
  action: {
    px: { xs: 2.5, sm: 3 },
    py: 2,
    minHeight: 96,
    iconSize: 48,
    iconRadius: "12px",
    iconGap: 2,
    arrowSize: 32,
    titleGap: 0.5,
  },
  metric: {
    px: { xs: 2.5, sm: 3 },
    py: 2,
    minHeight: 0,
    iconSize: 36,
    iconRadius: "10px",
    iconGap: 1.25,
    contentGap: 1,
  },
  banner: {
    px: { xs: 2.5, sm: 3 },
    py: { xs: 2.5, sm: 3 },
    iconSize: 48,
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
