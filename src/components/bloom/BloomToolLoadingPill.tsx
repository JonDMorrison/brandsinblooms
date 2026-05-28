import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";
import { AnimatePresence, motion } from "framer-motion";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyChip } from "@/components/joy/JoyChip";

export interface BloomToolLoadingPillProps {
  toolName: string;
  description: string;
  isActive: boolean;
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  create_campaign: "Preparing campaign...",
  generate_content: "Generating content...",
  generate_image: "Creating image...",
  get_customer_detail: "Loading customer details...",
  get_dashboard_summary: "Fetching dashboard data...",
  get_revenue_analytics: "Analyzing revenue...",
  query_customers: "Searching customers...",
  query_products: "Looking up products...",
};

function toolDescription(toolName: string, description: string) {
  return (
    description.trim() || TOOL_DESCRIPTIONS[toolName] || "Working on it..."
  );
}

export function BloomToolLoadingPill({
  description,
  isActive,
  toolName,
}: BloomToolLoadingPillProps) {
  const reducedMotion = useBloomReducedMotion();

  if (!isActive) {
    return null;
  }

  const chip = (
    <JoyChip
      color="neutral"
      size="md"
      variant="soft"
      startDecorator={
        reducedMotion ? (
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: "neutral.500",
            }}
          />
        ) : (
          <CircularProgress
            size="sm"
            thickness={2.5}
            sx={{
              color: "neutral.500",
              "--CircularProgress-size": "16px",
            }}
          />
        )
      }
      sx={{
        maxWidth: "100%",
        minHeight: 34,
        px: 1.25,
        backgroundColor: "background.level1",
        border: "1px solid",
        borderColor: "neutral.200",
        "& .MuiChip-label": {
          minWidth: 0,
        },
      }}
    >
      <Typography
        level="body-xs"
        sx={{
          color: "neutral.700",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {toolDescription(toolName, description)}
      </Typography>
    </JoyChip>
  );

  if (reducedMotion) {
    return chip;
  }

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={toolName}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={{ display: "inline-flex", maxWidth: "100%" }}
      >
        {chip}
      </motion.div>
    </AnimatePresence>
  );
}
