import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Download, SearchX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
  type JoyTableSortDirection,
} from "@/components/joy/JoyTable";
import type {
  DataColumnType,
  DataTableColumn,
  SortDirection,
} from "@/components/bloom/blocks/blockTypes";
import {
  customerName,
  defaultColumnsForEntity,
  formatCurrencyValue,
  formatDateValue,
  formatLabel,
  formatNumberValue,
  formatPercentValue,
  getRecordValue,
  readNumber,
  readString,
  statusTone,
  stringListFromValue,
} from "@/components/bloom/blocks/blockUtils";

export interface DataTableBlockProps {
  entityType: string;
  columns: DataTableColumn[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  pageSize: number;
  onSort: (key: string, direction: SortDirection) => void;
  onPageChange: (page: number) => void;
  onAction: (prompt: string) => void;
}

type SortState = {
  key: string;
  direction: SortDirection;
};

const MAX_VISIBLE_ROWS = 10;

function entityLabel(entityType: string): string {
  const normalized = entityType === "record" ? "result" : entityType;
  return formatLabel(normalized);
}

function routeForEntity(
  entityType: string,
  row: Record<string, unknown>,
): string | null {
  const id =
    readString(row.id) ??
    readString(row.customer_id) ??
    readString(row.product_id) ??
    readString(row.campaign_id) ??
    readString(row.segment_id);
  if (!id) {
    return null;
  }

  switch (entityType) {
    case "customer":
      return `/crm/customers/${id}`;
    case "product":
      return `/products/${id}`;
    case "campaign":
      return `/crm/campaigns/${id}`;
    case "segment":
      return `/crm/segments/${id}`;
    default:
      return null;
  }
}

function rowId(row: Record<string, unknown>): string | null {
  return (
    readString(row.id) ??
    readString(row.customer_id) ??
    readString(row.product_id) ??
    readString(row.campaign_id) ??
    readString(row.segment_id) ??
    readString(row.external_id)
  );
}

function detailPromptForRow(
  entityType: string,
  row: Record<string, unknown>,
): string | null {
  const rowEntityType =
    readString(row.entity_type) ?? readString(row.entityType) ?? entityType;
  const rowEntityId =
    readString(row.entity_id) ?? readString(row.entityId) ?? rowId(row);

  if (!rowEntityType || !rowEntityId) {
    return null;
  }

  return `Show me details for ${rowEntityType} ${rowEntityId}`;
}

function compareValues(
  left: unknown,
  right: unknown,
  type: DataColumnType | undefined,
): number {
  if (type === "currency" || type === "number" || type === "percentage") {
    return (readNumber(left) ?? 0) - (readNumber(right) ?? 0);
  }

  if (type === "date") {
    const leftTime = Date.parse(readString(left) ?? "");
    const rightTime = Date.parse(readString(right) ?? "");
    return (
      (Number.isFinite(leftTime) ? leftTime : 0) -
      (Number.isFinite(rightTime) ? rightTime : 0)
    );
  }

  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortRows(
  rows: Record<string, unknown>[],
  columns: DataTableColumn[],
  sortState: SortState | null,
): Record<string, unknown>[] {
  if (!sortState) {
    return rows;
  }

  const column = columns.find((candidate) => candidate.key === sortState.key);
  return [...rows].sort((left, right) => {
    const result = compareValues(
      getRecordValue(left, sortState.key),
      getRecordValue(right, sortState.key),
      column?.type,
    );
    return sortState.direction === "asc" ? result : -result;
  });
}

function renderChipList(values: string[]) {
  if (values.length === 0) {
    return (
      <Typography level="body-sm" color="neutral">
        None
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
      {values.slice(0, 3).map((value) => (
        <JoyChip key={value} color="neutral" size="sm" variant="soft">
          {value}
        </JoyChip>
      ))}
      {values.length > 3 ? (
        <JoyChip color="neutral" size="sm" variant="outlined">
          +{values.length - 3}
        </JoyChip>
      ) : null}
    </Stack>
  );
}

function TextCell({
  columnKey,
  entityType,
  row,
  value,
}: {
  columnKey: string;
  entityType: string;
  row: Record<string, unknown>;
  value: unknown;
}) {
  if (Array.isArray(value)) {
    return renderChipList(stringListFromValue(value));
  }

  if (columnKey === "name" && entityType === "customer") {
    return (
      <Stack spacing={0.35} sx={{ minWidth: 0 }}>
        <Typography
          level="title-sm"
          sx={{ color: "neutral.900", overflowWrap: "anywhere" }}
        >
          {customerName(row) ?? "Unnamed customer"}
        </Typography>
        <Typography
          level="body-xs"
          sx={{ color: "neutral.500", overflowWrap: "anywhere" }}
        >
          {readString(row.email) ?? "No email"}
        </Typography>
      </Stack>
    );
  }

  return (
    <Typography
      level="body-sm"
      sx={{ color: "neutral.700", overflowWrap: "anywhere" }}
    >
      {readString(value) ?? "Not available"}
    </Typography>
  );
}

function TableCellContent({
  column,
  entityType,
  row,
}: {
  column: DataTableColumn;
  entityType: string;
  row: Record<string, unknown>;
}) {
  const value = getRecordValue(row, column.key);

  if (Array.isArray(value) || column.key === "segments") {
    return renderChipList(stringListFromValue(value));
  }

  switch (column.type) {
    case "currency":
      return (
        <Typography
          level="body-sm"
          sx={{
            color: "neutral.900",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatCurrencyValue(value, row.currency)}
        </Typography>
      );
    case "date":
      return (
        <Typography
          level="body-sm"
          sx={{ color: "neutral.600", whiteSpace: "nowrap" }}
        >
          {formatDateValue(value)}
        </Typography>
      );
    case "status":
      return (
        <JoyChip
          color={column.key === "source" ? "neutral" : statusTone(value)}
          size="sm"
          variant="soft"
        >
          {formatLabel(value)}
        </JoyChip>
      );
    case "number": {
      const numeric = readNumber(value);
      const lowInventory =
        column.key.toLowerCase().includes("inventory") &&
        numeric !== null &&
        numeric < 10;
      return (
        <Typography
          level="body-sm"
          sx={{
            color: lowInventory ? "danger.600" : "neutral.800",
            fontWeight: lowInventory ? 600 : 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatNumberValue(value)}
        </Typography>
      );
    }
    case "percentage":
      return (
        <Typography
          level="body-sm"
          sx={{
            color: "neutral.800",
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatPercentValue(value)}
        </Typography>
      );
    default:
      return (
        <TextCell
          columnKey={column.key}
          entityType={entityType}
          row={row}
          value={value}
        />
      );
  }
}

function columnAlign(column: DataTableColumn): "left" | "right" {
  return column.type === "currency" ||
    column.type === "number" ||
    column.type === "percentage"
    ? "right"
    : "left";
}

export function DataTableBlock({
  columns,
  entityType,
  onAction,
  onPageChange,
  onSort,
  page,
  pageSize,
  rows,
  totalCount,
}: DataTableBlockProps) {
  const navigate = useNavigate();
  const [sortState, setSortState] = React.useState<SortState | null>(null);
  const [localPage, setLocalPage] = React.useState(page);
  const visiblePageSize = Math.min(
    Math.max(pageSize || MAX_VISIBLE_ROWS, 1),
    MAX_VISIBLE_ROWS,
  );
  const resolvedColumns =
    columns.length > 0 ? columns : defaultColumnsForEntity(entityType, rows);
  const sortedRows = React.useMemo(
    () => sortRows(rows, resolvedColumns, sortState),
    [resolvedColumns, rows, sortState],
  );
  const shouldPaginateLocally = sortedRows.length > visiblePageSize;
  const activePage = shouldPaginateLocally ? localPage : page;
  const visibleRows = shouldPaginateLocally
    ? sortedRows.slice(
        (activePage - 1) * visiblePageSize,
        activePage * visiblePageSize,
      )
    : sortedRows.slice(0, visiblePageSize);
  const resolvedTotalCount = Math.max(totalCount, rows.length);

  React.useEffect(() => {
    setLocalPage(page);
  }, [page]);

  const handleSort = (column: DataTableColumn) => {
    if (!column.sortable) {
      return;
    }

    const direction: SortDirection =
      sortState?.key === column.key && sortState.direction === "asc"
        ? "desc"
        : "asc";
    setSortState({ key: column.key, direction });
    onSort(column.key, direction);
  };

  const handlePageChange = (nextPage: number) => {
    if (shouldPaginateLocally) {
      setLocalPage(nextPage);
    }
    onPageChange(nextPage);
  };

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-xs)",
        overflow: "hidden",
      }}
    >
      <Stack spacing={0}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5 }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography level="title-sm" sx={{ color: "neutral.900" }}>
              {entityLabel(entityType)} Results
            </Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              {formatNumberValue(resolvedTotalCount)} matching records
            </Typography>
          </Stack>
          <JoyButton
            color="neutral"
            size="sm"
            variant="plain"
            startDecorator={<Download size={15} strokeWidth={1.9} />}
            onClick={() => onAction("Export these results as CSV")}
          >
            Export CSV
          </JoyButton>
        </Stack>

        <Divider
          sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
        />

        {visibleRows.length === 0 ? (
          <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}>
            <JoyEmptyState
              icon={<SearchX />}
              title="No results found"
              description="Try a different query or adjust the filters in Bloom."
            />
          </Box>
        ) : (
          <>
            <JoyTable stickyHeader>
              <JoyTableHead>
                <JoyTableRow>
                  {resolvedColumns.map((column) => {
                    const activeSortDirection: JoyTableSortDirection =
                      sortState?.key === column.key
                        ? sortState.direction
                        : "none";
                    return (
                      <JoyTableHeaderCell
                        key={column.key}
                        align={columnAlign(column)}
                        sortable={Boolean(column.sortable)}
                        sortDirection={activeSortDirection}
                        onSort={() => handleSort(column)}
                      >
                        {column.label}
                      </JoyTableHeaderCell>
                    );
                  })}
                </JoyTableRow>
              </JoyTableHead>
              <JoyTableBody>
                {visibleRows.map((row, index) => {
                  const id = rowId(row);
                  const route = routeForEntity(entityType, row);
                  return (
                    <JoyTableRow
                      key={id ?? `${entityType}-${index}`}
                      clickable={Boolean(route && id)}
                      hoverColor="var(--joy-palette-neutral-50)"
                      onClick={() => {
                        const prompt = detailPromptForRow(entityType, row);
                        if (prompt) {
                          onAction(prompt);
                        }
                        if (route) {
                          navigate(route);
                        }
                      }}
                    >
                      {resolvedColumns.map((column) => (
                        <JoyTableCell
                          key={`${id ?? index}-${column.key}`}
                          align={columnAlign(column)}
                        >
                          <TableCellContent
                            column={column}
                            entityType={entityType}
                            row={row}
                          />
                        </JoyTableCell>
                      ))}
                    </JoyTableRow>
                  );
                })}
              </JoyTableBody>
            </JoyTable>

            {resolvedTotalCount > visiblePageSize ? (
              <JoyTablePagination
                page={activePage}
                pageSize={visiblePageSize}
                totalCount={resolvedTotalCount}
                onPageChange={handlePageChange}
                sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5 }}
              />
            ) : null}
          </>
        )}
      </Stack>
    </Sheet>
  );
}
