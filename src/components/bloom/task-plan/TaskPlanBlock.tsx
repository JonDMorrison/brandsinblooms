import * as React from "react";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Radio from "@mui/joy/Radio";
import RadioGroup from "@mui/joy/RadioGroup";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Info,
  Lightbulb,
  Pencil,
  Plus,
  Send,
  Shield,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { CompactConfirmation } from "@/components/bloom/task-plan/CompactConfirmation";
import type { Json } from "@/integrations/supabase/types";
import type {
  BloomEditableFieldMetadata,
  BloomEditedTaskFields,
  BloomFieldChange,
  BloomTaskJsonObject,
  BloomTaskPlan,
  BloomTaskPlanAction,
  BloomTaskPlanItem,
  BloomTaskRiskLevel,
  BloomValidationAnnotation,
} from "@/hooks/bloom/taskPlanTypes";

export interface TaskPlanBlockProps {
  plan: BloomTaskPlan;
  compact: boolean;
  onApprove: (
    approvedTaskIds: string[],
    editedFields: BloomEditedTaskFields,
  ) => void;
  onCancel: () => void;
  onDiscuss: (question: string) => void;
  isExecuting: boolean;
}

type EditedFieldInputState = Record<string, Record<string, string>>;

const actionIcons: Record<BloomTaskPlanAction, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  send: Send,
  schedule: Calendar,
  assign: Users,
  tag: Tag,
  consent_change: Shield,
};

const riskColor: Record<
  BloomTaskRiskLevel,
  "success" | "primary" | "warning" | "danger"
> = {
  safe: "success",
  low: "primary",
  medium: "warning",
  high: "danger",
};

const annotationColor: Record<
  BloomValidationAnnotation["type"],
  "warning" | "danger" | "primary" | "neutral"
> = {
  warning: "warning",
  error: "danger",
  suggestion: "primary",
  info: "neutral",
};

