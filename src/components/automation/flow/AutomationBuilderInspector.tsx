import * as React from "react";
import type { Edge, Node } from "@xyflow/react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  MousePointerClick,
  Trash2,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { InlineEditableText } from "@/components/automation/flow/InlineEditableText";
import {
  delayUnitOptions,
  emailDelayOptions,
  emailTemplateOptions,
  getAutomationNodeVisual,
  splitFieldOptions,
  splitOperatorOptions,
} from "@/components/automation/flow/automationNodeVisuals";
import {
  getLaunchChecklistItems,
  type LaunchChecklistItem,
} from "@/components/automation/flow/flowValidationUtils";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { supabase } from "@/integrations/supabase/client";
import {
  getTriggerById,
  triggerCatalog,
  triggerRequiresAudience,
} from "@/lib/automation/triggerCatalog";

type AudienceItem = {
  id: string | number;
  name?: string;
  persona_name?: string;
};

interface AutomationBuilderInspectorProps {
  activeNode: Node | null;
  nodes: Node[];
  edges: Edge[];
  selectedPersonas: AudienceItem[];
  selectedSegments: AudienceItem[];
  audienceContactCount: number;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  onDeleteNodeRequest: (nodeId: string) => void;
  onOpenAudienceSelector: () => void;
}

const sectionHeaderSx = {
  mt: 3,
  mb: 1.5,
  color: "neutral.500",
  fontSize: "10px",
  fontWeight: "var(--joy-fontWeight-lg)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNodeData(node: Node | null) {
  return (node?.data as Record<string, unknown> | undefined) ?? {};
}

function isDefaultTriggerLabel(currentLabel: string, triggerType: string) {
  const triggerMeta = getTriggerById(triggerType);
  const defaultLabel = triggerMeta?.label
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();

  return !currentLabel || currentLabel === defaultLabel;
}

