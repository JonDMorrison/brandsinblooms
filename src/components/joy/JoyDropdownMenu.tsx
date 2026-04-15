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

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

const createFocusOutline = (): SxProps => ({
  outline: "2px solid var(--joy-palette-primary-500)",
  outlineOffset: -2,
});

const triggerSx: SxProps = {
  borderRadius: "12px",
  color: "var(--joy-palette-brandNavy-700)",
  backgroundColor: "transparent",
  transition: "background-color 0.16s ease, color 0.16s ease",
  "&:hover": {
    backgroundColor: "var(--joy-palette-neutral-100)",
    color: "var(--joy-palette-brandNavy-800)",
  },
  "&.Mui-focusVisible, &:focus-visible": createFocusOutline(),
};

const menuSx: SxProps = {
  mt: 0.75,
  p: 0.5,
  gap: 0.25,
  borderRadius: "var(--joy-radius-md)",
  borderColor: "neutral.200",
  backgroundColor: "#FFFFFF",
  boxShadow: "var(--joy-shadow-lg)",
  zIndex: "var(--joy-zIndex-popup)",
  "--List-padding": "0px",
};

const itemSx: SxProps = {
  minHeight: 40,
  borderRadius: "var(--joy-radius-md)",
  px: 1.25,
  py: 0.875,
  gap: 1,
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
      startDecorator={
        startDecorator ? (
          <ListItemDecorator sx={{ minInlineSize: 20, color: "inherit" }}>
            {startDecorator}
          </ListItemDecorator>
        ) : undefined
      }
      sx={mergeSx(itemSx, sx)}
      {...props}
    >
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
