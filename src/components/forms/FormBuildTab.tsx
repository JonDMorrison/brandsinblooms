import * as React from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  GripVertical,
  LayoutTemplate,
  Redo2,
  Settings2,
  Undo2,
} from "lucide-react";
import { FormBuilderSettingsDrawer } from "@/components/forms/build/FormBuilderSettingsDrawer";
import { FieldTypePickerMenu } from "@/components/forms/build/FieldTypePickerMenu";
import { FormFieldItem } from "@/components/forms/build/FormFieldItem";
import { createFormBuilderTokens } from "@/components/forms/build/FormFieldPreview";
import { FormTemplatesDialog } from "@/components/forms/FormTemplatesDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { useToast } from "@/hooks/use-toast";
import {
  createDefaultFormStep,
  getAvailableConditionSourceFields,
  getEditableFormSteps,
  groupFieldsByStep,
  isMultiStepEnabled,
  normalizeFieldStepIndex,
  reindexFormSteps,
} from "@/lib/forms/formFlow";
import type { PublishValidationIssue } from "@/lib/forms/publish";
import type {
  FormCompliance,
  FormField,
  FormSettings,
  FormStep,
} from "@/types/formBuilder";

interface FormBuildTabProps {
  fields: FormField[];
  updateFields: (fields: FormField[]) => void;
  settings: FormSettings;
  updateSettings: (settings: FormSettings) => void;
  compliance: FormCompliance;
  updateCompliance: (compliance: FormCompliance) => void;
  onApplyTemplate?: (templateData: {
    name: string;
    fields_json?: FormField[];
    settings_json?: FormSettings;
    compliance_json?: FormCompliance;
  }) => void;
  publishValidationIssue?: PublishValidationIssue | null;
}

interface BuilderSnapshot {
  fields: FormField[];
  settings: FormSettings;
  compliance: FormCompliance;
}

const MAX_HISTORY_ENTRIES = 50;
const STEP_DROPPABLE_ID = "builder-steps";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSnapshot(
  fields: FormField[],
  settings: FormSettings,
  compliance: FormCompliance,
): BuilderSnapshot {
  return cloneJson({ fields, settings, compliance });
}

function serializeSnapshot(snapshot: BuilderSnapshot) {
  return JSON.stringify(snapshot);
}

function removeStepIndex(field: FormField): FormField {
  const nextField = { ...field };
  delete nextField.step_index;
  return nextField;
}

function isTypingElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;

  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.getAttribute("role") === "textbox"
  );
}

function buildDuplicateField(field: FormField): FormField {
  const duplicated = cloneJson(field);

  duplicated.id = crypto.randomUUID();
  duplicated.label = `${field.label} Copy`;
  duplicated.mapping_key =
    field.mapping_key === "email" || field.mapping_key === "phone"
      ? field.mapping_key
      : `${field.mapping_key}_${Math.random().toString(36).slice(2, 6)}`;

  return duplicated;
}

