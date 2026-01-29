import React from "react";

export interface ActivityKeyValueListProps {
  data?: Record<string, unknown> | null;
  hiddenKeys?: string[];
  labelMap?: Record<string, string>;
  emptyLabel?: string;
  className?: string;
}

function formatKey(key: string, labelMap?: Record<string, string>) {
  if (labelMap && labelMap[key]) return labelMap[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(", ");
  }
  return JSON.stringify(value);
}

export function ActivityKeyValueList({
  data,
  hiddenKeys = [],
  labelMap,
  emptyLabel = "No data",
  className,
}: ActivityKeyValueListProps) {
  const entries = Object.entries(data ?? {}).filter(
    ([key, value]) => value !== undefined && !hiddenKeys.includes(key),
  );

  if (!entries.length) {
    return (
      <div className={className ?? "text-xs text-muted-foreground"}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <dl className={className ?? "space-y-1"}>
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <dt className="w-32 shrink-0 text-muted-foreground">
            {formatKey(key, labelMap)}
          </dt>
          <dd className="text-foreground break-words">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
