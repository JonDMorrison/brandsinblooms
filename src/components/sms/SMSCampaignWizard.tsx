import * as React from "react";
import Alert from "@mui/joy/Alert";
import AspectRatio from "@mui/joy/AspectRatio";
import Autocomplete from "@mui/joy/Autocomplete";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Dropdown from "@mui/joy/Dropdown";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Link from "@mui/joy/Link";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ImagePlus,
  MessageSquareText,
  Rocket,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageContainer } from "@/components/joy/PageContainer";
import { useAuth } from "@/hooks/useAuth";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useSegments } from "@/hooks/useSegments";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { computeAudienceRecipientCount } from "@/lib/computeAudienceRecipientCount";
import {
  MERGE_TAG_DEFINITIONS,
  formatTagWithDefault,
} from "@/lib/mergeTagDefinitions";
import {
  countSmsSegments,
  getSegmentDescription,
  getUnicodeCharacters,
} from "@/lib/sms/smsSegmentCounter";

type WizardStepKey = "details" | "audience" | "content" | "schedule" | "review";

type AudienceMode = "all" | "segment" | "persona";
type ScheduleMode = "now" | "later";

type SegmentOption = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
};

type PersonaOption = {
  id: string;
  persona_name: string;
  persona_description?: string | null;
};

type StepDefinition = {
  key: WizardStepKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
};

type ValidationCheck = {
  key: string;
  label: string;
  detail: string;
  passed: boolean;
};

const WIZARD_STEPS: StepDefinition[] = [
  {
    key: "details",
    title: "Campaign Details",
    description: "Name, notes, and internal labels.",
    icon: Tag,
  },
  {
    key: "audience",
    title: "Audience",
    description: "Choose who should receive this send.",
    icon: Users,
  },
  {
    key: "content",
    title: "Content",
    description: "Write the SMS and preview the result.",
    icon: MessageSquareText,
  },
  {
    key: "schedule",
    title: "Schedule",
    description: "Send now or set a later delivery time.",
    icon: CalendarClock,
  },
  {
    key: "review",
    title: "Review & Launch",
    description: "Check everything before launching.",
    icon: Rocket,
  },
];

const AUDIENCE_OPTIONS: Array<{
  value: AudienceMode;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  {
    value: "all",
    title: "All Subscribers",
    description: "Reach every SMS-eligible subscriber in your tenant.",
    icon: Users,
  },
  {
    value: "segment",
    title: "Segment",
    description: "Send to one CRM segment and confirm the eligible count.",
    icon: Target,
  },
  {
    value: "persona",
    title: "Persona",
    description: "Focus the send around a single persona definition.",
    icon: Sparkles,
  },
];

const SCHEDULE_OPTIONS: Array<{
  value: ScheduleMode;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  {
    value: "now",
    title: "Send Now",
    description:
      "Launch immediately after review using the current campaign flow.",
    icon: Send,
  },
  {
    value: "later",
    title: "Schedule for Later",
    description: "Choose a date and time to queue this campaign ahead of time.",
    icon: Clock3,
  },
];

const TAG_SUGGESTIONS = [
  "Promotion",
  "VIP",
  "Seasonal",
  "Retention",
  "Product Launch",
  "Event",
  "Reminder",
];

const MOUNT_SKELETON_MS = 260;
const AUDIENCE_RECALC_MS = 240;

function formatHumanSchedule(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function createMessagePreview(value: string) {
  return value.trim() || "Start typing to preview your campaign message.";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography level="body-sm" fontWeight="lg" sx={{ mb: 0.75 }}>
      {children}
    </Typography>
  );
}

function WizardSkeleton() {
  return (
    <PageContainer sx={{ maxWidth: 1120, py: 3 }}>
      <Stack spacing={2.5}>
        <Card
          variant="outlined"
          sx={{ borderRadius: "28px", borderColor: "neutral.200", p: 3 }}
        >
          <Stack spacing={1.25}>
            <Skeleton variant="text" sx={{ width: 280, height: 32 }} />
            <Skeleton variant="text" sx={{ width: 520, height: 18 }} />
          </Stack>
        </Card>

        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "30px",
            borderColor: "neutral.200",
            backgroundColor: "background.surface",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: { xs: 2.5, md: 3 },
              py: 2.5,
              borderBottom: "1px solid",
              borderColor: "neutral.100",
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Box key={index} sx={{ flex: 1 }}>
                  <Skeleton
                    variant="rectangular"
                    sx={{ height: 52, borderRadius: "18px" }}
                  />
                </Box>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              px: { xs: 2.5, md: 3 },
              py: 3,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.2fr) 340px" },
              gap: 3,
            }}
          >
            <Stack spacing={2.5}>
              <Skeleton
                variant="rectangular"
                sx={{ height: 54, borderRadius: "18px" }}
              />
              <Skeleton
                variant="rectangular"
                sx={{ height: 120, borderRadius: "18px" }}
              />
              <Skeleton
                variant="rectangular"
                sx={{ height: 80, borderRadius: "18px" }}
              />
              <Skeleton
                variant="rectangular"
                sx={{ height: 160, borderRadius: "18px" }}
              />
            </Stack>
            <Stack spacing={2.5}>
              <Skeleton
                variant="rectangular"
                sx={{ height: 280, borderRadius: "24px" }}
              />
              <Skeleton
                variant="rectangular"
                sx={{ height: 160, borderRadius: "24px" }}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              px: { xs: 2.5, md: 3 },
              py: 2,
              borderTop: "1px solid",
              borderColor: "neutral.100",
            }}
          >
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Skeleton
                variant="rectangular"
                sx={{ width: 112, height: 42, borderRadius: "12px" }}
              />
              <Skeleton
                variant="rectangular"
                sx={{ width: 156, height: 42, borderRadius: "12px" }}
              />
            </Stack>
          </Box>
        </Sheet>
      </Stack>
    </PageContainer>
  );
}

function StepIndicator({
  step,
  index,
  activeIndex,
}: {
  step: StepDefinition;
  index: number;
  activeIndex: number;
}) {
  const Icon = step.icon;
  const isComplete = index < activeIndex;
  const isActive = index === activeIndex;

  return (
    <Stack
      spacing={0.75}
      sx={{
        flex: 1,
        minWidth: 0,
        position: "relative",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip
          size="sm"
          variant={isActive ? "solid" : isComplete ? "soft" : "outlined"}
          color={isActive ? "primary" : isComplete ? "success" : "neutral"}
          startDecorator={isComplete ? <Check size={14} /> : <Icon size={14} />}
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.5,
            fontWeight: "lg",
            justifyContent: "flex-start",
          }}
        >
          {step.title}
        </Chip>
        {index < WIZARD_STEPS.length - 1 ? (
          <Box
            sx={{
              flex: 1,
              minWidth: 20,
              height: "1px",
              alignSelf: "center",
              bgcolor: index < activeIndex ? "success.400" : "neutral.300",
              display: { xs: "none", md: "block" },
            }}
          />
        ) : null}
      </Box>
      <Typography level="body-xs" color="neutral" sx={{ pl: 0.25 }}>
        {step.description}
      </Typography>
    </Stack>
  );
}

