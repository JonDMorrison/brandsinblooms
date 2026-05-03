import * as React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Send,
  TimerReset,
  XCircle,
} from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CampaignActiveSendView } from "@/components/crm/campaign-editor/CampaignActiveSendView";
import { ContentPreviewCard } from "@/components/crm/campaign-editor/ContentPreviewCard";
import {
  CampaignEditorProvider,
  useCampaignEditor,
} from "@/components/crm/campaign-editor/CampaignEditorContext";
import { CampaignLockedView } from "@/components/crm/campaign-editor/CampaignLockedView";
import { CampaignScheduleDrawer } from "@/components/crm/campaign-editor/CampaignScheduleDrawer";
import { SeasonalTemplatesRow } from "@/components/crm/campaign-editor/SeasonalTemplatesRow";
import { CampaignSendConfirmation } from "@/components/crm/campaign-editor/CampaignSendConfirmation";
import { SenderVerificationDialog } from "@/components/crm/campaign-editor/SenderVerificationDialog";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import {
  CAMPAIGN_STATUS,
  isLockedCampaignStatus,
  isQueuedCampaignStatus,
} from "@/constants/campaignStatuses";
import { SYSTEM_PERSONAS } from "@/config/systemPersonas";
import {
  DesignSystemProvider,
  useDesignSystem,
} from "@/contexts/DesignSystemContext";
import { useEmailDomains } from "@/hooks/useEmailDomains";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  applyCampaignTemplate,
  type CampaignTemplate,
  type CampaignTemplateFilter,
} from "@/lib/studio/campaignTemplates";
import type {
  CampaignPersonaSummary,
  CampaignSegmentSummary,
} from "@/lib/crm/campaignEditor";

const EDITOR_MAX_WIDTH = 1200;

type PreflightStatus = "ready" | "warning" | "blocked";

type PreflightAction = {
  label: string;
  onClick: () => void;
};

type PreflightItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  status: PreflightStatus;
  action?: PreflightAction;
  loading?: boolean;
};

const PREFLIGHT_STATUS_META: Record<
  PreflightStatus,
  {
    label: string;
    color: "success" | "warning" | "danger";
    dotColor: string;
  }
> = {
  ready: {
    label: "Ready",
    color: "success",
    dotColor: "success.400",
  },
  warning: {
    label: "Action needed",
    color: "warning",
    dotColor: "warning.400",
  },
  blocked: {
    label: "Blocked",
    color: "danger",
    dotColor: "danger.400",
  },
};

function asCountLabel(value: number | null) {
  if (value === null) {
    return "Calculating audience";
  }

  return `~${value.toLocaleString()} recipients`;
}

function computeSmsSegments(message: string) {
  if (!message.trim()) {
    return 0;
  }

  const singleSegmentLimit = 160;
  const multipartLimit = 153;
  return message.length <= singleSegmentLimit
    ? 1
    : Math.ceil(message.length / multipartLimit);
}

function SectionCard({
  id,
  title,
  description,
  children,
  endDecorator,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  endDecorator?: React.ReactNode;
}) {
  return (
    <Card
      id={id}
      variant="outlined"
      sx={{ borderRadius: "xl", p: 0, overflow: "hidden" }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "neutral.50",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.5}>
            <Typography level="title-sm" fontWeight="lg">
              {title}
            </Typography>
            {description ? (
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                {description}
              </Typography>
            ) : null}
          </Stack>
          {endDecorator}
        </Stack>
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Card>
  );
}

function formatStatusLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ChecklistItemRow({ item }: { item: PreflightItem }) {
  const statusMeta = PREFLIGHT_STATUS_META[item.status];

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        py: 2,
        gap: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          alignItems: "flex-start",
          flex: 1,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: statusMeta.dotColor,
            flexShrink: 0,
            mt: "6px",
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "14px",
              fontWeight: 600,
              color: "text.primary",
              lineHeight: 1.4,
            }}
          >
            {item.label}
          </Typography>

          {item.loading ? (
            <Stack spacing={0.35} sx={{ mt: 0.25, maxWidth: 320 }}>
              <Skeleton variant="text" width="76%" />
              <Skeleton variant="text" width="56%" />
            </Stack>
          ) : (
            <>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: "neutral.600",
                  lineHeight: 1.4,
                  mt: 0.25,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.value}
              </Typography>
              {item.detail ? (
                <Typography
                  sx={{
                    fontSize: "12px",
                    color: "neutral.400",
                    lineHeight: 1.4,
                    mt: 0.25,
                  }}
                >
                  {item.detail}
                </Typography>
              ) : null}
              {item.action ? (
                <Button
                  size="sm"
                  variant="plain"
                  color="primary"
                  endDecorator={<ArrowRight size={13} />}
                  onClick={item.action.onClick}
                  sx={{
                    mt: 0.75,
                    px: 0,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    minHeight: "auto",
                    "&:hover": {
                      bgcolor: "transparent",
                      textDecoration: "underline",
                    },
                  }}
                >
                  {item.action.label}
                </Button>
              ) : null}
            </>
          )}
        </Box>
      </Box>

      <Chip
        size="sm"
        variant="soft"
        color={statusMeta.color}
        sx={{
          fontSize: "11px",
          fontWeight: 600,
          height: 22,
          borderRadius: "6px",
          flexShrink: 0,
          mt: "2px",
        }}
      >
        {statusMeta.label}
      </Chip>
    </Box>
  );
}

