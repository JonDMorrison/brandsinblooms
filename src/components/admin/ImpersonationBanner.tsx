import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { TriangleAlert } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { useImpersonation } from "@/hooks/useImpersonation";

const BANNER_HEIGHT = 40;

export const ImpersonationBanner = () => {
  const { endImpersonation, isImpersonating, targetEmail } = useImpersonation();

  if (!isImpersonating) {
    return null;
  }

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: BANNER_HEIGHT,
          backgroundColor: "warning.100",
          borderBottom: "1px solid",
          borderColor: "warning.300",
          color: "warning.900",
          px: { xs: 1.5, sm: 2 },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
          sx={{ height: "100%" }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <TriangleAlert className="h-4 w-4" />
            <Typography
              level="body-sm"
              sx={{
                fontWeight: "lg",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {`Impersonating: ${targetEmail ?? "Unknown user"}`}
            </Typography>
          </Stack>

          <JoyButton color="warning" onClick={endImpersonation} size="sm">
            End Impersonation
          </JoyButton>
        </Stack>
      </Box>

      <Box aria-hidden="true" sx={{ height: BANNER_HEIGHT }} />
    </>
  );
};
