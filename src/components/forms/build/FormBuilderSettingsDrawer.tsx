import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import {
  FORM_BORDER_RADIUS_OPTIONS,
  FORM_FONT_FAMILY_OPTIONS,
  FORM_SPACING_OPTIONS,
  FORM_WIDTH_OPTIONS,
} from "@/lib/forms/designSettings";
import type { FormSettings, FormStep } from "@/types/formBuilder";

interface FormBuilderSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: FormSettings;
  steps: FormStep[];
  multiStepEnabled: boolean;
  currentStepIndex: number;
  onFocusStep: (stepIndex: number) => void;
  onToggleMultiStep: (enabled: boolean) => void;
  onAddStep: () => void;
  onRemoveStep: (stepIndex: number) => void;
  onUpdateStep: (stepIndex: number, updates: Partial<FormStep>) => void;
  onSettingsPatch: (patch: Partial<FormSettings>) => void;
  onThemePatch: (patch: Partial<FormSettings["theme"]>) => void;
}

export function FormBuilderSettingsDrawer({
  open,
  onClose,
  settings,
  steps,
  multiStepEnabled,
  currentStepIndex,
  onFocusStep,
  onToggleMultiStep,
  onAddStep,
  onRemoveStep,
  onUpdateStep,
  onSettingsPatch,
  onThemePatch,
}: FormBuilderSettingsDrawerProps) {
  return (
    <JoyDrawer
      open={open}
      onClose={onClose}
      anchor="right"
      size="lg"
      title="Form settings"
      description="Manage structure, visual styling, and submit behavior for the whole form."
      startDecorator={<Settings2 size={18} />}
    >
      <JoyTabs defaultValue="structure">
        <JoyTabsList
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          <JoyTabsTrigger value="structure">Structure</JoyTabsTrigger>
          <JoyTabsTrigger value="design">Design</JoyTabsTrigger>
          <JoyTabsTrigger value="submit">Submit</JoyTabsTrigger>
        </JoyTabsList>

        <JoyTabsContent value="structure">
          <Stack spacing={2}>
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
                  Multi-step form
                </Typography>
                <Typography level="body-xs" color="neutral">
                  Break the experience into guided steps with focused sections.
                </Typography>
              </Stack>
              <Switch
                checked={multiStepEnabled}
                onChange={(event) => onToggleMultiStep(event.target.checked)}
                size="sm"
              />
            </Sheet>

            {multiStepEnabled ? (
              <>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography level="title-sm">Steps</Typography>
                  <JoyButton
                    size="sm"
                    bloomVariant="ghost"
                    color="neutral"
                    startDecorator={<Plus size={16} />}
                    onClick={onAddStep}
                  >
                    Add step
                  </JoyButton>
                </Stack>

                <Stack spacing={1.25}>
                  {steps.map((step) => (
                    <Sheet
                      key={`drawer-step-${step.index}`}
                      variant="plain"
                      sx={{
                        border: "1px solid",
                        borderColor:
                          currentStepIndex === step.index
                            ? "primary.300"
                            : "neutral.200",
                        borderRadius: "lg",
                        p: 1.5,
                      }}
                    >
                      <Stack spacing={1.25}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <JoyChip
                              size="sm"
                              variant={
                                currentStepIndex === step.index
                                  ? "solid"
                                  : "soft"
                              }
                              color={
                                currentStepIndex === step.index
                                  ? "primary"
                                  : "neutral"
                              }
                            >
                              Step {step.index + 1}
                            </JoyChip>
                            <JoyButton
                              size="sm"
                              bloomVariant="ghost"
                              color="neutral"
                              onClick={() => onFocusStep(step.index)}
                            >
                              Open
                            </JoyButton>
                          </Stack>

                          {steps.length > 1 ? (
                            <JoyButton
                              size="sm"
                              bloomVariant="ghost"
                              color="danger"
                              startDecorator={<Trash2 size={14} />}
                              onClick={() => onRemoveStep(step.index)}
                            >
                              Delete
                            </JoyButton>
                          ) : null}
                        </Stack>

                        <JoyInput
                          label="Step label"
                          value={step.title}
                          onValueChange={(title) =>
                            onUpdateStep(step.index, { title })
                          }
                        />

                        <Stack spacing={0.5}>
                          <Typography
                            level="body-xs"
                            sx={{ fontWeight: 600, color: "neutral.600" }}
                          >
                            Step description
                          </Typography>
                          <Textarea
                            minRows={2}
                            value={step.description}
                            onChange={(event) =>
                              onUpdateStep(step.index, {
                                description: event.target.value,
                              })
                            }
                            placeholder="Optional step description"
                          />
                        </Stack>
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              </>
            ) : (
              <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
                <Typography level="body-sm" color="neutral">
                  Single-step mode keeps the form on one continuous canvas.
                </Typography>
              </Sheet>
            )}
          </Stack>
        </JoyTabsContent>

        <JoyTabsContent value="design">
          <Stack spacing={2}>
            <JoyInput
              label="Form title"
              value={settings.form_title ?? ""}
              onValueChange={(form_title) => onSettingsPatch({ form_title })}
            />

            <Stack spacing={0.5}>
              <Typography
                level="body-xs"
                sx={{ fontWeight: 600, color: "neutral.600" }}
              >
                Form description
              </Typography>
              <Textarea
                minRows={3}
                value={settings.form_description ?? ""}
                onChange={(event) =>
                  onSettingsPatch({ form_description: event.target.value })
                }
                placeholder="Give visitors context before they start"
              />
            </Stack>

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
              <JoySelect
                label="Form width"
                value={settings.form_width ?? "medium"}
                options={FORM_WIDTH_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onValueChange={(form_width) =>
                  onSettingsPatch({
                    form_width: form_width as FormSettings["form_width"],
                  })
                }
              />
              <JoySelect
                label="Columns"
                value={String(settings.columns ?? 1)}
                options={[
                  { value: "1", label: "Single column" },
                  { value: "2", label: "Two columns" },
                ]}
                onValueChange={(columns) =>
                  onSettingsPatch({ columns: columns === "2" ? 2 : 1 })
                }
              />
              <JoySelect
                label="Font family"
                value={settings.theme.font_family ?? "inter"}
                options={FORM_FONT_FAMILY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onValueChange={(font_family) => onThemePatch({ font_family })}
              />
              <JoySelect
                label="Border radius"
                value={settings.theme.border_radius ?? "8px"}
                options={FORM_BORDER_RADIUS_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onValueChange={(border_radius) =>
                  onThemePatch({ border_radius })
                }
              />
              <JoySelect
                label="Spacing"
                value={settings.theme.spacing ?? "normal"}
                options={FORM_SPACING_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onValueChange={(spacing) => onThemePatch({ spacing })}
              />
              <JoyInput
                label="Primary color"
                value={settings.theme.primary_color ?? ""}
                onValueChange={(primary_color) =>
                  onThemePatch({ primary_color })
                }
              />
            </Box>
          </Stack>
        </JoyTabsContent>

        <JoyTabsContent value="submit">
          <Stack spacing={2}>
            <JoyInput
              label="Submit button text"
              value={settings.submit_button_text}
              onValueChange={(submit_button_text) =>
                onSettingsPatch({ submit_button_text })
              }
            />

            <Stack spacing={0.5}>
              <Typography
                level="body-xs"
                sx={{ fontWeight: 600, color: "neutral.600" }}
              >
                Success message
              </Typography>
              <Textarea
                minRows={3}
                value={settings.success_message}
                onChange={(event) =>
                  onSettingsPatch({ success_message: event.target.value })
                }
                placeholder="What visitors see after submitting"
              />
            </Stack>

            <JoyInput
              label="Redirect URL"
              value={settings.success_redirect_url ?? ""}
              onValueChange={(success_redirect_url) =>
                onSettingsPatch({
                  success_redirect_url: success_redirect_url || null,
                })
              }
              helperText="Leave blank to show the in-form success state instead."
            />

            <Divider />

            <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
              <Typography level="body-sm" color="neutral">
                Field-level editing stays inline on the canvas. This drawer only
                controls settings that apply to the whole form.
              </Typography>
            </Sheet>
          </Stack>
        </JoyTabsContent>
      </JoyTabs>
    </JoyDrawer>
  );
}
