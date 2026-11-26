import Box from "@mui/joy/Box";
import ChipDelete from "@mui/joy/ChipDelete";
import Typography from "@mui/joy/Typography";
import { Lock, X } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import { useAskBloom } from "@/providers/AskBloomProvider";
import type { AskBloomResourceType, ResourceFocus } from "@/types/askBloom";
import { describeCustomerOrders } from "@/utils/askBloomContextBuilders";

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
  return `Customer · ${primaryTag} · ${describeCustomerOrders(resourceFocus.resourceSummary)}`;
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
  const reach = readSummaryValue(
    resourceFocus.resourceSummary,
    "Audience Reach",
  );
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

/**
 * The drawer's page-context pill ("About: Sarah Tremblay"). It reflects the
 * resource the conversation is focused on; removing it clears the focus so the
 * next message is a general question.
 */
export function AskBloomResourceBanner() {
  const askBloom = useAskBloom();
  const resourceFocus = askBloom.state.resourceFocus;

  if (!resourceFocus) {
    return null;
  }

  const pillLabel = `About: ${resourceFocus.resourceLabel}`;

  return (
    <Box
      data-testid="ask-bloom-context-pill"
      sx={{
        px: 1.5,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 0,
        borderBottom: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
      }}
    >
      <JoyChip
        color="primary"
        size="md"
        variant="soft"
        title={pillLabel}
        startDecorator={<Lock size={13} strokeWidth={1.6} aria-hidden="true" />}
        endDecorator={
          <ChipDelete
            aria-label={`Remove context: ${resourceFocus.resourceLabel}`}
            onDelete={askBloom.clearResourceFocus}
          >
            <X size={12} strokeWidth={2} aria-hidden="true" />
          </ChipDelete>
        }
        sx={{ maxWidth: "62%", flexShrink: 0 }}
      >
        <Typography
          noWrap
          component="span"
          sx={{ color: "inherit", fontSize: "13px", fontWeight: 600 }}
        >
          {pillLabel}
        </Typography>
      </JoyChip>
      <Typography
        level="body-xs"
        noWrap
        sx={{ color: "text.secondary", minWidth: 0 }}
      >
        {buildSubtitle(resourceFocus)}
      </Typography>
    </Box>
  );
}
