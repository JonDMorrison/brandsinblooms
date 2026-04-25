import { type ReactNode } from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  Copy,
  Info,
  MoreHorizontal,
} from "lucide-react";
import Alert from "@mui/joy/Alert";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Breadcrumbs from "@mui/joy/Breadcrumbs";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import ListDivider from "@mui/joy/ListDivider";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import { tabClasses } from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { PageContainer } from "@/components/joy/PageContainer";
import type {
  ActionDropdownItem,
  ActionDropdownSection,
} from "@/components/ui-legacy/action-dropdown";
import type {
  IntegrationDetailRow,
  IntegrationDetailTimelineEntry,
  IntegrationDetailTone,
} from "@/components/integrations/integrationDetailModel";
import { getIntegrationToneClasses } from "./tokens";

function formatRelativeTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return "—";
  }

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "—";
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
    return "—";
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
  return (
    <Typography level="body-sm" sx={{ color: "text.disabled" }}>
      —
    </Typography>
  );
}

function renderFieldValue(value: ReactNode) {
  if (value === null || value === undefined || value === "") {
    return <EmptyFieldValue />;
  }

  return value;
}

function StatusDot({ tone }: { tone: IntegrationDetailTone }) {
  const classes = getIntegrationToneClasses(tone);

  return (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: classes.dotColor,
      }}
    />
  );
}

export function CardSkeleton({
  titleWidth = "200px",
  rows = 4,
  hasSubtitle = true,
}: {
  titleWidth?: string;
  rows?: number;
  hasSubtitle?: boolean;
}) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2.5 }}>
      <Skeleton
        variant="text"
        level="title-sm"
        width={titleWidth}
        sx={{ mb: hasSubtitle ? 0.5 : 2 }}
      />
      {hasSubtitle ? (
        <Skeleton variant="text" level="body-sm" width="70%" sx={{ mb: 2 }} />
      ) : null}
      {Array.from({ length: rows }).map((_, index) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: index < rows - 1 ? 1 : 0,
          }}
        >
          <Skeleton variant="text" level="body-sm" width="30%" />
          <Skeleton variant="text" level="body-sm" width="40%" />
        </Box>
      ))}
    </Sheet>
  );
}

export function StatCardSkeleton() {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
        <Skeleton variant="text" level="body-xs" width="120px" />
        <Skeleton variant="circular" width={20} height={20} />
      </Box>
      <Skeleton variant="text" level="h3" width="60px" sx={{ mb: 1 }} />
      <Skeleton variant="text" level="body-xs" width="100px" />
    </Sheet>
  );
}

function getValueSx(valueClassName?: string) {
  return {
    ...(valueClassName?.includes("font-mono")
      ? { fontFamily: "code", letterSpacing: "0.01em" }
      : null),
  };
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
    <Chip
      color={classes.chipColor}
      size="sm"
      startDecorator={<StatusDot tone={tone} />}
      variant={classes.chipVariant}
      sx={{ fontWeight: 600 }}
    >
      {label}
    </Chip>
  );
}

export function DetailHealthRows({ rows }: { rows: IntegrationDetailRow[] }) {
  return (
    <Stack divider={<Divider sx={{ my: 1.5 }} />} spacing={0}>
      {rows.map((row) => (
        <HealthFieldRow
          key={`${row.label}-${row.value}-${row.timestamp ?? "none"}`}
          label={row.label}
          value={
            row.timestamp ? formatRelativeTimestamp(row.timestamp) : row.value
          }
          tone={row.tone ?? "neutral"}
          description={
            row.timestamp
              ? (formatExactTimestamp(row.timestamp) ?? row.tooltip)
              : row.tooltip
          }
        />
      ))}
    </Stack>
  );
}

