import * as React from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DragUpdate,
  type DropResult,
} from "@hello-pangea/dnd";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  Copy,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  MoreVertical,
  PanelLeft,
  Plus,
  Redo2,
  Search,
  Settings2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { FormBuilderSettingsDrawer } from "@/components/forms/build/FormBuilderSettingsDrawer";
import { FormFieldItem } from "@/components/forms/build/FormFieldItem";
import { InlineFieldEditor } from "@/components/forms/build/InlineFieldEditor";
import { createFormBuilderTokens } from "@/components/forms/build/formBuilderTokens";
import { FormTemplatesDialog } from "@/components/forms/FormTemplatesDialog";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyInput } from "@/components/joy/JoyInput";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/hooks/use-toast";
import {
  canAddFieldType,
  createFieldFromType,
  getFieldDefinition,
  type FieldTypeDefinition,
} from "@/lib/forms/fieldRegistry";
import {
  createDefaultFormStep,
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
  FormFieldType,
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

interface DropIndicatorTarget {
  insertionIndex: number;
  stepIndex: number;
}

interface PendingStepDeletion {
  fieldCount: number;
  index: number;
  label: string;
}

const MAX_HISTORY_ENTRIES = 50;
const STEP_DROPPABLE_ID = "builder-steps";
const FIELD_DROPPABLE_PREFIX = "field-list-";
const STEP_TARGET_DROPPABLE_PREFIX = "step-target-";
const PALETTE_DND_MIME_TYPE = "application/x-bloomsuite-form-field-type";

const FIELD_PALETTE_GROUPS: Array<{
  title: string;
  types: FormFieldType[];
}> = [
  {
    title: "Contact",
    types: ["text", "email", "phone"],
  },
  {
    title: "Choice",
    types: ["select", "checkbox"],
  },
  {
    title: "Advanced",
    types: ["file", "hidden"],
  },
  {
    title: "Consent",
    types: ["email_consent", "sms_consent", "segment_checkbox"],
  },
];

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

function getStepLabel(step: Pick<FormStep, "index" | "title">) {
  const trimmedTitle = step.title?.trim();
  return trimmedTitle ? trimmedTitle : `Step ${step.index + 1}`;
}

function getFieldListDroppableId(stepIndex: number) {
  return `${FIELD_DROPPABLE_PREFIX}${stepIndex}`;
}

function getStepTargetDroppableId(stepIndex: number) {
  return `${STEP_TARGET_DROPPABLE_PREFIX}${stepIndex}`;
}

function parseFieldDroppableId(droppableId: string): {
  kind: "list" | "step-target";
  stepIndex: number;
} | null {
  if (droppableId.startsWith(FIELD_DROPPABLE_PREFIX)) {
    return {
      kind: "list",
      stepIndex: Number.parseInt(
        droppableId.slice(FIELD_DROPPABLE_PREFIX.length),
        10,
      ),
    };
  }

  if (droppableId.startsWith(STEP_TARGET_DROPPABLE_PREFIX)) {
    return {
      kind: "step-target",
      stepIndex: Number.parseInt(
        droppableId.slice(STEP_TARGET_DROPPABLE_PREFIX.length),
        10,
      ),
    };
  }

  return null;
}

function getFieldInsertIndex(
  fields: FormField[],
  steps: FormStep[],
  stepIndex: number,
  stepInsertionIndex: number,
  multiStepEnabled: boolean,
) {
  if (!multiStepEnabled) {
    return stepInsertionIndex;
  }

  const targetGroup = groupFieldsByStep(fields, steps).find(
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
    const lastFieldId = targetGroup.fields[targetGroup.fields.length - 1]?.id;
    const lastFieldIndex = fields.findIndex((field) => field.id === lastFieldId);
    return lastFieldIndex === -1 ? fields.length : lastFieldIndex + 1;
  }

  const beforeFieldId = targetGroup.fields[stepInsertionIndex]?.id;
  const beforeFieldIndex = fields.findIndex((field) => field.id === beforeFieldId);

  return beforeFieldIndex === -1 ? fields.length : beforeFieldIndex;
}

function FieldDropIndicator({
  active,
  showGuide,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  active: boolean;
  showGuide: boolean;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
}) {
  return (
    <Box
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      sx={{
        position: "relative",
        height: active ? 18 : showGuide ? 12 : 8,
        opacity: active ? 1 : showGuide ? 0.16 : 0,
        transition: "opacity 150ms ease, height 150ms ease",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 8,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 2,
          borderRadius: 999,
          backgroundColor: "primary.500",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: "primary.500",
          boxShadow: "0 0 0 2px rgba(var(--joy-palette-common-whiteChannel) / 1)",
        }}
      />
    </Box>
  );
}

function PaletteFieldButton({
  compact = false,
  definition,
  disabled,
  onAdd,
  onDragEnd,
  onDragStart,
}: {
  compact?: boolean;
  definition: FieldTypeDefinition;
  disabled: boolean;
  onAdd: () => void;
  onDragEnd: React.DragEventHandler<HTMLButtonElement>;
  onDragStart: React.DragEventHandler<HTMLButtonElement>;
}) {
  const Icon = definition.icon;
  const tooltipTitle = disabled ? "Already added to this form" : definition.label;

  const content = (
    <Box
      component="button"
      type="button"
      draggable={!disabled}
      onClick={onAdd}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      sx={{
        width: "100%",
        display: "flex",
        alignItems: compact ? "center" : "flex-start",
        justifyContent: compact ? "center" : "flex-start",
        gap: compact ? 0 : 1,
        border: "1px solid",
        borderColor: disabled ? "neutral.200" : "neutral.200",
        borderRadius: compact ? "lg" : "lg",
        px: compact ? 0.75 : 1.1,
        py: compact ? 0.75 : 1,
        backgroundColor: "background.surface",
        color: disabled ? "neutral.400" : "neutral.700",
        cursor: disabled ? "not-allowed" : "grab",
        opacity: disabled ? 0.55 : 1,
        textAlign: "left",
        transition:
          "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background-color 160ms ease",
        "&:hover": {
          borderColor: disabled ? "neutral.200" : "neutral.300",
          backgroundColor: disabled ? "background.surface" : "neutral.50",
          boxShadow: disabled ? "none" : "var(--joy-shadow-sm)",
          transform: disabled ? "none" : "translateY(-1px)",
        },
      }}
    >
      <Box
        sx={{
          width: compact ? 28 : 30,
          height: compact ? 28 : 30,
          borderRadius: "md",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          backgroundColor:
            definition.category === "compliance"
              ? "warning.softBg"
              : "neutral.100",
          color:
            definition.category === "compliance"
              ? "warning.700"
              : "neutral.700",
        }}
      >
        <Icon size={16} />
      </Box>

      {!compact ? (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
            {definition.label}
          </Typography>
          <Typography level="body-xs" color="neutral">
            {disabled ? "Already added to this form" : definition.helperText}
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );

  return compact || disabled ? <Tooltip title={tooltipTitle}>{content}</Tooltip> : content;
}

function FieldPaletteSidebar({
  compact = false,
  fields,
  onAddFieldType,
  onOpenTemplates,
  onPaletteDragEnd,
  onPaletteDragStart,
}: {
  compact?: boolean;
  fields: FormField[];
  onAddFieldType: (type: FormFieldType) => void;
  onOpenTemplates: () => void;
  onPaletteDragEnd: React.DragEventHandler<HTMLButtonElement>;
  onPaletteDragStart: (
    type: FormFieldType,
  ) => React.DragEventHandler<HTMLButtonElement>;
}) {
  const [paletteQuery, setPaletteQuery] = React.useState("");

  const filteredGroups = React.useMemo(() => {
    const normalizedQuery = paletteQuery.trim().toLowerCase();

    return FIELD_PALETTE_GROUPS.map((group) => ({
      ...group,
      types: group.types.filter((type) => {
        if (!normalizedQuery) {
          return true;
        }

        const definition = getFieldDefinition(type);
        return [definition.label, definition.helperText, type]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    })).filter((group) => group.types.length > 0);
  }, [paletteQuery]);

  return (
    <Sheet
      data-field-palette="true"
      variant="outlined"
      sx={{
        borderRadius: "xl",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-sm)",
        p: compact ? 0.75 : 1.25,
      }}
    >
      <Stack spacing={compact ? 0.75 : 1.25}>
        {compact ? (
          <Tooltip title="Quick add text field">
            <IconButton
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => onAddFieldType("text")}
              sx={{ borderRadius: "lg" }}
            >
              <Plus size={16} />
            </IconButton>
          </Tooltip>
        ) : (
          <JoyButton
            size="sm"
            variant="outlined"
            color="neutral"
            startDecorator={<Plus size={16} />}
            onClick={() => onAddFieldType("text")}
          >
            Add field
          </JoyButton>
        )}

        {!compact ? (
          <JoyInput
            size="sm"
            value={paletteQuery}
            onValueChange={setPaletteQuery}
            placeholder="Search field types"
            leftIcon={<Search size={16} />}
          />
        ) : null}

        {filteredGroups.map((group, groupIndex) => (
          <React.Fragment key={group.title}>
            {groupIndex > 0 ? <Divider /> : null}
            {!compact ? (
              <Typography
                level="body-xs"
                sx={{
                  px: 0.25,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "neutral.500",
                }}
              >
                {group.title}
              </Typography>
            ) : null}

            <Stack spacing={0.75}>
              {group.types.map((type) => {
                const definition = getFieldDefinition(type);
                const disabled = !canAddFieldType(type, fields);

                return (
                  <PaletteFieldButton
                    key={type}
                    compact={compact}
                    definition={definition}
                    disabled={disabled}
                    onAdd={() => {
                      if (!disabled) {
                        onAddFieldType(type);
                      }
                    }}
                    onDragEnd={onPaletteDragEnd}
                    onDragStart={onPaletteDragStart(type)}
                  />
                );
              })}
            </Stack>
          </React.Fragment>
        ))}

        {!compact && filteredGroups.length === 0 ? (
          <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", px: 1.25, py: 1 }}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              No matching field types
            </Typography>
            <Typography level="body-xs" color="neutral">
              Try a broader search term or add a text field to start from the default canvas.
            </Typography>
          </Sheet>
        ) : null}

        <Divider />

        {compact ? (
          <Tooltip title="Templates">
            <IconButton
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={onOpenTemplates}
              sx={{ borderRadius: "lg" }}
            >
              <LayoutTemplate size={16} />
            </IconButton>
          </Tooltip>
        ) : (
          <JoyButton
            size="sm"
            bloomVariant="ghost"
            color="neutral"
            startDecorator={<LayoutTemplate size={16} />}
            onClick={onOpenTemplates}
          >
            Templates
          </JoyButton>
        )}
      </Stack>
    </Sheet>
  );
}

function FormBuildTabSkeleton({
  compactPalette,
}: {
  compactPalette: boolean;
}) {
  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: compactPalette
              ? "72px minmax(0, 1fr)"
              : "240px minmax(0, 1fr)",
            gap: 2,
            alignItems: "start",
          }}
        >
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "xl",
              backgroundColor: "background.surface",
              p: compactPalette ? 0.75 : 1.25,
            }}
          >
            <Stack spacing={compactPalette ? 0.75 : 1.25}>
              {compactPalette ? (
                <Skeleton variant="rectangular" width={40} height={40} sx={{ borderRadius: "lg" }} />
              ) : (
                <Skeleton variant="rectangular" width="100%" height={36} sx={{ borderRadius: "lg" }} />
              )}
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="rectangular"
                  width="100%"
                  height={compactPalette ? 44 : 54}
                  sx={{ borderRadius: "lg" }}
                />
              ))}
            </Stack>
          </Sheet>

          <Stack spacing={2}>
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 1.25 }}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    variant="rectangular"
                    width={index === 2 ? 40 : 110}
                    height={36}
                    sx={{ borderRadius: 999 }}
                  />
                ))}
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 1.25 }}>
              <Stack spacing={1.5}>
                <Skeleton variant="text" width={180} height={18} />
                <Skeleton variant="text" width="48%" height={34} />
                <Skeleton variant="text" width="72%" height={20} />
                <Divider />
                {Array.from({ length: 4 }).map((_, index) => (
                  <Stack key={index} direction="row" spacing={1.25}>
                    <Skeleton
                      variant="rectangular"
                      width={28}
                      height={72}
                      sx={{ borderRadius: "lg" }}
                    />
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={88}
                      sx={{ borderRadius: "lg" }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Sheet>
          </Stack>
        </Box>
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
  const isPaletteCompact = useMediaQuery("(max-width: 899.95px)");
  const isInspectorBottomSheet = useMediaQuery("(max-width: 1199.95px)");
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [paletteDrawerOpen, setPaletteDrawerOpen] = React.useState(false);
  const [focusedStepIndex, setFocusedStepIndex] = React.useState(0);
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(
    null,
  );
  const [stepTitleDraft, setStepTitleDraft] = React.useState("");
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(
    null,
  );
  const [pendingStepDeletion, setPendingStepDeletion] =
    React.useState<PendingStepDeletion | null>(null);
  const [paletteDragType, setPaletteDragType] =
    React.useState<FormFieldType | null>(null);
  const [nativeInsertTarget, setNativeInsertTarget] =
    React.useState<DropIndicatorTarget | null>(null);
  const [dragInsertTarget, setDragInsertTarget] =
    React.useState<{ droppableId: string; index: number } | null>(null);
  const [historyCounts, setHistoryCounts] = React.useState({
    undo: 0,
    redo: 0,
  });
  const [showInitialSkeleton, setShowInitialSkeleton] = React.useState(true);
  const builderRootRef = React.useRef<HTMLDivElement | null>(null);
  const stepTitleInputRef = React.useRef<HTMLInputElement | null>(null);
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
  const fieldCountsByStep = React.useMemo(
    () =>
      Object.fromEntries(
        stepGroups.map((group) => [group.step.index, group.fields.length]),
      ) as Record<number, number>,
    [stepGroups],
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
  const selectedField = React.useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId],
  );
  const selectedFieldDefinition = React.useMemo(
    () => (selectedField ? getFieldDefinition(selectedField.type) : null),
    [selectedField],
  );
  const currentStepLabel = getStepLabel(currentStepGroup.step);
  const currentFieldListDroppableId = getFieldListDroppableId(
    multiStepEnabled ? focusedStepIndex : 0,
  );

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setShowInitialSkeleton(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  React.useEffect(() => {
    if (!isPaletteCompact) {
      setPaletteDrawerOpen(false);
    }
  }, [isPaletteCompact]);

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

  React.useEffect(() => {
    if (editingStepIndex === null) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      stepTitleInputRef.current?.focus();
      stepTitleInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [editingStepIndex]);

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

  const handleAddFieldAt = React.useCallback(
    (field: FormField, insertionIndex: number, stepIndex: number) => {
      const clampedStepIndex = multiStepEnabled
        ? Math.min(Math.max(stepIndex, 0), Math.max(steps.length - 1, 0))
        : 0;
      const nextField = multiStepEnabled
        ? { ...field, step_index: clampedStepIndex }
        : removeStepIndex(field);
      const overallInsertIndex = getFieldInsertIndex(
        fields,
        steps,
        clampedStepIndex,
        insertionIndex,
        multiStepEnabled,
      );

      commitChange(
        (draft) => {
          draft.fields.splice(overallInsertIndex, 0, nextField);
        },
        () => {
          setFocusedStepIndex(clampedStepIndex);
          setSelectedFieldId(nextField.id);
          if (isPaletteCompact) {
            setPaletteDrawerOpen(false);
          }
        },
      );
    },
    [commitChange, fields, isPaletteCompact, multiStepEnabled, steps],
  );

  const handleAddFieldType = React.useCallback(
    (
      type: FormFieldType,
      options?: {
        insertionIndex?: number;
        stepIndex?: number;
      },
    ) => {
      if (!canAddFieldType(type, fields)) {
        return;
      }

      const targetStepIndex = multiStepEnabled
        ? Math.min(
            Math.max(options?.stepIndex ?? focusedStepIndex, 0),
            Math.max(steps.length - 1, 0),
          )
        : 0;
      const targetFieldCount =
        stepGroups.find((group) => group.step.index === targetStepIndex)?.fields
          .length ?? 0;

      handleAddFieldAt(
        createFieldFromType(type, compliance),
        options?.insertionIndex ?? targetFieldCount,
        targetStepIndex,
      );
    },
    [
      compliance,
      fields,
      focusedStepIndex,
      handleAddFieldAt,
      multiStepEnabled,
      stepGroups,
      steps.length,
    ],
  );

  const handlePaletteDragStart = React.useCallback(
    (type: FormFieldType) =>
      (event: React.DragEvent<HTMLButtonElement>) => {
        if (!canAddFieldType(type, fields)) {
          event.preventDefault();
          return;
        }

        setPaletteDragType(type);
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(PALETTE_DND_MIME_TYPE, type);
      },
    [fields],
  );

  const handlePaletteDragEnd = React.useCallback(() => {
    setPaletteDragType(null);
    setNativeInsertTarget(null);
  }, []);

  const resolveDraggedFieldType = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const droppedType =
        paletteDragType || event.dataTransfer.getData(PALETTE_DND_MIME_TYPE);

      if (!droppedType) {
        return null;
      }

      return FIELD_PALETTE_GROUPS.some((group) =>
        group.types.includes(droppedType as FormFieldType),
      )
        ? (droppedType as FormFieldType)
        : null;
    },
    [paletteDragType],
  );

  const handlePaletteDragOverTarget = React.useCallback(
    (
      event: React.DragEvent<HTMLDivElement>,
      stepIndex: number,
      insertionIndex: number,
    ) => {
      const droppedType = resolveDraggedFieldType(event);
      if (!droppedType) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setNativeInsertTarget({ stepIndex, insertionIndex });
    },
    [resolveDraggedFieldType],
  );

  const handlePaletteDropTarget = React.useCallback(
    (
      event: React.DragEvent<HTMLDivElement>,
      stepIndex: number,
      insertionIndex: number,
    ) => {
      const droppedType = resolveDraggedFieldType(event);
      if (!droppedType) {
        return;
      }

      event.preventDefault();
      handleAddFieldType(droppedType, { insertionIndex, stepIndex });
      setNativeInsertTarget(null);
      setPaletteDragType(null);
    },
    [handleAddFieldType, resolveDraggedFieldType],
  );

  const handleUpdateField = React.useCallback(
    (fieldId: string, updates: Partial<FormField>) => {
      commitChange(
        (draft) => {
          draft.fields = draft.fields.map((field) =>
            field.id === fieldId ? { ...field, ...updates } : field,
          );
        },
        () => {
          if (
            multiStepEnabled &&
            typeof updates.step_index === "number" &&
            Number.isFinite(updates.step_index)
          ) {
            setFocusedStepIndex(updates.step_index);
            setSelectedFieldId(fieldId);
          }
        },
      );
    },
    [commitChange, multiStepEnabled],
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

  const handleToggleFieldRequired = React.useCallback(
    (fieldId: string) => {
      const sourceField = fields.find((field) => field.id === fieldId);
      if (!sourceField) {
        return;
      }

      const nextRequired = !sourceField.required;

      commitChange((draft) => {
        draft.fields = draft.fields.map((field) =>
          field.id === fieldId ? { ...field, required: nextRequired } : field,
        );

        if (sourceField.type === "email_consent") {
          draft.compliance = {
            ...draft.compliance,
            email_consent_required: nextRequired,
          };
        }

        if (sourceField.type === "sms_consent") {
          draft.compliance = {
            ...draft.compliance,
            sms_consent_required: nextRequired,
          };
        }
      });
    },
    [commitChange, fields],
  );

  const handleDuplicateField = React.useCallback(
    (fieldId: string) => {
      const sourceField = fields.find((field) => field.id === fieldId);
      if (!sourceField) {
        return;
      }

      if (!canAddFieldType(sourceField.type, fields)) {
        toast({
          title: "Field already added",
          description: "This field type can only be added once per form.",
        });
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
    [commitChange, fields, toast],
  );

  const handleMoveFieldToStep = React.useCallback(
    (fieldId: string, targetStepIndex: number) => {
      if (!multiStepEnabled) {
        return;
      }

      const clampedStepIndex = Math.min(
        Math.max(targetStepIndex, 0),
        Math.max(steps.length - 1, 0),
      );

      commitChange(
        (draft) => {
          const draftSteps = getEditableFormSteps(draft.fields, draft.settings);
          const sourceIndex = draft.fields.findIndex((field) => field.id === fieldId);

          if (sourceIndex === -1) {
            return;
          }

          const [movedField] = draft.fields.splice(sourceIndex, 1);
          if (!movedField) {
            return;
          }

          const targetGroups = groupFieldsByStep(draft.fields, draftSteps);
          const targetFieldCount =
            targetGroups.find((group) => group.step.index === clampedStepIndex)
              ?.fields.length ?? 0;
          const insertIndex = getFieldInsertIndex(
            draft.fields,
            draftSteps,
            clampedStepIndex,
            targetFieldCount,
            true,
          );

          draft.fields.splice(insertIndex, 0, {
            ...movedField,
            step_index: clampedStepIndex,
          });
        },
        () => {
          setFocusedStepIndex(clampedStepIndex);
          setSelectedFieldId(fieldId);
        },
      );
    },
    [commitChange, multiStepEnabled, steps.length],
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

  const reorderSteps = React.useCallback(
    (sourceIndex: number, destinationIndex: number) => {
      if (
        sourceIndex === destinationIndex ||
        sourceIndex < 0 ||
        destinationIndex < 0 ||
        sourceIndex >= steps.length ||
        destinationIndex >= steps.length
      ) {
        return;
      }

      commitChange(
        (draft) => {
          const draftSteps = [...getEditableFormSteps(draft.fields, draft.settings)];
          const [removedStep] = draftSteps.splice(sourceIndex, 1);

          if (!removedStep) {
            return;
          }

          draftSteps.splice(destinationIndex, 0, removedStep);

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
          setFocusedStepIndex(destinationIndex);
          setEditingStepIndex(null);
        },
      );
    },
    [commitChange, steps.length],
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
          setEditingStepIndex(null);
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
        setEditingStepIndex(nextSteps[nextSteps.length - 1]?.index ?? 0);
        setStepTitleDraft("");
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

  const handleStartStepRename = React.useCallback((step: FormStep) => {
    setFocusedStepIndex(step.index);
    setEditingStepIndex(step.index);
    setStepTitleDraft(step.title ?? "");
  }, []);

  const handleCommitStepRename = React.useCallback(
    (stepIndex: number) => {
      handleUpdateStep(stepIndex, { title: stepTitleDraft.trim() });
      setEditingStepIndex(null);
      setStepTitleDraft("");
    },
    [handleUpdateStep, stepTitleDraft],
  );

  const handleCancelStepRename = React.useCallback(() => {
    setEditingStepIndex(null);
    setStepTitleDraft("");
  }, []);

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
          setEditingStepIndex(null);
        },
      );
    },
    [commitChange, steps.length],
  );

  const handleRequestStepDeletion = React.useCallback(
    (stepIndex: number) => {
      const targetStep = steps.find((step) => step.index === stepIndex);
      if (!targetStep) {
        return;
      }

      const fieldCount =
        stepGroups.find((group) => group.step.index === stepIndex)?.fields
          .length ?? 0;

      if (fieldCount > 0) {
        setPendingStepDeletion({
          fieldCount,
          index: stepIndex,
          label: getStepLabel(targetStep),
        });
        return;
      }

      handleRemoveStep(stepIndex);
    },
    [handleRemoveStep, stepGroups, steps],
  );

  const handleConfirmStepDeletion = React.useCallback(() => {
    if (!pendingStepDeletion) {
      return;
    }

    handleRemoveStep(pendingStepDeletion.index);
    setPendingStepDeletion(null);
  }, [handleRemoveStep, pendingStepDeletion]);

  const handleMoveStepBy = React.useCallback(
    (stepIndex: number, delta: number) => {
      const sourceIndex = steps.findIndex((step) => step.index === stepIndex);
      if (sourceIndex === -1) {
        return;
      }

      const destinationIndex = Math.max(
        0,
        Math.min(steps.length - 1, sourceIndex + delta),
      );
      reorderSteps(sourceIndex, destinationIndex);
    },
    [reorderSteps, steps],
  );

  const handleDragUpdate = React.useCallback((update: DragUpdate) => {
    if (update.type === "step" || !update.destination) {
      setDragInsertTarget(null);
      return;
    }

    setDragInsertTarget({
      droppableId: update.destination.droppableId,
      index: update.destination.index,
    });
  }, []);

  const handleDragEnd = React.useCallback(
    (result: DropResult) => {
      setDragInsertTarget(null);
      const { destination, source, type } = result;

      if (!destination) {
        return;
      }

      if (type === "step") {
        reorderSteps(source.index, destination.index);

        return;
      }

      const sourceTarget = parseFieldDroppableId(source.droppableId);
      const destinationTarget = parseFieldDroppableId(destination.droppableId);

      if (!sourceTarget || !destinationTarget) {
        return;
      }

      const movedFieldId = canvasFields[source.index]?.id;
      if (!movedFieldId) {
        return;
      }

      if (destinationTarget.kind === "step-target") {
        handleMoveFieldToStep(movedFieldId, destinationTarget.stepIndex);
        return;
      }

      if (
        sourceTarget.stepIndex === destinationTarget.stepIndex &&
        destination.index === source.index
      ) {
        return;
      }

      commitChange(
        (draft) => {
          const draftSteps = getEditableFormSteps(draft.fields, draft.settings);
          const mutableGroups = groupFieldsByStep(draft.fields, draftSteps).map(
            (group) => ({
              step: group.step,
              fields: [...group.fields],
            }),
          );
          const sourceGroup = mutableGroups.find(
            (group) => group.step.index === sourceTarget.stepIndex,
          );
          const destinationGroup = mutableGroups.find(
            (group) => group.step.index === destinationTarget.stepIndex,
          );

          if (!sourceGroup || !destinationGroup) {
            return;
          }

          const [movedField] = sourceGroup.fields.splice(source.index, 1);
          if (!movedField) {
            return;
          }

          destinationGroup.fields.splice(destination.index, 0, {
            ...movedField,
            ...(multiStepEnabled
              ? { step_index: destinationTarget.stepIndex }
              : null),
          });

          draft.fields = mutableGroups.flatMap((group) =>
            group.fields.map((field) =>
              multiStepEnabled
                ? { ...field, step_index: group.step.index }
                : removeStepIndex(field),
            ),
          );
        },
        () => {
          setFocusedStepIndex(destinationTarget.stepIndex);
          setSelectedFieldId(movedFieldId);
        },
      );
    },
    [
      canvasFields,
      commitChange,
      handleMoveFieldToStep,
      multiStepEnabled,
      reorderSteps,
    ],
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
        target.closest("[data-field-inspector='true']") ||
        target.closest("[data-field-palette='true']") ||
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

  const handleEmptyStateAction = React.useCallback(() => {
    if (isPaletteCompact) {
      setPaletteDrawerOpen(true);
      return;
    }

    handleAddFieldType("text");
  }, [handleAddFieldType, isPaletteCompact]);

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

  const renderInsertionIndicator = React.useCallback(
    (insertionIndex: number) => {
      const isActive =
        (dragInsertTarget?.droppableId === currentFieldListDroppableId &&
          dragInsertTarget.index === insertionIndex) ||
        (nativeInsertTarget?.stepIndex === focusedStepIndex &&
          nativeInsertTarget.insertionIndex === insertionIndex);
      const showGuide =
        dragInsertTarget?.droppableId === currentFieldListDroppableId ||
        paletteDragType !== null;

      return (
        <FieldDropIndicator
          key={`insert-${focusedStepIndex}-${insertionIndex}`}
          active={isActive}
          showGuide={showGuide}
          onDragLeave={() => {
            setNativeInsertTarget((current) =>
              current?.stepIndex === focusedStepIndex &&
              current.insertionIndex === insertionIndex
                ? null
                : current,
            );
          }}
          onDragOver={(event) =>
            handlePaletteDragOverTarget(event, focusedStepIndex, insertionIndex)
          }
          onDrop={(event) =>
            handlePaletteDropTarget(event, focusedStepIndex, insertionIndex)
          }
        />
      );
    },
    [
      currentFieldListDroppableId,
      dragInsertTarget,
      focusedStepIndex,
      handlePaletteDragOverTarget,
      handlePaletteDropTarget,
      nativeInsertTarget,
      paletteDragType,
    ],
  );

  if (showInitialSkeleton) {
    return <FormBuildTabSkeleton compactPalette={isPaletteCompact} />;
  }

  return (
    <Box
      ref={builderRootRef}
      sx={{
        width: "100%",
        pb: isInspectorBottomSheet && selectedField ? { xs: 360, md: 420 } : 0,
      }}
    >
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

        <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: isPaletteCompact
                ? "72px minmax(0, 1fr)"
                : selectedField && !isInspectorBottomSheet
                  ? "240px minmax(0, 1fr) 300px"
                  : "240px minmax(0, 1fr)",
              gap: 2,
              alignItems: "start",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <FieldPaletteSidebar
                compact={isPaletteCompact}
                fields={fields}
                onAddFieldType={handleAddFieldType}
                onOpenTemplates={() => setTemplatesOpen(true)}
                onPaletteDragEnd={handlePaletteDragEnd}
                onPaletteDragStart={handlePaletteDragStart}
              />
            </Box>

            <Stack spacing={2} sx={{ minWidth: 0 }}>
              {multiStepEnabled ? (
                <Sheet
                  variant="outlined"
                  sx={{
                    borderRadius: "xl",
                    backgroundColor: "background.surface",
                    boxShadow: "var(--joy-shadow-xs)",
                    p: 1.25,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", xl: "row" }}
                    spacing={1.25}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", xl: "center" }}
                  >
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
                          sx={{
                            minWidth: 0,
                            overflowX: "auto",
                            pb: 0.25,
                            "&::-webkit-scrollbar": { display: "none" },
                            scrollbarWidth: "none",
                          }}
                          {...stepDropProvided.droppableProps}
                        >
                          {steps.map((step, stepPosition) => {
                            const stepFieldCount =
                              stepGroups.find((group) => group.step.index === step.index)
                                ?.fields.length ?? 0;

                            return (
                              <Draggable
                                key={`step-chip-${step.index}`}
                                draggableId={`step-chip-${step.index}`}
                                index={stepPosition}
                                isDragDisabled={editingStepIndex === step.index}
                              >
                                {(stepProvided, stepSnapshot) => (
                                  <Droppable
                                    droppableId={getStepTargetDroppableId(step.index)}
                                    type="field"
                                  >
                                    {(stepTargetProvided, stepTargetSnapshot) => (
                                      <Sheet
                                        data-step-chip="true"
                                        ref={(node) => {
                                          stepProvided.innerRef(node);
                                          stepTargetProvided.innerRef(node);
                                        }}
                                        {...stepProvided.draggableProps}
                                        {...stepTargetProvided.droppableProps}
                                        onClick={() => {
                                          setFocusedStepIndex(step.index);
                                          setSelectedFieldId(null);
                                        }}
                                        onDragOver={(event) =>
                                          handlePaletteDragOverTarget(
                                            event,
                                            step.index,
                                            stepFieldCount,
                                          )
                                        }
                                        onDrop={(event) =>
                                          handlePaletteDropTarget(
                                            event,
                                            step.index,
                                            stepFieldCount,
                                          )
                                        }
                                        sx={{
                                          minWidth: 160,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                          px: 1,
                                          py: 0.75,
                                          borderRadius: "lg",
                                          border: "1px solid",
                                          borderColor: stepTargetSnapshot.isDraggingOver
                                            ? "primary.400"
                                            : focusedStepIndex === step.index
                                              ? "primary.300"
                                              : "neutral.200",
                                          backgroundColor: stepTargetSnapshot.isDraggingOver
                                            ? "primary.softBg"
                                            : focusedStepIndex === step.index
                                              ? "primary.softBg"
                                              : "background.surface",
                                          boxShadow: stepSnapshot.isDragging
                                            ? "var(--joy-shadow-md)"
                                            : focusedStepIndex === step.index
                                              ? "var(--joy-shadow-sm)"
                                              : "none",
                                          cursor:
                                            editingStepIndex === step.index
                                              ? "default"
                                              : "pointer",
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Box
                                          {...stepProvided.dragHandleProps}
                                          onClick={(event) => event.stopPropagation()}
                                          sx={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(2, 3px)",
                                            gridTemplateRows: "repeat(3, 3px)",
                                            gap: 0.5,
                                            color: "neutral.400",
                                            flexShrink: 0,
                                          }}
                                        >
                                          {Array.from({ length: 6 }).map((_, index) => (
                                            <Box
                                              key={index}
                                              sx={{
                                                width: 3,
                                                height: 3,
                                                borderRadius: "50%",
                                                backgroundColor: "currentColor",
                                              }}
                                            />
                                          ))}
                                        </Box>

                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                          {editingStepIndex === step.index ? (
                                            <JoyInput
                                              ref={stepTitleInputRef}
                                              value={stepTitleDraft}
                                              onValueChange={setStepTitleDraft}
                                              variant="plain"
                                              placeholder={`Step ${step.index + 1}`}
                                              onBlur={() => handleCommitStepRename(step.index)}
                                              onClick={(event) => event.stopPropagation()}
                                              onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                  event.preventDefault();
                                                  handleCommitStepRename(step.index);
                                                }

                                                if (event.key === "Escape") {
                                                  event.preventDefault();
                                                  handleCancelStepRename();
                                                }
                                              }}
                                              sx={{
                                                "--Input-minHeight": "28px",
                                                px: 0,
                                                border: "none",
                                                boxShadow: "none",
                                                backgroundColor: "transparent",
                                                "& .MuiInput-input": {
                                                  px: 0,
                                                  fontWeight: 700,
                                                },
                                              }}
                                            />
                                          ) : (
                                            <Typography
                                              level="body-sm"
                                              noWrap
                                              sx={{ fontWeight: 700 }}
                                            >
                                              {getStepLabel(step)}
                                            </Typography>
                                          )}
                                        </Box>

                                        <Dropdown>
                                          <MenuButton
                                            size="sm"
                                            variant="plain"
                                            color="neutral"
                                            onClick={(event) => event.stopPropagation()}
                                            sx={{
                                              minWidth: 28,
                                              width: 28,
                                              height: 28,
                                              p: 0,
                                              borderRadius: "999px",
                                            }}
                                          >
                                            <MoreVertical size={14} />
                                          </MenuButton>
                                          <Menu placement="bottom-end">
                                            <MenuItem
                                              onClick={() => handleStartStepRename(step)}
                                            >
                                              Rename
                                            </MenuItem>
                                            <MenuItem
                                              disabled={stepPosition === 0}
                                              onClick={() =>
                                                handleMoveStepBy(step.index, -1)
                                              }
                                            >
                                              <ListItemDecorator>
                                                <ChevronLeft size={16} />
                                              </ListItemDecorator>
                                              Move left
                                            </MenuItem>
                                            <MenuItem
                                              disabled={
                                                stepPosition === steps.length - 1
                                              }
                                              onClick={() =>
                                                handleMoveStepBy(step.index, 1)
                                              }
                                            >
                                              <ListItemDecorator>
                                                <ChevronRight size={16} />
                                              </ListItemDecorator>
                                              Move right
                                            </MenuItem>
                                            <Divider component="li" sx={{ my: 0.5 }} />
                                            <MenuItem
                                              color="danger"
                                              disabled={steps.length <= 1}
                                              onClick={() =>
                                                handleRequestStepDeletion(step.index)
                                              }
                                            >
                                              Delete
                                            </MenuItem>
                                          </Menu>
                                        </Dropdown>

                                        {stepTargetProvided.placeholder}
                                      </Sheet>
                                    )}
                                  </Droppable>
                                )}
                              </Draggable>
                            );
                          })}
                          {stepDropProvided.placeholder}

                          <Tooltip title="Add step">
                            <IconButton
                              variant="plain"
                              color="neutral"
                              size="sm"
                              onClick={handleAddStep}
                              sx={{ flexShrink: 0 }}
                            >
                              <Plus size={16} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </Droppable>

                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", xl: "center" } }}
                    >
                      Editing Step {focusedStepIndex + 1} of {configuredStepCount}
                    </Typography>
                  </Stack>
                </Sheet>
              ) : null}

              <Sheet
                data-builder-toolbar="true"
                variant="outlined"
                sx={{
                  borderRadius: "xl",
                  px: { xs: 1.25, md: 1.5 },
                  py: 1,
                  backgroundColor: "background.surface",
                  boxShadow: "var(--joy-shadow-xs)",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    {isPaletteCompact ? (
                      <Tooltip title="Open field palette">
                        <IconButton
                          variant="plain"
                          color="neutral"
                          size="sm"
                          onClick={() => setPaletteDrawerOpen(true)}
                        >
                          <PanelLeft size={16} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <Typography level="body-xs" color="neutral">
                      {multiStepEnabled
                        ? `${canvasFields.length} field${canvasFields.length === 1 ? "" : "s"} in ${currentStepLabel}`
                        : `${canvasFields.length} field${canvasFields.length === 1 ? "" : "s"} in this form`}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title="Undo (Cmd+Z)">
                      <Box component="span">
                        <IconButton
                          variant="plain"
                          color="neutral"
                          size="sm"
                          disabled={historyCounts.undo === 0}
                          onClick={handleUndo}
                        >
                          <Undo2 size={16} />
                        </IconButton>
                      </Box>
                    </Tooltip>
                    <Tooltip title="Redo (Cmd+Shift+Z)">
                      <Box component="span">
                        <IconButton
                          variant="plain"
                          color="neutral"
                          size="sm"
                          disabled={historyCounts.redo === 0}
                          onClick={handleRedo}
                        >
                          <Redo2 size={16} />
                        </IconButton>
                      </Box>
                    </Tooltip>
                    <Divider orientation="vertical" sx={{ height: 20 }} />
                    <Tooltip title="Form settings">
                      <IconButton
                        variant="soft"
                        color="neutral"
                        size="sm"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <Settings2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Sheet>

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
                  <Stack spacing={0.75}>
                    <JoyInput
                      value={settings.form_title ?? ""}
                      onValueChange={(form_title) =>
                        handleSettingsPatch({ form_title })
                      }
                      placeholder="Form title"
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
                          fontSize: "clamp(1.4rem, 2vw, 1.8rem)",
                          fontWeight: 700,
                          fontFamily: tokens.fontFamily,
                        },
                      }}
                    />

                    <Textarea
                      minRows={1}
                      value={settings.form_description ?? ""}
                      onChange={(event) =>
                        handleSettingsPatch({
                          form_description: event.target.value,
                        })
                      }
                      placeholder="Add a description to guide visitors"
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
                          resize: "none",
                        },
                      }}
                    />
                  </Stack>

                  <Divider />

                  <Droppable
                    droppableId={currentFieldListDroppableId}
                    type="field"
                  >
                    {(fieldDropProvided, fieldDropSnapshot) => (
                      <Stack
                        ref={fieldDropProvided.innerRef}
                        spacing={0}
                        {...fieldDropProvided.droppableProps}
                      >
                        {canvasFields.length === 0 ? (
                          <Sheet
                            variant="plain"
                            onDragOver={(event) =>
                              handlePaletteDragOverTarget(event, focusedStepIndex, 0)
                            }
                            onDrop={(event) =>
                              handlePaletteDropTarget(event, focusedStepIndex, 0)
                            }
                            sx={{
                              borderRadius: "xl",
                              border: "1px dashed",
                              borderColor:
                                fieldDropSnapshot.isDraggingOver || paletteDragType
                                  ? "primary.400"
                                  : "neutral.300",
                              backgroundColor:
                                fieldDropSnapshot.isDraggingOver || paletteDragType
                                  ? "primary.softBg"
                                  : "background.level1",
                              p: { xs: 3, md: 4 },
                              textAlign: "center",
                            }}
                          >
                            <Stack spacing={1.25} alignItems="center">
                              <Typography level="title-md">
                                No fields in this step
                              </Typography>
                              <Typography level="body-sm" color="neutral">
                                Drag fields from the palette or click + Add field.
                              </Typography>
                              <JoyButton
                                size="sm"
                                variant="outlined"
                                color="neutral"
                                startDecorator={<Plus size={16} />}
                                onClick={handleEmptyStateAction}
                              >
                                Add field
                              </JoyButton>
                            </Stack>
                          </Sheet>
                        ) : (
                          <>
                            {renderInsertionIndicator(0)}

                            {canvasFields.map((field, fieldIndex) => (
                              <React.Fragment key={field.id}>
                                <Draggable draggableId={field.id} index={fieldIndex}>
                                  {(fieldProvided, snapshot) => (
                                    <Box
                                      ref={fieldProvided.innerRef}
                                      {...fieldProvided.draggableProps}
                                      sx={{ mb: 0.75 }}
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
                                        isSelected={selectedFieldId === field.id}
                                        dragHandleProps={fieldProvided.dragHandleProps}
                                        onSelect={() => setSelectedFieldId(field.id)}
                                        onFieldChange={(updates) =>
                                          handleUpdateField(field.id, updates)
                                        }
                                        onComplianceChange={handleCompliancePatch}
                                        onEdit={() => setSelectedFieldId(field.id)}
                                        onDuplicate={() =>
                                          handleDuplicateField(field.id)
                                        }
                                        onMoveToStep={(stepIndex) =>
                                          handleMoveFieldToStep(field.id, stepIndex)
                                        }
                                        onToggleRequired={() =>
                                          handleToggleFieldRequired(field.id)
                                        }
                                        onDelete={() => handleDeleteField(field.id)}
                                      />
                                    </Box>
                                  )}
                                </Draggable>

                                {renderInsertionIndicator(fieldIndex + 1)}
                              </React.Fragment>
                            ))}

                            {fieldDropProvided.placeholder}
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
            </Stack>

            {!isInspectorBottomSheet && selectedField && selectedFieldDefinition ? (
              <Sheet
                data-field-inspector="true"
                variant="outlined"
                sx={{
                  width: 300,
                  borderRadius: "xl",
                  backgroundColor: "background.surface",
                  boxShadow: "var(--joy-shadow-sm)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: "calc(100vh - 160px)",
                  position: "sticky",
                  top: 16,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  justifyContent="space-between"
                  sx={{ p: 1.5 }}
                >
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      {`Edit ${selectedFieldDefinition.label}`}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {selectedField.label || selectedFieldDefinition.defaultLabel}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title="Duplicate field">
                      <IconButton
                        variant="plain"
                        color="neutral"
                        size="sm"
                        onClick={() => handleDuplicateField(selectedField.id)}
                      >
                        <Copy size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete field">
                      <IconButton
                        variant="plain"
                        color="danger"
                        size="sm"
                        onClick={() => handleDeleteField(selectedField.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Close inspector">
                      <IconButton
                        variant="plain"
                        color="neutral"
                        size="sm"
                        onClick={() => setSelectedFieldId(null)}
                      >
                        <X size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Divider />

                <Box sx={{ p: 1.5, overflowY: "auto" }}>
                  <InlineFieldEditor
                    field={selectedField}
                    allFields={fields}
                    steps={steps}
                    multiStepEnabled={multiStepEnabled}
                    currentStepLabel={currentStepLabel}
                    onFieldChange={(updates) =>
                      handleUpdateField(selectedField.id, updates)
                    }
                    onComplianceChange={handleCompliancePatch}
                  />
                </Box>
              </Sheet>
            ) : null}
          </Box>
        </DragDropContext>
      </Stack>

      {isPaletteCompact ? (
        <JoyDrawer
          open={paletteDrawerOpen}
          onClose={() => setPaletteDrawerOpen(false)}
          anchor="left"
          size="sm"
          title="Field palette"
          description="Choose a field type to append it to the current step, or drag it into the canvas."
          contentSx={{ px: 0, py: 0 }}
        >
          <Box sx={{ p: 2 }}>
            <FieldPaletteSidebar
              fields={fields}
              onAddFieldType={handleAddFieldType}
              onOpenTemplates={() => setTemplatesOpen(true)}
              onPaletteDragEnd={handlePaletteDragEnd}
              onPaletteDragStart={handlePaletteDragStart}
            />
          </Box>
        </JoyDrawer>
      ) : null}

      {isInspectorBottomSheet && selectedField && selectedFieldDefinition ? (
        <Sheet
          data-field-inspector="true"
          variant="outlined"
          sx={{
            position: "fixed",
            left: { xs: 12, md: 24 },
            right: { xs: 12, md: 24 },
            bottom: { xs: 12, md: 16 },
            zIndex: 20,
            borderRadius: "xl",
            backgroundColor: "background.surface",
            boxShadow: "var(--joy-shadow-xl)",
            maxHeight: "70vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ pt: 1, display: "flex", justifyContent: "center" }}>
            <Box
              sx={{
                width: 40,
                height: 4,
                borderRadius: 999,
                backgroundColor: "neutral.300",
              }}
            />
          </Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            justifyContent="space-between"
            sx={{ p: 1.5 }}
          >
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                {`Edit ${selectedFieldDefinition.label}`}
              </Typography>
              <Typography level="body-xs" color="neutral">
                {selectedField.label || selectedFieldDefinition.defaultLabel}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="Duplicate field">
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => handleDuplicateField(selectedField.id)}
                >
                  <Copy size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete field">
                <IconButton
                  variant="plain"
                  color="danger"
                  size="sm"
                  onClick={() => handleDeleteField(selectedField.id)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close inspector">
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => setSelectedFieldId(null)}
                >
                  <X size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Divider />

          <Box sx={{ p: 1.5, overflowY: "auto" }}>
            <InlineFieldEditor
              field={selectedField}
              allFields={fields}
              steps={steps}
              multiStepEnabled={multiStepEnabled}
              currentStepLabel={currentStepLabel}
              onFieldChange={(updates) =>
                handleUpdateField(selectedField.id, updates)
              }
              onComplianceChange={handleCompliancePatch}
            />
          </Box>
        </Sheet>
      ) : null}

      <FormBuilderSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        steps={steps}
        fieldCountsByStep={fieldCountsByStep}
        multiStepEnabled={multiStepEnabled}
        currentStepIndex={focusedStepIndex}
        onFocusStep={setFocusedStepIndex}
        onToggleMultiStep={handleToggleMultiStep}
        onAddStep={handleAddStep}
        onRemoveStep={handleRemoveStep}
        onReorderSteps={reorderSteps}
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

      <JoyAlertDialog
        open={pendingStepDeletion !== null}
        onClose={() => setPendingStepDeletion(null)}
        onConfirm={handleConfirmStepDeletion}
        title={`Delete ${pendingStepDeletion?.label ?? "this step"}?`}
        description={
          pendingStepDeletion
            ? `${pendingStepDeletion.fieldCount} field${pendingStepDeletion.fieldCount === 1 ? "" : "s"} will be moved into the nearest remaining step.`
            : ""
        }
        confirmLabel="Delete step"
        variant="warning"
      />
    </Box>
  );
}
