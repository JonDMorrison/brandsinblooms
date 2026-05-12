import * as React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Checkbox from "@mui/joy/Checkbox";
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
import { CampaignBlockerRow } from "@/components/crm/campaign-editor/CampaignBlockerRow";
import { CampaignSendConfirmation } from "@/components/crm/campaign-editor/CampaignSendConfirmation";
import { CollapsibleSection } from "@/components/crm/campaign-editor/CollapsibleSection";
import { SegmentsAudienceSelect } from "@/components/crm/campaign-editor/SegmentsAudienceSelect";
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
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
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
import { useCustomers } from "@/hooks/useCustomers";
import { classifySender } from "@/lib/crm/senderSeverity";
import type { SenderClassification } from "@/lib/crm/senderSeverity";
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
const AUDIENCE_CUSTOMER_PAGE_SIZE = 8;

type AudienceExpansionMode = "all-customers" | "add-customers";

type AudienceCustomerRecord = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  customer_segments?: Array<{ segment_id: string }> | null;
};

type AudienceCustomerSummary = {
  id: string;
  name: string;
  email: string;
  segmentNames: string[];
  hasEmail: boolean;
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

function formatAudienceCustomerName(customer: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const fullName = [customer.first_name?.trim(), customer.last_name?.trim()]
    .filter(Boolean)
    .join(" ");

  return fullName || customer.email?.trim() || "Unnamed customer";
}

function toAudienceCustomerSummary(
  customer: AudienceCustomerRecord,
  segmentNameById: Map<string, string>,
): AudienceCustomerSummary {
  const email = customer.email?.trim() ?? "";

  return {
    id: customer.id,
    name: formatAudienceCustomerName(customer),
    email,
    segmentNames: (customer.customer_segments ?? [])
      .map((assignment) => segmentNameById.get(assignment.segment_id) ?? null)
      .filter((segmentName): segmentName is string => Boolean(segmentName)),
    hasEmail: email.length > 0,
  };
}

function formatAudienceDetail(params: {
  selectedSegmentCount: number;
  selectedPersonaCount: number;
  includeAllCustomers: boolean;
  additionalCustomerCount: number;
}) {
  const parts: string[] = [];

  if (params.includeAllCustomers) {
    parts.push("All customers");
  }

  if (params.selectedSegmentCount > 0) {
    parts.push(
      `${params.selectedSegmentCount} segment${params.selectedSegmentCount === 1 ? "" : "s"}`,
    );
  }

  if (params.selectedPersonaCount > 0) {
    parts.push(
      `${params.selectedPersonaCount} persona${params.selectedPersonaCount === 1 ? "" : "s"}`,
    );
  }

  if (params.additionalCustomerCount > 0) {
    parts.push(
      `${params.additionalCustomerCount} direct customer${params.additionalCustomerCount === 1 ? "" : "s"}`,
    );
  }

  return parts.join(" · ") || "All eligible contacts";
}

function formatStatusLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
    includeAllCustomers,
    additionalCustomerIds,
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
  const [audienceExpansionOpen, setAudienceExpansionOpen] =
    React.useState(false);
  const [audienceExpansionMode, setAudienceExpansionMode] =
    React.useState<AudienceExpansionMode>("all-customers");
  const [audienceCustomerSearch, setAudienceCustomerSearch] =
    React.useState("");
  const [audienceCustomerPage, setAudienceCustomerPage] = React.useState(1);
  const [draftIncludeAllCustomers, setDraftIncludeAllCustomers] =
    React.useState(false);
  const [draftAdditionalCustomerIds, setDraftAdditionalCustomerIds] =
    React.useState<string[]>([]);
  const [selectedTemplateSeason, setSelectedTemplateSeason] =
    React.useState<CampaignTemplateFilter>("all");
  const [templateToConfirm, setTemplateToConfirm] =
    React.useState<CampaignTemplate | null>(null);
  const [pendingTemplateSave, setPendingTemplateSave] = React.useState<{
    templateName: string;
    navigateToSavedDraft: boolean;
  } | null>(null);

  // Three-bucket sender classification (ready / warning / blocked)
  // with specific reason codes. Drives the preflight item severity,
  // the message text shown to the user, AND the Send Campaign button
  // gating below. Loading-state guard prevents flashing a spurious
  // "blocked" classification while the email_domains query is still
  // resolving.
  const senderClassification = React.useMemo<SenderClassification>(() => {
    if (campaignType === "email" && emailDomainsLoading) {
      return { status: "ready" };
    }
    return classifySender({
      senderEmail,
      senderName,
      emailDomains,
      campaignType,
    });
  }, [
    campaignType,
    emailDomains,
    emailDomainsLoading,
    senderEmail,
    senderName,
  ]);

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

  const customerSegmentNameById = React.useMemo(
    () =>
      new Map(
        (segmentsQuery.data ?? []).map((segment) => [segment.id, segment.name]),
      ),
    [segmentsQuery.data],
  );

  const {
    data: audienceCustomers = [],
    totalCount: audienceCustomerTotalCount = 0,
    isLoading: audienceCustomersLoading,
  } = useCustomers({
    search: audienceCustomerSearch,
    page: audienceCustomerPage,
    pageSize: AUDIENCE_CUSTOMER_PAGE_SIZE,
    enabled:
      campaignType === "email" &&
      audienceExpansionOpen &&
      audienceExpansionMode === "add-customers",
  });

  const audienceCustomerOptions = React.useMemo(
    () =>
      audienceCustomers.map((customer) =>
        toAudienceCustomerSummary(customer, customerSegmentNameById),
      ),
    [audienceCustomers, customerSegmentNameById],
  );

  const selectedAdditionalCustomersQuery = useQuery({
    queryKey: [
      "crm-campaign-editor-additional-customers",
      tenant?.id,
      additionalCustomerIds,
    ],
    enabled:
      campaignType === "email" &&
      Boolean(tenant?.id) &&
      additionalCustomerIds.length > 0,
    queryFn: async (): Promise<AudienceCustomerRecord[]> => {
      const { data, error } = await supabase
        .from("crm_customers")
        .select(
          "id, email, first_name, last_name, customer_segments(segment_id)",
        )
        .eq("tenant_id", tenant?.id)
        .in("id", additionalCustomerIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as AudienceCustomerRecord[];
    },
  });

  const selectedAdditionalCustomers = React.useMemo(() => {
    const customerById = new Map(
      (selectedAdditionalCustomersQuery.data ?? []).map((customer) => [
        customer.id,
        toAudienceCustomerSummary(customer, customerSegmentNameById),
      ]),
    );

    return additionalCustomerIds.flatMap((customerId) => {
      const customer = customerById.get(customerId);
      return customer ? [customer] : [];
    });
  }, [
    additionalCustomerIds,
    customerSegmentNameById,
    selectedAdditionalCustomersQuery.data,
  ]);

  const audienceDetail = React.useMemo(
    () =>
      formatAudienceDetail({
        selectedSegmentCount: selectedSegments.length,
        selectedPersonaCount: selectedPersonas.length,
        includeAllCustomers,
        additionalCustomerCount: additionalCustomerIds.length,
      }),
    [
      additionalCustomerIds.length,
      includeAllCustomers,
      selectedPersonas.length,
      selectedSegments.length,
    ],
  );

  React.useEffect(() => {
    if (!audienceExpansionOpen) {
      return;
    }

    setDraftIncludeAllCustomers(includeAllCustomers);
    setDraftAdditionalCustomerIds(additionalCustomerIds);
    setAudienceExpansionMode(
      includeAllCustomers
        ? "all-customers"
        : additionalCustomerIds.length > 0
          ? "add-customers"
          : "all-customers",
    );
    setAudienceCustomerSearch("");
    setAudienceCustomerPage(1);
  }, [additionalCustomerIds, audienceExpansionOpen, includeAllCustomers]);

  const handleSaveAudienceExpansion = React.useCallback(() => {
    updateAudience({
      includeAllCustomers: draftIncludeAllCustomers,
      additionalCustomerIds: draftAdditionalCustomerIds,
    });
    setAudienceExpansionOpen(false);
  }, [draftAdditionalCustomerIds, draftIncludeAllCustomers, updateAudience]);

  const toggleDraftAdditionalCustomer = React.useCallback(
    (customerId: string) => {
      setDraftAdditionalCustomerIds((current) =>
        current.includes(customerId)
          ? current.filter((existingId) => existingId !== customerId)
          : [...current, customerId],
      );
    },
    [],
  );

  const handleRemoveAdditionalCustomer = React.useCallback(
    (customerId: string) => {
      updateAudience({
        additionalCustomerIds: additionalCustomerIds.filter(
          (existingId) => existingId !== customerId,
        ),
      });
    },
    [additionalCustomerIds, updateAudience],
  );

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

  const focusContentSection = React.useCallback(() => {
    document.getElementById("campaign-editor-content")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const focusSubjectInput = React.useCallback(() => {
    const section = document.getElementById("campaign-editor-content");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = document.getElementById(
      "campaign-editor-subject",
    ) as HTMLInputElement | null;
    input?.focus();
  }, []);

  const handleReloadDraft = React.useCallback(() => {
    window.location.reload();
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

    // Hard sender blockers (paused/failed/no-sender/domain-not-
    // registered). The classifier already produces the user-facing
    // copy — push that exact line so the existing send-confirm
    // dialog and disabled-button tooltip surface the same reason
    // the Review & Send list shows. Without this, paused / failed
    // domains used to slip through to "Send Campaign" and bounce
    // at the email provider.
    if (campaignType === "email" && senderClassification.status === "blocked") {
      blockers.push(senderClassification.message);
    } else if (!senderEmail.trim()) {
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
    senderClassification,
    senderEmail,
    sendBlockedReason,
    smsMessage,
    subjectLine,
  ]);

  const sendWarningLines = React.useMemo(() => {
    const warnings: string[] = [];

    // Sender warnings (pending DNS, free-mail, generic display name)
    // surface the specific reason from the classifier rather than the
    // old generic "not verified" line. Blocked sender states already
    // appear in sendBlockerLines, so we deliberately don't duplicate
    // them here.
    if (
      campaignType === "email" &&
      senderEmail &&
      senderClassification.status === "warning"
    ) {
      warnings.push(senderClassification.message);
    }

    if (autoSaveStatus === "error") {
      warnings.push("Autosave is retrying in the background.");
    }

    return warnings;
  }, [autoSaveStatus, campaignType, senderClassification, senderEmail]);

  const sendButtonDisabled =
    sendBlockerLines.length > 0 ||
    isLocked ||
    isAudienceLoading ||
    Boolean(pendingTemplateSave);

  // Maps the existing 7-item preflight signals into the new single-
  // blocker model (#4 of the campaign editor simplification spec).
  // Order here is the priority order the spec mandates — first true
  // wins inside resolveCampaignBlocker.
  const blockerSignals = React.useMemo(
    () => ({
      senderUnverified:
        campaignType === "email" &&
        (senderClassification.status === "blocked" || !senderEmail.trim()),
      audienceEmpty: (audienceCount ?? 0) <= 0 && !isAudienceLoading,
      contentEmpty:
        campaignType === "email"
          ? !hasMeaningfulEmailContent
          : !smsMessage.trim(),
      subjectEmpty: campaignType === "email" && !subjectLine.trim(),
      draftConflict: autoSaveStatus === "conflict",
    }),
    [
      audienceCount,
      autoSaveStatus,
      campaignType,
      hasMeaningfulEmailContent,
      isAudienceLoading,
      senderClassification.status,
      senderEmail,
      smsMessage,
      subjectLine,
    ],
  );

  // Default-collapse heuristic for the Setup section: collapse once
  // the user has named the campaign AND configured a sender. Both are
  // required before send, so them being non-empty is a reliable proxy
  // for "this campaign has moved past initial setup". Recomputed only
  // on initial render — manual expand/collapse always wins after that.
  const setupInitiallyExpanded = React.useMemo(
    () => !(name.trim() && senderEmail.trim()),
    // Initial-mount snapshot only; subsequent edits don't auto-collapse
    // (matches the "respect user choice for the session" requirement).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const audienceInitiallyExpanded = true;
  const contentInitiallyExpanded = true;
  const previewInitiallyExpanded = false;
  const scheduleInitiallyExpanded = false;

  // Persona disclosure auto-expands when the campaign already has
  // personas saved on load (#2 of the spec), but the toggle state is
  // user-controlled afterwards.
  const [personaDisclosureOpen, setPersonaDisclosureOpen] = React.useState(
    selectedPersonas.length > 0,
  );

  const setupSummary = React.useMemo(() => {
    const parts: string[] = [];
    if (name.trim()) parts.push(name.trim());
    parts.push(campaignType === "email" ? "Email" : "SMS");
    const sender = senderName.trim() || senderEmail.trim();
    if (sender) parts.push(`From ${sender}`);
    return parts.join(" · ");
  }, [campaignType, name, senderEmail, senderName]);

  const previewSummary = React.useMemo(
    () => subjectLine.trim() || "Subject line not set",
    [subjectLine],
  );

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
              {autoSaveStatus !== "idle" &&
              autoSaveStatus !== "saved" &&
              // The "conflict" state is now surfaced via the inline
              // CampaignBlockerRow above the Send button instead of as
              // a header chip (campaign editor simplification #5).
              autoSaveStatus !== "conflict" ? (
                <Chip
                  variant="soft"
                  color={
                    autoSaveStatus === "failed"
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

      <CollapsibleSection
        id="campaign-editor-setup"
        title="Setup"
        summary={setupSummary}
        defaultExpanded={setupInitiallyExpanded}
        endDecorator={
          campaignType === "email" ? (
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setVerificationOpen(true);
              }}
            >
              Verify sender
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
      </CollapsibleSection>

      <CollapsibleSection
        id="campaign-editor-audience"
        title="Who's this for?"
        summary={audienceDetail}
        defaultExpanded={audienceInitiallyExpanded}
        badge={
          <Chip variant="soft" color="neutral" size="sm">
            {isAudienceLoading
              ? "Calculating audience"
              : asCountLabel(audienceCount)}
          </Chip>
        }
      >
        <Stack spacing={2}>
          <SegmentsAudienceSelect
            segments={segmentsQuery.data ?? []}
            selectedSegments={selectedSegments}
            includeAllCustomers={includeAllCustomers}
            disabled={isLocked}
            loading={segmentsQuery.isLoading}
            onChange={(next) => updateAudience(next)}
          />

          {personaDisclosureOpen ? (
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
          ) : (
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={() => setPersonaDisclosureOpen(true)}
              disabled={isLocked}
              sx={{ alignSelf: "flex-start", px: 0.5 }}
            >
              Also target by persona
            </JoyButton>
          )}

          {campaignType === "email" ? (
            <Stack spacing={1.25}>
              <JoyButton
                variant="plain"
                color="neutral"
                size="sm"
                onClick={() => setAudienceExpansionOpen(true)}
                disabled={isLocked}
                sx={{ alignSelf: "flex-start", px: 0.5 }}
              >
                Add specific people
              </JoyButton>

              {includeAllCustomers || additionalCustomerIds.length > 0 ? (
                <Stack spacing={1}>
                  {includeAllCustomers ? (
                    <Sheet
                      variant="outlined"
                      sx={{
                        borderRadius: "md",
                        p: 1.5,
                        bgcolor: "background.surface",
                        borderColor: "primary.200",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography level="body-sm" fontWeight="md">
                            All customers included
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.600" }}
                          >
                            Every eligible customer in this tenant is unioned
                            into the send audience at delivery time.
                          </Typography>
                        </Stack>
                        <Button
                          size="sm"
                          variant="plain"
                          color="neutral"
                          disabled={isLocked}
                          onClick={() =>
                            updateAudience({ includeAllCustomers: false })
                          }
                        >
                          Remove
                        </Button>
                      </Stack>
                    </Sheet>
                  ) : null}

                  {additionalCustomerIds.length > 0 ? (
                    <Sheet
                      variant="outlined"
                      sx={{
                        borderRadius: "md",
                        p: 1.5,
                        bgcolor: "background.surface",
                        borderColor: "primary.200",
                      }}
                    >
                      <Stack spacing={1.25}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                            <Typography level="body-sm" fontWeight="md">
                              Direct additions
                            </Typography>
                            <Typography
                              level="body-xs"
                              sx={{ color: "neutral.600" }}
                            >
                              {additionalCustomerIds.length} customer
                              {additionalCustomerIds.length === 1 ? "" : "s"}{" "}
                              attached directly to this campaign.
                            </Typography>
                          </Stack>
                          <Button
                            size="sm"
                            variant="plain"
                            color="neutral"
                            disabled={isLocked}
                            onClick={() =>
                              updateAudience({ additionalCustomerIds: [] })
                            }
                          >
                            Clear all
                          </Button>
                        </Stack>

                        {selectedAdditionalCustomersQuery.isLoading ? (
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Skeleton
                              variant="rounded"
                              width={176}
                              height={28}
                            />
                            <Skeleton
                              variant="rounded"
                              width={188}
                              height={28}
                            />
                          </Stack>
                        ) : selectedAdditionalCustomers.length > 0 ? (
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            {selectedAdditionalCustomers.map((customer) => (
                              <Chip
                                key={customer.id}
                                variant="soft"
                                color="neutral"
                                onDelete={
                                  isLocked
                                    ? undefined
                                    : () =>
                                        handleRemoveAdditionalCustomer(
                                          customer.id,
                                        )
                                }
                                sx={{ maxWidth: "100%" }}
                              >
                                {customer.email
                                  ? `${customer.name} · ${customer.email}`
                                  : customer.name}
                              </Chip>
                            ))}
                          </Stack>
                        ) : (
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.600" }}
                          >
                            Direct additions are saved, but the customer
                            details are not available right now.
                          </Typography>
                        )}

                        {selectedAdditionalCustomers.length !==
                        additionalCustomerIds.length ? (
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            Some saved customer IDs are no longer available
                            in this tenant.
                          </Typography>
                        ) : null}
                      </Stack>
                    </Sheet>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </CollapsibleSection>

      <CollapsibleSection
        id="campaign-editor-content"
        title="Content"
        summary={
          campaignType === "email"
            ? hasMeaningfulEmailContent
              ? `${meaningfulEmailBlockCount} block${meaningfulEmailBlockCount === 1 ? "" : "s"}`
              : "No email blocks yet"
            : smsMessage.trim()
              ? `${smsMessage.length} characters · ${computeSmsSegments(smsMessage)} segment(s)`
              : "Message not written yet"
        }
        defaultExpanded={contentInitiallyExpanded}
      >
        {campaignType === "email" ? (
          <Stack spacing={3}>
            <JoyInput
              id="campaign-editor-subject"
              label="Subject line"
              value={subjectLine}
              disabled={isLocked}
              onValueChange={(value) => updateSetup({ subjectLine: value })}
            />
            <JoyTextarea
              label="Preview text"
              minRows={3}
              value={preheaderText}
              disabled={isLocked}
              onValueChange={(value) => updateSetup({ preheaderText: value })}
            />

            <Divider />

            <SeasonalTemplatesRow
              selectedSeason={selectedTemplateSeason}
              onSeasonChange={setSelectedTemplateSeason}
              onApply={handleApplyTemplate}
              loading={isDesignSystemLoading}
              disabled={Boolean(pendingTemplateSave)}
            />

            <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
              <JoyButton
                variant="soft"
                color="neutral"
                onClick={handleOpenStudio}
                disabled={isLocked}
              >
                Edit design in studio
              </JoyButton>
            </Box>
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
      </CollapsibleSection>

      {campaignType === "email" ? (
        <CollapsibleSection
          id="campaign-editor-preview"
          title="Preview"
          summary={previewSummary}
          defaultExpanded={previewInitiallyExpanded}
        >
          <ContentPreviewCard
            blocks={contentBlocks}
            subjectLine={subjectLine}
            previewText={preheaderText}
            designSystem={designSystem}
            loading={isDesignSystemLoading}
            onOpenStudio={handleOpenStudio}
          />
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        id="campaign-editor-schedule"
        title="Send or schedule"
        summary="Review the inline checks above and send or schedule this campaign."
        defaultExpanded={scheduleInitiallyExpanded}
      >
        <Stack spacing={2}>
          <CampaignBlockerRow
            senderUnverified={blockerSignals.senderUnverified}
            audienceEmpty={blockerSignals.audienceEmpty}
            contentEmpty={blockerSignals.contentEmpty}
            subjectEmpty={blockerSignals.subjectEmpty}
            draftConflict={blockerSignals.draftConflict}
            onVerifySender={() => setVerificationOpen(true)}
            onScrollToAudience={focusAudienceSection}
            onScrollToContent={focusContentSection}
            onScrollToSubject={focusSubjectInput}
            onReload={handleReloadDraft}
          />

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Stack spacing={0.25}>
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                {isAudienceLoading
                  ? "Calculating audience…"
                  : asCountLabel(audienceCount)}
              </Typography>
              {lastSavedAt ? (
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  Last saved {lastSavedAt.toLocaleTimeString()}
                </Typography>
              ) : null}
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                size="md"
                variant="plain"
                color="neutral"
                disabled={sendButtonDisabled}
                endDecorator={<Calendar size={16} />}
                onClick={handleScheduleForLater}
              >
                Schedule for later
              </Button>
              <Button
                size="md"
                variant="solid"
                color="primary"
                disabled={sendButtonDisabled}
                startDecorator={<Send size={16} />}
                onClick={openSendConfirmation}
              >
                Send campaign
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CollapsibleSection>

      <Modal
        open={audienceExpansionOpen}
        onClose={() => setAudienceExpansionOpen(false)}
      >
        <ModalDialog sx={{ width: "min(960px, 96vw)", maxWidth: "96vw" }}>
          <DialogTitle>Expand Your Reach</DialogTitle>
          <DialogContent>
            Extend this campaign with an explicit all-customers overlay or a
            short list of one-off direct additions.
          </DialogContent>

          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{ width: "100%" }}
            >
              <Card
                variant="outlined"
                onClick={() => setAudienceExpansionMode("all-customers")}
                sx={{
                  flex: 1,
                  cursor: "pointer",
                  borderRadius: "lg",
                  borderColor:
                    audienceExpansionMode === "all-customers"
                      ? "primary.400"
                      : "neutral.200",
                  boxShadow:
                    audienceExpansionMode === "all-customers" ? "sm" : "none",
                }}
              >
                <Stack spacing={0.75}>
                  <Typography level="title-sm" fontWeight="lg">
                    Send to All Customers
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    Union every eligible customer in this tenant into the send
                    audience while keeping your current segment and persona
                    filters intact.
                  </Typography>
                </Stack>
              </Card>

              <Card
                variant="outlined"
                onClick={() => setAudienceExpansionMode("add-customers")}
                sx={{
                  flex: 1,
                  cursor: "pointer",
                  borderRadius: "lg",
                  borderColor:
                    audienceExpansionMode === "add-customers"
                      ? "primary.400"
                      : "neutral.200",
                  boxShadow:
                    audienceExpansionMode === "add-customers" ? "sm" : "none",
                }}
              >
                <Stack spacing={0.75}>
                  <Typography level="title-sm" fontWeight="lg">
                    Add Customers to This Campaign
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    Hand-pick specific contacts for this send without changing
                    the saved segments that normally define the audience.
                  </Typography>
                </Stack>
              </Card>
            </Stack>

            {audienceExpansionMode === "all-customers" ? (
              <Card
                variant="soft"
                color="primary"
                sx={{ borderRadius: "lg", p: 2.25 }}
              >
                <Stack spacing={1.25}>
                  <Checkbox
                    checked={draftIncludeAllCustomers}
                    disabled={isLocked}
                    label="Include all eligible customers in this email send"
                    onChange={(event) =>
                      setDraftIncludeAllCustomers(event.target.checked)
                    }
                  />
                  <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                    This setting is additive. Your segments, personas, and any
                    direct customer additions remain attached to the campaign,
                    and the send worker unions them at delivery time.
                  </Typography>
                  {draftAdditionalCustomerIds.length > 0 ? (
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      {draftAdditionalCustomerIds.length} direct customer
                      {draftAdditionalCustomerIds.length === 1
                        ? " is"
                        : "s are"}{" "}
                      also attached to this campaign.
                    </Typography>
                  ) : null}
                </Stack>
              </Card>
            ) : (
              <Stack spacing={1.5}>
                <JoyInput
                  label="Search customers"
                  value={audienceCustomerSearch}
                  placeholder="Search name, email, or phone"
                  onValueChange={(value) => {
                    setAudienceCustomerSearch(value);
                    setAudienceCustomerPage(1);
                  }}
                />

                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "lg", p: 1.5 }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Typography level="body-sm" fontWeight="lg">
                      {draftAdditionalCustomerIds.length} direct customer
                      {draftAdditionalCustomerIds.length === 1 ? "" : "s"}{" "}
                      selected
                    </Typography>
                    {draftAdditionalCustomerIds.length > 0 ? (
                      <Button
                        size="sm"
                        variant="plain"
                        color="neutral"
                        disabled={isLocked}
                        onClick={() => setDraftAdditionalCustomerIds([])}
                      >
                        Clear selection
                      </Button>
                    ) : null}
                  </Stack>
                </Sheet>

                <Sheet
                  variant="outlined"
                  sx={{ borderRadius: "lg", overflow: "hidden" }}
                >
                  {audienceCustomersLoading ? (
                    <Stack spacing={1.25} sx={{ p: 2 }}>
                      <Skeleton variant="rounded" height={42} />
                      <Skeleton variant="rounded" height={42} />
                      <Skeleton variant="rounded" height={42} />
                    </Stack>
                  ) : audienceCustomerOptions.length > 0 ? (
                    <>
                      <JoyTable>
                        <JoyTableHead>
                          <JoyTableRow>
                            <JoyTableHeaderCell sx={{ width: 56 }}>
                              Select
                            </JoyTableHeaderCell>
                            <JoyTableHeaderCell>Customer</JoyTableHeaderCell>
                            <JoyTableHeaderCell>Email</JoyTableHeaderCell>
                            <JoyTableHeaderCell>Segments</JoyTableHeaderCell>
                          </JoyTableRow>
                        </JoyTableHead>
                        <JoyTableBody>
                          {audienceCustomerOptions.map((customer) => {
                            const selected =
                              draftAdditionalCustomerIds.includes(customer.id);

                            return (
                              <JoyTableRow
                                key={customer.id}
                                clickable={customer.hasEmail && !isLocked}
                                onClick={() => {
                                  if (customer.hasEmail && !isLocked) {
                                    toggleDraftAdditionalCustomer(customer.id);
                                  }
                                }}
                              >
                                <JoyTableCell>
                                  <Checkbox
                                    checked={selected}
                                    disabled={!customer.hasEmail || isLocked}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={() =>
                                      toggleDraftAdditionalCustomer(customer.id)
                                    }
                                  />
                                </JoyTableCell>
                                <JoyTableCell>
                                  <Stack spacing={0.25}>
                                    <Typography level="body-sm" fontWeight="lg">
                                      {customer.name}
                                    </Typography>
                                    {!customer.hasEmail ? (
                                      <Typography
                                        level="body-xs"
                                        sx={{ color: "warning.700" }}
                                      >
                                        Cannot add this customer until an email
                                        address is present.
                                      </Typography>
                                    ) : null}
                                  </Stack>
                                </JoyTableCell>
                                <JoyTableCell>
                                  <Typography
                                    level="body-sm"
                                    sx={{
                                      color: customer.email
                                        ? "neutral.700"
                                        : "neutral.400",
                                    }}
                                  >
                                    {customer.email || "No email"}
                                  </Typography>
                                </JoyTableCell>
                                <JoyTableCell>
                                  <Typography
                                    level="body-sm"
                                    sx={{ color: "neutral.600" }}
                                  >
                                    {customer.segmentNames.length > 0
                                      ? customer.segmentNames.join(", ")
                                      : "No segments yet"}
                                  </Typography>
                                </JoyTableCell>
                              </JoyTableRow>
                            );
                          })}
                        </JoyTableBody>
                      </JoyTable>

                      <JoyTablePagination
                        page={audienceCustomerPage}
                        pageSize={AUDIENCE_CUSTOMER_PAGE_SIZE}
                        totalCount={audienceCustomerTotalCount}
                        onPageChange={setAudienceCustomerPage}
                      />
                    </>
                  ) : (
                    <Box sx={{ p: 2.5 }}>
                      <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                        No customers matched this search.
                      </Typography>
                    </Box>
                  )}
                </Sheet>
              </Stack>
            )}
          </Stack>

          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setAudienceExpansionOpen(false)}
            >
              Cancel
            </Button>
            <JoyButton
              onClick={handleSaveAudienceExpansion}
              disabled={isLocked}
            >
              Save audience expansion
            </JoyButton>
          </DialogActions>
        </ModalDialog>
      </Modal>

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
