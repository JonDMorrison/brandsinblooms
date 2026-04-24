import * as React from "react";
import Alert from "@mui/joy/Alert";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Breadcrumbs from "@mui/joy/Breadcrumbs";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  MessageSquareText,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import { SMSComposer } from "@/components/sms/SMSComposer";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

interface AutomationStep {
  id: string;
  step: number;
  delay_hours: number;
  message: string;
  image_url?: string | null;
  media_urls?: string[];
}

interface AutomationCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface AutomationFormState {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  status: "draft" | "active" | "paused";
}

interface SMSAutomationRecord {
  created_at: string;
  description: string | null;
  flow: unknown;
  id: string;
  name: string;
  status: string | null;
  tenant_id: string | null;
  trigger_config: Record<string, unknown> | null;
  trigger_type: string;
  updated_at: string;
}

const TRIGGER_TYPES = [
  {
    value: "signup",
    label: "New Customer Signup",
    description: "When a customer first joins your list",
  },
  {
    value: "purchase",
    label: "After Purchase",
    description: "Following a completed purchase",
  },
  {
    value: "abandoned_cart",
    label: "Abandoned Cart",
    description: "When items are left in cart",
  },
  {
    value: "birthday",
    label: "Customer Birthday",
    description: "On the customer's birthday",
  },
  {
    value: "manual",
    label: "Manual Trigger",
    description: "Triggered manually by staff",
  },
];

const CONDITION_FIELDS = [
  { value: "customer_segment", label: "Customer segment" },
  { value: "last_purchase_days", label: "Days since last purchase" },
  { value: "order_count", label: "Order count" },
  { value: "total_spent", label: "Total spent" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
];

const DELAY_OPTIONS = [
  { value: "0", label: "Immediately" },
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "24", label: "1 day" },
  { value: "48", label: "2 days" },
  { value: "72", label: "3 days" },
  { value: "168", label: "1 week" },
];

const WIZARD_STEPS = [
  {
    title: "Trigger",
    subtitle: "Choose the event that starts the automation.",
    icon: Zap,
  },
  {
    title: "Conditions",
    subtitle: "Limit sends to customers who match specific rules.",
    icon: Filter,
  },
  {
    title: "Message",
    subtitle: "Build the SMS sequence customers will receive.",
    icon: MessageSquareText,
  },
  {
    title: "Review",
    subtitle: "Review the automation before saving.",
    icon: ClipboardList,
  },
] as const;

const MOUNT_SKELETON_MS = 260;

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyStep(
  stepNumber: number,
  delayHours = stepNumber === 1 ? 0 : 24,
): AutomationStep {
  return {
    id: createId(),
    step: stepNumber,
    delay_hours: delayHours,
    message: "",
    image_url: null,
    media_urls: [],
  };
}

