import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BarChart3,
  Copy,
  Download,
  Eye,
  MailCheck,
  Megaphone,
  MousePointerClick,
  Package,
  PauseCircle,
  Pencil,
  Pin,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import type {
  BloomBlockAction,
  DataCardEntityType,
} from "@/components/bloom/blocks/blockTypes";
import {
  customerName,
  entityDisplayName,
  extractStringList,
  formatCurrencyValue,
  formatDateValue,
  formatLabel,
  formatNumberValue,
  formatPercentValue,
  getRecordValue,
  initialsForName,
  neutralAvatarBackground,
  primaryProductImageUrl,
  readEntityIdFromRecord,
  readNumber,
  readString,
  statusTone,
} from "@/components/bloom/blocks/blockUtils";
import { useBloomProfile } from "@/hooks/bloom/useBloomProfile";
import { useBloomProfileMutations } from "@/hooks/bloom/useBloomProfileMutations";
import {
  MAX_PINNED_CONTEXT_ITEMS,
  normalizeBloomWorkspaceMemory,
} from "@/hooks/bloom/workspaceMemory";

export interface DataCardBlockProps {
  entityType: DataCardEntityType;
  entity: Record<string, unknown>;
  actions: BloomBlockAction[];
  onAction: (prompt: string) => void;
}

const MAX_PINNED_CONTEXT_TOOLTIP = "Maximum 3 pins reached";

function actionIconFor(action: BloomBlockAction): LucideIcon {
  const token = `${action.icon ?? ""} ${action.label}`.toLowerCase();
  if (token.includes("download")) return Download;
  if (token.includes("order")) return ShoppingBag;
  if (token.includes("campaign")) return Megaphone;
  if (token.includes("tag")) return Tag;
  if (
    token.includes("price") ||
    token.includes("edit") ||
    token.includes("update")
  )
    return Pencil;
  if (token.includes("description") || token.includes("generate"))
    return Sparkles;
  if (token.includes("report")) return BarChart3;
  if (token.includes("clone")) return Copy;
  if (token.includes("pause") || token.includes("resume")) return PauseCircle;
  if (token.includes("member")) return Users;
  return Eye;
}

function isAnchorAction(action: BloomBlockAction): boolean {
  return Boolean(action.url) && action.type !== "prompt";
}

function PinActionButton({
  entityId,
  entityName,
  entityType,
  preferOutlined,
}: {
  entityId: string;
  entityName: string;
  entityType: DataCardEntityType;
  preferOutlined: boolean;
}) {
  const profileQuery = useBloomProfile();
  const { isPinningEntity, isUnpinningEntity, pinEntity, unpinEntity } =
    useBloomProfileMutations();
  const pinnedContext = React.useMemo(
    () =>
      normalizeBloomWorkspaceMemory(profileQuery.data?.workspaceMemory)
        .pinnedContext,
    [profileQuery.data?.workspaceMemory],
  );
  const isPinned = pinnedContext.some(
    (entry) => entry.entityType === entityType && entry.entityId === entityId,
  );
  const hasReachedPinLimit =
    !isPinned && pinnedContext.length >= MAX_PINNED_CONTEXT_ITEMS;
  const isMutatingPinnedContext = isPinningEntity || isUnpinningEntity;

  const handleClick = React.useCallback(() => {
    if (hasReachedPinLimit || isMutatingPinnedContext) {
      return;
    }

    if (isPinned) {
      void unpinEntity(entityType, entityId).catch(() => undefined);
      return;
    }

    void pinEntity(entityType, entityId, entityName).catch(() => undefined);
  }, [
    entityId,
    entityName,
    entityType,
    hasReachedPinLimit,
    isMutatingPinnedContext,
    isPinned,
    pinEntity,
    unpinEntity,
  ]);

  const button = (
    <JoyButton
      aria-label={`${isPinned ? "Unpin" : "Pin"} ${entityName}`}
      color="neutral"
      size="sm"
      variant={isPinned || preferOutlined ? "outlined" : "plain"}
      disabled={hasReachedPinLimit || isMutatingPinnedContext}
      startDecorator={
        <Pin
          size={14}
          strokeWidth={1.9}
          fill={isPinned ? "currentColor" : "none"}
        />
      }
      onClick={handleClick}
    >
      {isPinned ? "Unpin" : "Pin"}
    </JoyButton>
  );

  if (!hasReachedPinLimit) {
    return button;
  }

  return (
    <JoyTooltip title={MAX_PINNED_CONTEXT_TOOLTIP}>
      <Box component="span">{button}</Box>
    </JoyTooltip>
  );
}

