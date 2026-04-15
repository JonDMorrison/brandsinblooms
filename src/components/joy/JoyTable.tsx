import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import JoyBaseTable, {
  type TableProps as JoyBaseTableProps,
} from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoySelect } from "@/components/joy/JoySelect";

export type JoyTableSortDirection = "asc" | "desc" | "none";

export interface JoyTableProps extends JoyBaseTableProps {
  containerSx?: SxProps;
}

export interface JoyTableSectionProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sx?: SxProps;
}

export interface JoyTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  sx?: SxProps;
  clickable?: boolean;
  hoverColor?: string;
}

export interface JoyTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sx?: SxProps;
}

export interface JoyTableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sx?: SxProps;
  sortable?: boolean;
  sortDirection?: JoyTableSortDirection;
  onSort?: () => void;
}

export interface JoyTablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageIndexBase?: 0 | 1;
  disabled?: boolean;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  sx?: SxProps;
}

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

const tableRootSx: SxProps = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  backgroundColor: "#FFFFFF",
  "& thead th": {
    backgroundColor: "neutral.50",
  },
  "& tbody td": {
    backgroundColor: "#FFFFFF",
  },
};

const sectionSx: SxProps = {
  width: "100%",
};

const rowSx = (clickable: boolean, hoverColor: string): SxProps => ({
  cursor: clickable ? "pointer" : "default",
  transition: "background-color 0.16s ease",
  "& > th, & > td": {
    transition: "background-color 0.16s ease, border-color 0.16s ease",
  },
  ...(clickable
    ? {
        "&:hover > th, &:hover > td": {
          backgroundColor: hoverColor,
        },
      }
    : {}),
});

const cellSx: SxProps = {
  px: 2,
  py: 1.5,
  color: "neutral.700",
  fontSize: "var(--joy-fontSize-sm)",
  lineHeight: 1.45,
  verticalAlign: "middle",
  borderBottom: "1px solid",
  borderColor: "neutral.100",
  overflowWrap: "anywhere",
};

const headerCellSx: SxProps = {
  px: 2,
  py: 1.5,
  color: "neutral.600",
  fontSize: "var(--joy-fontSize-sm)",
  fontWeight: "var(--joy-fontWeight-semibold)",
  lineHeight: 1.4,
  textAlign: "left",
  verticalAlign: "middle",
  borderBottom: "1px solid",
  borderColor: "neutral.200",
  whiteSpace: "nowrap",
};

const headerButtonSx = (align: string | undefined): SxProps => ({
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent:
    align === "right"
      ? "flex-end"
      : align === "center"
        ? "center"
        : "flex-start",
  gap: 0.75,
  p: 0,
  border: 0,
  backgroundColor: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  textAlign: align ?? "left",
  "&:hover": {
    color: "primary.700",
  },
  "&:focus-visible": {
    outline: "2px solid var(--joy-palette-primary-500)",
    outlineOffset: 2,
    borderRadius: "var(--joy-radius-sm)",
  },
  "&:disabled": {
    cursor: "default",
    opacity: 0.72,
  },
});

const paginationSurfaceSx: SxProps = {
  mt: 2,
  p: 2,
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.200",
  backgroundColor: "#FFFFFF",
  boxShadow: "var(--joy-shadow-sm)",
};

const getSortIcon = (sortDirection: JoyTableSortDirection) => {
  switch (sortDirection) {
    case "asc":
      return ArrowUp;
    case "desc":
      return ArrowDown;
    default:
      return ArrowUpDown;
  }
};

const getVisiblePages = (pageCount: number, currentPageIndex: number) => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const pages = new Set<number>([0, pageCount - 1, currentPageIndex]);

  if (currentPageIndex > 0) {
    pages.add(currentPageIndex - 1);
  }

  if (currentPageIndex < pageCount - 1) {
    pages.add(currentPageIndex + 1);
  }

  if (currentPageIndex <= 2) {
    pages.add(1);
    pages.add(2);
  }

  if (currentPageIndex >= pageCount - 3) {
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }

  return Array.from(pages).sort((left, right) => left - right);
};

export const JoyTable = React.forwardRef<HTMLTableElement, JoyTableProps>(
  (
    {
      children,
      stickyHeader = false,
      borderAxis = "none",
      hoverRow = false,
      variant = "plain",
      color = "neutral",
      sx,
      containerSx,
      ...props
    },
    ref,
  ) => (
    <Box sx={mergeSx({ width: "100%", overflowX: "auto" }, containerSx)}>
      <JoyBaseTable
        {...props}
        ref={ref}
        stickyHeader={stickyHeader}
        borderAxis={borderAxis}
        hoverRow={hoverRow}
        variant={variant}
        color={color}
        sx={mergeSx(tableRootSx, sx)}
      >
        {children}
      </JoyBaseTable>
    </Box>
  ),
);

JoyTable.displayName = "JoyTable";

export const JoyTableHead = React.forwardRef<
  HTMLTableSectionElement,
  JoyTableSectionProps
>(({ sx, ...props }, ref) => (
  <Box component="thead" ref={ref} sx={mergeSx(sectionSx, sx)} {...props} />
));

JoyTableHead.displayName = "JoyTableHead";

export const JoyTableBody = React.forwardRef<
  HTMLTableSectionElement,
  JoyTableSectionProps
>(({ sx, ...props }, ref) => (
  <Box component="tbody" ref={ref} sx={mergeSx(sectionSx, sx)} {...props} />
));

