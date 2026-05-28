import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BarChart3,
  Brain,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  ListChecks,
  MessageSquare,
  Package,
  Table2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { normalizeConfirmationPayload } from "@/components/bloom/blocks/ConfirmationBlock";
import { normalizeImagePayload } from "@/components/bloom/blocks/ImageBlock";
import { normalizeInteractionPayload } from "@/components/bloom/blocks/InteractionBlock";
import { normalizeStatCardPayload } from "@/components/bloom/blocks/StatCardBlock";
import type { DataTableColumn } from "@/components/bloom/blocks/blockTypes";
import {
  customerName,
  defaultColumnsForEntity,
  entityDisplayName,
  formatCurrencyValue,
  formatDateValue,
  formatLabel,
  formatNumberValue,
  formatPercentValue,
  getRecordValue,
  inferEntityType,
  isDataCardEntityType,
  isRecord,
  normalizeColumns,
  readBoolean,
  readEntityIdFromRecord,
  readNumber,
  readString,
  routeForEntityId,
  rowsFromValue,
} from "@/components/bloom/blocks/blockUtils";

interface CompactBlockRendererProps {
  blockType: string;
  payload: unknown;
  onContinueInBloom: () => boolean;
}

const MAX_COMPACT_TABLE_ROWS = 5;
const MAX_COMPACT_TABLE_COLUMNS = 3;

const entityIconMap: Record<string, LucideIcon> = {
  campaign: MessageSquare,
  customer: UserRound,
  product: Package,
  segment: Users,
};

const iconForEntity = (entityType: string) =>
  entityIconMap[entityType] ?? ListChecks;

function fallbackPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "Unable to render this block payload.";
  }
}

function CompactFallbackBlock({
  blockType,
  payload,
}: {
  blockType: string;
  payload: unknown;
}) {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        p: 1.25,
        backgroundColor: "background.level1",
      }}
    >
      <Stack spacing={0.75}>
        <Typography
          level="body-xs"
          sx={{ color: "neutral.500", fontWeight: 600 }}
        >
          {blockType || "Unsupported block"}
        </Typography>
        <Typography
          component="pre"
          level="body-xs"
          sx={{
            color: "neutral.700",
            m: 0,
            maxHeight: 120,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontFamily: "var(--joy-fontFamily-code)",
          }}
        >
          {fallbackPayload(payload)}
        </Typography>
      </Stack>
    </Sheet>
  );
}

function readTextPayload(payload: unknown) {
  return isRecord(payload)
    ? (readString(payload.text) ??
        readString(payload.content) ??
        readString(payload.markdown) ??
        readString(payload.data))
    : readString(payload);
}

function readDataCardPayload(payload: unknown) {
  const source = isRecord(payload) ? payload : {};
  const rawEntity = source.entity ?? source.data ?? payload;
  const entity = Array.isArray(rawEntity)
    ? (rawEntity.find(isRecord) ?? null)
    : rawEntity;

  if (!isRecord(entity)) {
    return null;
  }

  const entityType = inferEntityType(
    source.entity_type ?? source.entityType,
    entity,
  );

  if (!isDataCardEntityType(entityType)) {
    return null;
  }

  return {
    entity,
    entityType,
  };
}

function readDataTablePayload(payload: unknown) {
  const source = isRecord(payload) ? payload : {};
  const nestedData = source.data;
  const dataRecord = isRecord(nestedData) ? nestedData : null;
  const rows = rowsFromValue(
    source.rows ?? dataRecord?.rows ?? source.data ?? payload,
  );
  const firstRow = rows[0] ?? null;
  const entityType = inferEntityType(
    source.entity_type ?? source.entityType ?? dataRecord?.entity_type,
    firstRow,
  );
  const columns = normalizeColumns(source.columns ?? dataRecord?.columns);
  const totalCount =
    readNumber(source.totalCount) ??
    readNumber(source.total_count) ??
    readNumber(source.count) ??
    readNumber(dataRecord?.total_count) ??
    rows.length;

  return {
    columns:
      columns.length > 0 ? columns : defaultColumnsForEntity(entityType, rows),
    entityType,
    rows,
    totalCount,
  };
}

