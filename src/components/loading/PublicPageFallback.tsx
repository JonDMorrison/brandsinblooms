import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

interface PublicPageFallbackProps {
  title?: string;
  description?: string;
}

export function PublicPageFallback({
  title = "Loading page",
  description,
}: PublicPageFallbackProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 3, sm: 4 },
        background:
          "radial-gradient(circle at top, rgba(214, 185, 140, 0.18), transparent 42%), linear-gradient(180deg, #fcf7ef 0%, #fffbf5 44%, #ffffff 100%)",
      }}
    >
      <Stack spacing={1.5} alignItems="center" sx={{ textAlign: "center" }}>
        <CircularProgress
          size="lg"
          thickness={3}
          sx={{
            color: "primary.500",
            "--CircularProgress-size": "52px",
          }}
        />
        <Typography level="title-md" sx={{ color: "neutral.900" }}>
          {title}
        </Typography>
        {description ? (
          <Typography
            level="body-sm"
            sx={{ maxWidth: 340, color: "neutral.600" }}
          >
            {description}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

export default PublicPageFallback;
