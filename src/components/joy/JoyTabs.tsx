import * as React from "react";
import JoyBaseTab, { type TabProps as JoyBaseTabProps } from "@mui/joy/Tab";
import JoyBaseTabList, {
  type TabListProps as JoyBaseTabListProps,
} from "@mui/joy/TabList";
import JoyBaseTabPanel, {
  type TabPanelProps as JoyBaseTabPanelProps,
} from "@mui/joy/TabPanel";
import JoyBaseTabs, { type TabsProps as JoyBaseTabsProps } from "@mui/joy/Tabs";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

export interface JoyTabsProps extends Omit<JoyBaseTabsProps, "onChange"> {
  onValueChange?: (value: string | number | null) => void;
}

export type JoyTabsListProps = JoyBaseTabListProps;
export type JoyTabsTriggerProps = JoyBaseTabProps;
export type JoyTabsContentProps = JoyBaseTabPanelProps;

export const JoyTabs = React.forwardRef<HTMLDivElement, JoyTabsProps>(
  ({ children, onChange, onValueChange, sx, ...props }, ref) => (
    <JoyBaseTabs
      ref={ref}
      onChange={(event, value) => {
        onChange?.(event, value);
        onValueChange?.(value);
      }}
      sx={mergeSx(
        {
          width: "100%",
        },
        sx,
      )}
      {...props}
    >
      {children}
    </JoyBaseTabs>
  ),
);

JoyTabs.displayName = "JoyTabs";

export const JoyTabsList = React.forwardRef<HTMLDivElement, JoyTabsListProps>(
  ({ sx, ...props }, ref) => (
    <JoyBaseTabList
      ref={ref}
      sx={mergeSx(
        {
          p: 0.5,
          gap: 0.5,
          borderRadius: "var(--joy-radius-lg)",
          border: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "#FFFFFF",
          boxShadow: "var(--joy-shadow-xs)",
        },
        sx,
      )}
      {...props}
    />
  ),
);

JoyTabsList.displayName = "JoyTabsList";

export const JoyTabsTrigger = React.forwardRef<
  HTMLButtonElement,
  JoyTabsTriggerProps
>(({ sx, ...props }, ref) => (
  <JoyBaseTab
    ref={ref}
    disableIndicator
    sx={mergeSx(
      {
        minHeight: 40,
        borderRadius: "var(--joy-radius-md)",
        fontWeight: "var(--joy-fontWeight-medium)",
        color: "neutral.700",
        transition:
          "background-color 160ms ease, color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          backgroundColor: "neutral.100",
        },
        "&.Mui-selected": {
          backgroundColor: "primary.50",
          color: "primary.700",
          boxShadow: "var(--joy-shadow-sm)",
        },
      },
      sx,
    )}
    {...props}
  />
));

JoyTabsTrigger.displayName = "JoyTabsTrigger";

export const JoyTabsContent = React.forwardRef<
  HTMLDivElement,
  JoyTabsContentProps
>(({ sx, ...props }, ref) => (
  <JoyBaseTabPanel
    ref={ref}
    sx={mergeSx(
      {
        px: 0,
        pt: 3,
        pb: 0,
      },
      sx,
    )}
    {...props}
  />
));

JoyTabsContent.displayName = "JoyTabsContent";
