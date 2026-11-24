import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack, { type StackProps } from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import { JoyDataSectionCard } from "@/components/joy/JoyDataSectionCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { mergeSx } from "@/components/joy/mergeSx";
import {
  CatalogStatsStrip,
  type CatalogStatsStripItem,
} from "@/components/crm/catalog/CatalogStatsStrip";

/**
 * Layout primitives shared by the Customer Intelligence page and its panels.
 * They only arrange content: no data loading, calculations or wording live here.
 */

/** Card padding that matches the Segments catalog cards (JoyCard content padding). */
export const intelligenceCardPadding = { px: { xs: 4, md: 5 }, py: 4 } as const;

/** Same radius, border and elevation as the Segments catalog cards (JoyCard). */
export const intelligenceCardSx: SxProps = {
  borderRadius: "var(--joy-radius-2xl)",
  borderColor: "neutral.200",
  boxShadow: "var(--joy-shadow-sm)",
};

/**
 * The theme's 80px textarea min-height also applies to Joy's hidden autosize
 * measuring copy, so minRows multiplied 80px per row. Reset it on autosized textareas.
 */
export const autosizeSx = { "& textarea": { minHeight: 0 } } as const;

export type IntelligenceCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  /** Evidence and coverage notes, rendered as collapsible muted text at the bottom. */
  notes?: React.ReactNode;
  children?: React.ReactNode;
  sx?: SxProps;
  bodySx?: SxProps;
  "aria-label"?: string;
};

export function IntelligenceCard({
  title,
  description,
  icon,
  headerActions,
  notes,
  children,
  sx,
  bodySx,
}: IntelligenceCardProps) {
  return (
    <JoyDataSectionCard
      title={title}
      description={description}
      icon={icon}
      headerActions={headerActions}
      sx={mergeSx(intelligenceCardSx, sx)}
      headerSx={{ ...intelligenceCardPadding, flexWrap: "wrap", rowGap: 2 }}
      bodySx={mergeSx(intelligenceCardPadding, bodySx)}
    >
      {children || notes ? (
        <Stack spacing={3}>
          {children}
          {notes ? <IntelligenceNote>{notes}</IntelligenceNote> : null}
        </Stack>
      ) : null}
    </JoyDataSectionCard>
  );
}

/**
 * A row of actions at natural width. Primary action goes last so it sits on the right.
 * Prevents the column-stack `align-items: stretch` that made buttons full width.
 */
export function IntelligenceActions({
  children,
  justifyContent = "flex-end",
  sx,
  ...props
}: StackProps) {
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      alignItems="center"
      useFlexGap
      gap={1}
      justifyContent={justifyContent}
      sx={mergeSx({ width: "100%", "& > .MuiButton-root": { flexShrink: 0, maxWidth: "100%" } }, sx)}
      {...props}
    >
      {children}
    </Stack>
  );
}

/** Standard section title: title-lg, one muted line, optional step chip and action. */
export function IntelligenceSectionHeader({
  title,
  description,
  step,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  step?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "flex-start" }}
      gap={2}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography level="title-lg" component="h2">
            {title}
          </Typography>
          {step ? (
            <JoyChip size="sm" variant="soft" color="neutral">
              {step}
            </JoyChip>
          ) : null}
        </Stack>
        {description ? (
          <IntelligenceNote lines={1} level="body-sm">
            {description}
          </IntelligenceNote>
        ) : null}
      </Stack>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Stack>
  );
}

/**
 * Long evidence/coverage text: muted, clamped to a few lines, with a "Details"
 * toggle that reveals the rest. The full text always stays in the DOM.
 */
export function IntelligenceNote({
  children,
  lines = 2,
  level = "body-xs",
  sx,
}: {
  children: React.ReactNode;
  lines?: number;
  level?: "body-xs" | "body-sm";
  sx?: SxProps;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const [expanded, setExpanded] = React.useState(false);
  const [overflowing, setOverflowing] = React.useState(false);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () =>
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, children]);

  return (
    <Box sx={mergeSx({ minWidth: 0 }, sx)}>
      <Typography
        ref={ref}
        id={id}
        level={level}
        component="div"
        sx={{
          color: "neutral.500",
          "& p, & .MuiTypography-root": { m: 0, color: "inherit", fontSize: "inherit" },
          // Separate consecutive note paragraphs that render inline inside the clamp.
          "& > .MuiTypography-root + .MuiTypography-root::before": { content: '" "' },
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
              }),
        }}
      >
        {children}
      </Typography>
      {overflowing || expanded ? (
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          sx={{ minHeight: 0, px: 0, py: 0.25, fontSize: "xs", fontWeight: 600 }}
        >
          {expanded ? "Hide details" : "Details"}
        </Button>
      ) : null}
    </Box>
  );
}

export type IntelligenceStat = CatalogStatsStripItem & { detail?: React.ReactNode };

/** Stat row built from JoyStatCard via the same strip the Segments page uses. */
export function IntelligenceStatRow({ items }: { items: IntelligenceStat[] }) {
  return (
    <CatalogStatsStrip
      items={items.map(({ detail, value, ...item }) => ({
        ...item,
        value: detail ? (
          <>
            <Box component="span" sx={{ display: "block" }}>
              {value}
            </Box>
            <Typography
              level="body-xs"
              component="span"
              sx={{
                display: "block",
                mt: 0.75,
                fontFamily: "var(--joy-fontFamily-body)",
                fontSize: "var(--joy-fontSize-xs)",
                fontWeight: 400,
                letterSpacing: 0,
                lineHeight: 1.45,
                color: "neutral.500",
              }}
            >
              {detail}
            </Typography>
          </>
        ) : (
          value
        ),
      }))}
    />
  );
}

/** Grid for compact form fields: one column on mobile, 2 or 4 on desktop. */
export function IntelligenceFieldGrid({
  columns = 2,
  children,
}: {
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0,1fr)",
          sm: "repeat(2,minmax(0,1fr))",
          md: `repeat(${columns},minmax(0,1fr))`,
        },
        gap: 3,
      }}
    >
      {children}
    </Box>
  );
}
