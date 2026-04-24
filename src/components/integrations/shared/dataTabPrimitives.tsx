import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Package,
  Search,
  ShoppingBag,
  Users,
  type LucideProps,
} from "lucide-react";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Input,
  LinearProgress,
  ModalClose,
  Option,
  Select,
  Sheet as JoySheet,
  Skeleton,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { toast } from "sonner";

export type SortOption<T extends string> = {
  label: string;
  value: T;
};

export type ParsedSaleLineItem = {
  name: string | null;
  productId: string | null;
  quantity: number | null;
  unitPrice: number | null;
};

export type SharedPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type SyncStatusBadgeJob = {
  status: string;
};

type SyncTypeBadgeJob = {
  normalizedSyncType: string;
};

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delay, value]);

  return debouncedValue;
}

export function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString();
}

export function formatRelativeTimestamp(
  timestamp?: string | null,
  fallback = "—",
) {
  if (!timestamp) {
    return fallback;
  }

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return fallback;
  }
}

export function formatDateValue(
  timestamp?: string | null,
  fallback = "—",
  pattern = "MMM d, yyyy",
) {
  if (!timestamp) {
    return fallback;
  }

  try {
    return format(new Date(timestamp), pattern);
  } catch {
    return fallback;
  }
}

export function formatDateTimeValue(timestamp?: string | null, fallback = "—") {
  return formatDateValue(timestamp, fallback, "MMM d, yyyy '·' h:mm a");
}

export function formatDuration(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) {
    return null;
  }

  const start = Date.parse(startAt);
  const end = Date.parse(endAt);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return null;
  }

  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return `${hours}h ${remainderMinutes}m`;
}

export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
) {
  const firstInitial = firstName?.trim()?.charAt(0);
  const lastInitial = lastName?.trim()?.charAt(0);

  if (firstInitial || lastInitial) {
    return `${firstInitial ?? ""}${lastInitial ?? ""}`.toUpperCase();
  }

  const emailDomain = email?.split("@")[1]?.replace(/[^a-zA-Z0-9]/g, "") ?? "";
  if (emailDomain.length >= 2) {
    return emailDomain.slice(0, 2).toUpperCase();
  }

  return (email ?? "??").slice(0, 2).toUpperCase();
}

export function parseTags(tags: unknown) {
  if (Array.isArray(tags)) {
    return tags.filter(
      (tag): tag is string => typeof tag === "string" && tag.length > 0,
    );
  }

  return [] as string[];
}

export function parseSaleLineItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ParsedSaleLineItem[];
  }

  return value.map((item) => {
    const source =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    const getNumber = (candidate: unknown) => {
      if (typeof candidate === "number") {
        return candidate;
      }

      if (typeof candidate === "string") {
        const parsed = Number(candidate);
        return Number.isFinite(parsed) ? parsed : null;
      }

      return null;
    };

    const name = [source.name, source.productName, source.description].find(
      (candidate) =>
        typeof candidate === "string" && candidate.trim().length > 0,
    );
    const productId = [source.productID, source.productId, source.id].find(
      (candidate) =>
        typeof candidate === "string" && candidate.trim().length > 0,
    );

    return {
      name: typeof name === "string" ? name : null,
      productId: typeof productId === "string" ? productId : null,
      quantity: getNumber(source.quantity),
      unitPrice: getNumber(source.unitPrice ?? source.price),
    } satisfies ParsedSaleLineItem;
  });
}

