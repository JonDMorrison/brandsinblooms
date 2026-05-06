import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  ExternalLink,
  Monitor,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { JoyChip } from "@/components/joy/JoyChip";
import { SUPABASE_URL } from "@/integrations/supabase/config";
import { normalizeFormSettings } from "@/lib/forms/designSettings";
import {
  DEFAULT_FORM_COMPLIANCE,
  type FormCompliance,
  type FormField,
  type FormSettings,
} from "@/types/formBuilder";
import { FormPreviewRenderer } from "./FormPreviewRenderer";

type PreviewDevice = "desktop" | "tablet" | "phone";
interface FormPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FormField[];
  settings: FormSettings | null;
  compliance: FormCompliance | null;
  formName: string;
  uploadEmbedKey?: string;
  isPublished?: boolean;
  publicUrl?: string;
}

const DEVICE_WIDTHS: Record<PreviewDevice, number> = {
  desktop: 1180,
  tablet: 820,
  phone: 420,
};

const DEVICE_OPTIONS: Array<{
  value: PreviewDevice;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "desktop", label: "Desktop", icon: <Monitor size={16} /> },
  { value: "tablet", label: "Tablet", icon: <Tablet size={16} /> },
  { value: "phone", label: "Phone", icon: <Smartphone size={16} /> },
];

function buildPreviewSubmissionData(
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

function getPreviewSubmissionErrorMessage({
  status,
  payload,
  retryAfter,
}: {
  status: number;
  payload: unknown;
  retryAfter: string | null;
}) {
  const errorPayload =
    payload && typeof payload === "object"
      ? (payload as { error?: string; details?: string[] })
      : {};

  if (status === 429) {
    const seconds = Number.parseInt(retryAfter ?? "", 10);
    const waitMessage =
      Number.isFinite(seconds) && seconds > 0
        ? ` Please wait about ${seconds} seconds and try again.`
        : " Please wait a moment and try again.";

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
    return "Publish the form before sending a test submission.";
  }

  if (status >= 500) {
    return "Something went wrong. Please try again.";
  }

  return errorPayload.error || "Unable to send the test submission.";
}

function getPreviewFrameSx(device: PreviewDevice) {
  if (device === "desktop") {
    return {
      width: "100%",
    } as const;
  }

  return {
    width: "100%",
    maxWidth: DEVICE_WIDTHS[device],
    marginInline: "auto",
    borderRadius: device === "phone" ? "36px" : "28px",
    padding: device === "phone" ? 1.25 : 1.5,
    backgroundColor: "#0f172a",
    border: "1px solid rgba(15, 23, 42, 0.14)",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.16)",
  } as const;
}

