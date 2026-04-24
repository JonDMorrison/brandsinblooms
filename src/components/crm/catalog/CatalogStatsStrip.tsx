import * as React from "react";
import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import type { ColorPaletteProp } from "@mui/joy/styles";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyStatCard } from "@/components/joy/JoyStatCard";

export interface CatalogStatsStripItem {
  label: React.ReactNode;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconColor?: ColorPaletteProp;
}

interface CatalogStatsStripProps {
  items: CatalogStatsStripItem[];
}

const getStatsGridColumns = (itemCount: number) => {
  if (itemCount <= 1) {
    return {
      xs: "minmax(0, 1fr)",
    };
  }

  if (itemCount === 2) {
    return {
      xs: "minmax(0, 1fr)",
      md: "repeat(2, minmax(0, 1fr))",
    };
  }

  if (itemCount === 3) {
    return {
      xs: "minmax(0, 1fr)",
      md: "repeat(3, minmax(0, 1fr))",
    };
  }

  return {
    xs: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(4, minmax(0, 1fr))",
  };
};

export function CatalogStatsStrip({ items }: CatalogStatsStripProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: getStatsGridColumns(items.length),
        gap: 3,
      }}
    >
      {items.map((item, index) => (
        <JoyStatCard
          key={typeof item.label === "string" ? item.label : `stat-${index}`}
          icon={item.icon}
          iconColor={item.iconColor ?? "neutral"}
          label={item.label}
          value={item.value}
        />
      ))}
    </Box>
  );
}

interface CatalogStatsStripSkeletonProps {
  itemCount?: number;
}

export function CatalogStatsStripSkeleton({
  itemCount = 4,
}: CatalogStatsStripSkeletonProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: getStatsGridColumns(itemCount),
        gap: 3,
      }}
    >
      {Array.from({ length: itemCount }).map((_, index) => (
        <JoyCard key={index}>
          <JoyCardContent sx={{ pt: 4 }}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
              justifyContent="space-between"
            >
              <Stack spacing={0.75}>
                <Skeleton
                  variant="text"
                  width={96}
                  height={14}
                  animation="wave"
                />
                <Skeleton
                  variant="text"
                  width={56}
                  height={42}
                  animation="wave"
                />
              </Stack>
              <Skeleton
                variant="circular"
                width={40}
                height={40}
                animation="wave"
              />
            </Stack>
          </JoyCardContent>
        </JoyCard>
      ))}
    </Box>
  );
}
