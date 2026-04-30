import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { PageContainer } from "@/components/joy/PageContainer";

const SKELETON_CARD_COUNT = 8;

function IntegrationSkeletonCard() {
  return (
    <Sheet
      color="neutral"
      data-testid="integration-skeleton-card"
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.75,
        minHeight: 248,
        p: 2.5,
        borderRadius: "xl",
        borderColor: "neutral.200",
        boxShadow: "sm",
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Skeleton
          sx={{ width: 44, height: 44, borderRadius: "50%" }}
          variant="circular"
        />
        <Skeleton
          sx={{ width: 76, height: 28, borderRadius: 999 }}
          variant="rectangular"
        />
      </Stack>

      <Stack spacing={1}>
        <Typography level="title-md">
          <Skeleton width="58%">Integration</Skeleton>
        </Typography>
        <Skeleton
          sx={{ width: 84, height: 24, borderRadius: 999 }}
          variant="rectangular"
        />
        <Typography level="body-sm">
          <Skeleton>Browse integration details.</Skeleton>
        </Typography>
        <Typography level="body-sm">
          <Skeleton width="72%">Sync commerce data.</Skeleton>
        </Typography>
      </Stack>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1.5}
        sx={{ mt: "auto", pt: 0.5 }}
      >
        <Skeleton
          sx={{ width: 104, height: 28, borderRadius: 999 }}
          variant="rectangular"
        />
        <Typography level="body-xs">
          <Skeleton width={72}>Updated recently</Skeleton>
        </Typography>
      </Stack>
    </Sheet>
  );
}

type IntegrationsSkeletonLoaderProps = {
  canUseActions: boolean;
  showFilters?: boolean;
};

export function IntegrationsSkeletonLoader({
  canUseActions,
  showFilters = true,
}: IntegrationsSkeletonLoaderProps) {
  return (
    <PageContainer
      data-testid="integrations-skeleton-loader"
      fullWidth
      aria-busy="true"
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
    >
      <Stack spacing={3}>
        <Sheet
          color="neutral"
          variant="soft"
          sx={{
            borderRadius: "xl",
            border: "1px solid",
            borderColor: "neutral.200",
            p: { xs: 2.5, md: 3 },
            bgcolor: "background.level1",
          }}
        >
          <Stack spacing={1.25} sx={{ maxWidth: 760 }}>
            <Skeleton
              sx={{ width: 132, height: 16, borderRadius: 999 }}
              variant="rectangular"
            />
            <Skeleton
              sx={{ width: { xs: "58%", md: "38%" }, height: 36, borderRadius: "md" }}
              variant="rectangular"
            />
            <Skeleton
              sx={{ width: "92%", height: 16, borderRadius: 999 }}
              variant="rectangular"
            />
          </Stack>
        </Sheet>

        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", xl: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", xl: "center" }}
          >
            <Skeleton
              sx={{ height: 42, flex: 1, borderRadius: "md" }}
              variant="rectangular"
            />

            {showFilters ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    sx={{ width: 88, height: 32, borderRadius: 999 }}
                    variant="rectangular"
                  />
                ))}
              </Box>
            ) : null}

            {canUseActions ? (
              <Box
                data-testid="integrations-skeleton-actions"
                sx={{ display: "flex", gap: 1, ml: { xl: "auto" } }}
              >
                <Skeleton
                  sx={{ width: 182, height: 36, borderRadius: "md" }}
                  variant="rectangular"
                />
                <Skeleton
                  sx={{ width: 168, height: 36, borderRadius: "md" }}
                  variant="rectangular"
                />
              </Box>
            ) : null}
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
            <IntegrationSkeletonCard key={index} />
          ))}
        </Box>
      </Stack>
    </PageContainer>
  );
}