export function FormPreviewDialog({
  open,
  onOpenChange,
  fields,
  settings,
  compliance,
  formName,
  uploadEmbedKey,
  isPublished = false,
  publicUrl,
}: FormPreviewDialogProps) {
  const [device, setDevice] = React.useState<PreviewDevice>("desktop");
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [isTestSubmissionsEnabled, setIsTestSubmissionsEnabled] =
    React.useState(false);
  const [resetSignal, setResetSignal] = React.useState(0);

  const resolvedSettings = React.useMemo(
    () => normalizeFormSettings(settings),
    [settings],
  );
  const resolvedCompliance = React.useMemo(
    () => ({ ...DEFAULT_FORM_COMPLIANCE, ...compliance }),
    [compliance],
  );
  const previewWidth = DEVICE_WIDTHS[device];
  const warnings = React.useMemo(() => {
    const nextWarnings: string[] = [];

    if (fields.length === 0) {
      nextWarnings.push(
        "Add at least one field to preview the submission flow.",
      );
    }

    if (!fields.some((field) => field.type === "email")) {
      nextWarnings.push(
        "No email field detected. Most capture forms should collect one.",
      );
    }

    return nextWarnings;
  }, [fields]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setIsPreviewLoading(true);
    setIsTestSubmissionsEnabled(false);

    const timeoutId = window.setTimeout(() => {
      setIsPreviewLoading(false);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [open, fields, settings, compliance]);

  const handlePreviewSubmit = React.useCallback(
    async (formData: Record<string, unknown>) => {
      if (!isTestSubmissionsEnabled) {
        toast.info("Preview mode — submission not sent");
        return { preventSuccess: true };
      }

      if (!isPublished || !uploadEmbedKey) {
        toast.warning("Publish the form before sending a test submission.");
        return { preventSuccess: true };
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: uploadEmbedKey,
          data: buildPreviewSubmissionData(fields, formData),
          meta: {
            is_test: true,
            preview_mode: true,
            page_url: window.location.href,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent,
          },
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getPreviewSubmissionErrorMessage({
            status: response.status,
            payload: result,
            retryAfter: response.headers.get("Retry-After"),
          }),
        );
      }

      toast.success("Test submission sent");
      return undefined;
    },
    [fields, isPublished, isTestSubmissionsEnabled, uploadEmbedKey],
  );

  return (
    <Modal open={open} onClose={() => onOpenChange(false)}>
      <ModalDialog
        sx={{
          width: "min(calc(100vw - 1.5rem), 1280px)",
          maxWidth: device === "desktop" ? 1240 : 1040,
          borderRadius: "var(--joy-radius-lg)",
          p: 0,
          overflow: "hidden",
          bgcolor: "background.surface",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", lg: "center" }}
          sx={{
            px: 2.25,
            py: 1.75,
            borderBottom: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Stack spacing={0.35}>
            <Typography level="title-md">
              {formName || "Form preview"}
            </Typography>
            <Typography level="body-sm" color="neutral">
              Review the hosted runtime across desktop, tablet, and mobile
              widths before publishing.
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
          >
            <JoyChip size="sm" variant="soft" color="neutral">
              {fields.length} fields
            </JoyChip>

            <Sheet
              variant="outlined"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                p: 0.375,
                borderRadius: 999,
                bgcolor: "background.level1",
                borderColor: "neutral.200",
              }}
            >
              {DEVICE_OPTIONS.map((option) => (
                <IconButton
                  key={option.value}
                  size="sm"
                  variant={device === option.value ? "soft" : "plain"}
                  color={device === option.value ? "primary" : "neutral"}
                  aria-label={option.label}
                  onClick={() => setDevice(option.value)}
                >
                  {option.icon}
                </IconButton>
              ))}
            </Sheet>

            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<ExternalLink size={15} />}
              disabled={!isPublished || !publicUrl}
              onClick={() => {
                if (publicUrl) {
                  window.open(publicUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              Open public URL
            </Button>

            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              aria-label="Close preview"
              onClick={() => onOpenChange(false)}
            >
              <X size={16} />
            </IconButton>
          </Stack>
        </Stack>

        {warnings.length > 0 ? (
          <Sheet
            variant="soft"
            color="warning"
            sx={{ borderRadius: 0, px: 2.25, py: 1.5 }}
          >
            <Stack spacing={1}>
              {warnings.map((warning) => (
                <Stack
                  key={warning}
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                >
                  <AlertTriangle size={16} />
                  <Typography level="body-sm">{warning}</Typography>
                </Stack>
              ))}
            </Stack>
          </Sheet>
        ) : null}

        <Box sx={{ px: { xs: 1.5, md: 2.5 }, py: { xs: 2, md: 2.5 } }}>
          <Sheet
            variant="plain"
            sx={{
              minHeight: 560,
              px: { xs: 1.25, md: 2.5 },
              py: { xs: 2, md: 3 },
              overflow: "auto",
              borderRadius: "28px",
              border: "1px solid",
              borderColor: "neutral.200",
              bgcolor: "background.level1",
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.06) 1px, transparent 0), linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.01))",
              backgroundSize: "18px 18px, 100% 100%",
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: DEVICE_WIDTHS[device],
                marginInline: "auto",
                transition: "max-width 180ms ease",
              }}
            >
              <Box sx={getPreviewFrameSx(device)}>
                <FormPreviewRenderer
                  key={resetSignal}
                  fields={fields}
                  settings={resolvedSettings}
                  compliance={resolvedCompliance}
                  uploadEmbedKey={uploadEmbedKey}
                  isLoading={isPreviewLoading}
                  onSubmit={handlePreviewSubmit}
                  resetSignal={resetSignal}
                />
              </Box>
            </Box>
          </Sheet>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          sx={{
            px: 2.25,
            py: 1.75,
            borderTop: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Stack spacing={0.35}>
            <Typography level="body-xs" color="neutral">
              This is a preview — submissions are not saved.
            </Typography>
            {!isPublished ? (
              <Typography level="body-xs" color="neutral">
                Publish the form to route test submissions through the hosted
                endpoint.
              </Typography>
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="body-sm">Enable test submissions</Typography>
            <Switch
              checked={isTestSubmissionsEnabled}
              onChange={(event) =>
                setIsTestSubmissionsEnabled(event.target.checked)
              }
            />
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