export function TableSearchInput({
  placeholder,
  value,
  onChange,
  className: _className,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Input
      size="sm"
      value={value}
      variant="outlined"
      placeholder={placeholder}
      startDecorator={<Search size={15} />}
      sx={{ minWidth: { xs: 1, sm: 240 }, width: { xs: 1, sm: "auto" } }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function ToolbarSelect<T extends string>({
  value,
  onChange,
  options,
  className: _className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<SortOption<T>>;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <Select
      size="sm"
      value={value}
      variant="outlined"
      slotProps={{ button: { "aria-label": ariaLabel } }}
      sx={{ minWidth: 160 }}
      onChange={(_, selectedValue) => {
        if (selectedValue) {
          onChange(selectedValue as T);
        }
      }}
    >
      {options.map((option) => (
        <Option key={option.value} value={option.value}>
          {option.label}
        </Option>
      ))}
    </Select>
  );
}

export function StatusFilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<SortOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ButtonGroup size="sm" variant="outlined" color="neutral">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={option.value === value ? "solid" : "outlined"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}

export function CategoryMultiSelect({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const selectedMap = useMemo(() => new Set(value), [value]);

  return (
    <Select
      multiple
      size="sm"
      value={value}
      variant="outlined"
      placeholder="All categories"
      sx={{ minWidth: 180 }}
      renderValue={(selected) => {
        if (selected.length === 0) {
          return "All categories";
        }

        return `${selected.length} categories`;
      }}
      onChange={(_, selectedValue) => onChange((selectedValue as string[]) ?? [])}
    >
      {categories.map((category) => (
        <Option key={category} value={category}>
          <Box sx={{ fontWeight: selectedMap.has(category) ? 600 : 500 }}>
            {category}
          </Box>
        </Option>
      ))}
    </Select>
  );
}

export function EmptyValue({ className: _className }: { className?: string }) {
  return (
    <Typography level="body-sm" sx={{ color: "text.tertiary", fontStyle: "italic" }}>
      —
    </Typography>
  );
}

export function CopyValueButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <IconButton
      size="sm"
      variant="plain"
      color={copied ? "success" : "neutral"}
      aria-label={`Copy ${label}`}
      onClick={handleCopy}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </IconButton>
  );
}

export function SlideOverField({
  label,
  value,
  copyable,
  valueClassName: _valueClassName,
}: {
  label: string;
  value: ReactNode;
  copyable?: boolean;
  valueClassName?: string;
}) {
  const primitiveValue =
    typeof value === "string" || typeof value === "number" ? String(value) : null;

  return (
    <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
      <Typography level="body-xs" sx={{ color: "text.tertiary", minWidth: 120 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography
          level="body-sm"
          sx={{
            textAlign: "right",
            color: primitiveValue || typeof value === "number" ? "text.primary" : "text.tertiary",
            fontStyle: primitiveValue ? "normal" : "italic",
            wordBreak: "break-word",
          }}
        >
          {value ?? "—"}
        </Typography>
        {copyable && primitiveValue ? (
          <CopyValueButton value={primitiveValue} label={label} />
        ) : null}
      </Stack>
    </Stack>
  );
}

export function RawDataPre({ value }: { value: unknown }) {
  return (
    <Box
      component="pre"
      sx={{
        mt: 1,
        maxHeight: 260,
        overflow: "auto",
        borderRadius: "md",
        bgcolor: "background.level1",
        p: 1.5,
        fontSize: "0.72rem",
        fontFamily: "var(--joy-fontFamily-code)",
        color: "text.secondary",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </Box>
  );
}

export function StockCountBadge({ count }: { count: number | null }) {
  if (count === null) {
    return <EmptyValue />;
  }

  const color = count === 0 ? "danger" : count <= 10 ? "warning" : "success";

  return (
    <Chip size="sm" color={color} variant="soft" sx={{ fontFamily: "var(--joy-fontFamily-code)" }}>
      {count}
    </Chip>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <EmptyValue />;
  }

  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {tags.slice(0, 4).map((tag) => (
        <Chip key={tag} size="sm" color="neutral" variant="soft">
          {tag}
        </Chip>
      ))}
      {tags.length > 4 ? (
        <Chip size="sm" color="neutral" variant="outlined">
          +{tags.length - 4}
        </Chip>
      ) : null}
    </Stack>
  );
}

export function DataTabEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      spacing={1.25}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: 280, px: 3, py: 4, textAlign: "center" }}
    >
      <Icon size={30} style={{ color: "var(--joy-palette-neutral-400)" }} />
      <Typography level="title-md">{title}</Typography>
      <Typography level="body-sm" sx={{ color: "text.tertiary", maxWidth: 520 }}>
        {description}
      </Typography>
      {action}
    </Stack>
  );
}

export function DataTabPagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  pagination: SharedPagination;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}) {
  const startRow =
    pagination.totalCount === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const endRow =
    pagination.totalCount === 0
      ? 0
      : Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.25}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
      sx={{ borderTop: "1px solid", borderColor: "divider", px: 2, py: 1.5 }}
    >
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        Showing {startRow.toLocaleString()}–{endRow.toLocaleString()} of {" "}
        {pagination.totalCount.toLocaleString()}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <ButtonGroup size="sm" variant="outlined" color="neutral">
          <Button
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <Button disabled>
            {pagination.page} / {Math.max(1, pagination.totalPages)}
          </Button>
          <Button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </ButtonGroup>
        <Select
          size="sm"
          value={String(pagination.pageSize)}
          variant="outlined"
          sx={{ minWidth: 88 }}
          disabled={!onPageSizeChange}
          onChange={(_, next) => {
            if (next && onPageSizeChange) {
              onPageSizeChange(Number(next));
            }
          }}
        >
          {pageSizeOptions.map((option) => (
            <Option key={option} value={String(option)}>
              {option}
            </Option>
          ))}
        </Select>
      </Stack>
    </Stack>
  );
}

