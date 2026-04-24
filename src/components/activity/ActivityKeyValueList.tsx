import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Copy } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "sonner";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  formatActivityLabel,
  getKnownEntityHref,
  isInternalHref,
} from "@/components/activity/activityPresentation";

export interface ActivityKeyValueListProps {
  data?: Record<string, unknown> | null;
  hiddenKeys?: string[];
  labelMap?: Record<string, string>;
  emptyLabel?: string;
  linkResolver?: (key: string, value: unknown) => string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatKey(key: string, labelMap?: Record<string, string>) {
  if (labelMap?.[key]) {
    return labelMap[key];
  }

  return formatActivityLabel(key);
}

function isIsoTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function isLikelyUrl(value: string) {
  return /^https?:\/\//i.test(value) || isInternalHref(value);
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function copyValue(value: string) {
  void navigator.clipboard.writeText(value);
  toast.success("Copied to clipboard");
}

function renderLinkValue(href: string, label: string) {
  if (isInternalHref(href)) {
    return (
      <Link component={RouterLink} to={href} underline="hover">
        {label}
      </Link>
    );
  }

  return (
    <Link href={href} target="_blank" rel="noreferrer" underline="hover">
      {label}
    </Link>
  );
}

function renderValue(
  key: string,
  value: unknown,
  labelMap?: Record<string, string>,
  depth = 0,
  linkResolver?: (key: string, value: unknown) => string | null,
): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <Typography level="body-sm">—</Typography>;
  }

  if (typeof value === "boolean") {
    return (
      <JoyChip color={value ? "success" : "neutral"} size="sm" variant="soft">
        {value ? "Yes" : "No"}
      </JoyChip>
    );
  }

  if (typeof value === "number") {
    return <Typography level="body-sm">{value.toLocaleString()}</Typography>;
  }

  if (typeof value === "string") {
    const resolvedHref =
      linkResolver?.(key, value) ?? getKnownEntityHref(key, value);

    if (resolvedHref) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
          {renderLinkValue(resolvedHref, value)}
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() => copyValue(value)}
          >
            <Copy size={14} />
          </IconButton>
        </Stack>
      );
    }

    if (UUID_RE.test(value)) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
          <Typography
            level="body-sm"
            sx={{
              fontFamily: "var(--joy-fontFamily-code)",
              wordBreak: "break-all",
            }}
          >
            {value}
          </Typography>
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() => copyValue(value)}
          >
            <Copy size={14} />
          </IconButton>
        </Stack>
      );
    }

    if (isIsoTimestamp(value)) {
      return <Typography level="body-sm">{formatTimestamp(value)}</Typography>;
    }

    if (isLikelyUrl(value)) {
      return renderLinkValue(value, value);
    }

    return (
      <Typography level="body-sm" sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    );
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return <Typography level="body-sm">—</Typography>;
    }

    return (
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {value.map((item, index) => {
          if (
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean"
          ) {
            return (
              <JoyChip key={`${key}:${index}`} size="sm" variant="soft">
                {String(item)}
              </JoyChip>
            );
          }

          return (
            <Sheet
              key={`${key}:${index}`}
              variant="soft"
              sx={{ borderRadius: "md", px: 1.25, py: 0.75 }}
            >
              {renderValue(
                `${key}.${index}`,
                item,
                labelMap,
                depth + 1,
                linkResolver,
              )}
            </Sheet>
          );
        })}
      </Stack>
    );
  }

  if (typeof value === "object") {
    if (depth >= 1) {
      return (
        <Typography
          level="body-sm"
          sx={{
            fontFamily: "var(--joy-fontFamily-code)",
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(value, null, 2)}
        </Typography>
      );
    }

    const nestedEntries = Object.entries(
      value as Record<string, unknown>,
    ).filter(([, nestedValue]) => nestedValue !== undefined);

    if (!nestedEntries.length) {
      return <Typography level="body-sm">—</Typography>;
    }

    return (
      <Sheet
        variant="soft"
        sx={{
          borderRadius: "lg",
          border: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "background.level1",
          px: 1.5,
          py: 1.25,
        }}
      >
        <Stack spacing={1.25}>
          {nestedEntries.map(([nestedKey, nestedValue]) => (
            <Box
              key={`${key}.${nestedKey}`}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "140px minmax(0, 1fr)" },
                gap: 1,
              }}
            >
              <Typography level="body-xs" color="neutral">
                {formatKey(nestedKey, labelMap)}
              </Typography>
              <Box>
                {renderValue(
                  `${key}.${nestedKey}`,
                  nestedValue,
                  labelMap,
                  depth + 1,
                  linkResolver,
                )}
              </Box>
            </Box>
          ))}
        </Stack>
      </Sheet>
    );
  }

  return <Typography level="body-sm">{String(value)}</Typography>;
}

export function ActivityKeyValueList({
  data,
  hiddenKeys = [],
  labelMap,
  emptyLabel = "No data",
  linkResolver,
}: ActivityKeyValueListProps) {
  const hiddenKeySet = React.useMemo(() => new Set(hiddenKeys), [hiddenKeys]);
  const entries = React.useMemo(
    () =>
      Object.entries(data ?? {}).filter(
        ([key, value]) => value !== undefined && !hiddenKeySet.has(key),
      ),
    [data, hiddenKeySet],
  );

  if (!entries.length) {
    return (
      <Typography level="body-sm" color="neutral">
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {entries.map(([key, value]) => (
        <Box
          key={key}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "160px minmax(0, 1fr)" },
            gap: 1,
            alignItems: "start",
          }}
        >
          <Typography level="body-xs" color="neutral">
            {formatKey(key, labelMap)}
          </Typography>
          <Box sx={{ minWidth: 0 }}>
            {renderValue(key, value, labelMap, 0, linkResolver)}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