function InsertionZone({
  fields,
  compliance,
  onAddField,
}: {
  fields: FormField[];
  compliance: FormCompliance;
  onAddField: (field: FormField) => void;
}) {
  return (
    <Box
      sx={{
        py: 0.75,
        opacity: 0,
        transition: "opacity 150ms ease",
        "&:hover": {
          opacity: 1,
        },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Divider sx={{ flex: 1 }} />
        <FieldTypePickerMenu
          compact
          fields={fields}
          compliance={compliance}
          onAddField={onAddField}
        />
        <Divider sx={{ flex: 1 }} />
      </Stack>
    </Box>
  );
}

export function FormBuildTab({
  fields,
  updateFields,
  settings,
  updateSettings,
  compliance,
  updateCompliance,
  onApplyTemplate,
  publishValidationIssue,
}: FormBuildTabProps) {
  const { toast } = useToast();
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [focusedStepIndex, setFocusedStepIndex] = React.useState(0);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(
    null,
  );
  const [historyCounts, setHistoryCounts] = React.useState({
    undo: 0,
    redo: 0,
  });
  const builderRootRef = React.useRef<HTMLDivElement | null>(null);
  const historyRef = React.useRef<BuilderSnapshot[]>([]);
  const futureRef = React.useRef<BuilderSnapshot[]>([]);

  const multiStepEnabled = isMultiStepEnabled(settings);
  const steps = React.useMemo(
    () => getEditableFormSteps(fields, settings),
    [fields, settings],
  );
  const stepGroups = React.useMemo(
    () => groupFieldsByStep(fields, steps),
    [fields, steps],
  );
  const currentStepGroup = React.useMemo(
    () =>
      stepGroups.find((group) => group.step.index === focusedStepIndex) ??
      stepGroups[0] ?? {
        step: createDefaultFormStep(0),
        fields: [],
      },
    [focusedStepIndex, stepGroups],
  );
  const canvasFields = multiStepEnabled ? currentStepGroup.fields : fields;
  const tokens = React.useMemo(
    () => createFormBuilderTokens(settings),
    [settings],
  );
  const activeBuildIssue =
    publishValidationIssue?.targetTab === "build"
      ? publishValidationIssue
      : null;
  const configuredStepCount = multiStepEnabled ? steps.length : 1;

  const syncHistoryCounts = React.useCallback(() => {
    setHistoryCounts({
      undo: historyRef.current.length,
      redo: futureRef.current.length,
    });
  }, []);

  const getCurrentSnapshot = React.useCallback(
    () => createSnapshot(fields, settings, compliance),
    [fields, settings, compliance],
  );

  const applySnapshot = React.useCallback(
    (snapshot: BuilderSnapshot) => {
      updateFields(snapshot.fields);
      updateSettings(snapshot.settings);
      updateCompliance(snapshot.compliance);
    },
    [updateCompliance, updateFields, updateSettings],
  );

  const commitSnapshot = React.useCallback(
    (
      nextSnapshot: BuilderSnapshot,
      afterApply?: (snapshot: BuilderSnapshot) => void,
    ) => {
      const currentSnapshot = getCurrentSnapshot();

      if (
        serializeSnapshot(currentSnapshot) === serializeSnapshot(nextSnapshot)
      ) {
        return false;
      }

      historyRef.current.push(currentSnapshot);
      if (historyRef.current.length > MAX_HISTORY_ENTRIES) {
        historyRef.current.shift();
      }
      futureRef.current = [];
      syncHistoryCounts();
      applySnapshot(cloneJson(nextSnapshot));
      afterApply?.(nextSnapshot);
      return true;
    },
    [applySnapshot, getCurrentSnapshot, syncHistoryCounts],
  );

  const commitChange = React.useCallback(
    (
      recipe: (draft: BuilderSnapshot) => void,
      afterApply?: (snapshot: BuilderSnapshot) => void,
    ) => {
      const nextSnapshot = getCurrentSnapshot();
      recipe(nextSnapshot);
      return commitSnapshot(nextSnapshot, afterApply);
    },
    [commitSnapshot, getCurrentSnapshot],
  );

  React.useEffect(() => {
    if (steps.some((step) => step.index === focusedStepIndex)) {
      return;
    }

    setFocusedStepIndex(steps[0]?.index ?? 0);
  }, [focusedStepIndex, steps]);

  React.useEffect(() => {
    if (
      selectedFieldId &&
      canvasFields.some((field) => field.id === selectedFieldId)
    ) {
      return;
    }

    setSelectedFieldId(null);
  }, [canvasFields, selectedFieldId]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        builderRootRef.current &&
        builderRootRef.current.contains(event.target as Node)
      ) {
        return;
      }

      setSelectedFieldId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleUndo = React.useCallback(() => {
    const previousSnapshot = historyRef.current.pop();
    if (!previousSnapshot) {
      return;
    }

    futureRef.current.push(getCurrentSnapshot());
    syncHistoryCounts();
    applySnapshot(previousSnapshot);
    setSelectedFieldId((current) =>
      current && previousSnapshot.fields.some((field) => field.id === current)
        ? current
        : (previousSnapshot.fields[0]?.id ?? null),
    );
  }, [applySnapshot, getCurrentSnapshot, syncHistoryCounts]);

  const handleRedo = React.useCallback(() => {
    const nextSnapshot = futureRef.current.pop();
    if (!nextSnapshot) {
      return;
    }

    historyRef.current.push(getCurrentSnapshot());
    syncHistoryCounts();
    applySnapshot(nextSnapshot);
    setSelectedFieldId((current) =>
      current && nextSnapshot.fields.some((field) => field.id === current)
        ? current
        : (nextSnapshot.fields[0]?.id ?? null),
    );
  }, [applySnapshot, getCurrentSnapshot, syncHistoryCounts]);

  const handleSettingsPatch = React.useCallback(
    (patch: Partial<FormSettings>) => {
      commitChange((draft) => {
        draft.settings = {
          ...draft.settings,
          ...patch,
        };
      });
    },
    [commitChange],
  );

  const handleThemePatch = React.useCallback(
    (patch: Partial<FormSettings["theme"]>) => {
      commitChange((draft) => {
        draft.settings = {
          ...draft.settings,
          theme: {
            ...draft.settings.theme,
            ...patch,
          },
        };
      });
    },
    [commitChange],
  );

  const getInsertIndex = React.useCallback(
    (stepIndex: number, stepInsertionIndex: number) => {
      if (!multiStepEnabled) {
        return stepInsertionIndex;
      }

      const targetGroup = stepGroups.find(
        (group) => group.step.index === stepIndex,
      );
      if (!targetGroup) {
        return fields.length;
      }

      if (targetGroup.fields.length === 0) {
        const nextStepFieldIndex = fields.findIndex(
          (field) => normalizeFieldStepIndex(field) > stepIndex,
        );
        return nextStepFieldIndex === -1 ? fields.length : nextStepFieldIndex;
      }

      if (stepInsertionIndex >= targetGroup.fields.length) {
        const lastFieldId =
          targetGroup.fields[targetGroup.fields.length - 1]?.id;
        const lastFieldIndex = fields.findIndex(
          (field) => field.id === lastFieldId,
        );
        return lastFieldIndex === -1 ? fields.length : lastFieldIndex + 1;
      }

      const beforeFieldId = targetGroup.fields[stepInsertionIndex]?.id;
      const beforeFieldIndex = fields.findIndex(
        (field) => field.id === beforeFieldId,
      );

      return beforeFieldIndex === -1 ? fields.length : beforeFieldIndex;
    },
    [fields, multiStepEnabled, stepGroups],
  );

  const handleAddFieldAt = React.useCallback(
    (field: FormField, insertionIndex: number, stepIndex: number) => {
      const nextField = multiStepEnabled
        ? { ...field, step_index: stepIndex }
        : removeStepIndex(field);
      const overallInsertIndex = getInsertIndex(stepIndex, insertionIndex);

      commitChange(
        (draft) => {
          draft.fields.splice(overallInsertIndex, 0, nextField);
        },
        () => {
          setFocusedStepIndex(stepIndex);
          setSelectedFieldId(nextField.id);
        },
      );
    },
    [commitChange, getInsertIndex, multiStepEnabled],
  );

  const handleUpdateField = React.useCallback(
    (fieldId: string, updates: Partial<FormField>) => {
      commitChange((draft) => {
        draft.fields = draft.fields.map((field) =>
          field.id === fieldId ? { ...field, ...updates } : field,
        );
      });
    },
    [commitChange],
  );

  const handleCompliancePatch = React.useCallback(
    (updates: Partial<FormCompliance>) => {
      commitChange((draft) => {
        draft.compliance = {
          ...draft.compliance,
          ...updates,
        };
      });
    },
    [commitChange],
  );

  const handleDuplicateField = React.useCallback(
    (fieldId: string) => {
      const sourceField = fields.find((field) => field.id === fieldId);
      if (!sourceField) {
        return;
      }

      const duplicatedField = buildDuplicateField(sourceField);
      const sourceIndex = fields.findIndex((field) => field.id === fieldId);

      commitChange(
        (draft) => {
          draft.fields.splice(sourceIndex + 1, 0, duplicatedField);
        },
        () => {
          setFocusedStepIndex(normalizeFieldStepIndex(sourceField));
          setSelectedFieldId(duplicatedField.id);
        },
      );
    },
    [commitChange, fields],
  );

  const handleDeleteField = React.useCallback(
    (fieldId: string) => {
      const field = fields.find((item) => item.id === fieldId);
      if (!field) {
        return;
      }

      const restoreField = cloneJson(field);
      const fieldIndex = fields.findIndex((item) => item.id === fieldId);
      const restoreStepIndex = normalizeFieldStepIndex(field);

      commitChange(
        (draft) => {
          draft.fields = draft.fields.filter((item) => item.id !== fieldId);
        },
        () => {
          if (selectedFieldId === fieldId) {
            setSelectedFieldId(null);
          }
        },
      );

      toast({
        title: "Field deleted",
        description: `${field.label} was removed from the form.`,
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            commitChange(
              (draft) => {
                draft.fields.splice(fieldIndex, 0, restoreField);
              },
              () => {
                setFocusedStepIndex(restoreStepIndex);
                setSelectedFieldId(restoreField.id);
              },
            );
          },
        },
      });
    },
    [commitChange, fields, selectedFieldId, toast],
  );

  const handleAddVisibilityRule = React.useCallback(
    (fieldId: string) => {
      commitChange((draft) => {
        const draftSteps = getEditableFormSteps(draft.fields, draft.settings);
        const availableFields = getAvailableConditionSourceFields(
          draft.fields,
          fieldId,
          draftSteps,
        );
        const firstAvailableField = availableFields[0];
        if (!firstAvailableField) {
          return;
        }

        draft.fields = draft.fields.map((field) => {
          if (field.id !== fieldId) {
            return field;
          }

          return {
            ...field,
            visibility_rules: [
              ...(field.visibility_rules ?? []),
              {
                field_id: firstAvailableField.id,
                operator: "equals",
                value: "",
              },
            ],
          };
        });
      });
    },
    [commitChange],
  );

  const handleToggleMultiStep = React.useCallback(
    (enabled: boolean) => {
      commitChange(
        (draft) => {
          if (enabled) {
            draft.settings = {
              ...draft.settings,
              steps: reindexFormSteps([
                createDefaultFormStep(0),
                createDefaultFormStep(1),
              ]),
            };
            draft.fields = draft.fields.map((field) => ({
              ...field,
              step_index: normalizeFieldStepIndex(field),
            }));
            return;
          }

          draft.settings = {
            ...draft.settings,
            steps: [],
          };
          draft.fields = draft.fields.map(removeStepIndex);
        },
        () => {
          setFocusedStepIndex(0);
          setSelectedFieldId(null);
        },
      );
    },
    [commitChange],
  );

  const handleAddStep = React.useCallback(() => {
    commitChange(
      (draft) => {
        const draftSteps = getEditableFormSteps(draft.fields, draft.settings);
        draft.settings = {
          ...draft.settings,
          steps: reindexFormSteps([
            ...draftSteps,
            createDefaultFormStep(draftSteps.length),
          ]),
        };
      },
      (snapshot) => {
        const nextSteps = getEditableFormSteps(
          snapshot.fields,
          snapshot.settings,
        );
        setFocusedStepIndex(nextSteps[nextSteps.length - 1]?.index ?? 0);
      },
    );
  }, [commitChange]);

  const handleUpdateStep = React.useCallback(
    (stepIndex: number, updates: Partial<FormStep>) => {
      commitChange((draft) => {
        const draftSteps = getEditableFormSteps(draft.fields, draft.settings);
        draft.settings = {
          ...draft.settings,
          steps: reindexFormSteps(
            draftSteps.map((step) =>
              step.index === stepIndex ? { ...step, ...updates } : step,
            ),
          ),
        };
      });
    },
    [commitChange],
  );

  const handleRemoveStep = React.useCallback(
    (stepIndex: number) => {
      if (steps.length <= 1) {
        return;
      }

      commitChange(
        (draft) => {
          const draftSteps = getEditableFormSteps(draft.fields, draft.settings);
          const remainingSteps = draftSteps.filter(
            (step) => step.index !== stepIndex,
          );
          const remainingOldIndices = remainingSteps.map((step) => step.index);
          const fallbackOldIndex =
            remainingOldIndices[
              Math.max(
                0,
                Math.min(
                  remainingOldIndices.length - 1,
                  stepIndex > 0 ? stepIndex - 1 : 0,
                ),
              )
            ] ?? 0;
          const oldIndexToNewIndex = new Map(
            remainingOldIndices.map((oldIndex, newIndex) => [
              oldIndex,
              newIndex,
            ]),
          );

          draft.settings = {
            ...draft.settings,
            steps: reindexFormSteps(remainingSteps),
          };
          draft.fields = draft.fields.map((field) => {
            const oldFieldStepIndex = normalizeFieldStepIndex(field);
            const targetOldIndex =
              oldFieldStepIndex === stepIndex
                ? fallbackOldIndex
                : oldFieldStepIndex;
            return {
              ...field,
              step_index: oldIndexToNewIndex.get(targetOldIndex) ?? 0,
            };
          });
        },
        () => {
          setFocusedStepIndex((current) =>
            current === stepIndex ? 0 : current,
          );
          setSelectedFieldId(null);
        },
      );
    },
    [commitChange, steps.length],
  );

  const handleDragEnd = React.useCallback(
    (result: DropResult) => {
      const { destination, source, type } = result;

      if (!destination) {
        return;
      }

      if (type === "step") {
        if (destination.index === source.index) {
          return;
        }

        const movedStep = steps[source.index];

        commitChange(
          (draft) => {
            const draftSteps = [
              ...getEditableFormSteps(draft.fields, draft.settings),
            ];
            const [removedStep] = draftSteps.splice(source.index, 1);

            if (!removedStep) {
              return;
            }

            draftSteps.splice(destination.index, 0, removedStep);

            const oldIndexToNewIndex = new Map(
              draftSteps.map((step, newIndex) => [step.index, newIndex]),
            );

            draft.settings = {
              ...draft.settings,
              steps: reindexFormSteps(draftSteps),
            };
            draft.fields = draft.fields.map((field) => ({
              ...field,
              step_index:
                oldIndexToNewIndex.get(normalizeFieldStepIndex(field)) ?? 0,
            }));
          },
          () => {
            setFocusedStepIndex(destination.index);
            if (movedStep) {
              const selectedField = fields.find(
                (field) => field.id === selectedFieldId,
              );
              if (
                selectedField &&
                normalizeFieldStepIndex(selectedField) === movedStep.index
              ) {
                setFocusedStepIndex(destination.index);
              }
            }
          },
        );

        return;
      }

      if (destination.index === source.index) {
        return;
      }

      const stepIndex = multiStepEnabled
        ? Number.parseInt(source.droppableId.replace("step-", ""), 10)
        : 0;

      commitChange((draft) => {
        const draftSteps = getEditableFormSteps(draft.fields, draft.settings);
        const mutableGroups = groupFieldsByStep(draft.fields, draftSteps).map(
          (group) => ({
            step: group.step,
            fields: [...group.fields],
          }),
        );
        const targetGroup = mutableGroups.find(
          (group) => group.step.index === stepIndex,
        );

        if (!targetGroup) {
          return;
        }

        const [movedField] = targetGroup.fields.splice(source.index, 1);
        if (!movedField) {
          return;
        }

        targetGroup.fields.splice(destination.index, 0, movedField);
        draft.fields = mutableGroups.flatMap((group) =>
          group.fields.map((field) =>
            multiStepEnabled
              ? { ...field, step_index: group.step.index }
              : removeStepIndex(field),
          ),
        );
      });
    },
    [commitChange, fields, multiStepEnabled, selectedFieldId, steps],
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = event.metaKey || event.ctrlKey;
      const typing = isTypingElement(event.target);
      const visibleFieldIds = canvasFields.map((field) => field.id);
      const selectedIndex = selectedFieldId
        ? visibleFieldIds.indexOf(selectedFieldId)
        : -1;

      if (event.key === "Escape") {
        if (selectedFieldId) {
          event.preventDefault();
          setSelectedFieldId(null);
        }
        return;
      }

      if (modifierPressed && !typing && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (modifierPressed && !typing && event.key.toLowerCase() === "d") {
        if (!selectedFieldId) {
          return;
        }

        event.preventDefault();
        handleDuplicateField(selectedFieldId);
        return;
      }

      if (!typing && (event.key === "Delete" || event.key === "Backspace")) {
        if (!selectedFieldId) {
          return;
        }

        event.preventDefault();
        handleDeleteField(selectedFieldId);
        return;
      }

      if (!typing && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        if (visibleFieldIds.length === 0) {
          return;
        }

        event.preventDefault();

        if (selectedIndex === -1) {
          setSelectedFieldId(visibleFieldIds[0]);
          return;
        }

        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(
          Math.max(selectedIndex + delta, 0),
          visibleFieldIds.length - 1,
        );
        setSelectedFieldId(visibleFieldIds[nextIndex] ?? null);
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !modifierPressed &&
        target?.closest("[data-inline-editor-root='true']") &&
        target.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();

        if (selectedIndex >= 0 && selectedIndex < visibleFieldIds.length - 1) {
          setSelectedFieldId(visibleFieldIds[selectedIndex + 1] ?? null);
        } else {
          setSelectedFieldId(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    canvasFields,
    handleDeleteField,
    handleDuplicateField,
    handleRedo,
    handleUndo,
    selectedFieldId,
  ]);

  const handleCanvasShellClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;

      if (
        target.closest("[data-field-item='true']") ||
        target.closest("[data-step-chip='true']") ||
        target.closest("[role='menu']") ||
        target.closest("[role='dialog']")
      ) {
        return;
      }

      setSelectedFieldId(null);
    },
    [],
  );

  const handleApplyTemplate = React.useCallback(
    (templateData: {
      name: string;
      fields_json?: FormField[];
      settings_json?: FormSettings;
      compliance_json?: FormCompliance;
    }) => {
      historyRef.current.push(getCurrentSnapshot());
      if (historyRef.current.length > MAX_HISTORY_ENTRIES) {
        historyRef.current.shift();
      }
      futureRef.current = [];
      syncHistoryCounts();

      if (onApplyTemplate) {
        onApplyTemplate(templateData);
      } else {
        if (templateData.fields_json) {
          updateFields(templateData.fields_json);
        }
        if (templateData.settings_json) {
          updateSettings(templateData.settings_json);
        }
        if (templateData.compliance_json) {
          updateCompliance(templateData.compliance_json);
        }
      }

      setFocusedStepIndex(0);
      setSelectedFieldId(templateData.fields_json?.[0]?.id ?? null);
      setTemplatesOpen(false);
    },
    [
      getCurrentSnapshot,
      onApplyTemplate,
      syncHistoryCounts,
      updateCompliance,
      updateFields,
      updateSettings,
    ],
  );

  return (
    <Box ref={builderRootRef} sx={{ width: "100%" }}>
      <Stack spacing={2.5} onClick={handleCanvasShellClick}>
        {activeBuildIssue ? (
          <Sheet
            variant="soft"
            color="warning"
            sx={{ borderRadius: "lg", p: 2 }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <AlertTriangle size={18} />
              <Typography level="body-sm">
                {activeBuildIssue.fixHint}
              </Typography>
            </Stack>
          </Sheet>
        ) : null}

        <Sheet
          data-builder-toolbar="true"
          variant="plain"
          sx={{
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "xl",
            px: { xs: 1.25, md: 1.5 },
            py: 1,
            backgroundColor: "background.surface",
            boxShadow: "var(--joy-shadow-xs)",
          }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.25}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", lg: "center" }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              <FieldTypePickerMenu
                fields={fields}
                compliance={compliance}
                label="Add field"
                onAddField={(field) =>
                  handleAddFieldAt(field, canvasFields.length, focusedStepIndex)
                }
              />
              <JoyButton
                size="sm"
                bloomVariant="ghost"
                color="neutral"
                startDecorator={<LayoutTemplate size={16} />}
                onClick={() => setTemplatesOpen(true)}
              >
                Templates
              </JoyButton>
              <Divider
                orientation="vertical"
                sx={{ height: 20, display: { xs: "none", sm: "block" } }}
              />
              <Typography level="body-xs" color="neutral">
                {fields.length} fields · {configuredStepCount} step
                {configuredStepCount === 1 ? "" : "s"}
              </Typography>
              {multiStepEnabled ? (
                <JoyChip size="sm" variant="soft" color="primary">
                  Editing{" "}
                  {currentStepGroup.step.title ||
                    `Step ${focusedStepIndex + 1}`}
                </JoyChip>
              ) : null}
            </Stack>

            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              justifyContent="flex-end"
            >
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                disabled={historyCounts.undo === 0}
                onClick={handleUndo}
              >
                <Undo2 size={16} />
              </IconButton>
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                disabled={historyCounts.redo === 0}
                onClick={handleRedo}
              >
                <Redo2 size={16} />
              </IconButton>
              <Divider orientation="vertical" sx={{ height: 20 }} />
              <IconButton
                variant="soft"
                color="neutral"
                size="sm"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 size={16} />
              </IconButton>
            </Stack>
          </Stack>
        </Sheet>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Stack spacing={2}>
            {multiStepEnabled ? (
              <Droppable
                droppableId={STEP_DROPPABLE_ID}
                direction="horizontal"
                type="step"
              >
                {(stepDropProvided) => (
                  <Stack
                    ref={stepDropProvided.innerRef}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    useFlexGap
                    flexWrap="wrap"
                    {...stepDropProvided.droppableProps}
                  >
                    {steps.map((step, stepPosition) => (
                      <Draggable
                        key={`step-chip-${step.index}`}
                        draggableId={`step-chip-${step.index}`}
                        index={stepPosition}
                      >
                        {(stepProvided) => (
                          <Sheet
                            data-step-chip="true"
                            ref={stepProvided.innerRef}
                            onClick={() => {
                              setFocusedStepIndex(step.index);
                              setSelectedFieldId(null);
                            }}
                            {...stepProvided.draggableProps}
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.75,
                              px: 1.25,
                              py: 0.875,
                              borderRadius: "999px",
                              border: "1px solid",
                              borderColor:
                                focusedStepIndex === step.index
                                  ? "primary.300"
                                  : "neutral.200",
                              backgroundColor:
                                focusedStepIndex === step.index
                                  ? "primary.50"
                                  : "background.surface",
                              color:
                                focusedStepIndex === step.index
                                  ? "primary.700"
                                  : "neutral.700",
                              cursor: "pointer",
                              transition:
                                "border-color 160ms ease, background-color 160ms ease, color 160ms ease",
                              boxShadow:
                                focusedStepIndex === step.index
                                  ? "var(--joy-shadow-sm)"
                                  : "none",
                            }}
                          >
                            <Box
                              {...stepProvided.dragHandleProps}
                              sx={{
                                display: "inline-flex",
                                color: "inherit",
                              }}
                            >
                              <GripVertical size={14} />
                            </Box>
                            <Typography
                              level="body-xs"
                              sx={{ fontWeight: 700 }}
                            >
                              Step {step.index + 1}
                            </Typography>
                            <Typography
                              level="body-sm"
                              sx={{ fontWeight: 600 }}
                            >
                              {step.title || `Step ${step.index + 1}`}
                            </Typography>
                          </Sheet>
                        )}
                      </Draggable>
                    ))}
                    {stepDropProvided.placeholder}
                    <JoyButton
                      size="sm"
                      bloomVariant="ghost"
                      color="neutral"
                      onClick={handleAddStep}
                    >
                      Add step
                    </JoyButton>
                  </Stack>
                )}
              </Droppable>
            ) : null}

            {multiStepEnabled ? (
              <Box
                sx={{
                  maxWidth: tokens.formMaxWidth,
                  width: "100%",
                  mx: "auto",
                }}
              >
                <Sheet
                  variant="soft"
                  sx={{
                    borderRadius: "xl",
                    px: 2,
                    py: 1.5,
                    backgroundColor: tokens.hoverTint,
                    border: "1px solid",
                    borderColor: "neutral.200",
                  }}
                >
                  <Stack spacing={0.5}>
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      {currentStepGroup.step.title ||
                        `Step ${focusedStepIndex + 1}`}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {currentStepGroup.step.description ||
                        "Move through the step chips above to edit each section of the form."}
                    </Typography>
                  </Stack>
                </Sheet>
              </Box>
            ) : null}

            <Box
              sx={{
                maxWidth: tokens.formMaxWidth,
                width: "100%",
                mx: "auto",
              }}
            >
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "xl",
                  borderColor: "neutral.200",
                  backgroundColor: tokens.surfaceColor,
                  boxShadow: "var(--joy-shadow-md)",
                  p: { xs: 2, md: 3 },
                }}
              >
                <Stack spacing={2.5}>
                  <JoyInput
                    value={settings.form_title ?? ""}
                    onValueChange={(form_title) =>
                      handleSettingsPatch({ form_title })
                    }
                    placeholder="Untitled Form"
                    variant="plain"
                    sx={{
                      px: 0,
                      minHeight: "auto",
                      border: "none",
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor: "transparent",
                      },
                      "& .MuiInput-input": {
                        px: 0,
                        py: 0,
                        fontSize: "clamp(1.6rem, 2.4vw, 2rem)",
                        fontWeight: 700,
                        fontFamily: tokens.fontFamily,
                      },
                    }}
                  />
                  <Textarea
                    minRows={2}
                    value={settings.form_description ?? ""}
                    onChange={(event) =>
                      handleSettingsPatch({
                        form_description: event.target.value,
                      })
                    }
                    placeholder="Add a description to guide visitors before they start."
                    variant="plain"
                    sx={{
                      px: 0,
                      border: "none",
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor: "transparent",
                      },
                      "& textarea": {
                        px: 0,
                        py: 0,
                        fontFamily: tokens.fontFamily,
                        color: tokens.mutedTextColor,
                      },
                    }}
                  />

                  <Divider />

                  <Droppable
                    droppableId={
                      multiStepEnabled ? `step-${focusedStepIndex}` : "step-0"
                    }
                    type="field"
                  >
                    {(fieldDropProvided) => (
                      <Stack
                        ref={fieldDropProvided.innerRef}
                        spacing={0}
                        {...fieldDropProvided.droppableProps}
                      >
                        {canvasFields.length === 0 ? (
                          <Sheet
                            variant="soft"
                            sx={{
                              borderRadius: "xl",
                              border: "1px dashed",
                              borderColor: "neutral.300",
                              p: { xs: 3, md: 4 },
                              textAlign: "center",
                            }}
                          >
                            <Stack spacing={1.5} alignItems="center">
                              <Typography level="title-lg">
                                Start building your form
                              </Typography>
                              <Typography level="body-sm" color="neutral">
                                Add your first field and edit it directly on the
                                canvas.
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                              >
                                <FieldTypePickerMenu
                                  fields={fields}
                                  compliance={compliance}
                                  label="Add your first field"
                                  onAddField={(field) =>
                                    handleAddFieldAt(field, 0, focusedStepIndex)
                                  }
                                />
                                <JoyButton
                                  size="sm"
                                  bloomVariant="ghost"
                                  color="neutral"
                                  startDecorator={<LayoutTemplate size={16} />}
                                  onClick={() => setTemplatesOpen(true)}
                                >
                                  Browse templates
                                </JoyButton>
                              </Stack>
                            </Stack>
                          </Sheet>
                        ) : (
                          <>
                            {canvasFields.map((field, fieldIndex) => (
                              <React.Fragment key={field.id}>
                                <InsertionZone
                                  fields={fields}
                                  compliance={compliance}
                                  onAddField={(nextField) =>
                                    handleAddFieldAt(
                                      nextField,
                                      fieldIndex,
                                      focusedStepIndex,
                                    )
                                  }
                                />

                                <Draggable
                                  draggableId={field.id}
                                  index={fieldIndex}
                                >
                                  {(fieldProvided, snapshot) => (
                                    <Box
                                      ref={fieldProvided.innerRef}
                                      {...fieldProvided.draggableProps}
                                      sx={{ mb: 0.5 }}
                                    >
                                      <FormFieldItem
                                        field={field}
                                        fields={fields}
                                        steps={steps}
                                        settings={settings}
                                        compliance={compliance}
                                        tokens={tokens}
                                        multiStepEnabled={multiStepEnabled}
                                        isDragging={snapshot.isDragging}
                                        isSelected={
                                          selectedFieldId === field.id
                                        }
                                        dragHandleProps={
                                          fieldProvided.dragHandleProps
                                        }
                                        onSelect={() =>
                                          setSelectedFieldId(field.id)
                                        }
                                        onFieldChange={(updates) =>
                                          handleUpdateField(field.id, updates)
                                        }
                                        onComplianceChange={
                                          handleCompliancePatch
                                        }
                                        onDuplicate={() =>
                                          handleDuplicateField(field.id)
                                        }
                                        onDelete={() =>
                                          handleDeleteField(field.id)
                                        }
                                        onAddVisibilityRule={() =>
                                          handleAddVisibilityRule(field.id)
                                        }
                                      />
                                    </Box>
                                  )}
                                </Draggable>
                              </React.Fragment>
                            ))}

                            {fieldDropProvided.placeholder}

                            <InsertionZone
                              fields={fields}
                              compliance={compliance}
                              onAddField={(field) =>
                                handleAddFieldAt(
                                  field,
                                  canvasFields.length,
                                  focusedStepIndex,
                                )
                              }
                            />
                          </>
                        )}
                      </Stack>
                    )}
                  </Droppable>

                  <Box sx={{ pt: 1.5 }}>
                    <JoyButton
                      variant={
                        settings.theme.button_style === "outlined"
                          ? "outlined"
                          : settings.theme.button_style === "ghost"
                            ? "plain"
                            : "solid"
                      }
                      color="primary"
                      fullWidth
                      sx={{
                        borderRadius: settings.theme.border_radius ?? "8px",
                        fontFamily: tokens.fontFamily,
                        ...(settings.theme.button_style === "filled"
                          ? {
                              backgroundColor: settings.theme.primary_color,
                              borderColor: settings.theme.primary_color,
                            }
                          : null),
                      }}
                    >
                      {settings.submit_button_text || "Submit"}
                    </JoyButton>
                  </Box>
                </Stack>
              </Sheet>
            </Box>
          </Stack>
        </DragDropContext>
      </Stack>

      <FormBuilderSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        steps={steps}
        multiStepEnabled={multiStepEnabled}
        currentStepIndex={focusedStepIndex}
        onFocusStep={setFocusedStepIndex}
        onToggleMultiStep={handleToggleMultiStep}
        onAddStep={handleAddStep}
        onRemoveStep={handleRemoveStep}
        onUpdateStep={handleUpdateStep}
        onSettingsPatch={handleSettingsPatch}
        onThemePatch={handleThemePatch}
      />

      <FormTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onStartFromScratch={() => setTemplatesOpen(false)}
        onSelect={handleApplyTemplate}
      />
    </Box>
  );
}