export function DataTabLoadingState({ rows = 8 }: { rows?: number }) {
  return (
    <Stack spacing={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "md", overflow: "hidden" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ p: 1.5 }}>
        <Skeleton variant="rectangular" sx={{ height: 34, width: { xs: 1, sm: 240 }, borderRadius: "sm" }} />
        <Skeleton variant="rectangular" sx={{ height: 34, width: 150, borderRadius: "sm" }} />
        <Skeleton variant="rectangular" sx={{ height: 34, width: 124, borderRadius: "sm" }} />
      </Stack>
      <Divider />
      <Box sx={{ p: 1.5 }}>
        {Array.from({ length: rows }).map((_, index) => (
          <Stack key={index} direction="row" spacing={2} sx={{ py: 1 }}>
            <Skeleton variant="text" sx={{ width: "30%" }} />
            <Skeleton variant="text" sx={{ width: "20%" }} />
            <Skeleton variant="text" sx={{ width: "18%" }} />
            <Skeleton variant="text" sx={{ width: "22%" }} />
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}

export function SaleStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const color =
    normalizedStatus === "completed"
      ? "success"
      : normalizedStatus === "open"
        ? "warning"
        : "neutral";

  return (
    <Chip size="sm" color={color} variant="soft">
      {normalizedStatus === "completed"
        ? "Completed"
        : normalizedStatus === "open"
          ? "Open"
          : status}
    </Chip>
  );
}

export function SyncStatusBadge({ job }: { job: SyncStatusBadgeJob }) {
  const color =
    job.status === "completed"
      ? "success"
      : job.status === "failed" || job.status === "cancelled"
        ? "danger"
        : job.status === "in_progress"
          ? "primary"
          : "neutral";

  const label =
    job.status === "in_progress"
      ? "In progress"
      : job.status === "completed"
        ? "Completed"
        : job.status === "failed"
          ? "Failed"
          : job.status === "cancelled"
            ? "Cancelled"
            : job.status.replace(/_/g, " ");

  return (
    <Chip size="sm" color={color} variant="soft">
      {label}
    </Chip>
  );
}

export function SyncTypeBadge({ job }: { job: SyncTypeBadgeJob }) {
  const config =
    job.normalizedSyncType === "customers"
      ? {
          color: "primary" as const,
          label: "customers",
          Icon: Users,
        }
      : job.normalizedSyncType === "sales" || job.normalizedSyncType === "orders"
        ? {
            color: "warning" as const,
            label: job.normalizedSyncType,
            Icon: ShoppingBag,
          }
        : {
            color: "neutral" as const,
            label: job.normalizedSyncType,
            Icon: Package,
          };

  return (
    <Chip
      size="sm"
      color={config.color}
      variant="soft"
      startDecorator={<config.Icon size={13} />}
      sx={{ textTransform: "capitalize" }}
    >
      {config.label}
    </Chip>
  );
}

export function SyncProgressInline({ value }: { value: number }) {
  return (
    <Stack spacing={0.4} sx={{ minWidth: 100 }}>
      <LinearProgress determinate size="sm" value={Math.max(0, Math.min(100, value))} />
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        {Math.round(value)}%
      </Typography>
    </Stack>
  );
}

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={() => onOpenChange(false)}>
      {children}
    </Drawer>
  );
}

export function SheetContent({
  className: _className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <JoySheet
      variant="plain"
      sx={{
        width: { xs: "100vw", sm: 400 },
        maxWidth: "100vw",
        height: "100%",
        overflowY: "auto",
        p: 2,
      }}
    >
      <ModalClose />
      {children}
    </JoySheet>
  );
}

export function SheetHeader({
  className: _className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Stack spacing={0.75} sx={{ pb: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
      {children}
    </Stack>
  );
}

export function SheetTitle({ children }: { children: ReactNode }) {
  return <Typography level="title-md">{children}</Typography>;
}

export function SheetDescription({
  className: _className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
      {children}
    </Typography>
  );
}

export function JoyDataTable({ children }: { children: ReactNode }) {
  return (
    <Table
      hoverRow
      stripe="odd"
      size="sm"
      variant="outlined"
      sx={{
        "--TableCell-headBackground": "transparent",
        "--TableHeaderUnderlineThickness": "1px",
      }}
    >
      {children}
    </Table>
  );
}