const annotationIcons: Record<BloomValidationAnnotation["type"], typeof Info> =
  {
    warning: AlertTriangle,
    error: AlertTriangle,
    suggestion: Lightbulb,
    info: Info,
  };

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const formatTaskValue = (value: Json | null): string => {
  if (value === null || value === undefined) {
    return "None";
  }

  if (typeof value === "string") {
    return value.trim() || "Empty";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
};

const hasErrorAnnotation = (task: BloomTaskPlanItem) =>
  task.validationAnnotations.some((annotation) => annotation.type === "error");

const selectedTaskIdsFor = (plan: BloomTaskPlan) =>
  plan.tasks
    .filter((task) => !hasErrorAnnotation(task))
    .map((task) => task.taskId);

const coerceEditedValue = (
  input: string,
  referenceValue: Json | null,
): Json => {
  const trimmedInput = input.trim();

  if (typeof referenceValue === "number") {
    const numericValue = Number(trimmedInput);
    return Number.isFinite(numericValue) ? numericValue : input;
  }

  if (typeof referenceValue === "boolean") {
    if (trimmedInput.toLowerCase() === "true") {
      return true;
    }
    if (trimmedInput.toLowerCase() === "false") {
      return false;
    }
  }

  return input;
};

const fieldReferenceValue = (
  task: BloomTaskPlanItem,
  fieldChange: BloomFieldChange,
) => {
  const toolParamValue = task.toolParams[fieldChange.field];
  return toolParamValue === undefined ? fieldChange.newValue : toolParamValue;
};

function renderDescription(task: BloomTaskPlanItem) {
  const entityName = task.entityName.trim();
  const description = task.description;
  const entityIndex = entityName
    ? description.toLowerCase().indexOf(entityName.toLowerCase())
    : -1;

  if (entityIndex < 0) {
    return description;
  }

  const before = description.slice(0, entityIndex);
  const match = description.slice(entityIndex, entityIndex + entityName.length);
  const after = description.slice(entityIndex + entityName.length);

  return (
    <>
      {before}
      <Typography component="span" fontWeight="lg">
        {match}
      </Typography>
      {after}
    </>
  );
}

function fieldRowsFor(task: BloomTaskPlanItem): BloomFieldChange[] {
  const fieldChanges = [...task.fieldChanges];
  const knownFields = new Set(
    fieldChanges.map((fieldChange) => fieldChange.field),
  );

  for (const field of task.editableFields) {
    if (!knownFields.has(field)) {
      const value = task.toolParams[field];
      fieldChanges.push({ field, currentValue: null, newValue: value ?? null });
    }
  }

  return fieldChanges;
}

const fieldLabel = (
  field: string,
  metadata: BloomEditableFieldMetadata | undefined,
) => metadata?.label?.trim() || field.replace(/_/g, " ");

const optionInputValue = (value: Json | null): string => formatTaskValue(value);

function buildEditedFields(
  plan: BloomTaskPlan,
  editedInputs: EditedFieldInputState,
): BloomEditedTaskFields {
  const editedFields: BloomEditedTaskFields = {};

  for (const task of plan.tasks) {
    const taskInputs = editedInputs[task.taskId];
    if (!taskInputs) {
      continue;
    }

    const taskPayload: BloomTaskJsonObject = {};
    for (const fieldChange of fieldRowsFor(task)) {
      const editedValue = taskInputs[fieldChange.field];
      if (editedValue === undefined) {
        continue;
      }

      const originalDisplayValue = formatTaskValue(fieldChange.newValue);
      if (editedValue === originalDisplayValue) {
        continue;
      }

      taskPayload[fieldChange.field] = coerceEditedValue(
        editedValue,
        fieldReferenceValue(task, fieldChange),
      );
    }

    if (Object.keys(taskPayload).length > 0) {
      editedFields[task.taskId] = taskPayload;
    }
  }

  return editedFields;
}

function ValidationAnnotationChip({
  annotation,
  disabled,
  onDiscuss,
}: {
  annotation: BloomValidationAnnotation;
  disabled: boolean;
  onDiscuss: (question: string) => void;
}) {
  const Icon = annotationIcons[annotation.type];
  const clickable = annotation.type === "suggestion" && !disabled;

  return (
    <JoyTooltip
      title={`${capitalize(annotation.step.replace(/_/g, " "))}: ${annotation.message}`}
    >
      <JoyChip
        color={annotationColor[annotation.type]}
        size="sm"
        variant="soft"
        onClick={clickable ? () => onDiscuss(annotation.message) : undefined}
        startDecorator={<Icon size={13} />}
        sx={{
          maxWidth: "100%",
          cursor: clickable ? "pointer" : "default",
          "& .MuiChip-label": {
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        }}
      >
        {annotation.message}
      </JoyChip>
    </JoyTooltip>
  );
}

function TaskPlanDetails({
  editedInputs,
  isExecuting,
  onEditedInputChange,
  task,
  tasksById,
}: {
  editedInputs: EditedFieldInputState;
  isExecuting: boolean;
  onEditedInputChange: (taskId: string, field: string, value: string) => void;
  task: BloomTaskPlanItem;
  tasksById: Map<string, BloomTaskPlanItem>;
}) {
  const rows = fieldRowsFor(task);
  const metadataByField = React.useMemo(
    () =>
      new Map(
        task.editableFieldMetadata.map((metadata) => [
          metadata.field,
          metadata,
        ]),
      ),
    [task.editableFieldMetadata],
  );

  return (
    <Stack spacing={1} sx={{ pl: { xs: 0, sm: 5 }, pt: 1 }}>
      {rows.length > 0 ? (
        <Stack spacing={0.75}>
          {rows.map((fieldChange) => {
            const editable = task.editableFields.includes(fieldChange.field);
            const metadata = metadataByField.get(fieldChange.field);
            const label = fieldLabel(fieldChange.field, metadata);
            const value =
              editedInputs[task.taskId]?.[fieldChange.field] ??
              formatTaskValue(fieldChange.newValue);

            return (
              <Stack
                key={fieldChange.field}
                direction={{ xs: "column", sm: "row" }}
                spacing={0.75}
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ minWidth: { sm: 120 }, flexShrink: 0 }}
                >
                  <Typography
                    level="body-xs"
                    sx={{ color: "neutral.500", overflowWrap: "anywhere" }}
                  >
                    {label}
                  </Typography>
                  {metadata?.autoGenerated ? (
                    <JoyTooltip title="AI-generated draft">
                      <Box
                        sx={{ color: "primary.500", display: "inline-flex" }}
                      >
                        <Sparkles size={13} strokeWidth={1.9} />
                      </Box>
                    </JoyTooltip>
                  ) : null}
                </Stack>
                {editable ? (
                  metadata?.inputType === "select" &&
                  metadata.options.length > 0 ? (
                    <RadioGroup
                      aria-label={`${label} for ${task.description}`}
                      value={value}
                      onChange={(event) =>
                        onEditedInputChange(
                          task.taskId,
                          fieldChange.field,
                          event.target.value,
                        )
                      }
                      sx={{ gap: 0.75, width: "100%", maxWidth: { sm: 560 } }}
                    >
                      {metadata.options.map((option) => {
                        const optionValue = optionInputValue(option.value);
                        return (
                          <Radio
                            key={option.id}
                            disabled={isExecuting}
                            label={option.label}
                            size="sm"
                            value={optionValue}
                            sx={{
                              alignItems: "flex-start",
                              color: "neutral.700",
                              "& .MuiRadio-label": {
                                overflowWrap: "anywhere",
                                lineHeight: 1.45,
                              },
                            }}
                          />
                        );
                      })}
                    </RadioGroup>
                  ) : metadata?.inputType === "textarea" ? (
                    <JoyTextarea
                      aria-label={`${label} for ${task.description}`}
                      disabled={isExecuting}
                      minRows={4}
                      size="sm"
                      value={value}
                      onChange={(event) =>
                        onEditedInputChange(
                          task.taskId,
                          fieldChange.field,
                          event.target.value,
                        )
                      }
                      sx={{ maxWidth: { sm: 560 } }}
                    />
                  ) : (
                    <Input
                      aria-label={`${label} for ${task.description}`}
                      disabled={isExecuting}
                      size="sm"
                      value={value}
                      onChange={(event) =>
                        onEditedInputChange(
                          task.taskId,
                          fieldChange.field,
                          event.target.value,
                        )
                      }
                      sx={{
                        minHeight: 32,
                        maxWidth: { sm: 360 },
                        backgroundColor: "background.surface",
                      }}
                    />
                  )
                ) : (
                  <Typography
                    level="body-xs"
                    sx={{ color: "neutral.700", overflowWrap: "anywhere" }}
                  >
                    {formatTaskValue(fieldChange.currentValue)} to{" "}
                    {formatTaskValue(fieldChange.newValue)}
                  </Typography>
                )}
              </Stack>
            );
          })}
        </Stack>
      ) : null}

      {task.dependsOn.length > 0 ? (
        <Stack spacing={0.5}>
          {task.dependsOn.map((dependencyId) => {
            const dependency = tasksById.get(dependencyId);
            return (
              <Typography
                key={dependencyId}
                level="body-xs"
                sx={{ color: "neutral.400", overflowWrap: "anywhere" }}
              >
                Depends on: {dependency?.description ?? dependencyId}
              </Typography>
            );
          })}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function TaskPlanBlock({
  compact,
  isExecuting,
  onApprove,
  onCancel,
  onDiscuss,
  plan,
}: TaskPlanBlockProps) {
  const reducedMotion = useBloomReducedMotion();
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(
    () => new Set(selectedTaskIdsFor(plan)),
  );
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [editedInputs, setEditedInputs] = React.useState<EditedFieldInputState>(
    {},
  );
  const [discussOpen, setDiscussOpen] = React.useState(false);
  const [discussValue, setDiscussValue] = React.useState("");
  const [isCanceled, setIsCanceled] = React.useState(false);

  React.useEffect(() => {
    setSelectedTaskIds(new Set(selectedTaskIdsFor(plan)));
    setExpandedTaskIds(new Set());
    setEditedInputs({});
    setDiscussOpen(false);
    setDiscussValue("");
    setIsCanceled(false);
  }, [plan.planId]);

  const tasksById = React.useMemo(
    () => new Map(plan.tasks.map((task) => [task.taskId, task])),
    [plan.tasks],
  );
  const selectedCount = selectedTaskIds.size;
  const allTasksChecked =
    plan.tasks.length > 0 && selectedCount === plan.tasks.length;
  const controlsDisabled = isExecuting || isCanceled;

  const setTaskSelected = React.useCallback(
    (taskId: string, checked: boolean) => {
      setSelectedTaskIds((current) => {
        const next = new Set(current);
        if (checked) {
          next.add(taskId);
        } else {
          next.delete(taskId);
        }
        return next;
      });
    },
    [],
  );

  const toggleExpanded = React.useCallback((taskId: string) => {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const onEditedInputChange = React.useCallback(
    (taskId: string, field: string, value: string) => {
      setEditedInputs((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? {}),
          [field]: value,
        },
      }));
    },
    [],
  );

  const submitApproval = React.useCallback(() => {
    if (selectedTaskIds.size === 0 || controlsDisabled) {
      return;
    }

    onApprove([...selectedTaskIds], buildEditedFields(plan, editedInputs));
  }, [controlsDisabled, editedInputs, onApprove, plan, selectedTaskIds]);

  const submitDiscussion = React.useCallback(() => {
    const question = discussValue.trim();
    if (!question) {
      return;
    }
    onDiscuss(question);
    setDiscussValue("");
    setDiscussOpen(false);
  }, [discussValue, onDiscuss]);

  if (compact && plan.compactConfirmation) {
    return (
      <CompactConfirmation
        currentValue={formatTaskValue(plan.compactConfirmation.currentValue)}
        entityName={plan.compactConfirmation.entityName}
        fieldName={plan.compactConfirmation.fieldName}
        isExecuting={isExecuting}
        newValue={formatTaskValue(plan.compactConfirmation.newValue)}
        onCancel={onCancel}
        onConfirm={() =>
          onApprove(
            plan.tasks.map((task) => task.taskId),
            {},
          )
        }
      />
    );
  }

  return (
    <JoyCard
      variant="outlined"
      sx={{
        width: "100%",
        transition: reducedMotion
          ? "none"
          : "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: isExecuting ? 0.72 : 1,
      }}
    >
      <Stack spacing={0}>
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.75, py: 1.5 }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <ClipboardList size={17} strokeWidth={1.9} />
            <Typography level="title-sm" sx={{ color: "neutral.800" }}>
              Task Execution Plan
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            {isCanceled ? (
              <JoyChip color="neutral" size="sm" variant="soft">
                Canceled
              </JoyChip>
            ) : null}
            <JoyChip color="neutral" size="sm" variant="soft">
              {plan.tasks.length} {plan.tasks.length === 1 ? "task" : "tasks"}
            </JoyChip>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={0}>
          {plan.tasks.map((task, index) => {
            const ActionIcon = actionIcons[task.action];
            const expanded = expandedTaskIds.has(task.taskId);
            const hasError = hasErrorAnnotation(task);
            const checked = selectedTaskIds.has(task.taskId) && !hasError;

            return (
              <Box key={task.taskId}>
                <Box
                  sx={{
                    px: 1.75,
                    py: 1.5,
                    opacity: checked || hasError ? 1 : 0.4,
                    transition: reducedMotion ? "none" : "opacity 150ms ease",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Checkbox
                      aria-label={`Approve ${task.description}`}
                      checked={checked}
                      disabled={controlsDisabled || hasError}
                      onChange={(event) =>
                        setTaskSelected(task.taskId, event.target.checked)
                      }
                      sx={{ mt: 0.15 }}
                    />
                    <Box
                      sx={{
                        color: "neutral.600",
                        display: "inline-flex",
                        flexShrink: 0,
                        pt: 0.25,
                      }}
                    >
                      <ActionIcon size={16} strokeWidth={1.9} />
                    </Box>
                    <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={0.75}
                        alignItems={{ xs: "stretch", sm: "center" }}
                        justifyContent="space-between"
                      >
                        <Typography
                          level="body-sm"
                          sx={{
                            color: "neutral.800",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {renderDescription(task)}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          sx={{ flexShrink: 0 }}
                        >
                          <JoyChip
                            aria-label={`${capitalize(task.riskLevel)} risk`}
                            color={riskColor[task.riskLevel]}
                            size="sm"
                            variant="soft"
                          >
                            {capitalize(task.riskLevel)}
                          </JoyChip>
                          <IconButton
                            aria-label={
                              expanded
                                ? "Collapse task details"
                                : "Expand task details"
                            }
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={() => toggleExpanded(task.taskId)}
                            sx={{ minHeight: 28, width: 28, height: 28 }}
                          >
                            {expanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </IconButton>
                        </Stack>
                      </Stack>

                      {task.validationAnnotations.length > 0 ? (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          useFlexGap
                          sx={{ flexWrap: "wrap" }}
                        >
                          {task.validationAnnotations.map(
                            (annotation, annotationIndex) => (
                              <ValidationAnnotationChip
                                key={`${annotation.type}-${annotation.step}-${annotationIndex}`}
                                annotation={annotation}
                                disabled={controlsDisabled}
                                onDiscuss={onDiscuss}
                              />
                            ),
                          )}
                        </Stack>
                      ) : null}

                      {expanded ? (
                        <TaskPlanDetails
                          editedInputs={editedInputs}
                          isExecuting={controlsDisabled}
                          onEditedInputChange={onEditedInputChange}
                          task={task}
                          tasksById={tasksById}
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
                {index < plan.tasks.length - 1 ? <Divider /> : null}
              </Box>
            );
          })}
        </Stack>

        <Divider />

        <Stack spacing={1} sx={{ px: 1.75, py: 1.5 }}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            {isExecuting ? (
              <JoyButton color="neutral" disabled size="sm" variant="plain">
                Executing...
              </JoyButton>
            ) : allTasksChecked ? (
              <JoyButton
                color="primary"
                disabled={controlsDisabled || selectedCount === 0}
                size="sm"
                variant="solid"
                onClick={submitApproval}
              >
                Approve All
              </JoyButton>
            ) : (
              <JoyButton
                color="primary"
                disabled={controlsDisabled || selectedCount === 0}
                size="sm"
                variant="outlined"
                onClick={submitApproval}
              >
                Approve Selected ({selectedCount})
              </JoyButton>
            )}
            <JoyButton
              color="neutral"
              disabled={controlsDisabled}
              size="sm"
              variant="plain"
              onClick={() => {
                setIsCanceled(true);
                onCancel();
              }}
            >
              Cancel
            </JoyButton>
            <JoyButton
              color="primary"
              disabled={controlsDisabled}
              size="sm"
              variant="plain"
              onClick={() => setDiscussOpen((current) => !current)}
            >
              Discuss
            </JoyButton>
          </Stack>

          {discussOpen ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Input
                aria-label="Ask about this task plan"
                disabled={controlsDisabled}
                placeholder="Ask about this plan..."
                size="sm"
                value={discussValue}
                onChange={(event) => setDiscussValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitDiscussion();
                  }
                }}
                sx={{
                  flex: 1,
                  minHeight: 34,
                  backgroundColor: "background.surface",
                }}
              />
              <JoyButton
                color="primary"
                disabled={controlsDisabled || discussValue.trim().length === 0}
                size="sm"
                variant="outlined"
                onClick={submitDiscussion}
              >
                Ask
              </JoyButton>
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    </JoyCard>
  );
}
