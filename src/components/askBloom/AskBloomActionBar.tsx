import Button from "@mui/joy/Button";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import {
  BarChart3,
  DollarSign,
  Layers,
  Mail,
  Package,
  PenLine,
  RefreshCcw,
  ShoppingBag,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useAskBloom } from "@/providers/AskBloomProvider";
import type { AskBloomResourceType } from "@/types/askBloom";

type ActionDefinition = {
  label: string;
  prompt: string;
  icon: LucideIcon;
  variant?: "plain" | "soft";
  color?: "neutral" | "primary";
};

const ACTIONS_BY_RESOURCE: Partial<
  Record<AskBloomResourceType, ActionDefinition[]>
> = {
  customer: [
    {
      label: "Send Email",
      prompt: "Draft a personalized email to send to this customer.",
      icon: Mail,
    },
    {
      label: "Add Tag",
      prompt:
        "Help me add a tag to this customer. What tags would be appropriate?",
      icon: Tags,
    },
    {
      label: "View Orders",
      prompt: "Show me this customer's complete order history.",
      icon: ShoppingBag,
    },
  ],
  product: [
    {
      label: "Check Stock",
      prompt: "What's the current stock status for this product and all its variants?",
      icon: Package,
    },
    {
      label: "Edit Description",
      prompt: "Help me improve this product's description for the storefront.",
      icon: PenLine,
    },
    {
      label: "Price Analysis",
      prompt:
        "Analyze this product's pricing relative to similar products and suggest adjustments.",
      icon: DollarSign,
    },
  ],
  order: [
    {
      label: "Update Status",
      prompt: "Help me update this order's status. What are the next steps?",
      icon: RefreshCcw,
    },
    {
      label: "Contact Customer",
      prompt: "Draft a message to the customer about this order.",
      icon: Mail,
    },
    {
      label: "Refund",
      prompt: "Walk me through processing a refund for this order.",
      icon: DollarSign,
    },
  ],
  campaign: [
    {
      label: "View Results",
      prompt: "Give me a detailed performance breakdown of this campaign.",
      icon: BarChart3,
    },
    {
      label: "Duplicate",
      prompt:
        "Help me create a new campaign based on this one with improvements.",
      icon: Package,
    },
    {
      label: "A/B Ideas",
      prompt: "Suggest A/B test variations for this campaign.",
      icon: Truck,
    },
  ],
};

export function AskBloomActionBar() {
  const askBloom = useAskBloom();
  const resourceFocus = askBloom.state.resourceFocus;

  if (!resourceFocus) {
    return null;
  }

  const resourceActions = ACTIONS_BY_RESOURCE[resourceFocus.resourceType] ?? [];
  if (resourceActions.length === 0) {
    return null;
  }

  const actions: ActionDefinition[] = [
    ...resourceActions,
    {
      label: "Full picture",
      prompt: `Give me the full picture of this ${resourceFocus.resourceType}. Run every relevant analysis - profile, history, engagement, performance, trends, and recommendations. Be thorough.`,
      icon: Layers,
      variant: "soft",
      color: "primary",
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        overflowX: "auto",
        whiteSpace: "nowrap",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant ?? "plain"}
            color={action.color ?? "neutral"}
            startDecorator={<Icon size={14} strokeWidth={1.8} />}
            onClick={() => askBloom.sendMessage(action.prompt)}
            sx={{ flexShrink: 0 }}
          >
            <Typography level="body-xs">{action.label}</Typography>
          </Button>
        );
      })}
    </Box>
  );
}
