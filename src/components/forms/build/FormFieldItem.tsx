import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { Copy, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuSeparator,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { InlineFieldEditor } from "@/components/forms/build/InlineFieldEditor";
import {
  FormFieldPreview,
  type FormBuilderTokens,
} from "@/components/forms/build/FormFieldPreview";
import { getAvailableConditionSourceFields } from "@/lib/forms/formFlow";
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
  onDuplicate: () => void;
  onDelete: () => void;
  onAddVisibilityRule: () => void;
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
  onDuplicate,
  onDelete,
  onAddVisibilityRule,
}: FormFieldItemProps) {
  const definition = getFieldDefinition(field.type);
  const canAddVisibilityRule =
    getAvailableConditionSourceFields(fields, field.id, steps).length > 0;

  return (
    <Sheet
      data-field-item="true"
      variant="plain"
      onClick={onSelect}
      sx={{
        borderRadius: "xl",
        border: "1px solid",
        borderColor: isSelected ? "primary.400" : "neutral.200",
        backgroundColor: isSelected ? tokens.hoverTint : "background.surface",
        px: { xs: 1.25, md: 1.5 },
        py: { xs: 1.25, md: 1.5 },
        cursor: "pointer",
        transition:
          "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease",
        boxShadow: isDragging
          ? "var(--joy-shadow-md)"
          : isSelected
            ? `0 0 0 2px ${tokens.hoverTint}`
            : "none",
        transform: isDragging ? "translateY(-2px)" : "translateY(0)",
        "& [data-builder-handle='true'], & [data-builder-actions='true']": {
          opacity: isSelected ? 1 : 0,
          transition: "opacity 150ms ease",
        },
        "&:hover": {
          borderColor: isSelected ? "primary.500" : "neutral.300",
          boxShadow: "var(--joy-shadow-sm)",
          transform: "translateY(-1px)",
        },
        "&:hover [data-builder-handle='true'], &:hover [data-builder-actions='true']":
          {
            opacity: 1,
          },
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box
            data-builder-handle="true"
            {...dragHandleProps}
            onClick={(event) => event.stopPropagation()}
            sx={{
              width: 26,
              height: 26,
              display: "grid",
              placeItems: "center",
              borderRadius: "999px",
              color: "neutral.400",
              backgroundColor: "neutral.100",
              cursor: "grab",
              flexShrink: 0,
            }}
          >
            <GripVertical size={15} />
          </Box>

          <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              <Typography
                level="title-sm"
                sx={{ fontWeight: 700, minWidth: 0 }}
              >
                {field.label || definition.defaultLabel}
              </Typography>
              <JoyChip size="sm" variant="soft" color="neutral">
                {definition.label}
              </JoyChip>
              {field.required ? (
                <JoyChip size="sm" variant="soft" color="warning">
                  Required
                </JoyChip>
              ) : null}
              {(field.visibility_rules?.length ?? 0) > 0 ? (
                <JoyChip size="sm" variant="soft" color="primary">
                  {field.visibility_rules?.length} visibility
                </JoyChip>
              ) : null}
            </Stack>
            <Typography level="body-xs" color="neutral">
              {field.mapping_key}
            </Typography>
          </Stack>

          <Box
            data-builder-actions="true"
            onClick={(event) => event.stopPropagation()}
            sx={{ flexShrink: 0 }}
          >
            <JoyDropdownMenu>
              <JoyDropdownMenuTrigger>
                <MoreHorizontal size={16} />
              </JoyDropdownMenuTrigger>
              <JoyDropdownMenuContent>
                <JoyDropdownMenuItem
                  startDecorator={<Copy size={16} />}
                  onClick={onDuplicate}
                >
                  Duplicate
                </JoyDropdownMenuItem>
                <JoyDropdownMenuItem
                  startDecorator={<Plus size={16} />}
                  disabled={!canAddVisibilityRule}
                  onClick={() => {
                    onSelect();
                    onAddVisibilityRule();
                  }}
                >
                  Add visibility rule
                </JoyDropdownMenuItem>
                <JoyDropdownMenuSeparator />
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

        <FormFieldPreview
          field={field}
          compliance={compliance}
          settings={settings}
          tokens={tokens}
        />

        <Box
          sx={{
            overflow: "hidden",
            maxHeight: isSelected ? 1200 : 0,
            opacity: isSelected ? 1 : 0,
            transition: "max-height 220ms ease, opacity 180ms ease",
          }}
        >
          {isSelected ? (
            <InlineFieldEditor
              field={field}
              fields={fields}
              steps={steps}
              compliance={compliance}
              multiStepEnabled={multiStepEnabled}
              onFieldChange={onFieldChange}
              onComplianceChange={onComplianceChange}
            />
          ) : null}
        </Box>
      </Stack>
    </Sheet>
  );
}
