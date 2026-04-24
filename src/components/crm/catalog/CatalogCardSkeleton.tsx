import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";

export interface CatalogCardSkeletonProps {
  minHeight?: number;
}

export function CatalogCardSkeleton({
  minHeight = 280,
}: CatalogCardSkeletonProps) {
  return (
    <JoyCard
      variant="outlined"
      sx={{
        minHeight,
        borderRadius: "lg",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-xs)",
      }}
    >
      <JoyCardContent
        sx={{ pt: 4, display: "flex", flexDirection: "column", gap: 1.75 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton
            variant="circular"
            width={48}
            height={48}
            animation="wave"
          />
          <Stack spacing={0.75} sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={20} animation="wave" />
            <Skeleton variant="text" width="85%" height={14} animation="wave" />
          </Stack>
        </Stack>

        <Box>
          <Skeleton variant="text" width="90%" height={14} animation="wave" />
          <Skeleton
            variant="text"
            width="70%"
            height={14}
            animation="wave"
            sx={{ mt: 0.5 }}
          />
        </Box>

        <Box>
          <Skeleton
            variant="rectangular"
            width={64}
            height={22}
            animation="wave"
            sx={{ borderRadius: "sm" }}
          />
        </Box>

        <Stack spacing={1.25}>
          <Box>
            <Skeleton variant="text" width={60} height={12} animation="wave" />
            <Skeleton
              variant="text"
              width={100}
              height={16}
              animation="wave"
              sx={{ mt: 0.25 }}
            />
          </Box>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <Box sx={{ minWidth: 110 }}>
              <Skeleton
                variant="text"
                width={80}
                height={12}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width={40}
                height={16}
                animation="wave"
                sx={{ mt: 0.25 }}
              />
            </Box>
            <Box sx={{ minWidth: 110 }}>
              <Skeleton
                variant="text"
                width={70}
                height={12}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width={50}
                height={16}
                animation="wave"
                sx={{ mt: 0.25 }}
              />
            </Box>
          </Stack>
        </Stack>

        <Divider />

        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ mt: "auto" }}
        >
          <Skeleton variant="text" width={80} height={14} animation="wave" />
          <Skeleton variant="text" width={110} height={14} animation="wave" />
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

interface CatalogGridSkeletonProps {
  columns: {
    xs: string;
    md: string;
    xl: string;
  };
  headingWidth?: number;
  cardCount?: number;
  minHeight?: number;
}

export function CatalogGridSkeleton({
  columns,
  headingWidth = 160,
  cardCount = 6,
  minHeight = 280,
}: CatalogGridSkeletonProps) {
  return (
    <Stack spacing={1.5}>
      <Skeleton
        variant="text"
        width={headingWidth}
        height={14}
        animation="wave"
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: columns,
          gap: 2,
        }}
      >
        {Array.from({ length: cardCount }).map((_, index) => (
          <CatalogCardSkeleton key={index} minHeight={minHeight} />
        ))}
      </Box>
    </Stack>
  );
}