function metricForDataCard(
  entityType: string,
  entity: Record<string, unknown>,
) {
  switch (entityType) {
    case "customer": {
      const totalSpent = getRecordValue(entity, "total_spent");
      return `${formatCurrencyValue(totalSpent)} spent`;
    }
    case "product": {
      const price = formatCurrencyValue(entity.price, entity.currency);
      const inventory = readNumber(entity.inventory_count);
      return inventory === null
        ? price
        : `${price}, ${formatNumberValue(inventory)} in stock`;
    }
    case "campaign": {
      const openRate = getRecordValue(entity, "open_rate");
      return `${formatPercentValue(openRate)} open rate`;
    }
    case "segment": {
      const members = getRecordValue(entity, "members");
      return `${formatNumberValue(members)} members`;
    }
    default:
      return formatLabel(entityType);
  }
}

function formatTableCellValue(
  column: DataTableColumn,
  row: Record<string, unknown>,
  entityType: string,
) {
  const value = getRecordValue(row, column.key);

  if (column.key === "name" && entityType === "customer") {
    return customerName(row) ?? "Unnamed customer";
  }

  switch (column.type) {
    case "currency":
      return formatCurrencyValue(value, row.currency);
    case "date":
      return formatDateValue(value);
    case "number":
      return formatNumberValue(value);
    case "percentage":
      return formatPercentValue(value);
    case "status":
      return formatLabel(value);
    default:
      return readString(value) ?? "Not available";
  }
}

function CompactTextBlock({ payload }: { payload: unknown }) {
  const text = readTextPayload(payload);

  if (!text) {
    return <CompactFallbackBlock blockType="text" payload={payload} />;
  }

  return (
    <Typography
      level="body-xs"
      sx={{
        color: "neutral.700",
        lineHeight: 1.65,
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </Typography>
  );
}

function CompactDataCardBlock({
  onContinueInBloom,
  payload,
}: Pick<CompactBlockRendererProps, "onContinueInBloom" | "payload">) {
  const navigate = useNavigate();
  const cardPayload = readDataCardPayload(payload);
  const source = isRecord(payload) ? payload : {};
  const downloadUrl =
    readString(source.download_url) ?? readString(source.downloadUrl);
  const exportIsTruncated = readBoolean(source.truncated) ?? false;
  const exportStatus = downloadUrl
    ? exportIsTruncated
      ? "Partial export"
      : "Ready"
    : null;

  if (!cardPayload) {
    return <CompactFallbackBlock blockType="data_card" payload={payload} />;
  }

  const { entity, entityType } = cardPayload;
  const name = entityDisplayName(entityType, entity);
  const route = routeForEntityId(entityType, readEntityIdFromRecord(entity));
  const EntityIcon = iconForEntity(entityType);

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 1,
      }}
    >
      <Stack spacing={0.75}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <Box
            sx={{ display: "inline-flex", color: "neutral.500", flexShrink: 0 }}
          >
            <EntityIcon size={15} strokeWidth={1.9} />
          </Box>
          <Typography
            level="body-xs"
            sx={{
              color: "neutral.700",
              flex: 1,
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            <Typography
              component="span"
              level="body-xs"
              sx={{ color: "neutral.900", fontWeight: 700 }}
            >
              {name}
            </Typography>{" "}
            - {metricForDataCard(entityType, entity)}
          </Typography>
          {exportStatus ? (
            <JoyChip
              color={exportIsTruncated ? "warning" : "success"}
              size="sm"
              variant="soft"
            >
              {exportStatus}
            </JoyChip>
          ) : null}
        </Stack>

        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{ flexWrap: "wrap" }}
        >
          {downloadUrl ? (
            <JoyButton
              color="primary"
              component="a"
              download={
                readString(source.file_name) ??
                readString(source.fileName) ??
                true
              }
              href={downloadUrl}
              rel="noopener noreferrer"
              size="sm"
              target="_blank"
              variant="soft"
              startDecorator={<Download size={13} strokeWidth={1.9} />}
              sx={{ minHeight: 28, px: 1 }}
            >
              Download
            </JoyButton>
          ) : null}
          <JoyButton
            color="neutral"
            size="sm"
            variant="plain"
            onClick={() => {
              if (route) {
                navigate(route);
                return;
              }

              onContinueInBloom();
            }}
            sx={{ flexShrink: 0, minHeight: 28, px: 1 }}
          >
            {route ? "View" : "Open"}
          </JoyButton>
        </Stack>
      </Stack>
    </Sheet>
  );
}

