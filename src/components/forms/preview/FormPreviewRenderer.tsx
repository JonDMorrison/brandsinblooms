import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  EyeOff,
  FileUp,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import LinearProgress from "@mui/joy/LinearProgress";
import {
  getFontFamilyCss,
  getFormWidthValue,
  getSpacingValue,
  normalizeFormSettings,
} from "@/lib/forms/designSettings";
import {
  filterVisibleSubmissionData,
  getNormalizedFormSteps,
  getVisibleRenderableFields,
  groupFieldsByStep,
  isMultiStepEnabled,
  normalizeFieldStepIndex,
} from "@/lib/forms/formFlow";
import {
  getFieldCharacterCount,
  getFieldMaxLength,
  getResolvedFieldValue,
  validateFieldValue,
} from "@/lib/forms/fieldValidation";
import {
  formatFileSize,
  getFileFieldAllowedMimeTypes,
  getFileFieldMaxFileSizeMb,
  getFileFieldMaxFiles,
  getFileUploadAcceptAttribute,
  getFormFileUploadReferences,
  matchesAcceptedFileType,
  simulateFormFileUpload,
  uploadFileToFormStorage,
} from "@/lib/forms/fileUploads";
import {
  DEFAULT_FORM_COMPLIANCE,
  FormCompliance,
  FormField,
  FormFileUploadReference,
  FormSettings,
  FormStep,
} from "@/types/formBuilder";

interface FormPreviewRendererProps {
  fields: FormField[];
  settings: FormSettings;
  compliance: FormCompliance;
  mode?: "preview" | "embed";
  onSubmit?: (data: Record<string, unknown>) => Promise<void> | void;
  isSubmitting?: boolean;
  uploadEmbedKey?: string;
  changedIds?: Set<string>;
  resetSignal?: number;
}

interface FileUploadItem {
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  progress: number;
  status: "uploading" | "uploaded" | "error";
  error?: string;
  reference?: FormFileUploadReference;
}

interface ThemeTokens {
  primary: string;
  secondary: string;
  text: string;
  mutedText: string;
  quietText: string;
  background: string;
  fieldSurface: string;
  filledFieldSurface: string;
  subtleBorder: string;
  strongBorder: string;
  focusRing: string;
  error: string;
  errorSurface: string;
  successSurface: string;
  successBorder: string;
  successText: string;
  consentSurface: string;
  consentBorder: string;
  shadow: string;
  fontFamily: string;
  spacing: string;
  radius: string;
  buttonTextOnPrimary: string;
  formMaxWidth: string;
}

type FieldControlElement = HTMLInputElement | HTMLSelectElement;

const RESPONSIVE_TWO_COLUMN_MIN_WIDTH = 640;
const CONTROL_RADIUS = 8;
const CARD_RADIUS = 12;

function getHighlightStyle(tokens: ThemeTokens): React.CSSProperties {
  return {
    borderRadius: CARD_RADIUS,
    boxShadow: `0 0 0 2px ${toRgba(tokens.primary, 0.35)}`,
  };
}

function getVisuallyHiddenStyle(): React.CSSProperties {
  return {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  };
}