function ReadinessSummary({
  readyCount,
  totalCount,
  blockedCount,
  warningCount,
}: {
  readyCount: number;
  totalCount: number;
  blockedCount: number;
  warningCount: number;
}) {
  const allReady = blockedCount === 0 && warningCount === 0;
  const hasBlockers = blockedCount > 0;
  const Icon = allReady ? CheckCircle2 : hasBlockers ? XCircle : AlertTriangle;
  const color = allReady ? "success" : hasBlockers ? "danger" : "warning";
  const message = allReady
    ? "All checks passed - ready to send"
    : hasBlockers
      ? `${blockedCount} ${blockedCount === 1 ? "item" : "items"} must be resolved`
      : `${warningCount} ${warningCount === 1 ? "item needs" : "items need"} attention`;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        mt: 2,
        px: 2,
        py: 1.5,
        borderRadius: "10px",
        bgcolor: `${color}.50`,
        border: "1px solid",
        borderColor: `${color}.200`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon size={16} style={{ color: `var(--joy-palette-${color}-600)` }} />
        <Typography
          sx={{
            fontSize: "13px",
            fontWeight: 600,
            color: `${color}.700`,
          }}
        >
          {message}
        </Typography>
      </Box>

      <Typography
        sx={{
          fontSize: "12px",
          fontWeight: 500,
          color: `${color}.500`,
          whiteSpace: "nowrap",
        }}
      >
        {readyCount} of {totalCount} ready
      </Typography>
    </Box>
  );
}

function LoadingSectionCard({
  children,
  endDecorator,
}: {
  children: React.ReactNode;
  endDecorator?: React.ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "xl", p: 0, overflow: "hidden" }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "neutral.50",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Skeleton variant="text" width="28%" />
            <Skeleton variant="text" width="52%" />
          </Stack>
          {endDecorator}
        </Stack>
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Card>
  );
}

function CampaignEditorLoadingSkeleton() {
  return (
    <Stack spacing={2.5}>
      <Stack spacing={1}>
        <Skeleton variant="text" width={132} />
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Skeleton variant="text" width={280} height={40} />
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Skeleton variant="rounded" width={64} height={24} />
              <Skeleton variant="rounded" width={54} height={24} />
              <Skeleton variant="rounded" width={96} height={24} />
              <Skeleton variant="text" width={118} />
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Skeleton variant="rounded" width={118} height={40} />
            <Skeleton variant="rounded" width={150} height={40} />
          </Stack>
        </Stack>
      </Stack>

      <LoadingSectionCard
        endDecorator={<Skeleton variant="rounded" width={104} height={28} />}
      >
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={76} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Skeleton variant="rounded" height={44} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={44} sx={{ flex: 1 }} />
          </Stack>
          <Skeleton variant="rounded" height={44} />
        </Stack>
      </LoadingSectionCard>

      <LoadingSectionCard>
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={44} />
          <Card variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
            <Stack spacing={0.5}>
              <Skeleton variant="text" width="28%" />
              <Skeleton variant="text" width="46%" />
            </Stack>
          </Card>
        </Stack>
      </LoadingSectionCard>

      <LoadingSectionCard
        endDecorator={<Skeleton variant="rounded" width={112} height={28} />}
      >
        <Stack spacing={3}>
          <Stack spacing={2.25}>
            <Stack spacing={0.5} sx={{ maxWidth: 720 }}>
              <Skeleton variant="text" width="24%" />
              <Skeleton variant="text" width="68%" />
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: { xs: "152px", sm: "168px" },
                gap: 1.5,
                overflow: "hidden",
              }}
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Card
                  key={`editor-template-skeleton-${index}`}
                  variant="outlined"
                  sx={{
                    minWidth: { xs: 152, sm: 168 },
                    width: { xs: 152, sm: 168 },
                    borderRadius: "xl",
                    p: 1.5,
                    gap: 1,
                  }}
                >
                  <Skeleton
                    variant="rectangular"
                    sx={{ height: 120, borderRadius: "lg" }}
                  />
                  <Skeleton variant="text" width="72%" />
                  <Skeleton variant="text" width="88%" />
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    <Skeleton variant="rounded" width={60} height={20} />
                    <Skeleton variant="rounded" width={70} height={20} />
                  </Stack>
                </Card>
              ))}
            </Box>
          </Stack>

          <Divider />

          <Card
            variant="outlined"
            sx={{ borderRadius: "xl", p: 0, overflow: "hidden" }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              sx={{
                p: 2.5,
                borderBottom: "1px solid",
                borderColor: "neutral.200",
              }}
            >
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Skeleton variant="text" width="22%" />
                <Skeleton variant="text" width="56%" />
                <Stack
                  direction="row"
                  spacing={0.75}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Skeleton variant="rounded" width={86} height={24} />
                  <Skeleton variant="rounded" width={112} height={24} />
                  <Skeleton variant="rounded" width={96} height={24} />
                </Stack>
              </Stack>
              <Skeleton variant="rounded" width={170} height={40} />
            </Stack>

            <Box sx={{ p: 2, backgroundColor: "neutral.100" }}>
              <AspectRatio
                ratio="5/4"
                sx={{ borderRadius: "xl", overflow: "hidden" }}
              >
                <Skeleton variant="rectangular" />
              </AspectRatio>
            </Box>
          </Card>
        </Stack>
      </LoadingSectionCard>

      <LoadingSectionCard
        endDecorator={
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={84} height={24} />
            <Skeleton variant="rounded" width={90} height={24} />
            <Skeleton variant="rounded" width={96} height={24} />
          </Stack>
        }
      >
        <Box>
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "12px",
              borderColor: "neutral.100",
              overflow: "hidden",
              px: 2.5,
            }}
          >
            {Array.from({ length: 7 }, (_, index) => (
              <Box
                key={`review-skeleton-${index}`}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 2,
                  py: 2,
                  borderBottom: index < 6 ? "1px dashed" : "none",
                  borderColor: "neutral.100",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    alignItems: "flex-start",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Skeleton
                    variant="circular"
                    sx={{ width: 8, height: 8, mt: "6px" }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Skeleton
                      variant="text"
                      sx={{
                        width: `${100 + index * 15}px`,
                        height: "15px",
                        mb: 0.5,
                      }}
                    />
                    <Skeleton
                      variant="text"
                      sx={{
                        width: `${140 + index * 20}px`,
                        height: "13px",
                        mb: 0.25,
                        maxWidth: "100%",
                      }}
                    />
                    <Skeleton
                      variant="text"
                      sx={{
                        width: `${180 + index * 10}px`,
                        height: "12px",
                        maxWidth: "100%",
                      }}
                    />
                  </Box>
                </Box>
                <Skeleton
                  variant="rectangular"
                  sx={{ width: 64, height: 22, borderRadius: "6px" }}
                />
              </Box>
            ))}
          </Sheet>

          <Skeleton
            variant="rectangular"
            sx={{ width: "100%", height: 44, borderRadius: "10px", mt: 2 }}
          />

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mt: 3,
            }}
          >
            <Skeleton
              variant="rectangular"
              sx={{ width: 240, height: 48, borderRadius: "12px" }}
            />
            <Skeleton variant="text" sx={{ width: 120, height: 14, mt: 1.5 }} />
          </Box>
        </Box>
      </LoadingSectionCard>
    </Stack>
  );
}

