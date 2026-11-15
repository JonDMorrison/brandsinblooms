import { forwardRef } from "react";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ArrowUpRight, BookOpen } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import type { HubConnectionInsight } from "./connectionsModel";
import { DataScopeTags, HealthChip, IntegrationLogo, RelativeTime } from "./ConnectionsPrimitives";
import { interactiveSurfaceSx, softPressSx } from "./connectionsStyles";

interface HubConnectionCardProps {
  insight: HubConnectionInsight;
}

/**
 * A connection that lives in its own provider table (e.g. Lightspeed X-Series).
 * Sync and disconnect stay on the provider's Integration Hub page; this card
 * reports health and links there.
 */
export const HubConnectionCard = forwardRef<HTMLDivElement, HubConnectionCardProps>(({ insight }, ref) => {
  const { name, platformName, category, logo, dataScopes, health, lastSuccessAt, totalsSummary, attentionSummary } =
    insight;

  return (
    <Sheet
      ref={ref}
      aria-label={`${name} connection`}
      component="article"
      tabIndex={-1}
      variant="outlined"
      sx={{
        ...interactiveSurfaceSx,
        borderColor: health === "attention" ? "danger.outlinedBorder" : "neutral.outlinedBorder",
        "&:focus-visible": { outline: "2px solid", outlineColor: "focusVisible", outlineOffset: 2 },
      }}
    >
      <Stack spacing={2} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "flex-start" }}
        >
          <Stack direction="row" spacing={1.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <IntegrationLogo logo={logo} name={platformName} />
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Typography level="title-md" sx={{ color: "text.primary", wordBreak: "break-word" }}>
                  {name}
                </Typography>
                <HealthChip health={health} />
              </Stack>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                {platformName !== name ? `${platformName} · ` : ""}
                {category}
              </Typography>
            </Stack>
          </Stack>

          <Button
            color="neutral"
            component={RouterLink}
            endDecorator={<ArrowUpRight size={15} />}
            size="sm"
            sx={{ ...softPressSx, flexShrink: 0 }}
            to={insight.managePath}
            variant="outlined"
          >
            Manage
          </Button>
        </Stack>

        <Stack spacing={0.75} sx={{ pl: { sm: "54px" }, minWidth: 0 }}>
          <Typography level="body-sm" sx={{ color: "text.primary" }}>
            {lastSuccessAt ? (
              <>
                <RelativeTime
                  component="span"
                  level="body-sm"
                  prefix="Last synced"
                  sx={{ color: "inherit" }}
                  value={lastSuccessAt}
                />
                {totalsSummary ? (
                  <Typography component="span" sx={{ color: "text.secondary" }}>
                    {" "}· {totalsSummary}
                  </Typography>
                ) : null}
              </>
            ) : health === "attention" ? (
              "Not syncing right now."
            ) : (
              "Connected. The first sync will bring in customers, products and sales."
            )}
          </Typography>
          <DataScopeTags scopes={dataScopes} />
        </Stack>

        {attentionSummary ? (
          <Alert
            color="danger"
            startDecorator={<AlertTriangle size={18} />}
            sx={{ alignItems: "flex-start", borderRadius: "14px", ml: { sm: "54px" } }}
            variant="soft"
          >
            <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
              <Typography level="body-sm" sx={{ color: "inherit" }}>
                {attentionSummary}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Button color="danger" component={RouterLink} size="sm" sx={softPressSx} to={insight.reconnectPath}>
                  Reconnect
                </Button>
                <Button
                  color="danger"
                  component={RouterLink}
                  size="sm"
                  startDecorator={<BookOpen size={15} />}
                  sx={softPressSx}
                  to={insight.guidePath}
                  variant="plain"
                >
                  Setup guide
                </Button>
              </Stack>
            </Stack>
          </Alert>
        ) : null}
      </Stack>
    </Sheet>
  );
});

HubConnectionCard.displayName = "HubConnectionCard";
