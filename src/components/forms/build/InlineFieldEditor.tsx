import * as React from "react";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  getAvailableConditionSourceFields,
  normalizeVisibilityRules,
} from "@/lib/forms/formFlow";
import { isConsentFieldType } from "@/lib/forms/fieldRegistry";
import type {
  FormCompliance,
  FormField,
  FormStep,
  FormVisibilityRule,
} from "@/types/formBuilder";

const VISIBILITY_OPERATOR_OPTIONS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_empty", label: "Is answered" },
  { value: "is_empty", label: "Is blank" },
] as const;

interface InlineFieldEditorProps {
  field: FormField;
  fields: FormField[];
  steps: FormStep[];
  compliance: FormCompliance;
  multiStepEnabled: boolean;
  onFieldChange: (updates: Partial<FormField>) => void;
  onComplianceChange: (updates: Partial<FormCompliance>) => void;
}

export function InlineFieldEditor({
  field,
  fields,
  steps,
  compliance,
  multiStepEnabled,
  onFieldChange,
  onComplianceChange,
}: InlineFieldEditorProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [mappingEditable, setMappingEditable] = React.useState(false);

  React.useEffect(() => {
    setShowAdvanced(false);
    setMappingEditable(false);
  }, [field.id]);

  const availableConditionFields = React.useMemo(
    () => getAvailableConditionSourceFields(fields, field.id, steps),
    [field.id, fields, steps],
  );
  const visibilityRules = normalizeVisibilityRules(field.visibility_rules);
  const supportsPlaceholder = ["text", "email", "phone", "select"].includes(
    field.type,
  );
  const supportsTextValidation = ["text", "email", "phone"].includes(
    field.type,
  );
  const supportsOptions = field.type === "select";
  const supportsFileRules = field.type === "file";
  const isConsentField = isConsentFieldType(field.type);
  const consentText =
    field.type === "email_consent"
      ? compliance.email_consent_text
      : field.type === "sms_consent"
        ? compliance.sms_consent_text
        : "";

  const updateVisibilityRule = (
    ruleIndex: number,
    updates: Partial<FormVisibilityRule>,
  ) => {
    const nextRules = visibilityRules.map((rule, index) =>
      index === ruleIndex ? { ...rule, ...updates } : rule,
    );

    onFieldChange({ visibility_rules: nextRules });
  };

  const addVisibilityRule = () => {
    const firstAvailableField = availableConditionFields[0];
    if (!firstAvailableField) {
      return;
    }

    onFieldChange({
      visibility_rules: [
        ...visibilityRules,
        {
          field_id: firstAvailableField.id,
          operator: "equals",
          value: "",
        },
      ],
    });
    setShowAdvanced(true);
  };

  const removeVisibilityRule = (ruleIndex: number) => {
    onFieldChange({
      visibility_rules: visibilityRules.filter(
        (_, index) => index !== ruleIndex,
      ),
    });
  };

  const handleRequiredChange = (required: boolean) => {
    onFieldChange({ required });

    if (field.type === "email_consent") {
      onComplianceChange({ email_consent_required: required });
    }

    if (field.type === "sms_consent") {
      onComplianceChange({ sms_consent_required: required });
    }
  };

  return (
    <Sheet
      data-inline-editor-root="true"
      variant="soft"
      color="neutral"
      sx={{
        borderRadius: "lg",
        p: 2,
        border: "1px solid",
        borderColor: "neutral.200",
      }}
    >
      <Stack spacing={2}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
          }}
        >
          <JoyInput
            label="Label"
            value={field.label}
            onValueChange={(label) => onFieldChange({ label })}
            placeholder="Field label"
          />

          {supportsPlaceholder ? (
            <JoyInput
              label="Placeholder"
              value={field.placeholder ?? ""}
              onValueChange={(placeholder) => onFieldChange({ placeholder })}
              placeholder="Placeholder text"
            />
          ) : null}

          <JoyInput
            label="Help text"
            value={field.help_text ?? ""}
            onValueChange={(help_text) => onFieldChange({ help_text })}
            placeholder="Additional guidance for respondents"
            formControlSx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}
          />
        </Box>

        <Sheet
          variant="plain"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "lg",
            px: 1.5,
            py: 1.25,
          }}
        >
          <Stack spacing={0.25}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Required
            </Typography>
            <Typography level="body-xs" color="neutral">
              Block submission until this field is completed.
            </Typography>
          </Stack>
          <Switch
            checked={field.required}
            onChange={(event) => handleRequiredChange(event.target.checked)}
            size="sm"
          />
        </Sheet>

        <Box>
          <JoyButton
            bloomVariant="ghost"
            color="neutral"
            size="sm"
            endDecorator={
              showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            }
            onClick={() => setShowAdvanced((current) => !current)}
            sx={{ minHeight: "auto", px: 0 }}
          >
            Advanced settings
          </JoyButton>

          {showAdvanced ? (
            <Stack spacing={2} sx={{ mt: 1.5 }}>
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
                {multiStepEnabled ? (
                  <JoySelect
                    label="Step"
                    value={String(field.step_index ?? 0)}
                    options={steps.map((step) => ({
                      value: String(step.index),
                      label: step.title || `Step ${step.index + 1}`,
                    }))}
                    onValueChange={(value) =>
                      onFieldChange({
                        step_index: Number.parseInt(value || "0", 10) || 0,
                      })
                    }
                  />
                ) : null}

                <JoyInput
                  label="Mapping key"
                  value={field.mapping_key}
                  readOnly={!mappingEditable || isConsentField}
                  disabled={isConsentField}
                  onValueChange={(mapping_key) =>
                    onFieldChange({ mapping_key })
                  }
                  helperText={
                    isConsentField
                      ? "Consent fields keep their canonical submission key."
                      : "Used in submission payloads and CRM mapping."
                  }
                  endDecorator={
                    !isConsentField ? (
                      <JoyButton
                        bloomVariant="ghost"
                        color="neutral"
                        size="sm"
                        onClick={() =>
                          setMappingEditable((current) => !current)
                        }
                        sx={{ minHeight: "auto", px: 0.5 }}
                      >
                        <Pencil size={14} />
                      </JoyButton>
                    ) : undefined
                  }
                />

                {field.type === "hidden" ? (
                  <JoyInput
                    label="Hidden value"
                    value={
                      typeof field.default_value === "string"
                        ? field.default_value
                        : ""
                    }
                    onValueChange={(default_value) =>
                      onFieldChange({ default_value })
                    }
                    formControlSx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}
                  />
                ) : null}
              </Box>

              {supportsOptions ? (
                <FormControl>
                  <FormLabel>Options</FormLabel>
                  <Stack spacing={1}>
                    {(field.options ?? []).map((option, optionIndex) => (
                      <Stack
                        key={`${field.id}-option-${optionIndex}`}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                      >
                        <JoyInput
                          value={option}
                          onValueChange={(value) => {
                            const nextOptions = [...(field.options ?? [])];
                            nextOptions[optionIndex] = value;
                            onFieldChange({ options: nextOptions });
                          }}
                        />
                        <IconButton
                          color="danger"
                          variant="plain"
                          onClick={() => {
                            const nextOptions = (field.options ?? []).filter(
                              (_, index) => index !== optionIndex,
                            );
                            onFieldChange({
                              options:
                                nextOptions.length > 0
                                  ? nextOptions
                                  : ["Option 1"],
                            });
                          }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Stack>
                    ))}
                    <JoyButton
                      bloomVariant="ghost"
                      color="neutral"
                      size="sm"
                      onClick={() =>
                        onFieldChange({
                          options: [
                            ...(field.options ?? []),
                            `Option ${(field.options?.length ?? 0) + 1}`,
                          ],
                        })
                      }
                    >
                      Add option
                    </JoyButton>
                  </Stack>
                </FormControl>
              ) : null}

              {supportsTextValidation ? (
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
                    label="Minimum length"
                    type="number"
                    value={
                      field.rules?.min_length
                        ? String(field.rules.min_length)
                        : ""
                    }
                    onValueChange={(value) =>
                      onFieldChange({
                        rules: {
                          ...field.rules,
                          min_length: value ? Number(value) : undefined,
                        },
                      })
                    }
                  />
                  <JoyInput
                    label="Maximum length"
                    type="number"
                    value={
                      field.rules?.max_length
                        ? String(field.rules.max_length)
                        : ""
                    }
                    onValueChange={(value) =>
                      onFieldChange({
                        rules: {
                          ...field.rules,
                          max_length: value ? Number(value) : undefined,
                        },
                      })
                    }
                  />
                  <JoyInput
                    label="Regex pattern"
                    value={field.rules?.pattern ?? ""}
                    onValueChange={(pattern) =>
                      onFieldChange({
                        rules: {
                          ...field.rules,
                          pattern: pattern || undefined,
                        },
                      })
                    }
                  />
                  <JoyInput
                    label="Pattern error message"
                    value={field.rules?.pattern_message ?? ""}
                    onValueChange={(pattern_message) =>
                      onFieldChange({
                        rules: {
                          ...field.rules,
                          pattern_message: pattern_message || undefined,
                        },
                      })
                    }
                  />
                </Box>
              ) : null}

              {supportsFileRules ? (
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
                    label="Max files"
                    type="number"
                    value={String(field.rules?.max_files ?? 1)}
                    onValueChange={(value) =>
                      onFieldChange({
                        rules: {
                          ...field.rules,
                          max_files: Number(value) || 1,
                        },
                      })
                    }
                  />
                  <JoyInput
                    label="Max file size (MB)"
                    type="number"
                    value={String(field.rules?.max_file_size_mb ?? 10)}
                    onValueChange={(value) =>
                      onFieldChange({
                        rules: {
                          ...field.rules,
                          max_file_size_mb: Number(value) || 10,
                        },
                      })
                    }
                  />
                  <JoyInput
                    label="Allowed MIME types"
                    value={(field.rules?.allowed_mime_types ?? []).join(", ")}
                    onValueChange={(value) =>
                      onFieldChange({
                        rules: {
                          ...field.rules,
                          allowed_mime_types: value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    helperText="Comma-separated, for example image/png, image/jpeg"
                    formControlSx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}
                  />
                </Box>
              ) : null}

              {field.type === "email_consent" ||
              field.type === "sms_consent" ? (
                <FormControl>
                  <FormLabel>Consent text</FormLabel>
                  <Textarea
                    minRows={3}
                    value={consentText}
                    onChange={(event) =>
                      onComplianceChange(
                        field.type === "email_consent"
                          ? { email_consent_text: event.target.value }
                          : { sms_consent_text: event.target.value },
                      )
                    }
                    placeholder="Explain what the customer is opting into"
                  />
                </FormControl>
              ) : null}

              <FormControl>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <FormLabel>Conditional visibility</FormLabel>
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    size="sm"
                    onClick={addVisibilityRule}
                    disabled={availableConditionFields.length === 0}
                  >
                    Add rule
                  </JoyButton>
                </Stack>

                {visibilityRules.length === 0 ? (
                  <Sheet
                    variant="plain"
                    sx={{
                      borderRadius: "lg",
                      p: 1.5,
                      border: "1px dashed",
                      borderColor: "neutral.300",
                    }}
                  >
                    <Typography level="body-sm" color="neutral">
                      This field always shows. Add a rule to reveal it only
                      after earlier answers match.
                    </Typography>
                  </Sheet>
                ) : (
                  <Stack spacing={1}>
                    {visibilityRules.map((rule, ruleIndex) => {
                      const operatorNeedsValue =
                        rule.operator !== "not_empty" &&
                        rule.operator !== "is_empty";

                      return (
                        <Sheet
                          key={`${field.id}-rule-${ruleIndex}`}
                          variant="plain"
                          sx={{
                            border: "1px solid",
                            borderColor: "neutral.200",
                            borderRadius: "lg",
                            p: 1.5,
                          }}
                        >
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: {
                                xs: "1fr",
                                md: operatorNeedsValue
                                  ? "repeat(3, minmax(0, 1fr)) auto"
                                  : "repeat(2, minmax(0, 1fr)) auto",
                              },
                              gap: 1,
                            }}
                          >
                            <JoySelect
                              value={rule.field_id}
                              options={availableConditionFields.map(
                                (sourceField) => ({
                                  value: sourceField.id,
                                  label: sourceField.label,
                                }),
                              )}
                              onValueChange={(field_id) =>
                                updateVisibilityRule(ruleIndex, { field_id })
                              }
                            />
                            <JoySelect
                              value={rule.operator}
                              options={VISIBILITY_OPERATOR_OPTIONS.map(
                                (option) => ({
                                  value: option.value,
                                  label: option.label,
                                }),
                              )}
                              onValueChange={(operator) =>
                                updateVisibilityRule(ruleIndex, {
                                  operator:
                                    operator as FormVisibilityRule["operator"],
                                  value:
                                    operator === "not_empty" ||
                                    operator === "is_empty"
                                      ? undefined
                                      : rule.value,
                                })
                              }
                            />
                            {operatorNeedsValue ? (
                              <JoyInput
                                value={rule.value ?? ""}
                                onValueChange={(value) =>
                                  updateVisibilityRule(ruleIndex, { value })
                                }
                                placeholder="Value"
                              />
                            ) : null}
                            <IconButton
                              color="danger"
                              variant="plain"
                              onClick={() => removeVisibilityRule(ruleIndex)}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </Box>
                        </Sheet>
                      );
                    })}
                  </Stack>
                )}
                <FormHelperText>
                  Only earlier non-hidden fields can drive conditional
                  visibility.
                </FormHelperText>
              </FormControl>
            </Stack>
          ) : null}
        </Box>
      </Stack>
    </Sheet>
  );
}
