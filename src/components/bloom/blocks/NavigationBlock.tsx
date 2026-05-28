import * as React from "react";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, Navigation } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type { NavigationBlockTarget } from "@/components/bloom/blocks/blockTypes";
import {
  formatLabel,
  isRecord,
  readBoolean,
  readString,
  routeForEntityId,
} from "@/components/bloom/blocks/blockUtils";

export interface NavigationBlockProps extends NavigationBlockTarget {}

const targetRoutes: Record<string, string> = {
  analytics: "/analytics",
  campaigns: "/crm/campaigns",
  customers: "/crm/customers",
  dashboard: "/dashboard",
  integrations: "/integrations",
  products: "/products",
  segments: "/crm/segments",
  settings: "/settings",
};

const targetLabels: Record<string, string> = {
  analytics: "Analytics",
  campaign_detail: "Campaign",
  campaigns: "Campaigns",
  customer_detail: "Customer",
  customers: "Customers",
  dashboard: "Dashboard",
  integrations: "Integrations",
  product_detail: "Product",
  products: "Products",
  segment_detail: "Segment",
  segments: "Segments",
  settings: "Settings",
};

function safePath(value: unknown): string | null {
  const path = readString(value);
  return path?.startsWith("/") ? path : null;
}

function pathForTarget(
  target: string | null,
  entityId: string | null,
): string | null {
  if (!target) {
    return null;
  }

  switch (target) {
    case "customer_detail":
      return routeForEntityId("customer", entityId) ?? targetRoutes.customers;
    case "product_detail":
      return routeForEntityId("product", entityId) ?? targetRoutes.products;
    case "campaign_detail":
      return routeForEntityId("campaign", entityId) ?? targetRoutes.campaigns;
    case "segment_detail":
      return routeForEntityId("segment", entityId) ?? targetRoutes.segments;
    default:
      return targetRoutes[target] ?? null;
  }
}

export function normalizeNavigationPayload(
  payload: unknown,
): NavigationBlockTarget | null {
  const source: Record<string, unknown> = isRecord(payload) ? payload : {};
  const dataRecord = isRecord(source.data) ? source.data : null;
  const target = readString(source.target) ?? readString(dataRecord?.target);
  const entityId =
    readString(source.entity_id) ??
    readString(source.entityId) ??
    readString(dataRecord?.entity_id) ??
    readString(dataRecord?.entityId);
  const directPath =
    safePath(source.path) ??
    safePath(source.target_path) ??
    safePath(source.targetPath) ??
    safePath(source.href) ??
    safePath(dataRecord?.path) ??
    safePath(dataRecord?.target_path) ??
    safePath(dataRecord?.targetPath);
  const path = directPath ?? pathForTarget(target, entityId);

  if (!path) {
    return null;
  }

  const fallbackLabel = target
    ? (targetLabels[target] ?? formatLabel(target))
    : "Page";
  return {
    label:
      readString(source.label) ??
      readString(source.title) ??
      readString(dataRecord?.label) ??
      fallbackLabel,
    path,
    target,
    entityId,
    description:
      readString(source.description) ??
      readString(dataRecord?.description) ??
      null,
    autoNavigate:
      readBoolean(source.auto_navigate) ??
      readBoolean(source.autoNavigate) ??
      readBoolean(dataRecord?.auto_navigate) ??
      readBoolean(dataRecord?.autoNavigate) ??
      false,
  };
}

export function NavigationBlock({
  autoNavigate,
  description,
  label,
  path,
  target,
}: NavigationBlockProps) {
  const navigate = useNavigate();
  const navigatedRef = React.useRef(false);

  const navigateToTarget = React.useCallback(() => {
    navigate(path);
  }, [navigate, path]);

  React.useEffect(() => {
    if (!autoNavigate || navigatedRef.current) {
      return;
    }

    navigatedRef.current = true;
    toast.info(`Opening ${label}`);
    navigateToTarget();
  }, [autoNavigate, label, navigateToTarget]);

  return (
    <JoyCard variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <Navigation size={18} strokeWidth={1.8} />
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography
              level="title-sm"
              sx={{ color: "neutral.900", overflowWrap: "anywhere" }}
            >
              {label}
            </Typography>
            <Typography
              level="body-xs"
              sx={{ color: "neutral.500", overflowWrap: "anywhere" }}
            >
              {description ?? path}
            </Typography>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          justifyContent={{ xs: "flex-end", sm: "flex-start" }}
        >
          {target ? (
            <JoyChip color="neutral" size="sm" variant="soft">
              {formatLabel(target)}
            </JoyChip>
          ) : null}
          <JoyButton
            color="neutral"
            size="sm"
            variant="outlined"
            endDecorator={<ArrowRight size={14} strokeWidth={1.9} />}
            onClick={navigateToTarget}
          >
            Open
          </JoyButton>
        </Stack>
      </Stack>
    </JoyCard>
  );
}
