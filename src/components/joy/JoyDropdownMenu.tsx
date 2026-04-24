import * as React from "react";
import Dropdown from "@mui/joy/Dropdown";
import IconButton, { type IconButtonProps } from "@mui/joy/IconButton";
import ListDivider, { type ListDividerProps } from "@mui/joy/ListDivider";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu, { type MenuProps } from "@mui/joy/Menu";
import MenuButton, { type MenuButtonProps } from "@mui/joy/MenuButton";
import MenuItem, { type MenuItemProps } from "@mui/joy/MenuItem";
import Typography from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

const createFocusOutline = (): SxProps => ({
  outline: 0,
  boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
});

const triggerSx: SxProps = {
  width: 28,
  height: 28,
  minWidth: 28,
  minHeight: 28,
  padding: 0,
  borderRadius: "999px",
  color: "var(--joy-palette-neutral-400)",
  backgroundColor: "transparent",
  transition: "background-color 0.16s ease, color 0.16s ease",
  "&:hover": {
    backgroundColor: "var(--joy-palette-neutral-100)",
    color: "var(--joy-palette-neutral-600)",
  },
  "&.Mui-focusVisible, &:focus-visible": createFocusOutline(),
  "& .lucide": {
    width: 16,
    height: 16,
  },
  "& .MuiSvgIcon-root": {
    fontSize: 16,
  },
};

const menuSx: SxProps = {
  mt: 0.75,
  p: 0.5,
  gap: 0.25,
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.200",
  backgroundColor: "#FFFFFF",
  boxShadow: "var(--joy-shadow-lg)",
  zIndex: "var(--joy-zIndex-popup)",
  "--List-padding": "0px",
};

const itemSx: SxProps = {
  minHeight: 40,
  borderRadius: "var(--joy-radius-md)",
  px: 1.5,
  py: 0.875,
  gap: 2,
  alignItems: "center",
  fontSize: "var(--joy-fontSize-sm)",
  fontWeight: "var(--joy-fontWeight-medium)",
  lineHeight: 1.2,
  "& .lucide": {
    width: 16,
    height: 16,
  },
  "&.Mui-focusVisible, &:focus-visible": createFocusOutline(),
};

const labelSx: SxProps = {
  px: 1.25,
  py: 0.75,
  color: "neutral.500",
  fontSize: "var(--joy-fontSize-xs)",
  fontWeight: "var(--joy-fontWeight-lg)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const JoyDropdownMenu = Dropdown;

export type JoyDropdownMenuTriggerProps = Omit<
  MenuButtonProps,
  "slots" | "slotProps" | "color" | "variant" | "size"
> & {
  color?: IconButtonProps["color"];
  variant?: IconButtonProps["variant"];
  size?: IconButtonProps["size"];
  iconButtonSx?: SxProps;
};

export const JoyDropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  JoyDropdownMenuTriggerProps
>(
  (
    {
      color = "neutral",
      variant = "plain",
      size = "sm",
      iconButtonSx,
      children,
      ...props
    },
    ref,
  ) => (
    <MenuButton
      {...props}
      ref={ref}
      slots={{ root: IconButton }}
      slotProps={{
        root: {
          color,
          variant,
          size,
          sx: mergeSx(triggerSx, iconButtonSx),
        },
      }}
    >
      {children}
    </MenuButton>
  ),
);

JoyDropdownMenuTrigger.displayName = "JoyDropdownMenuTrigger";

export type JoyDropdownMenuContentProps = MenuProps & {
  placement?: MenuProps["placement"];
};

export const JoyDropdownMenuContent = React.forwardRef<
  HTMLUListElement,
  JoyDropdownMenuContentProps
>(({ placement = "bottom-end", sx, children, ...props }, ref) => (
  <Menu ref={ref} placement={placement} sx={mergeSx(menuSx, sx)} {...props}>
    {children}
  </Menu>
));

JoyDropdownMenuContent.displayName = "JoyDropdownMenuContent";

export type JoyDropdownMenuItemProps = Omit<MenuItemProps, "color"> & {
  startDecorator?: React.ReactNode;
  color?: MenuItemProps["color"];
  destructive?: boolean;
};

export const JoyDropdownMenuItem = React.forwardRef<
  HTMLLIElement,
  JoyDropdownMenuItemProps
>(
  (
    { startDecorator, color, destructive = false, sx, children, ...props },
    ref,
  ) => (
    <MenuItem
      ref={ref}
      color={destructive ? "danger" : (color ?? "neutral")}
      sx={mergeSx(itemSx, sx)}
      {...props}
    >
      {startDecorator ? (
        <ListItemDecorator
          sx={{
            minInlineSize: 32,
            justifyContent: "center",
            alignSelf: "center",
            color: "inherit",
            opacity: 0.9,
          }}
        >
          {startDecorator}
        </ListItemDecorator>
      ) : null}
      {children}
    </MenuItem>
  ),
);

JoyDropdownMenuItem.displayName = "JoyDropdownMenuItem";

export const JoyDropdownMenuSeparator = React.forwardRef<
  HTMLHRElement,
  ListDividerProps
>(({ sx, ...props }, ref) => (
  <ListDivider ref={ref} sx={mergeSx({ my: 0.5 }, sx)} {...props} />
));

JoyDropdownMenuSeparator.displayName = "JoyDropdownMenuSeparator";

export type JoyDropdownMenuLabelProps = React.ComponentProps<typeof Typography>;

export const JoyDropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  JoyDropdownMenuLabelProps
>(({ sx, children, ...props }, ref) => (
  <Typography ref={ref} component="div" sx={mergeSx(labelSx, sx)} {...props}>
    {children}
  </Typography>
));

JoyDropdownMenuLabel.displayName = "JoyDropdownMenuLabel";
