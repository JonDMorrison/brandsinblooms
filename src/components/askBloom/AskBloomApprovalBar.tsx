import * as React from "react";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Typography from "@mui/joy/Typography";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import {
  AlertTriangle,
  Calendar,
  Check,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Shield,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  resolveApproval,
  type ResolvedApproval,
} from "@/components/bloom/utils/resolveApprovalData";
import {
  getFormSchema,
  transformFormValues,
  type PendingResourceForm,
  type ResourceFormSchema,
} from "@/components/bloom/utils/resourceFormRegistry";
import type { BloomStreamingBlock } from "@/hooks/bloom/useBloomStreaming";
import type {
  BloomTaskPlan,
  BloomTaskPlanAction,
  BloomTaskPlanItem,
  BloomTaskRiskLevel,
} from "@/hooks/bloom/taskPlanTypes";
import { useAskBloom } from "@/providers/AskBloomProvider";
import type { AskBloomActionCard, AskBloomMessage } from "@/types/askBloom";

type LegacyRiskLevel = "low" | "medium" | "high";
type JoyRiskColor = "success" | "primary" | "warning" | "danger";
type ResourceFormField = ResourceFormSchema["fields"][number];

interface PendingActionCard {
  messageId: string;
  card: AskBloomActionCard;
}

interface CompactRecord {
  initials: string;
  primary: string;
  secondary?: string;
  badge?: string;
}

const DISCUSS_PROMPT = "I'd like to discuss this plan before approving.";

const approvalWrapperSx = {
  flexShrink: 0,
  px: 1.25,
  pt: 0.75,
  pb: 1.25,
  animation: "askBloomApprovalIn 220ms cubic-bezier(0.16, 1, 0.3, 1)",
  "@keyframes askBloomApprovalIn": {
    "0%": { opacity: 0, transform: "translateY(6px)" },
    "100%": { opacity: 1, transform: "translateY(0)" },
  },
};

const approvalCardSx = {
  bgcolor: "background.surface",
  border: "1px solid",
  borderColor: "neutral.outlinedBorder",
  borderRadius: "8px",
  boxShadow: (theme: { palette: { mode: string } }) =>
    theme.palette.mode === "dark"
      ? "0 10px 28px rgba(0, 0, 0, 0.36), 0 2px 8px rgba(0, 0, 0, 0.24)"
      : "0 10px 28px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.05)",
  overflow: "hidden",
};

const taskActionIcons: Record<BloomTaskPlanAction, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  send: Send,
  schedule: Calendar,
  assign: Users,
  tag: Tag,
  consent_change: Shield,
};

const taskRiskColor: Record<BloomTaskRiskLevel, JoyRiskColor> = {
  safe: "success",
  low: "primary",
  medium: "warning",
  high: "danger",
};

