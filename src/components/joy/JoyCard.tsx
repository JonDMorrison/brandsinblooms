import * as React from "react";
import Box from "@mui/joy/Box";
import Card, { type CardProps as JoyBaseCardProps } from "@mui/joy/Card";
import CardActions, {
  type CardActionsProps as JoyBaseCardActionsProps,
} from "@mui/joy/CardActions";
import CardContent, {
  type CardContentProps as JoyBaseCardContentProps,
} from "@mui/joy/CardContent";
import CardOverflow from "@mui/joy/CardOverflow";
import Divider from "@mui/joy/Divider";
import Stack, { type StackProps } from "@mui/joy/Stack";
import type { SxProps } from "@mui/joy/styles/types";
import Typography, { type TypographyProps } from "@mui/joy/Typography";

export type JoyCardProps = JoyBaseCardProps & {
  interactive?: boolean;
};

export type JoyCardHeaderProps = Omit<StackProps, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  startDecorator?: React.ReactNode;
  titleProps?: TypographyProps;
  descriptionProps?: TypographyProps;
};

export type JoyCardContentProps = JoyBaseCardContentProps;

export type JoyCardFooterProps = JoyBaseCardActionsProps & {
  divider?: boolean;
};

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

const baseCardSx: SxProps = {
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.200",
  backgroundColor: "#FFFFFF",
  boxShadow: "var(--joy-shadow-sm)",
  overflow: "hidden",
  p: 0,
};

const interactiveCardSx: SxProps = {
  cursor: "pointer",
  transition: "transform 0.18s ease, box-shadow 0.18s ease",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow: "var(--joy-shadow-md)",
  },
  "&:focus-visible": {
    outline: "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.45)",
    outlineOffset: "2px",
  },
};

export const JoyCard = React.forwardRef<HTMLDivElement, JoyCardProps>(
  ({ interactive = false, variant = "outlined", sx, ...props }, ref) => (
    <Card
      ref={ref}
      variant={variant}
      sx={mergeSx(
        baseCardSx,
        variant === "plain"
          ? {
              boxShadow: "none",
              backgroundColor: "#FFFFFF",
            }
          : undefined,
        interactive ? interactiveCardSx : undefined,
        sx,
      )}
      {...props}
    />
  ),
);

JoyCard.displayName = "JoyCard";

export const JoyCardHeader = React.forwardRef<
  HTMLDivElement,
  JoyCardHeaderProps
>(
  (
    {
      title,
      description,
      actions,
      startDecorator,
      titleProps,
      descriptionProps,
      children,
      sx,
      spacing = 1.5,
      ...props
    },
    ref,
  ) => {
    const hasStructuredHeader =
      title !== undefined ||
      description !== undefined ||
      actions !== undefined ||
      startDecorator !== undefined;

    return (
      <Stack
        ref={ref}
        spacing={spacing}
        sx={mergeSx({ px: 3, pt: 3, pb: 0 }, sx)}
        {...props}
      >
        {hasStructuredHeader ? (
          <Stack
            direction="row"
            spacing={2}
            alignItems="flex-start"
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              {startDecorator ? (
                <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
                  {startDecorator}
                </Box>
              ) : null}
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                {title ? (
                  <Typography level="title-md" {...titleProps}>
                    {title}
                  </Typography>
                ) : null}
                {description ? (
                  <Typography
                    level="body-sm"
                    color="neutral"
                    {...descriptionProps}
                  >
                    {description}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
            {actions ? (
              <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
                {actions}
              </Box>
            ) : null}
          </Stack>
        ) : null}
        {children}
      </Stack>
    );
  },
);

JoyCardHeader.displayName = "JoyCardHeader";

export const JoyCardContent = React.forwardRef<
  HTMLDivElement,
  JoyCardContentProps
>(({ sx, ...props }, ref) => (
  <CardContent ref={ref} sx={mergeSx({ px: 3, pb: 3, pt: 0 }, sx)} {...props} />
));

JoyCardContent.displayName = "JoyCardContent";

export const JoyCardFooter = React.forwardRef<
  HTMLDivElement,
  JoyCardFooterProps
>(({ divider = true, sx, ...props }, ref) => (
  <Box>
    {divider ? <Divider /> : null}
    <CardActions
      ref={ref}
      sx={mergeSx(
        { px: 3, pb: 3, pt: 2, gap: 1, justifyContent: "flex-end" },
        sx,
      )}
      {...props}
    />
  </Box>
));

JoyCardFooter.displayName = "JoyCardFooter";

export { CardOverflow as JoyCardOverflow, CardActions as JoyCardActions };
