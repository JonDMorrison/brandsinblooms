import * as React from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Typography from "@mui/joy/Typography";
import { GripVertical, Plus, Settings2, Trash2 } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
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
  fieldCountsByStep: Record<number, number>;
  multiStepEnabled: boolean;
  currentStepIndex: number;
  onFocusStep: (stepIndex: number) => void;
  onToggleMultiStep: (enabled: boolean) => void;
  onAddStep: () => void;
  onRemoveStep: (stepIndex: number) => void;
  onReorderSteps: (sourceIndex: number, destinationIndex: number) => void;
  onUpdateStep: (stepIndex: number, updates: Partial<FormStep>) => void;
  onSettingsPatch: (patch: Partial<FormSettings>) => void;
  onThemePatch: (patch: Partial<FormSettings["theme"]>) => void;
}

function DrawerSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
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
        <Box>
          <Typography level="title-sm" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography level="body-xs" color="neutral">
            {description}
          </Typography>
        </Box>
        {children}
      </Stack>
    </Sheet>
  );
}

function StepCard({
  step,
  index,
  fieldCount,
  isActive,
  canDelete,
  onFocusStep,
  onRemoveStep,
  onUpdateStep,
  dragHandleProps,
  draggableProps,
  innerRef,
  isDragging,
}: {
  step: FormStep;
  index: number;
  fieldCount: number;
  isActive: boolean;
  canDelete: boolean;
  onFocusStep: (stepIndex: number) => void;
  onRemoveStep: (stepIndex: number) => void;
  onUpdateStep: (stepIndex: number, updates: Partial<FormStep>) => void;
  dragHandleProps?: Record<string, unknown>;
  draggableProps?: Record<string, unknown>;
  innerRef?: (element: HTMLElement | null) => void;
  isDragging: boolean;
}) {
  return (
    <Sheet
      ref={innerRef}
      variant="plain"
      {...draggableProps}
      sx={{
        borderRadius: "lg",
        border: "1px solid",
        borderColor: isActive ? "primary.300" : "neutral.200",
        backgroundColor: isActive ? "primary.softBg" : "background.surface",
        boxShadow: isDragging ? "var(--joy-shadow-md)" : "var(--joy-shadow-xs)",
        p: 1.25,
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            {...dragHandleProps}
            sx={{
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              borderRadius: "md",
              color: "neutral.500",
              cursor: "grab",
              flexShrink: 0,
            }}
          >
            <GripVertical size={16} />
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <JoyChip
              size="sm"
              variant={isActive ? "solid" : "soft"}
              color={isActive ? "primary" : "neutral"}
            >
              Step {index + 1}
            </JoyChip>
            <JoyChip size="sm" variant="soft" color="neutral">
              {fieldCount} fields
            </JoyChip>
          </Stack>

          <JoyButton
            size="sm"
            bloomVariant="ghost"
            color="neutral"
            onClick={() => onFocusStep(step.index)}
          >
            Open
          </JoyButton>

          <IconButton
            size="sm"
            variant="plain"
            color="danger"
            disabled={!canDelete}
            onClick={() => onRemoveStep(step.index)}
            aria-label={`Delete step ${index + 1}`}
          >
            <Trash2 size={16} />
          </IconButton>
        </Stack>

        <JoyInput
          label="Step title"
          value={step.title}
          onValueChange={(title) => onUpdateStep(step.index, { title })}
          placeholder={`Step ${index + 1}`}
        />

        <Box>
          <Typography level="body-xs" sx={{ fontWeight: 600, color: "neutral.600", mb: 0.5 }}>
            Step description
          </Typography>
          <Textarea
            minRows={2}
            value={step.description}
            onChange={(event) =>
              onUpdateStep(step.index, { description: event.target.value })
            }
            placeholder="Optional context for this step"
            sx={{ borderRadius: "lg", backgroundColor: "#FFFFFF" }}
          />
        </Box>
      </Stack>
    </Sheet>
  );
}

function isValidRedirectUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function FormBuilderSettingsDrawer({
  open,
  onClose,
  settings,
  steps,
  fieldCountsByStep,
  multiStepEnabled,
  currentStepIndex,
  onFocusStep,
  onToggleMultiStep,
  onAddStep,
  onRemoveStep,
  onReorderSteps,
  onUpdateStep,
  onSettingsPatch,
  onThemePatch,
}: FormBuilderSettingsDrawerProps) {
  const redirectUrl = settings.success_redirect_url ?? "";
  const redirectUrlError =
    redirectUrl.trim().length > 0 && !isValidRedirectUrl(redirectUrl)
      ? "Enter a full http:// or https:// URL, or leave this blank."
      : undefined;

  const handleStepDragEnd = React.useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      if (result.destination.index === result.source.index) {
        return;
      }

      onReorderSteps(result.source.index, result.destination.index);
    },
    [onReorderSteps],
  );

  return (
    <JoyDrawer
      open={open}
      onClose={onClose}
      anchor="right"
      size="lg"
      title="Form settings"
      description="Adjust structure, layout, and submission behavior without leaving the builder."
      startDecorator={<Settings2 size={18} />}
      contentSx={{ display: "grid", gap: 1.5, alignContent: "start" }}
    >
      <DrawerSection
        title="Structure"
        description="Manage step flow, order, and visitor guidance for the full form."
      >
        <Sheet
          variant="soft"
          color={multiStepEnabled ? "primary" : "neutral"}
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
              Multi-step form
            </Typography>
            <Typography level="body-xs" color="neutral">
              Break longer forms into guided steps while keeping the build tab and preview in sync.
            </Typography>
          </Box>
          <Switch
            checked={multiStepEnabled}
            onChange={(event) => onToggleMultiStep(event.target.checked)}
            size="sm"
          />
        </Sheet>

        {multiStepEnabled ? (
          <Stack spacing={1.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  Step list
                </Typography>
                <Typography level="body-xs" color="neutral">
                  Drag to reorder. Step tabs and field assignments update automatically.
                </Typography>
              </Box>
              <JoyButton
                size="sm"
                variant="outlined"
                color="neutral"
                startDecorator={<Plus size={16} />}
                onClick={onAddStep}
              >
                Add step
              </JoyButton>
            </Stack>

            <DragDropContext onDragEnd={handleStepDragEnd}>
              <Droppable droppableId="form-builder-settings-steps">
                {(provided) => (
                  <Stack
                    spacing={1}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {steps.map((step, index) => (
                      <Draggable
                        key={`drawer-step-${step.index}`}
                        draggableId={`drawer-step-${step.index}`}
                        index={index}
                      >
                        {(draggableProvided, snapshot) => (
                          <StepCard
                            step={step}
                            index={index}
                            fieldCount={fieldCountsByStep[step.index] ?? 0}
                            isActive={currentStepIndex === step.index}
                            canDelete={steps.length > 1}
                            onFocusStep={onFocusStep}
                            onRemoveStep={onRemoveStep}
                            onUpdateStep={onUpdateStep}
                            dragHandleProps={draggableProvided.dragHandleProps}
                            draggableProps={draggableProvided.draggableProps}
                            innerRef={draggableProvided.innerRef}
                            isDragging={snapshot.isDragging}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Stack>
                )}
              </Droppable>
            </DragDropContext>
          </Stack>
        ) : (
          <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", px: 1.25, py: 1 }}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Single-step mode is active
            </Typography>
            <Typography level="body-xs" color="neutral">
              Visitors see one continuous canvas. Turn multi-step back on whenever the form needs guided flow.
            </Typography>
          </Sheet>
        )}
      </DrawerSection>

      <DrawerSection
        title="Layout"
        description="Set the overall container, spacing, and styling applied across the form."
      >
        <Stack spacing={1.5}>
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

          <Box>
            <Typography level="body-xs" sx={{ fontWeight: 600, color: "neutral.600", mb: 0.75 }}>
              Columns
            </Typography>
            <ToggleButtonGroup
              size="sm"
              value={String(settings.columns ?? 1)}
              onChange={(_event, value) => {
                if (!value || value === "3") {
                  return;
                }

                onSettingsPatch({ columns: value === "2" ? 2 : 1 });
              }}
              sx={{
                borderRadius: "lg",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.surface",
              }}
            >
              <Button
                value="1"
                variant={(settings.columns ?? 1) === 1 ? "solid" : "plain"}
                color={(settings.columns ?? 1) === 1 ? "primary" : "neutral"}
              >
                1 column
              </Button>
              <Button
                value="2"
                variant={settings.columns === 2 ? "solid" : "plain"}
                color={settings.columns === 2 ? "primary" : "neutral"}
              >
                2 columns
              </Button>
              <Button value="3" disabled variant="plain" color="neutral">
                3 columns
              </Button>
            </ToggleButtonGroup>
            <Typography level="body-xs" color="neutral" sx={{ mt: 0.75 }}>
              The current preview renderer supports one or two columns.
            </Typography>
          </Box>

          <Box>
            <Typography level="body-xs" sx={{ fontWeight: 600, color: "neutral.600", mb: 0.75 }}>
              Label position
            </Typography>
            <ToggleButtonGroup
              size="sm"
              value="top"
              sx={{
                borderRadius: "lg",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.surface",
              }}
            >
              <Button value="top" variant="solid" color="primary">
                Top
              </Button>
              <Button value="left" disabled variant="plain" color="neutral">
                Left
              </Button>
              <Button value="inline" disabled variant="plain" color="neutral">
                Inline
              </Button>
            </ToggleButtonGroup>
            <Typography level="body-xs" color="neutral" sx={{ mt: 0.75 }}>
              The live renderer still treats labels as top-aligned, so left and inline layouts remain unavailable here.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
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
              onValueChange={(border_radius) => onThemePatch({ border_radius })}
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
              onValueChange={(primary_color) => onThemePatch({ primary_color })}
              placeholder="#16A34A"
            />
          </Box>
        </Stack>
      </DrawerSection>

      <DrawerSection
        title="Submission"
        description="Control what visitors see and where they land after they complete the form."
      >
        <Stack spacing={1.5}>
          <JoyInput
            label="Submit button text"
            value={settings.submit_button_text}
            onValueChange={(submit_button_text) =>
              onSettingsPatch({ submit_button_text })
            }
            placeholder="Submit"
          />

          <Box>
            <Typography level="body-xs" sx={{ fontWeight: 600, color: "neutral.600", mb: 0.5 }}>
              Success message
            </Typography>
            <Textarea
              minRows={3}
              value={settings.success_message}
              onChange={(event) =>
                onSettingsPatch({ success_message: event.target.value })
              }
              placeholder="Thanks for reaching out. We’ll be in touch shortly."
              sx={{ borderRadius: "lg", backgroundColor: "#FFFFFF" }}
            />
          </Box>

          <JoyInput
            label="Redirect URL"
            value={redirectUrl}
            onValueChange={(success_redirect_url) =>
              onSettingsPatch({
                success_redirect_url: success_redirect_url.trim() || null,
              })
            }
            placeholder="https://yourdomain.com/thanks"
            errorMessage={redirectUrlError}
            helperText="Leave blank to keep visitors on the in-form success state."
          />
        </Stack>
      </DrawerSection>
    </JoyDrawer>
  );
}