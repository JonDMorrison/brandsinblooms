import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  DEFAULT_FILE_FIELD_MAX_FILE_SIZE_MB,
  FILE_TYPE_PRESETS,
  FORM_UPLOAD_MAX_FILE_SIZE_MB,
} from "@/lib/forms/fileUploads";
import {
  getAvailableConditionSourceFields,
  normalizeVisibilityRules,
} from "@/lib/forms/formFlow";
import { isConsentFieldType } from "@/lib/forms/fieldRegistry";
import type {
  FormCompliance,
  FormField,
  FormStep,
  FormVisibilityOperator,
  FormVisibilityRule,
} from "@/types/formBuilder";

interface InlineFieldEditorProps {
  field: FormField;
  allFields: FormField[];
  steps: FormStep[];
  onFieldChange: (updates: Partial<FormField>) => void;
  onComplianceChange: (updates: Partial<FormCompliance>) => void;
  multiStepEnabled?: boolean;
  currentStepLabel?: string;
}

type InspectorSectionKey =
  | "fieldOptions"
  | "validation"
  | "visibility"
  | "advanced";

type MimePresetOption = {
  key: string;
  label: string;
  mimeTypes: readonly string[];
};

const MIME_PRESET_OPTIONS: MimePresetOption[] = [
  {
    key: "images",
    label: "Images",
    mimeTypes: FILE_TYPE_PRESETS.images,
  },
  {
    key: "documents",
    label: "Documents",
    mimeTypes: FILE_TYPE_PRESETS.documents,
  },
  {
    key: "spreadsheets",
    label: "Spreadsheets",
    mimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ],
  },
];

const VISIBILITY_OPERATOR_OPTIONS: Array<{
  value: FormVisibilityOperator;
  label: string;
}> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_empty", label: "Is filled" },
  { value: "is_empty", label: "Is empty" },
];

const DEFAULT_SECTION_STATE: Record<InspectorSectionKey, boolean> = {
  fieldOptions: true,
  validation: false,
  visibility: false,
  advanced: false,
};

function toUniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatRuleCount(count: number) {
  return `${count} condition${count === 1 ? "" : "s"}`;
}

function formatVisibilityOperator(operator: FormVisibilityOperator) {
  return (
    VISIBILITY_OPERATOR_OPTIONS.find((option) => option.value === operator)
      ?.label ?? "Equals"
  );
}

function summaryText(
  parts: Array<string | null | undefined>,
  emptyLabel: string,
) {
  const resolved = parts.filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return resolved.length > 0 ? resolved.join(" · ") : emptyLabel;
}

function isBooleanLikeField(field: FormField) {
  return [
    "checkbox",
    "email_consent",
    "sms_consent",
    "segment_checkbox",
  ].includes(field.type);
}

function visibilityRuleRequiresValue(operator: FormVisibilityOperator) {
  return operator !== "is_empty" && operator !== "not_empty";
}

