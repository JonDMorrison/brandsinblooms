import { type ReactNode } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  Info,
} from "lucide-react";

import type {
  IntegrationDetailRow,
  IntegrationDetailTimelineEntry,
  IntegrationDetailTone,
} from "@/components/integrations/integrationDetailModel";
import { Button } from "@/components/ui-legacy/button";
import { Separator } from "@/components/ui-legacy/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-legacy/tooltip";
import { cn } from "@/lib/utils";

import { getIntegrationToneClasses } from "./tokens";

function formatRelativeTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return "Not available";
  }

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "Not available";
  }
}

function formatExactTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }

  try {
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return null;
  }
}

function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString();
}

function formatRelativePlusAbsolute(
  timestamp?: string | null,
  fallback = "Never",
) {
  if (!timestamp) {
    return {
      value: fallback,
      description: undefined,
    };
  }

  return {
    value: formatRelativeTimestamp(timestamp),
    description: formatExactTimestamp(timestamp) ?? undefined,
  };
}

function EmptyFieldValue() {
  return <span className="text-sm italic text-muted-foreground">—</span>;
}

function renderFieldValue(value: ReactNode) {
  if (value === null || value === undefined || value === "") {
    return <EmptyFieldValue />;
  }

  return value;
}

export function DetailStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: IntegrationDetailTone;
}) {
  const classes = getIntegrationToneClasses(tone);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        classes.badge,
      )}
    >
      {label}
    </span>
  );
}

