import type { ReactNode } from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";

export type PageSkeletonVariant = "table" | "form" | "dashboard" | "default";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
}

interface PlaceholderProps {
  height: number | string;
  width?: number | string;
  variant?: "rectangular" | "circular";
}

interface PlaceholderCardProps {
  children: ReactNode;
  minHeight?: number | string;
}

const BASE_SKELETON_SX = {
  bgcolor: "transparent",
  "--unstable_wave-bg": "var(--joy-palette-neutral-200)",
  "&::before": {
    backgroundColor: "var(--joy-palette-neutral-100)",
  },
} as const;

const CARD_SX = {
  border: "1px solid",
  borderColor: "neutral.200",
  borderRadius: "var(--joy-radius-xl)",
  backgroundColor: "background.surface",
  boxShadow: "var(--joy-shadow-xs)",
} as const;

const ROOT_MIN_HEIGHT: Record<PageSkeletonVariant, number> = {
  default: 520,
  table: 620,
  form: 580,
  dashboard: 640,
};

function Placeholder({
  height,
  width = "100%",
  variant = "rectangular",
}: PlaceholderProps) {
  return (
    <Skeleton
      animation="wave"
      variant={variant}
      sx={{
        ...BASE_SKELETON_SX,
        width,
        height,
        flexShrink: 0,
        borderRadius: variant === "circular" ? "999px" : "var(--joy-radius-md)",
      }}
    />
  );
}

function PlaceholderCard({ children, minHeight = 240 }: PlaceholderCardProps) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        ...CARD_SX,
        minHeight,
        p: { xs: 3, md: 4 },
      }}
    >
      {children}
    </Sheet>
  );
}

function HeaderBand() {
  return (
    <Sheet
      variant="outlined"
      sx={{
        ...CARD_SX,
        p: { xs: 3, md: 4 },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2.5}
        justifyContent="space-between"
      >
        <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <Placeholder height={34} width="min(420px, 76%)" />
          <Placeholder height={16} width="min(280px, 48%)" />
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Placeholder height={40} width={112} />
          <Placeholder height={40} width={92} />
        </Stack>
      </Stack>
    </Sheet>
  );
}

function DashboardVariant() {
  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <PlaceholderCard key={index} minHeight={148}>
            <Stack spacing={2.25}>
              <Placeholder height={16} width="42%" />
              <Placeholder height={36} width="58%" />
              <Placeholder height={14} width="66%" />
            </Stack>
          </PlaceholderCard>
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.4fr) minmax(0, 1fr)",
          },
        }}
      >
        <PlaceholderCard minHeight={320}>
          <Stack spacing={2.5}>
            <Placeholder height={20} width="32%" />
            <Placeholder height={224} width="100%" />
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              }}
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <Placeholder key={index} height={44} />
              ))}
            </Box>
          </Stack>
        </PlaceholderCard>
        <PlaceholderCard minHeight={320}>
          <Stack spacing={2.5}>
            <Placeholder height={20} width="38%" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Placeholder key={index} height={72} />
            ))}
          </Stack>
        </PlaceholderCard>
      </Box>
    </Stack>
  );
}

function TableVariant() {
  return (
    <Stack spacing={3}>
      <PlaceholderCard minHeight={96}>
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.6fr) repeat(2, minmax(180px, 1fr)) auto",
              },
            }}
          >
            <Placeholder height={42} />
            <Placeholder height={42} />
            <Placeholder height={42} />
            <Placeholder height={42} width={112} />
          </Box>
        </Stack>
      </PlaceholderCard>
      <PlaceholderCard minHeight={420}>
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "2fr 1.2fr 1fr 1fr 0.8fr",
            }}
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <Placeholder key={index} height={16} width="72%" />
            ))}
          </Box>
          {Array.from({ length: 6 }).map((_, index) => (
            <Box
              key={index}
              sx={{
                display: "grid",
                gap: 2,
                alignItems: "center",
                gridTemplateColumns: "2fr 1.2fr 1fr 1fr 0.8fr",
              }}
            >
              <Placeholder height={20} width="84%" />
              <Placeholder height={20} width="72%" />
              <Placeholder height={20} width="66%" />
              <Placeholder height={20} width="58%" />
              <Placeholder height={32} width="100%" />
            </Box>
          ))}
        </Stack>
      </PlaceholderCard>
    </Stack>
  );
}

function FormVariant() {
  return (
    <PlaceholderCard minHeight={520}>
      <Stack spacing={3}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Stack key={index} spacing={1.25}>
              <Placeholder height={14} width="28%" />
              <Placeholder height={44} width="100%" />
            </Stack>
          ))}
        </Box>
        <Stack spacing={1.25}>
          <Placeholder height={14} width="18%" />
          <Placeholder height={180} width="100%" />
        </Stack>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <Placeholder height={120} width="100%" />
          <Placeholder height={120} width="100%" />
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="flex-end"
        >
          <Placeholder height={40} width={108} />
          <Placeholder height={40} width={132} />
        </Stack>
      </Stack>
    </PlaceholderCard>
  );
}

function DefaultVariant() {
  return (
    <Stack spacing={3}>
      <PlaceholderCard minHeight={340}>
        <Stack spacing={2.5}>
          <Placeholder height={220} width="100%" />
          <Placeholder height={18} width="92%" />
          <Placeholder height={18} width="88%" />
          <Placeholder height={18} width="74%" />
          <Placeholder height={18} width="68%" />
        </Stack>
      </PlaceholderCard>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        {Array.from({ length: 2 }).map((_, index) => (
          <PlaceholderCard key={index} minHeight={180}>
            <Stack spacing={2}>
              <Placeholder height={18} width="44%" />
              <Placeholder height={16} width="84%" />
              <Placeholder height={16} width="72%" />
              <Placeholder height={80} width="100%" />
            </Stack>
          </PlaceholderCard>
        ))}
      </Box>
    </Stack>
  );
}

export function PageSkeleton({ variant = "default" }: PageSkeletonProps) {
  const content = {
    dashboard: <DashboardVariant />,
    table: <TableVariant />,
    form: <FormVariant />,
    default: <DefaultVariant />,
  }[variant];

  return (
    <Stack
      data-testid={`page-skeleton-${variant}`}
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
      spacing={3}
      sx={{
        width: "100%",
        minWidth: 0,
        minHeight: ROOT_MIN_HEIGHT[variant],
      }}
    >
      <HeaderBand />
      {content}
    </Stack>
  );
}

export default PageSkeleton;