function ChecklistSection({
  items,
  open,
  onToggle,
}: {
  items: LaunchChecklistItem[];
  open: boolean;
  onToggle: () => void;
}) {
  const completedCount = items.filter((item) => item.completed).length;
  const isReady = completedCount === items.length;

  return (
    <Sheet
      variant="soft"
      color={isReady ? "success" : "neutral"}
      sx={{
        borderRadius: "lg",
        border: "1px solid",
        borderColor: isReady ? "success.100" : "divider",
        backgroundColor: isReady ? "success.50" : "background.level1",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={onToggle}
        sx={{ px: 1.5, py: 1.25, cursor: "pointer" }}
      >
        <Typography level="title-sm">Launch Checklist</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="sm"
            variant="soft"
            color={isReady ? "success" : "warning"}
          >
            {isReady ? "Ready" : `${completedCount}/${items.length}`}
          </Chip>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Stack>
      </Stack>

      {open ? (
        <Stack spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
          {items.map((item) => (
            <Stack
              key={item.id}
              direction="row"
              spacing={1}
              alignItems="center"
            >
              {item.completed ? (
                <CheckCircle2
                  size={16}
                  color="var(--joy-palette-success-500)"
                />
              ) : (
                <Circle size={16} color="var(--joy-palette-neutral-300)" />
              )}
              <Typography
                level="body-sm"
                sx={{
                  color: item.completed ? "neutral.500" : "neutral.700",
                  textDecoration: item.completed ? "line-through" : "none",
                }}
              >
                {item.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Sheet>
  );
}

export function AutomationBuilderInspector({
  activeNode,
  nodes,
  edges,
  selectedPersonas,
  selectedSegments,
  audienceContactCount,
  onUpdateNode,
  onDeleteNodeRequest,
  onOpenAudienceSelector,
}: AutomationBuilderInspectorProps) {
  const { personas } = useAllPersonas();
  const [isChecklistOpen, setIsChecklistOpen] = React.useState(false);
  const [segments, setSegments] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [forms, setForms] = React.useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [isLoadingContext, setIsLoadingContext] = React.useState(false);
  const activeData = getNodeData(activeNode);
  const activeType = String(activeNode?.type || "");
  const activeVisual = activeNode
    ? getAutomationNodeVisual(activeType, activeData)
    : null;
  const triggerNode = React.useMemo(
    () => nodes.find((node) => node.type === "trigger") ?? null,
    [nodes],
  );
  const activeTriggerType =
    activeType === "trigger"
      ? stringValue(activeData.triggerType) || "loyalty_join"
      : stringValue(
          (triggerNode?.data as Record<string, unknown> | undefined)
            ?.triggerType,
        ) || "loyalty_join";
  const currentTriggerMeta = getTriggerById(activeTriggerType);
  const hasAudience =
    selectedPersonas.length > 0 || selectedSegments.length > 0;
  const audienceRequired =
    !!activeTriggerType && triggerRequiresAudience(activeTriggerType);
  const checklistItems = React.useMemo(
    () =>
      getLaunchChecklistItems(nodes, edges, selectedSegments, selectedPersonas),
    [edges, nodes, selectedPersonas, selectedSegments],
  );

  React.useEffect(() => {
    let isActive = true;

    if (activeType !== "trigger") {
      return undefined;
    }

    const triggerType = stringValue(activeData.triggerType);

    if (!["segment.added", "form_submitted"].includes(triggerType)) {
      setSegments([]);
      setForms([]);
      return undefined;
    }

    setIsLoadingContext(true);

    Promise.all([
      triggerType === "segment.added"
        ? Promise.all([
            supabase.from("crm_segments").select("id, name").order("name"),
            supabase.from("custom_segments").select("id, name").order("name"),
          ])
        : Promise.resolve(null),
      triggerType === "form_submitted"
        ? supabase.from("forms").select("id, name").order("name")
        : Promise.resolve(null),
    ])
      .then(([segmentResults, formResult]) => {
        if (!isActive) {
          return;
        }

        if (segmentResults) {
          const [crmSegments, customSegments] = segmentResults;
          if (crmSegments.error) {
            throw crmSegments.error;
          }
          if (customSegments.error) {
            throw customSegments.error;
          }

          setSegments([
            ...(crmSegments.data ?? []).map((segment) => ({
              id: String(segment.id),
              name: String(segment.name),
            })),
            ...(customSegments.data ?? []).map((segment) => ({
              id: String(segment.id),
              name: String(segment.name),
            })),
          ]);
        }

        if (formResult) {
          if (formResult.error) {
            throw formResult.error;
          }
          setForms(
            (formResult.data ?? []).map((form) => ({
              id: String(form.id),
              name: String(form.name),
            })),
          );
        }
      })
      .catch((error) => {
        console.error("Failed to load inspector context:", error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingContext(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeData, activeType]);

  const updateActiveNode = React.useCallback(
    (nextData: Record<string, unknown>) => {
      if (!activeNode) {
        return;
      }

      onUpdateNode(activeNode.id, nextData);
    },
    [activeNode, onUpdateNode],
  );

  const renderTriggerFields = () => {
    const conditions =
      typeof activeData.conditions === "object" && activeData.conditions
        ? (activeData.conditions as Record<string, unknown>)
        : {};
    const triggerType = stringValue(activeData.triggerType) || "loyalty_join";

    return (
      <Stack spacing={1.5}>
        <JoySelect
          label="Event type"
          value={triggerType}
          options={triggerCatalog.map((trigger) => ({
            value: trigger.id,
            label: trigger.label.replace(/^[^\p{L}\p{N}]+/u, "").trim(),
          }))}
          onChange={(_event, value) => {
            if (!value) {
              return;
            }

            const nextMeta = getTriggerById(value);
            const currentLabel = stringValue(activeData.label);
            const currentDescription = stringValue(activeData.description);

            updateActiveNode({
              triggerType: value,
              label: isDefaultTriggerLabel(currentLabel, triggerType)
                ? nextMeta?.label.replace(/^[^\p{L}\p{N}]+/u, "").trim() ||
                  currentLabel ||
                  "Trigger"
                : currentLabel,
              description:
                !currentDescription ||
                currentDescription === getTriggerById(triggerType)?.description
                  ? nextMeta?.description || ""
                  : currentDescription,
              conditions: {},
            });
          }}
          helperText="Choose the event that should start the automation."
        />

        {triggerType === "segment.added" ? (
          isLoadingContext ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ p: 1.25, borderRadius: "md" }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size="sm" />
                <Typography level="body-sm">Loading segments…</Typography>
              </Stack>
            </Sheet>
          ) : (
            <JoySelect
              label="Segment"
              value={stringValue(conditions.segment_id)}
              options={segments.map((segment) => ({
                value: segment.id,
                label: segment.name,
              }))}
              onChange={(_event, value) => {
                const nextSegment = segments.find(
                  (segment) => segment.id === value,
                );
                updateActiveNode({
                  conditions: {
                    segment_id: value ?? "",
                    segment_name: nextSegment?.name ?? "",
                  },
                });
              }}
              helperText="This trigger fires when a contact joins the chosen segment."
            />
          )
        ) : null}

        {triggerType === "persona.assigned" ? (
          <JoySelect
            label="Persona"
            value={stringValue(conditions.persona_id)}
            options={personas.map((persona) => ({
              value: persona.id,
              label: persona.persona_name,
            }))}
            onChange={(_event, value) => {
              const nextPersona = personas.find(
                (persona) => persona.id === value,
              );
              updateActiveNode({
                conditions: {
                  persona_id: value ?? "",
                  persona_name: nextPersona?.persona_name ?? "",
                },
              });
            }}
            helperText="Limit this trigger to a specific assigned persona."
          />
        ) : null}

        {triggerType === "form_submitted" ? (
          isLoadingContext ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ p: 1.25, borderRadius: "md" }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size="sm" />
                <Typography level="body-sm">Loading forms…</Typography>
              </Stack>
            </Sheet>
          ) : (
            <JoySelect
              label="Form"
              value={stringValue(conditions.form_id)}
              options={forms.map((form) => ({
                value: form.id,
                label: form.name,
              }))}
              onChange={(_event, value) => {
                const nextForm = forms.find((form) => form.id === value);
                updateActiveNode({
                  conditions: {
                    form_id: value ?? "",
                    form_name: nextForm?.name ?? "",
                  },
                });
              }}
              helperText="Choose the form submission that should kick off the flow."
            />
          )
        ) : null}

        <JoySelect
          label="When the customer is already active"
          value={stringValue(activeData.overlapBehavior) || "ignore"}
          options={[
            { value: "ignore", label: "Ignore new trigger" },
            { value: "restart", label: "Restart from the beginning" },
            { value: "parallel", label: "Allow parallel runs" },
          ]}
          onChange={(_event, value) => {
            updateActiveNode({ overlapBehavior: value ?? "ignore" });
          }}
          helperText="Control how repeat triggers should behave for the same contact."
        />

        <JoyTextarea
          label="Description"
          value={stringValue(activeData.description)}
          onChange={(event) =>
            updateActiveNode({ description: event.target.value })
          }
          minRows={4}
          placeholder={
            currentTriggerMeta?.description ||
            "Describe what this trigger should do."
          }
          helperText="Shown on the node card and inspector summary."
        />
      </Stack>
    );
  };

  const renderEmailFields = () => (
    <Stack spacing={1.5}>
      <JoyInput
        label="Subject"
        value={stringValue(activeData.subject)}
        onChange={(event) => updateActiveNode({ subject: event.target.value })}
        placeholder="Welcome to Brands in Blooms"
      />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <JoySelect
          label="Template"
          value={stringValue(activeData.template)}
          options={[{ value: "", label: "Custom" }, ...emailTemplateOptions]}
          onChange={(_event, value) => {
            const nextTemplate = emailTemplateOptions.find(
              (option) => option.value === value,
            );

            updateActiveNode({
              template: value ?? "",
              ...(nextTemplate
                ? {
                    subject:
                      stringValue(activeData.subject) || nextTemplate.subject,
                    content:
                      stringValue(activeData.content) || nextTemplate.content,
                    body: stringValue(activeData.body) || nextTemplate.content,
                  }
                : null),
            });
          }}
        />
        <JoySelect
          label="Send delay"
          value={stringValue(activeData.delay) || "Immediate"}
          options={emailDelayOptions}
          onChange={(_event, value) =>
            updateActiveNode({ delay: value ?? "Immediate" })
          }
        />
      </Stack>

      <JoyTextarea
        label="Body"
        value={stringValue(activeData.content) || stringValue(activeData.body)}
        onChange={(event) =>
          updateActiveNode({
            content: event.target.value,
            body: event.target.value,
          })
        }
        minRows={8}
        placeholder="Write the email body here..."
      />

      <JoyInput
        label="Optional hero image URL"
        value={stringValue(activeData.imageUrl)}
        onChange={(event) => updateActiveNode({ imageUrl: event.target.value })}
        placeholder="https://..."
      />
    </Stack>
  );

  const renderSmsFields = () => {
    const message =
      stringValue(activeData.message) || stringValue(activeData.content);

    return (
      <Stack spacing={1.5}>
        <JoyTextarea
          label="Message"
          value={message}
          onChange={(event) =>
            updateActiveNode({
              message: event.target.value,
              content: event.target.value,
              characterCount: event.target.value.length,
            })
          }
          minRows={6}
          helperText={`${message.length}/160 characters`}
          placeholder="Hi {{first_name}}, your order is ready for pickup."
        />
      </Stack>
    );
  };

  const renderDelayFields = () => (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <JoyInput
          label="Delay"
          type="number"
          value={String(Number(activeData.delayValue) || 1)}
          onChange={(event) =>
            updateActiveNode({
              delayValue:
                Number.parseInt(event.target.value || "1", 10) > 0
                  ? Number.parseInt(event.target.value || "1", 10)
                  : 1,
            })
          }
        />
        <JoySelect
          label="Unit"
          value={stringValue(activeData.delayUnit) || "hours"}
          options={delayUnitOptions}
          onChange={(_event, value) =>
            updateActiveNode({ delayUnit: value ?? "hours" })
          }
        />
      </Stack>
      <JoyTextarea
        label="Description"
        value={stringValue(activeData.description)}
        onChange={(event) =>
          updateActiveNode({ description: event.target.value })
        }
        minRows={4}
        placeholder="Pause the automation before the next step runs."
      />
    </Stack>
  );

  const renderSplitFields = () => (
    <Stack spacing={1.5}>
      <JoySelect
        label="Field"
        value={stringValue(activeData.conditionField) || "total_spent"}
        options={splitFieldOptions}
        onChange={(_event, value) =>
          updateActiveNode({ conditionField: value ?? "total_spent" })
        }
      />
      <JoySelect
        label="Operator"
        value={stringValue(activeData.conditionOperator) || "greater_than"}
        options={splitOperatorOptions}
        onChange={(_event, value) =>
          updateActiveNode({ conditionOperator: value ?? "greater_than" })
        }
      />
      <JoyInput
        label="Value"
        value={stringValue(activeData.conditionValue) || "100"}
        onChange={(event) =>
          updateActiveNode({ conditionValue: event.target.value })
        }
        placeholder="100"
      />
      <JoyTextarea
        label="Operator note"
        value={stringValue(activeData.description)}
        onChange={(event) => {
          const note = event.target.value;
          updateActiveNode({
            description: note,
            splitType: "conditional",
            conditions: note
              ? [
                  {
                    label: note,
                    condition: `${stringValue(activeData.conditionField) || "total_spent"} ${stringValue(activeData.conditionOperator) || "greater_than"} ${stringValue(activeData.conditionValue) || "100"}`,
                  },
                ]
              : [],
          });
        }}
        minRows={4}
        placeholder="Example: High-value customers go down the yes branch."
      />
    </Stack>
  );

  const renderConfiguration = () => {
    switch (activeType) {
      case "trigger":
        return renderTriggerFields();
      case "email":
        return renderEmailFields();
      case "sms":
        return renderSmsFields();
      case "delay":
        return renderDelayFields();
      case "split":
        return renderSplitFields();
      default:
        return null;
    }
  };

  return (
    <Sheet
      sx={{
        width: 300,
        flexShrink: 0,
        borderLeft: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.surface",
        display: { xs: "none", lg: "block" },
        overflowY: "auto",
      }}
    >
      <Stack spacing={2} sx={{ p: 2.5 }}>
        <ChecklistSection
          items={checklistItems}
          open={isChecklistOpen}
          onToggle={() => setIsChecklistOpen((current) => !current)}
        />

        <Divider />

        {activeNode && activeVisual ? (
          <Box sx={{ opacity: 1, transition: "opacity 0.15s ease" }}>
            <Chip
              size="sm"
              variant="soft"
              color={activeVisual.tone.color}
              sx={{
                fontSize: "10px",
                fontWeight: "var(--joy-fontWeight-lg)",
                letterSpacing: "0.05em",
              }}
            >
              {activeVisual.badge}
            </Chip>

            <InlineEditableText
              value={activeVisual.title}
              level="title-md"
              fallbackValue={activeVisual.badge}
              onCommit={(nextValue) => {
                updateActiveNode(
                  activeType === "trigger"
                    ? { label: nextValue }
                    : { title: nextValue },
                );
              }}
              typographySx={{ mt: 1, fontWeight: "var(--joy-fontWeight-lg)" }}
              inputSx={{ mt: 1 }}
            />

            <Divider sx={{ my: 2 }} />

            <Typography level="body-xs" sx={sectionHeaderSx}>
              Configuration
            </Typography>
            {renderConfiguration()}

            <Typography level="body-xs" sx={sectionHeaderSx}>
              Audience
            </Typography>
            <Stack spacing={1.25}>
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                {activeType === "trigger"
                  ? currentTriggerMeta?.audienceType === "event"
                    ? "This event trigger targets the customer who caused the event. Audience filters are optional."
                    : hasAudience
                      ? `${selectedPersonas.length} personas and ${selectedSegments.length} segments are guiding this trigger.`
                      : "This batch trigger needs audience filters before launch."
                  : "This step inherits the automation audience defined at the trigger level."}
              </Typography>

              <Typography
                level="body-sm"
                sx={{ fontWeight: "var(--joy-fontWeight-lg)" }}
              >
                Estimated reach: {audienceContactCount.toLocaleString()}{" "}
                contacts
              </Typography>

              <JoyButton
                variant="soft"
                color={audienceRequired && !hasAudience ? "warning" : "neutral"}
                onClick={onOpenAudienceSelector}
              >
                {hasAudience ? "Review audience filters" : "Configure audience"}
              </JoyButton>
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            <JoyButton
              fullWidth
              variant="plain"
              color="danger"
              size="sm"
              startDecorator={<Trash2 size={14} />}
              onClick={() => onDeleteNodeRequest(activeNode.id)}
            >
              Delete this node
            </JoyButton>
          </Box>
        ) : (
          <Stack
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{
              minHeight: 420,
              textAlign: "center",
              opacity: 1,
              transition: "opacity 0.15s ease",
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: "neutral.100",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "neutral.300",
              }}
            >
              <MousePointerClick size={48} />
            </Box>
            <Stack spacing={0.75} alignItems="center">
              <Typography level="title-sm" sx={{ color: "neutral.700" }}>
                Select a node to inspect
              </Typography>
              <Typography
                level="body-xs"
                sx={{
                  color: "neutral.500",
                  maxWidth: 220,
                  textAlign: "center",
                }}
              >
                Click any node on the canvas to view and edit its configuration
                here.
              </Typography>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Sheet>
  );
}
