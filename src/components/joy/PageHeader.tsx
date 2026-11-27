import * as React from "react";
import Stack from "@mui/joy/Stack";
import Typography, { type TypographyProps } from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

/**
 * The one heading level every top-level page title uses. The theme maps
 * it to the display font (Inter) and text.primary, so titles never set
 * their own font family, size or colour.
 */
export const PAGE_TITLE_LEVEL = "h1" as const;

export type PageTitleProps = Omit<TypographyProps, "level" | "component">;

/** The page's single `<h1>`, styled by the theme's h1 level. */
export const PageTitle = React.forwardRef<HTMLHeadingElement, PageTitleProps>(
  ({ sx, ...props }, ref) => (
    <Typography
      ref={ref}
      component="h1"
      level={PAGE_TITLE_LEVEL}
      sx={mergeSx({ color: "text.primary", minWidth: 0 }, sx)}
      {...props}
    />
  ),
);

PageTitle.displayName = "PageTitle";

export type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Buttons or controls aligned with the title on wide screens. */
  actions?: React.ReactNode;
  /** Content shown above the title, such as a back link. */
  before?: React.ReactNode;
  /** Extra content under the subtitle, such as status chips. */
  children?: React.ReactNode;
  titleId?: string;
  sx?: SxProps;
};

/**
 * Shared page header: the page's single h1 title, an optional subtitle and
 * an optional actions slot.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  before,
  children,
  titleId,
  sx,
}: PageHeaderProps) {
  return (
    <Stack spacing={1} sx={mergeSx({ minWidth: 0 }, sx)}>
      {before}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <PageTitle id={titleId}>{title}</PageTitle>
          {subtitle ? (
            <Typography level="body-sm" textColor="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
          {children}
        </Stack>
        {actions ? (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}
