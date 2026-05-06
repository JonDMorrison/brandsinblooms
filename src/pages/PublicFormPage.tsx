import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertCircle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { useParams } from "react-router-dom";
import { FormPreviewRenderer } from "@/components/forms/preview/FormPreviewRenderer";
import {
  getFormWidthValue,
  normalizeFormSettings,
} from "@/lib/forms/designSettings";
import { SUPABASE_URL } from "@/integrations/supabase/config";
import {
  DEFAULT_FORM_COMPLIANCE,
  DEFAULT_FORM_SETTINGS,
  type FormCompliance,
  type FormField,
  type FormSettings,
} from "@/types/formBuilder";

interface FormConfig {
  form_id: string;
  fields_json: FormField[];
  settings_json: FormSettings;
  compliance_json: FormCompliance;
}

interface PublicFormLoadError {
  kind: "retryable" | "not-available" | "rate-limited";
  title: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(value: string) {
  const normalized = value.replace("#", "").trim();
  const hex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function mixHex(base: string, target: string, ratio: number) {
  const baseRgb = hexToRgb(base);
  const targetRgb = hexToRgb(target);
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  const mixed = {
    r: clampChannel(baseRgb.r + (targetRgb.r - baseRgb.r) * clampedRatio),
    g: clampChannel(baseRgb.g + (targetRgb.g - baseRgb.g) * clampedRatio),
    b: clampChannel(baseRgb.b + (targetRgb.b - baseRgb.b) * clampedRatio),
  };

  return `#${mixed.r.toString(16).padStart(2, "0")}${mixed.g
    .toString(16)
    .padStart(2, "0")}${mixed.b.toString(16).padStart(2, "0")}`;
}

function toRgba(value: string, alpha: number) {
  const { r, g, b } = hexToRgb(value);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildPublicSubmissionData(
  fields: FormField[],
  formData: Record<string, unknown>,
) {
  const fieldIds = new Set(fields.map((field) => field.id));
  const nextData: Record<string, unknown> = {};

  fields.forEach((field) => {
    const submissionKey = field.mapping_key || field.id;

    if (
      field.type === "hidden" &&
      field.default_value !== undefined &&
      field.default_value !== null &&
      field.default_value !== ""
    ) {
      nextData[submissionKey] = field.default_value;
      return;
    }

    if (formData[field.id] !== undefined) {
      nextData[submissionKey] = formData[field.id];
    }
  });

  Object.entries(formData).forEach(([key, value]) => {
    if (fieldIds.has(key)) {
      return;
    }

    nextData[key] = value;
  });

  return nextData;
}

function getHostedPageBackgroundSx(settings: FormSettings) {
  const resolvedSettings = normalizeFormSettings(settings);
  const backgroundColor = resolvedSettings.theme.background_color ?? "#FFFFFF";
  const primaryColor = resolvedSettings.theme.primary_color ?? "#22C55E";
  const backgroundStyle = resolvedSettings.theme.background_style ?? "white";

  if (backgroundStyle === "green-tint") {
    return {
      background:
        `radial-gradient(circle at top, ${toRgba(primaryColor, 0.16)}, transparent 28%), ` +
        `linear-gradient(180deg, ${mixHex(backgroundColor, "#F4FBF6", 0.4)} 0%, ${mixHex(backgroundColor, "#FFFFFF", 0.12)} 100%)`,
    };
  }

  if (backgroundStyle === "custom") {
    return {
      background:
        `radial-gradient(circle at top, ${toRgba(primaryColor, 0.14)}, transparent 26%), ` +
        `linear-gradient(180deg, ${mixHex(backgroundColor, "#FFFFFF", 0.08)} 0%, ${backgroundColor} 100%)`,
    };
  }

  if (backgroundStyle === "transparent") {
    return {
      background:
        `radial-gradient(circle at top, ${toRgba(primaryColor, 0.12)}, transparent 24%), ` +
        `linear-gradient(180deg, ${mixHex(backgroundColor, "#FFFFFF", 0.88)} 0%, ${mixHex(backgroundColor, "#F6F4EF", 0.8)} 100%)`,
    };
  }

  return {
    background:
      `radial-gradient(circle at top, ${toRgba(primaryColor, 0.1)}, transparent 24%), ` +
      `linear-gradient(180deg, ${mixHex(backgroundColor, "#FFFFFF", 0.9)} 0%, ${mixHex(backgroundColor, "#F5F2EA", 0.82)} 100%)`,
  };
}

function PublicPageShell({
  children,
  backgroundSx,
}: {
  children: React.ReactNode;
  backgroundSx?: Record<string, unknown>;
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 3, md: 5 },
        ...backgroundSx,
      }}
    >
      <Box
        sx={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function HostedStateCard({
  icon,
  title,
  message,
  actionLabel,
  actionDisabled = false,
  actionHint,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionHint?: string;
  onAction?: () => void;
}) {
  return (
    <Sheet
      variant="plain"
      sx={{
        width: "100%",
        maxWidth: 520,
        borderRadius: "28px",
        backgroundColor: "background.surface",
        border: "1px solid",
        borderColor: "neutral.200",
        px: { xs: 3, md: 4 },
        py: { xs: 4, md: 4.5 },
        textAlign: "center",
        boxShadow: "var(--joy-shadow-lg)",
      }}
    >
      <Stack spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.level1",
            color: "neutral.700",
          }}
        >
          {icon}
        </Box>
        <Typography level="title-lg">{title}</Typography>
        <Typography level="body-sm" color="neutral" sx={{ maxWidth: 360 }}>
          {message}
        </Typography>
        {actionLabel && onAction ? (
          <Stack spacing={0.5} alignItems="center">
            <Button
              startDecorator={<RefreshCw size={16} />}
              disabled={actionDisabled}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
            {actionHint ? (
              <Typography level="body-xs" color="neutral">
                {actionHint}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Sheet>
  );
}

export default function PublicFormPage() {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [form, setForm] = React.useState<FormConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<PublicFormLoadError | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [retryCountdown, setRetryCountdown] = React.useState<number | null>(
    null,
  );

  const resolvedSettings = React.useMemo(
    () => normalizeFormSettings(form?.settings_json || DEFAULT_FORM_SETTINGS),
    [form],
  );
  const shellBackgroundSx = React.useMemo(
    () => getHostedPageBackgroundSx(resolvedSettings),
    [resolvedSettings],
  );
  const formContainerMaxWidth = React.useMemo(() => {
    const width = getFormWidthValue(resolvedSettings.form_width);
    return width === "100%" ? "100%" : width;
  }, [resolvedSettings.form_width]);

  const loadForm = React.useCallback(async () => {
    if (!embedKey) {
      setLoadError({
        kind: "not-available",
        title: "Form not available",
        message: "This form may have been unpublished or removed by the owner.",
        retryable: false,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setRetryCountdown(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get-form-config?embed_key=${embedKey}`,
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const nextError = getPublicFormLoadError(
          response.status,
          typeof errData?.error === "string" ? errData.error : undefined,
          response.headers.get("Retry-After"),
        );

        setForm(null);
        setLoadError(nextError);
        setRetryCountdown(nextError.retryAfterSeconds ?? null);
        return;
      }

      const data = (await response.json()) as FormConfig;
      setForm(data);
    } catch (error) {
      setForm(null);
      setLoadError(
        getPublicFormLoadError(
          null,
          error instanceof Error ? error.message : undefined,
          null,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [embedKey]);

  React.useEffect(() => {
    void loadForm();
  }, [loadForm]);

  React.useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRetryCountdown((current) => {
        if (current === null) {
          return null;
        }

        return Math.max(0, current - 1);
      });
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [retryCountdown]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!form || !embedKey) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: embedKey,
          data: buildPublicSubmissionData(form.fields_json, formData),
          meta: {
            page_url: window.location.href,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent,
          },
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getSubmissionErrorMessage({
            status: response.status,
            payload: result,
            retryAfter: response.headers.get("Retry-After"),
          }),
        );
      }
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to submit form.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicPageShell backgroundSx={getHostedPageBackgroundSx(DEFAULT_FORM_SETTINGS)}>
        <HostedStateCard
          icon={<CircularProgress color="neutral" size="sm" />}
          title="Loading form…"
          message="Preparing the hosted form experience."
        />
      </PublicPageShell>
    );
  }

  if (loadError && !form) {
    return (
      <PublicPageShell backgroundSx={getHostedPageBackgroundSx(DEFAULT_FORM_SETTINGS)}>
        <HostedStateCard
          icon={
            loadError.kind === "not-available" ? (
              <Info size={24} />
            ) : (
              <AlertCircle size={24} />
            )
          }
          title={loadError.title}
          message={loadError.message}
          actionLabel={
            loadError.retryable
              ? retryCountdown && retryCountdown > 0
                ? `Retry in ${retryCountdown}s`
                : "Retry"
              : undefined
          }
          actionDisabled={Boolean(retryCountdown && retryCountdown > 0)}
          actionHint={
            loadError.kind === "rate-limited" && retryCountdown && retryCountdown > 0
              ? "The retry button will enable automatically."
              : undefined
          }
          onAction={loadError.retryable ? () => void loadForm() : undefined}
        />
      </PublicPageShell>
    );
  }

  if (!form) {
    return null;
  }

  return (
    <PublicPageShell backgroundSx={shellBackgroundSx}>
      <Box
        sx={{
          width: "100%",
          maxWidth: formContainerMaxWidth,
        }}
      >
        <FormPreviewRenderer
          fields={form.fields_json || []}
          settings={resolvedSettings}
          compliance={form.compliance_json || DEFAULT_FORM_COMPLIANCE}
          mode="embed"
          onSubmit={handleSubmit}
          isSubmitting={submitting}
          uploadEmbedKey={embedKey}
        />
      </Box>
    </PublicPageShell>
  );
}

function getPublicFormLoadError(
  status: number | null,
  message?: string,
  retryAfter?: string | null,
): PublicFormLoadError {
  if (status === 404) {
    return {
      kind: "not-available",
      title: "Form not available",
      message: "This form may have been unpublished or removed by the owner.",
      retryable: false,
    };
  }

  if (status === 429) {
    const retryAfterSeconds = Number.parseInt(retryAfter ?? "", 10);

    return {
      kind: "rate-limited",
      title: "Too many requests",
      message: "Please wait a moment and try again.",
      retryable: true,
      retryAfterSeconds:
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : 60,
    };
  }

  if (status !== null && status >= 500) {
    return {
      kind: "retryable",
      title: "Unable to load form",
      message: "Please check your connection and try again.",
      retryable: true,
    };
  }

  if (status !== null) {
    return {
      kind: "retryable",
      title: "Unable to load form",
      message: message || "Please check your connection and try again.",
      retryable: true,
    };
  }

  return {
    kind: "retryable",
    title: "Unable to load form",
    message: "Please check your connection and try again.",
    retryable: true,
  };
}

function getSubmissionErrorMessage({
  status,
  payload,
  retryAfter,
}: {
  status: number;
  payload: unknown;
  retryAfter: string | null;
}): string {
  const errorPayload =
    payload && typeof payload === "object"
      ? (payload as { error?: string; details?: string[] })
      : {};

  if (status === 429) {
    const seconds = Number.parseInt(retryAfter ?? "", 10);
    const waitMessage =
      Number.isFinite(seconds) && seconds > 0
        ? ` Try again in about ${seconds} seconds.`
        : " Please wait before trying again.";

    return `You've submitted too many times. Please wait before trying again.${waitMessage}`;
  }

  if (
    status === 400 &&
    Array.isArray(errorPayload.details) &&
    errorPayload.details.length > 0
  ) {
    return errorPayload.details[0];
  }

  if (status === 404) {
    return "This form is no longer available.";
  }

  if (status >= 500) {
    return "Something went wrong. Please try again.";
  }

  return errorPayload.error || "Something went wrong. Please try again.";
}