export function DetailTimeline({
  entries,
}: {
  entries: IntegrationDetailTimelineEntry[];
}) {
  return (
    <Stack spacing={0}>
      {entries.map((entry, index) => {
        const exactTimestamp = formatExactTimestamp(entry.timestamp);

        return (
          <Stack
            key={entry.key}
            direction="row"
            spacing={2}
            sx={{
              position: "relative",
              pb: index < entries.length - 1 ? 2.5 : 0,
            }}
          >
            <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 28 }}>
              <Avatar size="sm" variant="soft" color="neutral">
                <StatusDot tone={entry.tone} />
              </Avatar>
              {index < entries.length - 1 ? (
                <Box
                  sx={{
                    width: 1,
                    flex: 1,
                    minHeight: 28,
                    bgcolor: "divider",
                  }}
                />
              ) : null}
            </Stack>

            <Stack
              spacing={0.5}
              sx={{ pb: index < entries.length - 1 ? 0.5 : 0 }}
            >
              <Typography level="body-sm">{entry.label}</Typography>
              <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                {entry.timestamp
                  ? formatRelativeTimestamp(entry.timestamp)
                  : "Waiting for provider data"}
              </Typography>
              {exactTimestamp ? (
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                  {exactTimestamp}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
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
    <Sheet
      color="neutral"
      variant="outlined"
      sx={{
        borderRadius: "lg",
        p: 2.5,
        bgcolor: "background.surface",
      }}
    >
      <Stack spacing={2}>
        <Stack spacing={0.75} sx={{ mb: 2 }}>
          <Typography level="title-sm" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {description}
          </Typography>
        </Stack>
        {children}
      </Stack>
    </Sheet>
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
    <Sheet
      color="neutral"
      variant="outlined"
      sx={{
        maxWidth: 720,
        mx: "auto",
        borderRadius: "xl",
        p: { xs: 2.5, md: 3.5 },
        borderColor: "neutral.200",
        boxShadow: "sm",
      }}
    >
      <Stack spacing={3}>
        {callout ? (
          <Alert
            color={callout.tone === "warning" ? "warning" : "neutral"}
            startDecorator={
              callout.tone === "warning" ? (
                <AlertTriangle size={16} />
              ) : (
                <Info size={16} />
              )
            }
            variant="soft"
          >
            <Stack spacing={0.5}>
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                {callout.title}
              </Typography>
              <Typography level="body-sm">{callout.description}</Typography>
            </Stack>
          </Alert>
        ) : null}

        <Stack spacing={1.5}>
          <Typography level="title-md">
            What you&apos;ll be able to do
          </Typography>
          <Stack spacing={1.25}>
            {capabilities.map((capability) => (
              <Stack
                key={capability}
                direction="row"
                spacing={1.25}
                alignItems="flex-start"
              >
                <CheckCircle2 size={16} />
                <Typography level="body-sm">{capability}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>

        {payloadPreview ? (
          <Sheet
            color="neutral"
            variant="soft"
            sx={{ borderRadius: "lg", p: 2 }}
          >
            <Typography level="body-sm" sx={{ fontWeight: 600, mb: 1 }}>
              {payloadPreview.summary}
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                overflowX: "auto",
                borderRadius: "md",
                bgcolor: "neutral.900",
                color: "common.white",
                p: 2,
                fontSize: "0.75rem",
              }}
            >
              {payloadPreview.content}
            </Box>
          </Sheet>
        ) : null}

        <Divider />

        {!isSubmitted ? (
          <Stack spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                Get notified when this launches
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                We&apos;ll email {notifyEmail ?? "your signed-in account"} when{" "}
                {integrationName} is available.
              </Typography>
            </Stack>
            <Button
              color="neutral"
              disabled={!notifyEmail || isSubmitting}
              size="sm"
              startDecorator={<Bell size={14} />}
              variant="outlined"
              onClick={onSubmit}
            >
              {isSubmitting ? "Saving request..." : notifyLabel}
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircle2 size={16} />
            <Typography level="body-sm">
              {notifyConfirmation.replace(
                "We'll notify you",
                `We'll notify you at ${notifyEmail ?? "your account email"}`,
              )}
            </Typography>
          </Stack>
        )}

        <Link href={requestPath} level="body-xs">
          {requestLabel}
        </Link>
      </Stack>
    </Sheet>
  );
}

export function KeyValueGrid({
  entries,
}: {
  entries: Array<{ label: string; value: string; description?: string }>;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 1.5,
      }}
    >
      {entries.map((entry) => (
        <Sheet
          key={`${entry.label}-${entry.value}`}
          color="neutral"
          variant="soft"
          sx={{ borderRadius: "lg", p: 2 }}
        >
          <Stack spacing={0.75}>
            <Typography
              level="body-xs"
              sx={{ color: "text.tertiary", fontWeight: 600 }}
            >
              {entry.label}
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              {entry.value}
            </Typography>
            {entry.description ? (
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                {entry.description}
              </Typography>
            ) : null}
          </Stack>
        </Sheet>
      ))}
    </Box>
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
    <Stack divider={<Divider sx={{ my: 1.5 }} />} spacing={0}>
      {rows.map((row) => (
        <FieldRow
          key={row.label}
          label={row.label}
          value={row.value}
          description={row.description}
          tone={row.tone}
          valueClassName={row.valueClassName}
          copyValue={row.copyValue}
          copyLabel={row.copyLabel}
          onCopy={onCopy}
        />
      ))}
    </Stack>
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
    <Sheet
      color="neutral"
      variant="outlined"
      sx={{ borderRadius: "lg", p: 2.5, bgcolor: "background.surface" }}
    >
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Stack spacing={0.5} sx={{ minWidth: 0, mb: 2 }}>
            <Typography level="title-sm" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {description ? (
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                {description}
              </Typography>
            ) : null}
          </Stack>
          {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
        </Stack>

        {contextNote ? (
          <Alert
            color={contextNote.tone === "warning" ? "warning" : "neutral"}
            variant="soft"
          >
            {contextNote.content}
          </Alert>
        ) : null}

        {children}
      </Stack>
    </Sheet>
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
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 0.75, sm: 2 }}
      alignItems={{ xs: "stretch", sm: "flex-start" }}
      justifyContent="space-between"
      sx={{ py: 1 }}
    >
      <Typography
        level="body-sm"
        sx={{
          width: { sm: 160 },
          flexShrink: 0,
          color: "text.tertiary",
        }}
      >
        {label}
      </Typography>

      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ flex: 1, minWidth: 0 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            {classes && hasValue ? <StatusDot tone={tone!} /> : null}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                level="body-sm"
                className={valueClassName}
                sx={{
                  color: hasValue
                    ? (classes?.textColor ?? "text.primary")
                    : "text.tertiary",
                  fontStyle: hasValue ? "normal" : "italic",
                  wordBreak: "break-word",
                  ...getValueSx(valueClassName),
                }}
              >
                {renderFieldValue(value)}
              </Typography>
            </Box>
          </Stack>
          {description ? (
            <Typography
              level="body-xs"
              sx={{
                color: "text.secondary",
                pl: classes && hasValue ? 2.25 : 0,
              }}
            >
              {description}
            </Typography>
          ) : null}
        </Stack>

        {copyValue && onCopy && copyLabel ? (
          <Tooltip
            title={isCopied ? `${copyLabel} copied` : `Copy ${copyLabel}`}
          >
            <IconButton
              aria-label={
                isCopied ? `${copyLabel} copied` : `Copy ${copyLabel}`
              }
              color="neutral"
              size="sm"
              variant="plain"
              onClick={() => onCopy(copyValue, copyLabel)}
            >
              {isCopied ? <Check size={14} /> : <Copy size={14} />}
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
    </Stack>
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
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 0.75, sm: 2 }}
      justifyContent="space-between"
      sx={{ py: 1 }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
        <Typography level="body-sm">{label}</Typography>
        {description ? (
          <Typography level="body-xs" sx={{ color: "text.secondary" }}>
            {description}
          </Typography>
        ) : null}
      </Stack>

      <Box sx={{ flexShrink: 0 }}>
        <DetailStatusBadge
          label={String(renderFieldValue(value))}
          tone={tone}
        />
      </Box>
    </Stack>
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
  const relativeTimestamp = formatRelativePlusAbsolute(lastSyncedAt, "-");

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
      valueClassName={isSyncing ? "text-emerald-600" : undefined}
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
  return (
    <HealthFieldRow
      label={label}
      value={status}
      tone={tone}
      description={description}
    />
  );
}

export type IntegrationShellBanner = {
  tone: "warning" | "danger" | "neutral";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function IntegrationStatusBanner({
  banner,
}: {
  banner: IntegrationShellBanner;
}) {
  const icon =
    banner.tone === "danger" ? (
      <CircleAlert size={18} />
    ) : banner.tone === "warning" ? (
      <AlertTriangle size={18} />
    ) : (
      <Info size={18} />
    );

  return (
    <Alert
      color={
        banner.tone === "danger"
          ? "danger"
          : banner.tone === "warning"
            ? "warning"
            : "neutral"
      }
      size="lg"
      startDecorator={icon}
      endDecorator={
        banner.actionLabel && banner.onAction ? (
          <Button
            color="neutral"
            size="sm"
            variant="solid"
            onClick={banner.onAction}
          >
            {banner.actionLabel}
          </Button>
        ) : undefined
      }
      variant="soft"
      sx={{ alignItems: "flex-start", borderRadius: "lg" }}
    >
      <Stack spacing={0.5}>
        <Typography level="title-sm" sx={{ fontWeight: 700 }}>
          {banner.title}
        </Typography>
        <Typography level="body-sm">{banner.description}</Typography>
      </Stack>
    </Alert>
  );
}

type HeroAction = {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  variant?: "solid" | "outlined";
  icon?: LucideIcon;
};

export function IntegrationActionMenu({
  sections,
}: {
  sections: ActionDropdownSection[];
}) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <Dropdown>
      <MenuButton
        slots={{ root: IconButton }}
        slotProps={{
          root: { color: "neutral", size: "sm", variant: "outlined" },
        }}
      >
        <MoreHorizontal size={16} />
      </MenuButton>
      <Menu placement="bottom-end" size="sm">
        {sections.map((section, sectionIndex) => (
          <Box key={section.id ?? `section-${sectionIndex}`}>
            {section.label ? (
              <Typography
                level="body-xs"
                sx={{
                  px: 1.5,
                  py: 0.75,
                  color: "text.tertiary",
                  fontWeight: 600,
                }}
              >
                {section.label}
              </Typography>
            ) : null}
            {section.items.map((item) => {
              const ItemIcon = item.icon;

              return (
                <MenuItem
                  key={item.id ?? item.label}
                  color={item.destructive ? "danger" : "neutral"}
                  disabled={item.disabled}
                  onClick={() => item.onSelect?.()}
                >
                  <Stack
                    direction="row"
                    spacing={1.25}
                    alignItems="flex-start"
                    sx={{ minWidth: 220 }}
                  >
                    {ItemIcon ? <ItemIcon size={15} /> : null}
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography level="body-sm">{item.label}</Typography>
                      {item.description ? (
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.tertiary" }}
                        >
                          {item.description}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </MenuItem>
              );
            })}
            {sectionIndex < sections.length - 1 ? <ListDivider /> : null}
          </Box>
        ))}
      </Menu>
    </Dropdown>
  );
}

export function IntegrationDetailHero({
  providerName,
  hubPath,
  logoSrc,
  categoryLabel,
  statusLabel,
  statusTone,
  summary,
  metadata,
  primaryAction,
  actionSections,
}: {
  providerName: string;
  hubPath: string;
  logoSrc?: string | null;
  categoryLabel: string;
  statusLabel: string;
  statusTone: IntegrationDetailTone;
  summary?: ReactNode;
  metadata?: ReactNode;
  primaryAction?: HeroAction | null;
  actionSections?: ActionDropdownSection[];
}) {
  const ActionIcon = primaryAction?.icon;

  return (
    <Sheet
      color="neutral"
      variant="outlined"
      sx={{
        borderRadius: "xl",
        p: { xs: 2.5, md: 3 },
        bgcolor: "background.surface",
      }}
    >
      <Stack spacing={1.5}>
        <Breadcrumbs separator="/" size="sm">
          <Link href={hubPath} level="body-sm" underline="hover">
            Integrations
          </Link>
          <Typography level="body-sm" sx={{ color: "text.primary" }}>
            {providerName}
          </Typography>
        </Breadcrumbs>

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="flex-start"
            sx={{ minWidth: 0 }}
          >
            <Avatar
              color="neutral"
              size="lg"
              src={logoSrc ?? undefined}
              variant="outlined"
              sx={{ bgcolor: "background.surface" }}
            >
              {providerName.slice(0, 1).toUpperCase()}
            </Avatar>

            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Stack spacing={1}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Typography level="h4" sx={{ fontWeight: 700 }}>
                    {providerName}
                  </Typography>
                  <Chip color="neutral" size="sm" variant="soft">
                    {categoryLabel}
                  </Chip>
                  <DetailStatusBadge label={statusLabel} tone={statusTone} />
                </Stack>
              </Stack>

              {summary ? (
                <Typography
                  level="body-sm"
                  sx={{ color: "text.tertiary", maxWidth: 600 }}
                >
                  {summary}
                </Typography>
              ) : null}

              {metadata ? metadata : null}
            </Stack>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            {primaryAction ? (
              <Button
                color="neutral"
                disabled={primaryAction.disabled}
                size="sm"
                startDecorator={
                  primaryAction.loading ? (
                    <CircularProgress color="neutral" size="sm" />
                  ) : ActionIcon ? (
                    <ActionIcon size={16} />
                  ) : undefined
                }
                variant={primaryAction.variant ?? "solid"}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            ) : null}
            <IntegrationActionMenu sections={actionSections ?? []} />
          </Stack>
        </Stack>
      </Stack>
    </Sheet>
  );
}

export type IntegrationTabItem<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
  isActive?: boolean;
  disabled?: boolean;
};

export function IntegrationDetailTabs<T extends string>({
  value,
  onChange,
  items,
  children,
}: {
  value: T;
  onChange: (nextValue: T) => void;
  items: Array<IntegrationTabItem<T>>;
  children: ReactNode;
}) {
  return (
    <Tabs
      aria-label="Integration tabs"
      value={value}
      onChange={(_, nextValue) => {
        if (typeof nextValue === "string") {
          onChange(nextValue as T);
        }
      }}
      sx={{
        bgcolor: "transparent",
        "--Tabs-gap": "0px",
      }}
    >
      <TabList
        disableUnderline
        sx={{
          p: 0.5,
          gap: 0.5,
          borderRadius: "xl",
          bgcolor: "background.level1",
          [`& .${tabClasses.root}[aria-selected="true"]`]: {
            boxShadow: "sm",
            bgcolor: "background.surface",
          },
        }}
        variant="plain"
      >
        {items.map((item) => (
          <Tab
            key={item.value}
            disableIndicator
            disabled={item.disabled}
            sx={{
              fontWeight: "md",
              fontSize: "sm",
              px: 2,
              py: 0.75,
              borderRadius: "lg",
              color: "text.tertiary",
              [`&.${tabClasses.selected}`]: {
                color: "text.primary",
                fontWeight: "lg",
              },
            }}
            value={item.value}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography level="body-sm">{item.label}</Typography>
              {typeof item.count === "number" ? (
                <Chip
                  size="sm"
                  variant="soft"
                  color="neutral"
                  sx={{ ml: 0.75, minWidth: 20, height: 20 }}
                >
                  {item.count.toLocaleString()}
                </Chip>
              ) : null}
              {item.isActive ? <StatusDot tone="success" /> : null}
            </Stack>
          </Tab>
        ))}
      </TabList>
      {children}
    </Tabs>
  );
}

export function IntegrationDetailTabPanel({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <TabPanel sx={{ p: 0, pt: 3 }} value={value}>
      <Stack spacing={2.5}>{children}</Stack>
    </TabPanel>
  );
}

export function DangerZone({
  actions,
}: {
  actions: Array<{
    label: string;
    description: string;
    buttonLabel: string;
    disabled?: boolean;
    loading?: boolean;
    onClick: () => void;
  }>;
}) {
  if (actions.length === 0) {
    return null;
  }

  const toDangerActionButtonLabel = (label: string) => {
    if (/disconnect|remove\s+.+connection/i.test(label)) {
      return "Disconnect";
    }

    return label;
  };

  return (
    <Sheet
      color="danger"
      variant="outlined"
      sx={{
        borderRadius: "lg",
        p: 3,
        borderColor: "danger.outlinedBorder",
        bgcolor: "background.surface",
      }}
    >
      <Stack spacing={2}>
        <Stack spacing={0.5} sx={{ mb: 2.5 }}>
          <Typography level="title-md" sx={{ color: "danger.plainColor" }}>
            Danger Zone
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
            Destructive actions immediately affect the active integration
            connection.
          </Typography>
        </Stack>

        <Stack divider={<Divider sx={{ my: 2 }} />} spacing={0}>
          {actions.map((action) => (
            <Stack
              key={action.label}
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="space-between"
              sx={{ py: 1.25 }}
            >
              <Stack spacing={0.4} sx={{ minWidth: 0, flex: 1 }}>
                <Typography level="body-md" sx={{ fontWeight: "lg" }}>
                  {action.label}
                </Typography>
                <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                  {action.description}
                </Typography>
              </Stack>
              <Box sx={{ flexShrink: 0, ml: 3 }}>
                <Button
                  color="danger"
                  disabled={action.disabled || action.loading}
                  size="sm"
                  variant="outlined"
                  sx={{ whiteSpace: "nowrap", minWidth: "fit-content" }}
                  onClick={action.onClick}
                >
                  {action.loading
                    ? "Working..."
                    : toDangerActionButtonLabel(action.buttonLabel)}
                </Button>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Sheet>
  );
}

export function LoadingShell({ rows = 3 }: { rows?: number }) {
  return (
    <PageContainer
      fullWidth
      data-testid="integration-detail-loading-shell"
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
    >
      <Stack spacing={3}>
        <Stack spacing={2}>
          <Skeleton
            sx={{ width: 180, height: 16, borderRadius: 999 }}
            variant="rectangular"
          />

          <Sheet
            color="neutral"
            variant="outlined"
            sx={{
              borderRadius: "xl",
              borderColor: "divider",
              bgcolor: "background.surface",
              p: { xs: 2.5, md: 3 },
            }}
          >
            <Stack spacing={1.5}>
              <Skeleton
                sx={{ width: 180, height: 16, borderRadius: 999 }}
                variant="rectangular"
              />
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", lg: "center" }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Skeleton
                    sx={{ width: 48, height: 48, borderRadius: "50%" }}
                    variant="circular"
                  />
                  <Stack spacing={1}>
                    <Skeleton
                      sx={{ width: 220, height: 32, borderRadius: "md" }}
                      variant="rectangular"
                    />
                    <Stack direction="row" spacing={1}>
                      <Skeleton
                        sx={{ width: 118, height: 28, borderRadius: 999 }}
                        variant="rectangular"
                      />
                      <Skeleton
                        sx={{ width: 124, height: 28, borderRadius: 999 }}
                        variant="rectangular"
                      />
                    </Stack>
                    <Skeleton
                      sx={{ width: 360, height: 16, borderRadius: 999 }}
                      variant="rectangular"
                    />
                    <Stack
                      direction="row"
                      spacing={1.5}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton
                          key={index}
                          sx={{ width: 132, height: 12, borderRadius: 999 }}
                          variant="rectangular"
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Skeleton
                    sx={{ width: 152, height: 36, borderRadius: "md" }}
                    variant="rectangular"
                  />
                  <Skeleton
                    sx={{ width: 36, height: 36, borderRadius: "md" }}
                    variant="rectangular"
                  />
                </Stack>
              </Stack>
            </Stack>
          </Sheet>

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                key={index}
                sx={{ width: 88 + index * 8, height: 18, borderRadius: 999 }}
                variant="rectangular"
              />
            ))}
          </Stack>
        </Stack>

        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 2,
            }}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <Sheet
                key={index}
                variant="outlined"
                sx={{
                  borderRadius: "lg",
                  p: 2.5,
                  bgcolor: "background.surface",
                }}
              >
                <Stack spacing={1.25}>
                  <Skeleton
                    sx={{ width: 90, height: 12, borderRadius: 999 }}
                    variant="rectangular"
                  />
                  <Skeleton
                    sx={{ width: 96, height: 34, borderRadius: "md" }}
                    variant="rectangular"
                  />
                  <Skeleton
                    sx={{ width: 140, height: 12, borderRadius: 999 }}
                    variant="rectangular"
                  />
                </Stack>
              </Sheet>
            ))}
          </Box>

          <Sheet
            variant="outlined"
            sx={{ borderRadius: "lg", p: 2.5, bgcolor: "background.surface" }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5}>
                {Array.from({ length: rows }).map((_, index) => (
                  <Skeleton
                    key={index}
                    sx={{ width: 92, height: 18, borderRadius: 999 }}
                    variant="rectangular"
                  />
                ))}
              </Stack>
              <Stack spacing={2}>
                {Array.from({ length: rows }).map((_, index) => (
                  <Sheet
                    key={index}
                    color="neutral"
                    variant="outlined"
                    sx={{
                      borderRadius: "lg",
                      borderColor: "neutral.200",
                      p: 2.5,
                    }}
                  >
                    <Stack spacing={2}>
                      <Skeleton
                        sx={{ width: 190, height: 18, borderRadius: 999 }}
                        variant="rectangular"
                      />
                      <Skeleton
                        sx={{ width: "74%", height: 14, borderRadius: 999 }}
                        variant="rectangular"
                      />
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(3, minmax(0, 1fr))",
                          },
                          gap: 1.5,
                        }}
                      >
                        {Array.from({ length: 3 }).map((__, cellIndex) => (
                          <Skeleton
                            key={cellIndex}
                            sx={{ height: 96, borderRadius: "lg" }}
                            variant="rectangular"
                          />
                        ))}
                      </Box>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            </Stack>
          </Sheet>
        </Stack>
      </Stack>
    </PageContainer>
  );
}
