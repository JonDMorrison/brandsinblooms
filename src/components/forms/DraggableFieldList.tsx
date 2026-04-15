import React, { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  DragDropContext,
  Draggable,
  DragStart,
  DragUpdate,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  AlertTriangle,
  ChevronDown,
  GripVertical,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui-legacy/alert";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { ConfirmationDialog } from "@/components/ui-legacy/confirmation-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui-legacy/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { Switch } from "@/components/ui-legacy/switch";
import { Textarea } from "@/components/ui-legacy/textarea";
import { Autocomplete } from "@/components/ui-legacy/autocomplete";
import { useToast } from "@/hooks/use-toast";
import {
  createDefaultFormStep,
  getEditableFormSteps,
  getAvailableConditionSourceFields,
  groupFieldsByStep,
  isMultiStepEnabled,
  normalizeVisibilityRules,
  reindexFormSteps,
} from "@/lib/forms/formFlow";
import {
  FIELD_DEFINITION_MAP,
  createFieldFromType,
  getConsentText,
  isConsentFieldType,
} from "@/lib/forms/fieldRegistry";
import { isPatternSyntaxValid } from "@/lib/forms/fieldValidation";
import * as formUploadConfig from "@/lib/forms/fileUploads";
import {
  CRM_FIELD_MAPPING_SUGGESTIONS,
  DEFAULT_FORM_COMPLIANCE,
  FormCompliance,
  FormField,
  FormFieldRules,
  FormFieldType,
  FormSettings,
  FormStep,
  FormVisibilityOperator,
  FormVisibilityRule,
} from "@/types/formBuilder";
import { cn } from "@/lib/utils";
import { reorderArray } from "@/utils/dragUtils";
import { AddFieldPanel } from "./AddFieldPanel";

interface DraggableFieldListProps {
  fields: FormField[];
  updateFields: (fields: FormField[]) => void;
  settings: FormSettings;
  updateSettings: (settings: FormSettings) => void;
  compliance: FormCompliance;
  updateCompliance: (compliance: FormCompliance) => void;
  focusedStepIndex: number;
  onFocusedStepIndexChange: (stepIndex: number) => void;
}

interface StepDeleteState {
  step: FormStep;
}

interface InsertFieldContext {
  afterFieldId: string | null;
  id: string;
  position: "after" | "start";
  stepIndex: number;
}

interface ActiveDragState {
  destination: DropResult["destination"];
  draggableId: string;
  source: DropResult["source"];
  type: string;
}

const STEP_DROPPABLE_ID = "form-steps";
const FIELD_DROPPABLE_PREFIX = "step-fields:";
const FIELD_OPTIONS_PREFIX = "field-options:";

interface DragDimensions {
  height: number;
  width: number;
}

const draggableDimensionsStore = new Map<string, DragDimensions>();

function assignMeasuredDraggableNode<T extends HTMLElement>(
  node: T | null,
  providedRef: (element: T | null) => void,
  draggableId: string,
): void {
  providedRef(node);

  if (!node) {
    return;
  }

  const rect = node.getBoundingClientRect();

  draggableDimensionsStore.set(draggableId, {
    height: rect.height,
    width: rect.width,
  });
}

function getActiveDraggableStyle(
  style: React.CSSProperties | undefined,
  active: boolean,
  dimensions?: DragDimensions,
  dropAnimating = false,
): React.CSSProperties | undefined {
  if (!style && !active && !dimensions && !dropAnimating) {
    return style;
  }

  const resolvedZIndex = Number(style?.zIndex ?? 0);

  return {
    ...style,
    ...(active
      ? {
          boxSizing: "border-box",
          height: dimensions?.height ?? style?.height,
          maxWidth: dimensions?.width ?? style?.maxWidth,
          opacity: 1,
          pointerEvents: "none",
          visibility: "visible",
          width: dimensions?.width ?? style?.width,
          willChange: "transform",
          zIndex: Number.isFinite(resolvedZIndex)
            ? Math.max(resolvedZIndex, 9999)
            : 9999,
        }
      : {}),
    ...(dropAnimating
      ? {
          transform: "none",
          transition: "none",
          transitionDuration: "0.001s",
        }
      : {}),
  };
}

const AddActionCardButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 py-4 text-center text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  >
    <Plus className="h-4 w-4" />
    <span>{children}</span>
  </button>
));

AddActionCardButton.displayName = "AddActionCardButton";