export function DetailHealthRows({ rows }: { rows: IntegrationDetailRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const classes = getIntegrationToneClasses(row.tone ?? "neutral");
        const timestampLabel = row.timestamp
          ? formatRelativeTimestamp(row.timestamp)
          : null;
        const exactLabel = row.timestamp
          ? formatExactTimestamp(row.timestamp)
          : null;

        return (
          <div
            key={`${row.label}-${row.value}-${row.timestamp ?? "none"}`}
            className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-white/70 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {row.label}
              </div>
              {row.tooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mt-1 cursor-help truncate text-xs text-muted-foreground">
                      {row.tooltip}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-xs leading-5">
                    {row.tooltip}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <div className="min-w-0 text-right">
              <div className={cn("text-sm font-semibold", classes.icon)}>
                {timestampLabel ?? row.value}
              </div>
              {exactLabel ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {exactLabel}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DetailTimeline({
  entries,
}: {
  entries: IntegrationDetailTimelineEntry[];
}) {
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        const classes = getIntegrationToneClasses(entry.tone);
        const exactTimestamp = formatExactTimestamp(entry.timestamp);

        return (
          <div key={entry.key} className="flex gap-4">
            <div className="flex w-5 flex-col items-center">
              <span
                className={cn("mt-1 h-2.5 w-2.5 rounded-full", classes.dot)}
              />
              {index < entries.length - 1 ? (
                <span className="mt-2 h-full min-h-8 w-px bg-border/80" />
              ) : null}
            </div>
            <div className="pb-4">
              <div className="text-sm font-semibold text-foreground">
                {entry.label}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {entry.timestamp
                  ? formatRelativeTimestamp(entry.timestamp)
                  : "Waiting for provider data"}
              </div>
              {exactTimestamp ? (
                <div className="mt-1 text-xs text-muted-foreground/80">
                  {exactTimestamp}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ComingSoonCard({
  capabilities,
  callout,
  integrationName,
  notifyEmail,
  isSubmitted,
  isSubmitting,
  onSubmit,
  requestPath,
  notifyLabel,
  notifyConfirmation,
  requestLabel,
  payloadPreview,
}: {
  capabilities: string[];
  callout?: {
    tone: "info" | "warning";
    title: string;
    description: string;
  };
  integrationName: string;
  notifyEmail: string | null;
  isSubmitted: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  requestPath: string;
  notifyLabel: string;
  notifyConfirmation: string;
  requestLabel: string;
  payloadPreview?: {
    summary: string;
    content: string;
  };
}) {
  return (
    <div className="mx-auto mt-6 max-w-[600px]">
      <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
        {callout ? (
          <div
            className={cn(
              "mb-6 rounded-xl border px-4 py-3 text-sm",
              callout.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-sky-200 bg-sky-50 text-sky-900",
            )}
          >
            <div className="flex items-start gap-3">
              {callout.tone === "warning" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              )}
              <div>
                <div className="font-semibold">{callout.title}</div>
                <p className="mt-1 leading-6 opacity-90">
                  {callout.description}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            What you'll be able to do
          </h3>
          <div className="space-y-3">
            {capabilities.map((capability) => (
              <div key={capability} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-sm text-foreground">{capability}</span>
              </div>
            ))}
          </div>
        </div>

        {payloadPreview ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              {payloadPreview.summary} ▾
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
              {payloadPreview.content}
            </pre>
          </details>
        ) : null}

        <Separator className="mb-6 mt-6 border-gray-100 bg-gray-100" />

        {!isSubmitted ? (
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">
              Get notified when this launches
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              We'll email {notifyEmail ?? "your signed-in account"} when{" "}
              {integrationName} is available.
            </p>
            <Button
              type="button"
              onClick={onSubmit}
              variant="outline"
              size="sm"
              disabled={!notifyEmail || isSubmitting}
            >
              <Bell className="mr-1.5 h-3.5 w-3.5" />
              {isSubmitting ? "Saving request..." : notifyLabel}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>
              {notifyConfirmation.replace(
                "We'll notify you",
                `We'll notify you at ${notifyEmail ?? "your account email"}`,
              )}
            </span>
          </div>
        )}

        <div className="mt-4 border-t border-gray-100 pt-4">
          <a
            href={requestPath}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {requestLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

export function KeyValueGrid({
  entries,
}: {
  entries: Array<{ label: string; value: string; description?: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <div
          key={`${entry.label}-${entry.value}`}
          className="rounded-2xl border border-border/70 bg-slate-50/70 p-4"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {entry.label}
          </div>
          <div className="mt-2 break-words text-sm font-semibold text-slate-950">
            {entry.value}
          </div>
          {entry.description ? (
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {entry.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DetailFieldRows({
  rows,
  onCopy,
}: {
  rows: Array<{
    label: string;
    value: ReactNode;
    description?: ReactNode;
    tone?: IntegrationDetailTone;
    valueClassName?: string;
    copyValue?: string | null;
    copyLabel?: string;
  }>;
  onCopy?: (value: string | null | undefined, label: string) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const classes = row.tone ? getIntegrationToneClasses(row.tone) : null;

        return (
          <div
            key={row.label}
            className="rounded-2xl border border-border/70 bg-slate-50/70 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {row.label}
                </div>
                <div className="mt-2 flex items-start gap-2">
                  {classes ? (
                    <span
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        classes.dot,
                      )}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "min-w-0 break-words text-sm font-semibold text-slate-950",
                      classes?.icon,
                      row.valueClassName,
                    )}
                  >
                    {row.value}
                  </div>
                </div>
                {row.description ? (
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {row.description}
                  </div>
                ) : null}
              </div>
              {row.copyValue && onCopy && row.copyLabel ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(row.copyValue, row.copyLabel!)}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OverviewPanel({
  title,
  description,
  action,
  contextNote,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  contextNote?: {
    tone?: "info" | "warning";
    content: ReactNode;
  };
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {contextNote ? (
        <div
          className={cn(
            "mb-4 rounded-lg border px-3 py-2.5 text-sm leading-6",
            contextNote.tone === "warning"
              ? "border-amber-200 bg-amber-50/80 text-amber-900"
              : "border-sky-200 bg-sky-50/80 text-sky-900",
          )}
        >
          {contextNote.content}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FieldRow({
  label,
  value,
  description,
  tone,
  valueClassName,
  copyValue,
  copyLabel,
  copiedLabel,
  onCopy,
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  tone?: IntegrationDetailTone;
  valueClassName?: string;
  copyValue?: string | null;
  copyLabel?: string;
  copiedLabel?: string | null;
  onCopy?: (value: string | null | undefined, label: string) => void;
}) {
  const classes = tone ? getIntegrationToneClasses(tone) : null;
  const hasValue = !(value === null || value === undefined || value === "");
  const isCopied = Boolean(copyLabel && copiedLabel === copyLabel);

  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 py-2.5 last:border-b-0">
      <span className="w-32 shrink-0 pt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-start justify-end gap-3">
        <div className="min-w-0 text-right">
          <div className="flex items-start justify-end gap-2">
            {classes && hasValue ? (
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  classes.dot,
                )}
              />
            ) : null}
            <div
              className={cn(
                "min-w-0 break-words text-sm text-foreground",
                hasValue ? classes?.icon : "text-muted-foreground italic",
                valueClassName,
              )}
            >
              {renderFieldValue(value)}
            </div>
          </div>
          {description ? (
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {copyValue && onCopy && copyLabel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
            onClick={() => onCopy(copyValue, copyLabel)}
            aria-label={isCopied ? `${copyLabel} copied` : `Copy ${copyLabel}`}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function HealthFieldRow({
  label,
  value,
  tone,
  description,
}: {
  label: string;
  value: ReactNode;
  tone: IntegrationDetailTone;
  description?: ReactNode;
}) {
  const classes = getIntegrationToneClasses(tone);
  const hasValue = !(value === null || value === undefined || value === "");

  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", classes.dot)} />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        {description ? (
          <div className="mt-1 pl-4 text-xs leading-5 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[11rem] text-right text-sm font-semibold",
          hasValue ? classes.icon : "text-muted-foreground italic",
        )}
      >
        {renderFieldValue(value)}
      </div>
    </div>
  );
}

export function SyncTypeRow({
  label,
  lastSyncedAt,
  syncedCount,
  isSyncing,
}: {
  label: string;
  lastSyncedAt?: string | null;
  syncedCount?: number | null;
  isSyncing: boolean;
}) {
  const relativeTimestamp = formatRelativePlusAbsolute(lastSyncedAt, "—");

  return (
    <FieldRow
      label={label}
      value={
        isSyncing
          ? "Syncing now"
          : lastSyncedAt
            ? relativeTimestamp.value
            : null
      }
      description={[
        `${formatCount(syncedCount)} records`,
        lastSyncedAt ? relativeTimestamp.description : null,
      ]
        .filter(Boolean)
        .join(" • ")}
      tone={isSyncing || lastSyncedAt ? "success" : "neutral"}
      valueClassName={isSyncing ? "text-brand-teal" : undefined}
    />
  );
}

export function DataFeedRow({
  label,
  status,
  tone,
  description,
}: {
  label: string;
  status: string;
  tone: IntegrationDetailTone;
  description?: string;
}) {
  const classes = getIntegrationToneClasses(tone);

  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? (
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "inline-flex items-center gap-2 text-sm font-semibold",
          classes.icon,
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", classes.dot)} />
        <span>{status}</span>
      </div>
    </div>
  );
}

export function LoadingShell() {
  return (
    <div
      className="container mx-auto space-y-6 p-6"
      data-testid="integration-detail-loading-shell"
    >
      <div className="h-10 w-80 animate-pulse rounded-full bg-slate-100" />
      <div className="rounded-[1.75rem] border border-border/70 bg-white/90 p-6 shadow-sm shadow-brand-navy/5">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-10 w-72 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-5 w-96 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-[1.5rem] bg-slate-100"
            />
          ))}
        </div>
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-[1.5rem] bg-slate-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
