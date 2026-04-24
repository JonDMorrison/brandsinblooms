import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";

function DateSeparatorSkeleton() {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Divider sx={{ flex: 1 }} />
      <Skeleton
        variant="rectangular"
        animation="wave"
        width={96}
        height={24}
        sx={{ borderRadius: "999px", flexShrink: 0 }}
      />
      <Divider sx={{ flex: 1 }} />
    </Stack>
  );
}

function EventRowSkeleton({
  titleWidth,
  descriptionWidth,
}: {
  titleWidth: string;
  descriptionWidth: string;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "24px minmax(0, 1fr)",
          md: "72px 24px minmax(0, 1fr)",
        },
        gap: 2,
        alignItems: "stretch",
      }}
    >
      <Box sx={{ display: { xs: "none", md: "block" }, pt: 0.75 }}>
        <Skeleton variant="text" animation="wave" width={44} height={16} />
      </Box>

      <Box
        sx={{ position: "relative", display: "flex", justifyContent: "center" }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -18,
            bottom: -18,
            width: "1px",
            backgroundColor: "divider",
          }}
        />
        <Box sx={{ position: "relative", pt: 0.5 }}>
          <Skeleton
            variant="circular"
            animation="wave"
            width={28}
            height={28}
          />
        </Box>
      </Box>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "xl",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          px: { xs: 2, md: 2.5 },
          py: { xs: 1.75, md: 2.25 },
          boxShadow: "sm",
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            justifyContent="space-between"
          >
            <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                useFlexGap
                flexWrap="wrap"
              >
                <Skeleton
                  variant="text"
                  animation="wave"
                  width={titleWidth}
                  height={24}
                  sx={{ maxWidth: { xs: "60%", md: "42%" } }}
                />
                <Skeleton
                  variant="rectangular"
                  animation="wave"
                  width={108}
                  height={24}
                  sx={{ borderRadius: "999px" }}
                />
                <Skeleton
                  variant="rectangular"
                  animation="wave"
                  width={84}
                  height={24}
                  sx={{ borderRadius: "999px" }}
                />
                <Skeleton
                  variant="rectangular"
                  animation="wave"
                  width={72}
                  height={24}
                  sx={{ borderRadius: "999px" }}
                />
              </Stack>

              <Skeleton
                variant="text"
                animation="wave"
                width={136}
                height={14}
                sx={{ display: { xs: "block", md: "none" } }}
              />
            </Stack>

            <Skeleton
              variant="circular"
              animation="wave"
              width={28}
              height={28}
              sx={{ flexShrink: 0 }}
            />
          </Stack>

          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Skeleton
              variant="text"
              animation="wave"
              width={descriptionWidth}
              height={16}
            />
            <Skeleton variant="text" animation="wave" width="58%" height={16} />
          </Stack>
        </Stack>
      </Sheet>
    </Box>
  );
}

export default function ActivityFeedSkeleton() {
  return (
    <Stack spacing={2.25}>
      <DateSeparatorSkeleton />
      <EventRowSkeleton titleWidth="42%" descriptionWidth="74%" />
      <EventRowSkeleton titleWidth="36%" descriptionWidth="67%" />
      <EventRowSkeleton titleWidth="48%" descriptionWidth="71%" />
      <DateSeparatorSkeleton />
      <EventRowSkeleton titleWidth="40%" descriptionWidth="69%" />
      <EventRowSkeleton titleWidth="34%" descriptionWidth="62%" />
    </Stack>
  );
}