function ActionBar({
  actions,
  entity,
  entityType,
  onAction,
}: {
  actions: BloomBlockAction[];
  entity: Record<string, unknown>;
  entityType: DataCardEntityType;
  onAction: (prompt: string) => void;
}) {
  const entityId = readEntityIdFromRecord(entity);
  const entityName = entityDisplayName(entityType, entity);

  if (actions.length === 0 && !entityId) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {actions.map((action, index) => {
        const Icon = actionIconFor(action);
        const commonProps = {
          key: `${action.label}-${index}`,
          size: "sm" as const,
          startDecorator: <Icon size={14} strokeWidth={1.9} />,
        };

        if (isAnchorAction(action) && action.url) {
          return (
            <JoyButton
              {...commonProps}
              color={action.type === "download" ? "primary" : "neutral"}
              component="a"
              download={
                action.type === "download"
                  ? (action.downloadFileName ?? true)
                  : undefined
              }
              href={action.url}
              rel="noopener noreferrer"
              target="_blank"
              variant={index === 0 ? "soft" : "plain"}
            >
              {action.label}
            </JoyButton>
          );
        }

        return (
          <JoyButton
            {...commonProps}
            color="neutral"
            variant={index === 0 ? "outlined" : "plain"}
            onClick={() => onAction(action.prompt)}
          >
            {action.label}
          </JoyButton>
        );
      })}
      {entityId ? (
        <PinActionButton
          entityId={entityId}
          entityName={entityName}
          entityType={entityType}
          preferOutlined={actions.length === 0}
        />
      ) : null}
    </Stack>
  );
}

function EntityCardShell({
  actions,
  children,
  entity,
  entityType,
  onAction,
}: {
  actions: BloomBlockAction[];
  children: React.ReactNode;
  entity: Record<string, unknown>;
  entityType: DataCardEntityType;
  onAction: (prompt: string) => void;
}) {
  return (
    <JoyCard
      interactive
      variant="outlined"
      sx={{
        width: "100%",
        p: 0,
      }}
    >
      <Stack spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
        {children}
        <Divider
          sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
        />
        <ActionBar
          actions={actions}
          entity={entity}
          entityType={entityType}
          onAction={onAction}
        />
      </Stack>
    </JoyCard>
  );
}