function SelectionCard({
  title,
  description,
  selected,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card
      component="button"
      type="button"
      variant={selected ? "soft" : "outlined"}
      color={selected ? "primary" : "neutral"}
      onClick={onClick}
      sx={{
        textAlign: "left",
        borderRadius: "20px",
        p: 2,
        cursor: "pointer",
        borderColor: selected ? "primary.300" : "neutral.200",
        transition:
          "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: "sm",
        },
      }}
    >
      <Stack spacing={1.25}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "14px",
            display: "grid",
            placeItems: "center",
            bgcolor: selected ? "primary.100" : "background.level1",
            color: selected ? "primary.700" : "neutral.600",
          }}
        >
          {icon}
        </Box>
        <Stack spacing={0.5}>
          <Typography level="title-sm">{title}</Typography>
          <Typography level="body-sm" color="neutral">
            {description}
          </Typography>
        </Stack>
      </Stack>
    </Card>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "160px minmax(0, 1fr) auto" },
        gap: 1.5,
        alignItems: { md: "center" },
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "neutral.100",
      }}
    >
      <Typography level="body-sm" fontWeight="lg">
        {label}
      </Typography>
      <Typography level="body-sm" color="neutral" sx={{ minWidth: 0 }}>
        {value}
      </Typography>
      <Link
        component="button"
        type="button"
        level="body-sm"
        onClick={onEdit}
        underline="none"
        sx={{ justifySelf: { md: "end" }, fontWeight: "md" }}
      >
        Edit
      </Link>
    </Box>
  );
}