export function FormPreviewRenderer({
  fields,
  settings,
  compliance,
  mode = "preview",
  onSubmit,
  isSubmitting = false,
  uploadEmbedKey,
  changedIds = new Set(),
  resetSignal = 0,
}: FormPreviewRendererProps) {
  const normalizedSettings = useMemo(
    () => normalizeFormSettings(settings),
    [settings],
  );
  const resolvedCompliance = compliance ?? DEFAULT_FORM_COMPLIANCE;
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isTransitioningToSuccess, setIsTransitioningToSuccess] =
    useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [fileUploads, setFileUploads] = useState<
    Record<string, FileUploadItem[]>
  >({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Record<string, FieldControlElement | null>>({});
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTransitionTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const uploadCancelersRef = useRef<Record<string, () => void>>({});

  const theme = normalizedSettings.theme;
  const steps = useMemo(
    () => getNormalizedFormSteps(fields, normalizedSettings),
    [fields, normalizedSettings],
  );
  const multiStepEnabled = isMultiStepEnabled(normalizedSettings);
  const hiddenFieldCount = useMemo(
    () => fields.filter((field) => field.type === "hidden").length,
    [fields],
  );
  const renderableFields = useMemo(
    () => getVisibleRenderableFields(fields, formData),
    [fields, formData],
  );
  const resolvedVisibleFields = useMemo(
    () =>
      renderableFields.map((field) => {
        if (field.type === "email_consent") {
          return {
            ...field,
            required:
              field.required || resolvedCompliance.email_consent_required,
          } satisfies FormField;
        }

        if (field.type === "sms_consent") {
          return {
            ...field,
            required: field.required || resolvedCompliance.sms_consent_required,
          } satisfies FormField;
        }

        return field;
      }),
    [renderableFields, resolvedCompliance],
  );
  const stepGroups = useMemo(
    () => groupFieldsByStep(resolvedVisibleFields, steps),
    [resolvedVisibleFields, steps],
  );
  const activeStepPosition = Math.max(
    0,
    stepGroups.findIndex((group) => group.step.index === currentStepIndex),
  );
  const activeStepGroup = stepGroups[activeStepPosition] ?? null;
  const currentStepFields = multiStepEnabled
    ? (activeStepGroup?.fields ?? [])
    : resolvedVisibleFields;
  const hasRequiredFields = resolvedVisibleFields.some(
    (field) => field.required,
  );
  const hasActiveUploads = useMemo(
    () =>
      Object.values(fileUploads).some((items) =>
        items.some((item) => item.status === "uploading"),
      ),
    [fileUploads],
  );
  const isFirstStep = activeStepPosition === 0;
  const isLastStep = activeStepPosition >= stepGroups.length - 1;

  const tokens = useMemo<ThemeTokens>(() => {
    const background = theme.background_color ?? "#FFFFFF";
    const text = theme.text_color ?? "#1F2937";
    const primary = theme.primary_color ?? "#22C55E";
    const secondary = theme.secondary_color ?? "#1E40AF";
    const isDarkBackground = isDarkColor(background);

    return {
      primary,
      secondary,
      text,
      mutedText: toRgba(text, 0.72),
      quietText: toRgba(text, 0.58),
      background,
      fieldSurface: isDarkBackground
        ? mixHex(background, "#FFFFFF", 0.18)
        : "#FFFFFF",
      filledFieldSurface: isDarkBackground
        ? mixHex(background, "#FFFFFF", 0.24)
        : mixHex(background, text, 0.04),
      subtleBorder: toRgba(text, 0.12),
      strongBorder: toRgba(text, 0.18),
      focusRing: toRgba(primary, 0.18),
      error: "#dc2626",
      errorSurface: "rgba(220, 38, 38, 0.08)",
      successSurface: isDarkBackground
        ? mixHex(background, primary, 0.24)
        : mixHex(background, primary, 0.08),
      successBorder: toRgba(primary, 0.24),
      successText: isDarkBackground ? "#FFFFFF" : text,
      consentSurface: isDarkBackground
        ? mixHex(background, secondary, 0.24)
        : mixHex(background, secondary, 0.07),
      consentBorder: toRgba(secondary, 0.18),
      shadow: `0 18px 48px -32px ${toRgba(text, 0.38)}`,
      fontFamily: getFontFamilyCss(theme.font_family),
      spacing: getSpacingValue(theme.spacing),
      radius: theme.border_radius ?? "8px",
      buttonTextOnPrimary: getReadableTextColor(primary, "#FFFFFF", text),
      formMaxWidth: getFormWidthValue(normalizedSettings.form_width),
    };
  }, [normalizedSettings.form_width, theme]);

  const shouldUseSingleColumn =
    normalizedSettings.columns !== 2 ||
    (containerWidth !== null &&
      containerWidth < RESPONSIVE_TWO_COLUMN_MIN_WIDTH);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (typeof nextWidth === "number") {
        setContainerWidth(nextWidth);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const activeKeys = new Set(resolvedVisibleFields.map((field) => field.id));

    setFormData((current) => {
      const nextEntries = Object.entries(current).filter(([key]) =>
        activeKeys.has(key),
      );

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });

    setErrors((current) => {
      const nextEntries = Object.entries(current).filter(([key]) =>
        activeKeys.has(key),
      );

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });

    setTouchedFields((current) => {
      const nextEntries = Object.entries(current).filter(([key]) =>
        activeKeys.has(key),
      );

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });

    Object.keys(fieldRefs.current).forEach((key) => {
      if (!activeKeys.has(key)) {
        delete fieldRefs.current[key];
      }
    });

    setFileUploads((current) => {
      const nextEntries = Object.entries(current).filter(([fieldId]) =>
        activeKeys.has(fieldId),
      );

      Object.entries(current).forEach(([fieldId, items]) => {
        if (activeKeys.has(fieldId)) {
          return;
        }

        items.forEach((item) => {
          if (item.status === "uploading") {
            uploadCancelersRef.current[item.uploadId]?.();
            delete uploadCancelersRef.current[item.uploadId];
          }
        });
      });

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });
  }, [resolvedVisibleFields]);

  useEffect(() => {
    const firstStepIndex = stepGroups[0]?.step.index ?? 0;

    if (!stepGroups.some((group) => group.step.index === currentStepIndex)) {
      setCurrentStepIndex(firstStepIndex);
    }
  }, [currentStepIndex, stepGroups]);

  useEffect(() => {
    setIsSubmitted(false);
    setIsTransitioningToSuccess(false);
    Object.values(uploadCancelersRef.current).forEach((cancelUpload) => {
      cancelUpload();
    });
    uploadCancelersRef.current = {};
    sessionIdRef.current = crypto.randomUUID();
    setFormData({});
    setErrors({});
    setFileUploads({});
    setTouchedFields({});
    setCurrentStepIndex(steps[0]?.index ?? 0);
    setSubmitError(null);
    clearRedirectTimer(redirectTimerRef);
    clearRedirectTimer(successTransitionTimerRef);
  }, [resetSignal, steps]);

  useEffect(() => {
    if (
      !isSubmitted ||
      mode !== "embed" ||
      !normalizedSettings.success_redirect_url
    ) {
      return;
    }

    clearRedirectTimer(redirectTimerRef);
    redirectTimerRef.current = setTimeout(() => {
      window.location.assign(normalizedSettings.success_redirect_url!);
    }, 2000);

    return () => clearRedirectTimer(redirectTimerRef);
  }, [isSubmitted, mode, normalizedSettings.success_redirect_url]);

  useEffect(() => () => clearRedirectTimer(redirectTimerRef), []);
  useEffect(() => () => clearRedirectTimer(successTransitionTimerRef), []);

  useEffect(
    () => () => {
      Object.values(uploadCancelersRef.current).forEach((cancelUpload) => {
        cancelUpload();
      });
    },
    [],
  );

  const setFieldError = (fieldId: string, message: string | null) => {
    setErrors((current) => {
      const next = { ...current };
      if (message) {
        next[fieldId] = message;
      } else {
        delete next[fieldId];
      }
      return next;
    });
  };

  const registerFieldRef = (
    fieldId: string,
    element: FieldControlElement | null,
  ) => {
    fieldRefs.current[fieldId] = element;
  };

  const focusField = (fieldId: string) => {
    const element = fieldRefs.current[fieldId];
    if (!element) {
      return;
    }

    element.focus();
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleFieldChange = (field: FormField, value: unknown) => {
    setFormData((current) => ({ ...current, [field.id]: value }));
    setSubmitError(null);

    if (touchedFields[field.id]) {
      setFieldError(field.id, validateFieldValue(field, value));
      return;
    }

    if (errors[field.id]) {
      setFieldError(field.id, null);
    }
  };

  const handleFieldBlur = (field: FormField) => {
    setTouchedFields((current) => ({ ...current, [field.id]: true }));
    setFieldError(field.id, validateFieldValue(field, formData[field.id]));
  };

  const setFileUploadItems = (
    fieldId: string,
    updater: (current: FileUploadItem[]) => FileUploadItem[],
  ) => {
    setFileUploads((current) => {
      const nextItems = updater(current[fieldId] || []);

      if (nextItems.length === 0) {
        const next = { ...current };
        delete next[fieldId];
        return next;
      }

      return {
        ...current,
        [fieldId]: nextItems,
      };
    });
  };

  const syncFileFieldValue = (
    field: FormField,
    updater: (
      currentReferences: FormFileUploadReference[],
    ) => FormFileUploadReference[],
  ) => {
    setFormData((current) => {
      const nextReferences = updater(
        getFormFileUploadReferences(current[field.id]),
      );
      return {
        ...current,
        [field.id]: nextReferences,
      };
    });

    if (touchedFields[field.id] || errors[field.id]) {
      window.requestAnimationFrame(() => {
        setFieldError(
          field.id,
          validateFieldValue(
            field,
            updater(getFormFileUploadReferences(formData[field.id])),
          ),
        );
      });
    }
  };

  const handleFileSelection = (field: FormField, fileList: FileList | null) => {
    const selectedFiles = Array.from(fileList || []);
    if (selectedFiles.length === 0) {
      return;
    }

    const allowedMimeTypes = getFileFieldAllowedMimeTypes(field);
    const maxFiles = getFileFieldMaxFiles(field);
    const maxFileSizeMb = getFileFieldMaxFileSizeMb(field);
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
    const currentUploadCount = (fileUploads[field.id] || []).filter(
      (item) => item.status === "uploading" || item.status === "uploaded",
    ).length;

    if (currentUploadCount + selectedFiles.length > maxFiles) {
      setFieldError(
        field.id,
        `You can upload up to ${maxFiles} file${maxFiles === 1 ? "" : "s"}`,
      );
      return;
    }

    for (const file of selectedFiles) {
      if (file.size > maxFileSizeBytes) {
        setFieldError(
          field.id,
          `${file.name} exceeds the ${maxFileSizeMb} MB limit`,
        );
        return;
      }

      if (!matchesAcceptedFileType(file, allowedMimeTypes)) {
        setFieldError(field.id, `${file.name} is not an allowed file type`);
        return;
      }
    }

    setFieldError(field.id, null);
    setSubmitError(null);

    selectedFiles.forEach((file) => {
      const uploadRequest =
        mode === "embed" && uploadEmbedKey
          ? uploadFileToFormStorage({
              embedKey: uploadEmbedKey,
              fieldId: field.id,
              file,
              sessionId: sessionIdRef.current,
              onProgress: (progress) => {
                setFileUploadItems(field.id, (current) =>
                  current.map((item) =>
                    item.uploadId === uploadRequest.uploadId
                      ? { ...item, progress }
                      : item,
                  ),
                );
              },
            })
          : simulateFormFileUpload({
              fieldId: field.id,
              file,
              sessionId: sessionIdRef.current,
              onProgress: (progress) => {
                setFileUploadItems(field.id, (current) =>
                  current.map((item) =>
                    item.uploadId === uploadRequest.uploadId
                      ? { ...item, progress }
                      : item,
                  ),
                );
              },
            });

      uploadCancelersRef.current[uploadRequest.uploadId] = uploadRequest.cancel;

      setFileUploadItems(field.id, (current) => [
        ...current,
        {
          uploadId: uploadRequest.uploadId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          progress: 0,
          status: "uploading",
        },
      ]);

      uploadRequest.promise
        .then((reference) => {
          delete uploadCancelersRef.current[uploadRequest.uploadId];

          setFileUploadItems(field.id, (current) =>
            current.map((item) =>
              item.uploadId === uploadRequest.uploadId
                ? {
                    ...item,
                    progress: 100,
                    status: "uploaded",
                    reference,
                  }
                : item,
            ),
          );

          syncFileFieldValue(field, (currentReferences) => [
            ...currentReferences.filter(
              (item) => item.upload_id !== reference.upload_id,
            ),
            reference,
          ]);
        })
        .catch((error) => {
          delete uploadCancelersRef.current[uploadRequest.uploadId];

          if (error instanceof Error && error.message === "Upload canceled") {
            setFileUploadItems(field.id, (current) =>
              current.filter(
                (item) => item.uploadId !== uploadRequest.uploadId,
              ),
            );
            return;
          }

          setFileUploadItems(field.id, (current) =>
            current.map((item) =>
              item.uploadId === uploadRequest.uploadId
                ? {
                    ...item,
                    status: "error",
                    error:
                      error instanceof Error ? error.message : "Upload failed",
                  }
                : item,
            ),
          );

          setFieldError(
            field.id,
            error instanceof Error ? error.message : "Upload failed",
          );
        });
    });
  };

  const handleRemoveFile = (field: FormField, uploadId: string) => {
    uploadCancelersRef.current[uploadId]?.();
    delete uploadCancelersRef.current[uploadId];

    setFileUploadItems(field.id, (current) =>
      current.filter((item) => item.uploadId !== uploadId),
    );

    syncFileFieldValue(field, (currentReferences) =>
      currentReferences.filter((item) => item.upload_id !== uploadId),
    );
  };

  const getSubmissionData = () => {
    const visibleSubmissionData = filterVisibleSubmissionData(fields, formData);
    const nextData: Record<string, unknown> = {};

    resolvedVisibleFields.forEach((field) => {
      nextData[field.id] = getResolvedFieldValue(
        field,
        visibleSubmissionData[field.id],
      );
    });

    return nextData;
  };

  const validateFields = (targetFields: FormField[]) => {
    const nextErrors: Record<string, string> = {};

    targetFields.forEach((field) => {
      const nextError = validateFieldValue(field, formData[field.id]);
      if (nextError) {
        nextErrors[field.id] = nextError;
      }
    });

    setTouchedFields((current) => {
      const nextTouchedFields = { ...current };
      targetFields.forEach((field) => {
        nextTouchedFields[field.id] = true;
      });
      return nextTouchedFields;
    });

    setErrors((current) => {
      const next = { ...current };
      targetFields.forEach((field) => {
        if (nextErrors[field.id]) {
          next[field.id] = nextErrors[field.id];
        } else {
          delete next[field.id];
        }
      });
      return next;
    });

    const firstInvalidField = targetFields.find(
      (field) => nextErrors[field.id],
    );

    return {
      valid: Object.keys(nextErrors).length === 0,
      firstInvalidField,
    };
  };

  const focusInvalidField = (field: FormField) => {
    const stepIndex = normalizeFieldStepIndex(field);

    if (multiStepEnabled && stepIndex !== currentStepIndex) {
      setCurrentStepIndex(stepIndex);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => focusField(field.id));
      });
      return;
    }

    window.requestAnimationFrame(() => focusField(field.id));
  };

  const handleAdvanceStep = () => {
    if (hasActiveUploads) {
      setSubmitError("Wait for all uploads to finish before continuing.");
      return;
    }

    const validation = validateFields(currentStepFields);

    if (!validation.valid && validation.firstInvalidField) {
      focusInvalidField(validation.firstInvalidField);
      return;
    }

    const nextStep = stepGroups[activeStepPosition + 1];

    if (nextStep) {
      setCurrentStepIndex(nextStep.step.index);
      setSubmitError(null);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitting || hasActiveUploads) {
      if (hasActiveUploads) {
        setSubmitError("Wait for all uploads to finish before submitting.");
      }
      return;
    }

    if (multiStepEnabled && !isLastStep) {
      handleAdvanceStep();
      return;
    }

    void (async () => {
      setSubmitError(null);

      const validation = validateFields(resolvedVisibleFields);

      if (!validation.valid) {
        if (validation.firstInvalidField) {
          focusInvalidField(validation.firstInvalidField);
        }
        return;
      }

      try {
        if (mode === "embed" && onSubmit) {
          await onSubmit(getSubmissionData());
        }

        clearRedirectTimer(successTransitionTimerRef);
        setIsTransitioningToSuccess(true);
        successTransitionTimerRef.current = setTimeout(() => {
          setIsSubmitted(true);
          setIsTransitioningToSuccess(false);
        }, 220);
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Submission failed. Please try again.",
        );
      }
    })();
  };

  const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: `min(${tokens.formMaxWidth}, 42rem)`,
    margin: "0 auto",
    backgroundColor: tokens.background,
    color: tokens.text,
    fontFamily: tokens.fontFamily,
    border: `1px solid ${tokens.subtleBorder}`,
    borderRadius: `${CARD_RADIUS}px`,
  };
  const containerPadding =
    containerWidth !== null && containerWidth >= RESPONSIVE_TWO_COLUMN_MIN_WIDTH
      ? 32
      : 20;

  if (isSubmitted) {
    return (
      <div
        ref={containerRef}
        style={{
          ...containerStyle,
          padding: containerPadding,
          boxShadow: tokens.shadow,
          transition: "opacity 300ms ease",
        }}
      >
        <SuccessState
          mode={mode}
          settings={normalizedSettings}
          tokens={tokens}
          onReset={() => {
            setIsSubmitted(false);
            setIsTransitioningToSuccess(false);
            setFormData({});
            setErrors({});
            setTouchedFields({});
            setCurrentStepIndex(steps[0]?.index ?? 0);
            setSubmitError(null);
            clearRedirectTimer(redirectTimerRef);
            clearRedirectTimer(successTransitionTimerRef);
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        ...containerStyle,
        padding: containerPadding,
        boxShadow: tokens.shadow,
        transition: "opacity 300ms ease",
        ...(isTransitioningToSuccess
          ? { pointerEvents: "none", opacity: 0 }
          : { opacity: 1 }),
      }}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isSubmitting || hasActiveUploads}
        style={{ display: "grid", gap: "1.5rem" }}
      >
        {(normalizedSettings.form_headline ||
          normalizedSettings.form_subheadline) && (
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              textAlign: "center",
              transition: "box-shadow 300ms ease",
              ...(changedIds.has("__headline")
                ? getHighlightStyle(tokens)
                : null),
            }}
          >
            {normalizedSettings.form_headline && (
              <h2
                style={{
                  color: tokens.text,
                  fontFamily: tokens.fontFamily,
                  fontSize: "clamp(1.75rem, 2vw, 2.15rem)",
                  fontWeight: 700,
                  lineHeight: 1.15,
                  margin: 0,
                }}
              >
                {normalizedSettings.form_headline}
              </h2>
            )}

            {normalizedSettings.form_subheadline && (
              <p
                style={{
                  color: tokens.mutedText,
                  fontSize: "1rem",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {normalizedSettings.form_subheadline}
              </p>
            )}
          </div>
        )}

        {(normalizedSettings.form_title ||
          normalizedSettings.form_description) && (
          <div
            style={{
              display: "grid",
              gap: "0.25rem",
              transition: "box-shadow 300ms ease",
              ...(changedIds.has("__settings")
                ? getHighlightStyle(tokens)
                : null),
            }}
          >
            {normalizedSettings.form_title && (
              <h3
                style={{
                  color: tokens.text,
                  fontFamily: tokens.fontFamily,
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {normalizedSettings.form_title}
              </h3>
            )}

            {normalizedSettings.form_description && (
              <p
                style={{
                  color: tokens.mutedText,
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {normalizedSettings.form_description}
              </p>
            )}
          </div>
        )}

        {hasRequiredFields && (
          <p
            style={{
              color: tokens.quietText,
              fontSize: "0.75rem",
              margin: 0,
            }}
          >
            Fields marked with <span style={{ color: tokens.error }}>*</span>{" "}
            are required.
          </p>
        )}

        {multiStepEnabled && activeStepGroup && (
          <div style={{ display: "grid", gap: "1.25rem" }}>
            <StepProgress
              steps={stepGroups.map((group) => group.step)}
              activeIndex={activeStepPosition}
              tokens={tokens}
              onStepSelect={(stepIndex) => {
                const nextStep = stepGroups.find(
                  (group) => group.step.index === stepIndex,
                );

                if (!nextStep || nextStep.step.index === currentStepIndex) {
                  return;
                }

                setCurrentStepIndex(nextStep.step.index);
                setSubmitError(null);
              }}
            />

            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                borderRadius: CONTROL_RADIUS,
                padding: "16px 24px",
                backgroundColor: mixHex(tokens.background, tokens.text, 0.05),
                border: `1px solid ${tokens.subtleBorder}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                }}
              >
                <span style={{ color: tokens.quietText }}>
                  STEP {activeStepPosition + 1} OF {stepGroups.length}
                </span>
              </div>

              <h3
                style={{
                  color: tokens.text,
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  lineHeight: 1.35,
                  margin: 0,
                }}
              >
                {activeStepGroup.step.title || `Step ${activeStepPosition + 1}`}
              </h3>

              {activeStepGroup.step.description && (
                <p
                  style={{
                    color: tokens.mutedText,
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {activeStepGroup.step.description}
                </p>
              )}
            </div>
          </div>
        )}

        {currentStepFields.length > 0 ? (
          <div
            style={{
              display: "grid",
              rowGap: "1.5rem",
              columnGap: shouldUseSingleColumn ? "0px" : tokens.spacing,
              gridTemplateColumns: shouldUseSingleColumn
                ? "1fr"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            {currentStepFields.map((field) => {
              const isConsentField =
                field.type === "email_consent" || field.type === "sms_consent";

              if (isConsentField) {
                return (
                  <ConsentFieldRenderer
                    key={field.id}
                    field={field}
                    text={
                      field.type === "email_consent"
                        ? resolvedCompliance.email_consent_text ||
                          field.label ||
                          DEFAULT_FORM_COMPLIANCE.email_consent_text
                        : resolvedCompliance.sms_consent_text ||
                          field.label ||
                          DEFAULT_FORM_COMPLIANCE.sms_consent_text
                    }
                    checked={
                      getResolvedFieldValue(field, formData[field.id]) === true
                    }
                    onChange={(checked) => handleFieldChange(field, checked)}
                    onBlur={() => handleFieldBlur(field)}
                    error={errors[field.id]}
                    tokens={tokens}
                    isHighlighted={
                      changedIds.has(field.id) || changedIds.has("__compliance")
                    }
                    isDisabled={isSubmitting}
                    registerFieldRef={registerFieldRef}
                  />
                );
              }

              return (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={getResolvedFieldValue(field, formData[field.id])}
                  onChange={(value) => handleFieldChange(field, value)}
                  onFilesSelected={(files) => handleFileSelection(field, files)}
                  onRemoveUpload={(uploadId) =>
                    handleRemoveFile(field, uploadId)
                  }
                  onBlur={() => handleFieldBlur(field)}
                  error={errors[field.id]}
                  tokens={tokens}
                  inputStyle={theme.input_style ?? "outlined"}
                  isHighlighted={changedIds.has(field.id)}
                  isDisabled={isSubmitting}
                  uploadItems={fileUploads[field.id] || []}
                  registerFieldRef={registerFieldRef}
                />
              );
            })}
          </div>
        ) : (
          <div
            style={{
              borderRadius: CARD_RADIUS,
              border: `1px dashed ${tokens.subtleBorder}`,
              padding: "32px 20px",
              textAlign: "center",
              borderColor: tokens.subtleBorder,
              backgroundColor: mixHex(tokens.background, tokens.text, 0.03),
            }}
          >
            <p
              style={{
                color: tokens.text,
                fontSize: "0.95rem",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Nothing to complete on this step.
            </p>
            <p
              style={{
                color: tokens.mutedText,
                fontSize: "0.92rem",
                lineHeight: 1.6,
                margin: "8px 0 0",
              }}
            >
              The current visibility rules hide every field here right now. You
              can continue to the next step or go back.
            </p>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              borderRadius: CARD_RADIUS,
              padding: "12px 16px",
              backgroundColor: tokens.errorSurface,
              border: `1px solid ${toRgba(tokens.error, 0.18)}`,
              color: tokens.error,
            }}
          >
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>
              {submitError}
            </p>
          </div>
        )}

        {multiStepEnabled ? (
          <div
            style={{
              marginTop: 32,
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: isFirstStep ? "flex-end" : "space-between",
            }}
          >
            {!isFirstStep ? (
              <button
                type="button"
                onClick={() => {
                  const previousStep = stepGroups[activeStepPosition - 1];
                  if (previousStep) {
                    setCurrentStepIndex(previousStep.step.index);
                    setSubmitError(null);
                  }
                }}
                disabled={isSubmitting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  minHeight: 48,
                  padding: "12px 24px",
                  borderRadius: CONTROL_RADIUS,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  transition:
                    "background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease",
                  borderColor: tokens.strongBorder,
                  borderStyle: "solid",
                  borderWidth: 1,
                  color: tokens.quietText,
                  backgroundColor: "transparent",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : null}

            <button
              type={isLastStep ? "submit" : "button"}
              onClick={isLastStep ? undefined : handleAdvanceStep}
              disabled={isSubmitting || hasActiveUploads}
              style={{
                ...getSubmitButtonStyle(tokens, theme.button_style ?? "filled"),
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                width: "100%",
                flex: "1 1 180px",
                fontSize: "0.875rem",
                fontWeight: 500,
                transition:
                  "background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease, opacity 150ms ease",
                cursor:
                  isSubmitting || hasActiveUploads ? "not-allowed" : "pointer",
                opacity: isSubmitting || hasActiveUploads ? 0.7 : 1,
                ...(changedIds.has("__settings")
                  ? getHighlightStyle(tokens)
                  : null),
              }}
            >
              {isSubmitting && isLastStep ? (
                <Loader2 size={16} />
              ) : hasActiveUploads && isLastStep ? (
                <Loader2 size={16} />
              ) : null}
              <span>
                {isLastStep
                  ? isSubmitting
                    ? "Submitting..."
                    : hasActiveUploads
                      ? "Uploading files..."
                      : normalizedSettings.submit_button_text || "Submit"
                  : hasActiveUploads
                    ? "Uploading files..."
                    : "Next Step"}
              </span>
              {!isSubmitting && !hasActiveUploads ? (
                <ArrowRight size={16} />
              ) : null}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting || hasActiveUploads}
            style={{
              ...getSubmitButtonStyle(tokens, theme.button_style ?? "filled"),
              marginTop: 32,
              display: "inline-flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition:
                "background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease, opacity 150ms ease",
              cursor:
                isSubmitting || hasActiveUploads ? "not-allowed" : "pointer",
              opacity: isSubmitting || hasActiveUploads ? 0.7 : 1,
              ...(changedIds.has("__settings")
                ? getHighlightStyle(tokens)
                : null),
            }}
          >
            {isSubmitting || hasActiveUploads ? <Loader2 size={16} /> : null}
            <span>
              {isSubmitting
                ? "Submitting..."
                : hasActiveUploads
                  ? "Uploading files..."
                  : normalizedSettings.submit_button_text || "Submit"}
            </span>
            {!isSubmitting && !hasActiveUploads ? (
              <ArrowRight size={16} />
            ) : null}
          </button>
        )}

        {hasActiveUploads && (
          <p
            style={{
              color: tokens.quietText,
              margin: 0,
              textAlign: "center",
              fontSize: "0.75rem",
            }}
          >
            File uploads must finish before you can continue or submit.
          </p>
        )}

        {normalizedSettings.show_branding && (
          <div
            style={{
              marginTop: 32,
              paddingTop: 16,
              textAlign: "center",
              borderTop: `1px solid ${tokens.subtleBorder}`,
            }}
          >
            <span
              style={{
                color: tokens.quietText,
                fontSize: "0.75rem",
              }}
            >
              Powered by{" "}
              <a
                href="https://bloomsuite.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: tokens.mutedText,
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                BloomSuite
              </a>
            </span>
          </div>
        )}

        {mode === "preview" && hiddenFieldCount > 0 && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: "0.75rem",
                backgroundColor: mixHex(tokens.background, tokens.text, 0.06),
                color: tokens.quietText,
                border: `1px solid ${tokens.subtleBorder}`,
              }}
            >
              <EyeOff size={14} />
              {hiddenFieldCount} hidden{" "}
              {hiddenFieldCount === 1 ? "field" : "fields"}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}

interface StepProgressProps {
  steps: FormStep[];
  activeIndex: number;
  tokens: ThemeTokens;
  onStepSelect: (stepIndex: number) => void;
}

function StepProgress({
  steps,
  activeIndex,
  tokens,
  onStepSelect,
}: StepProgressProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;
        const stepNode = isComplete ? (
          <button
            type="button"
            onClick={() => onStepSelect(step.index)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition:
                "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
              backgroundColor: toRgba(tokens.primary, 0.25),
              color: tokens.primary,
              border: `2px solid ${tokens.primary}`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: toRgba(tokens.primary, 0.25),
                color: tokens.primary,
              }}
            >
              <Check size={14} />
            </span>
            <span>{step.title || `Step ${index + 1}`}</span>
          </button>
        ) : (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: "0.875rem",
              fontWeight: 500,
              backgroundColor: isActive
                ? toRgba(tokens.primary, 0.25)
                : toRgba(tokens.text, 0.08),
              color: isActive ? tokens.primary : tokens.quietText,
              border: isActive
                ? `2px solid ${tokens.primary}`
                : `2px solid ${toRgba(tokens.text, 0.16)}`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: isActive
                  ? toRgba(tokens.primary, 0.25)
                  : toRgba(tokens.text, 0.12),
                color: isActive ? tokens.primary : tokens.quietText,
              }}
            >
              {index + 1}
            </span>
            <span>{step.title || `Step ${index + 1}`}</span>
          </div>
        );

        return (
          <React.Fragment key={`step-progress-${step.index}`}>
            {index > 0 ? (
              <div
                style={{
                  width: 32,
                  height: 1,
                  backgroundColor:
                    index <= activeIndex ? tokens.primary : tokens.subtleBorder,
                }}
              />
            ) : null}
            {stepNode}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface FieldRendererProps {
  field: FormField;
  value: string | boolean | FormFileUploadReference[];
  onChange: (value: unknown) => void;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveUpload: (uploadId: string) => void;
  onBlur: () => void;
  error?: string;
  tokens: ThemeTokens;
  inputStyle: "outlined" | "filled" | "underlined";
  isHighlighted?: boolean;
  isDisabled?: boolean;
  uploadItems: FileUploadItem[];
  registerFieldRef: (
    fieldId: string,
    element: FieldControlElement | null,
  ) => void;
}

function FieldRenderer({
  field,
  value,
  onChange,
  onFilesSelected,
  onRemoveUpload,
  onBlur,
  error,
  tokens,
  inputStyle,
  isHighlighted,
  isDisabled = false,
  uploadItems,
  registerFieldRef,
}: FieldRendererProps) {
  const [isFocused, setIsFocused] = useState(false);
  const maxLength = getFieldMaxLength(field);
  const characterCount = getFieldCharacterCount(value);
  const errorId = error ? `${field.id}-error` : undefined;
  const resolvedPlaceholder = getDefaultFieldPlaceholder(field);

  const sharedStyle = getFieldControlStyle({
    tokens,
    inputStyle,
    hasError: Boolean(error),
    isFocused,
    isDisabled,
  });

  const handleBlur = () => {
    setIsFocused(false);
    onBlur();
  };
  const helpText = field.help_text?.trim();

  if (field.type === "file") {
    return (
      <FileFieldRenderer
        field={field}
        value={Array.isArray(value) ? getFormFileUploadReferences(value) : []}
        error={error}
        tokens={tokens}
        isHighlighted={isHighlighted}
        isDisabled={isDisabled}
        uploadItems={uploadItems}
        onFilesSelected={onFilesSelected}
        onRemoveUpload={onRemoveUpload}
        registerFieldRef={registerFieldRef}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          transition: "box-shadow 150ms ease",
          ...(isHighlighted ? getHighlightStyle(tokens) : null),
        }}
      >
        <label
          htmlFor={field.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            opacity: isDisabled ? 0.76 : 1,
          }}
        >
          <input
            id={field.id}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            ref={(element) => registerFieldRef(field.id, element)}
            disabled={isDisabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            style={{
              marginTop: 2,
              width: 20,
              height: 20,
              borderRadius: CONTROL_RADIUS,
              border: `2px solid ${tokens.strongBorder}`,
              accentColor: tokens.primary,
              boxShadow: isFocused
                ? `0 0 0 4px ${tokens.focusRing}`
                : undefined,
            }}
          />
          <span
            style={{
              color: error ? tokens.error : tokens.text,
              fontSize: "0.875rem",
              fontWeight: 500,
              lineHeight: 1.6,
            }}
          >
            {field.label}
            {field.required && (
              <span style={{ color: tokens.error, marginLeft: 4 }}>*</span>
            )}
          </span>
        </label>

        {error && (
          <div
            id={errorId}
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "flex-start",
              gap: "0.375rem",
              color: tokens.error,
              fontSize: "0.75rem",
            }}
          >
            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {!error && helpText && (
          <div
            style={{
              color: tokens.quietText,
              fontSize: "0.75rem",
              lineHeight: 1.5,
            }}
          >
            {helpText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "0.5rem",
        transition: "box-shadow 150ms ease",
        ...(isHighlighted ? getHighlightStyle(tokens) : null),
      }}
    >
      <label
        htmlFor={field.id}
        style={{
          color: error ? tokens.error : tokens.text,
          fontSize: "0.875rem",
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        {field.label}
        {field.required && (
          <span style={{ color: tokens.error, marginLeft: 4 }}>*</span>
        )}
      </label>

      {field.type === "select" ? (
        <div style={{ position: "relative" }}>
          <select
            id={field.id}
            value={String(value)}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            ref={(element) => registerFieldRef(field.id, element)}
            disabled={isDisabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            style={{
              ...sharedStyle,
              appearance: "none",
              paddingRight: 40,
              cursor: isDisabled ? "not-allowed" : "pointer",
            }}
          >
            <option value="" disabled>
              {field.placeholder || "Select an option"}
            </option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            style={{
              pointerEvents: "none",
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: tokens.quietText,
            }}
          />
        </div>
      ) : (
        <input
          id={field.id}
          type={
            field.type === "email"
              ? "email"
              : field.type === "phone"
                ? "tel"
                : "text"
          }
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          ref={(element) => registerFieldRef(field.id, element)}
          disabled={isDisabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          maxLength={maxLength}
          placeholder={resolvedPlaceholder}
          style={sharedStyle}
        />
      )}

      {typeof maxLength === "number" && (
        <div
          style={{
            textAlign: "right",
            fontSize: "0.75rem",
            color:
              characterCount >= maxLength ? tokens.error : tokens.quietText,
          }}
        >
          {characterCount}/{maxLength}
        </div>
      )}

      {!error && helpText && (
        <div
          style={{
            color: tokens.quietText,
            fontSize: "0.75rem",
            lineHeight: 1.5,
          }}
        >
          {helpText}
        </div>
      )}

      {error && (
        <div
          id={errorId}
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.375rem",
            color: tokens.error,
            fontSize: "0.75rem",
          }}
        >
          <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface FileFieldRendererProps {
  field: FormField;
  value: FormFileUploadReference[];
  error?: string;
  tokens: ThemeTokens;
  isHighlighted?: boolean;
  isDisabled?: boolean;
  uploadItems: FileUploadItem[];
  onFilesSelected: (files: FileList | null) => void;
  onRemoveUpload: (uploadId: string) => void;
  registerFieldRef: (
    fieldId: string,
    element: FieldControlElement | null,
  ) => void;
}

function FileFieldRenderer({
  field,
  value,
  error,
  tokens,
  isHighlighted,
  isDisabled = false,
  uploadItems,
  onFilesSelected,
  onRemoveUpload,
  registerFieldRef,
}: FileFieldRendererProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const allowedMimeTypes = getFileFieldAllowedMimeTypes(field);
  const maxFiles = getFileFieldMaxFiles(field);
  const maxFileSizeMb = getFileFieldMaxFileSizeMb(field);
  const accept = getFileUploadAcceptAttribute(allowedMimeTypes);
  const errorId = error ? `${field.id}-error` : undefined;
  const activeItemCount = uploadItems.filter(
    (item) => item.status === "uploading" || item.status === "uploaded",
  ).length;
  const uploadedCount = uploadItems.filter(
    (item) => item.status === "uploaded",
  ).length;
  const remainingSlots = Math.max(0, maxFiles - activeItemCount);
  const helpText = field.help_text?.trim();

  return (
    <div
      style={{
        display: "grid",
        gap: "0.5rem",
        transition: "box-shadow 150ms ease",
        ...(isHighlighted ? getHighlightStyle(tokens) : null),
      }}
    >
      <label
        htmlFor={field.id}
        style={{
          color: error ? tokens.error : tokens.text,
          fontSize: "0.875rem",
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        {field.label}
        {field.required && (
          <span style={{ color: tokens.error, marginLeft: 4 }}>*</span>
        )}
      </label>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          borderRadius: CONTROL_RADIUS,
          border: `1px dashed ${error ? tokens.error : tokens.strongBorder}`,
          padding: 16,
          backgroundColor: tokens.fieldSurface,
          opacity: isDisabled ? 0.76 : 1,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <p
              style={{
                color: tokens.text,
                fontSize: "0.92rem",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Upload up to {maxFiles} file{maxFiles === 1 ? "" : "s"}
            </p>
            <p
              style={{
                color: tokens.quietText,
                fontSize: "0.82rem",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Max {maxFileSizeMb} MB each
              {allowedMimeTypes.length > 0
                ? ` • ${allowedMimeTypes.join(", ")}`
                : " • Any file type"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isDisabled || remainingSlots === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              minHeight: 40,
              padding: "8px 12px",
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderStyle: "solid",
              fontSize: "0.875rem",
              fontWeight: 600,
              transition:
                "background-color 200ms ease, border-color 200ms ease, color 200ms ease, opacity 200ms ease",
              borderColor: tokens.strongBorder,
              backgroundColor: tokens.background,
              color: tokens.text,
              cursor:
                isDisabled || remainingSlots === 0 ? "not-allowed" : "pointer",
              opacity: isDisabled || remainingSlots === 0 ? 0.6 : 1,
            }}
          >
            <Upload size={16} />
            {activeItemCount === 0 ? "Choose files" : "Add files"}
          </button>
        </div>

        <input
          id={field.id}
          ref={(element) => {
            inputRef.current = element;
            registerFieldRef(field.id, element);
          }}
          type="file"
          multiple={maxFiles > 1}
          accept={accept}
          disabled={isDisabled || remainingSlots === 0}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          style={getVisuallyHiddenStyle()}
          onChange={(event) => {
            onFilesSelected(event.target.files);
            event.currentTarget.value = "";
          }}
        />

        {uploadItems.length > 0 ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {uploadItems.map((item) => {
              const isUploading = item.status === "uploading";
              const isErrored = item.status === "error";

              return (
                <div
                  key={item.uploadId}
                  style={{
                    borderRadius: CARD_RADIUS,
                    borderWidth: 1,
                    borderStyle: "solid",
                    padding: "12px",
                    borderColor: isErrored ? tokens.error : tokens.subtleBorder,
                    backgroundColor: isErrored
                      ? tokens.errorSurface
                      : tokens.background,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                        display: "grid",
                        gap: "0.25rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        {isUploading ? (
                          <Loader2
                            size={16}
                            style={{ color: tokens.quietText }}
                          />
                        ) : isErrored ? (
                          <AlertCircle
                            size={16}
                            style={{ color: tokens.error }}
                          />
                        ) : (
                          <CheckCircle2
                            size={16}
                            style={{ color: tokens.primary }}
                          />
                        )}
                        <p
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: tokens.text,
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            margin: 0,
                          }}
                        >
                          {item.fileName}
                        </p>
                      </div>
                      <p
                        style={{
                          color: tokens.quietText,
                          fontSize: "0.78rem",
                          margin: 0,
                        }}
                      >
                        {formatFileSize(item.fileSize)}
                        {item.status === "uploaded" ? " • Uploaded" : null}
                        {item.status === "error" && item.error
                          ? ` • ${item.error}`
                          : null}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveUpload(item.uploadId)}
                      disabled={isDisabled}
                      style={{
                        display: "inline-flex",
                        width: 32,
                        height: 32,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 999,
                        borderWidth: 1,
                        borderStyle: "solid",
                        transition:
                          "background-color 200ms ease, border-color 200ms ease, color 200ms ease, opacity 200ms ease",
                        borderColor: tokens.subtleBorder,
                        backgroundColor: tokens.fieldSurface,
                        color: tokens.text,
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.6 : 1,
                      }}
                      aria-label={
                        item.status === "uploading"
                          ? "Cancel upload"
                          : "Remove file"
                      }
                    >
                      <X size={16} />

                      {!error && helpText ? (
                        <div
                          style={{
                            color: tokens.quietText,
                            fontSize: "0.75rem",
                            lineHeight: 1.5,
                          }}
                        >
                          {helpText}
                        </div>
                      ) : null}
                    </button>
                  </div>

                  {isUploading && (
                    <div
                      style={{ marginTop: 12, display: "grid", gap: "0.5rem" }}
                    >
                      <LinearProgress
                        determinate
                        value={item.progress}
                        sx={{
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: mixHex(
                            tokens.background,
                            tokens.text,
                            0.08,
                          ),
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 999,
                            backgroundColor: tokens.primary,
                          },
                        }}
                      />
                      <p
                        style={{
                          color: tokens.quietText,
                          margin: 0,
                          fontSize: "0.75rem",
                        }}
                      >
                        {item.progress}% complete
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              borderRadius: CARD_RADIUS,
              padding: "16px 12px",
              textAlign: "center",
              backgroundColor: mixHex(tokens.background, tokens.text, 0.03),
              color: tokens.quietText,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <FileUp size={20} />
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>
              No files selected yet.
            </p>
          </div>
        )}

        {value.length > 0 && (
          <p
            style={{ color: tokens.quietText, margin: 0, fontSize: "0.75rem" }}
          >
            {value.length} of {maxFiles} file{maxFiles === 1 ? "" : "s"} ready
          </p>
        )}
      </div>

      {error && (
        <div
          id={errorId}
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.375rem",
            color: tokens.error,
            fontSize: "0.75rem",
          }}
        >
          <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface ConsentFieldRendererProps {
  field: FormField;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onBlur: () => void;
  error?: string;
  tokens: ThemeTokens;
  isHighlighted?: boolean;
  isDisabled?: boolean;
  registerFieldRef: (
    fieldId: string,
    element: FieldControlElement | null,
  ) => void;
}

function ConsentFieldRenderer({
  field,
  text,
  checked,
  onChange,
  onBlur,
  error,
  tokens,
  isHighlighted,
  isDisabled = false,
  registerFieldRef,
}: ConsentFieldRendererProps) {
  const [isFocused, setIsFocused] = useState(false);
  const errorId = error ? `${field.id}-error` : undefined;

  return (
    <div
      style={{
        display: "grid",
        gap: "0.5rem",
        transition: "box-shadow 150ms ease",
        ...(isHighlighted ? getHighlightStyle(tokens) : null),
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          borderRadius: CONTROL_RADIUS,
          borderWidth: 1,
          borderStyle: "solid",
          padding: 16,
          backgroundColor: tokens.consentSurface,
          borderColor: error ? tokens.error : tokens.consentBorder,
          boxShadow: isFocused ? `0 0 0 4px ${tokens.focusRing}` : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShieldCheck size={16} style={{ color: tokens.quietText }} />
          <h3
            style={{
              color: tokens.text,
              fontSize: "0.875rem",
              fontWeight: 500,
              margin: 0,
            }}
          >
            Marketing Permission
          </h3>
        </div>

        <label
          htmlFor={field.id}
          style={{
            display: "flex",
            minHeight: 44,
            alignItems: "flex-start",
            gap: "0.75rem",
            opacity: isDisabled ? 0.76 : 1,
          }}
        >
          <input
            id={field.id}
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              onBlur();
            }}
            ref={(element) => registerFieldRef(field.id, element)}
            disabled={isDisabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            style={{
              marginTop: 2,
              width: 20,
              height: 20,
              borderRadius: CONTROL_RADIUS,
              border: `2px solid ${tokens.strongBorder}`,
              accentColor: tokens.primary,
              boxShadow: isFocused
                ? `0 0 0 4px ${tokens.focusRing}`
                : undefined,
            }}
          />
          <span
            style={{
              color: tokens.text,
              fontSize: "0.875rem",
              lineHeight: 1.7,
            }}
          >
            {text}
            {field.required && (
              <span style={{ color: tokens.error, marginLeft: 4 }}>*</span>
            )}
          </span>
        </label>
      </div>

      {error && (
        <div
          id={errorId}
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.375rem",
            color: tokens.error,
            fontSize: "0.75rem",
          }}
        >
          <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface SuccessStateProps {
  mode: "preview" | "embed";
  settings: FormSettings;
  tokens: ThemeTokens;
  onReset: () => void;
}

function SuccessState({ mode, settings, tokens, onReset }: SuccessStateProps) {
  const isRedirecting = Boolean(settings.success_redirect_url);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gap: "1.25rem",
        textAlign: "center",
        transition: "opacity 300ms ease",
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div
        style={{
          borderRadius: CARD_RADIUS,
          padding: "32px 24px",
          backgroundColor: tokens.successSurface,
          border: `1px solid ${tokens.successBorder}`,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: toRgba(tokens.primary, 0.1),
            color: tokens.primary,
          }}
        >
          <Check size={32} />
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <h3
            style={{
              color: tokens.successText,
              fontSize: "1.125rem",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {isRedirecting
              ? "Redirecting..."
              : settings.success_message || "Form submitted successfully"}
          </h3>

          {isRedirecting ? (
            <p
              style={{
                color: tokens.mutedText,
                fontSize: "0.875rem",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {mode === "preview"
                ? "Preview mode shows the redirect state without navigating away."
                : "You will be redirected in 2 seconds."}
            </p>
          ) : settings.success_redirect_url ? (
            <p
              style={{
                color: tokens.mutedText,
                fontSize: "0.875rem",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Your response was recorded and the follow-up redirect is ready.
            </p>
          ) : null}
        </div>
      </div>

      {mode === "preview" && (
        <button
          type="button"
          onClick={onReset}
          style={{
            color: tokens.mutedText,
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "underline",
            textUnderlineOffset: 4,
            background: "transparent",
            border: 0,
            cursor: "pointer",
          }}
        >
          Reset preview
        </button>
      )}
    </div>
  );
}

function getDefaultFieldPlaceholder(field: FormField): string {
  if (field.placeholder?.trim()) {
    return field.placeholder;
  }

  if (field.type === "email") {
    return "e.g., name@example.com";
  }

  if (field.type === "phone") {
    return "e.g., (555) 123-4567";
  }

  const normalizedLabel = field.label.trim().toLowerCase();

  if (normalizedLabel.includes("name")) {
    return "e.g., John Smith";
  }

  if (normalizedLabel.includes("company")) {
    return "e.g., BloomSuite";
  }

  if (normalizedLabel.includes("website")) {
    return "e.g., https://example.com";
  }

  return "Enter your answer";
}

function getFieldControlStyle({
  tokens,
  inputStyle,
  hasError,
  isFocused,
  isDisabled,
}: {
  tokens: ThemeTokens;
  inputStyle: "outlined" | "filled" | "underlined";
  hasError: boolean;
  isFocused: boolean;
  isDisabled: boolean;
}): React.CSSProperties {
  const backgroundColor =
    inputStyle === "filled"
      ? tokens.filledFieldSurface
      : inputStyle === "underlined"
        ? mixHex(tokens.fieldSurface, tokens.text, 0.015)
        : tokens.fieldSurface;
  const borderColor = hasError
    ? tokens.error
    : isFocused
      ? tokens.primary
      : tokens.strongBorder;

  return {
    width: "100%",
    minHeight: 50,
    padding: "12px 16px",
    border: `1px solid ${borderColor}`,
    borderRadius: CONTROL_RADIUS,
    backgroundColor,
    color: tokens.text,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    fontFamily: tokens.fontFamily,
    cursor: isDisabled ? "not-allowed" : "text",
    opacity: isDisabled ? 0.78 : 1,
    boxShadow: hasError
      ? `0 0 0 2px ${toRgba(tokens.error, 0.2)}`
      : isFocused
        ? `0 0 0 2px ${tokens.focusRing}`
        : "none",
    outline: "none",
    transition:
      "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
  };
}

function getSubmitButtonStyle(
  tokens: ThemeTokens,
  buttonStyle: "filled" | "outlined" | "ghost",
): React.CSSProperties {
  if (buttonStyle === "outlined") {
    return {
      minHeight: 48,
      padding: "12px 24px",
      borderRadius: CONTROL_RADIUS,
      backgroundColor: "transparent",
      borderColor: tokens.primary,
      color: tokens.primary,
      boxShadow: `0 1px 2px ${toRgba(tokens.text, 0.08)}`,
    };
  }

  if (buttonStyle === "ghost") {
    return {
      minHeight: 48,
      padding: "12px 24px",
      borderRadius: CONTROL_RADIUS,
      backgroundColor: toRgba(tokens.primary, 0.08),
      borderColor: "transparent",
      color: tokens.primary,
      boxShadow: "none",
    };
  }

  return {
    minHeight: 48,
    padding: "12px 24px",
    borderRadius: CONTROL_RADIUS,
    backgroundColor: tokens.primary,
    borderColor: tokens.primary,
    color: tokens.buttonTextOnPrimary,
    boxShadow: `0 8px 18px -12px ${toRgba(tokens.primary, 0.6)}`,
  };
}

function clearRedirectTimer(
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function mixHex(base: string, overlay: string, overlayWeight: number): string {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);

  if (!baseRgb || !overlayRgb) {
    return base;
  }

  const clampedWeight = Math.max(0, Math.min(1, overlayWeight));
  const inverseWeight = 1 - clampedWeight;

  return rgbToHex(
    Math.round(baseRgb.r * inverseWeight + overlayRgb.r * clampedWeight),
    Math.round(baseRgb.g * inverseWeight + overlayRgb.g * clampedWeight),
    Math.round(baseRgb.b * inverseWeight + overlayRgb.b * clampedWeight),
  );
}

function toRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return `rgba(31, 41, 55, ${alpha})`;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getReadableTextColor(
  backgroundHex: string,
  lightColor: string,
  darkColor: string,
): string {
  return isDarkColor(backgroundHex) ? lightColor : darkColor;
}

function isDarkColor(hex: string): boolean {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return false;
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;

  return luminance < 0.55;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((segment) => `${segment}${segment}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  const numeric = Number.parseInt(value, 16);

  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export default FormPreviewRenderer;
