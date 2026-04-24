import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";

function KeyValueSkeletonRows({ count }: { count: number }) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={`detail-skeleton-row:${index}`}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "160px minmax(0, 1fr)" },
            gap: 1,
            alignItems: "start",
          }}
        >
          <Skeleton variant="text" animation="wave" width={104} height={14} />
          <Skeleton
            variant="text"
            animation="wave"
            width={index % 2 === 0 ? "68%" : "56%"}
            height={14}
          />
        </Box>
      ))}
    </Stack>
  );
}

export default function ActivityDetailSkeleton() {
  return (
    <Stack spacing={2.5}>
      <JoyCard>
        <JoyCardHeader
          startDecorator={
            <Skeleton
              variant="circular"
              animation="wave"
              width={42}
              height={42}
            />
          }
          title={
            <Skeleton variant="text" animation="wave" width={220} height={24} />
          }
          description={
            <Skeleton variant="text" animation="wave" width={280} height={14} />
          }
          actions={
            <Skeleton
              variant="rectangular"
              animation="wave"
              width={112}
              height={32}
              sx={{ borderRadius: "sm" }}
            />
          }
        >
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ pt: 1 }}
          >
            <Skeleton
              variant="rectangular"
              animation="wave"
              width={72}
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
            <Skeleton
              variant="rectangular"
              animation="wave"
              width={68}
              height={24}
              sx={{ borderRadius: "999px" }}
            />
            <Skeleton
              variant="rectangular"
              animation="wave"
              width={110}
              height={24}
              sx={{ borderRadius: "999px" }}
            />
          </Stack>
        </JoyCardHeader>
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <Box>
              <Skeleton
                variant="text"
                animation="wave"
                width={132}
                height={18}
              />
              <Stack spacing={0.5} sx={{ mt: 1.25 }}>
                <Skeleton
                  variant="text"
                  animation="wave"
                  width="88%"
                  height={16}
                />
                <Skeleton
                  variant="text"
                  animation="wave"
                  width="63%"
                  height={16}
                />
              </Stack>
            </Box>
          </Stack>
        </JoyCardContent>
      </JoyCard>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 2.5,
        }}
      >
        <JoyCard>
          <JoyCardHeader
            title={
              <Skeleton
                variant="text"
                animation="wave"
                width={96}
                height={18}
              />
            }
          />
          <JoyCardContent sx={{ pt: 3 }}>
            <KeyValueSkeletonRows count={4} />
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title={
              <Skeleton
                variant="text"
                animation="wave"
                width={72}
                height={18}
              />
            }
          />
          <JoyCardContent sx={{ pt: 3 }}>
            <KeyValueSkeletonRows count={2} />
          </JoyCardContent>
        </JoyCard>
      </Box>

      <JoyCard>
        <JoyCardHeader
          title={
            <Skeleton variant="text" animation="wave" width={136} height={18} />
          }
        />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.25}>
            <Skeleton variant="text" animation="wave" width={200} height={16} />
          </Stack>
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
}
