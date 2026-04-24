import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertCircle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { FormPreviewRenderer } from "@/components/forms/preview/FormPreviewRenderer";
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
  title: string;
  message: string;
  retryable: boolean;
}

function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 5 },
        background:
          "radial-gradient(circle at top, rgba(34, 197, 94, 0.14), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #f3efe6 100%)",
      }}
    >
      <Box
        sx={{
          minHeight: "calc(100vh - 48px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
          <JoyChip
            size="sm"
            variant="soft"
            color="neutral"
            startDecorator={<ShieldCheck size={14} />}
          >
            Secure BloomSuite form
          </JoyChip>
          {children}
        </Stack>
      </Box>
    </Box>
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

  React.useEffect(() => {
    if (!embedKey) {
      setLoadError({
        title: "This form is not available",
        message: "The public link is incomplete or no longer valid.",
        retryable: false,
      });
      setLoading(false);
      return;
    }

    const fetchForm = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/get-form-config?embed_key=${embedKey}`,
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          setForm(null);
          setLoadError(
            getPublicFormLoadError(
              response.status,
              typeof errData?.error === "string" ? errData.error : undefined,
            ),
          );
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
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchForm();
  }, [embedKey]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!form || !embedKey) {
      return;
    }

    const fieldIds = new Set(form.fields_json.map((field) => field.id));
    const enrichedData: Record<string, unknown> = {};

    form.fields_json.forEach((field) => {
      const submissionKey = field.mapping_key || field.id;

      if (
        field.type === "hidden" &&
        field.default_value !== undefined &&
        field.default_value !== null &&
        field.default_value !== ""
      ) {
        enrichedData[submissionKey] = field.default_value;
        return;
      }

      if (formData[field.id] !== undefined) {
        enrichedData[submissionKey] = formData[field.id];
      }
    });

    Object.entries(formData).forEach(([key, value]) => {
      if (fieldIds.has(key)) {
        return;
      }

      enrichedData[key] = value;
    });

    setSubmitting(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: embedKey,
          data: enrichedData,
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
      <PublicPageShell>
        <Sheet
          variant="plain"
          sx={{
            width: "100%",
            maxWidth: 420,
            borderRadius: "xl",
            backgroundColor: "rgba(255,255,255,0.88)",
            border: "1px solid",
            borderColor: "neutral.200",
            p: 4,
            textAlign: "center",
            boxShadow: "var(--joy-shadow-lg)",
          }}
        >
          <Stack spacing={1.5} alignItems="center">
            <Avatar size="lg" variant="soft" color="primary">
              <Loader2 size={24} />
            </Avatar>
            <Typography level="title-lg">Loading form</Typography>
            <Typography level="body-sm" color="neutral">
              Fetching the latest published version and preparing the secure
              submission flow.
            </Typography>
          </Stack>
        </Sheet>
      </PublicPageShell>
    );
  }

  if (loadError && !form) {
    return (
      <PublicPageShell>
        <Sheet
          variant="plain"
          sx={{
            width: "100%",
            maxWidth: 520,
            borderRadius: "xl",
            backgroundColor: "rgba(255,255,255,0.92)",
            border: "1px solid",
            borderColor: "neutral.200",
            p: 4,
            textAlign: "center",
            boxShadow: "var(--joy-shadow-lg)",
          }}
        >
          <Stack spacing={1.5} alignItems="center">
            <Avatar size="lg" variant="soft" color="danger">
              <AlertCircle size={24} />
            </Avatar>
            <Typography level="title-lg">{loadError.title}</Typography>
            <Typography level="body-sm" color="neutral">
              {loadError.message}
            </Typography>
            {loadError.retryable ? (
              <JoyButton
                startDecorator={<RefreshCw size={16} />}
                onClick={() => window.location.reload()}
              >
                Try again
              </JoyButton>
            ) : null}
          </Stack>
        </Sheet>
      </PublicPageShell>
    );
  }

  if (!form) {
    return null;
  }

  return (
    <PublicPageShell>
      <Box sx={{ width: "100%", maxWidth: 1200 }}>
        <FormPreviewRenderer
          fields={form.fields_json || []}
          settings={form.settings_json || DEFAULT_FORM_SETTINGS}
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
): PublicFormLoadError {
  if (status === 404) {
    return {
      title: "This form is not available",
      message:
        "The link is invalid or the form is no longer published. If you expected it to be live, contact the team that shared it.",
      retryable: false,
    };
  }

  if (status !== null && status >= 500) {
    return {
      title: "We could not load this form",
      message:
        "The form service returned an unexpected error. Refresh and try again in a moment.",
      retryable: true,
    };
  }

  if (status !== null) {
    return {
      title: "We could not load this form",
      message: message || "Refresh and try again in a moment.",
      retryable: true,
    };
  }

  return {
    title: "Connection problem",
    message:
      "We could not reach the form service. Check your connection and try again.",
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
        ? ` Please wait about ${seconds} seconds and try again.`
        : " Please wait a minute and try again.";

    return `${errorPayload.error || "Too many attempts."}${waitMessage}`;
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
    return "We could not submit the form right now. Please try again in a moment.";
  }

  return errorPayload.error || "Submission failed. Please try again.";
}
