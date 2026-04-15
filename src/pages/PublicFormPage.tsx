import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { FormPreviewRenderer } from "@/components/forms/preview/FormPreviewRenderer";
import { Button } from "@/components/ui-legacy/button";
import { SUPABASE_URL } from "@/integrations/supabase/config";
import {
  FormField,
  FormSettings,
  FormCompliance,
  DEFAULT_FORM_SETTINGS,
  DEFAULT_FORM_COMPLIANCE,
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

export default function PublicFormPage() {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [form, setForm] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<PublicFormLoadError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!embedKey) {
      setLoadError({
        title: "This form isn't available",
        message: "The link is incomplete or no longer valid.",
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

        const data = await response.json();
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

    fetchForm();
  }, [embedKey]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!form || !embedKey) return;

    const fieldIds = new Set(form.fields_json.map((field) => field.id));
    const enrichedData: Record<string, unknown> = {};

    // Normalize all field values to canonical submission keys.
    form.fields_json.forEach((field) => {
      const fieldKey = field.mapping_key || field.id;

      if (field.type === "hidden" && field.default_value) {
        enrichedData[fieldKey] = field.default_value;
        return;
      }

      if (
        field.type === "email_consent" &&
        formData.__email_consent !== undefined
      ) {
        enrichedData[fieldKey] = formData.__email_consent;
        return;
      }

      if (
        field.type === "sms_consent" &&
        formData.__sms_consent !== undefined
      ) {
        enrichedData[fieldKey] = formData.__sms_consent;
        return;
      }

      if (formData[field.id] !== undefined) {
        enrichedData[fieldKey] = formData[field.id];
      }
    });

    Object.entries(formData).forEach(([key, value]) => {
      if (
        key === "__email_consent" ||
        key === "__sms_consent" ||
        fieldIds.has(key)
      ) {
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
        error instanceof Error ? error.message : "Failed to submit form",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicPageShell>
        <div className="mx-auto w-full max-w-md rounded-[28px] border border-border/60 bg-card/90 p-8 text-center shadow-[0_32px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-foreground">
            Loading form
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Fetching the latest published version and preparing the secure
            submission flow.
          </p>
        </div>
      </PublicPageShell>
    );
  }

  if (loadError && !form) {
    return (
      <PublicPageShell>
        <div className="mx-auto w-full max-w-lg rounded-[28px] border border-border/60 bg-card/95 p-8 text-center shadow-[0_32px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-foreground">
            {loadError.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {loadError.message}
          </p>

          {loadError.retryable ? (
            <div className="mt-6 flex justify-center">
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      </PublicPageShell>
    );
  }

  if (!form) return null;

  const formSettings = form.settings_json || DEFAULT_FORM_SETTINGS;
  const formCompliance = form.compliance_json || DEFAULT_FORM_COMPLIANCE;

  return (
    <PublicPageShell>
      <div className="w-full max-w-6xl">
        <FormPreviewRenderer
          fields={form.fields_json || []}
          settings={formSettings}
          compliance={formCompliance}
          mode="embed"
          onSubmit={handleSubmit}
          isSubmitting={submitting}
          uploadEmbedKey={embedKey}
        />
      </div>
    </PublicPageShell>
  );
}

function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.9))] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function getPublicFormLoadError(
  status: number | null,
  message?: string,
): PublicFormLoadError {
  if (status === 404) {
    return {
      title: "This form isn't available",
      message:
        "The link is invalid or the form is no longer published. If you expected this form to be live, contact the team that shared it.",
      retryable: false,
    };
  }

  if (status !== null && status >= 500) {
    return {
      title: "We couldn't load this form",
      message:
        "The form service returned an unexpected error. Refresh and try again in a moment.",
      retryable: true,
    };
  }

  if (status !== null) {
    return {
      title: "We couldn't load this form",
      message: message || "Refresh and try again in a moment.",
      retryable: true,
    };
  }

  return {
    title: "Connection problem",
    message:
      "We couldn't reach the form service. Check your connection and try again.",
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
    return "We couldn't submit the form right now. Please try again in a moment.";
  }

  return errorPayload.error || "Submission failed. Please try again.";
}