function InspectorSection({
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      variant="plain"
      sx={{
        borderRadius: "xl",
        border: "1px solid",
        borderColor: expanded ? "primary.200" : "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.5, py: 1.25 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography level="title-sm" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography level="body-xs" color="neutral">
            {summary}
          </Typography>
        </Box>
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </Stack>

      {expanded ? (
        <>
          <Divider />
          <Box sx={{ p: 1.5 }}>{children}</Box>
        </>
      ) : null}
    </Sheet>
  );
}

export function InlineFieldEditor({
  field,
  allFields,
  steps,
  onFieldChange,
  onComplianceChange,
  multiStepEnabled = false,
  currentStepLabel,
}: InlineFieldEditorProps) {
  const [expandedSections, setExpandedSections] = React.useState(
    DEFAULT_SECTION_STATE,
  );
  const [customMimeType, setCustomMimeType] = React.useState("");

  React.useEffect(() => {
    setExpandedSections(DEFAULT_SECTION_STATE);
    setCustomMimeType("");
  }, [field.id]);

  const visibilityRules = React.useMemo(
    () => normalizeVisibilityRules(field.visibility_rules),
    [field.visibility_rules],
  );
  const availableConditionFields = React.useMemo(
    () => getAvailableConditionSourceFields(allFields, field.id, steps),
    [allFields, field.id, steps],
  );
  const selectedStepIndex = field.step_index ?? 0;
  const selectedStep = steps.find((step) => step.index === selectedStepIndex);
  const fieldLabel = field.label.trim() || "Untitled field";
  const allowedMimeTypes = React.useMemo(
    () => field.rules?.allowed_mime_types ?? [],
    [field.rules?.allowed_mime_types],
  );
  const currentFileLimit =
    field.rules?.max_file_size_mb ?? DEFAULT_FILE_FIELD_MAX_FILE_SIZE_MB;

  const toggleSection = React.useCallback((section: InspectorSectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const updateRuleSet = React.useCallback(
    (nextRules: FormVisibilityRule[]) => {
      onFieldChange({ visibility_rules: normalizeVisibilityRules(nextRules) });
    },
    [onFieldChange],
  );

  const updateRule = React.useCallback(
    (
      index: number,
      updates: Partial<FormVisibilityRule>,
      sourceField?: FormField,
    ) => {
      const nextRules = visibilityRules.map((rule, ruleIndex) => {
        if (ruleIndex !== index) {
          return rule;
        }

        const nextOperator =
          updates.operator ??
          rule.operator ??
          ("equals" satisfies FormVisibilityOperator);

        let nextValue = updates.value ?? rule.value;
        if (updates.field_id && sourceField) {
          if (sourceField.type === "select") {
            nextValue = sourceField.options?.[0] ?? "";
          } else if (isBooleanLikeField(sourceField)) {
            nextValue = "true";
          } else {
            nextValue = "";
          }
        }

        if (!visibilityRuleRequiresValue(nextOperator)) {
          nextValue = "";
        }

        return {
          ...rule,
          ...updates,
          operator: nextOperator,
          value: nextValue,
        };
      });

      updateRuleSet(nextRules);
    },
    [updateRuleSet, visibilityRules],
  );

  const addCondition = React.useCallback(() => {
    const defaultSourceField = availableConditionFields[0];
    if (!defaultSourceField) {
      return;
    }

    const nextRule: FormVisibilityRule = {
      field_id: defaultSourceField.id,
      operator: "equals",
      value: isBooleanLikeField(defaultSourceField)
        ? "true"
        : defaultSourceField.type === "select"
          ? (defaultSourceField.options?.[0] ?? "")
          : "",
    };

    updateRuleSet([...visibilityRules, nextRule]);
    setExpandedSections((current) => ({ ...current, visibility: true }));
  }, [availableConditionFields, updateRuleSet, visibilityRules]);

  const removeCondition = React.useCallback(
    (index: number) => {
      updateRuleSet(
        visibilityRules.filter((_, ruleIndex) => ruleIndex !== index),
      );
    },
    [updateRuleSet, visibilityRules],
  );

  const setConditionalVisibilityEnabled = React.useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        onFieldChange({ visibility_rules: [] });
        return;
      }

      if (visibilityRules.length > 0) {
        return;
      }

      const defaultSourceField = availableConditionFields[0];
      if (!defaultSourceField) {
        return;
      }

      updateRuleSet([
        {
          field_id: defaultSourceField.id,
          operator: "equals",
          value: isBooleanLikeField(defaultSourceField)
            ? "true"
            : defaultSourceField.type === "select"
              ? (defaultSourceField.options?.[0] ?? "")
              : "",
        },
      ]);
      setExpandedSections((current) => ({ ...current, visibility: true }));
    },
    [
      availableConditionFields,
      onFieldChange,
      updateRuleSet,
      visibilityRules.length,
    ],
  );

  const updateOptions = React.useCallback(
    (nextOptions: string[]) => {
      onFieldChange({ options: nextOptions });
    },
    [onFieldChange],
  );

  const addOption = React.useCallback(() => {
    const nextOptions = [
      ...(field.options ?? []),
      `Option ${(field.options?.length ?? 0) + 1}`,
    ];
    updateOptions(nextOptions);
    setExpandedSections((current) => ({ ...current, fieldOptions: true }));
  }, [field.options, updateOptions]);

  const updateOption = React.useCallback(
    (index: number, value: string) => {
      updateOptions(
        (field.options ?? []).map((option, optionIndex) =>
          optionIndex === index ? value : option,
        ),
      );
    },
    [field.options, updateOptions],
  );

  const removeOption = React.useCallback(
    (index: number) => {
      updateOptions(
        (field.options ?? []).filter((_, optionIndex) => optionIndex !== index),
      );
    },
    [field.options, updateOptions],
  );

  const toggleMimePreset = React.useCallback(
    (preset: MimePresetOption) => {
      const nextAllowedMimeTypes = preset.mimeTypes.every((mimeType) =>
        allowedMimeTypes.includes(mimeType),
      )
        ? allowedMimeTypes.filter(
            (mimeType) => !preset.mimeTypes.includes(mimeType),
          )
        : toUniqueStrings([...allowedMimeTypes, ...preset.mimeTypes]);

      onFieldChange({
        rules: {
          ...field.rules,
          allowed_mime_types: nextAllowedMimeTypes,
        },
      });
    },
    [allowedMimeTypes, field.rules, onFieldChange],
  );

  const addCustomMimeType = React.useCallback(() => {
    const normalizedValue = customMimeType.trim().toLowerCase();
    if (!normalizedValue) {
      return;
    }

    onFieldChange({
      rules: {
        ...field.rules,
        allowed_mime_types: toUniqueStrings([
          ...allowedMimeTypes,
          normalizedValue,
        ]),
      },
    });
    setCustomMimeType("");
  }, [allowedMimeTypes, customMimeType, field.rules, onFieldChange]);

  const removeMimeType = React.useCallback(
    (mimeTypeToRemove: string) => {
      onFieldChange({
        rules: {
          ...field.rules,
          allowed_mime_types: allowedMimeTypes.filter(
            (mimeType) => mimeType !== mimeTypeToRemove,
          ),
        },
      });
    },
    [allowedMimeTypes, field.rules, onFieldChange],
  );

  const fieldOptionsSummary = React.useMemo(() => {
    if (field.type === "select") {
      return summaryText(
        [
          field.options?.length
            ? formatCountLabel(field.options.length, "option")
            : null,
        ],
        "No choices configured",
      );
    }

    if (field.type === "file") {
      return summaryText(
        [
          allowedMimeTypes.length
            ? formatCountLabel(allowedMimeTypes.length, "file type")
            : "Accepts all file types",
          `Max ${field.rules?.max_files ?? 1} files`,
          `${currentFileLimit} MB each`,
        ],
        "Default file upload settings",
      );
    }

    if (field.type === "hidden") {
      return summaryText(
        [field.default_value ? `Default ${String(field.default_value)}` : null],
        "No default value set",
      );
    }

    if (isConsentFieldType(field.type)) {
      const consentText =
        field.type === "email_consent"
          ? field.label || "Email consent copy"
          : field.label || "SMS consent copy";

      return summaryText([consentText], "Consent copy managed in Compliance");
    }

    if (field.type === "segment_checkbox") {
      return summaryText(
        [field.segment_name ? `Segment ${field.segment_name}` : null],
        "No CRM segment linked",
      );
    }

    if (field.type === "checkbox") {
      return "Uses the field label as checkbox copy";
    }

    return "No type-specific options for this field";
  }, [allowedMimeTypes.length, currentFileLimit, field]);

  const validationSummary = React.useMemo(() => {
    if (!["text", "email", "phone"].includes(field.type)) {
      return "No validation rules for this field type";
    }

    return summaryText(
      [
        field.required ? "Required" : null,
        typeof field.rules?.min_length === "number"
          ? `Min ${field.rules.min_length} chars`
          : null,
        typeof field.rules?.max_length === "number"
          ? `Max ${field.rules.max_length} chars`
          : null,
        field.rules?.pattern ? "Pattern set" : null,
      ],
      "No validation rules",
    );
  }, [field.required, field.rules, field.type]);

  const visibilitySummary = React.useMemo(() => {
    return visibilityRules.length > 0
      ? `${formatRuleCount(visibilityRules.length)} · Match all`
      : "Always visible";
  }, [visibilityRules.length]);

  const advancedSummary = React.useMemo(() => {
    return summaryText(
      [
        field.mapping_key ? field.mapping_key : null,
        multiStepEnabled
          ? selectedStep?.title ||
            currentStepLabel ||
            `Step ${selectedStepIndex + 1}`
          : null,
      ],
      "No advanced configuration",
    );
  }, [
    currentStepLabel,
    field.mapping_key,
    multiStepEnabled,
    selectedStep?.title,
    selectedStepIndex,
  ]);

  return (
    <Stack spacing={1.5} data-inline-editor-root="true">
      <Sheet
        variant="plain"
        sx={{
          borderRadius: "xl",
          border: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          p: 1.5,
        }}
      >
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography level="title-sm" sx={{ fontWeight: 700 }}>
              Basic configuration
            </Typography>
            <Typography level="body-xs" color="neutral">
              Core copy and defaults for {fieldLabel.toLowerCase()}.
            </Typography>
          </Stack>

          <JoyInput
            label="Field label"
            value={field.label}
            onValueChange={(label) => onFieldChange({ label })}
            placeholder="What should people see?"
          />

          {["text", "email", "phone"].includes(field.type) ? (
            <JoyInput
              label="Placeholder"
              value={field.placeholder ?? ""}
              onValueChange={(placeholder) => onFieldChange({ placeholder })}
              placeholder="Add example text"
            />
          ) : null}

          <FormControl>
            <FormLabel>Help text</FormLabel>
            <Textarea
              minRows={2}
              value={field.help_text ?? ""}
              placeholder="Optional guidance shown beneath the field"
              onChange={(event) =>
                onFieldChange({ help_text: event.target.value })
              }
              sx={{
                borderRadius: "lg",
                backgroundColor: "#FFFFFF",
              }}
            />
            <FormHelperText>
              Keep this short and specific so it reads as supporting guidance,
              not body copy.
            </FormHelperText>
          </FormControl>

          <Sheet
            variant="soft"
            color={field.required ? "primary" : "neutral"}
            sx={{
              borderRadius: "lg",
              px: 1.25,
              py: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                Required field
              </Typography>
              <Typography level="body-xs" color="neutral">
                Require a response before the form can be submitted.
              </Typography>
            </Box>
            <Switch
              checked={field.required}
              onChange={(event) => {
                const checked = event.target.checked;
                onFieldChange({ required: checked });

                if (field.type === "email_consent") {
                  onComplianceChange({ require_email_consent: checked });
                }

                if (field.type === "sms_consent") {
                  onComplianceChange({ require_sms_consent: checked });
                }
              }}
            />
          </Sheet>
        </Stack>
      </Sheet>

      <InspectorSection
        title="Field options"
        summary={fieldOptionsSummary}
        expanded={expandedSections.fieldOptions}
        onToggle={() => toggleSection("fieldOptions")}
      >
        <Stack spacing={1.5}>
          {field.type === "select" ? (
            <Stack spacing={1.25}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    Choice list
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Each option is rendered in order for visitors.
                  </Typography>
                </Box>
                <JoyButton
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  startDecorator={<Plus size={16} />}
                  onClick={addOption}
                >
                  Add option
                </JoyButton>
              </Stack>

              {(field.options ?? []).length > 0 ? (
                <Stack spacing={1}>
                  {(field.options ?? []).map((option, index) => (
                    <Sheet
                      key={`${field.id}-option-${index}`}
                      variant="plain"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 1,
                        py: 0.875,
                        borderRadius: "lg",
                        border: "1px solid",
                        borderColor: "neutral.200",
                        backgroundColor: "background.surface",
                      }}
                    >
                      <Box
                        sx={{
                          width: 24,
                          display: "grid",
                          placeItems: "center",
                          color: "neutral.400",
                          flexShrink: 0,
                        }}
                      >
                        <GripVertical size={16} />
                      </Box>
                      <JoyInput
                        value={option}
                        onValueChange={(value) => updateOption(index, value)}
                        placeholder={`Option ${index + 1}`}
                        sx={{ flex: 1 }}
                      />
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={() => removeOption(index)}
                        aria-label={`Delete option ${index + 1}`}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Sheet>
                  ))}
                </Stack>
              ) : (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "lg", px: 1.25, py: 1 }}
                >
                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    No options yet
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Add at least one choice before publishing this field.
                  </Typography>
                </Sheet>
              )}
            </Stack>
          ) : null}

          {field.type === "file" ? (
            <Stack spacing={1.5}>
              <Box>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  Allowed file types
                </Typography>
                <Typography level="body-xs" color="neutral">
                  Combine presets with custom MIME types when you need tighter
                  control.
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {MIME_PRESET_OPTIONS.map((preset) => {
                  const isSelected = preset.mimeTypes.every((mimeType) =>
                    allowedMimeTypes.includes(mimeType),
                  );

                  return (
                    <Button
                      key={preset.key}
                      size="sm"
                      variant={isSelected ? "solid" : "outlined"}
                      color={isSelected ? "primary" : "neutral"}
                      onClick={() => toggleMimePreset(preset)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <JoyInput
                  label="Custom MIME type"
                  value={customMimeType}
                  onValueChange={setCustomMimeType}
                  placeholder="application/zip"
                  sx={{ flex: 1 }}
                />
                <JoyButton
                  variant="outlined"
                  color="neutral"
                  onClick={addCustomMimeType}
                  sx={{ alignSelf: { xs: "stretch", sm: "flex-end" } }}
                >
                  Add type
                </JoyButton>
              </Stack>

              {allowedMimeTypes.length > 0 ? (
                <Stack
                  direction="row"
                  spacing={0.75}
                  useFlexGap
                  flexWrap="wrap"
                >
                  {allowedMimeTypes.map((mimeType) => (
                    <JoyChip
                      key={mimeType}
                      size="sm"
                      variant="soft"
                      color="neutral"
                      endDecorator={
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={() => removeMimeType(mimeType)}
                          aria-label={`Remove ${mimeType}`}
                        >
                          <Trash2 size={12} />
                        </IconButton>
                      }
                    >
                      {mimeType}
                    </JoyChip>
                  ))}
                </Stack>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                <JoyInput
                  type="number"
                  label="Max files"
                  value={String(field.rules?.max_files ?? 1)}
                  onValueChange={(value) =>
                    onFieldChange({
                      rules: {
                        ...field.rules,
                        max_files: Math.max(1, Number(value) || 1),
                      },
                    })
                  }
                  helperText="Visitors can upload up to 10 files per field."
                />
                <JoyInput
                  type="number"
                  label="Max file size (MB)"
                  value={String(currentFileLimit)}
                  onValueChange={(value) =>
                    onFieldChange({
                      rules: {
                        ...field.rules,
                        max_file_size_mb: Math.max(1, Number(value) || 1),
                      },
                    })
                  }
                  helperText={`System cap: ${FORM_UPLOAD_MAX_FILE_SIZE_MB} MB per file.`}
                />
              </Box>
            </Stack>
          ) : null}

          {field.type === "hidden" ? (
            <JoyInput
              label="Default value"
              value={String(field.default_value ?? "")}
              onValueChange={(defaultValue) =>
                onFieldChange({ default_value: defaultValue })
              }
              placeholder="Applied automatically when the form loads"
            />
          ) : null}

          {isConsentFieldType(field.type) ? (
            <Stack spacing={1.25}>
              <FormControl>
                <FormLabel>Consent copy</FormLabel>
                <Textarea
                  minRows={3}
                  value={field.label}
                  onChange={(event) =>
                    onFieldChange({ label: event.target.value })
                  }
                  sx={{ borderRadius: "lg", backgroundColor: "#FFFFFF" }}
                />
                <FormHelperText>
                  Canonical consent language also appears in the Compliance tab
                  for final review.
                </FormHelperText>
              </FormControl>
            </Stack>
          ) : null}

          {field.type === "segment_checkbox" ? (
            <Stack spacing={1.25}>
              <JoyInput
                label="Segment name"
                value={field.segment_name ?? ""}
                onValueChange={(segment_name) =>
                  onFieldChange({ segment_name })
                }
                placeholder="Newsletter subscribers"
                helperText="This builder does not have a live CRM segment picker wired in yet, so the segment label is stored directly on the field."
              />
            </Stack>
          ) : null}

          {field.type === "checkbox" ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "lg", px: 1.25, py: 1 }}
            >
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                Checkbox copy
              </Typography>
              <Typography level="body-xs" color="neutral">
                This field uses the label above as the visible checkbox text.
              </Typography>
            </Sheet>
          ) : null}

          {![
            "select",
            "file",
            "hidden",
            "checkbox",
            "segment_checkbox",
          ].includes(field.type) && !isConsentFieldType(field.type) ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "lg", px: 1.25, py: 1 }}
            >
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                No extra field options
              </Typography>
              <Typography level="body-xs" color="neutral">
                This field type only uses the basic configuration and validation
                settings below.
              </Typography>
            </Sheet>
          ) : null}
        </Stack>
      </InspectorSection>

      <InspectorSection
        title="Validation"
        summary={validationSummary}
        expanded={expandedSections.validation}
        onToggle={() => toggleSection("validation")}
      >
        {["text", "email", "phone"].includes(field.type) ? (
          <Stack spacing={1.5}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 1.5,
              }}
            >
              <JoyInput
                type="number"
                label="Min length"
                value={
                  field.rules?.min_length ? String(field.rules.min_length) : ""
                }
                onValueChange={(value) =>
                  onFieldChange({
                    rules: {
                      ...field.rules,
                      min_length: value.trim() ? Number(value) : undefined,
                    },
                  })
                }
                placeholder="Optional"
              />
              <JoyInput
                type="number"
                label="Max length"
                value={
                  field.rules?.max_length ? String(field.rules.max_length) : ""
                }
                onValueChange={(value) =>
                  onFieldChange({
                    rules: {
                      ...field.rules,
                      max_length: value.trim() ? Number(value) : undefined,
                    },
                  })
                }
                placeholder="Optional"
              />
            </Box>

            <JoyInput
              label="Pattern"
              value={field.rules?.pattern ?? ""}
              onValueChange={(pattern) =>
                onFieldChange({
                  rules: {
                    ...field.rules,
                    pattern: pattern.trim() || undefined,
                  },
                })
              }
              placeholder="^[A-Z0-9]+$"
              helperText="Use a regular expression only when simple min/max rules are not enough."
            />

            <JoyInput
              label="Pattern error message"
              value={field.rules?.pattern_message ?? ""}
              onValueChange={(pattern_message) =>
                onFieldChange({
                  rules: {
                    ...field.rules,
                    pattern_message: pattern_message.trim() || undefined,
                  },
                })
              }
              placeholder="Enter a valid reference code"
            />
          </Stack>
        ) : (
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ borderRadius: "lg", px: 1.25, py: 1 }}
          >
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Validation is not configurable here
            </Typography>
            <Typography level="body-xs" color="neutral">
              {field.type === "file"
                ? "File constraints are configured in the Field options section above."
                : "This field type does not expose additional validation rules in the current builder."}
            </Typography>
          </Sheet>
        )}
      </InspectorSection>

      <InspectorSection
        title="Conditional visibility"
        summary={visibilitySummary}
        expanded={expandedSections.visibility}
        onToggle={() => toggleSection("visibility")}
      >
        <Stack spacing={1.5}>
          <Sheet
            variant="soft"
            color={visibilityRules.length > 0 ? "primary" : "neutral"}
            sx={{
              borderRadius: "lg",
              px: 1.25,
              py: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                Show this field conditionally
              </Typography>
              <Typography level="body-xs" color="neutral">
                The current runtime matches all configured rules together.
              </Typography>
            </Box>
            <Switch
              checked={visibilityRules.length > 0}
              disabled={availableConditionFields.length === 0}
              onChange={(event) =>
                setConditionalVisibilityEnabled(event.target.checked)
              }
            />
          </Sheet>

          {availableConditionFields.length === 0 ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "lg", px: 1.25, py: 1 }}
            >
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                No earlier fields available
              </Typography>
              <Typography level="body-xs" color="neutral">
                Conditional visibility can only reference non-hidden fields that
                appear earlier in the current flow.
              </Typography>
            </Sheet>
          ) : null}

          {visibilityRules.length > 0 ? (
            <Stack spacing={1}>
              {visibilityRules.map((rule, index) => {
                const sourceField = availableConditionFields.find(
                  (candidate) => candidate.id === rule.field_id,
                );

                return (
                  <Sheet
                    key={`${field.id}-visibility-${index}`}
                    variant="plain"
                    sx={{
                      borderRadius: "lg",
                      border: "1px solid",
                      borderColor: "neutral.200",
                      backgroundColor: "background.surface",
                      p: 1.25,
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          Condition {index + 1}
                        </Typography>
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="danger"
                          onClick={() => removeCondition(index)}
                          aria-label={`Delete condition ${index + 1}`}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Stack>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                          },
                          gap: 1.25,
                        }}
                      >
                        <JoySelect
                          label="When field"
                          value={rule.field_id}
                          options={availableConditionFields.map(
                            (candidate) => ({
                              value: candidate.id,
                              label: candidate.label || candidate.mapping_key,
                            }),
                          )}
                          onValueChange={(fieldId) => {
                            const nextSourceField =
                              availableConditionFields.find(
                                (candidate) => candidate.id === fieldId,
                              );

                            if (!fieldId || !nextSourceField) {
                              return;
                            }

                            updateRule(
                              index,
                              { field_id: fieldId },
                              nextSourceField,
                            );
                          }}
                        />
                        <JoySelect
                          label="Operator"
                          value={rule.operator}
                          options={VISIBILITY_OPERATOR_OPTIONS.map(
                            (option) => ({
                              value: option.value,
                              label: option.label,
                            }),
                          )}
                          onValueChange={(operator) => {
                            if (!operator) {
                              return;
                            }

                            updateRule(index, {
                              operator: operator as FormVisibilityOperator,
                            });
                          }}
                        />
                      </Box>

                      {sourceField &&
                      visibilityRuleRequiresValue(rule.operator) ? (
                        sourceField.type === "select" ? (
                          <JoySelect
                            label="Value"
                            value={rule.value ?? ""}
                            options={(sourceField.options ?? []).map(
                              (option) => ({
                                value: option,
                                label: option,
                              }),
                            )}
                            onValueChange={(value) =>
                              updateRule(index, { value: value ?? "" })
                            }
                          />
                        ) : isBooleanLikeField(sourceField) ? (
                          <JoySelect
                            label="Value"
                            value={rule.value ?? "true"}
                            options={[
                              { value: "true", label: "Checked" },
                              { value: "false", label: "Unchecked" },
                            ]}
                            onValueChange={(value) =>
                              updateRule(index, { value: value ?? "true" })
                            }
                          />
                        ) : (
                          <JoyInput
                            label="Value"
                            value={rule.value ?? ""}
                            onValueChange={(value) =>
                              updateRule(index, { value })
                            }
                            placeholder={`Match when ${sourceField.label || sourceField.mapping_key} ${formatVisibilityOperator(rule.operator).toLowerCase()}`}
                          />
                        )
                      ) : null}
                    </Stack>
                  </Sheet>
                );
              })}

              <JoyButton
                variant="outlined"
                color="neutral"
                startDecorator={<Plus size={16} />}
                onClick={addCondition}
                sx={{ alignSelf: "flex-start" }}
              >
                Add condition
              </JoyButton>
            </Stack>
          ) : null}
        </Stack>
      </InspectorSection>

      <InspectorSection
        title="Advanced"
        summary={advancedSummary}
        expanded={expandedSections.advanced}
        onToggle={() => toggleSection("advanced")}
      >
        <Stack spacing={1.5}>
          <JoyInput
            label="Mapping key"
            value={field.mapping_key}
            onValueChange={(mapping_key) => onFieldChange({ mapping_key })}
            helperText="Stored as the submission payload key and used for downstream CRM mapping."
            sx={{
              "& .MuiInput-input": {
                fontFamily:
                  'var(--joy-fontFamily-code, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)',
              },
            }}
          />

          {multiStepEnabled ? (
            <JoySelect
              label="Assigned step"
              value={String(selectedStepIndex)}
              options={steps.map((step) => ({
                value: String(step.index),
                label: step.title || `Step ${step.index + 1}`,
              }))}
              onValueChange={(value) => {
                if (value === null) {
                  return;
                }

                onFieldChange({ step_index: Number(value) });
              }}
            />
          ) : null}
        </Stack>
      </InspectorSection>
    </Stack>
  );
}
