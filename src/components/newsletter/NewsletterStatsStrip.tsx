import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

export interface NewsletterStatItem {
  label: string;
  value: string;
}

interface NewsletterStatsStripProps {
  items: NewsletterStatItem[];
}

function NewsletterStatCell({ label, value }: NewsletterStatItem) {
  return (
    <Stack
      spacing={0.5}
      sx={{
        minWidth: 0,
        px: { xs: 0, md: 2.25 },
        py: { xs: 0, md: 0.5 },
      }}
    >
      <Typography level="title-lg" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        {label}
      </Typography>
    </Stack>
  );
}

export function NewsletterStatsStrip({ items }: NewsletterStatsStripProps) {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        borderRadius: "xl",
        border: "1px solid",
        borderColor: "neutral.200",
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 2.25 },
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(241, 245, 249, 0.92) 100%)",
      }}
    >
      <Box
        sx={{
          display: { xs: "grid", md: "none" },
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 2,
        }}
      >
        {items.map((item) => (
          <NewsletterStatCell key={item.label} {...item} />
        ))}
      </Box>

      <Stack
        direction="row"
        spacing={0}
        divider={
          <Divider
            orientation="vertical"
            sx={{ borderColor: "rgba(148, 163, 184, 0.18)" }}
          />
        }
        sx={{ display: { xs: "none", md: "flex" } }}
      >
        {items.map((item) => (
          <Box key={item.label} sx={{ flex: 1, minWidth: 0 }}>
            <NewsletterStatCell {...item} />
          </Box>
        ))}
      </Stack>
    </Sheet>
  );
}

interface NewsletterStatsStripSkeletonProps {
  itemCount?: number;
}

export function NewsletterStatsStripSkeleton({
  itemCount = 5,
}: NewsletterStatsStripSkeletonProps) {
  const items = Array.from({ length: itemCount });

  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        borderRadius: "xl",
        border: "1px solid",
        borderColor: "neutral.200",
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 2.25 },
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(241, 245, 249, 0.92) 100%)",
      }}
    >
      <Box
        sx={{
          display: { xs: "grid", md: "none" },
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 2,
        }}
      >
        {items.map((_, index) => (
          <Stack key={index} spacing={0.75}>
            <Skeleton variant="text" width="58%" height={28} animation="wave" />
            <Skeleton variant="text" width="72%" height={12} animation="wave" />
          </Stack>
        ))}
      </Box>

      <Stack
        direction="row"
        spacing={0}
        divider={
          <Divider
            orientation="vertical"
            sx={{ borderColor: "rgba(148, 163, 184, 0.18)" }}
          />
        }
        sx={{ display: { xs: "none", md: "flex" } }}
      >
        {items.map((_, index) => (
          <Box key={index} sx={{ flex: 1, minWidth: 0, px: 2.25, py: 0.5 }}>
            <Stack spacing={0.75}>
              <Skeleton
                variant="text"
                width="44%"
                height={30}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width="68%"
                height={12}
                animation="wave"
              />
            </Stack>
          </Box>
        ))}
      </Stack>
    </Sheet>
  );
}