function CompactDataTableBlock({
  onContinueInBloom,
  payload,
}: Pick<CompactBlockRendererProps, "onContinueInBloom" | "payload">) {
  const navigate = useNavigate();
  const tablePayload = readDataTablePayload(payload);
  const visibleRows = tablePayload.rows.slice(0, MAX_COMPACT_TABLE_ROWS);
  const visibleColumns = tablePayload.columns.slice(
    0,
    MAX_COMPACT_TABLE_COLUMNS,
  );

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Stack spacing={0}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1 }}>
          <Table2 size={15} strokeWidth={1.9} />
          <Typography
            level="body-xs"
            sx={{ color: "neutral.700", fontWeight: 700 }}
          >
            {formatLabel(tablePayload.entityType)} results
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.500", ml: "auto" }}>
            {formatNumberValue(tablePayload.totalCount)} total
          </Typography>
        </Stack>

        {visibleRows.length > 0 ? (
          <Stack spacing={0}>
            {visibleRows.map((row, index) => {
              const entityId = readEntityIdFromRecord(row);
              const route = routeForEntityId(tablePayload.entityType, entityId);
              const rowLabel = visibleColumns
                .map((column) =>
                  formatTableCellValue(column, row, tablePayload.entityType),
                )
                .filter(Boolean)
                .join(" - ");

              return (
                <Box
                  key={entityId ?? `compact-row-${index}`}
                  component="button"
                  type="button"
                  onClick={() => {
                    if (route) {
                      navigate(route);
                    }
                  }}
                  disabled={!route}
                  sx={{
                    display: "block",
                    width: "100%",
                    px: 1,
                    py: 0.75,
                    border: 0,
                    borderTop: "1px solid",
                    borderTopColor: "neutral.100",
                    backgroundColor: "background.surface",
                    color: "inherit",
                    textAlign: "left",
                    cursor: route ? "pointer" : "default",
                    "&:hover": route
                      ? { backgroundColor: "background.level1" }
                      : undefined,
                  }}
                >
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ color: "neutral.700" }}
                  >
                    {rowLabel || "Result"}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography
            level="body-xs"
            sx={{ color: "neutral.500", px: 1, pb: 1 }}
          >
            No rows to show.
          </Typography>
        )}

        <Box
          sx={{
            borderTop: "1px solid",
            borderTopColor: "neutral.100",
            p: 0.75,
          }}
        >
          <JoyButton
            color="primary"
            size="sm"
            variant="plain"
            onClick={onContinueInBloom}
            sx={{ minHeight: 28, px: 1 }}
          >
            See all in Bloom
          </JoyButton>
        </Box>
      </Stack>
    </Sheet>
  );
}

function CompactStatCardBlock({ payload }: { payload: unknown }) {
  const statPayload = normalizeStatCardPayload(payload);

  if (!statPayload) {
    return <CompactFallbackBlock blockType="stat_card" payload={payload} />;
  }

  const label = statPayload.metrics
    .map(
      (metric) =>
        `${metric.label}: ${metric.value}${metric.changeLabel ? ` (${metric.changeLabel})` : ""}`,
    )
    .join(", ");

  return (
    <Typography
      level="body-xs"
      sx={{
        color: "neutral.700",
        lineHeight: 1.65,
        overflowWrap: "anywhere",
      }}
    >
      {label}
    </Typography>
  );
}

function CompactRedirectBlock({
  icon: Icon,
  label,
  onContinueInBloom,
}: {
  icon: LucideIcon;
  label: string;
  onContinueInBloom: () => boolean;
}) {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        backgroundColor: "background.level1",
        p: 1,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        <Box
          sx={{ display: "inline-flex", color: "neutral.500", flexShrink: 0 }}
        >
          <Icon size={15} strokeWidth={1.9} />
        </Box>
        <Typography
          level="body-xs"
          sx={{ color: "neutral.700", flex: 1, minWidth: 0 }}
        >
          {label}
        </Typography>
        <JoyButton
          color="primary"
          size="sm"
          variant="plain"
          onClick={onContinueInBloom}
          sx={{ flexShrink: 0, minHeight: 28, px: 1 }}
        >
          Open
        </JoyButton>
      </Stack>
    </Sheet>
  );
}