function CampaignEditorScreen() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { emailDomains, loading: emailDomainsLoading } = useEmailDomains();
  const { designSystem, isLoading: isDesignSystemLoading } = useDesignSystem();
  const {
    campaignId,
    campaignType,
    status,
    sendBlockedReason,
    name,
    subjectLine,
    preheaderText,
    senderName,
    senderEmail,
    replyTo,
    selectedSegments,
    selectedPersonas,
    audienceCount,
    isAudienceLoading,
    contentBlocks,
    smsMessage,
    isLoading,
    isLocked,
    isSaving,
    lastSavedAt,
    autoSaveStatus,
    autoSaveMessage,
    updateSetup,
    updateAudience,
    updateContent,
    updateSchedule,
    saveDraft,
  } = useCampaignEditor();

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = React.useState(false);
  const [verificationOpen, setVerificationOpen] = React.useState(false);
  const [previewUnavailableOpen, setPreviewUnavailableOpen] =
    React.useState(false);
  const [selectedTemplateSeason, setSelectedTemplateSeason] =
    React.useState<CampaignTemplateFilter>("all");
  const [templateToConfirm, setTemplateToConfirm] =
    React.useState<CampaignTemplate | null>(null);
  const [pendingTemplateSave, setPendingTemplateSave] = React.useState<{
    templateName: string;
    navigateToSavedDraft: boolean;
  } | null>(null);

  const activeDomains = React.useMemo(
    () => emailDomains.filter((domain) => domain.status === "active"),
    [emailDomains],
  );

  const senderDomain = React.useMemo(() => {
    if (!senderEmail.includes("@")) {
      return "";
    }

    return senderEmail.split("@").pop()?.toLowerCase() || "";
  }, [senderEmail]);

  const domainVerified = React.useMemo(() => {
    return activeDomains.some((domain) => {
      const defaultEmail = domain.default_from_email?.toLowerCase() || "";
      return (
        domain.domain.toLowerCase() === senderDomain ||
        defaultEmail === senderEmail.toLowerCase()
      );
    });
  }, [activeDomains, senderDomain, senderEmail]);

  const meaningfulEmailBlockCount = React.useMemo(
    () =>
      contentBlocks.filter(
        (block) => block.type !== "footer" && block.visible !== false,
      ).length,
    [contentBlocks],
  );
  const hasComplianceFooter = React.useMemo(
    () => contentBlocks.some((block) => block.type === "footer"),
    [contentBlocks],
  );
  const hasMeaningfulEmailContent = meaningfulEmailBlockCount > 0;

  React.useEffect(() => {
    if (!pendingTemplateSave) {
      return;
    }

    let cancelled = false;

    const persistTemplate = async () => {
      const savedId = await saveDraft({ silent: true });

      if (cancelled) {
        return;
      }

      if (savedId && pendingTemplateSave.navigateToSavedDraft && !campaignId) {
        navigate(`/crm/campaigns/${savedId}/edit`, { replace: true });
      }

      if (savedId) {
        toast.success(`${pendingTemplateSave.templateName} applied`);
      } else {
        toast.error(
          "Template applied locally, but the draft could not be saved yet.",
        );
      }

      setPendingTemplateSave(null);
    };

    void persistTemplate();

    return () => {
      cancelled = true;
    };
  }, [campaignId, navigate, pendingTemplateSave, saveDraft]);

  const segmentsQuery = useQuery({
    queryKey: ["crm-campaign-editor-segments", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async (): Promise<CampaignSegmentSummary[]> => {
      const { data, error } = await supabase
        .from("crm_segments")
        .select("id, name, description, customer_count")
        .eq("tenant_id", tenant?.id)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []).map((segment) => ({
        id: segment.id,
        name: segment.name,
        description: segment.description,
        customer_count: segment.customer_count ?? 0,
      }));
    },
  });

  const personasQuery = useQuery({
    queryKey: ["crm-campaign-editor-personas", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async (): Promise<CampaignPersonaSummary[]> => {
      const { data, error } = await supabase
        .from("crm_personas")
        .select("id, persona_name, persona_description")
        .eq("tenant_id", tenant?.id)
        .order("persona_name", { ascending: true });

      if (error) {
        throw error;
      }

      const saved = (data ?? []).map((persona) => ({
        id: persona.id,
        name: persona.persona_name,
        description: persona.persona_description,
      }));

      return [
        ...SYSTEM_PERSONAS.map((persona) => ({
          id: persona.id,
          name: persona.persona_name,
          description: persona.persona_description,
        })),
        ...saved,
      ];
    },
  });

  const focusAudienceSection = React.useCallback(() => {
    document.getElementById("campaign-editor-audience")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const focusSetupSection = React.useCallback(() => {
    document.getElementById("campaign-editor-setup")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleOpenStudio = React.useCallback(async () => {
    if (campaignType !== "email") {
      return;
    }

    let nextCampaignId = campaignId;

    if (!nextCampaignId) {
      nextCampaignId = await saveDraft({ silent: true });
    }

    if (!nextCampaignId) {
      toast.error("Save the draft before opening Campaign Studio.");
      return;
    }

    navigate(`/crm/campaigns/${nextCampaignId}/studio`);
  }, [campaignId, campaignType, navigate, saveDraft]);

  const handleScheduleForLater = React.useCallback(() => {
    setScheduleOpen(true);
  }, []);

  const openSendConfirmation = React.useCallback(() => {
    if (isLocked || pendingTemplateSave) {
      return;
    }

    setSendConfirmOpen(true);
  }, [isLocked, pendingTemplateSave]);

  const sendBlockerLines = React.useMemo(() => {
    const blockers: string[] = [];

    if (!name.trim()) {
      blockers.push("Campaign name is required.");
    }

    if (campaignType === "email" && !subjectLine.trim()) {
      blockers.push("Subject line is required.");
    }

    if (campaignType === "email" && meaningfulEmailBlockCount === 0) {
      blockers.push("At least one content block is required before sending.");
    }

    if (campaignType === "email" && !hasComplianceFooter) {
      blockers.push("A compliance footer is required before sending.");
    }

    if (campaignType === "sms" && !smsMessage.trim()) {
      blockers.push("SMS message is required before sending.");
    }

    if (!senderEmail.trim()) {
      blockers.push("Sender email is required.");
    }

    if ((audienceCount ?? 0) <= 0) {
      blockers.push("At least one eligible recipient is required.");
    }

    if (autoSaveStatus === "conflict") {
      blockers.push("Resolve the draft conflict before sending.");
    }

    if (autoSaveStatus === "failed") {
      blockers.push("Draft changes must save successfully before sending.");
    }

    if (sendBlockedReason) {
      blockers.push(formatStatusLabel(sendBlockedReason));
    }

    return blockers;
  }, [
    audienceCount,
    autoSaveStatus,
    campaignType,
    hasComplianceFooter,
    meaningfulEmailBlockCount,
    name,
    senderEmail,
    sendBlockedReason,
    smsMessage,
    subjectLine,
  ]);

  const sendWarningLines = React.useMemo(() => {
    const warnings: string[] = [];

    if (campaignType === "email" && senderEmail && !domainVerified) {
      warnings.push("This sender domain is not currently verified.");
    }

    if (autoSaveStatus === "error") {
      warnings.push("Autosave is retrying in the background.");
    }

    return warnings;
  }, [autoSaveStatus, campaignType, domainVerified, senderEmail]);

  const preflightItems = React.useMemo<PreflightItem[]>(() => {
    return [
      {
        id: "name",
        label: "Campaign identity",
        value: name.trim() || "Required before sending",
        detail: name.trim()
          ? "This name is used internally across reports and recipient activity."
          : "Choose a recognizable internal name for this send.",
        status: name.trim() ? "ready" : "blocked",
        action: name.trim()
          ? undefined
          : { label: "Complete setup", onClick: focusSetupSection },
      },
      {
        id: "subject",
        label:
          campaignType === "sms" ? "Message details" : "Subject and preheader",
        value:
          campaignType === "sms"
            ? "Not required for SMS"
            : subjectLine.trim() || "Required before sending",
        detail:
          campaignType === "sms"
            ? "Shorten the copy until the segment count feels intentional."
            : preheaderText.trim() ||
              "Add preview text to shape the inbox snippet.",
        status:
          campaignType === "sms"
            ? "ready"
            : subjectLine.trim()
              ? "ready"
              : "blocked",
        action:
          campaignType === "email" && !subjectLine.trim()
            ? { label: "Complete setup", onClick: focusSetupSection }
            : undefined,
      },
      {
        id: "audience",
        label: "Audience",
        value: isAudienceLoading
          ? "Calculating audience"
          : asCountLabel(audienceCount),
        detail:
          selectedSegments.length > 0 || selectedPersonas.length > 0
            ? `${selectedSegments.length} segment${selectedSegments.length === 1 ? "" : "s"}, ${selectedPersonas.length} persona${selectedPersonas.length === 1 ? "" : "s"}`
            : "All eligible contacts",
        status: (audienceCount ?? 0) > 0 ? "ready" : "blocked",
        action:
          (audienceCount ?? 0) > 0
            ? undefined
            : { label: "Select audience", onClick: focusAudienceSection },
        loading: isAudienceLoading,
      },
      {
        id: "sender",
        label: "Sender configuration",
        value: senderEmail || "No sender email configured",
        detail:
          campaignType === "email"
            ? senderEmail
              ? domainVerified
                ? "The active sender domain is verified."
                : emailDomainsLoading
                  ? "Checking sender verification status."
                  : "The sender can still be reviewed, but verification is recommended."
              : "Add a sender email before this campaign can go out."
            : "SMS campaigns still use your saved sender settings.",
        status: !senderEmail.trim()
          ? "blocked"
          : campaignType === "email" && !domainVerified
            ? "warning"
            : "ready",
        action: !senderEmail.trim()
          ? { label: "Configure sender", onClick: focusSetupSection }
          : undefined,
        loading:
          campaignType === "email" &&
          emailDomainsLoading &&
          Boolean(senderEmail),
      },
      {
        id: "content",
        label: campaignType === "email" ? "Email content" : "SMS message",
        value:
          campaignType === "email"
            ? hasMeaningfulEmailContent
              ? `${meaningfulEmailBlockCount} block${meaningfulEmailBlockCount === 1 ? "" : "s"} designed`
              : "Apply a template or open Studio to add content"
            : smsMessage.trim()
              ? `${smsMessage.length} characters across ${computeSmsSegments(smsMessage)} segment(s)`
              : "Message required before sending",
        detail:
          campaignType === "email"
            ? preheaderText.trim()
              ? `Preview text: ${preheaderText}`
              : "Preview text can be added in Setup for inbox context."
            : "Include STOP instructions where required.",
        status:
          campaignType === "email"
            ? hasMeaningfulEmailContent
              ? "ready"
              : "blocked"
            : smsMessage.trim()
              ? "ready"
              : "blocked",
        action:
          campaignType === "email" && !hasMeaningfulEmailContent
            ? { label: "Open Campaign Studio", onClick: handleOpenStudio }
            : campaignType === "sms" && !smsMessage.trim()
              ? { label: "Write message", onClick: focusSetupSection }
              : undefined,
      },
      {
        id: "footer",
        label: "Compliance footer",
        value:
          campaignType === "email"
            ? hasComplianceFooter
              ? "Footer block is present and locked into the send"
              : "Footer block required before sending"
            : "Not required for SMS",
        detail:
          campaignType === "email"
            ? hasComplianceFooter
              ? "Legal address, unsubscribe language, and brand details will render with the email."
              : "Every email campaign must include CAN-SPAM and GDPR footer details."
            : "SMS campaigns use channel-specific compliance controls.",
        status:
          campaignType === "email"
            ? hasComplianceFooter
              ? "ready"
              : "blocked"
            : "ready",
        action:
          campaignType === "email" && !hasComplianceFooter
            ? { label: "Open Campaign Studio", onClick: handleOpenStudio }
            : undefined,
      },
      {
        id: "sync",
        label: "Draft sync",
        value:
          pendingTemplateSave || isSaving || autoSaveStatus === "saving"
            ? "Saving the latest draft changes"
            : autoSaveMessage ||
              (lastSavedAt
                ? `Last saved ${lastSavedAt.toLocaleTimeString()}`
                : campaignId
                  ? "Draft saved"
                  : "Draft will be created on first save"),
        detail:
          autoSaveStatus === "error"
            ? "Autosave is retrying in the background."
            : autoSaveStatus === "conflict"
              ? "Reload the editor to resolve competing changes."
              : autoSaveStatus === "failed"
                ? "Saving failed after multiple retries."
                : "Stored HTML and live preview stay aligned when the draft saves.",
        status:
          autoSaveStatus === "conflict" || autoSaveStatus === "failed"
            ? "blocked"
            : autoSaveStatus === "error"
              ? "warning"
              : "ready",
      },
    ];
  }, [
    audienceCount,
    autoSaveMessage,
    autoSaveStatus,
    campaignType,
    domainVerified,
    emailDomainsLoading,
    focusAudienceSection,
    focusSetupSection,
    handleOpenStudio,
    hasComplianceFooter,
    hasMeaningfulEmailContent,
    isAudienceLoading,
    isSaving,
    lastSavedAt,
    meaningfulEmailBlockCount,
    name,
    pendingTemplateSave,
    preheaderText,
    campaignId,
    senderEmail,
    selectedPersonas.length,
    selectedSegments.length,
    smsMessage,
    subjectLine,
  ]);

  const readyCount = preflightItems.filter(
    (item) => item.status === "ready",
  ).length;
  const warningCount = preflightItems.filter(
    (item) => item.status === "warning",
  ).length;
  const blockedCount = preflightItems.filter(
    (item) => item.status === "blocked",
  ).length;
  const sendButtonDisabled =
    sendBlockerLines.length > 0 ||
    isLocked ||
    isAudienceLoading ||
    Boolean(pendingTemplateSave);
  const showActiveSendView =
    isQueuedCampaignStatus(status) || status === CAMPAIGN_STATUS.SENDING;
  const showLockedView =
    !showActiveSendView && status !== CAMPAIGN_STATUS.DRAFT;

  const applyTemplateToCampaign = React.useCallback(
    (template: CampaignTemplate) => {
      updateSetup({
        subjectLine: template.subjectLine,
        preheaderText: template.previewText,
      });
      updateContent({
        contentBlocks: applyCampaignTemplate(template, designSystem),
      });
      setPendingTemplateSave({
        templateName: template.name,
        navigateToSavedDraft: !campaignId,
      });
    },
    [campaignId, designSystem, updateContent, updateSetup],
  );

  const handleApplyTemplate = React.useCallback(
    (template: CampaignTemplate) => {
      if (hasMeaningfulEmailContent) {
        setTemplateToConfirm(template);
        return;
      }

      applyTemplateToCampaign(template);
    },
    [applyTemplateToCampaign, hasMeaningfulEmailContent],
  );

  if (isLoading) {
    return <CampaignEditorLoadingSkeleton />;
  }

  if (showActiveSendView) {
    return (
      <Stack spacing={2}>
        <CampaignActiveSendView
          onPreview={() => setPreviewUnavailableOpen(true)}
        />
        <JoyDialog
          open={previewUnavailableOpen}
          onClose={() => setPreviewUnavailableOpen(false)}
          size="sm"
          title="Preview unavailable"
          description="Preview is unavailable once delivery has started."
        >
          <JoyDialogContent>
            <Typography level="body-sm" sx={{ color: "neutral.700" }}>
              Delivery, scheduling, recipients, and reporting remain available.
            </Typography>
          </JoyDialogContent>
          <JoyDialogActions>
            <JoyButton
              variant="plain"
              color="neutral"
              onClick={() => setPreviewUnavailableOpen(false)}
            >
              Close
            </JoyButton>
          </JoyDialogActions>
        </JoyDialog>
      </Stack>
    );
  }

  if (showLockedView) {
    return (
      <Stack spacing={2}>
        <CampaignLockedView onPreview={() => setPreviewUnavailableOpen(true)} />
        <JoyDialog
          open={previewUnavailableOpen}
          onClose={() => setPreviewUnavailableOpen(false)}
          size="sm"
          title="Preview unavailable"
          description="Preview is only available while the campaign is still editable."
        >
          <JoyDialogContent>
            <Typography level="body-sm" sx={{ color: "neutral.700" }}>
              Sent, scheduled, and paused campaign infrastructure is still
              active.
            </Typography>
          </JoyDialogContent>
          <JoyDialogActions>
            <JoyButton
              variant="plain"
              color="neutral"
              onClick={() => setPreviewUnavailableOpen(false)}
            >
              Close
            </JoyButton>
          </JoyDialogActions>
        </JoyDialog>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack spacing={1}>
        <Typography
          level="body-xs"
          component={Link}
          to="/crm/campaigns"
          sx={{
            color: "neutral.500",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            width: "fit-content",
            "&:hover": { color: "neutral.700" },
          }}
        >
          <ArrowLeft size={14} />
          Back to campaigns
        </Typography>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography level="h3" fontWeight="lg">
              {name || "Untitled Campaign"}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              <JoyStatusChip status={status} />
              <JoyChip variant="soft" color="neutral" size="sm">
                {campaignType === "email" ? "Email" : "SMS"}
              </JoyChip>
              {pendingTemplateSave ? (
                <Chip variant="soft" color="neutral" size="sm">
                  Applying template
                </Chip>
              ) : null}
              {autoSaveStatus !== "idle" && autoSaveStatus !== "saved" ? (
                <Chip
                  variant="soft"
                  color={
                    autoSaveStatus === "conflict" || autoSaveStatus === "failed"
                      ? "danger"
                      : autoSaveStatus === "error"
                        ? "warning"
                        : "neutral"
                  }
                  size="sm"
                >
                  {autoSaveStatus === "saving"
                    ? "Autosaving"
                    : autoSaveStatus === "error"
                      ? "Retrying save"
                      : autoSaveStatus === "conflict"
                        ? "Reload required"
                        : autoSaveStatus === "failed"
                          ? "Save failed"
                          : autoSaveStatus}
                </Chip>
              ) : null}
              {sendBlockedReason ? (
                <Chip variant="soft" color="warning" size="sm">
                  {formatStatusLabel(sendBlockedReason)}
                </Chip>
              ) : null}
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {isSaving
                  ? "Saving draft…"
                  : lastSavedAt
                    ? `Last saved ${lastSavedAt.toLocaleTimeString()}`
                    : campaignId
                      ? "Saved"
                      : "New draft"}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <JoyButton
              variant="outlined"
              color="neutral"
              startDecorator={<TimerReset size={16} />}
              onClick={() => setScheduleOpen(true)}
              disabled={isLocked}
            >
              Schedule
            </JoyButton>
            <JoyButton
              startDecorator={<Send size={16} />}
              onClick={openSendConfirmation}
              disabled={sendButtonDisabled}
            >
              Send Campaign
            </JoyButton>
          </Stack>
        </Stack>
      </Stack>

      <SectionCard
        id="campaign-editor-setup"
        title="Setup"
        description="Campaign identity, channel, and sender configuration."
        endDecorator={
          campaignType === "email" ? (
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={() => setVerificationOpen(true)}
            >
              Verify Sender
            </JoyButton>
          ) : null
        }
      >
        <Stack spacing={2}>
          <JoyInput
            label="Campaign name"
            value={name}
            disabled={isLocked}
            onValueChange={(value) => updateSetup({ name: value })}
          />
          <JoySelect
            label="Campaign type"
            value={campaignType}
            disabled={isLocked}
            options={[
              { value: "email", label: "Email" },
              { value: "sms", label: "SMS" },
            ]}
            onValueChange={(value) =>
              updateSetup({ campaignType: value === "sms" ? "sms" : "email" })
            }
          />
          {campaignType === "email" ? (
            <>
              <JoyInput
                label="Subject line"
                value={subjectLine}
                disabled={isLocked}
                onValueChange={(value) => updateSetup({ subjectLine: value })}
              />
              <JoyTextarea
                label="Preheader text"
                minRows={3}
                value={preheaderText}
                disabled={isLocked}
                onValueChange={(value) => updateSetup({ preheaderText: value })}
              />
            </>
          ) : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <JoyInput
              label="Sender name"
              value={senderName}
              disabled={isLocked}
              onValueChange={(value) => updateSetup({ senderName: value })}
            />
            <JoyInput
              label="Sender email"
              value={senderEmail}
              disabled={isLocked}
              onValueChange={(value) => updateSetup({ senderEmail: value })}
            />
          </Stack>
          <JoyInput
            label="Reply-to email"
            value={replyTo}
            disabled={isLocked}
            onValueChange={(value) => updateSetup({ replyTo: value })}
          />
        </Stack>
      </SectionCard>

      <SectionCard
        id="campaign-editor-audience"
        title="Audience"
        description="Leave both selectors empty to target all eligible contacts."
      >
        <Stack spacing={2}>
          <JoyAutocomplete<CampaignSegmentSummary, true, false, false>
            multiple
            label="Segments"
            disabled={isLocked}
            loading={segmentsQuery.isLoading}
            options={segmentsQuery.data ?? []}
            value={selectedSegments}
            placeholder="All contacts"
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onValueChange={(value) =>
              updateAudience({
                selectedSegments: (value ?? []) as CampaignSegmentSummary[],
              })
            }
          />
          <JoyAutocomplete<CampaignPersonaSummary, true, false, false>
            multiple
            label="Personas"
            disabled={isLocked}
            loading={personasQuery.isLoading}
            options={personasQuery.data ?? []}
            value={selectedPersonas}
            placeholder="All personas"
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onValueChange={(value) =>
              updateAudience({
                selectedPersonas: (value ?? []) as CampaignPersonaSummary[],
              })
            }
          />
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ borderRadius: "lg", p: 2 }}
          >
            <Stack spacing={0.5}>
              <Typography level="body-sm" fontWeight="lg">
                Estimated audience
              </Typography>
              {isAudienceLoading ? (
                <Skeleton variant="text" width="52%" />
              ) : (
                <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                  {asCountLabel(audienceCount)}
                </Typography>
              )}
            </Stack>
          </Sheet>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Content"
        description={
          campaignType === "email"
            ? "Choose a seasonal starting point, preview the final HTML live, then refine the campaign in Campaign Studio."
            : "Compose the SMS body that will be sent to recipients."
        }
        endDecorator={
          campaignType === "email" ? (
            <Chip variant="soft" color="neutral" size="sm">
              {hasMeaningfulEmailContent
                ? `${meaningfulEmailBlockCount} block${meaningfulEmailBlockCount === 1 ? "" : "s"}`
                : "No email blocks yet"}
            </Chip>
          ) : null
        }
      >
        {campaignType === "email" ? (
          <Stack spacing={3}>
            <SeasonalTemplatesRow
              selectedSeason={selectedTemplateSeason}
              onSeasonChange={setSelectedTemplateSeason}
              onApply={handleApplyTemplate}
              loading={isDesignSystemLoading}
              disabled={Boolean(pendingTemplateSave)}
            />

            <Divider />

            <ContentPreviewCard
              blocks={contentBlocks}
              subjectLine={subjectLine}
              previewText={preheaderText}
              designSystem={designSystem}
              loading={isDesignSystemLoading}
              onOpenStudio={handleOpenStudio}
            />
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <JoyTextarea
              label="SMS message"
              minRows={8}
              value={smsMessage}
              disabled={isLocked}
              onValueChange={(value) => updateContent({ smsMessage: value })}
            />
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "lg", p: 2 }}
            >
              <Stack spacing={0.5}>
                <Typography level="body-sm">
                  Characters: {smsMessage.length}
                </Typography>
                <Typography level="body-sm">
                  SMS segments: {computeSmsSegments(smsMessage)}
                </Typography>
                <Typography level="body-sm">
                  Include STOP instructions where required.
                </Typography>
              </Stack>
            </Sheet>
          </Stack>
        )}
      </SectionCard>

      <Card variant="outlined" sx={{ borderRadius: "xl", p: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: "18px",
                fontWeight: 700,
                color: "text.primary",
                lineHeight: 1.3,
              }}
            >
              Review & Send
            </Typography>
            <Typography sx={{ fontSize: "13px", color: "neutral.400", mt: 0.5 }}>
              Verify everything is set before sending.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 1,
              flexShrink: 0,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <Chip
              size="sm"
              variant="soft"
              color="success"
              sx={{ fontSize: "11px", fontWeight: 600, borderRadius: "6px" }}
            >
              {readyCount} ready
            </Chip>
            {blockedCount > 0 ? (
              <Chip
                size="sm"
                variant="soft"
                color="danger"
                sx={{ fontSize: "11px", fontWeight: 600, borderRadius: "6px" }}
              >
                {blockedCount} blocked
              </Chip>
            ) : null}
            {warningCount > 0 ? (
              <Chip
                size="sm"
                variant="soft"
                color="warning"
                sx={{ fontSize: "11px", fontWeight: 600, borderRadius: "6px" }}
              >
                {warningCount} needs attention
              </Chip>
            ) : null}
          </Box>
        </Box>

        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "12px",
            border: "1px solid",
            borderColor: "neutral.100",
            overflow: "hidden",
            px: 2.5,
          }}
        >
          {preflightItems.map((item, index) => (
            <Box
              key={item.id}
              sx={{
                borderBottom:
                  index < preflightItems.length - 1 ? "1px dashed" : "none",
                borderColor: "neutral.100",
              }}
            >
              <ChecklistItemRow item={item} />
            </Box>
          ))}
        </Sheet>

        <ReadinessSummary
          readyCount={readyCount}
          totalCount={preflightItems.length}
          blockedCount={blockedCount}
          warningCount={warningCount}
        />

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            mt: 3,
            mb: 1,
          }}
        >
          <Button
            size="lg"
            variant="solid"
            color="primary"
            disabled={sendButtonDisabled}
            startDecorator={<Send size={18} />}
            onClick={openSendConfirmation}
            sx={{
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "15px",
              px: 5,
              py: 1.5,
              minWidth: 240,
              boxShadow: sendButtonDisabled ? "none" : "sm",
              opacity: sendButtonDisabled ? 0.5 : 1,
              transition: "all 150ms ease",
              "&:hover:not(:disabled)": {
                boxShadow: "md",
                transform: "translateY(-1px)",
              },
            }}
          >
            Send Campaign
          </Button>

          <Button
            size="sm"
            variant="plain"
            color="neutral"
            disabled={sendButtonDisabled}
            endDecorator={<Calendar size={14} />}
            onClick={handleScheduleForLater}
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              color: "neutral.500",
              "&:hover": { bgcolor: "transparent", color: "primary.500" },
            }}
          >
            Schedule for later
          </Button>

          {blockedCount > 0 ? (
            <Typography
              sx={{
                fontSize: "12px",
                color: "neutral.400",
                mt: 0.5,
                textAlign: "center",
              }}
            >
              Resolve blocked items above to enable sending
            </Typography>
          ) : null}
        </Box>
      </Card>

      <Modal
        open={Boolean(templateToConfirm)}
        onClose={() => setTemplateToConfirm(null)}
      >
        <ModalDialog
          variant="outlined"
          sx={{ borderRadius: "xl", maxWidth: 460 }}
        >
          <DialogTitle>Replace the current email content?</DialogTitle>
          <DialogContent>
            <Typography level="body-sm" sx={{ color: "neutral.700" }}>
              Applying a seasonal template will replace the current email
              blocks, subject line, and preview text for this campaign.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setTemplateToConfirm(null)}
            >
              Keep current draft
            </Button>
            <Button
              variant="solid"
              color="neutral"
              onClick={() => {
                if (templateToConfirm) {
                  applyTemplateToCampaign(templateToConfirm);
                }
                setTemplateToConfirm(null);
              }}
            >
              Replace with template
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      <CampaignScheduleDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSendNow={() => {
          updateSchedule({ sendImmediately: true, sendAt: null });
          openSendConfirmation();
        }}
        onSchedule={(scheduledDateTime) => {
          updateSchedule({ sendImmediately: false, sendAt: scheduledDateTime });
          openSendConfirmation();
        }}
        canConfirm={!isLocked}
      />
      <CampaignSendConfirmation
        open={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        builderWarnings={sendWarningLines}
        builderBlockers={sendBlockerLines}
      />
      <SenderVerificationDialog
        open={verificationOpen}
        onClose={() => setVerificationOpen(false)}
      />
    </Stack>
  );
}

export default function CRMCampaignEditorPage() {
  const { campaignId } = useParams<{ campaignId: string }>();

  return (
    <DesignSystemProvider>
      <CampaignEditorProvider campaignId={campaignId}>
        <PageContainer sx={{ maxWidth: `${EDITOR_MAX_WIDTH}px`, mx: "auto" }}>
          <CampaignEditorScreen />
        </PageContainer>
      </CampaignEditorProvider>
    </DesignSystemProvider>
  );
}
