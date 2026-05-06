import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import {
  Copy,
  Edit3,
  MoreVertical,
  MoveRight,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuLabel,
  JoyDropdownMenuSeparator,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import {
  type FormBuilderTokens,
} from "@/components/forms/build/formBuilderTokens";
import {
  FormFieldPreview,
} from "@/components/forms/build/FormFieldPreview";
import { getFieldDefinition } from "@/lib/forms/fieldRegistry";
import type {
  FormCompliance,
  FormField,
  FormSettings,
  FormStep,
} from "@/types/formBuilder";

interface FormFieldItemProps {
  field: FormField;
  fields: FormField[];
  steps: FormStep[];
  settings: FormSettings;
  compliance: FormCompliance;
  tokens: FormBuilderTokens;
  multiStepEnabled: boolean;
  isDragging: boolean;
  isSelected: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onSelect: () => void;
  onFieldChange: (updates: Partial<FormField>) => void;
  onComplianceChange: (updates: Partial<FormCompliance>) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMoveToStep: (stepIndex: number) => void;
  onToggleRequired: () => void;
  onDelete: () => void;
}

export function FormFieldItem({
  field,
  fields,
  steps,
  settings,
  compliance,
  tokens,
  multiStepEnabled,
  isDragging,
  isSelected,
  dragHandleProps,
  onSelect,
  onFieldChange,
  onComplianceChange,
  onEdit,
  onDuplicate,
  onMoveToStep,
  onToggleRequired,
  onDelete,
}: FormFieldItemProps) {
  const definition = getFieldDefinition(field.type);
  const Icon = definition.icon;
  const moveableSteps = multiStepEnabled
    ? steps.filter((step) => step.index !== (field.step_index ?? 0))
    : [];

  return (
    <Sheet
      data-field-item="true"
      variant="plain"
      onClick={onSelect}
      sx={{
        borderRadius: "lg",
        border: "1px solid",
        borderColor: isSelected ? "primary.400" : "neutral.200",
        backgroundColor: isSelected ? "primary.softBg" : "background.surface",
        px: { xs: 1, md: 1.25 },
        py: { xs: 1, md: 1.25 },
        cursor: "pointer",
        transition:
          "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease",
        boxShadow: isDragging
          ? "var(--joy-shadow-lg)"
          : isSelected
            ? "0 0 0 1px rgba(var(--joy-palette-primary-mainChannel) / 0.2)"
            : "var(--joy-shadow-xs)",
        transform: isDragging ? "translateY(-2px)" : "translateY(0)",
        opacity: isDragging ? 0.92 : 1,
        "&:hover": {
          borderColor: isSelected ? "primary.500" : "neutral.300",
          boxShadow: "var(--joy-shadow-md)",
          transform: "translateY(-1px)",
        },
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.25} alignItems="stretch">
          <Box
            data-builder-handle="true"
            {...dragHandleProps}
            onClick={(event) => event.stopPropagation()}
            sx={{
              width: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              cursor: "grab",
              flexShrink: 0,
              color: isSelected ? "primary.600" : "neutral.400",
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: 4,
                bottom: 4,
                width: 2,
                borderRadius: 999,
                backgroundColor: isSelected ? "primary.400" : "neutral.200",
              },
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 4px)",
                gridTemplateRows: "repeat(3, 4px)",
                gap: 0.5,
                pl: 1,
              }}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: "currentColor",
                  }}
                />
              ))}
            </Box>
          </Box>

          <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "md",
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: isSelected ? "primary.softHoverBg" : "neutral.100",
                  color: isSelected ? "primary.600" : "neutral.600",
                  flexShrink: 0,
                }}
              >
                <Icon size={16} />
              </Box>

              <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Typography
                    level="body-sm"
                    sx={{ fontWeight: 700, minWidth: 0 }}
                  >
                    {field.label || definition.defaultLabel}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <JoyChip size="sm" variant="soft" color="neutral">
                    {definition.label}
                  </JoyChip>
                  {field.required ? (
                    <JoyChip size="sm" variant="soft" color="danger">
                      Required
                    </JoyChip>
                  ) : null}
                  <Typography
                    level="body-xs"
                    sx={{
                      color: tokens.mutedTextColor,
                      fontFamily:
                        'var(--joy-fontFamily-code, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)',
                    }}
                  >
                    {field.mapping_key}
                  </Typography>
                </Stack>
              </Stack>

              <Box
                data-builder-actions="true"
                onClick={(event) => event.stopPropagation()}
                sx={{ flexShrink: 0 }}
              >
                <JoyDropdownMenu>
                  <JoyDropdownMenuTrigger aria-label="Field actions">
                    <MoreVertical size={16} />
                  </JoyDropdownMenuTrigger>
                  <JoyDropdownMenuContent>
                    <JoyDropdownMenuItem
                      startDecorator={<Edit3 size={16} />}
                      onClick={onEdit}
                    >
                      Edit
                    </JoyDropdownMenuItem>
                    <JoyDropdownMenuItem
                      startDecorator={<Copy size={16} />}
                      onClick={onDuplicate}
                    >
                      Duplicate
                    </JoyDropdownMenuItem>

                    {multiStepEnabled ? (
                      <>
                        <JoyDropdownMenuSeparator />
                        <JoyDropdownMenuLabel>Move to Step</JoyDropdownMenuLabel>
                        {moveableSteps.map((step) => (
                          <JoyDropdownMenuItem
                            key={`move-${field.id}-${step.index}`}
                            startDecorator={<MoveRight size={16} />}
                            onClick={() => onMoveToStep(step.index)}
                          >
                            {step.title || `Step ${step.index + 1}`}
                          </JoyDropdownMenuItem>
                        ))}
                      </>
                    ) : null}

                    <JoyDropdownMenuSeparator />

                    <JoyDropdownMenuItem
                      startDecorator={<ShieldAlert size={16} />}
                      onClick={onToggleRequired}
                    >
                      {field.required ? "Make optional" : "Mark required"}
                    </JoyDropdownMenuItem>
                    <JoyDropdownMenuItem
                      destructive
                      startDecorator={<Trash2 size={16} />}
                      onClick={onDelete}
                    >
                      Delete
                    </JoyDropdownMenuItem>
                  </JoyDropdownMenuContent>
                </JoyDropdownMenu>
              </Box>
            </Stack>

            <Divider sx={{ my: 0.25 }} />

            <Box sx={{ minWidth: 0, pl: { xs: 0, sm: 0.25 } }}>
              <FormFieldPreview
                compact
                field={field}
                compliance={compliance}
                settings={settings}
                tokens={tokens}
              />
            </Box>
          </Stack>
        </Stack>
      </Stack>
    </Sheet>
  );
}