interface InsertionZoneButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function StepDragClone({
  fieldCount,
  isFocused,
  step,
}: {
  fieldCount: number;
  isFocused: boolean;
  step: FormStep;
}) {
  return (
    <div
      className={cn(
        "rounded-[30px] border border-border/80 bg-card shadow-xl ring-2 ring-primary/20",
        isFocused && "border-primary/50",
      )}
    >
      <div className="space-y-5 border-b border-border/80 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mt-1 rounded-full border border-border/80 bg-background/80 p-2 text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isFocused ? "default" : "secondary"}
                className="rounded-full"
              >
                Step {step.index + 1}
              </Badge>
              <span className="truncate text-base font-semibold text-foreground">
                {step.title || `Step ${step.index + 1}`}
              </span>
              <Badge variant="outline" className="rounded-full">
                {fieldCount} field{fieldCount === 1 ? "" : "s"}
              </Badge>
            </div>

            <p className="max-w-2xl text-sm text-muted-foreground">
              {step.description ||
                "Add a short description for this step or leave it blank."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldDragClone({
  field,
  isOpen,
  step,
}: {
  field: FormField;
  isOpen: boolean;
  step: FormStep;
}) {
  const definition = FIELD_DEFINITION_MAP[field.type];
  const Icon = definition.icon;
  const isConsentField = isConsentFieldType(field.type);

  return (
    <div className="rounded-[24px] border border-primary/40 bg-card shadow-xl ring-2 ring-primary/20">
      <div
        className={cn(
          "flex items-start gap-3 rounded-[24px] px-4 py-4 sm:px-5",
          isOpen && "rounded-b-none border-b border-border/80 bg-muted/15",
        )}
      >
        <div className="mt-1 rounded-full border border-border/80 bg-background/80 p-2 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="mt-0.5 rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-foreground">
              {field.label || definition.defaultLabel}
            </span>
            <Badge
              variant="secondary"
              className="rounded-full font-mono text-[10px] uppercase tracking-wide"
            >
              {field.type}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full text-[10px] uppercase tracking-wide"
            >
              {step.title || `Step ${step.index + 1}`}
            </Badge>
            {field.required && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] uppercase tracking-wide"
              >
                Required
              </Badge>
            )}
            {field.visibility_rules && field.visibility_rules.length > 0 && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] uppercase tracking-wide text-primary"
              >
                Conditional
              </Badge>
            )}
            {isConsentField && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] uppercase tracking-wide text-primary"
              >
                Compliance
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{definition.label}</span>
            <span className="font-mono">
              → {getMappingIndicator(field.mapping_key)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDropIndicator({
  fieldCount,
  step,
}: {
  fieldCount: number;
  step: FormStep;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-primary/45 bg-primary/10 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary p-2 text-primary-foreground shadow-sm">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Drop step here
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {step.title || `Step ${step.index + 1}`} · {fieldCount} field
            {fieldCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldDropIndicator({
  field,
  overlay = false,
  step,
}: {
  field: FormField;
  overlay?: boolean;
  step: FormStep;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none", overlay && "relative h-0")}
    >
      <div className={cn(overlay && "absolute inset-x-0 top-0 z-10")}>
        <div className="origin-top scale-[0.985] opacity-60 saturate-[0.8]">
          <FieldDragClone field={field} isOpen={false} step={step} />
        </div>
      </div>
    </div>
  );
}

const InsertionZoneButton = React.forwardRef<
  HTMLButtonElement,
  InsertionZoneButtonProps
>(({ active = false, className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "group/insert relative flex h-8 w-full items-center border-0 bg-transparent px-1 py-0 focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none flex w-full items-center opacity-0 transition-opacity duration-200 ease-out group-hover/insert:opacity-100 group-focus-visible/insert:opacity-100",
        active && "opacity-100",
      )}
    >
      <span className="h-px flex-1 bg-primary/40" />
      <span className="mx-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-150 ease-out group-hover/insert:scale-110 group-hover/insert:shadow-md group-active/insert:scale-90 group-focus-visible/insert:scale-110 group-focus-visible/insert:shadow-md">
        <Plus className="h-3.5 w-3.5" />
      </span>
      <span className="h-px flex-1 bg-primary/40" />
    </span>
  </button>
));

InsertionZoneButton.displayName = "InsertionZoneButton";

function normalizeRules(rules?: FormFieldRules): FormFieldRules {
  return {
    min_length: rules?.min_length,
    max_length: rules?.max_length,
    pattern: rules?.pattern,
    pattern_message: rules?.pattern_message,
    max_files: rules?.max_files,
    max_file_size_mb: rules?.max_file_size_mb,
    allowed_mime_types: Array.isArray(rules?.allowed_mime_types)
      ? rules.allowed_mime_types.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

function formatMimeTypeList(value?: string[]): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseMimeTypeList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function hasMatchingMimeTypePreset(value: string[], preset: readonly string[]) {
  if (value.length !== preset.length) {
    return false;
  }

  return preset.every((entry) => value.includes(entry));
}

function normalizeOptionValue(value: string): string {
  return value.trim();
}

function getFieldOptions(field: FormField): string[] {
  return field.options && field.options.length > 0
    ? field.options
    : ["Option 1"];
}

function getMappingIndicator(mappingKey: string): string {
  return mappingKey.trim() || "custom";
}

function sanitizeMappingKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function getFieldDroppableId(stepIndex: number): string {
  return `${FIELD_DROPPABLE_PREFIX}${stepIndex}`;
}

function parseStepIndexFromDroppableId(droppableId: string): number | null {
  if (!droppableId.startsWith(FIELD_DROPPABLE_PREFIX)) {
    return null;
  }

  const parsed = Number.parseInt(
    droppableId.replace(FIELD_DROPPABLE_PREFIX, ""),
    10,
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function didDragDestinationChange(
  source: DropResult["source"],
  destination: DropResult["destination"],
): destination is NonNullable<DropResult["destination"]> {
  if (!destination) {
    return false;
  }

  return !(
    source.droppableId === destination.droppableId &&
    source.index === destination.index
  );
}

function getVisualDestinationIndex(
  source: DropResult["source"],
  destination: NonNullable<DropResult["destination"]>,
  itemCount: number,
): number {
  const nextIndex =
    source.droppableId === destination.droppableId &&
    source.index < destination.index
      ? destination.index + 1
      : destination.index;

  return Math.max(0, Math.min(nextIndex, itemCount));
}

function cloneStepGroups(
  stepGroups: Array<{ step: FormStep; fields: FormField[] }>,
): Array<{ step: FormStep; fields: FormField[] }> {
  return stepGroups.map((group) => ({
    step: { ...group.step },
    fields: [...group.fields],
  }));
}

function assignStepIndex(field: FormField, stepIndex: number): FormField {
  return {
    ...field,
    step_index: stepIndex,
  };
}

function clearStepIndex(field: FormField): FormField {
  const nextField = { ...field };
  delete nextField.step_index;
  return nextField;
}

function buildFieldsFromStepGroups(
  stepGroups: Array<{ step: FormStep; fields: FormField[] }>,
  persistStepIndex: boolean,
): FormField[] {
  return stepGroups.flatMap((group) =>
    group.fields.map((field) =>
      persistStepIndex
        ? assignStepIndex(field, group.step.index)
        : clearStepIndex(field),
    ),
  );
}

function getOperatorLabel(operator: FormVisibilityOperator): string {
  switch (operator) {
    case "equals":
      return "Equals";
    case "not_equals":
      return "Does not equal";
    case "contains":
      return "Contains";
    case "not_empty":
      return "Has any value";
    case "is_empty":
      return "Is empty";
    default:
      return "Equals";
  }
}

function operatorNeedsValue(operator: FormVisibilityOperator): boolean {
  return operator !== "not_empty" && operator !== "is_empty";
}

function getDefaultRuleValue(sourceField?: FormField): string {
  if (!sourceField) {
    return "";
  }

  if (sourceField.type === "checkbox") {
    return "true";
  }

  if (sourceField.type === "select") {
    return getFieldOptions(sourceField)[0] ?? "";
  }

  return "";
}

function createVisibilityRule(sourceField?: FormField): FormVisibilityRule {
  return {
    field_id: sourceField?.id ?? "",
    operator: "equals",
    value: getDefaultRuleValue(sourceField),
  };
}

export function DraggableFieldList({
  fields,
  updateFields,
  settings,
  updateSettings,
  compliance,
  updateCompliance,
  focusedStepIndex,
  onFocusedStepIndexChange,
}: DraggableFieldListProps) {
  const { toast } = useToast();
  const [openFieldId, setOpenFieldId] = useState<string | null>(null);
  const [activeDragState, setActiveDragState] =
    useState<ActiveDragState | null>(null);
  const [consentDeleteField, setConsentDeleteField] =
    useState<FormField | null>(null);
  const [stepDeleteState, setStepDeleteState] =
    useState<StepDeleteState | null>(null);
  const [insertFieldContext, setInsertFieldContext] =
    useState<InsertFieldContext | null>(null);
  const [recentlyInsertedFieldId, setRecentlyInsertedFieldId] = useState<
    string | null
  >(null);
  const [optimisticFields, setOptimisticFields] = useState<FormField[] | null>(
    null,
  );
  const [optimisticSettings, setOptimisticSettings] =
    useState<FormSettings | null>(null);

  const renderedFields = optimisticFields ?? fields;
  const renderedSettings = optimisticSettings ?? settings;
  const multiStepEnabled = isMultiStepEnabled(renderedSettings);
  const steps = useMemo(
    () => getEditableFormSteps(renderedFields, renderedSettings),
    [renderedFields, renderedSettings],
  );
  const stepGroups = useMemo(
    () => groupFieldsByStep(renderedFields, steps),
    [renderedFields, steps],
  );
  const activeDraggedField = useMemo(() => {
    if (
      !activeDragState ||
      activeDragState.type !== "field" ||
      !didDragDestinationChange(
        activeDragState.source,
        activeDragState.destination,
      )
    ) {
      return null;
    }

    return (
      renderedFields.find(
        (field) => field.id === activeDragState.draggableId,
      ) ?? null
    );
  }, [activeDragState, renderedFields]);
  const activeStepDragPreview = useMemo(() => {
    if (
      !activeDragState ||
      activeDragState.type !== "step" ||
      !didDragDestinationChange(
        activeDragState.source,
        activeDragState.destination,
      )
    ) {
      return null;
    }

    const stepIndex = Number.parseInt(
      activeDragState.draggableId.replace("step-", ""),
      10,
    );

    if (!Number.isFinite(stepIndex)) {
      return null;
    }

    const sourceGroup = stepGroups.find(
      (group) => group.step.index === stepIndex,
    );

    if (!sourceGroup) {
      return null;
    }

    return {
      destinationIndex: getVisualDestinationIndex(
        activeDragState.source,
        activeDragState.destination,
        stepGroups.length,
      ),
      fieldCount: sourceGroup.fields.length,
      step: sourceGroup.step,
    };
  }, [activeDragState, stepGroups]);

  useEffect(() => {
    setOptimisticFields(null);
  }, [fields]);

  useEffect(() => {
    setOptimisticSettings(null);
  }, [settings]);

  useEffect(() => {
    if (!openFieldId) {
      return;
    }

    if (!renderedFields.some((field) => field.id === openFieldId)) {
      setOpenFieldId(null);
    }
  }, [openFieldId, renderedFields]);

  useEffect(() => {
    if (!insertFieldContext) {
      return;
    }

    const stepStillExists = steps.some(
      (step) => step.index === insertFieldContext.stepIndex,
    );
    const fieldStillExists =
      insertFieldContext.afterFieldId === null ||
      renderedFields.some(
        (field) => field.id === insertFieldContext.afterFieldId,
      );

    if (!stepStillExists || !fieldStillExists) {
      setInsertFieldContext(null);
    }
  }, [insertFieldContext, renderedFields, steps]);

  useEffect(() => {
    if (!recentlyInsertedFieldId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyInsertedFieldId(null);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [recentlyInsertedFieldId]);

  const syncFields = useCallback(
    (nextFields: FormField[]) => {
      setOptimisticFields(nextFields);
      updateFields(nextFields);
    },
    [updateFields],
  );

  const syncSettings = useCallback(
    (nextSettings: FormSettings) => {
      setOptimisticSettings(nextSettings);
      updateSettings(nextSettings);
    },
    [updateSettings],
  );

  const updateSingleField = useCallback(
    (fieldId: string, updater: (field: FormField) => FormField) => {
      syncFields(
        renderedFields.map((field) =>
          field.id === fieldId ? updater(field) : field,
        ),
      );
    },
    [renderedFields, syncFields],
  );

  const updateEditableSteps = useCallback(
    (nextSteps: FormStep[]) => {
      syncSettings({
        ...renderedSettings,
        steps: nextSteps,
      });
    },
    [renderedSettings, syncSettings],
  );

  const updateSingleStep = useCallback(
    (stepIndex: number, updater: (step: FormStep) => FormStep) => {
      updateEditableSteps(
        steps.map((step) => (step.index === stepIndex ? updater(step) : step)),
      );
    },
    [steps, updateEditableSteps],
  );

  const commitStepTitle = useCallback(
    (stepIndex: number, value: string) => {
      const nextTitle = value.trim() || `Step ${stepIndex + 1}`;

      updateSingleStep(stepIndex, (step) =>
        step.title === nextTitle ? step : { ...step, title: nextTitle },
      );
    },
    [updateSingleStep],
  );

  const commitStepGroups = useCallback(
    (
      nextStepGroups: Array<{ step: FormStep; fields: FormField[] }>,
      options?: {
        focusedStepIndex?: number;
        disableMultiStep?: boolean;
      },
    ) => {
      const nextSteps = options?.disableMultiStep
        ? []
        : reindexFormSteps(nextStepGroups.map((group) => group.step));
      const reindexedGroups = nextStepGroups.map((group, index) => ({
        step: nextSteps[index] ?? group.step,
        fields: group.fields,
      }));

      const nextSettings = {
        ...renderedSettings,
        steps: nextSteps,
      };
      const nextFields = buildFieldsFromStepGroups(
        reindexedGroups,
        nextSteps.length > 0,
      );

      syncSettings(nextSettings);
      syncFields(nextFields);

      if (typeof options?.focusedStepIndex === "number") {
        onFocusedStepIndexChange(options.focusedStepIndex);
        return;
      }

      onFocusedStepIndexChange(nextSteps[0]?.index ?? 0);
    },
    [onFocusedStepIndexChange, renderedSettings, syncFields, syncSettings],
  );

  const commitFieldGroups = useCallback(
    (
      nextStepGroups: Array<{ step: FormStep; fields: FormField[] }>,
      nextFocusedStepIndex: number,
    ) => {
      if (multiStepEnabled) {
        commitStepGroups(nextStepGroups, {
          focusedStepIndex: nextFocusedStepIndex,
        });
        return;
      }

      syncFields(buildFieldsFromStepGroups(nextStepGroups, false));
      onFocusedStepIndexChange(nextFocusedStepIndex);
    },
    [commitStepGroups, multiStepEnabled, onFocusedStepIndexChange, syncFields],
  );

  const handleFieldDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, type } = result;

      flushSync(() => {
        setActiveDragState(null);
      });

      if (!destination) {
        return;
      }

      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      if (type === "step") {
        const reorderedGroups = reorderArray(
          cloneStepGroups(stepGroups),
          source.index,
          destination.index,
        );
        const nextSteps = reindexFormSteps(
          reorderedGroups.map((group) => group.step),
        );
        const reindexedGroups = reorderedGroups.map((group, index) => ({
          step: nextSteps[index],
          fields: group.fields,
        }));
        const nextFocusedPosition = reorderedGroups.findIndex(
          (group) => group.step.index === focusedStepIndex,
        );
        const nextSettings = {
          ...renderedSettings,
          steps: nextSteps,
        };
        const nextFields = buildFieldsFromStepGroups(reindexedGroups, true);

        flushSync(() => {
          setOptimisticSettings(nextSettings);
          setOptimisticFields(nextFields);
          updateSettings(nextSettings);
          updateFields(nextFields);
          onFocusedStepIndexChange(
            nextSteps[nextFocusedPosition]?.index ?? nextSteps[0]?.index ?? 0,
          );
        });
        return;
      }

      if (
        type === "option" &&
        source.droppableId === destination.droppableId &&
        source.droppableId.startsWith(FIELD_OPTIONS_PREFIX)
      ) {
        const fieldId = source.droppableId.replace(FIELD_OPTIONS_PREFIX, "");
        const targetField = renderedFields.find(
          (field) => field.id === fieldId,
        );

        if (!targetField) {
          return;
        }

        const nextOptions = reorderArray(
          getFieldOptions(targetField),
          source.index,
          destination.index,
        );

        flushSync(() => {
          updateSingleField(fieldId, (currentField) => ({
            ...currentField,
            options: nextOptions,
          }));
        });
        return;
      }

      if (type !== "field") {
        return;
      }

      const sourceStepIndex = parseStepIndexFromDroppableId(source.droppableId);
      const destinationStepIndex = parseStepIndexFromDroppableId(
        destination.droppableId,
      );

      if (sourceStepIndex === null || destinationStepIndex === null) {
        return;
      }

      const nextStepGroups = cloneStepGroups(stepGroups);
      const sourceGroup = nextStepGroups.find(
        (group) => group.step.index === sourceStepIndex,
      );
      const destinationGroup = nextStepGroups.find(
        (group) => group.step.index === destinationStepIndex,
      );

      if (!sourceGroup || !destinationGroup) {
        return;
      }

      const [movedField] = sourceGroup.fields.splice(source.index, 1);

      if (!movedField) {
        return;
      }

      destinationGroup.fields.splice(destination.index, 0, movedField);
      const nextFields = buildFieldsFromStepGroups(
        nextStepGroups,
        multiStepEnabled,
      );

      flushSync(() => {
        setOptimisticFields(nextFields);
        updateFields(nextFields);
        onFocusedStepIndexChange(destinationStepIndex);
      });
    },
    [
      focusedStepIndex,
      multiStepEnabled,
      onFocusedStepIndexChange,
      renderedFields,
      renderedSettings,
      stepGroups,
      updateFields,
      updateSettings,
      updateSingleField,
    ],
  );

  const handleDeleteField = (field: FormField) => {
    if (isConsentFieldType(field.type)) {
      setConsentDeleteField(field);
      return;
    }

    syncFields(renderedFields.filter((candidate) => candidate.id !== field.id));
  };

  const confirmConsentDelete = () => {
    if (!consentDeleteField) {
      return;
    }

    syncFields(
      renderedFields.filter((field) => field.id !== consentDeleteField.id),
    );

    if (consentDeleteField.type === "email_consent") {
      updateCompliance({
        ...compliance,
        email_consent_required: false,
      });
    }

    if (consentDeleteField.type === "sms_consent") {
      updateCompliance({
        ...compliance,
        sms_consent_required: false,
      });
    }

    setConsentDeleteField(null);
  };

  const openInsertFieldPicker = useCallback(
    (context: InsertFieldContext) => {
      onFocusedStepIndexChange(context.stepIndex);
      setInsertFieldContext(context);
    },
    [onFocusedStepIndexChange],
  );

  const closeInsertFieldPicker = useCallback(() => {
    setInsertFieldContext(null);
  }, []);

  const handleDragStart = useCallback(
    (start: DragStart) => {
      setActiveDragState({
        destination: start.source,
        draggableId: start.draggableId,
        source: start.source,
        type: start.type,
      });

      closeInsertFieldPicker();
    },
    [closeInsertFieldPicker],
  );

  const handleDragUpdate = useCallback((update: DragUpdate) => {
    setActiveDragState({
      destination: update.destination,
      draggableId: update.draggableId,
      source: update.source,
      type: update.type,
    });
  }, []);

  const handleFieldPickerTriggerClick = useCallback(
    (
      event: React.MouseEvent<HTMLButtonElement>,
      context: InsertFieldContext,
    ) => {
      event.stopPropagation();

      if (insertFieldContext?.id === context.id) {
        closeInsertFieldPicker();
        return;
      }

      openInsertFieldPicker(context);
    },
    [closeInsertFieldPicker, insertFieldContext?.id, openInsertFieldPicker],
  );

  const handleInsertField = useCallback(
    (type: FormFieldType, context: InsertFieldContext) => {
      const hasPhoneField = renderedFields.some(
        (field) => field.type === "phone",
      );

      if (type === "sms_consent" && !hasPhoneField) {
        toast({
          title: "Phone field recommended",
          description:
            "SMS consent requires a phone field. Add a phone field to collect mobile numbers.",
        });
      }

      const nextField = createFieldFromType(type, compliance);
      const nextStepGroups = cloneStepGroups(stepGroups);
      const targetStepIndex = multiStepEnabled ? context.stepIndex : 0;
      const targetGroup =
        nextStepGroups.find((group) => group.step.index === targetStepIndex) ??
        nextStepGroups[0];

      if (!targetGroup) {
        return;
      }

      const afterFieldIndex = context.afterFieldId
        ? targetGroup.fields.findIndex(
            (field) => field.id === context.afterFieldId,
          )
        : -1;
      const insertionIndex =
        context.position === "start"
          ? 0
          : context.afterFieldId && afterFieldIndex >= 0
            ? afterFieldIndex + 1
            : targetGroup.fields.length;
      const stepAwareField = multiStepEnabled
        ? {
            ...nextField,
            step_index: targetGroup.step.index,
          }
        : nextField;

      targetGroup.fields.splice(insertionIndex, 0, stepAwareField);
      commitFieldGroups(nextStepGroups, targetGroup.step.index);

      if (type === "email_consent" && !compliance.email_consent_text.trim()) {
        updateCompliance({
          ...compliance,
          email_consent_text: DEFAULT_FORM_COMPLIANCE.email_consent_text,
        });
      }

      if (type === "sms_consent" && !compliance.sms_consent_text.trim()) {
        updateCompliance({
          ...compliance,
          sms_consent_text: DEFAULT_FORM_COMPLIANCE.sms_consent_text,
        });
      }

      setRecentlyInsertedFieldId(nextField.id);
      setInsertFieldContext(null);
    },
    [
      commitFieldGroups,
      compliance,
      multiStepEnabled,
      renderedFields,
      stepGroups,
      toast,
      updateCompliance,
    ],
  );

  const getAppendFieldContext = useCallback(
    (stepIndex: number): InsertFieldContext => {
      const targetGroup = stepGroups.find(
        (group) => group.step.index === stepIndex,
      );
      const afterFieldId =
        targetGroup && targetGroup.fields.length > 0
          ? targetGroup.fields[targetGroup.fields.length - 1].id
          : null;

      return {
        afterFieldId,
        id: `append-field-${stepIndex}`,
        position: "after",
        stepIndex,
      };
    },
    [stepGroups],
  );

  const activeInsertStep = insertFieldContext
    ? (steps.find((step) => step.index === insertFieldContext.stepIndex) ??
      createDefaultFormStep(insertFieldContext.stepIndex))
    : null;
  const fieldPickerTitle =
    insertFieldContext?.position === "after" && insertFieldContext.afterFieldId
      ? "Insert Field"
      : "Add Field";
  const fieldPickerDescription = insertFieldContext
    ? insertFieldContext.position === "start"
      ? multiStepEnabled
        ? `Choose a field type to insert it into ${activeInsertStep?.title || `Step ${insertFieldContext.stepIndex + 1}`}.`
        : "Choose a field type to insert it here."
      : multiStepEnabled
        ? `Choose a field type to add it after the current field in ${activeInsertStep?.title || `Step ${insertFieldContext.stepIndex + 1}`}.`
        : "Choose a field type to add it after the current field."
    : "Choose a field type for this position.";
  const fieldPickerPanel = insertFieldContext ? (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {fieldPickerTitle}
        </h3>
        <p className="text-sm text-muted-foreground">
          {fieldPickerDescription}
        </p>
      </div>
      <div className="rounded-[24px] border border-border/80 bg-background/95 p-4 shadow-sm">
        <AddFieldPanel
          fields={renderedFields}
          onSelectField={(type) => handleInsertField(type, insertFieldContext)}
        />
      </div>
    </div>
  ) : null;

  const renderFieldPickerTrigger = (
    context: InsertFieldContext,
    trigger: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>,
  ) => {
    const triggerOnClick = trigger.props.onClick;
    return React.cloneElement(trigger, {
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        triggerOnClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        handleFieldPickerTriggerClick(event, context);
      },
    });
  };

  const handleAddStepAfter = (stepIndex: number) => {
    const insertIndex = Math.max(
      0,
      steps.findIndex((step) => step.index === stepIndex) + 1,
    );
    const nextStepGroups = cloneStepGroups(stepGroups);

    nextStepGroups.splice(insertIndex, 0, {
      step: createDefaultFormStep(insertIndex),
      fields: [],
    });

    commitStepGroups(nextStepGroups, { focusedStepIndex: insertIndex });
  };

  const handleDeleteStep = (step: FormStep) => {
    const stepPosition = stepGroups.findIndex(
      (group) => group.step.index === step.index,
    );

    if (stepPosition === -1) {
      return;
    }

    const isFinalStep = stepPosition === stepGroups.length - 1;

    if (isFinalStep) {
      setStepDeleteState({ step });
      return;
    }

    const nextStepGroups = cloneStepGroups(stepGroups);
    const [deletedGroup] = nextStepGroups.splice(stepPosition, 1);

    if (!deletedGroup) {
      return;
    }

    nextStepGroups[stepPosition].fields = [
      ...deletedGroup.fields,
      ...nextStepGroups[stepPosition].fields,
    ];

    commitStepGroups(nextStepGroups, { focusedStepIndex: stepPosition });
  };

  const confirmDeleteStep = () => {
    if (!stepDeleteState) {
      return;
    }

    const stepPosition = stepGroups.findIndex(
      (group) => group.step.index === stepDeleteState.step.index,
    );

    if (stepPosition === -1) {
      setStepDeleteState(null);
      return;
    }

    const nextStepGroups = cloneStepGroups(stepGroups);
    nextStepGroups.splice(stepPosition, 1);

    if (nextStepGroups.length === 0) {
      commitStepGroups([], {
        disableMultiStep: true,
        focusedStepIndex: 0,
      });
      setStepDeleteState(null);
      return;
    }

    commitStepGroups(nextStepGroups, {
      focusedStepIndex:
        nextStepGroups[Math.max(0, stepPosition - 1)]?.step.index ?? 0,
    });
    setStepDeleteState(null);
  };

  const renderFieldCards = (
    step: FormStep,
    stepFields: FormField[],
    dragSnapshot?: { isDraggingOver: boolean },
    placeholder?: React.ReactNode,
  ) => {
    const activeFieldDropIndicator =
      activeDraggedField &&
      activeDragState?.type === "field" &&
      activeDragState.destination &&
      activeDragState.destination.droppableId ===
        getFieldDroppableId(step.index)
        ? {
            destinationIndex: getVisualDestinationIndex(
              activeDragState.source,
              activeDragState.destination,
              stepFields.length,
            ),
            field: activeDraggedField,
          }
        : null;

    return (
      <div
        className={cn(
          "rounded-[28px] border border-border/80 bg-card/85 p-4 shadow-sm sm:p-5",
          dragSnapshot?.isDraggingOver &&
            "border-primary/40 bg-primary/5 shadow-lg",
        )}
      >
        {stepFields.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-border/80 bg-muted/15 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              This step is empty.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a field to start building this step, or drag an existing field
              into it.
            </p>
            <div className="mt-4">
              {activeFieldDropIndicator ? (
                <FieldDropIndicator
                  field={activeFieldDropIndicator.field}
                  step={step}
                />
              ) : (
                renderFieldPickerTrigger(
                  {
                    afterFieldId: null,
                    id: `empty-step-field-${step.index}`,
                    position: "start",
                    stepIndex: step.index,
                  },
                  <AddActionCardButton
                    aria-label={`Add a field to ${step.title || `Step ${step.index + 1}`}`}
                  >
                    Add Field
                  </AddActionCardButton>,
                )
              )}
            </div>
          </div>
        ) : (
          stepFields.map((field, index) => {
            const previousField = stepFields[index - 1];
            const insertContext = previousField
              ? {
                  afterFieldId: previousField.id,
                  id: `insert-field-${step.index}-${field.id}`,
                  position: "after" as const,
                  stepIndex: step.index,
                }
              : {
                  afterFieldId: null,
                  id: `insert-field-start-${step.index}-${field.id}`,
                  position: "start" as const,
                  stepIndex: step.index,
                };
            const isLastField = index === stepFields.length - 1;
            const appendContext = isLastField
              ? getAppendFieldContext(step.index)
              : null;
            const showDropIndicatorBefore =
              activeFieldDropIndicator?.destinationIndex === index;
            const showDropIndicatorAfter =
              Boolean(appendContext) &&
              activeFieldDropIndicator?.destinationIndex === stepFields.length;

            return (
              <FieldCard
                key={field.id}
                animateOnMount={recentlyInsertedFieldId === field.id}
                field={field}
                index={index}
                insertAfter={
                  appendContext ? (
                    showDropIndicatorAfter ? (
                      <FieldDropIndicator
                        field={activeFieldDropIndicator.field}
                        overlay
                        step={step}
                      />
                    ) : (
                      renderFieldPickerTrigger(
                        appendContext,
                        <InsertionZoneButton
                          active={insertFieldContext?.id === appendContext.id}
                          aria-label={`Add a field below ${field.label}`}
                        />,
                      )
                    )
                  ) : null
                }
                insertBefore={
                  showDropIndicatorBefore ? (
                    <FieldDropIndicator
                      field={activeFieldDropIndicator.field}
                      overlay
                      step={step}
                    />
                  ) : (
                    renderFieldPickerTrigger(
                      insertContext,
                      <InsertionZoneButton
                        active={insertFieldContext?.id === insertContext.id}
                        aria-label={
                          index === 0
                            ? `Add a field above ${field.label}`
                            : `Insert a field before ${field.label}`
                        }
                      />,
                    )
                  )
                }
                fields={renderedFields}
                isOpen={openFieldId === field.id}
                compliance={compliance}
                onToggle={() => {
                  onFocusedStepIndexChange(step.index);
                  setOpenFieldId((current) =>
                    current === field.id ? null : field.id,
                  );
                }}
                onLabelCommit={(nextLabel) =>
                  updateSingleField(field.id, (currentField) => ({
                    ...currentField,
                    label: nextLabel,
                  }))
                }
                onFieldChange={(updates) =>
                  updateSingleField(field.id, (currentField) => ({
                    ...currentField,
                    ...updates,
                  }))
                }
                onRulesChange={(rules) =>
                  updateSingleField(field.id, (currentField) => ({
                    ...currentField,
                    rules,
                  }))
                }
                onVisibilityRulesChange={(visibilityRules) =>
                  updateSingleField(field.id, (currentField) => {
                    const nextField = {
                      ...currentField,
                      visibility_rules: visibilityRules,
                    };

                    if (!visibilityRules || visibilityRules.length === 0) {
                      delete nextField.visibility_rules;
                    }

                    return nextField;
                  })
                }
                onComplianceChange={updateCompliance}
                onDelete={() => handleDeleteField(field)}
                step={step}
                steps={steps}
              />
            );
          })
        )}
        {placeholder}
      </div>
    );
  };

  return (
    <>
      <DragDropContext
        onDragEnd={handleFieldDragEnd}
        onDragStart={handleDragStart}
        onDragUpdate={handleDragUpdate}
      >
        {multiStepEnabled ? (
          <Droppable
            droppableId={STEP_DROPPABLE_ID}
            type="step"
            renderClone={(cloneProvided, cloneSnapshot, rubric) => {
              const sourceGroup = stepGroups[rubric.source.index];

              if (!sourceGroup || cloneSnapshot.isDropAnimating) {
                return null;
              }

              const cloneDraggableId = `step-${sourceGroup.step.index}`;
              const cloneDimensions =
                draggableDimensionsStore.get(cloneDraggableId);

              return (
                <div
                  ref={cloneProvided.innerRef}
                  {...cloneProvided.draggableProps}
                  style={getActiveDraggableStyle(
                    cloneProvided.draggableProps.style,
                    true,
                    cloneDimensions,
                  )}
                  className="relative"
                >
                  <div {...cloneProvided.dragHandleProps}>
                    <StepDragClone
                      fieldCount={sourceGroup.fields.length}
                      isFocused={focusedStepIndex === sourceGroup.step.index}
                      step={sourceGroup.step}
                    />
                  </div>
                </div>
              );
            }}
          >
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {stepGroups.map((group, index) => {
                  const isFocused = focusedStepIndex === group.step.index;
                  const previousGroup = stepGroups[index - 1];
                  const showStepDropIndicatorBefore =
                    activeStepDragPreview?.destinationIndex === index;

                  return (
                    <div
                      key={`step-shell-${group.step.index}`}
                      className="space-y-3"
                    >
                      {showStepDropIndicatorBefore ? (
                        <StepDropIndicator
                          fieldCount={activeStepDragPreview.fieldCount}
                          step={activeStepDragPreview.step}
                        />
                      ) : index > 0 && previousGroup ? (
                        <InsertionZoneButton
                          aria-label={`Insert a step before ${group.step.title || `Step ${group.step.index + 1}`}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAddStepAfter(previousGroup.step.index);
                          }}
                        />
                      ) : null}

                      <Draggable
                        draggableId={`step-${group.step.index}`}
                        index={index}
                      >
                        {(stepProvided, stepSnapshot) => {
                          const stepDraggableId = `step-${group.step.index}`;
                          const isStepDragActive =
                            stepSnapshot.isDragging ||
                            stepSnapshot.isDropAnimating;
                          const stepDragDimensions =
                            draggableDimensionsStore.get(stepDraggableId);

                          return (
                            <div
                              ref={(node) =>
                                assignMeasuredDraggableNode(
                                  node,
                                  stepProvided.innerRef,
                                  stepDraggableId,
                                )
                              }
                              {...stepProvided.draggableProps}
                              style={getActiveDraggableStyle(
                                stepProvided.draggableProps.style,
                                isStepDragActive,
                                stepDragDimensions,
                                stepSnapshot.isDropAnimating,
                              )}
                              className={cn(
                                !isStepDragActive &&
                                  "transition-shadow duration-200 ease-out",
                                isStepDragActive && "relative",
                              )}
                            >
                              <div
                                className={cn(
                                  "rounded-[30px] border border-border/80 bg-card/90 shadow-sm",
                                  !isStepDragActive &&
                                    "transition-shadow duration-200 ease-out",
                                  isFocused &&
                                    "border-primary/50 ring-1 ring-primary/20",
                                  stepSnapshot.isDragging &&
                                    "border-primary/40 bg-card shadow-xl ring-2 ring-primary/20",
                                )}
                              >
                                <div
                                  className="space-y-5 border-b border-border/80 px-4 py-5 sm:px-6"
                                  onClick={() =>
                                    onFocusedStepIndexChange(group.step.index)
                                  }
                                >
                                  <div className="flex flex-wrap items-start gap-3">
                                    <button
                                      type="button"
                                      {...stepProvided.dragHandleProps}
                                      className="mt-1 rounded-full border border-border/80 bg-background/80 p-2 text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                                      aria-label={`Reorder ${group.step.title}`}
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </button>

                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge
                                          variant={
                                            isFocused ? "default" : "secondary"
                                          }
                                          className="rounded-full"
                                        >
                                          Step {group.step.index + 1}
                                        </Badge>
                                        <span className="truncate text-base font-semibold text-foreground">
                                          {group.step.title ||
                                            `Step ${group.step.index + 1}`}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {group.fields.length} field
                                          {group.fields.length === 1 ? "" : "s"}
                                        </Badge>
                                      </div>

                                      <p className="max-w-2xl text-sm text-muted-foreground">
                                        {group.step.description ||
                                          "Add a short description for this step or leave it blank."}
                                      </p>
                                    </div>

                                    <div className="ml-auto flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="rounded-full text-destructive hover:text-destructive"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleDeleteStep(group.step);
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Step
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`step-title-${group.step.index}`}
                                      >
                                        Step Title
                                      </Label>
                                      <Input
                                        id={`step-title-${group.step.index}`}
                                        value={group.step.title}
                                        className="rounded-xl bg-background/90"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        onChange={(event) =>
                                          updateSingleStep(
                                            group.step.index,
                                            (step) => ({
                                              ...step,
                                              title: event.target.value,
                                            }),
                                          )
                                        }
                                        onBlur={(event) =>
                                          commitStepTitle(
                                            group.step.index,
                                            event.target.value,
                                          )
                                        }
                                        placeholder={`Step ${group.step.index + 1}`}
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`step-description-${group.step.index}`}
                                      >
                                        Step Description
                                      </Label>
                                      <Input
                                        id={`step-description-${group.step.index}`}
                                        value={group.step.description || ""}
                                        className="rounded-xl bg-background/90"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        onChange={(event) => {
                                          const nextSteps = steps.map((step) =>
                                            step.index === group.step.index
                                              ? {
                                                  ...step,
                                                  description:
                                                    event.target.value,
                                                }
                                              : step,
                                          );
                                          syncSettings({
                                            ...renderedSettings,
                                            steps: nextSteps,
                                          });
                                        }}
                                        placeholder="Optional helper copy shown above this step"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-3">
                                  <Droppable
                                    droppableId={getFieldDroppableId(
                                      group.step.index,
                                    )}
                                    type="field"
                                    renderClone={(
                                      cloneProvided,
                                      cloneSnapshot,
                                      rubric,
                                    ) => {
                                      const sourceField =
                                        group.fields[rubric.source.index];

                                      if (
                                        !sourceField ||
                                        cloneSnapshot.isDropAnimating
                                      ) {
                                        return null;
                                      }

                                      const cloneDimensions =
                                        draggableDimensionsStore.get(
                                          sourceField.id,
                                        );

                                      return (
                                        <div
                                          ref={cloneProvided.innerRef}
                                          {...cloneProvided.draggableProps}
                                          {...cloneProvided.dragHandleProps}
                                          style={getActiveDraggableStyle(
                                            cloneProvided.draggableProps.style,
                                            true,
                                            cloneDimensions,
                                          )}
                                          className="relative"
                                        >
                                          <FieldDragClone
                                            field={sourceField}
                                            isOpen={
                                              openFieldId === sourceField.id
                                            }
                                            step={group.step}
                                          />
                                        </div>
                                      );
                                    }}
                                  >
                                    {(fieldProvided, fieldSnapshot) => (
                                      <div
                                        ref={fieldProvided.innerRef}
                                        {...fieldProvided.droppableProps}
                                      >
                                        {renderFieldCards(
                                          group.step,
                                          group.fields,
                                          fieldSnapshot,
                                          fieldProvided.placeholder,
                                        )}
                                      </div>
                                    )}
                                  </Droppable>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      </Draggable>
                    </div>
                  );
                })}
                {activeStepDragPreview?.destinationIndex ===
                stepGroups.length ? (
                  <StepDropIndicator
                    fieldCount={activeStepDragPreview.fieldCount}
                    step={activeStepDragPreview.step}
                  />
                ) : null}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ) : (
          <Droppable
            droppableId={getFieldDroppableId(0)}
            type="field"
            renderClone={(cloneProvided, cloneSnapshot, rubric) => {
              const sourceField = renderedFields[rubric.source.index];

              if (!sourceField || cloneSnapshot.isDropAnimating) {
                return null;
              }

              const cloneDimensions = draggableDimensionsStore.get(
                sourceField.id,
              );

              return (
                <div
                  ref={cloneProvided.innerRef}
                  {...cloneProvided.draggableProps}
                  {...cloneProvided.dragHandleProps}
                  style={getActiveDraggableStyle(
                    cloneProvided.draggableProps.style,
                    true,
                    cloneDimensions,
                  )}
                  className="relative"
                >
                  <FieldDragClone
                    field={sourceField}
                    isOpen={openFieldId === sourceField.id}
                    step={steps[0] ?? createDefaultFormStep(0)}
                  />
                </div>
              );
            }}
          >
            {(provided, snapshot) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {renderFieldCards(
                  steps[0] ?? createDefaultFormStep(0),
                  renderedFields,
                  snapshot,
                  provided.placeholder,
                )}
              </div>
            )}
          </Droppable>
        )}
      </DragDropContext>

      <div className="mt-6">
        {multiStepEnabled ? (
          <AddActionCardButton
            aria-label="Add a step to the end of the form"
            onClick={() =>
              handleAddStepAfter(
                stepGroups[stepGroups.length - 1]?.step.index ?? 0,
              )
            }
          >
            Add Step
          </AddActionCardButton>
        ) : null}
      </div>

      <Dialog
        open={insertFieldContext !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeInsertFieldPicker();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{fieldPickerTitle}</DialogTitle>
            <DialogDescription>{fieldPickerDescription}</DialogDescription>
          </DialogHeader>
          {fieldPickerPanel}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!consentDeleteField}
        onOpenChange={(open) => {
          if (!open) {
            setConsentDeleteField(null);
          }
        }}
        title="Remove consent field"
        description={`Removing ${
          consentDeleteField?.type === "email_consent" ? "email" : "SMS"
        } consent will remove the related compliance control from this form. Continue?`}
        confirmText="Remove Field"
        cancelText="Keep Field"
        onConfirm={confirmConsentDelete}
      />

      <ConfirmationDialog
        open={!!stepDeleteState}
        onOpenChange={(open) => {
          if (!open) {
            setStepDeleteState(null);
          }
        }}
        title="Delete final step"
        description={
          stepDeleteState
            ? `${stepDeleteState.step.title} is the last step in the flow. Deleting it will also remove every field assigned to that step.`
            : ""
        }
        confirmText="Delete Step and Fields"
        cancelText="Keep Step"
        onConfirm={confirmDeleteStep}
      />
    </>
  );
}

interface FieldCardProps {
  animateOnMount?: boolean;
  field: FormField;
  index: number;
  insertAfter?: React.ReactNode;
  insertBefore?: React.ReactNode;
  step: FormStep;
  fields: FormField[];
  steps: FormStep[];
  isOpen: boolean;
  compliance: FormCompliance;
  onToggle: () => void;
  onLabelCommit: (label: string) => void;
  onFieldChange: (updates: Partial<FormField>) => void;
  onRulesChange: (rules: FormFieldRules) => void;
  onVisibilityRulesChange: (rules: FormVisibilityRule[]) => void;
  onComplianceChange: (compliance: FormCompliance) => void;
  onDelete: () => void;
}

function FieldCard({
  animateOnMount = false,
  field,
  index,
  insertAfter,
  insertBefore,
  step,
  fields,
  steps,
  isOpen,
  compliance,
  onToggle,
  onLabelCommit,
  onFieldChange,
  onRulesChange,
  onVisibilityRulesChange,
  onComplianceChange,
  onDelete,
}: FieldCardProps) {
  const definition = FIELD_DEFINITION_MAP[field.type];
  const Icon = definition.icon;
  const isConsentField = isConsentFieldType(field.type);
  const [isVisible, setIsVisible] = useState(!animateOnMount);

  useEffect(() => {
    if (!animateOnMount) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const frameId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [animateOnMount, field.id]);

  return (
    <>
      {insertBefore}

      <Draggable draggableId={field.id} index={index}>
        {(provided, snapshot) => {
          const isFieldDragActive =
            snapshot.isDragging || snapshot.isDropAnimating;
          const fieldDragDimensions = draggableDimensionsStore.get(field.id);

          return (
            <div
              ref={(node) =>
                assignMeasuredDraggableNode(node, provided.innerRef, field.id)
              }
              {...provided.draggableProps}
              style={getActiveDraggableStyle(
                provided.draggableProps.style,
                isFieldDragActive,
                fieldDragDimensions,
                snapshot.isDropAnimating,
              )}
              className={cn(
                "opacity-100",
                !isFieldDragActive &&
                  "transition-opacity duration-200 ease-out",
                !isVisible && !isFieldDragActive && "opacity-0",
                isFieldDragActive && "relative",
              )}
            >
              <div
                className={cn(
                  "rounded-[24px] border border-border/80 bg-background/95 shadow-sm",
                  !isFieldDragActive &&
                    "transition-shadow duration-200 ease-out",
                  snapshot.isDragging &&
                    "border-primary/40 bg-card shadow-xl ring-2 ring-primary/20",
                )}
              >
                <div
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-[24px] px-4 py-4 sm:px-5",
                    isOpen &&
                      "rounded-b-none border-b border-border/80 bg-muted/15",
                  )}
                  onClick={onToggle}
                >
                  <button
                    type="button"
                    {...provided.dragHandleProps}
                    className="mt-1 rounded-full border border-border/80 bg-background/80 p-2 text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Reorder ${field.label}`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>

                  <div className="mt-0.5 rounded-2xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <InlineEditableLabel
                        value={field.label}
                        fallbackValue={definition.defaultLabel}
                        onCommit={onLabelCommit}
                      />
                      <Badge
                        variant="secondary"
                        className="rounded-full font-mono text-[10px] uppercase tracking-wide"
                      >
                        {field.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px] uppercase tracking-wide"
                      >
                        {step.title || `Step ${step.index + 1}`}
                      </Badge>
                      {field.required && (
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px] uppercase tracking-wide"
                        >
                          Required
                        </Badge>
                      )}
                      {field.visibility_rules &&
                        field.visibility_rules.length > 0 && (
                          <Badge
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-wide text-primary"
                          >
                            Conditional
                          </Badge>
                        )}
                      {isConsentField && (
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px] uppercase tracking-wide text-primary"
                        >
                          Compliance
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{definition.label}</span>
                      <span className="font-mono">
                        → {getMappingIndicator(field.mapping_key)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle();
                      }}
                      aria-label={isOpen ? "Collapse field" : "Expand field"}
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-destructive hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete();
                      }}
                      aria-label={`Delete ${field.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Collapsible open={isOpen}>
                  <CollapsibleContent>
                    <div className="space-y-6 px-4 pb-5 pt-5 sm:px-5">
                      <p className="text-sm text-muted-foreground">
                        {definition.helperText}
                      </p>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`label-${field.id}`}>Label</Label>
                          <Input
                            id={`label-${field.id}`}
                            value={field.label}
                            onChange={(event) =>
                              onFieldChange({ label: event.target.value })
                            }
                            placeholder={definition.defaultLabel}
                          />
                        </div>

                        <MappingKeyInput
                          fieldId={field.id}
                          value={field.mapping_key}
                          onChange={(mappingKey) =>
                            onFieldChange({ mapping_key: mappingKey })
                          }
                        />
                      </div>

                      {!isConsentField && (
                        <div className="rounded-xl border bg-muted/20 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <Label className="text-sm font-medium">
                                Required
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Require visitors to complete this field before
                                they can submit.
                              </p>
                            </div>
                            <Switch
                              checked={field.required}
                              onCheckedChange={(checked) =>
                                onFieldChange({ required: checked })
                              }
                            />
                          </div>
                        </div>
                      )}

                      <FieldTypeConfiguration
                        field={field}
                        compliance={compliance}
                        onFieldChange={onFieldChange}
                        onRulesChange={onRulesChange}
                        onComplianceChange={onComplianceChange}
                      />

                      {field.type !== "hidden" && (
                        <VisibilityRulesEditor
                          field={field}
                          fields={fields}
                          steps={steps}
                          onChange={onVisibilityRulesChange}
                        />
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          );
        }}
      </Draggable>

      {insertAfter}
    </>
  );
}

function InlineEditableLabel({
  value,
  fallbackValue,
  onCommit,
}: {
  value: string;
  fallbackValue: string;
  onCommit: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commitValue = () => {
    const nextValue = draftValue.trim() || fallbackValue;
    if (nextValue !== value) {
      onCommit(nextValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        value={draftValue}
        autoFocus
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={commitValue}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitValue();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraftValue(value);
            setIsEditing(false);
          }
        }}
        className="h-8 max-w-sm"
      />
    );
  }

  return (
    <button
      type="button"
      className="max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary"
      onClick={(event) => {
        event.stopPropagation();
        setIsEditing(true);
      }}
    >
      {value || fallbackValue}
    </button>
  );
}

function MappingKeyInput({
  fieldId,
  value,
  onChange,
}: {
  fieldId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`mapping-${fieldId}`}>CRM Mapping Key</Label>
      <Autocomplete
        id={`mapping-${fieldId}`}
        value={value}
        onChange={(nextValue) => onChange(sanitizeMappingKey(nextValue))}
        suggestions={CRM_FIELD_MAPPING_SUGGESTIONS}
        placeholder="e.g. email, first_name, or custom key"
        description="Pick a suggested CRM key or enter a free-text mapping."
        allowCustomValue={true}
        suggestionsLabel="Suggested CRM keys"
        emptyText="No match — your custom key will be used."
      />
    </div>
  );
}

function VisibilityRulesEditor({
  field,
  fields,
  steps,
  onChange,
}: {
  field: FormField;
  fields: FormField[];
  steps: FormStep[];
  onChange: (rules: FormVisibilityRule[]) => void;
}) {
  const rules = useMemo(
    () => normalizeVisibilityRules(field.visibility_rules),
    [field.visibility_rules],
  );
  const availableSourceFields = useMemo(
    () => getAvailableConditionSourceFields(fields, field.id, steps),
    [field.id, fields, steps],
  );
  const enabled = rules.length > 0;

  const updateRule = (
    ruleIndex: number,
    updates: Partial<FormVisibilityRule>,
  ) => {
    onChange(
      rules.map((rule, index) => {
        if (index !== ruleIndex) {
          return rule;
        }

        const nextRule: FormVisibilityRule = {
          ...rule,
          ...updates,
        };

        if (!operatorNeedsValue(nextRule.operator)) {
          delete nextRule.value;
        }

        return nextRule;
      }),
    );
  };

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">Conditional Visibility</Label>
          <p className="text-xs text-muted-foreground">
            All rules must match. Only earlier visible fields can be used as
            conditions.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={availableSourceFields.length === 0}
          onCheckedChange={(checked) => {
            if (!checked) {
              onChange([]);
              return;
            }

            onChange([createVisibilityRule(availableSourceFields[0])]);
          }}
        />
      </div>

      {availableSourceFields.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <p>
            Add at least one earlier non-hidden field before enabling
            conditions.
          </p>
        </div>
      ) : null}

      {enabled && (
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const selectedSourceField =
              availableSourceFields.find(
                (sourceField) => sourceField.id === rule.field_id,
              ) ?? availableSourceFields[0];

            return (
              <div
                key={`${field.id}-visibility-${index}`}
                className="space-y-3 rounded-lg border bg-background p-3"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>When field</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={rule.field_id}
                      onChange={(event) => {
                        const nextField = availableSourceFields.find(
                          (sourceField) =>
                            sourceField.id === event.target.value,
                        );
                        updateRule(index, {
                          field_id: event.target.value,
                          value: getDefaultRuleValue(nextField),
                        });
                      }}
                    >
                      {availableSourceFields.map((sourceField) => (
                        <option key={sourceField.id} value={sourceField.id}>
                          {sourceField.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={rule.operator}
                      onChange={(event) => {
                        const nextOperator = event.target
                          .value as FormVisibilityOperator;
                        updateRule(index, {
                          operator: nextOperator,
                          value: operatorNeedsValue(nextOperator)
                            ? (rule.value ??
                              getDefaultRuleValue(selectedSourceField))
                            : undefined,
                        });
                      }}
                    >
                      {(
                        [
                          "equals",
                          "not_equals",
                          "contains",
                          "not_empty",
                          "is_empty",
                        ] as FormVisibilityOperator[]
                      ).map((operator) => (
                        <option key={operator} value={operator}>
                          {getOperatorLabel(operator)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Value</Label>
                    {operatorNeedsValue(rule.operator) ? (
                      <Input
                        value={rule.value ?? ""}
                        onChange={(event) =>
                          updateRule(index, {
                            value: event.target.value,
                          })
                        }
                        placeholder={
                          selectedSourceField?.type === "checkbox"
                            ? "true"
                            : "Value to match"
                        }
                      />
                    ) : (
                      <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                        No value needed
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-destructive hover:text-destructive"
                    onClick={() =>
                      onChange(
                        rules.filter((_, ruleIndex) => ruleIndex !== index),
                      )
                    }
                    aria-label="Remove visibility rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([
                ...rules,
                createVisibilityRule(availableSourceFields[0]),
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldTypeConfiguration({
  field,
  compliance,
  onFieldChange,
  onRulesChange,
  onComplianceChange,
}: {
  field: FormField;
  compliance: FormCompliance;
  onFieldChange: (updates: Partial<FormField>) => void;
  onRulesChange: (rules: FormFieldRules) => void;
  onComplianceChange: (compliance: FormCompliance) => void;
}) {
  const rules = useMemo(() => normalizeRules(field.rules), [field.rules]);

  const updateRules = (updates: Partial<FormFieldRules>) => {
    onRulesChange({
      ...rules,
      ...updates,
    });
  };

  if (field.type === "select") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor={`placeholder-${field.id}`}>Placeholder</Label>
          <Input
            id={`placeholder-${field.id}`}
            value={field.placeholder || ""}
            onChange={(event) =>
              onFieldChange({ placeholder: event.target.value })
            }
            placeholder="Select an option"
          />
        </div>

        <SelectOptionsEditor field={field} onFieldChange={onFieldChange} />
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-medium">Default Checked</Label>
            <p className="text-xs text-muted-foreground">
              Start the checkbox in a checked state for preview and public
              forms.
            </p>
          </div>
          <Switch
            checked={field.default_value === true}
            onCheckedChange={(checked) =>
              onFieldChange({ default_value: checked })
            }
          />
        </div>
      </div>
    );
  }

  if (field.type === "hidden") {
    return (
      <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
        <Label htmlFor={`default-${field.id}`}>Default Value</Label>
        <Input
          id={`default-${field.id}`}
          value={
            typeof field.default_value === "string" ? field.default_value : ""
          }
          onChange={(event) =>
            onFieldChange({ default_value: event.target.value })
          }
          placeholder="utm_campaign=spring-launch"
        />
        <p className="text-xs text-muted-foreground">
          Hidden values are injected into the submission payload without being
          visible to visitors.
        </p>
      </div>
    );
  }

  if (field.type === "file") {
    const allowedMimeTypes = rules.allowed_mime_types || [];
    const matchesImagesPreset = hasMatchingMimeTypePreset(
      allowedMimeTypes,
      formUploadConfig.FILE_TYPE_PRESETS.images,
    );
    const matchesDocumentsPreset = hasMatchingMimeTypePreset(
      allowedMimeTypes,
      formUploadConfig.FILE_TYPE_PRESETS.documents,
    );

    return (
      <div className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm text-muted-foreground">
            File uploads stay private. Visitors upload to temporary storage and
            files are finalized only after the form is submitted.
          </p>
        </Alert>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`max-files-${field.id}`}>Maximum Files</Label>
            <Input
              id={`max-files-${field.id}`}
              type="number"
              min={1}
              max={10}
              value={rules.max_files ?? 1}
              onChange={(event) => {
                const value = event.target.value;
                updateRules({
                  max_files: value === "" ? 1 : Number(value),
                });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`max-file-size-${field.id}`}>
              Max File Size (MB)
            </Label>
            <Input
              id={`max-file-size-${field.id}`}
              type="number"
              min={1}
              max={formUploadConfig.FORM_UPLOAD_MAX_FILE_SIZE_MB}
              value={rules.max_file_size_mb ?? 10}
              onChange={(event) => {
                const value = event.target.value;
                updateRules({
                  max_file_size_mb: value === "" ? 10 : Number(value),
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Bucket-wide uploads are capped at{" "}
              {formUploadConfig.FORM_UPLOAD_MAX_FILE_SIZE_MB} MB.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">Accepted File Types</Label>
              <p className="text-xs text-muted-foreground">
                Leave blank to accept any file type. Use MIME types, wildcards,
                or extensions.
              </p>
            </div>
            <Badge variant="outline">
              {allowedMimeTypes.length === 0
                ? "Any type"
                : `${allowedMimeTypes.length} rule${allowedMimeTypes.length === 1 ? "" : "s"}`}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={allowedMimeTypes.length === 0 ? "default" : "outline"}
              size="sm"
              onClick={() => updateRules({ allowed_mime_types: [] })}
            >
              Any file
            </Button>
            <Button
              type="button"
              variant={matchesImagesPreset ? "default" : "outline"}
              size="sm"
              onClick={() =>
                updateRules({
                  allowed_mime_types: [
                    ...formUploadConfig.FILE_TYPE_PRESETS.images,
                  ],
                })
              }
            >
              Images
            </Button>
            <Button
              type="button"
              variant={matchesDocumentsPreset ? "default" : "outline"}
              size="sm"
              onClick={() =>
                updateRules({
                  allowed_mime_types: [
                    ...formUploadConfig.FILE_TYPE_PRESETS.documents,
                  ],
                })
              }
            >
              Documents
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`allowed-types-${field.id}`}>
              Accepted Types List
            </Label>
            <Input
              id={`allowed-types-${field.id}`}
              value={formatMimeTypeList(allowedMimeTypes)}
              onChange={(event) =>
                updateRules({
                  allowed_mime_types: parseMimeTypeList(event.target.value),
                })
              }
              placeholder="image/*, application/pdf, .docx"
            />
            <p className="text-xs text-muted-foreground">
              Examples: image/*, application/pdf, .csv, .zip
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (field.type === "email_consent" || field.type === "sms_consent") {
    const consentText = getConsentText(field.type, compliance);
    const isEmailConsent = field.type === "email_consent";

    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Compliance Field
              </p>
              <p className="text-xs text-muted-foreground">
                {isEmailConsent
                  ? "Use clear email-marketing language so contacts understand what they are consenting to receive."
                  : "Use clear TCPA-compliant SMS language and pair this field with a phone number field."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`consent-text-${field.id}`}>Consent Text</Label>
          <Textarea
            id={`consent-text-${field.id}`}
            value={consentText}
            onChange={(event) => {
              const nextText = event.target.value;
              onComplianceChange({
                ...compliance,
                ...(isEmailConsent
                  ? { email_consent_text: nextText }
                  : { sms_consent_text: nextText }),
              });
            }}
            placeholder={
              isEmailConsent
                ? DEFAULT_FORM_COMPLIANCE.email_consent_text
                : DEFAULT_FORM_COMPLIANCE.sms_consent_text
            }
          />
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">Required</Label>
              <p className="text-xs text-muted-foreground">
                Require visitors to explicitly grant this consent before
                submitting.
              </p>
            </div>
            <Switch
              checked={field.required}
              onCheckedChange={(checked) => {
                onFieldChange({ required: checked });
                onComplianceChange({
                  ...compliance,
                  ...(isEmailConsent
                    ? { email_consent_required: checked }
                    : { sms_consent_required: checked }),
                });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (
    field.type === "text" ||
    field.type === "email" ||
    field.type === "phone"
  ) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`placeholder-${field.id}`}>Placeholder</Label>
            <Input
              id={`placeholder-${field.id}`}
              value={field.placeholder || ""}
              onChange={(event) =>
                onFieldChange({ placeholder: event.target.value })
              }
              placeholder="Shown before the visitor starts typing"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`default-${field.id}`}>Default Value</Label>
            <Input
              id={`default-${field.id}`}
              value={
                typeof field.default_value === "string"
                  ? field.default_value
                  : ""
              }
              onChange={(event) =>
                onFieldChange({ default_value: event.target.value })
              }
              placeholder="Prefill the field value"
            />
          </div>
        </div>

        <ValidationRulesEditor
          field={field}
          rules={rules}
          onRulesChange={updateRules}
        />

        {(field.type === "email" || field.type === "phone") && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm text-muted-foreground">
              {field.type === "email"
                ? "Email fields are normalized before submission and validated for standard email syntax."
                : "Phone fields are normalized before submission. Pair SMS consent with at least one phone field in the form."}
            </p>
          </Alert>
        )}
      </div>
    );
  }

  return null;
}

function ValidationRulesEditor({
  field,
  rules,
  onRulesChange,
}: {
  field: FormField;
  rules: FormFieldRules;
  onRulesChange: (updates: Partial<FormFieldRules>) => void;
}) {
  const [isPatternEditorOpen, setIsPatternEditorOpen] = useState(
    Boolean(rules.pattern),
  );
  const patternIsValid = isPatternSyntaxValid(rules.pattern);

  useEffect(() => {
    if (rules.pattern) {
      setIsPatternEditorOpen(true);
    }
  }, [rules.pattern]);

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <Label className="text-sm font-medium">Validation Rules</Label>
        <p className="text-xs text-muted-foreground">
          Add optional length requirements or a custom regex pattern.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`min-length-${field.id}`}>Minimum Length</Label>
          <Input
            id={`min-length-${field.id}`}
            type="number"
            min={0}
            value={rules.min_length ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onRulesChange({
                min_length: value === "" ? undefined : Number(value),
              });
            }}
            placeholder="No minimum"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`max-length-${field.id}`}>Maximum Length</Label>
          <Input
            id={`max-length-${field.id}`}
            type="number"
            min={0}
            value={rules.max_length ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onRulesChange({
                max_length: value === "" ? undefined : Number(value),
              });
            }}
            placeholder="No maximum"
          />
        </div>
      </div>

      <Collapsible
        open={isPatternEditorOpen}
        onOpenChange={setIsPatternEditorOpen}
      >
        <div className="rounded-lg border bg-background">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  Custom Regex Pattern
                </p>
                <p className="text-xs text-muted-foreground">
                  Use advanced validation for highly specific formats.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isPatternEditorOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-4 border-t px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor={`pattern-${field.id}`}>Regex Pattern</Label>
                <Input
                  id={`pattern-${field.id}`}
                  value={rules.pattern ?? ""}
                  onChange={(event) =>
                    onRulesChange({
                      pattern: event.target.value || undefined,
                    })
                  }
                  placeholder="^[A-Z]{3}-\\d{4}$"
                />
                {!patternIsValid && rules.pattern ? (
                  <p className="text-xs text-destructive">
                    This regex pattern is not valid JavaScript syntax.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The pattern is tested with JavaScript regular-expression
                    syntax.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`pattern-message-${field.id}`}>
                  Error Message
                </Label>
                <Input
                  id={`pattern-message-${field.id}`}
                  value={rules.pattern_message ?? ""}
                  onChange={(event) =>
                    onRulesChange({
                      pattern_message: event.target.value || undefined,
                    })
                  }
                  placeholder="Please use the expected format"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

function SelectOptionsEditor({
  field,
  onFieldChange,
}: {
  field: FormField;
  onFieldChange: (updates: Partial<FormField>) => void;
}) {
  const options = getFieldOptions(field);

  const updateOption = (index: number, nextValue: string) => {
    const nextOptions = options.map((option, optionIndex) =>
      optionIndex === index ? nextValue : option,
    );

    onFieldChange({
      options: nextOptions,
    });
  };

  const removeOption = (index: number) => {
    const nextOptions = options.filter(
      (_, optionIndex) => optionIndex !== index,
    );

    onFieldChange({
      options: nextOptions.length > 0 ? nextOptions : ["Option 1"],
    });
  };

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">Options</Label>
          <p className="text-xs text-muted-foreground">
            Reorder the options visitors can choose from.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onFieldChange({
              options: [...options, `Option ${options.length + 1}`],
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Option
        </Button>
      </div>

      <Droppable
        droppableId={`${FIELD_OPTIONS_PREFIX}${field.id}`}
        type="option"
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "space-y-2 rounded-xl border bg-background p-3",
              snapshot.isDraggingOver && "border-primary/40 bg-primary/5",
            )}
          >
            {options.map((option, index) => (
              <Draggable
                key={`${field.id}-option-${index}`}
                draggableId={`${field.id}-option-${index}`}
                index={index}
              >
                {(draggableProvided, draggableSnapshot) => {
                  const optionDraggableId = `${field.id}-option-${index}`;
                  const isOptionDragActive =
                    draggableSnapshot.isDragging ||
                    draggableSnapshot.isDropAnimating;
                  const optionDragDimensions =
                    draggableDimensionsStore.get(optionDraggableId);

                  return (
                    <div
                      ref={(node) =>
                        assignMeasuredDraggableNode(
                          node,
                          draggableProvided.innerRef,
                          optionDraggableId,
                        )
                      }
                      {...draggableProvided.draggableProps}
                      style={getActiveDraggableStyle(
                        draggableProvided.draggableProps.style,
                        isOptionDragActive,
                        optionDragDimensions,
                        draggableSnapshot.isDropAnimating,
                      )}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2",
                        draggableSnapshot.isDragging &&
                          "relative border-primary/40 shadow-lg ring-2 ring-primary/20",
                      )}
                    >
                      <button
                        type="button"
                        {...draggableProvided.dragHandleProps}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                        aria-label={`Reorder option ${index + 1}`}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <Input
                        value={option}
                        onChange={(event) =>
                          updateOption(index, event.target.value)
                        }
                        onBlur={(event) =>
                          updateOption(
                            index,
                            normalizeOptionValue(event.target.value),
                          )
                        }
                        placeholder={`Option ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeOption(index)}
                        aria-label={`Remove option ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                }}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
