import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

interface CompanyProfileLoadingStateProps {
  label?: string;
}

export const CompanyProfileLoadingState = ({
  label,
}: CompanyProfileLoadingStateProps) => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: "xl",
        bgcolor: "background.surface",
        minHeight: { xs: 720, md: 820 },
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={3} sx={{ flex: 1 }}>
        <LinearProgress color="primary" size="sm" sx={{ borderRadius: "sm" }} variant="soft" />

        <Stack spacing={0.75}>
          <Typography level="title-lg">Company Information</Typography>
          <Typography level="body-sm" textColor="text.secondary">
            {label ?? "Generating your company profile from onboarding data..."}
          </Typography>
        </Stack>

        <Stack spacing={2} sx={{ flex: 1 }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Stack key={index} spacing={0.75}>
              <Skeleton
                animation="wave"
                sx={{ width: index % 3 === 0 ? 120 : index % 3 === 1 ? 144 : 110, height: 14 }}
                variant="text"
              />
              <Skeleton
                animation="wave"
                sx={{
                  width: "100%",
                  height: index === 2 || index === 5 ? 116 : 46,
                  borderRadius: "lg",
                }}
                variant="rectangular"
              />
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Sheet>
  );
};