function createEmptyCondition(): AutomationCondition {
  return {
    id: createId(),
    field: "customer_segment",
    operator: "contains",
    value: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(
  status: string | null | undefined,
): AutomationFormState["status"] {
  if (status === "active" || status === "paused") {
    return status;
  }

  return "draft";
}

function parseFlowSteps(flow: unknown) {
  const rawSteps = Array.isArray(flow)
    ? flow
    : isRecord(flow) && Array.isArray(flow.steps)
      ? flow.steps
      : [];

  if (!rawSteps.length) {
    return [createEmptyStep(1)];
  }

  return rawSteps.map((rawStep, index) => {
    const normalized = isRecord(rawStep) ? rawStep : {};
    const mediaUrls = Array.isArray(normalized.media_urls)
      ? normalized.media_urls.filter(
          (value): value is string => typeof value === "string",
        )
      : [];

    return {
      id: typeof normalized.id === "string" ? normalized.id : createId(),
      step: typeof normalized.step === "number" ? normalized.step : index + 1,
      delay_hours:
        typeof normalized.delay_hours === "number"
          ? normalized.delay_hours
          : typeof normalized.delay === "number"
            ? normalized.delay
            : index === 0
              ? 0
              : 24,
      message:
        typeof normalized.message === "string"
          ? normalized.message
          : typeof normalized.content === "string"
            ? normalized.content
            : "",
      image_url:
        typeof normalized.image_url === "string" ? normalized.image_url : null,
      media_urls: mediaUrls,
    } satisfies AutomationStep;
  });
}

function parseConditions(
  triggerConfig: Record<string, unknown> | null | undefined,
) {
  const rawConditions = Array.isArray(triggerConfig?.conditions)
    ? triggerConfig.conditions
    : [];

  if (!rawConditions.length) {
    return [createEmptyCondition()];
  }

  return rawConditions.map((rawCondition) => {
    const normalized = isRecord(rawCondition) ? rawCondition : {};

    return {
      id: createId(),
      field:
        typeof normalized.field === "string"
          ? normalized.field
          : CONDITION_FIELDS[0].value,
      operator:
        typeof normalized.operator === "string"
          ? normalized.operator
          : CONDITION_OPERATORS[0].value,
      value: typeof normalized.value === "string" ? normalized.value : "",
    } satisfies AutomationCondition;
  });
}

function getDelayLabel(hours: number) {
  if (hours === 0) {
    return "Immediately";
  }

  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function WizardSkeleton() {
  return (
    <Stack spacing={2.5}>
      <Stack spacing={1.25}>
        <Skeleton variant="text" sx={{ width: 220, height: 16 }} />
        <Skeleton variant="text" sx={{ width: 280, height: 34 }} />
        <Skeleton variant="text" sx={{ width: 430, height: 18 }} />
      </Stack>

      <Sheet
        variant="soft"
        sx={{
          borderRadius: "28px",
          p: 1.5,
          bgcolor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.05)",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
            gap: 1.25,
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Card
              key={index}
              variant="outlined"
              sx={{ borderRadius: "20px", p: 1.75, borderColor: "neutral.200" }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Skeleton variant="circular" width={36} height={36} />
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Skeleton variant="text" sx={{ width: "68%", height: 16 }} />
                  <Skeleton variant="text" sx={{ width: "88%", height: 12 }} />
                </Stack>
              </Stack>
            </Card>
          ))}
        </Box>
      </Sheet>

      <Card
        variant="outlined"
        sx={{
          borderRadius: "28px",
          p: { xs: 2, md: 3 },
          borderColor: "neutral.200",
        }}
      >
        <Stack spacing={2.5}>
          <Skeleton variant="text" sx={{ width: 180, height: 20 }} />
          <Skeleton
            variant="rectangular"
            sx={{ width: "100%", height: 160, borderRadius: "18px" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: "100%", height: 160, borderRadius: "18px" }}
          />
        </Stack>
      </Card>
    </Stack>
  );
}

export default function SMSAutomationWizard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [activeStep, setActiveStep] = React.useState(0);
  const [showMountSkeleton, setShowMountSkeleton] = React.useState(true);

  const [automationData, setAutomationData] =
    React.useState<AutomationFormState>({
      name: "",
      description: "",
      trigger_type: "",
      trigger_config: {},
      status: "draft",
    });

  const [steps, setSteps] = React.useState<AutomationStep[]>([
    createEmptyStep(1),
  ]);
  const [conditions, setConditions] = React.useState<AutomationCondition[]>([
    createEmptyCondition(),
  ]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowMountSkeleton(false);
    }, MOUNT_SKELETON_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  const automationQuery = useQuery({
    queryKey: ["sms-automation", tenant?.id, id],
    enabled: Boolean(isEditing && id && user && tenant),
    queryFn: async (): Promise<SMSAutomationRecord | null> => {
      const { data, error } = await supabase
        .from("sms_automations")
        .select(
          "id, name, description, trigger_type, trigger_config, flow, status, created_at, updated_at, tenant_id",
        )
        .eq("tenant_id", tenant?.id || "")
        .eq("id", id || "")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data || null) as SMSAutomationRecord | null;
    },
  });

  React.useEffect(() => {
    if (!automationQuery.data) {
      return;
    }

    setAutomationData({
      name: automationQuery.data.name || "",
      description: automationQuery.data.description || "",
      trigger_type: automationQuery.data.trigger_type || "",
      trigger_config: automationQuery.data.trigger_config || {},
      status: normalizeStatus(automationQuery.data.status),
    });
    setConditions(parseConditions(automationQuery.data.trigger_config || {}));
    setSteps(parseFlowSteps(automationQuery.data.flow));
  }, [automationQuery.data]);

  React.useEffect(() => {
    setAutomationData((previous) => ({
      ...previous,
      trigger_config: {
        ...(isRecord(previous.trigger_config) ? previous.trigger_config : {}),
        conditions: conditions.map(({ field, operator, value }) => ({
          field,
          operator,
          value,
        })),
      },
    }));
  }, [conditions]);

  const addStep = () => {
    setSteps((current) => [
      ...current,
      createEmptyStep(current.length + 1, 24),
    ]);
  };

  const removeStep = (stepId: string) => {
    if (steps.length > 1) {
      const newSteps = steps
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, step: index + 1 }));
      setSteps(newSteps);
    }
  };

  const updateStep = (
    stepId: string,
    field: keyof AutomationStep,
    value: string | number | string[] | null,
  ) => {
    setSteps(
      steps.map((step) =>
        step.id === stepId ? { ...step, [field]: value } : step,
      ),
    );
  };

  const addCondition = () => {
    setConditions((current) => [...current, createEmptyCondition()]);
  };

  const removeCondition = (conditionId: string) => {
    setConditions((current) =>
      current.length > 1
        ? current.filter((condition) => condition.id !== conditionId)
        : current,
    );
  };

  const updateCondition = (
    conditionId: string,
    field: keyof AutomationCondition,
    value: string,
  ) => {
    setConditions((current) =>
      current.map((condition) =>
        condition.id === conditionId
          ? { ...condition, [field]: value }
          : condition,
      ),
    );
  };

  const handleSave = () => {
    navigate("/sms/automations");
  };

  const handleActivate = () => {
    setAutomationData((previous) => ({ ...previous, status: "active" }));
    navigate("/sms/automations");
  };

  const selectedTrigger = TRIGGER_TYPES.find(
    (trigger) => trigger.value === automationData.trigger_type,
  );

  const hasAnyConditionValues = conditions.some((condition) =>
    condition.value.trim(),
  );

  const canContinue = React.useMemo(() => {
    if (activeStep === 0) {
      return Boolean(
        automationData.name.trim() && automationData.trigger_type.trim(),
      );
    }

    if (activeStep === 2) {
      return steps.some((step) => step.message.trim());
    }

    return true;
  }, [activeStep, automationData.name, automationData.trigger_type, steps]);

  const shouldShowSkeleton =
    showMountSkeleton || (isEditing && automationQuery.isLoading);

  const title = isEditing
    ? automationData.name || "Edit SMS Automation"
    : "Create SMS Automation";

  const subtitle = isEditing
    ? "Update trigger, conditions, and message flow for this automation"
    : "Set up automated SMS workflows triggered by customer actions";

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography level="title-lg">Trigger setup</Typography>
              <Typography level="body-sm" color="neutral">
                Name the automation and choose the event that starts it.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <JoyInput
                label="Automation Name"
                value={automationData.name}
                onChange={(event) =>
                  setAutomationData((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g., Welcome Series"
              />
              <JoyInput
                label="Description"
                value={automationData.description}
                onChange={(event) =>
                  setAutomationData((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Describe what this automation does"
              />
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {TRIGGER_TYPES.map((trigger) => {
                const isSelected =
                  automationData.trigger_type === trigger.value;
                const Icon = Zap;

                return (
                  <Card
                    key={trigger.value}
                    component="button"
                    type="button"
                    variant={isSelected ? "soft" : "outlined"}
                    color={isSelected ? "primary" : "neutral"}
                    onClick={() =>
                      setAutomationData((previous) => ({
                        ...previous,
                        trigger_type: trigger.value,
                      }))
                    }
                    sx={{
                      textAlign: "left",
                      borderRadius: "24px",
                      p: 2.25,
                      borderColor: isSelected ? "primary.300" : "neutral.200",
                      transition:
                        "border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
                      "&:hover": {
                        borderColor: "primary.300",
                        transform: "translateY(-2px)",
                        boxShadow: "sm",
                      },
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={2}
                      >
                        <Avatar
                          size="sm"
                          variant="soft"
                          color={isSelected ? "primary" : "neutral"}
                        >
                          <Icon size={16} />
                        </Avatar>
                        {isSelected ? (
                          <Chip size="sm" variant="soft" color="primary">
                            Selected
                          </Chip>
                        ) : null}
                      </Stack>
                      <Stack spacing={0.5}>
                        <Typography level="title-sm">
                          {trigger.label}
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {trigger.description}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Card>
                );
              })}
            </Box>
          </Stack>
        );
      case 1:
        return (
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography level="title-lg">Conditions</Typography>
              <Typography level="body-sm" color="neutral">
                Build optional rules for the customers who should enter this
                automation.
              </Typography>
            </Stack>

            <Stack spacing={1.5}>
              {conditions.map((condition) => (
                <Box
                  key={condition.id}
                  sx={{
                    px: 0,
                    py: 0,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", lg: "row" }}
                    spacing={1.25}
                    alignItems={{ lg: "center" }}
                  >
                    <Select
                      size="sm"
                      value={condition.field}
                      onChange={(_event, value) =>
                        updateCondition(
                          condition.id,
                          "field",
                          (value as string) || CONDITION_FIELDS[0].value,
                        )
                      }
                      sx={{ minWidth: 180 }}
                    >
                      {CONDITION_FIELDS.map((option) => (
                        <Option key={option.value} value={option.value}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>

                    <Select
                      size="sm"
                      value={condition.operator}
                      onChange={(_event, value) =>
                        updateCondition(
                          condition.id,
                          "operator",
                          (value as string) || CONDITION_OPERATORS[0].value,
                        )
                      }
                      sx={{ minWidth: 160 }}
                    >
                      {CONDITION_OPERATORS.map((option) => (
                        <Option key={option.value} value={option.value}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>

                    <JoyInput
                      size="sm"
                      value={condition.value}
                      onChange={(event) =>
                        updateCondition(
                          condition.id,
                          "value",
                          event.target.value,
                        )
                      }
                      placeholder="Value"
                      sx={{ flex: 1 }}
                    />

                    <IconButton
                      size="sm"
                      variant="plain"
                      color="danger"
                      disabled={conditions.length === 1}
                      onClick={() => removeCondition(condition.id)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
            </Stack>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1.5}
            >
              <Typography level="body-sm" color="neutral">
                {hasAnyConditionValues
                  ? "These conditions are stored in the automation trigger configuration."
                  : "No additional conditions will be applied unless you add values."}
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                startDecorator={<Plus size={16} />}
                onClick={addCondition}
                sx={{ borderRadius: "12px" }}
              >
                Add Condition
              </Button>
            </Stack>
          </Stack>
        );
      case 2:
        return (
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ md: "center" }}
            >
              <Stack spacing={0.5}>
                <Typography level="title-lg">Message flow</Typography>
                <Typography level="body-sm" color="neutral">
                  Add one or more SMS steps and choose when each message should
                  send.
                </Typography>
              </Stack>
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                startDecorator={<Plus size={16} />}
                onClick={addStep}
                sx={{ borderRadius: "12px" }}
              >
                Add Step
              </Button>
            </Stack>

            <Stack spacing={2}>
              {steps.map((step) => (
                <Card
                  key={step.id}
                  variant="outlined"
                  sx={{
                    borderRadius: "26px",
                    borderColor: "neutral.200",
                    p: { xs: 1.5, md: 2 },
                  }}
                >
                  <Stack spacing={1.75}>
                    <Stack
                      direction={{ xs: "column", lg: "row" }}
                      justifyContent="space-between"
                      spacing={1.25}
                      alignItems={{ lg: "center" }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar size="sm" variant="soft" color="primary">
                          {step.step}
                        </Avatar>
                        <Stack spacing={0.25}>
                          <Typography level="title-sm">
                            Step {step.step}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {getDelayLabel(step.delay_hours)}
                          </Typography>
                        </Stack>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select
                          size="sm"
                          value={String(step.delay_hours)}
                          onChange={(_event, value) =>
                            updateStep(
                              step.id,
                              "delay_hours",
                              Number(value || 0),
                            )
                          }
                          sx={{ minWidth: 160 }}
                        >
                          {DELAY_OPTIONS.map((option) => (
                            <Option key={option.value} value={option.value}>
                              {option.label}
                            </Option>
                          ))}
                        </Select>
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="danger"
                          disabled={steps.length === 1}
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Stack>
                    </Stack>

                    <SMSComposer
                      value={step.message}
                      onChange={(value) =>
                        updateStep(step.id, "message", value)
                      }
                      imageUrl={step.image_url || undefined}
                      onImageChange={(imageUrl) =>
                        updateStep(step.id, "image_url", imageUrl)
                      }
                      mediaUrls={step.media_urls || []}
                      onMediaUrlsChange={(urls) =>
                        updateStep(step.id, "media_urls", urls)
                      }
                      placeholder={`Enter message for step ${step.step}...`}
                      showImageUpload
                      enableMultiImage
                    />
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Stack>
        );
      case 3:
        return (
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography level="title-lg">Review</Typography>
              <Typography level="body-sm" color="neutral">
                Check the trigger, conditions, and message sequence before
                saving.
              </Typography>
            </Stack>

            <Card
              variant="soft"
              sx={{ borderRadius: "26px", p: { xs: 2, md: 2.5 } }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5}>
                    <Typography level="title-lg">
                      {automationData.name || "Untitled Automation"}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {automationData.description || "No description provided."}
                    </Typography>
                  </Stack>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={
                      automationData.status === "active" ? "success" : "neutral"
                    }
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {automationData.status === "active" ? "Active" : "Draft"}
                  </Chip>
                </Stack>

                <Divider />

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 2,
                  }}
                >
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: "22px",
                      borderColor: "neutral.200",
                      p: 2,
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Typography
                        level="body-xs"
                        color="neutral"
                        sx={{
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Trigger
                      </Typography>
                      <Typography level="title-sm">
                        {selectedTrigger?.label || "Not selected"}
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        {selectedTrigger?.description ||
                          "Choose a trigger to describe how customers enter this automation."}
                      </Typography>
                    </Stack>
                  </Card>

                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: "22px",
                      borderColor: "neutral.200",
                      p: 2,
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Typography
                        level="body-xs"
                        color="neutral"
                        sx={{
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Conditions
                      </Typography>
                      {hasAnyConditionValues ? (
                        <Stack spacing={0.5}>
                          {conditions
                            .filter((condition) => condition.value.trim())
                            .map((condition) => (
                              <Typography
                                key={condition.id}
                                level="body-sm"
                                color="neutral"
                              >
                                {`${CONDITION_FIELDS.find((option) => option.value === condition.field)?.label || condition.field} ${CONDITION_OPERATORS.find((option) => option.value === condition.operator)?.label || condition.operator} ${condition.value}`}
                              </Typography>
                            ))}
                        </Stack>
                      ) : (
                        <Typography level="body-sm" color="neutral">
                          No additional audience conditions.
                        </Typography>
                      )}
                    </Stack>
                  </Card>
                </Box>

                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: "22px",
                    borderColor: "neutral.200",
                    p: 2,
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Message Flow
                    </Typography>
                    <Stack spacing={1}>
                      {steps.map((step) => (
                        <Stack key={step.id} spacing={0.4}>
                          <Typography level="body-sm" fontWeight="md">
                            {`Step ${step.step} - ${getDelayLabel(step.delay_hours)}`}
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {step.message
                              ? `${step.message.slice(0, 140)}${step.message.length > 140 ? "..." : ""}`
                              : "No message entered yet."}
                          </Typography>
                          {step.image_url ||
                          (step.media_urls && step.media_urls.length > 0) ? (
                            <Typography level="body-xs" color="primary">
                              {step.media_urls && step.media_urls.length > 1
                                ? `${step.media_urls.length} MMS images attached`
                                : "MMS media attached"}
                            </Typography>
                          ) : null}
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </Card>
              </Stack>
            </Card>
          </Stack>
        );
      default:
        return null;
    }
  };

  return (
    <PageContainer sx={{ py: 3 }}>
      <Stack spacing={2.5}>
        {shouldShowSkeleton ? (
          <WizardSkeleton />
        ) : automationQuery.error ? (
          <Alert color="danger" variant="soft" sx={{ borderRadius: "24px" }}>
            {automationQuery.error instanceof Error
              ? automationQuery.error.message
              : "Failed to load automation details."}
          </Alert>
        ) : (
          <>
            <Stack spacing={1.25}>
              <Breadcrumbs separator="/" size="sm">
                <Link
                  component={RouterLink}
                  to="/sms"
                  color="neutral"
                  underline="hover"
                >
                  SMS Campaigns
                </Link>
                <Link
                  component={RouterLink}
                  to="/sms/automations"
                  color="neutral"
                  underline="hover"
                >
                  Automations
                </Link>
                <Typography level="body-sm" color="neutral">
                  {isEditing ? title : "New Automation"}
                </Typography>
              </Breadcrumbs>

              <Stack spacing={0.5}>
                <Typography level="h3" fontWeight="lg">
                  {title}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  {subtitle}
                </Typography>
              </Stack>
            </Stack>

            <Sheet
              variant="soft"
              sx={{
                borderRadius: "28px",
                p: 1.5,
                bgcolor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.05)",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(4, minmax(0, 1fr))",
                  },
                  gap: 1.25,
                }}
              >
                {WIZARD_STEPS.map((step, index) => {
                  const isActive = activeStep === index;
                  const isComplete = index < activeStep;
                  const StepIcon = step.icon;

                  return (
                    <Card
                      key={step.title}
                      component="button"
                      type="button"
                      variant={isActive ? "solid" : "outlined"}
                      color={isActive ? "primary" : "neutral"}
                      onClick={() => {
                        if (index <= activeStep) {
                          setActiveStep(index);
                        }
                      }}
                      sx={{
                        borderRadius: "20px",
                        p: 1.75,
                        textAlign: "left",
                        borderColor: isActive
                          ? "primary.solidBg"
                          : "neutral.200",
                        bgcolor: isActive ? "primary.solidBg" : undefined,
                        color: isActive ? "primary.solidColor" : undefined,
                        opacity: index <= activeStep ? 1 : 0.72,
                        cursor: index <= activeStep ? "pointer" : "default",
                        "&:hover": isActive
                          ? {
                              bgcolor: "primary.solidHoverBg",
                              borderColor: "primary.solidHoverBg",
                            }
                          : undefined,
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar
                          size="sm"
                          variant={isActive ? "soft" : "soft"}
                          color={isComplete || isActive ? "primary" : "neutral"}
                        >
                          {isComplete ? (
                            <Check size={15} />
                          ) : (
                            <StepIcon size={15} />
                          )}
                        </Avatar>
                        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                          <Typography
                            level="title-sm"
                            sx={{ color: isActive ? "inherit" : undefined }}
                          >
                            {step.title}
                          </Typography>
                          <Typography
                            level="body-xs"
                            color={isActive ? undefined : "neutral"}
                            sx={{
                              color: isActive
                                ? "rgba(255,255,255,0.82)"
                                : undefined,
                            }}
                          >
                            {step.subtitle}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Card>
                  );
                })}
              </Box>
            </Sheet>

            <Card
              variant="outlined"
              sx={{
                borderRadius: "28px",
                p: { xs: 2, md: 3 },
                borderColor: "neutral.200",
              }}
            >
              {renderStepContent()}
            </Card>

            <Sheet
              className="bg-gray-100"
              variant="outlined"
              sx={{
                position: "sticky",
                bottom: 16,
                borderRadius: "24px",
                borderColor: "neutral.200",
                p: 1.5,
                bgcolor: "#f3f4f6",
                backdropFilter: "blur(12px)",
                boxShadow: "md",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                justifyContent="space-between"
                alignItems={{ md: "center" }}
              >
                <Button
                  variant="plain"
                  color="neutral"
                  startDecorator={<ChevronLeft size={16} />}
                  disabled={activeStep === 0}
                  onClick={() =>
                    setActiveStep((current) => Math.max(current - 1, 0))
                  }
                >
                  Back
                </Button>

                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="flex-end"
                  flexWrap="wrap"
                >
                  {activeStep < WIZARD_STEPS.length - 1 ? (
                    <Button
                      variant="solid"
                      endDecorator={<ChevronRight size={16} />}
                      disabled={!canContinue}
                      onClick={() =>
                        setActiveStep((current) =>
                          Math.min(current + 1, WIZARD_STEPS.length - 1),
                        )
                      }
                      sx={{ borderRadius: "12px" }}
                    >
                      Next
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        color="neutral"
                        onClick={handleSave}
                        sx={{ borderRadius: "12px" }}
                      >
                        Save Draft
                      </Button>
                      <Button
                        variant="solid"
                        color="primary"
                        onClick={handleActivate}
                        sx={{ borderRadius: "12px" }}
                      >
                        Save & Activate
                      </Button>
                    </>
                  )}
                </Stack>
              </Stack>
            </Sheet>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