const taskRiskLabel: Record<BloomTaskRiskLevel, string> = {
  safe: "Safe",
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

const legacyRiskColor: Record<
  LegacyRiskLevel,
  "primary" | "warning" | "danger"
> = {
  low: "primary",
  medium: "warning",
  high: "danger",
};

const legacyRiskLabel: Record<LegacyRiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

const PRIMARY_ARG_KEYS = [
  "name",
  "title",
  "subject",
  "label",
  "first_name",
  "email",
];

const taskHasBlockingError = (task: BloomTaskPlanItem) =>
  task.validationAnnotations.some((annotation) => annotation.type === "error");

const inferRiskLevel = (toolName: string): LegacyRiskLevel => {
  const normalizedToolName = toolName.toLowerCase();
  if (/delete|remove/.test(normalizedToolName)) {
    return "high";
  }
  if (/send|export|schedule|manage_consent|bulk/.test(normalizedToolName)) {
    return "medium";
  }
  return "low";
};

const humanizeToolName = (toolName: string): string =>
  toolName
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const initialsForName = (name: string) => {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const primaryArgValue = (toolArgs: Record<string, unknown>): string | null => {
  const first = toolArgs.first_name;
  const last = toolArgs.last_name;
  if (typeof first === "string" && first.trim()) {
    const lastPart = typeof last === "string" && last.trim() ? ` ${last}` : "";
    return `${first}${lastPart}`.trim();
  }

  for (const key of PRIMARY_ARG_KEYS) {
    const value = toolArgs[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const value of Object.values(toolArgs)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
};

const normalizeBooleanLabel = (value: string) =>
  value === "true" || value === "yes" ? "Yes" : "No";

const summarizeFilledFields = (
  form: ResourceFormSchema,
  values: Record<string, string>,
) =>
  form.fields
    .map((field) => {
      const raw = values[field.name]?.trim() ?? "";
      if (!raw) {
        return null;
      }
      return `- ${field.label}: ${
        field.type === "boolean" ? normalizeBooleanLabel(raw) : raw
      }`;
    })
    .filter((line): line is string => line !== null);

const buildResourceMessage = (
  form: ResourceFormSchema,
  values: Record<string, string>,
) => {
  const typedPayload = {
    tool_name: form.toolName,
    params: transformFormValues(values, form.fields),
  };
  const details = summarizeFilledFields(form, values);

  return `Create the ${form.resourceType} with these details:\n${details.join("\n")}\n\nUse the ${form.toolName} tool with these typed parameters:\n${JSON.stringify(typedPayload, null, 2)}`;
};

const buildCancellationMessage = (form: ResourceFormSchema) =>
  `I've cancelled the ${form.resourceType} creation process.`;

const buildTypeInsteadMessage = (
  form: ResourceFormSchema,
  values: Record<string, string>,
) => {
  const details = summarizeFilledFields(form, values);
  if (details.length === 0) {
    return `I'll describe the ${form.resourceType} details in plain text instead of using the form.`;
  }

  return `I'll describe the ${form.resourceType} details in plain text instead of using the form. Continue from these details if useful:\n${details.join("\n")}`;
};

const getActionButtonIcon = (label: string | undefined) => {
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("delete") || normalized.includes("remove")) {
    return <Trash2 size={14} aria-hidden />;
  }
  if (normalized.includes("send")) {
    return <Send size={14} aria-hidden />;
  }
  if (normalized.includes("create") || normalized.includes("add")) {
    return <Plus size={14} aria-hidden />;
  }
  return <Check size={14} aria-hidden />;
};

const findPendingActionCard = (
  messages: AskBloomMessage[],
): PendingActionCard | null => {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const message = messages[messageIndex];
    for (
      let blockIndex = message.blocks.length - 1;
      blockIndex >= 0;
      blockIndex -= 1
    ) {
      const block = message.blocks[blockIndex];
      if (block.type === "mutation_action" && block.status === "pending") {
        return { messageId: message.id, card: block };
      }
    }
  }

  return null;
};

const persistedToolResultBlocksToResolverBlocks = (
  messages: AskBloomMessage[],
): BloomStreamingBlock[] => {
  const resolverBlocks: BloomStreamingBlock[] = [];

  for (const message of messages) {
    message.blocks.forEach((block, index) => {
      if (block.type !== "tool_result") {
        return;
      }

      resolverBlocks.push({
        id: block.id ?? `${message.id}-tool-result-${index}`,
        toolName: block.toolResult?.toolName ?? null,
        blockType: block.toolResult?.blockType ?? "",
        payload: (block.toolResult?.data ??
          block.data) as BloomStreamingBlock["payload"],
        createdAt: message.createdAt,
      });
    });
  }

  return resolverBlocks;
};

const mergeResolverBlocks = (
  persistedBlocks: BloomStreamingBlock[],
  streamingBlocks: BloomStreamingBlock[],
) => {
  const seen = new Set<string>();

  return [...persistedBlocks, ...streamingBlocks].filter((block) => {
    if (seen.has(block.id)) {
      return false;
    }
    seen.add(block.id);
    return true;
  });
};

function CompactRecordList({
  label,
  records,
}: {
  label: string;
  records: CompactRecord[];
}) {
  if (records.length === 0) {
    return null;
  }

  const visibleRecords = records.slice(0, 4);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderRadius: "8px",
        overflow: "hidden",
        maxHeight: 136,
        overflowY: "auto",
        scrollbarWidth: "thin",
      }}
    >
      <Box
        sx={{
          px: 1,
          py: 0.625,
          bgcolor: "background.level1",
          borderBottom: "1px solid",
          borderColor: "neutral.outlinedBorder",
        }}
      >
        <Typography
          level="body-xs"
          sx={{ fontWeight: 700, color: "text.secondary" }}
        >
          {label}
        </Typography>
      </Box>

      {visibleRecords.map((record, index) => (
        <Box
          key={`${record.primary}-${index}`}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.75,
            borderBottom:
              index < visibleRecords.length - 1 ? "1px solid" : "none",
            borderColor: "neutral.outlinedBorder",
            minWidth: 0,
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              bgcolor: "neutral.100",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              fontWeight: 700,
              color: "text.secondary",
              flexShrink: 0,
            }}
          >
            {record.initials}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              level="body-xs"
              sx={{
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {record.primary}
            </Typography>
            {record.secondary ? (
              <Typography
                level="body-xs"
                sx={{
                  color: "text.tertiary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {record.secondary}
              </Typography>
            ) : null}
          </Box>
          {record.badge ? (
            <Typography
              level="body-xs"
              sx={{ flexShrink: 0, color: "text.secondary", fontWeight: 700 }}
            >
              {record.badge}
            </Typography>
          ) : null}
        </Box>
      ))}

      {records.length > visibleRecords.length ? (
        <Box sx={{ px: 1, py: 0.5, bgcolor: "background.level1" }}>
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            and {records.length - visibleRecords.length} more
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function ResolvedRecordsPreview({ resolved }: { resolved: ResolvedApproval }) {
  const customers = resolved.customers ?? [];
  const products = resolved.products ?? [];
  const segment = resolved.segments?.[0];
  const campaign = resolved.campaigns?.[0];
  const tag = resolved.tags?.[0];

  if (
    customers.length === 0 &&
    products.length === 0 &&
    !segment &&
    !campaign &&
    !tag
  ) {
    return null;
  }

  return (
    <Box sx={{ mt: 1, display: "grid", gap: 0.75 }}>
      <CompactRecordList
        label={`${customers.length} customer${customers.length === 1 ? "" : "s"}`}
        records={customers.map((customer) => ({
          initials: initialsForName(customer.name),
          primary: customer.name,
          secondary: customer.email,
          badge: customer.totalSpent,
        }))}
      />

      {segment ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.75,
            borderRadius: "8px",
            bgcolor: "background.level1",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            minWidth: 0,
          }}
        >
          <Users
            size={12}
            aria-hidden
            style={{ opacity: 0.65, flexShrink: 0 }}
          />
          <Typography
            level="body-xs"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {segment.name}
          </Typography>
          {segment.type ? (
            <Typography
              level="body-xs"
              sx={{ color: "text.tertiary", flexShrink: 0 }}
            >
              {segment.type}
            </Typography>
          ) : null}
          {typeof segment.customerCount === "number" ? (
            <Typography
              level="body-xs"
              sx={{ color: "text.tertiary", flexShrink: 0 }}
            >
              {segment.customerCount} members
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {tag ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.75,
            borderRadius: "8px",
            bgcolor: "background.level1",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
          }}
        >
          <Tag size={12} aria-hidden style={{ opacity: 0.65 }} />
          <Typography level="body-xs" sx={{ fontWeight: 700 }}>
            {tag.name}
          </Typography>
        </Box>
      ) : null}

      <CompactRecordList
        label={`${products.length} product${products.length === 1 ? "" : "s"}`}
        records={products.map((product) => ({
          initials: initialsForName(product.name),
          primary: product.name,
          secondary: product.sku,
          badge: product.price,
        }))}
      />

      {campaign ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.75,
            borderRadius: "8px",
            bgcolor: "background.level1",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            minWidth: 0,
          }}
        >
          <Send
            size={12}
            aria-hidden
            style={{ opacity: 0.65, flexShrink: 0 }}
          />
          <Typography
            level="body-xs"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {campaign.name}
          </Typography>
          {campaign.status ? (
            <Typography
              level="body-xs"
              sx={{ color: "text.tertiary", flexShrink: 0 }}
            >
              {campaign.status}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function InlineRiskNote({
  color,
  children,
}: {
  color: "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0.75,
        mt: 0.875,
        pl: 1,
        borderLeft: "2px solid",
        borderColor: color === "danger" ? "danger.400" : "warning.400",
        color: color === "danger" ? "danger.plainColor" : "warning.plainColor",
      }}
    >
      <AlertTriangle
        size={13}
        aria-hidden
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <Typography level="body-xs" sx={{ color: "inherit", lineHeight: 1.5 }}>
        {children}
      </Typography>
    </Box>
  );
}

function ActionButtonRow({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.75,
        "& > *": {
          flex: "1 1 140px",
          minWidth: 0,
        },
      }}
    >
      {children}
    </Box>
  );
}

function ApprovalCard({
  ariaLabel,
  eyebrow,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  ariaLabel: string;
  eyebrow: string;
  title: string;
  description?: string | null;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Box role="region" aria-label={ariaLabel} sx={approvalWrapperSx}>
      <Box sx={approvalCardSx}>
        <Box sx={{ px: 1.25, pt: 1.25, pb: children || footer ? 1 : 1.25 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              minWidth: 0,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                level="body-xs"
                sx={{
                  color: "text.tertiary",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {eyebrow}
              </Typography>
              <Typography
                level="title-sm"
                sx={{ mt: 0.375, fontWeight: 700, lineHeight: 1.35 }}
              >
                {title}
              </Typography>
              {description ? (
                <Typography
                  level="body-xs"
                  sx={{ mt: 0.5, color: "text.tertiary", lineHeight: 1.5 }}
                >
                  {description}
                </Typography>
              ) : null}
            </Box>
            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              aria-label="Dismiss approval surface"
              onClick={onClose}
              sx={{ "--IconButton-size": "28px", flexShrink: 0 }}
            >
              <X size={15} aria-hidden />
            </IconButton>
          </Box>

          {children ? <Box sx={{ mt: 1 }}>{children}</Box> : null}
        </Box>

        {footer ? (
          <Box
            sx={{
              px: 1.25,
              py: 1.25,
              borderTop: "1px solid",
              borderColor: "neutral.outlinedBorder",
            }}
          >
            {footer}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function TaskPlanRow({
  task,
  resolved,
  selected,
  showCheckbox,
  disabled,
  onToggleSelected,
}: {
  task: BloomTaskPlanItem;
  resolved: ResolvedApproval;
  selected: boolean;
  showCheckbox: boolean;
  disabled: boolean;
  onToggleSelected: () => void;
}) {
  const ActionIcon = taskActionIcons[task.action];
  const warnings = task.validationAnnotations.filter(
    (annotation) =>
      annotation.type === "warning" || annotation.type === "error",
  );
  const showRiskWarning =
    resolved.riskLevel === "medium" || resolved.riskLevel === "high";
  const riskMessage =
    resolved.riskMessage ??
    (showRiskWarning ? "Review this action before approving." : null);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderRadius: "8px",
        px: 1,
        py: 1,
        bgcolor: "background.surface",
        opacity: disabled ? 0.64 : 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0.75,
          minWidth: 0,
        }}
      >
        {showCheckbox ? (
          <Checkbox
            size="sm"
            checked={selected}
            disabled={disabled}
            onChange={onToggleSelected}
            slotProps={{ input: { "aria-label": `Select ${resolved.title}` } }}
            sx={{ mt: 0.125, flexShrink: 0 }}
          />
        ) : null}

        <ActionIcon
          size={15}
          aria-hidden
          style={{ flexShrink: 0, marginTop: 3 }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              minWidth: 0,
            }}
          >
            <Typography
              level="body-sm"
              sx={{
                flex: 1,
                minWidth: 0,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {resolved.title}
            </Typography>
            <JoyChip
              size="sm"
              variant="soft"
              color={taskRiskColor[resolved.riskLevel]}
            >
              {taskRiskLabel[resolved.riskLevel]}
            </JoyChip>
          </Box>

          {resolved.description ? (
            <Typography
              level="body-xs"
              sx={{ mt: 0.5, color: "text.tertiary", lineHeight: 1.5 }}
            >
              {resolved.description}
            </Typography>
          ) : null}

          <ResolvedRecordsPreview resolved={resolved} />

          {riskMessage ? (
            <InlineRiskNote
              color={resolved.riskLevel === "high" ? "danger" : "warning"}
            >
              {riskMessage}
            </InlineRiskNote>
          ) : null}

          {warnings.map((annotation, index) => (
            <InlineRiskNote
              key={`${task.taskId}-${annotation.type}-${index}`}
              color={annotation.type === "error" ? "danger" : "warning"}
            >
              {annotation.message}
            </InlineRiskNote>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function TaskPlanSurface({
  plan,
  askBloom,
  resolverBlocks,
}: {
  plan: BloomTaskPlan;
  askBloom: ReturnType<typeof useAskBloom>;
  resolverBlocks: BloomStreamingBlock[];
}) {
  const resolvedTasks = React.useMemo(
    () =>
      plan.tasks.map((task) => ({
        task,
        resolved: resolveApproval(
          { toolName: task.toolName, params: task.toolParams },
          resolverBlocks,
        ),
      })),
    [plan.tasks, resolverBlocks],
  );

  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(
    () =>
      new Set(
        plan.tasks
          .filter((task) => !taskHasBlockingError(task))
          .map((task) => task.taskId),
      ),
  );

  React.useEffect(() => {
    setSelectedTaskIds(
      new Set(
        plan.tasks
          .filter((task) => !taskHasBlockingError(task))
          .map((task) => task.taskId),
      ),
    );
  }, [plan.planId, plan.tasks]);

  const selectableTaskIds = React.useMemo(
    () =>
      plan.tasks
        .filter((task) => !taskHasBlockingError(task))
        .map((task) => task.taskId),
    [plan.tasks],
  );

  const isClientTextPlan = plan.planId.startsWith("text-plan-");
  const isSingleTask = plan.tasks.length === 1;
  const singleResolved = isSingleTask ? resolvedTasks[0]?.resolved : null;
  const totalSelectable = selectableTaskIds.length;
  const selectedCount = selectedTaskIds.size;
  const approveDisabled = isClientTextPlan || selectedCount === 0;
  const headerTitle = singleResolved
    ? singleResolved.title
    : `Approve ${plan.tasks.length} planned actions`;
  const headerDescription = isSingleTask
    ? plan.summary || singleResolved?.description || null
    : plan.summary ||
      (totalSelectable === 0
        ? "This plan includes blocking validation issues."
        : `${selectedCount} of ${totalSelectable} actions selected.`);
  const approveLabel = isClientTextPlan
    ? "Await Structured Plan"
    : singleResolved
      ? singleResolved.buttonLabel
      : totalSelectable > 0 && selectedCount === totalSelectable
        ? "Approve All"
        : `Approve Selected (${selectedCount})`;
  const toggleSelected = (taskId: string) => {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleApprove = () => {
    if (approveDisabled) {
      return;
    }

    const approvedTaskIds = plan.tasks
      .map((task) => task.taskId)
      .filter((taskId) => selectedTaskIds.has(taskId));

    void askBloom.approveTaskPlan(plan, approvedTaskIds, {}).catch((error) => {
      console.error("Failed to approve Ask Bloom task plan", error);
    });
    askBloom.dismissPendingTaskPlan();
  };

  const handleCancel = () => {
    askBloom.cancelTaskPlan(plan.planId);
    askBloom.dismissPendingTaskPlan();
  };

  const handleDiscuss = () => {
    askBloom.dismissPendingTaskPlan();
    askBloom.sendMessage(DISCUSS_PROMPT);
  };

  return (
    <ApprovalCard
      ariaLabel="Ask Bloom task plan approval"
      eyebrow="Review plan"
      title={headerTitle}
      description={headerDescription}
      onClose={handleCancel}
      footer={
        <ActionButtonRow>
          <JoyButton
            size="sm"
            variant="solid"
            color={
              singleResolved && !singleResolved.isReversible
                ? "danger"
                : "primary"
            }
            startDecorator={getActionButtonIcon(approveLabel)}
            disabled={approveDisabled}
            onClick={handleApprove}
          >
            {approveLabel}
          </JoyButton>
          <JoyButton
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={handleCancel}
          >
            Cancel
          </JoyButton>
          <JoyButton
            size="sm"
            variant="plain"
            color="neutral"
            startDecorator={<MessageCircle size={14} aria-hidden />}
            onClick={handleDiscuss}
          >
            Discuss
          </JoyButton>
        </ActionButtonRow>
      }
    >
      <Box
        sx={{
          display: "grid",
          gap: 0.75,
          maxHeight: 292,
          overflowY: "auto",
          overflowX: "hidden",
          pr: 0.25,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--joy-palette-neutral-300) transparent",
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--joy-palette-neutral-300)",
            borderRadius: 999,
          },
        }}
      >
        {resolvedTasks.map(({ task, resolved }) => (
          <TaskPlanRow
            key={task.taskId}
            task={task}
            resolved={resolved}
            selected={selectedTaskIds.has(task.taskId)}
            showCheckbox={!isSingleTask}
            disabled={taskHasBlockingError(task)}
            onToggleSelected={() => toggleSelected(task.taskId)}
          />
        ))}
      </Box>

      {isClientTextPlan ? (
        <InlineRiskNote color="warning">
          Ask Bloom intercepted a text-only plan preview. Discuss or retry to
          get the structured approval plan that executes through Bloom&apos;s
          confirmed task-plan path.
        </InlineRiskNote>
      ) : null}
    </ApprovalCard>
  );
}

function ResourceFieldRow({
  field,
  index,
  value,
  error,
  isFocused,
  isLast,
  onChange,
  onFocus,
  onBlur,
}: {
  field: ResourceFormField;
  index: number;
  value: string;
  error?: string;
  isFocused: boolean;
  isLast: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const isTextarea = field.type === "textarea";
  const ariaLabel = field.required ? `${field.label}, required` : field.label;
  const fieldSelector = `[data-ask-bloom-field-id="${field.name}"]`;

  const focusControl = () => {
    document.querySelector<HTMLElement>(fieldSelector)?.focus();
  };

  let control: React.ReactNode;

  if (field.type === "boolean") {
    control = (
      <Switch
        size="sm"
        checked={value === "true" || value === "yes"}
        onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        onFocus={onFocus}
        onBlur={onBlur}
        slotProps={{
          input: {
            "aria-label": ariaLabel,
            "data-ask-bloom-field-id": field.name,
          },
        }}
      />
    );
  } else if (field.type === "select") {
    control = (
      <Select
        size="sm"
        variant="plain"
        placeholder="Select..."
        value={value || null}
        onChange={(_event, nextValue) =>
          onChange((nextValue as string | null) ?? "")
        }
        onFocus={onFocus}
        onBlur={onBlur}
        slotProps={{
          button: {
            "aria-label": ariaLabel,
            "data-ask-bloom-field-id": field.name,
          },
        }}
        sx={{
          width: "100%",
          minHeight: 32,
          bgcolor: "transparent",
          "--Select-focusedHighlight": "transparent",
        }}
      >
        {(field.options ?? []).map((option) => (
          <Option key={option} value={option}>
            {option}
          </Option>
        ))}
      </Select>
    );
  } else if (isTextarea) {
    control = (
      <Textarea
        size="sm"
        variant="plain"
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        minRows={2}
        maxRows={4}
        slotProps={{
          textarea: {
            "aria-label": ariaLabel,
            "data-ask-bloom-field-id": field.name,
          },
        }}
        sx={{
          width: "100%",
          bgcolor: "transparent",
          p: 0,
          "--Textarea-focusedHighlight": "transparent",
        }}
      />
    );
  } else {
    control = (
      <Input
        size="sm"
        variant="plain"
        type={
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "tel"
              : "text"
        }
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        slotProps={{
          input: {
            "aria-label": ariaLabel,
            "data-ask-bloom-field-id": field.name,
          },
        }}
        sx={{
          width: "100%",
          minHeight: 32,
          bgcolor: "transparent",
          "--Input-focusedHighlight": "transparent",
          "& input": { p: 0 },
        }}
      />
    );
  }

  return (
    <Box
      onClick={focusControl}
      sx={{
        px: 1,
        py: 1,
        borderBottom: isLast ? "none" : "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderLeft: "2px solid",
        borderLeftColor: isFocused ? "primary.500" : "transparent",
        bgcolor: isFocused ? "background.level1" : "transparent",
        cursor:
          field.type === "boolean" || field.type === "select"
            ? "pointer"
            : "text",
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
      >
        <Box
          aria-hidden
          sx={{
            width: 22,
            height: 22,
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid",
            borderColor: isFocused ? "primary.400" : "neutral.outlinedBorder",
            color: isFocused ? "primary.plainColor" : "text.tertiary",
            fontSize: "10px",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {index}
        </Box>
        <Typography
          level="body-sm"
          sx={{
            minWidth: 0,
            fontWeight: 700,
            color: isFocused ? "text.primary" : "text.secondary",
            lineHeight: 1.35,
          }}
        >
          {field.label}
          {field.required ? (
            <Typography component="span" level="body-sm" color="danger">
              {" *"}
            </Typography>
          ) : null}
        </Typography>
      </Box>

      <Box sx={{ mt: 0.75 }}>{control}</Box>

      {error ? (
        <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}

function ResourceFormSurface({
  pendingForm,
  askBloom,
}: {
  pendingForm: PendingResourceForm;
  askBloom: ReturnType<typeof useAskBloom>;
}) {
  const form = React.useMemo(
    () =>
      getFormSchema(
        pendingForm.resourceType,
        pendingForm.fields,
        pendingForm.prefilledValues,
      ),
    [pendingForm],
  );

  const initialValues = React.useMemo(() => {
    const nextValues: Record<string, string> = {};
    for (const field of form.fields) {
      nextValues[field.name] =
        askBloom.restoredFormValues?.[field.name] ??
        pendingForm.prefilledValues[field.name] ??
        field.defaultValue ??
        "";
    }
    return nextValues;
  }, [askBloom.restoredFormValues, form.fields, pendingForm.prefilledValues]);

  const [values, setValues] =
    React.useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const blurTimerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues, pendingForm.messageId]);

  React.useEffect(
    () => () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
    },
    [],
  );

  const updateField = (name: string, value: string) => {
    setValues((previous) => {
      const next = { ...previous, [name]: value };
      askBloom.persistResourceFormState(next);
      return next;
    });

    setErrors((previous) => {
      if (!previous[name]) {
        return previous;
      }

      const next = { ...previous };
      delete next[name];
      return next;
    });
  };

  const handleFieldFocus = (fieldName: string) => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
    }
    setFocusedField(fieldName);
  };

  const handleFieldBlur = () => {
    blurTimerRef.current = window.setTimeout(() => {
      setFocusedField(null);
    }, 100);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    for (const field of form.fields) {
      const current = values[field.name]?.trim() ?? "";
      if (field.required && !current) {
        nextErrors[field.name] = `${field.label} is required`;
        continue;
      }

      if (field.type === "email" && current && !/\S+@\S+\.\S+/.test(current)) {
        nextErrors[field.name] = "Enter a valid email address";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    askBloom.dismissResourceForm();
    askBloom.sendMessage(buildResourceMessage(form, values));
  };

  const handleCancel = () => {
    askBloom.dismissResourceForm();
    askBloom.sendMessage(buildCancellationMessage(form));
  };

  const handleTypeInstead = () => {
    askBloom.dismissResourceForm();
    askBloom.sendMessage(buildTypeInsteadMessage(form, values));
  };

  return (
    <ApprovalCard
      ariaLabel="Ask Bloom resource form"
      eyebrow="Creation form"
      title={form.title}
      description={form.description}
      onClose={handleCancel}
      footer={
        <ActionButtonRow>
          <JoyButton
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<Check size={14} aria-hidden />}
            onClick={handleSubmit}
          >
            {form.submitLabel}
          </JoyButton>
          <JoyButton
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={handleCancel}
          >
            Cancel
          </JoyButton>
          <JoyButton
            size="sm"
            variant="plain"
            color="neutral"
            startDecorator={<Pencil size={14} aria-hidden />}
            onClick={handleTypeInstead}
          >
            Type Instead
          </JoyButton>
        </ActionButtonRow>
      }
    >
      <Box
        sx={{
          border: "1px solid",
          borderColor: "neutral.outlinedBorder",
          borderRadius: "8px",
          maxHeight: 316,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--joy-palette-neutral-300) transparent",
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--joy-palette-neutral-300)",
            borderRadius: 999,
          },
        }}
      >
        {form.fields.map((field, index) => (
          <ResourceFieldRow
            key={field.name}
            field={field}
            index={index + 1}
            value={values[field.name] ?? ""}
            error={errors[field.name]}
            isFocused={focusedField === field.name}
            isLast={index === form.fields.length - 1}
            onChange={(nextValue) => updateField(field.name, nextValue)}
            onFocus={() => handleFieldFocus(field.name)}
            onBlur={handleFieldBlur}
          />
        ))}
      </Box>
    </ApprovalCard>
  );
}

function LegacyActionCardSurface({
  pending,
  askBloom,
}: {
  pending: PendingActionCard;
  askBloom: ReturnType<typeof useAskBloom>;
}) {
  const { card, messageId } = pending;
  const risk = inferRiskLevel(card.toolName);
  const primaryValue = primaryArgValue(card.toolArgs);

  const handleApprove = () => {
    void askBloom.executeActionCard(messageId, card).catch((error) => {
      console.error("Failed to apply Ask Bloom action", error);
    });
  };

  const handleCancel = () => {
    askBloom.dismissActionCard(messageId, card.mutationId);
  };

  return (
    <ApprovalCard
      ariaLabel="Ask Bloom action approval"
      eyebrow="Approval needed"
      title={card.description}
      description={`${humanizeToolName(card.toolName)}${
        primaryValue ? ` • ${primaryValue}` : ""
      }`}
      onClose={handleCancel}
      footer={
        <ActionButtonRow>
          <JoyButton
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<Check size={14} aria-hidden />}
            onClick={handleApprove}
          >
            Approve
          </JoyButton>
          <JoyButton
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={handleCancel}
          >
            Cancel
          </JoyButton>
        </ActionButtonRow>
      }
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
      >
        <Zap size={14} aria-hidden style={{ flexShrink: 0 }} />
        <JoyChip size="sm" variant="soft" color={legacyRiskColor[risk]}>
          {legacyRiskLabel[risk]}
        </JoyChip>
      </Box>

      {risk !== "low" ? (
        <InlineRiskNote color={risk === "high" ? "danger" : "warning"}>
          {risk === "high"
            ? "This action cannot be undone."
            : "This action may have side effects."}
        </InlineRiskNote>
      ) : null}
    </ApprovalCard>
  );
}

export function AskBloomApprovalBar() {
  const askBloom = useAskBloom();

  const pendingActionCard = React.useMemo(
    () => findPendingActionCard(askBloom.state.messages),
    [askBloom.state.messages],
  );

  const resolverBlocks = React.useMemo(
    () =>
      mergeResolverBlocks(
        persistedToolResultBlocksToResolverBlocks(askBloom.state.messages),
        askBloom.state.streamingBlocks,
      ),
    [askBloom.state.messages, askBloom.state.streamingBlocks],
  );

  if (askBloom.pendingTaskPlan) {
    return (
      <TaskPlanSurface
        plan={askBloom.pendingTaskPlan}
        askBloom={askBloom}
        resolverBlocks={resolverBlocks}
      />
    );
  }

  if (askBloom.pendingResourceForm) {
    return (
      <ResourceFormSurface
        key={askBloom.pendingResourceForm.messageId}
        pendingForm={askBloom.pendingResourceForm}
        askBloom={askBloom}
      />
    );
  }

  if (pendingActionCard) {
    return (
      <LegacyActionCardSurface
        pending={pendingActionCard}
        askBloom={askBloom}
      />
    );
  }

  return null;
}