function CompactImageBlock({
  onContinueInBloom,
  payload,
}: Pick<CompactBlockRendererProps, "onContinueInBloom" | "payload">) {
  const imagePayload = normalizeImagePayload(payload);

  if (!imagePayload) {
    return <CompactFallbackBlock blockType="image" payload={payload} />;
  }

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 1,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        <Box
          component="img"
          alt={imagePayload.alt}
          src={imagePayload.url}
          sx={{
            width: 80,
            height: 80,
            borderRadius: "var(--joy-radius-md)",
            objectFit: "cover",
            flexShrink: 0,
            backgroundColor: "background.level1",
          }}
        />
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            level="body-xs"
            sx={{ color: "neutral.700", overflowWrap: "anywhere" }}
          >
            {imagePayload.enhancedPrompt}
          </Typography>
          <JoyButton
            color="primary"
            size="sm"
            variant="plain"
            onClick={onContinueInBloom}
            sx={{ alignSelf: "flex-start", minHeight: 28, px: 0 }}
          >
            View full in Bloom
          </JoyButton>
        </Stack>
      </Stack>
    </Sheet>
  );
}

function CompactConfirmationBlock({ payload }: { payload: unknown }) {
  const confirmationPayload = normalizeConfirmationPayload(payload);

  if (!confirmationPayload) {
    return <CompactFallbackBlock blockType="confirmation" payload={payload} />;
  }

  const completed = confirmationPayload.summary?.completed ?? 0;
  const failed = confirmationPayload.summary?.failed ?? 0;

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ minWidth: 0 }}
    >
      <CheckCircle2 size={15} strokeWidth={1.9} />
      <Typography level="body-xs" sx={{ color: "neutral.700" }}>
        {formatNumberValue(completed)} completed, {formatNumberValue(failed)}{" "}
        failed
      </Typography>
    </Stack>
  );
}

function CompactInteractionBlock({
  onContinueInBloom,
  payload,
}: Pick<CompactBlockRendererProps, "onContinueInBloom" | "payload">) {
  const interactionPayload = normalizeInteractionPayload(payload);

  if (!interactionPayload) {
    return <CompactFallbackBlock blockType="interaction" payload={payload} />;
  }

  return (
    <Stack spacing={0.75}>
      <Typography
        level="body-xs"
        sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
      >
        {interactionPayload.prompt}
      </Typography>
      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        sx={{ flexWrap: "wrap" }}
      >
        {interactionPayload.options.slice(0, 6).map((option) => (
          <JoyChip
            key={option.value}
            color="neutral"
            size="sm"
            variant="outlined"
            onClick={onContinueInBloom}
            sx={{ cursor: "pointer", maxWidth: "100%" }}
          >
            {option.label}
          </JoyChip>
        ))}
        {interactionPayload.options.length > 6 ? (
          <JoyButton
            color="primary"
            size="sm"
            variant="plain"
            onClick={onContinueInBloom}
          >
            More options
          </JoyButton>
        ) : null}
      </Stack>
    </Stack>
  );
}

export function CompactBlockRenderer({
  blockType,
  onContinueInBloom,
  payload,
}: CompactBlockRendererProps) {
  const normalizedBlockType = blockType.trim().toLowerCase();

  switch (normalizedBlockType) {
    case "text":
      return <CompactTextBlock payload={payload} />;
    case "data_card":
      return (
        <CompactDataCardBlock
          payload={payload}
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "data_table":
      return (
        <CompactDataTableBlock
          payload={payload}
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "stat_card":
      return <CompactStatCardBlock payload={payload} />;
    case "chart":
      return (
        <CompactRedirectBlock
          icon={BarChart3}
          label="Chart available. Open in Bloom to visualize it."
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "task_plan":
      return (
        <CompactRedirectBlock
          icon={ListChecks}
          label="Task plan ready. Opening in Bloom keeps approvals in full view."
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "image":
      return (
        <CompactImageBlock
          payload={payload}
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "confirmation":
      return <CompactConfirmationBlock payload={payload} />;
    case "thinking":
      return (
        <CompactRedirectBlock
          icon={Brain}
          label="Reasoning available. Expand it in Bloom."
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "interaction":
      return (
        <CompactInteractionBlock
          payload={payload}
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "research_progress":
      return (
        <CompactRedirectBlock
          icon={ListChecks}
          label="Research progress is available in Bloom."
          onContinueInBloom={onContinueInBloom}
        />
      );
    case "code":
      return (
        <CompactRedirectBlock
          icon={ListChecks}
          label="Code output is available. Open in Bloom to inspect it."
          onContinueInBloom={onContinueInBloom}
        />
      );
    default:
      return normalizedBlockType.includes("image") ? (
        <CompactRedirectBlock
          icon={ImageIcon}
          label="Media output is available in Bloom."
          onContinueInBloom={onContinueInBloom}
        />
      ) : (
        <CompactFallbackBlock blockType={blockType} payload={payload} />
      );
  }
}
