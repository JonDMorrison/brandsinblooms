import { useEffect, useState, type ComponentType, type ReactNode } from "react";
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
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  className,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-64 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
      />
    </div>
  );
}

export function ToolbarSelect<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<SortOption<T>>;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <NativeSelect
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(
        "h-8 w-auto rounded-lg border-gray-200 bg-white py-1 text-sm",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
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
    <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-0.5">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
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
  const selectedCount = value.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-gray-200 text-sm"
        >
          {selectedCount > 0 ? `${selectedCount} categories` : "All categories"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </span>
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {categories.length > 0 ? (
            categories.map((category) => {
              const isChecked = value.includes(category);

              return (
                <label
                  key={category}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const nextValue =
                        checked === true
                          ? [...value, category]
                          : value.filter((entry) => entry !== category);
                      onChange(nextValue);
                    }}
                  />
                  <span className="min-w-0 truncate">{category}</span>
                </label>
              );
            })
          ) : (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              No categories found
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EmptyValue({ className }: { className?: string }) {
  return (
    <span className={cn("text-sm italic text-muted-foreground", className)}>
      —
    </span>
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
      window.setTimeout(() => setCopied(false), 1200);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function SlideOverField({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string | null;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="w-28 flex-shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "truncate text-right text-sm",
            value ? "text-foreground" : "italic text-muted-foreground",
          )}
        >
          {value ?? "—"}
        </span>
        {copyable && value ? (
          <CopyValueButton value={value} label={label} />
        ) : null}
      </div>
    </div>
  );
}

export function RawDataPre({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-64 overflow-x-auto overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function StockCountBadge({ count }: { count: number | null }) {
  if (count === null) {
    return <EmptyValue />;
  }

  const colorClass =
    count === 0
      ? "font-medium text-red-600"
      : count <= 10
        ? "font-medium text-amber-600"
        : "text-foreground";

  return (
    <span className={cn("text-sm tabular-nums", colorClass)}>{count}</span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  const visibleTags = tags.slice(0, 2);
  const overflow = tags.length - visibleTags.length;

  if (tags.length === 0) {
    return <EmptyValue />;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
        >
          {tag}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="text-xs text-muted-foreground">+{overflow} more</span>
      ) : null}
    </div>
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
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <Icon className="mb-4 h-10 w-10 text-gray-300" />
      <p className="mb-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mb-5 text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function DataTabPagination({
  pagination,
  onPageChange,
}: {
  pagination: SharedPagination;
  onPageChange: (page: number) => void;
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
    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
      <span className="text-xs text-muted-foreground">
        Showing {startRow.toLocaleString()}–{endRow.toLocaleString()} of{" "}
        {pagination.totalCount.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-xs text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SaleStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const className =
    normalizedStatus === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalizedStatus === "open"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Badge className={className}>
      {normalizedStatus === "completed"
        ? "Completed"
        : normalizedStatus === "open"
          ? "Open"
          : status}
    </Badge>
  );
}

export function SyncStatusBadge({ job }: { job: SyncStatusBadgeJob }) {
  const className =
    job.status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : job.status === "failed" || job.status === "cancelled"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : job.status === "in_progress"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

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

  return <Badge className={className}>{label}</Badge>;
}

export function SyncTypeBadge({ job }: { job: SyncTypeBadgeJob }) {
  const config =
    job.normalizedSyncType === "customers"
      ? {
          className: "bg-blue-50 text-blue-700",
          label: "customers",
          Icon: Users,
        }
      : job.normalizedSyncType === "sales"
        ? {
            className: "bg-purple-50 text-purple-700",
            label: "sales",
            Icon: ShoppingBag,
          }
        : {
            className: "bg-amber-50 text-amber-700",
            label: job.normalizedSyncType,
            Icon: Package,
          };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        config.className,
      )}
    >
      <config.Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