JoyTableBody.displayName = "JoyTableBody";

export const JoyTableRow = React.forwardRef<
  HTMLTableRowElement,
  JoyTableRowProps
>(
  (
    {
      sx,
      clickable,
      hoverColor = "var(--joy-palette-neutral-50)",
      onClick,
      ...props
    },
    ref,
  ) => (
    <Box
      component="tr"
      ref={ref}
      sx={mergeSx(rowSx(Boolean(clickable ?? onClick), hoverColor), sx)}
      onClick={onClick}
      {...props}
    />
  ),
);

JoyTableRow.displayName = "JoyTableRow";

export const JoyTableCell = React.forwardRef<
  HTMLTableCellElement,
  JoyTableCellProps
>(({ sx, ...props }, ref) => (
  <Box component="td" ref={ref} sx={mergeSx(cellSx, sx)} {...props} />
));

JoyTableCell.displayName = "JoyTableCell";

export const JoyTableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  JoyTableHeaderCellProps
>(
  (
    {
      sx,
      sortable = false,
      sortDirection = "none",
      onSort,
      children,
      align,
      ...props
    },
    ref,
  ) => {
    const SortIcon = getSortIcon(sortDirection);
    const isActive = sortDirection !== "none";

    return (
      <Box
        component="th"
        ref={ref}
        scope="col"
        aria-sort={
          sortDirection === "asc"
            ? "ascending"
            : sortDirection === "desc"
              ? "descending"
              : "none"
        }
        sx={mergeSx(headerCellSx, align ? { textAlign: align } : undefined, sx)}
        {...props}
      >
        {sortable ? (
          <Box
            component="button"
            type="button"
            onClick={onSort}
            disabled={!onSort}
            sx={headerButtonSx(align)}
          >
            <Box component="span">{children}</Box>
            <SortIcon
              className="lucide"
              style={{
                width: 16,
                height: 16,
                color: isActive
                  ? "var(--joy-palette-primary-600)"
                  : "var(--joy-palette-neutral-400)",
              }}
            />
          </Box>
        ) : (
          children
        )}
      </Box>
    );
  },
);

JoyTableHeaderCell.displayName = "JoyTableHeaderCell";

export const JoyTablePagination = ({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageIndexBase = 1,
  disabled = false,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector,
  sx,
}: JoyTablePaginationProps) => {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPageIndex = Math.min(
    Math.max(page - pageIndexBase, 0),
    pageCount - 1,
  );
  const start = totalCount === 0 ? 0 : currentPageIndex * pageSize + 1;
  const end = totalCount === 0 ? 0 : Math.min(start + pageSize - 1, totalCount);
  const resolvedShowPageSizeSelector =
    showPageSizeSelector ?? Boolean(onPageSizeChange);
  const visiblePages = getVisiblePages(pageCount, currentPageIndex);

  return (
    <Sheet variant="outlined" sx={mergeSx(paginationSurfaceSx, sx)}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <Typography level="body-sm" color="neutral">
            Showing {start}-{end} of {totalCount} results
          </Typography>
          {resolvedShowPageSizeSelector ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="body-sm" color="neutral">
                Rows per page
              </Typography>
              <JoySelect
                value={pageSize.toString()}
                disabled={disabled || !onPageSizeChange}
                onValueChange={(value) => {
                  const nextPageSize = Number.parseInt(value, 10);
                  if (!Number.isNaN(nextPageSize)) {
                    onPageSizeChange?.(nextPageSize);
                  }
                }}
                options={pageSizeOptions.map((option) => ({
                  value: option.toString(),
                  label: option.toString(),
                }))}
                sx={{ width: 96 }}
              />
            </Stack>
          ) : null}
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          flexWrap="wrap"
        >
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            aria-label="Previous page"
            disabled={disabled || currentPageIndex <= 0}
            onClick={() => onPageChange(currentPageIndex - 1 + pageIndexBase)}
          >
            <ChevronLeft className="lucide" style={{ width: 16, height: 16 }} />
          </IconButton>

          {visiblePages.map((pageIndex, index) => {
            const previous = visiblePages[index - 1];
            const needsGap = previous !== undefined && pageIndex - previous > 1;
            const pageNumber = pageIndex + pageIndexBase;
            const isActive = pageIndex === currentPageIndex;

            return (
              <React.Fragment key={pageNumber}>
                {needsGap ? (
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    disabled
                  >
                    <MoreHorizontal
                      className="lucide"
                      style={{ width: 16, height: 16 }}
                    />
                  </IconButton>
                ) : null}
                <JoyButton
                  size="sm"
                  variant={isActive ? "soft" : "plain"}
                  color={isActive ? "primary" : "neutral"}
                  onClick={() => onPageChange(pageNumber)}
                  disabled={disabled}
                  aria-current={isActive ? "page" : undefined}
                  sx={{ minWidth: 36, px: 1.25 }}
                >
                  {pageIndex + 1}
                </JoyButton>
              </React.Fragment>
            );
          })}

          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            aria-label="Next page"
            disabled={disabled || currentPageIndex >= pageCount - 1}
            onClick={() => onPageChange(currentPageIndex + 1 + pageIndexBase)}
          >
            <ChevronRight
              className="lucide"
              style={{ width: 16, height: 16 }}
            />
          </IconButton>
        </Stack>
      </Stack>
    </Sheet>
  );
};