function CustomerCard({
  actions,
  entity,
  onAction,
}: Omit<DataCardBlockProps, "entityType">) {
  const name = customerName(entity) ?? "Unnamed customer";
  const totalSpent = getRecordValue(entity, "total_spent");
  const lastPurchase = getRecordValue(entity, "last_order");
  const orderCount =
    getRecordValue(entity, "purchase_metrics.order_count") ??
    entity.order_count ??
    entity.orders_count;
  const personaNames = extractStringList(entity, [
    "persona_names",
    "persona",
    "persona_name",
  ]);
  const segmentNames = extractStringList(entity, ["segment_names", "segments"]);
  const tagNames = extractStringList(entity, ["tag_names", "tags"]);

  return (
    <EntityCardShell
      actions={actions}
      entity={entity}
      entityType="customer"
      onAction={onAction}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
      >
        <Stack direction="row" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
          <Avatar
            variant="soft"
            color="neutral"
            sx={{
              width: 44,
              height: 44,
              bgcolor: neutralAvatarBackground(name),
              color: "neutral.800",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initialsForName(name)}
          </Avatar>
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography level="title-sm" sx={{ color: "neutral.900" }}>
              {name}
            </Typography>
            <Typography
              level="body-xs"
              sx={{ color: "neutral.500", overflowWrap: "anywhere" }}
            >
              {readString(entity.email) ?? "No email"}
            </Typography>
            <Typography level="body-xs" sx={{ color: "neutral.600" }}>
              {readString(entity.phone) ?? "No phone"}
            </Typography>
          </Stack>
        </Stack>

        <Stack
          spacing={0.35}
          alignItems={{ xs: "flex-start", sm: "flex-end" }}
          sx={{ flexShrink: 0, minWidth: { sm: 128 } }}
        >
          <Typography
            level="title-sm"
            sx={{ color: "neutral.900", fontVariantNumeric: "tabular-nums" }}
          >
            {formatCurrencyValue(totalSpent)}
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Last: {formatDateValue(lastPurchase)}
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.600" }}>
            {formatNumberValue(orderCount)} orders
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        {personaNames.map((persona) => (
          <JoyChip
            key={`persona-${persona}`}
            color="primary"
            size="sm"
            variant="soft"
          >
            {persona}
          </JoyChip>
        ))}
        {segmentNames.map((segment) => (
          <JoyChip
            key={`segment-${segment}`}
            color="neutral"
            size="sm"
            variant="soft"
          >
            {segment}
          </JoyChip>
        ))}
        {tagNames.map((tagName) => (
          <JoyChip
            key={`tag-${tagName}`}
            color="neutral"
            size="sm"
            variant="outlined"
          >
            {tagName}
          </JoyChip>
        ))}
      </Stack>
    </EntityCardShell>
  );
}

function ProductCard({
  actions,
  entity,
  onAction,
}: Omit<DataCardBlockProps, "entityType">) {
  const name = entityDisplayName("product", entity);
  const imageUrl = primaryProductImageUrl(entity);
  const currency = entity.currency;
  const inventory = readNumber(entity.inventory_count);
  const threshold = readNumber(entity.low_stock_threshold) ?? 10;
  const lowInventory = inventory !== null && inventory < threshold;
  const trackInventory = entity.track_inventory !== false;

  return (
    <EntityCardShell
      actions={actions}
      entity={entity}
      entityType="product"
      onAction={onAction}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems="flex-start"
      >
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            width: 64,
            height: 64,
            borderRadius: "var(--joy-radius-md)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            color: "neutral.400",
            flexShrink: 0,
          }}
        >
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={name}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Package size={22} strokeWidth={1.7} />
          )}
        </Sheet>

        <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography
              level="title-sm"
              sx={{ color: "neutral.900", overflowWrap: "anywhere" }}
            >
              {name}
            </Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              SKU: {readString(entity.sku) ?? "No SKU"}
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <JoyChip color={statusTone(entity.status)} size="sm" variant="soft">
              {formatLabel(entity.status, "Active")}
            </JoyChip>
            <JoyChip color="neutral" size="sm" variant="soft">
              {formatLabel(entity.source, "Platform")}
            </JoyChip>
          </Stack>
        </Stack>

        <Stack
          spacing={0.35}
          alignItems={{ xs: "flex-start", sm: "flex-end" }}
          sx={{ flexShrink: 0 }}
        >
          <Typography
            level="title-sm"
            sx={{ color: "neutral.900", fontVariantNumeric: "tabular-nums" }}
          >
            {formatCurrencyValue(entity.price, currency)}
          </Typography>
          {entity.compare_at_price !== null &&
          entity.compare_at_price !== undefined ? (
            <Typography
              level="body-xs"
              sx={{
                color: "neutral.400",
                textDecoration: "line-through",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCurrencyValue(entity.compare_at_price, currency)}
            </Typography>
          ) : null}
          <Typography
            level="body-xs"
            sx={{
              color:
                trackInventory && lowInventory ? "danger.600" : "neutral.600",
              fontWeight: trackInventory && lowInventory ? 600 : 400,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {trackInventory
              ? `${formatNumberValue(inventory)} in stock`
              : "Inventory not tracked"}
          </Typography>
        </Stack>
      </Stack>
    </EntityCardShell>
  );
}

function MetricItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ minWidth: 0 }}
    >
      <Box sx={{ display: "inline-flex", color: "neutral.500", flexShrink: 0 }}>
        {icon}
      </Box>
      <Typography
        level="body-xs"
        sx={{ color: "neutral.600", whiteSpace: "nowrap" }}
      >
        <Typography
          component="span"
          level="body-xs"
          sx={{
            color: "neutral.900",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </Typography>{" "}
        {label}
      </Typography>
    </Stack>
  );
}

