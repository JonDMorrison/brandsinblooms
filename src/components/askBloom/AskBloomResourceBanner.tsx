import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Lock, X } from "lucide-react";
import { useAskBloom } from "@/providers/AskBloomProvider";
import type { AskBloomResourceType, ResourceFocus } from "@/types/askBloom";

const readSummaryValue = (summary: string, label: string) => {
  const match = summary.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "";
};

const humanizeResourceType = (resourceType: AskBloomResourceType) =>
  resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

const buildCustomerSubtitle = (resourceFocus: ResourceFocus) => {
  const primaryTag =
    readSummaryValue(resourceFocus.resourceSummary, "Tags")
      .split(",")
      .map((value) => value.trim())
      .find((value) => value && value !== "None") ??
    readSummaryValue(resourceFocus.resourceSummary, "Segments")
      .split(",")
      .map((value) => value.trim())
      .find((value) => value && value !== "None") ??
    "Focused view";
  const orders = readSummaryValue(resourceFocus.resourceSummary, "Total Orders");
  return `Customer · ${primaryTag} · ${orders || "0"} orders`;
};

const buildProductSubtitle = (resourceFocus: ResourceFocus) => {
  const category = readSummaryValue(resourceFocus.resourceSummary, "Category");
  const price = readSummaryValue(resourceFocus.resourceSummary, "Price");
  return `Product · ${category || "Catalog"} · ${price || "Price unavailable"}`;
};

const buildOrderSubtitle = (resourceFocus: ResourceFocus) => {
  const status = readSummaryValue(resourceFocus.resourceSummary, "Status");
  const total = readSummaryValue(resourceFocus.resourceSummary, "Total");
  return `Order · ${status || "Status unavailable"} · ${total || "Total unavailable"}`;
};

const buildCampaignSubtitle = (resourceFocus: ResourceFocus) => {
  const status = readSummaryValue(resourceFocus.resourceSummary, "Status");
  const reach = readSummaryValue(resourceFocus.resourceSummary, "Audience Reach");
  return `Campaign · ${status || "Status unavailable"} · ${reach || "Reach unavailable"}`;
};

const buildSubtitle = (resourceFocus: ResourceFocus) => {
  switch (resourceFocus.resourceType) {
    case "customer":
      return buildCustomerSubtitle(resourceFocus);
    case "product":
      return buildProductSubtitle(resourceFocus);
    case "order":
      return buildOrderSubtitle(resourceFocus);
    case "campaign":
      return buildCampaignSubtitle(resourceFocus);
    default:
      return humanizeResourceType(resourceFocus.resourceType);
  }
};

export function AskBloomResourceBanner() {
  const askBloom = useAskBloom();
  const resourceFocus = askBloom.state.resourceFocus;

  if (!resourceFocus) {
    return null;
  }

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.level1",
        flexShrink: 0,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: "999px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.500",
            bgcolor: "background.surface",
            flexShrink: 0,
          }}
        >
          <Lock size={14} strokeWidth={1.5} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography level="title-sm" sx={{ fontWeight: 500 }} noWrap>
            {resourceFocus.resourceLabel}
          </Typography>
          <Typography level="body-xs" sx={{ color: "text.secondary" }} noWrap>
            {buildSubtitle(resourceFocus)}
          </Typography>
        </Box>
        <IconButton
          aria-label="Clear resource focus"
          color="neutral"
          size="sm"
          variant="plain"
          onClick={askBloom.clearResourceFocus}
          sx={{
            width: 24,
            height: 24,
            minWidth: 24,
            minHeight: 24,
            flexShrink: 0,
          }}
        >
          <X size={14} strokeWidth={1.5} />
        </IconButton>
      </Stack>
    </Box>
  );
}