export function SMSCampaignWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { allSegments, isLoading: segmentsLoading } = useSegments();
  const { personas, loading: personasLoading } = useAllPersonas();
  const [currentStep, setCurrentStep] =
    React.useState<WizardStepKey>("details");
  const [campaignName, setCampaignName] = React.useState("");
  const [campaignDescription, setCampaignDescription] = React.useState("");
  const [campaignTags, setCampaignTags] = React.useState<string[]>([]);
  const [audienceMode, setAudienceMode] = React.useState<AudienceMode>("all");
  const [selectedSegmentId, setSelectedSegmentId] = React.useState<
    string | null
  >(null);
  const [selectedPersonaId, setSelectedPersonaId] = React.useState<
    string | null
  >(null);
  const [message, setMessage] = React.useState("");
  const [mediaUrls, setMediaUrls] = React.useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = React.useState<ScheduleMode>("now");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [recipientEstimate, setRecipientEstimate] = React.useState<
    number | null
  >(0);
  const [isAudienceLoading, setIsAudienceLoading] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
  const [isUploadingAssets, setIsUploadingAssets] = React.useState(false);
  const [aiFlashKey, setAiFlashKey] = React.useState(0);
  const [showMountSkeleton, setShowMountSkeleton] = React.useState(true);
  const [showContent, setShowContent] = React.useState(false);
  const messageTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const stepIndex = WIZARD_STEPS.findIndex((step) => step.key === currentStep);
  const activeStep = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];

  const segmentOptions = React.useMemo<SegmentOption[]>(
    () =>
      allSegments.map((segment) => ({
        id: segment.id,
        name: segment.name,
        description: segment.description,
        memberCount: segment.memberCount,
      })),
    [allSegments],
  );

  const personaOptions = React.useMemo<PersonaOption[]>(
    () =>
      personas.map((persona) => ({
        id: persona.id,
        persona_name: persona.persona_name,
        persona_description: persona.persona_description,
      })),
    [personas],
  );

  const selectedSegment = React.useMemo(
    () =>
      segmentOptions.find((segment) => segment.id === selectedSegmentId) ??
      null,
    [segmentOptions, selectedSegmentId],
  );
  const selectedPersona = React.useMemo(
    () =>
      personaOptions.find((persona) => persona.id === selectedPersonaId) ??
      null,
    [personaOptions, selectedPersonaId],
  );

  const totalSmsSubscribersQuery = useQuery({
    queryKey: ["sms-wizard-total-subscribers", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("crm_customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant?.id)
        .eq("sms_opt_in", true)
        .eq("opt_out", false)
        .eq("suppressed", false)
        .not("phone", "is", null);

      if (error) throw error;
      return count ?? 0;
    },
  });

  const subscriberHealthQuery = useQuery({
    queryKey: ["sms-wizard-subscriber-health", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const [eligible, optedOut, suppressed, missingPhone] = await Promise.all([
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant?.id)
          .eq("sms_opt_in", true)
          .eq("opt_out", false)
          .eq("suppressed", false)
          .not("phone", "is", null),
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant?.id)
          .eq("sms_opt_in", true)
          .eq("opt_out", true),
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant?.id)
          .eq("sms_opt_in", true)
          .eq("suppressed", true),
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant?.id)
          .eq("sms_opt_in", true)
          .is("phone", null),
      ]);

      const firstError = [
        eligible.error,
        optedOut.error,
        suppressed.error,
        missingPhone.error,
      ].find(Boolean);
      if (firstError) {
        throw firstError;
      }

      return {
        eligible: eligible.count ?? 0,
        optedOut: optedOut.count ?? 0,
        suppressed: suppressed.count ?? 0,
        missingPhone: missingPhone.count ?? 0,
      };
    },
  });

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowMountSkeleton(false);
    }, MOUNT_SKELETON_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const wizardLoading =
    showMountSkeleton ||
    segmentsLoading ||
    personasLoading ||
    totalSmsSubscribersQuery.isLoading ||
    subscriberHealthQuery.isLoading;

  React.useEffect(() => {
    if (wizardLoading) {
      setShowContent(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setShowContent(true));
    return () => window.cancelAnimationFrame(frame);
  }, [wizardLoading]);

  React.useEffect(() => {
    if (!tenant?.id) {
      setRecipientEstimate(0);
      setIsAudienceLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const computeAudience = async () => {
        if (audienceMode === "all") {
          if (!cancelled) {
            setRecipientEstimate(totalSmsSubscribersQuery.data ?? 0);
            setIsAudienceLoading(false);
          }
          return;
        }

        if (audienceMode === "segment" && !selectedSegment) {
          if (!cancelled) {
            setRecipientEstimate(0);
            setIsAudienceLoading(false);
          }
          return;
        }

        if (audienceMode === "persona" && !selectedPersona) {
          if (!cancelled) {
            setRecipientEstimate(0);
            setIsAudienceLoading(false);
          }
          return;
        }

        setIsAudienceLoading(true);

        try {
          const count = await computeAudienceRecipientCount({
            tenantId: tenant.id,
            totalCustomerCount: totalSmsSubscribersQuery.data ?? 0,
            segmentIds:
              audienceMode === "segment" && selectedSegment
                ? [selectedSegment.id]
                : [],
            personaIds:
              audienceMode === "persona" && selectedPersona
                ? [selectedPersona.id]
                : [],
          });

          if (!cancelled) {
            setRecipientEstimate(count);
            setIsAudienceLoading(false);
          }
        } catch (error) {
          console.error("Failed to calculate SMS audience estimate", error);
          if (!cancelled) {
            setRecipientEstimate(null);
            setIsAudienceLoading(false);
          }
        }
      };

      void computeAudience();
    }, AUDIENCE_RECALC_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    audienceMode,
    selectedPersona,
    selectedSegment,
    tenant?.id,
    totalSmsSubscribersQuery.data,
  ]);

  const segmentInfo = React.useMemo(() => countSmsSegments(message), [message]);
  const unicodeCharacters = React.useMemo(
    () => getUnicodeCharacters(message),
    [message],
  );
  const selectedAudienceLabel =
    audienceMode === "all"
      ? "All Subscribers"
      : audienceMode === "segment"
        ? selectedSegment?.name || "No segment selected"
        : selectedPersona?.persona_name || "No persona selected";

  const previewSummary = React.useMemo(() => {
    if (audienceMode === "all") {
      const health = subscriberHealthQuery.data;
      return {
        total: recipientEstimate ?? 0,
        consented: health?.eligible ?? recipientEstimate ?? 0,
        excluded:
          (health?.optedOut ?? 0) +
          (health?.suppressed ?? 0) +
          (health?.missingPhone ?? 0),
        exclusionLabel: "Opted out, suppressed, or missing phone",
      };
    }

    if (audienceMode === "segment") {
      const matched = selectedSegment?.memberCount ?? 0;
      return {
        total: matched,
        consented: recipientEstimate ?? 0,
        excluded: Math.max(matched - (recipientEstimate ?? 0), 0),
        exclusionLabel: "Outside SMS consent rules",
      };
    }

    return {
      total: recipientEstimate ?? 0,
      consented: recipientEstimate ?? 0,
      excluded: null,
      exclusionLabel: "Consent and suppression checks apply at launch",
    };
  }, [
    audienceMode,
    recipientEstimate,
    selectedSegment?.memberCount,
    subscriberHealthQuery.data,
  ]);

  const complianceIssues = React.useMemo(() => {
    const issues: string[] = [];
    const lowerMessage = message.toLowerCase();

    if (message.trim().length === 0) {
      return issues;
    }

    if (
      !lowerMessage.includes("stop") &&
      !lowerMessage.includes("unsubscribe")
    ) {
      issues.push(
        'Add opt-out language such as "Reply STOP to opt out" before launch.',
      );
    }

    if (
      !lowerMessage.includes("company") &&
      !lowerMessage.includes("team") &&
      !lowerMessage.includes("bloomsuite")
    ) {
      issues.push(
        "Consider clear brand identification near the start of the message.",
      );
    }

    if (segmentInfo.segments > 3) {
      issues.push(
        `This copy spans ${segmentInfo.segments} SMS segments and will cost more credits to deliver.`,
      );
    }

    if (mediaUrls.length > 0) {
      issues.push(
        "MMS attachments may affect carrier behavior and delivery speed for some recipients.",
      );
    }

    return issues;
  }, [mediaUrls.length, message, segmentInfo.segments]);

  const validationChecks = React.useMemo<ValidationCheck[]>(() => {
    return [
      {
        key: "name",
        label: "Campaign name",
        detail: "Give the campaign a clear internal name for later reporting.",
        passed: campaignName.trim().length > 0,
      },
      {
        key: "audience",
        label: "Audience selected",
        detail: "Choose all subscribers, one segment, or one persona.",
        passed:
          audienceMode === "all" ||
          (audienceMode === "segment" && Boolean(selectedSegment)) ||
          (audienceMode === "persona" && Boolean(selectedPersona)),
      },
      {
        key: "message",
        label: "Message ready",
        detail: "Write the SMS copy before continuing to launch.",
        passed: message.trim().length > 0,
      },
      {
        key: "schedule",
        label: "Schedule configured",
        detail:
          scheduleMode === "later"
            ? "A delivery time is required when scheduling for later."
            : "Immediate launch is selected.",
        passed: scheduleMode === "now" || Boolean(scheduledAt),
      },
      {
        key: "compliance",
        label: "Compliance review",
        detail:
          complianceIssues.length === 0
            ? "No blocking compliance warnings were detected."
            : `${complianceIssues.length} warning${complianceIssues.length === 1 ? "" : "s"} need review.`,
        passed: complianceIssues.length === 0,
      },
    ];
  }, [
    audienceMode,
    campaignName,
    complianceIssues.length,
    message,
    scheduleMode,
    scheduledAt,
    selectedPersona,
    selectedSegment,
  ]);

  const blockingIssues = validationChecks.filter((check) => !check.passed);

  const canMoveNext = React.useMemo(() => {
    switch (currentStep) {
      case "details":
        return campaignName.trim().length > 0;
      case "audience":
        return (
          audienceMode === "all" ||
          (audienceMode === "segment" && Boolean(selectedSegment)) ||
          (audienceMode === "persona" && Boolean(selectedPersona))
        );
      case "content":
        return message.trim().length > 0;
      case "schedule":
        return scheduleMode === "now" || Boolean(scheduledAt);
      case "review":
      default:
        return blockingIssues.length === 0;
    }
  }, [
    audienceMode,
    blockingIssues.length,
    campaignName,
    currentStep,
    message,
    scheduleMode,
    scheduledAt,
    selectedPersona,
    selectedSegment,
  ]);

  const nextStep = React.useCallback(() => {
    const next = WIZARD_STEPS[Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)];
    setCurrentStep(next.key);
  }, [stepIndex]);

  const previousStep = React.useCallback(() => {
    const previous = WIZARD_STEPS[Math.max(stepIndex - 1, 0)];
    setCurrentStep(previous.key);
  }, [stepIndex]);

  const insertMergeTag = React.useCallback(
    (tagKey: string) => {
      const tagValue = formatTagWithDefault(tagKey);
      const textarea = messageTextareaRef.current;

      if (!textarea) {
        setMessage((current) => `${current}${current ? " " : ""}${tagValue}`);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${message.slice(0, start)}${tagValue}${message.slice(end)}`;
      setMessage(nextValue);

      window.setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + tagValue.length,
          start + tagValue.length,
        );
      }, 0);
    },
    [message],
  );

  const uploadMediaFile = React.useCallback(async (file: File) => {
    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `campaign-builder/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const { error } = await supabase.storage
      .from("media-mms")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from("media-mms").getPublicUrl(fileName);
    return data.publicUrl;
  }, []);

  const onDrop = React.useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) {
        return;
      }

      setIsUploadingAssets(true);
      try {
        const uploadedUrls = await Promise.all(
          acceptedFiles.slice(0, 3).map(async (file) => {
            if (
              !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
                file.type,
              )
            ) {
              throw new Error(
                "Please upload JPG, PNG, WebP, or GIF files only.",
              );
            }

            if (file.size > 5 * 1024 * 1024) {
              throw new Error("Each file must be under 5MB.");
            }

            return uploadMediaFile(file);
          }),
        );

        setMediaUrls((current) =>
          Array.from(new Set([...current, ...uploadedUrls])),
        );
        toast.success(
          `${uploadedUrls.length} image${uploadedUrls.length === 1 ? "" : "s"} attached`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setIsUploadingAssets(false);
      }
    },
    [uploadMediaFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "image/gif": [],
    },
    maxFiles: 3,
  });

  const handleGenerateWithAi = React.useCallback(async () => {
    if (!campaignName.trim()) {
      toast.error("Add a campaign name before generating SMS copy.");
      return;
    }

    setIsGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-sms", {
        body: {
          segment_name: selectedAudienceLabel,
          current_message: message,
          business_type: "garden center",
          max_chars: 320,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.message) {
        setMessage(data.message);
        setAiFlashKey((current) => current + 1);
        toast.success("AI generated a fresh SMS draft.");
      }
    } catch (error) {
      console.error("Failed to generate SMS copy", error);
      toast.error("Unable to generate SMS copy right now.");
    } finally {
      setIsGeneratingAi(false);
    }
  }, [campaignName, message, selectedAudienceLabel]);

  const createCampaign = React.useCallback(async () => {
    if (!user?.id || !tenant?.id) {
      return;
    }

    if (blockingIssues.length > 0) {
      toast.error(
        "Resolve the blocking issues before launching this campaign.",
      );
      return;
    }

    try {
      setIsCreating(true);
      const scheduleValue = scheduleMode === "later" ? scheduledAt : null;
      const { data, error } = await supabase
        .from("crm_sms_campaigns")
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          name: campaignName.trim(),
          message: message.trim(),
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          status: scheduleValue ? "scheduled" : "draft",
          scheduled_at: scheduleValue,
          segment_id:
            audienceMode === "segment" ? (selectedSegment?.id ?? null) : null,
          targeting_persona_ids:
            audienceMode === "persona" && selectedPersona
              ? [selectedPersona.id]
              : null,
          targeting_persona_names:
            audienceMode === "persona" && selectedPersona
              ? [selectedPersona.persona_name]
              : null,
          targeting_logic: audienceMode === "persona" ? "any" : null,
          total_recipients_estimate: recipientEstimate,
          source: "wizard",
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      toast.success(
        scheduleValue
          ? "SMS campaign scheduled"
          : "SMS campaign saved as draft",
      );
      navigate(data?.id ? `/sms/${data.id}` : "/sms");
    } catch (error) {
      console.error("Failed to create SMS campaign", error);
      toast.error("Unable to create SMS campaign.");
    } finally {
      setIsCreating(false);
    }
  }, [
    audienceMode,
    blockingIssues.length,
    campaignName,
    mediaUrls,
    message,
    navigate,
    recipientEstimate,
    scheduleMode,
    scheduledAt,
    selectedPersona,
    selectedSegment,
    tenant?.id,
    user?.id,
  ]);

  if (wizardLoading) {
    return <WizardSkeleton />;
  }

  return (
    <PageContainer sx={{ maxWidth: 1120, py: 3 }}>
      <Box
        sx={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 240ms ease-out, transform 240ms ease-out",
        }}
      >
        <Stack spacing={2.5}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: "28px",
              borderColor: "neutral.200",
              p: { xs: 2.5, md: 3 },
            }}
          >
            <Stack spacing={1.25}>
              <Chip
                size="sm"
                variant="soft"
                color="primary"
                startDecorator={<Rocket size={14} />}
                sx={{ alignSelf: "flex-start", fontWeight: "lg" }}
              >
                Guided Campaign Builder
              </Chip>
              <Typography
                level="h2"
                sx={{ fontWeight: 700, letterSpacing: "-0.03em" }}
              >
                Launch SMS campaigns with a deliberate, review-first workflow.
              </Typography>
              <Typography
                level="body-sm"
                color="neutral"
                sx={{ maxWidth: 720 }}
              >
                Shape the metadata, confirm the audience, compose the message,
                schedule delivery, and review everything from one premium
                onboarding surface.
              </Typography>
            </Stack>
          </Card>

          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "30px",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "sticky",
                top: 16,
                zIndex: 4,
                px: { xs: 2.5, md: 3 },
                py: 2.5,
                borderBottom: "1px solid",
                borderColor: "neutral.100",
                bgcolor: "background.surface",
                backdropFilter: "blur(10px)",
              }}
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                {WIZARD_STEPS.map((step, index) => (
                  <StepIndicator
                    key={step.key}
                    step={step}
                    index={index}
                    activeIndex={stepIndex}
                  />
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                px: { xs: 2.5, md: 3 },
                py: 3,
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  xl:
                    currentStep === "content"
                      ? "minmax(0, 1.1fr) 360px"
                      : "minmax(0, 1.2fr) 340px",
                },
                gap: 3,
                alignItems: "start",
              }}
            >
              <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                <Stack spacing={0.75}>
                  <Typography level="title-lg" fontWeight="lg">
                    {activeStep.title}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    {activeStep.description}
                  </Typography>
                </Stack>

                {currentStep === "details" ? (
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: "24px",
                      borderColor: "neutral.200",
                      p: 2.5,
                    }}
                  >
                    <Stack spacing={2.25}>
                      <FormControl error={!campaignName.trim()}>
                        <SectionLabel>Campaign Name</SectionLabel>
                        <Input
                          value={campaignName}
                          onChange={(event) =>
                            setCampaignName(event.target.value)
                          }
                          placeholder="Weekend perks reminder"
                          variant="outlined"
                          sx={{ minHeight: 44, borderRadius: "12px" }}
                        />
                        <FormHelperText>
                          {!campaignName.trim()
                            ? "A campaign name is required before you can continue."
                            : "Internal only. Keep it specific enough for reporting and reuse."}
                        </FormHelperText>
                      </FormControl>

                      <FormControl>
                        <SectionLabel>Campaign Description</SectionLabel>
                        <Textarea
                          value={campaignDescription}
                          onChange={(event) =>
                            setCampaignDescription(event.target.value)
                          }
                          minRows={2}
                          placeholder="Summarize the intent, offer, or timing of this send for your team."
                          variant="outlined"
                          sx={{ borderRadius: "12px" }}
                        />
                        <FormHelperText>
                          Optional internal context for the review step and
                          later audits.
                        </FormHelperText>
                      </FormControl>

                      <FormControl>
                        <SectionLabel>Tags / Labels</SectionLabel>
                        <Autocomplete<string, true, false, true>
                          multiple
                          freeSolo
                          options={TAG_SUGGESTIONS}
                          value={campaignTags}
                          onChange={(_event, value) =>
                            setCampaignTags(value.map(String))
                          }
                          placeholder="Add labels like VIP, Seasonal, Reminder"
                          renderTags={(value, getTagProps) =>
                            value.map((tag, index) => {
                              const tagProps = getTagProps({ index });
                              return (
                                <Chip
                                  {...tagProps}
                                  key={`${tag}-${index}`}
                                  size="sm"
                                  variant="soft"
                                  color="primary"
                                  endDecorator={
                                    <IconButton
                                      size="sm"
                                      variant="plain"
                                      color="primary"
                                      onMouseDown={(event) =>
                                        event.stopPropagation()
                                      }
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setCampaignTags((current) =>
                                          current.filter(
                                            (item, itemIndex) =>
                                              itemIndex !== index,
                                          ),
                                        );
                                      }}
                                    >
                                      <X size={12} />
                                    </IconButton>
                                  }
                                >
                                  {tag}
                                </Chip>
                              );
                            })
                          }
                          sx={{ borderRadius: "12px", minHeight: 44 }}
                        />
                        <FormHelperText>
                          Tags stay local to the wizard for now and help
                          organize the review context.
                        </FormHelperText>
                      </FormControl>
                    </Stack>
                  </Card>
                ) : null}

                {currentStep === "audience" ? (
                  <Stack spacing={2.25}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          md: "repeat(3, minmax(0, 1fr))",
                        },
                        gap: 1.5,
                      }}
                    >
                      {AUDIENCE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectionCard
                            key={option.value}
                            title={option.title}
                            description={option.description}
                            selected={audienceMode === option.value}
                            icon={<Icon size={18} />}
                            onClick={() => {
                              setAudienceMode(option.value);
                              if (option.value !== "segment") {
                                setSelectedSegmentId(null);
                              }
                              if (option.value !== "persona") {
                                setSelectedPersonaId(null);
                              }
                            }}
                          />
                        );
                      })}
                    </Box>

                    {audienceMode === "segment" ? (
                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: "24px",
                          borderColor: "neutral.200",
                          p: 2.5,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <FormControl error={!selectedSegment}>
                            <SectionLabel>Select Segment</SectionLabel>
                            <Select
                              placeholder={
                                segmentOptions.length
                                  ? "Choose a segment"
                                  : "No segments available"
                              }
                              value={selectedSegmentId}
                              onChange={(_event, value) =>
                                setSelectedSegmentId(value ?? null)
                              }
                              indicator={<ChevronRight size={16} />}
                              sx={{ minHeight: 44, borderRadius: "12px" }}
                            >
                              {segmentOptions.map((segment) => (
                                <Option key={segment.id} value={segment.id}>
                                  {segment.name}
                                </Option>
                              ))}
                            </Select>
                            <FormHelperText>
                              {selectedSegment
                                ? selectedSegment.description ||
                                  "This segment is ready to target."
                                : "Select one segment to estimate recipients."}
                            </FormHelperText>
                          </FormControl>
                          {selectedSegment ? (
                            <Chip
                              size="sm"
                              variant="soft"
                              color="primary"
                              sx={{ alignSelf: "flex-start" }}
                            >
                              {`~${(recipientEstimate ?? 0).toLocaleString()} recipients`}
                            </Chip>
                          ) : null}
                        </Stack>
                      </Card>
                    ) : null}

                    {audienceMode === "persona" ? (
                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: "24px",
                          borderColor: "neutral.200",
                          p: 2.5,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <FormControl error={!selectedPersona}>
                            <SectionLabel>Select Persona</SectionLabel>
                            <Select
                              placeholder={
                                personaOptions.length
                                  ? "Choose a persona"
                                  : "No personas available"
                              }
                              value={selectedPersonaId}
                              onChange={(_event, value) =>
                                setSelectedPersonaId(value ?? null)
                              }
                              indicator={<ChevronRight size={16} />}
                              sx={{ minHeight: 44, borderRadius: "12px" }}
                            >
                              {personaOptions.map((persona) => (
                                <Option key={persona.id} value={persona.id}>
                                  {persona.persona_name}
                                </Option>
                              ))}
                            </Select>
                            <FormHelperText>
                              {selectedPersona?.persona_description ||
                                "Choose one persona to estimate the SMS-eligible audience."}
                            </FormHelperText>
                          </FormControl>
                          {selectedPersona ? (
                            <Chip
                              size="sm"
                              variant="soft"
                              color="primary"
                              sx={{ alignSelf: "flex-start" }}
                            >
                              {`~${(recipientEstimate ?? 0).toLocaleString()} recipients`}
                            </Chip>
                          ) : null}
                        </Stack>
                      </Card>
                    ) : null}

                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{ borderRadius: "24px", p: 2.25 }}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={2}
                        >
                          <Stack spacing={0.4}>
                            <Typography level="title-sm">
                              Recipient Preview
                            </Typography>
                            <Typography level="body-sm" color="neutral">
                              {selectedAudienceLabel}
                            </Typography>
                          </Stack>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            {isAudienceLoading ? (
                              <CircularProgress size="sm" />
                            ) : null}
                            <Chip size="sm" variant="soft" color="primary">
                              {`~${(recipientEstimate ?? 0).toLocaleString()} recipients`}
                            </Chip>
                          </Stack>
                        </Stack>
                        <Divider />
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "repeat(3, minmax(0, 1fr))",
                            },
                            gap: 1.25,
                          }}
                        >
                          <Sheet
                            variant="outlined"
                            sx={{ borderRadius: "18px", p: 1.5 }}
                          >
                            <Typography level="body-xs" color="neutral">
                              Total in preview
                            </Typography>
                            <Typography level="title-md" fontWeight="lg">
                              {previewSummary.total.toLocaleString()}
                            </Typography>
                          </Sheet>
                          <Sheet
                            variant="outlined"
                            sx={{ borderRadius: "18px", p: 1.5 }}
                          >
                            <Typography level="body-xs" color="neutral">
                              SMS consented
                            </Typography>
                            <Typography level="title-md" fontWeight="lg">
                              {previewSummary.consented.toLocaleString()}
                            </Typography>
                          </Sheet>
                          <Sheet
                            variant="outlined"
                            sx={{ borderRadius: "18px", p: 1.5 }}
                          >
                            <Typography level="body-xs" color="neutral">
                              Exclusions
                            </Typography>
                            <Typography level="title-md" fontWeight="lg">
                              {previewSummary.excluded === null
                                ? "--"
                                : previewSummary.excluded.toLocaleString()}
                            </Typography>
                          </Sheet>
                        </Box>
                        <Typography level="body-xs" color="neutral">
                          {previewSummary.exclusionLabel}
                        </Typography>
                      </Stack>
                    </Sheet>
                  </Stack>
                ) : null}

                {currentStep === "content" ? (
                  <Stack spacing={2.25}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: "24px",
                        borderColor: "neutral.200",
                        p: 2.5,
                      }}
                    >
                      <Stack spacing={1.75}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ md: "center" }}
                        >
                          <Stack spacing={0.4}>
                            <Typography level="title-sm">
                              Message Composer
                            </Typography>
                            <Typography level="body-sm" color="neutral">
                              Write the SMS, insert merge tags, and attach MMS
                              media when needed.
                            </Typography>
                          </Stack>
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Dropdown>
                              <MenuButton
                                slots={{ root: Button }}
                                variant="soft"
                                color="neutral"
                                size="sm"
                              >
                                Insert Merge Tag
                              </MenuButton>
                              <Menu
                                placement="bottom-end"
                                sx={{ maxHeight: 320, overflowY: "auto" }}
                              >
                                {MERGE_TAG_DEFINITIONS.slice(0, 18).map(
                                  (tag) => (
                                    <MenuItem
                                      key={tag.key}
                                      onClick={() => insertMergeTag(tag.key)}
                                    >
                                      <ListItemDecorator>
                                        <Sparkles size={14} />
                                      </ListItemDecorator>
                                      <Box>
                                        <Typography
                                          level="body-sm"
                                          fontWeight="md"
                                        >
                                          {tag.label}
                                        </Typography>
                                        <Typography
                                          level="body-xs"
                                          color="neutral"
                                        >
                                          {`${tag.example} | ${formatTagWithDefault(tag.key)}`}
                                        </Typography>
                                      </Box>
                                    </MenuItem>
                                  ),
                                )}
                              </Menu>
                            </Dropdown>

                            <Button
                              variant="soft"
                              color="primary"
                              size="sm"
                              loading={isGeneratingAi}
                              startDecorator={<WandSparkles size={14} />}
                              onClick={() => void handleGenerateWithAi()}
                            >
                              Generate with AI
                            </Button>
                          </Stack>
                        </Stack>

                        <FormControl>
                          <SectionLabel>SMS Message</SectionLabel>
                          <Textarea
                            key={aiFlashKey}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            minRows={5}
                            maxRows={10}
                            placeholder={
                              'Hi {{ first_name | default: "Friend" }}, your weekend offer is live. Reply STOP to opt out.'
                            }
                            variant="outlined"
                            slotProps={{
                              textarea: {
                                ref: messageTextareaRef,
                              },
                            }}
                            sx={{
                              borderRadius: "14px",
                              "@keyframes wizard-ai-flash": {
                                "0%": {
                                  backgroundColor:
                                    "rgba(var(--joy-palette-primary-mainChannel) / 0.12)",
                                },
                                "100%": { backgroundColor: "transparent" },
                              },
                              animation: aiFlashKey
                                ? "wizard-ai-flash 1s ease"
                                : undefined,
                            }}
                          />
                        </FormControl>

                        <Stack
                          direction="row"
                          spacing={1.5}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ color: "neutral.600" }}
                        >
                          <Typography level="body-xs">
                            {getSegmentDescription(segmentInfo)}
                          </Typography>
                          <Typography level="body-xs">
                            {`${message.length} characters`}
                          </Typography>
                          <Typography level="body-xs">
                            {`Estimated cost: ${Math.max(recipientEstimate ?? 0, 0) * Math.max(segmentInfo.segments, 1)} credits`}
                          </Typography>
                        </Stack>

                        <Stack spacing={1}>
                          <SectionLabel>MMS Image Attachments</SectionLabel>
                          <Box
                            {...getRootProps()}
                            sx={{
                              borderRadius: "18px",
                              border: "2px dashed",
                              borderColor: isDragActive
                                ? "primary.400"
                                : "neutral.300",
                              backgroundColor: isDragActive
                                ? "primary.50"
                                : "background.level1",
                              px: 3,
                              py: 4,
                              textAlign: "center",
                              cursor: isUploadingAssets
                                ? "progress"
                                : "pointer",
                              opacity: isUploadingAssets ? 0.65 : 1,
                              transition:
                                "border-color 180ms ease, background-color 180ms ease, opacity 180ms ease",
                            }}
                          >
                            <input {...getInputProps()} />
                            <Stack spacing={1.25} alignItems="center">
                              <Box
                                sx={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: "14px",
                                  display: "grid",
                                  placeItems: "center",
                                  bgcolor: "background.surface",
                                  color: "neutral.500",
                                }}
                              >
                                {isUploadingAssets ? (
                                  <CircularProgress size="sm" />
                                ) : (
                                  <ImagePlus size={18} />
                                )}
                              </Box>
                              <Stack spacing={0.5}>
                                <Typography level="body-sm" fontWeight="md">
                                  {isDragActive
                                    ? "Drop images here"
                                    : "Drag and drop or click to upload"}
                                </Typography>
                                <Typography level="body-xs" color="neutral">
                                  JPG, PNG, WebP, or GIF up to 5MB each. Up to 3
                                  images.
                                </Typography>
                              </Stack>
                            </Stack>
                          </Box>

                          {mediaUrls.length > 0 ? (
                            <Box
                              sx={{
                                display: "grid",
                                gridAutoFlow: "column",
                                gridAutoColumns: "112px",
                                gap: 1,
                                overflowX: "auto",
                                pb: 0.5,
                              }}
                            >
                              {mediaUrls.map((url, index) => (
                                <Box
                                  key={`${url}-${index}`}
                                  sx={{ position: "relative" }}
                                >
                                  <AspectRatio
                                    ratio="1"
                                    sx={{
                                      borderRadius: "16px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <img
                                      src={url}
                                      alt={`Attachment ${index + 1}`}
                                      style={{ objectFit: "cover" }}
                                    />
                                  </AspectRatio>
                                  <IconButton
                                    size="sm"
                                    variant="solid"
                                    color="danger"
                                    sx={{
                                      position: "absolute",
                                      right: 6,
                                      top: 6,
                                    }}
                                    onClick={() =>
                                      setMediaUrls((current) =>
                                        current.filter(
                                          (_, mediaIndex) =>
                                            mediaIndex !== index,
                                        ),
                                      )
                                    }
                                  >
                                    <X size={12} />
                                  </IconButton>
                                </Box>
                              ))}
                            </Box>
                          ) : null}
                        </Stack>

                        {complianceIssues.length > 0 ? (
                          <Alert
                            variant="soft"
                            color="warning"
                            sx={{
                              borderRadius: "18px",
                              alignItems: "flex-start",
                            }}
                          >
                            <List sx={{ "--List-padding": "0px", gap: 0.5 }}>
                              {complianceIssues.map((issue) => (
                                <ListItem
                                  key={issue}
                                  sx={{
                                    px: 0,
                                    py: 0,
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <ListItemDecorator
                                    sx={{
                                      minWidth: 18,
                                      color: "warning.700",
                                      mt: 0.2,
                                    }}
                                  >
                                    -
                                  </ListItemDecorator>
                                  <Typography level="body-sm">
                                    {issue}
                                  </Typography>
                                </ListItem>
                              ))}
                            </List>
                          </Alert>
                        ) : null}

                        {unicodeCharacters.length > 0 ? (
                          <Typography level="body-xs" color="warning.700">
                            {`Unicode characters detected: ${unicodeCharacters.join(" ")}`}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Card>
                  </Stack>
                ) : null}

                {currentStep === "schedule" ? (
                  <Stack spacing={2.25}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          md: "repeat(2, minmax(0, 1fr))",
                        },
                        gap: 1.5,
                      }}
                    >
                      {SCHEDULE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectionCard
                            key={option.value}
                            title={option.title}
                            description={option.description}
                            selected={scheduleMode === option.value}
                            icon={<Icon size={18} />}
                            onClick={() => setScheduleMode(option.value)}
                          />
                        );
                      })}
                    </Box>

                    {scheduleMode === "later" ? (
                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: "24px",
                          borderColor: "neutral.200",
                          p: 2.5,
                        }}
                      >
                        <Stack spacing={2}>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: {
                                xs: "1fr",
                                md: "repeat(2, minmax(0, 1fr))",
                              },
                              gap: 1.5,
                            }}
                          >
                            <FormControl error={!scheduledAt}>
                              <SectionLabel>Date & Time</SectionLabel>
                              <Input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(event) =>
                                  setScheduledAt(event.target.value)
                                }
                                sx={{ minHeight: 44, borderRadius: "12px" }}
                              />
                              <FormHelperText>
                                Choose the exact local date and time for this
                                send.
                              </FormHelperText>
                            </FormControl>
                            <Sheet
                              variant="soft"
                              color="neutral"
                              sx={{ borderRadius: "18px", p: 1.75 }}
                            >
                              <Stack spacing={0.5}>
                                <Typography level="body-xs" color="neutral">
                                  Estimated audience at send time
                                </Typography>
                                <Typography level="title-md" fontWeight="lg">
                                  {`~${(recipientEstimate ?? 0).toLocaleString()} recipients`}
                                </Typography>
                              </Stack>
                            </Sheet>
                          </Box>

                          {scheduledAt ? (
                            <Alert
                              variant="soft"
                              color="primary"
                              sx={{ borderRadius: "18px" }}
                            >
                              {`This campaign will be sent on ${formatHumanSchedule(scheduledAt)}.`}
                            </Alert>
                          ) : null}
                        </Stack>
                      </Card>
                    ) : (
                      <Alert
                        variant="soft"
                        color="primary"
                        sx={{ borderRadius: "18px" }}
                      >
                        This campaign will be handed off immediately after
                        launch using the current draft flow.
                      </Alert>
                    )}
                  </Stack>
                ) : null}

                {currentStep === "review" ? (
                  <Stack spacing={2.25}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: "24px",
                        borderColor: "neutral.200",
                        p: 2.5,
                      }}
                    >
                      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                        <Typography level="title-md">
                          Campaign Summary
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          Review the essentials before you launch.
                        </Typography>
                      </Stack>

                      <ReviewRow
                        label="Campaign"
                        value={campaignName || "Untitled campaign"}
                        onEdit={() => setCurrentStep("details")}
                      />
                      <ReviewRow
                        label="Audience"
                        value={`${selectedAudienceLabel} | ~${(recipientEstimate ?? 0).toLocaleString()} recipients`}
                        onEdit={() => setCurrentStep("audience")}
                      />
                      <ReviewRow
                        label="Message"
                        value={`${createMessagePreview(message).slice(0, 88)}${createMessagePreview(message).length > 88 ? "..." : ""}`}
                        onEdit={() => setCurrentStep("content")}
                      />
                      <ReviewRow
                        label="Schedule"
                        value={
                          scheduleMode === "later" && scheduledAt
                            ? formatHumanSchedule(scheduledAt)
                            : "Launch now"
                        }
                        onEdit={() => setCurrentStep("schedule")}
                      />
                      <ReviewRow
                        label="Compliance"
                        value={
                          complianceIssues.length === 0
                            ? "No active warnings"
                            : `${complianceIssues.length} warning${complianceIssues.length === 1 ? "" : "s"} require review`
                        }
                        onEdit={() => setCurrentStep("content")}
                      />
                    </Card>

                    <Alert
                      variant="soft"
                      color={blockingIssues.length === 0 ? "success" : "danger"}
                      sx={{ borderRadius: "20px", alignItems: "flex-start" }}
                    >
                      <Stack spacing={1} sx={{ width: "100%" }}>
                        <Typography level="title-sm">
                          {blockingIssues.length === 0
                            ? "All validation checks passed"
                            : "Blocking issues need attention"}
                        </Typography>
                        <List sx={{ "--List-padding": "0px", gap: 0.75 }}>
                          {validationChecks.map((check) => (
                            <ListItem key={check.key} sx={{ px: 0, py: 0 }}>
                              <ListItemDecorator
                                sx={{
                                  color: check.passed
                                    ? "success.600"
                                    : "danger.600",
                                }}
                              >
                                {check.passed ? (
                                  <Check size={16} />
                                ) : (
                                  <X size={16} />
                                )}
                              </ListItemDecorator>
                              <Box>
                                <Typography level="body-sm" fontWeight="md">
                                  {check.label}
                                </Typography>
                                <Typography level="body-xs" color="neutral">
                                  {check.detail}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      </Stack>
                    </Alert>

                    <Button
                      variant="solid"
                      size="lg"
                      fullWidth
                      loading={isCreating}
                      startDecorator={<Rocket size={18} />}
                      onClick={() => void createCampaign()}
                      sx={{ borderRadius: "14px" }}
                    >
                      {isCreating ? "Launching..." : "Launch Campaign"}
                    </Button>
                  </Stack>
                ) : null}
              </Stack>

              <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                {currentStep === "content" ? (
                  <Sheet
                    variant="outlined"
                    sx={{
                      borderRadius: "32px",
                      borderColor: "neutral.200",
                      backgroundColor: "background.surface",
                      p: 2,
                      boxShadow: "sm",
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography level="title-sm">
                          Live Phone Preview
                        </Typography>
                        <Chip
                          size="sm"
                          variant="soft"
                          color="neutral"
                          startDecorator={<Eye size={14} />}
                        >
                          Preview
                        </Chip>
                      </Stack>

                      <Box
                        sx={{
                          borderRadius: "40px",
                          background:
                            "linear-gradient(180deg, rgba(17,24,39,1) 0%, rgba(31,41,55,1) 100%)",
                          p: 1.5,
                          boxShadow: "lg",
                        }}
                      >
                        <Box
                          sx={{
                            width: "40%",
                            mx: "auto",
                            mb: 1,
                            height: 18,
                            borderRadius: "999px",
                            backgroundColor: "rgba(255,255,255,0.08)",
                          }}
                        />
                        <Sheet
                          sx={{
                            borderRadius: "30px",
                            minHeight: 520,
                            background:
                              "linear-gradient(180deg, rgba(246,248,251,1) 0%, rgba(239,243,248,1) 100%)",
                            overflow: "hidden",
                          }}
                        >
                          <Stack spacing={1.5} sx={{ p: 2 }}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Stack spacing={0.2}>
                                <Typography level="body-sm" fontWeight="lg">
                                  BloomSuite SMS
                                </Typography>
                                <Typography level="body-xs" color="neutral">
                                  {selectedAudienceLabel}
                                </Typography>
                              </Stack>
                              <Chip size="sm" variant="soft" color="primary">
                                {`${Math.max(segmentInfo.segments, 1)} segment${Math.max(segmentInfo.segments, 1) === 1 ? "" : "s"}`}
                              </Chip>
                            </Stack>

                            {mediaUrls.length > 0 ? (
                              <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                              >
                                {mediaUrls.map((url, index) => (
                                  <AspectRatio
                                    key={`${url}-${index}`}
                                    ratio="1"
                                    sx={{
                                      width: 84,
                                      borderRadius: "18px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <img
                                      src={url}
                                      alt={`Preview media ${index + 1}`}
                                      style={{ objectFit: "cover" }}
                                    />
                                  </AspectRatio>
                                ))}
                              </Stack>
                            ) : null}

                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                              }}
                            >
                              <Sheet
                                variant="solid"
                                color="primary"
                                sx={{
                                  maxWidth: "88%",
                                  px: 1.5,
                                  py: 1.25,
                                  borderRadius: "22px 22px 8px 22px",
                                  boxShadow: "sm",
                                }}
                              >
                                <Typography
                                  level="body-sm"
                                  sx={{ whiteSpace: "pre-wrap" }}
                                >
                                  {createMessagePreview(message)}
                                </Typography>
                              </Sheet>
                            </Box>

                            <Typography
                              level="body-xs"
                              color="neutral"
                              textAlign="right"
                            >
                              Delivered
                            </Typography>
                          </Stack>
                        </Sheet>
                      </Box>
                    </Stack>
                  </Sheet>
                ) : (
                  <Stack spacing={2.5}>
                    <Card
                      variant="soft"
                      color="neutral"
                      sx={{ borderRadius: "24px", p: 2.25 }}
                    >
                      <Stack spacing={1.25}>
                        <Typography level="title-sm">
                          Mission Snapshot
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <Chip size="sm" variant="soft" color="primary">
                            {selectedAudienceLabel}
                          </Chip>
                          {campaignTags.map((tag) => (
                            <Chip
                              key={tag}
                              size="sm"
                              variant="soft"
                              color="neutral"
                            >
                              {tag}
                            </Chip>
                          ))}
                        </Stack>
                        <Divider />
                        <Stack spacing={1}>
                          <Typography level="body-xs" color="neutral">
                            Estimated recipients
                          </Typography>
                          <Typography
                            level="h2"
                            sx={{ fontWeight: 700, letterSpacing: "-0.03em" }}
                          >
                            {isAudienceLoading
                              ? "..."
                              : (recipientEstimate ?? "--")}
                          </Typography>
                        </Stack>
                        <Typography level="body-sm" color="neutral">
                          {campaignDescription ||
                            "Add a short internal description so your team knows why this campaign exists."}
                        </Typography>
                      </Stack>
                    </Card>

                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: "24px",
                        borderColor: "neutral.200",
                        p: 2.25,
                      }}
                    >
                      <Stack spacing={1.25}>
                        <Typography level="title-sm">Delivery Notes</Typography>
                        <Typography level="body-sm" color="neutral">
                          {message.trim()
                            ? getSegmentDescription(segmentInfo)
                            : "Write your message to see SMS segment and billing guidance."}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {mediaUrls.length > 0
                            ? "Attached media will send this campaign as MMS where supported."
                            : "Long or Unicode-heavy messages can increase the number of billable segments."}
                        </Typography>
                        {unicodeCharacters.length > 0 ? (
                          <Chip
                            size="sm"
                            variant="soft"
                            color="warning"
                            sx={{ alignSelf: "flex-start" }}
                          >
                            {`Unicode: ${unicodeCharacters.join(" ")}`}
                          </Chip>
                        ) : null}
                      </Stack>
                    </Card>

                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: "24px",
                        borderColor: "neutral.200",
                        p: 2.25,
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography level="title-sm">
                          Launch Checklist
                        </Typography>
                        {validationChecks.map((check) => (
                          <Stack
                            key={check.key}
                            direction="row"
                            spacing={1}
                            alignItems="flex-start"
                          >
                            <Box
                              sx={{
                                color: check.passed
                                  ? "success.600"
                                  : "danger.600",
                                pt: 0.2,
                              }}
                            >
                              {check.passed ? (
                                <Check size={14} />
                              ) : (
                                <ShieldAlert size={14} />
                              )}
                            </Box>
                            <Box>
                              <Typography level="body-sm" fontWeight="md">
                                {check.label}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {check.detail}
                              </Typography>
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    </Card>
                  </Stack>
                )}
              </Stack>
            </Box>

            <Box
              sx={{
                position: "sticky",
                bottom: 0,
                zIndex: 3,
                px: { xs: 2.5, md: 3 },
                py: 2,
                borderTop: "1px solid",
                borderColor: "neutral.100",
                bgcolor: "background.surface",
                boxShadow: "0 -8px 24px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Button
                  variant="outlined"
                  color="neutral"
                  startDecorator={<ChevronLeft size={16} />}
                  disabled={stepIndex === 0}
                  onClick={previousStep}
                  sx={{ borderRadius: "12px" }}
                >
                  Back
                </Button>

                {currentStep !== "review" ? (
                  <Button
                    variant="solid"
                    color="primary"
                    endDecorator={<ChevronRight size={16} />}
                    disabled={!canMoveNext}
                    onClick={nextStep}
                    sx={{ borderRadius: "12px", minWidth: 120 }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    variant="solid"
                    color="primary"
                    loading={isCreating}
                    startDecorator={<Rocket size={16} />}
                    disabled={blockingIssues.length > 0}
                    onClick={() => void createCampaign()}
                    sx={{ borderRadius: "12px", minWidth: 160 }}
                  >
                    {isCreating ? "Launching..." : "Launch Campaign"}
                  </Button>
                )}
              </Stack>
            </Box>
          </Sheet>
        </Stack>
      </Box>
    </PageContainer>
  );
}
