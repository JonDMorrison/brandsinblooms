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
import { mergeSx } from "@/components/joy/mergeSx";

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

const baseCardSx: SxProps = {
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.200",
  backgroundColor: "background.surface",
  boxShadow: "var(--joy-shadow-xs)",
  overflow: "hidden",
  p: 0,
};

const interactiveCardSx: SxProps = {
  cursor: "pointer",
  transition:
    "background-color 200ms ease, color 150ms ease, box-shadow 200ms ease, transform 200ms ease",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow: "var(--joy-shadow-sm)",
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
              backgroundColor: "background.surface",
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

    const renderHeaderContent = (
      content: React.ReactNode,
      typographyProps: TypographyProps | undefined,
      fallbackProps: TypographyProps,
    ) => {
      if (content === undefined || content === null || content === false) {
        return null;
      }

      if (React.isValidElement(content)) {
        return content;
      }

      return (
        <Typography {...fallbackProps} {...typographyProps}>
          {content}
        </Typography>
      );
    };

    return (
      <Stack
        ref={ref}
        spacing={spacing}
        sx={mergeSx({ px: 4, pt: 4, pb: 0 }, sx)}
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
                {renderHeaderContent(title, titleProps, {
                  level: "title-md",
                })}
                {renderHeaderContent(description, descriptionProps, {
                  level: "body-sm",
                  color: "neutral",
                })}
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
  <CardContent ref={ref} sx={mergeSx({ px: 4, pb: 4, pt: 0 }, sx)} {...props} />
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
        { px: 4, pb: 4, pt: 4, gap: 2, justifyContent: "flex-end" },
        sx,
      )}
      {...props}
    />
  </Box>
));

JoyCardFooter.displayName = "JoyCardFooter";

export { CardOverflow as JoyCardOverflow, CardActions as JoyCardActions };