function CampaignCard({
  actions,
  entity,
  onAction,
}: Omit<DataCardBlockProps, "entityType">) {
  const status = readString(entity.status) ?? "draft";
  const displayDate =
    entity.sent_at ?? entity.scheduled_at ?? entity.created_at;
  const delivered = getRecordValue(entity, "delivered_count");
  const openRate = getRecordValue(entity, "open_rate");
  const clickRate = getRecordValue(entity, "click_rate");

  return (
    <EntityCardShell
      actions={actions}
      entity={entity}
      entityType="campaign"
      onAction={onAction}
    >
      <Stack spacing={1}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
        >
          <Stack spacing={0.4} sx={{ minWidth: 0 }}>
            <Typography
              level="title-sm"
              sx={{ color: "neutral.900", overflowWrap: "anywhere" }}
            >
              {entityDisplayName("campaign", entity)}
            </Typography>
            <Typography
              level="body-sm"
              sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
            >
              Subject: {readString(entity.subject_line) ?? "No subject"}
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            <JoyChip color={statusTone(status)} size="sm" variant="soft">
              {formatLabel(status)}
            </JoyChip>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              {formatDateValue(displayDate)}
            </Typography>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{ flexWrap: "wrap" }}
        >
          <MetricItem
            icon={<MailCheck size={15} strokeWidth={1.8} />}
            label="delivered"
            value={formatNumberValue(delivered)}
          />
          <MetricItem
            icon={<Eye size={15} strokeWidth={1.8} />}
            label="opened"
            value={formatPercentValue(openRate)}
          />
          <MetricItem
            icon={<MousePointerClick size={15} strokeWidth={1.8} />}
            label="clicked"
            value={formatPercentValue(clickRate)}
          />
        </Stack>
      </Stack>
    </EntityCardShell>
  );
}

function SegmentCard({
  actions,
  entity,
  onAction,
}: Omit<DataCardBlockProps, "entityType">) {
  const type =
    readString(entity.type) ??
    (entity.auto_update === true ? "dynamic" : "static");
  const count = getRecordValue(entity, "members");

  return (
    <EntityCardShell
      actions={actions}
      entity={entity}
      entityType="segment"
      onAction={onAction}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography
            level="title-sm"
            sx={{ color: "neutral.900", overflowWrap: "anywhere" }}
          >
            {entityDisplayName("segment", entity)}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <JoyChip color={statusTone(type)} size="sm" variant="soft">
              {formatLabel(type)}
            </JoyChip>
            <JoyChip color={statusTone(entity.status)} size="sm" variant="soft">
              {formatLabel(entity.status, "Active")}
            </JoyChip>
          </Stack>
        </Stack>
        <Typography
          level="title-sm"
          sx={{
            color: "neutral.900",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {formatNumberValue(count)} members
        </Typography>
      </Stack>
    </EntityCardShell>
  );
}

export function DataCardBlock(props: DataCardBlockProps) {
  switch (props.entityType) {
    case "customer":
      return <CustomerCard {...props} />;
    case "product":
      return <ProductCard {...props} />;
    case "campaign":
      return <CampaignCard {...props} />;
    case "segment":
      return <SegmentCard {...props} />;
  }
}
