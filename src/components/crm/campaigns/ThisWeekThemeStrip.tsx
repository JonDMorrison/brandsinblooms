import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThisWeeksTheme } from "@/hooks/useThisWeeksTheme";

/**
 * A single obvious place to start: this week's theme, its photo, one button.
 * Hidden when there is no theme for this week.
 */
export function ThisWeekThemeStrip() {
  const navigate = useNavigate();
  const themeQuery = useThisWeeksTheme();
  const theme = themeQuery.data;
  if (!theme) return null;

  const imageUrl = theme.source.images[0]?.url ?? null;
  const summary = theme.source.seasonalFocus || theme.idea.description;

  return (
    <Sheet
      variant="soft"
      color="primary"
      sx={{
        borderRadius: "lg",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: imageUrl ? "220px 1fr" : "1fr" },
        alignItems: "stretch",
      }}
    >
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt=""
          loading="lazy"
          sx={{ width: "100%", height: { xs: 140, sm: "100%" }, objectFit: "cover", display: "block" }}
        />
      ) : null}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        sx={{ p: { xs: 2, md: 2.5 } }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Sparkles size={14} aria-hidden="true" />
            <Typography level="body-xs" sx={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "lg" }}>
              This week's theme · Week {theme.source.weekNumber}
            </Typography>
          </Stack>
          <Typography level="title-lg">{theme.idea.title}</Typography>
          {summary ? (
            <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 640 }}>
              {summary}
            </Typography>
          ) : null}
        </Stack>
        <Button
          color="primary"
          variant="solid"
          endDecorator={<ArrowRight size={16} aria-hidden="true" />}
          onClick={() => navigate("/crm/campaigns/new?type=email&start=theme")}
          sx={{ flexShrink: 0 }}
        >
          Start this week's email
        </Button>
      </Stack>
    </Sheet>
  );
}
