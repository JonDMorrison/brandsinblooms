import React, { useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Play,
  Rocket,
  Send,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyInput } from "@/components/joy/JoyInput";
import type {
  AutomationLaunchPayload,
  FlowValidationSummary,
} from "@/components/automation/flow/automationBuilderTypes";
import { getTriggerById } from "@/lib/automation/triggerCatalog";

type ReviewAutomation = Omit<AutomationLaunchPayload, "compilation"> & {
  compilation?: AutomationLaunchPayload["compilation"] | null;
  validation?: FlowValidationSummary;
};

interface ReviewLaunchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation: ReviewAutomation;
  onLaunch: () => void | Promise<void>;
  onTestSend: (recipient?: string) => void | Promise<void>;
  isLoading?: boolean;
  isTestSending?: boolean;
}

type ReviewTone = "success" | "warning" | "danger";

type PreflightItem = {
  label: string;
  detail: string;
  value: string;
  completed: boolean;
};

type MetricTileProps = {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
};

type TimelineStep = AutomationLaunchPayload["compilation"]["steps"][number];

export const ReviewLaunchModal: React.FC<ReviewLaunchModalProps> = ({
  open,
  onOpenChange,
  automation,
  onLaunch,
  onTestSend,
  isLoading = false,
  isTestSending = false,
}) => {
  const [testRecipient, setTestRecipient] = useState("");
  const triggerMeta = getTriggerById(automation.triggerType);
  const compiledSteps = automation.compilation?.steps ?? [];
  const blockers = automation.validation?.errors ?? [];
  const warnings = useMemo(
    () =>
      Array.from(
        new Set([
          ...(automation.compilation?.warnings ?? []),
          ...(automation.validation?.warnings ?? []),
        ]),
      ),
    [automation.compilation?.warnings, automation.validation?.warnings],
  );
  const statusTone: ReviewTone =
    blockers.length > 0
      ? "danger"
      : warnings.length > 0
        ? "warning"
        : "success";
  const statusLabel =
    blockers.length > 0
      ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"}`
      : warnings.length > 0
        ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
        : "Ready to activate";
  const emailStepCount = compiledSteps.filter(
    (step) => step.type === "email",
  ).length;
  const smsStepCount = compiledSteps.filter(
    (step) => step.type === "sms",
  ).length;
  const totalJourneyDelay = compiledSteps.reduce(
    (total, step) => total + Math.max(step.delayMin, 0),
    0,
  );
  const audienceIsEventDriven = triggerMeta?.audienceType === "event";
  const selectedFilterCount =
    automation.selectedAudience.personas.length +
    automation.selectedAudience.segments.length;
  const audienceReady =
    audienceIsEventDriven ||
    automation.selectedAudience.totalContacts > 0 ||
    selectedFilterCount > 0;
  const preflightItems = useMemo<PreflightItem[]>(
    () => [
      {
        label: "Trigger configured",
        value: triggerMeta?.label ?? automation.triggerType,
        completed: Boolean(triggerMeta ?? automation.triggerType),
        detail:
          triggerMeta?.description ??
          "Choose a trigger before activating this automation.",
      },
      {
        label: "Compiled workflow",
        value:
          compiledSteps.length > 0
            ? `${compiledSteps.length} live step${compiledSteps.length === 1 ? "" : "s"}`
            : "No compiled steps",
        completed: compiledSteps.length > 0,
        detail:
          compiledSteps.length > 0
            ? `${compiledSteps.length} executable step${compiledSteps.length === 1 ? "" : "s"} compiled from the live canvas.`
            : "Add at least one action step before launch.",
      },
      {
        label: "Audience reach",
        value: audienceIsEventDriven
          ? "Event-scoped"
          : `${automation.selectedAudience.totalContacts.toLocaleString()} contacts`,
        completed: audienceReady,
        detail: audienceIsEventDriven
          ? "Event triggers automatically target the customer who caused the event."
          : `${automation.selectedAudience.totalContacts.toLocaleString()} contacts currently match the selected filters.`,
      },
      {
        label: "Delivery content",
        value:
          blockers.length > 0
            ? "Blocked"
            : warnings.length > 0
              ? "Needs review"
              : "Reviewed",
        completed: blockers.length === 0,
        detail:
          blockers.length > 0
            ? "Resolve launch blockers before turning this automation on."
            : warnings.length > 0
              ? "Warnings do not block launch, but they should be reviewed before activation."
              : "Messages and timeline checks look healthy for activation.",
      },
    ],
    [
      automation.selectedAudience.totalContacts,
      automation.triggerType,
      audienceIsEventDriven,
      audienceReady,
      blockers.length,
      compiledSteps.length,
      triggerMeta,
      warnings.length,
    ],
  );
  const completedPreflightCount = preflightItems.filter(
    (item) => item.completed,
  ).length;
  const readinessPercent = Math.round(
    (completedPreflightCount / preflightItems.length) * 100,
  );
  const heroCopy =
    blockers.length > 0
      ? "Activation is blocked until the launch issues below are resolved."
      : warnings.length > 0
        ? "The automation can be activated, but there are a few quality checks worth reviewing first."
        : "Trigger, audience, and delivery flow all look ready for activation.";
  const launchSummaryLabel =
    compiledSteps.length === 0
      ? "Pending workflow"
      : totalJourneyDelay > 0
        ? `Journey span ${formatDelay(totalJourneyDelay)}`
        : "Immediate first touch";

  return (
    <JoyDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Review and Activate"
      description="Validate the trigger, audience, and delivery sequence before turning this automation on."
      startDecorator={
        <Sheet
          variant="soft"
          color={statusTone === "danger" ? "warning" : statusTone}
          sx={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Rocket size={18} />
        </Sheet>
      }
      size="xl"
      dialogSx={{ maxWidth: "min(96vw, 1160px)" }}
    >
      <JoyDialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        <Sheet
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: "xl",
            borderColor: `${statusTone}.200`,
            background: getHeroBackground(statusTone),
          }}
        >
          <Stack spacing={2.25}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", lg: "center" }}
            >
              <Stack spacing={0.75} sx={{ minWidth: 0, maxWidth: 720 }}>
                <Typography
                  level="body-xs"
                  sx={{
                    color: "neutral.600",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                  }}
                >
                  Launch Review
                </Typography>
                <Typography level="h2" sx={{ lineHeight: 1.05 }}>
                  {automation.name || "Untitled automation"}
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                  {heroCopy}
                </Typography>
              </Stack>

              <Stack
                spacing={1}
                alignItems={{ xs: "flex-start", lg: "flex-end" }}
              >
                <Chip
                  variant="soft"
                  color={statusTone}
                  startDecorator={<Sparkles size={12} />}
                >
                  {statusLabel}
                </Chip>
                <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                  {completedPreflightCount} of {preflightItems.length} launch
                  checks complete
                </Typography>
              </Stack>
            </Stack>

            <Stack spacing={0.75}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={1}
              >
                <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                  Activation readiness
                </Typography>
                <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                  {readinessPercent}%
                </Typography>
              </Stack>
              <LinearProgress
                determinate
                value={readinessPercent}
                color={statusTone === "danger" ? "warning" : statusTone}
                sx={{
                  "--LinearProgress-radius": "999px",
                  "--LinearProgress-thickness": "9px",
                }}
              />
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(4, minmax(0, 1fr))",
                },
                gap: 1.25,
              }}
            >
              <MetricTile
                label="Trigger"
                value={triggerMeta?.label ?? automation.triggerType}
                detail={triggerMeta?.category ?? "Automation entry point"}
                icon={<Play size={16} />}
              />
              <MetricTile
                label="Audience"
                value={
                  audienceIsEventDriven
                    ? "Event-driven"
                    : `${automation.selectedAudience.totalContacts.toLocaleString()} contacts`
                }
                detail={
                  audienceIsEventDriven
                    ? "Responds to the customer who fires the event"
                    : `${selectedFilterCount} saved filter${selectedFilterCount === 1 ? "" : "s"}`
                }
                icon={<Users size={16} />}
              />
              <MetricTile
                label="Channels"
                value={`${emailStepCount} email${emailStepCount === 1 ? "" : "s"} • ${smsStepCount} SMS`}
                detail="Compiled from the active canvas path"
                icon={<Mail size={16} />}
              />
              <MetricTile
                label="Journey"
                value={launchSummaryLabel}
                detail={
                  compiledSteps.length > 0
                    ? `Final path includes ${compiledSteps.length} delivery step${compiledSteps.length === 1 ? "" : "s"}`
                    : "Add a channel step to complete this launch review"
                }
                icon={<Clock3 size={16} />}
              />
            </Box>
          </Stack>
        </Sheet>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              xl: "minmax(0, 1.6fr) minmax(320px, 0.95fr)",
            },
            gap: 2,
          }}
        >
          <Sheet variant="outlined" sx={{ p: 2.25, borderRadius: "xl" }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircle2 size={18} />
                  <Typography level="title-md">Activation checklist</Typography>
                </Stack>
                <Chip variant="soft" color="neutral" size="sm">
                  {completedPreflightCount}/{preflightItems.length} complete
                </Chip>
              </Stack>

              <Stack spacing={1}>
                {preflightItems.map((item) => (
                  <Sheet
                    key={item.label}
                    variant="soft"
                    color={item.completed ? "success" : "neutral"}
                    sx={{
                      p: 1.5,
                      borderRadius: "lg",
                      border: "1px solid",
                      borderColor: item.completed
                        ? "success.200"
                        : "neutral.200",
                      backgroundColor: item.completed
                        ? "rgba(var(--joy-palette-success-mainChannel) / 0.10)"
                        : "rgba(var(--joy-palette-neutral-mainChannel) / 0.04)",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.25}
                      alignItems="flex-start"
                    >
                      <Sheet
                        variant="solid"
                        color={item.completed ? "success" : "neutral"}
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <CheckCircle2 size={14} />
                      </Sheet>
                      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography level="title-sm">{item.label}</Typography>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={item.completed ? "success" : "neutral"}
                          >
                            {item.value}
                          </Chip>
                        </Stack>
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.600" }}
                        >
                          {item.detail}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={{ p: 2.25, borderRadius: "xl" }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Users size={18} />
                <Typography level="title-md">Audience summary</Typography>
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip variant="soft" color="primary">
                  {automation.selectedAudience.totalContacts.toLocaleString()}{" "}
                  contacts
                </Chip>
                <Chip variant="soft" color="neutral">
                  {audienceIsEventDriven ? "Event-triggered" : "Saved filters"}
                </Chip>
                <Chip variant="soft" color="neutral">
                  {selectedFilterCount} filter
                  {selectedFilterCount === 1 ? "" : "s"}
                </Chip>
              </Stack>

              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                {audienceIsEventDriven
                  ? "This run acts on the customer who fired the event. Saved audience filters are optional and can still narrow eligibility."
                  : "Batch-triggered runs will scan the saved audience filters at execution time and activate for every matching contact."}
              </Typography>

              <Divider />

              {automation.selectedAudience.personas.length > 0 ? (
                <Stack spacing={0.75}>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    Personas
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    {automation.selectedAudience.personas.map((persona) => (
                      <Chip
                        key={persona.id}
                        variant="outlined"
                        color="neutral"
                        size="sm"
                      >
                        {persona.persona_name ?? persona.name}
                      </Chip>
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {automation.selectedAudience.segments.length > 0 ? (
                <Stack spacing={0.75}>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    Segments
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    {automation.selectedAudience.segments.map((segment) => (
                      <Chip
                        key={segment.id}
                        variant="outlined"
                        color="neutral"
                        size="sm"
                      >
                        {segment.name}
                      </Chip>
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {selectedFilterCount === 0 ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ p: 1.5, borderRadius: "lg" }}
                >
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    No additional personas or segments are applied to this
                    launch.
                  </Typography>
                </Sheet>
              ) : null}
            </Stack>
          </Sheet>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              xl: "minmax(0, 1.6fr) minmax(320px, 0.95fr)",
            },
            gap: 2,
          }}
        >
          <Sheet variant="outlined" sx={{ p: 2.25, borderRadius: "xl" }}>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Play size={18} />
                  <Typography level="title-md">Execution timeline</Typography>
                </Stack>
                <Chip variant="soft" color="primary" size="sm">
                  {compiledSteps.length} step
                  {compiledSteps.length === 1 ? "" : "s"}
                </Chip>
              </Stack>

              {compiledSteps.length > 0 ? (
                <Stack spacing={0.5}>
                  {compiledSteps.map((step, index) => (
                    <Stack
                      key={`${step.stepIndex ?? index}-${step.type ?? "step"}`}
                      direction="row"
                      spacing={1.25}
                      alignItems="stretch"
                    >
                      <Stack
                        alignItems="center"
                        spacing={0.5}
                        sx={{ width: 32, flexShrink: 0 }}
                      >
                        <Sheet
                          variant="solid"
                          color={step.type === "email" ? "primary" : "warning"}
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          {step.type === "email" ? (
                            <Mail size={14} />
                          ) : (
                            <MessageSquare size={14} />
                          )}
                        </Sheet>
                        {index < compiledSteps.length - 1 ? (
                          <Box
                            sx={{
                              width: 2,
                              flex: 1,
                              borderRadius: 999,
                              backgroundColor: "neutral.200",
                              minHeight: 32,
                            }}
                          />
                        ) : null}
                      </Stack>

                      <Sheet
                        variant="soft"
                        color="neutral"
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: "lg",
                          border: "1px solid",
                          borderColor: "neutral.200",
                          backgroundColor:
                            "rgba(var(--joy-palette-neutral-mainChannel) / 0.04)",
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography level="title-sm">
                                {stepTitle(step)}
                              </Typography>
                              <Chip
                                size="sm"
                                variant="soft"
                                color={
                                  step.type === "email" ? "primary" : "warning"
                                }
                              >
                                {step.type === "email" ? "Email" : "SMS"}
                              </Chip>
                            </Stack>

                            <Chip size="sm" variant="outlined" color="neutral">
                              {step.delayMin > 0
                                ? `After ${formatDelay(step.delayMin)}`
                                : "Immediate"}
                            </Chip>
                          </Stack>

                          <Typography
                            level="body-sm"
                            sx={{ color: "neutral.700" }}
                          >
                            {stepPreview(step)}
                          </Typography>
                        </Stack>
                      </Sheet>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ p: 2, borderRadius: "lg" }}
                >
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    No executable steps were compiled from the current canvas.
                  </Typography>
                </Sheet>
              )}
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={{ p: 2.25, borderRadius: "xl" }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TriangleAlert size={18} />
                <Typography level="title-md">Launch notes</Typography>
              </Stack>

              {blockers.length === 0 && warnings.length === 0 ? (
                <Sheet
                  variant="soft"
                  color="success"
                  sx={{ p: 1.75, borderRadius: "lg" }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircle2 size={16} />
                    <Box>
                      <Typography level="title-sm">
                        All checks look good
                      </Typography>
                      <Typography
                        level="body-sm"
                        sx={{ color: "neutral.700", mt: 0.25 }}
                      >
                        You can activate now, or send a final test first if you
                        want one last inbox review.
                      </Typography>
                    </Box>
                  </Stack>
                </Sheet>
              ) : null}

              {blockers.length > 0 ? (
                <Sheet
                  variant="soft"
                  color="danger"
                  sx={{ p: 1.75, borderRadius: "lg" }}
                >
                  <Stack spacing={0.75}>
                    <Typography level="title-sm">Launch blockers</Typography>
                    <List size="sm" sx={{ mt: 0.25 }}>
                      {blockers.map((blocker) => (
                        <ListItem key={blocker}>{blocker}</ListItem>
                      ))}
                    </List>
                  </Stack>
                </Sheet>
              ) : null}

              {warnings.length > 0 ? (
                <Sheet
                  variant="soft"
                  color="warning"
                  sx={{ p: 1.75, borderRadius: "lg" }}
                >
                  <Stack spacing={0.75}>
                    <Typography level="title-sm">Warnings to review</Typography>
                    <List size="sm" sx={{ mt: 0.25 }}>
                      {warnings.map((warning) => (
                        <ListItem key={warning}>{warning}</ListItem>
                      ))}
                    </List>
                  </Stack>
                </Sheet>
              ) : null}
            </Stack>
          </Sheet>
        </Box>
      </JoyDialogContent>

      <JoyDialogActions sx={{ backgroundColor: "background.level1" }}>
        <Box sx={{ width: "100%" }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", lg: "flex-end" }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <JoyInput
                type="email"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                label="Send a final test"
                placeholder="you@example.com"
                helperText="Leave blank to use your signed-in email address."
              />
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <JoyButton
                variant="outlined"
                color="neutral"
                onClick={() =>
                  void onTestSend(testRecipient.trim() || undefined)
                }
                loading={isTestSending}
                disabled={isLoading}
                startDecorator={<Send size={15} />}
              >
                Send test
              </JoyButton>
              <JoyButton
                variant="outlined"
                color="neutral"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Back to canvas
              </JoyButton>
              <JoyButton
                onClick={() => void onLaunch()}
                loading={isLoading}
                disabled={blockers.length > 0 || compiledSteps.length === 0}
                endDecorator={<ArrowRight size={15} />}
              >
                Activate automation
              </JoyButton>
            </Stack>
          </Stack>
        </Box>
      </JoyDialogActions>
    </JoyDialog>
  );
};

function MetricTile({ label, value, detail, icon }: MetricTileProps) {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        p: 1.5,
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.04)",
        minWidth: 0,
      }}
    >
      <Stack spacing={1}>
        <Sheet
          variant="soft"
          color="primary"
          sx={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </Sheet>
        <Box>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            {label}
          </Typography>
          <Typography level="title-sm" sx={{ mt: 0.25 }}>
            {value}
          </Typography>
        </Box>
        <Typography level="body-xs" sx={{ color: "neutral.600" }}>
          {detail}
        </Typography>
      </Stack>
    </Sheet>
  );
}

function stepTitle(step: TimelineStep) {
  if (step.type === "email") {
    return step.subject || "Email step";
  }

  if (step.type === "sms") {
    return (step.text || "SMS step").slice(0, 64);
  }

  if (step.type === "wait") {
    return "Delay";
  }

  return String(step.type || "Step");
}

function stepPreview(step: TimelineStep) {
  const value = step.text?.trim() || "No message content added yet.";
  return truncate(value, 140);
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function getHeroBackground(tone: ReviewTone) {
  switch (tone) {
    case "danger":
      return "linear-gradient(135deg, rgba(var(--joy-palette-danger-mainChannel) / 0.12) 0%, rgba(var(--joy-palette-warning-mainChannel) / 0.08) 48%, rgba(var(--joy-palette-neutral-mainChannel) / 0.03) 100%)";
    case "warning":
      return "linear-gradient(135deg, rgba(var(--joy-palette-warning-mainChannel) / 0.14) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.07) 48%, rgba(var(--joy-palette-neutral-mainChannel) / 0.03) 100%)";
    case "success":
    default:
      return "linear-gradient(135deg, rgba(var(--joy-palette-success-mainChannel) / 0.12) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 48%, rgba(var(--joy-palette-neutral-mainChannel) / 0.03) 100%)";
  }
}

function formatDelay(delayMin: number) {
  if (delayMin % 10080 === 0) {
    return `${delayMin / 10080} week${delayMin === 10080 ? "" : "s"}`;
  }

  if (delayMin % 1440 === 0) {
    return `${delayMin / 1440} day${delayMin === 1440 ? "" : "s"}`;
  }

  if (delayMin % 60 === 0) {
    return `${delayMin / 60} hour${delayMin === 60 ? "" : "s"}`;
  }

  return `${delayMin} minute${delayMin === 1 ? "" : "s"}`;
}
