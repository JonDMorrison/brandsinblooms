import { useCampaignTemplateLock } from "@/hooks/useCampaignTemplateLock";
import {
  buildCampaignOrigin,
  getCampaignOriginKind,
  normalizeCampaignOrigin,
} from "@/lib/crm/campaignOrigin";
import type { ThemeGenerationNavigationState } from "@/hooks/useStartThemeNewsletter";
import { useThisWeeksTheme } from "@/hooks/useThisWeeksTheme";
import {
  buildNewsletterIdeaDraftSeed,
  originForNewsletterIdea,
} from "@/lib/studio/newsletterIdeaSeed";
import { EmptyBlocksNotice } from "@/components/crm/campaign-editor/EmptyBlocksNotice";
import { CRM_COPY } from "@/lib/crm/copy";
import { findIdentityMismatchDetails } from "@/lib/crm/identityConsistency";
import {
  MISSING_POSTAL_ADDRESS_MESSAGE,
  resolveFooterPostalAddress,
} from "@/lib/studio/businessPlaceholders";
import { hasContentBlocks } from "@/lib/studio/emailHtmlGenerator";
import { deriveCampaignDisplayName, isUnsetCampaignName } from "@/lib/crm/campaignDisplayName";
import { CampaignOrganization } from "@/components/crm/campaigns/CampaignOrganization";
import { reviewConnectedEvents } from "@/lib/connectedContent";
import { reviewCampaignContent } from "@/lib/crm/campaignContentReview";
import { resolveStudioDraftId } from "@/lib/crm/studioEntry";
import * as React from "react";
import { flushSync } from "react-dom";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
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
  AlertCircle,
  Info,
  ArrowLeft,
  CalendarClock,
  Palette,
  Send,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { CampaignActiveSendView } from "@/components/crm/campaign-editor/CampaignActiveSendView";
import { ContentPreviewCard } from "@/components/crm/campaign-editor/ContentPreviewCard";
import {
  CampaignEditorProvider,
  useCampaignEditor,
} from "@/components/crm/campaign-editor/CampaignEditorContext";
import { CampaignLockedView } from "@/components/crm/campaign-editor/CampaignLockedView";
import { CampaignScheduleDrawer } from "@/components/crm/campaign-editor/CampaignScheduleDrawer";
import { CampaignSendConfirmation } from "@/components/crm/campaign-editor/CampaignSendConfirmation";
import {
  formatPlaceholderFindings,
  scanBlocksForPlaceholders,
  scanSubjectForUnrenderedTokens,
} from "@/lib/crm/placeholderScan";
import {
  CampaignEditorStep,
  type CampaignStepState,
} from "@/components/crm/campaign-editor/CampaignEditorStep";
import {
  CampaignReadinessBar,
  type CampaignReadinessBlocker,
} from "@/components/crm/campaign-editor/CampaignReadinessBar";
import { CampaignDesignSummary } from "@/components/crm/campaign-editor/CampaignDesignSummary";
import { CampaignLivePreview } from "@/components/crm/campaign-editor/CampaignLivePreview";
import { CampaignSenderStep } from "@/components/crm/campaign-editor/CampaignSenderStep";
import {
  campaignEditorFocusOutline,
  campaignEditorPageSx,
} from "@/components/crm/campaign-editor/campaignEditorTheme";
import StudioPreviewDialog from "@/components/crm/studio/StudioPreviewDialog";
import { useCampaignOrganization } from "@/lib/crm/campaignOrganization";
import { NewsletterInboxReview } from "@/components/crm/campaign-editor/NewsletterInboxReview";
import { IntentPicker } from "@/components/crm/campaign-editor/IntentPicker";
import { ManageTemplatesModal } from "@/components/crm/campaign-editor/ManageTemplatesModal";
import { SaveAsTemplateModal } from "@/components/crm/campaign-editor/SaveAsTemplateModal";
import { SegmentsAudienceSelect } from "@/components/crm/campaign-editor/SegmentsAudienceSelect";
import { SenderConfigModal } from "@/components/crm/campaign-editor/SenderConfigModal";
import { SenderVerificationDialog } from "@/components/crm/campaign-editor/SenderVerificationDialog";
import {
  useSavedTemplates,
  type SavedTemplate,
} from "@/hooks/useSavedTemplates";
import { createStudioBlock } from "@/lib/studio/blockFactory";
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
import { usePersonaTargetingAvailable } from "@/hooks/usePersonaTargetingAvailable";
import {
  DesignSystemProvider,
  useDesignSystem,
} from "@/contexts/DesignSystemContext";
import { useEmailDomains } from "@/hooks/useEmailDomains";
import { useCustomers } from "@/hooks/useCustomers";
import { classifySender } from "@/lib/crm/senderSeverity";
import type { SenderClassification } from "@/lib/crm/senderSeverity";
import { useTenant } from "@/hooks/useTenant";
import { useUserRole } from "@/hooks/useUserRole";
import {
  CHECKING_AUDIENCE_LABEL,
  NO_ELIGIBLE_RECIPIENTS_MESSAGE,
  useCampaignEmailEligibility,
} from "@/hooks/useCampaignEmailEligibility";
import { supabase } from "@/integrations/supabase/client";
import {
  applyCampaignTemplate,
  CAMPAIGN_TEMPLATES,
  EDITOR_TEMPLATE_ACCENT_COLOR,
  getTemplateForIntent,
  type CampaignIntentKey,
  type CampaignTemplate,
} from "@/lib/studio/campaignTemplates";
import type {
  CampaignPersonaSummary,
  CampaignSegmentSummary,
} from "@/lib/crm/campaignEditor";
import { buildCampaignFocus } from "@/utils/askBloomContextBuilders";
import { registerResourceAccessor } from "@/utils/askBloomResourceRegistry";

/** Marks the synthetic template built from this week's theme. */
const WEEKLY_THEME_TEMPLATE_PREFIX = "weekly-theme:";
/** "Start over with a blank newsletter", sent through the same replace confirmation. */
const BLANK_TEMPLATE_ID = "blank";
// Where the business postal address is set (Contact & Footer settings).
const BUSINESS_ADDRESS_SETTINGS_PATH = "/profile/contact-footer";

const EDITOR_MAX_WIDTH = 1360;

/** The editor's steps, in the order they are shown. */
type EditorStepKey = "content" | "inbox" | "audience" | "sender" | "organize";

/** Each send-check section id, and the step that holds it. */
const STEP_FOR_SECTION: Record<string, EditorStepKey> = {
  "campaign-editor-content": "content",
  "campaign-editor-inbox": "inbox",
  "campaign-editor-audience": "audience",
  "campaign-editor-sender": "sender",
  "campaign-editor-organize": "organize",
};

/** The field to focus when a step is opened to fix it. */
const FOCUS_FIELD_FOR_SECTION: Record<string, string> = {
  "campaign-editor-inbox": "campaign-editor-subject",
  "campaign-editor-sender": "campaign-editor-sender-email",
};

/** ?section= values from links elsewhere in the app, and their step. */
const SECTION_PARAM_TARGETS: Record<string, string> = {
  setup: "campaign-editor-sender",
  sender: "campaign-editor-sender",
  design: "campaign-editor-content",
  content: "campaign-editor-content",
  inbox: "campaign-editor-inbox",
  audience: "campaign-editor-audience",
  organize: "campaign-editor-organize",
  actions: "campaign-editor-actions",
};

function formatSavedTime(value: Date) {
  const sameDay = value.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    undefined,
    sameDay ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" },
  ).format(value);
}
const AUDIENCE_CUSTOMER_PAGE_SIZE = 8;
// Soft limit for the preview-text counter. Inboxes typically clip
// preview text around 90-150 characters; we surface the warning
// above 150 but still allow typing — some clients show more.
const PREVIEW_TEXT_SOFT_LIMIT = 150;

type AudienceExpansionMode = "all-customers" | "add-customers";

type AudienceCustomerRecord = {
  id: string;
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
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
    parts.push("All Contacts");
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

  return parts.length > 0 ? parts.join(" · ") : "No audience selected";
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
              <Skeleton variant="rectangular" width={64} height={24} />
              <Skeleton variant="rectangular" width={54} height={24} />
              <Skeleton variant="rectangular" width={96} height={24} />
              <Skeleton variant="text" width={118} />
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Skeleton variant="rectangular" width={118} height={40} />
            <Skeleton variant="rectangular" width={150} height={40} />
          </Stack>
        </Stack>
      </Stack>

      <LoadingSectionCard
        endDecorator={<Skeleton variant="rectangular" width={104} height={28} />}
      >
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={44} />
          <Skeleton variant="rectangular" height={44} />
          <Skeleton variant="rectangular" height={76} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Skeleton variant="rectangular" height={44} sx={{ flex: 1 }} />
            <Skeleton variant="rectangular" height={44} sx={{ flex: 1 }} />
          </Stack>
          <Skeleton variant="rectangular" height={44} />
        </Stack>
      </LoadingSectionCard>

      <LoadingSectionCard>
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={44} />
          <Skeleton variant="rectangular" height={44} />
          <Card variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
            <Stack spacing={0.5}>
              <Skeleton variant="text" width="28%" />
              <Skeleton variant="text" width="46%" />
            </Stack>
          </Card>
        </Stack>
      </LoadingSectionCard>

      <LoadingSectionCard
        endDecorator={<Skeleton variant="rectangular" width={112} height={28} />}
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
                    <Skeleton variant="rectangular" width={60} height={20} />
                    <Skeleton variant="rectangular" width={70} height={20} />
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
                  <Skeleton variant="rectangular" width={86} height={24} />
                  <Skeleton variant="rectangular" width={112} height={24} />
                  <Skeleton variant="rectangular" width={96} height={24} />
                </Stack>
              </Stack>
              <Skeleton variant="rectangular" width={170} height={40} />
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
            <Skeleton variant="rectangular" width={84} height={24} />
            <Skeleton variant="rectangular" width={90} height={24} />
            <Skeleton variant="rectangular" width={96} height={24} />
          </Stack>
        }
      >
        <Box>
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "lg",
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
                  sx={{ width: 64, height: 22, borderRadius: "md" }}
                />
              </Box>
            ))}
          </Sheet>

          <Skeleton
            variant="rectangular"
            sx={{ width: "100%", height: 44, borderRadius: "lg", mt: 2 }}
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
              sx={{ width: 240, height: 48, borderRadius: "lg" }}
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
  const [processParams, setProcessParams] = useSearchParams();
  const reviewingNewsletter = processParams.get("step") === "review";
  const { tenant } = useTenant();
  const { hasPermission } = useUserRole();
  const canSendCampaign = hasPermission("campaigns.send");
  const {
    emailDomains,
    loading: emailDomainsLoading,
    refetch: refetchEmailDomains,
  } = useEmailDomains();
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
    origin,
    isDirty,
    lastSavedAt,
    autoSaveStatus,
    autoSaveMessage,
    updateSetup,
    updateAudience,
    updateContent,
    updateSchedule,
    saveDraft,
    setOrigin,
    isTenantReady,
  } = useCampaignEditor();

  // Email eligibility comes from one server function (the send worker's rule).
  // Every surface below reads this query; none of them recounts.
  const eligibilitySegmentIds = React.useMemo(
    () => selectedSegments.map((segment) => segment.id),
    [selectedSegments],
  );
  const eligibilityPersonaIds = React.useMemo(
    () => selectedPersonas.map((persona) => persona.id),
    [selectedPersonas],
  );
  const eligibilityQuery = useCampaignEmailEligibility({
    tenantId: tenant?.id,
    includeAllCustomers,
    additionalCustomerIds,
    segmentIds: eligibilitySegmentIds,
    personaIds: eligibilityPersonaIds,
    enabled: campaignType === "email",
  });
  const eligibility = eligibilityQuery.data;
  const emailGate = campaignType === "email" ? eligibilityQuery.gate : null;
  const eligibilityChecking = emailGate === "checking";

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = React.useState(false);
  const [connectedEventWarnings, setConnectedEventWarnings] = React.useState<string[]>([]);
  const [connectedEventChecking, setConnectedEventChecking] = React.useState(false);
  const [verificationOpen, setVerificationOpen] = React.useState(false);
  const [senderConfigOpen, setSenderConfigOpen] = React.useState(false);
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
  const [templateToConfirm, setTemplateToConfirm] =
    React.useState<CampaignTemplate | null>(null);
  const [selectedIntent, setSelectedIntent] =
    React.useState<CampaignIntentKey | null>(null);
  const [selectedBuiltInTemplateId, setSelectedBuiltInTemplateId] =
    React.useState<string | null>(null);
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = React.useState<
    string | null
  >(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false);
  const [manageTemplatesOpen, setManageTemplatesOpen] = React.useState(false);
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
  // CASL and CAN-SPAM require a postal address in every marketing email:
  // the footer's own address, else the business profile's. Unknown while
  // the business profile loads, so nothing is flagged until it has.
  const missingPostalAddress = React.useMemo(() => {
    if (campaignType !== "email" || isDesignSystemLoading) return false;
    const footer = contentBlocks.find((block) => block.type === "footer");
    if (!footer) return false;
    return !resolveFooterPostalAddress(
      footer.address,
      designSystem.company.addressLines || designSystem.company.address,
    );
  }, [campaignType, contentBlocks, designSystem, isDesignSystemLoading]);

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
        .is("deleted_at", null)
        .in("status", ["active", "draft", "paused"])
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

  // "Also target by persona" only when some customer belongs to a persona
  // (no persona-assignment job runs today, so system personas are empty).
  const personaTargeting = usePersonaTargetingAvailable(tenant?.id);
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
  // The step summary shows the server's eligible count, never the raw audience.
  const emailAudienceSummary = eligibility?.audienceConfigured
    ? `${audienceDetail} · ${eligibility.eligible.toLocaleString()} can receive email`
    : emailGate === "checking" && audienceDetail !== "No audience selected"
      ? `${audienceDetail} · ${CHECKING_AUDIENCE_LABEL}`
      : audienceDetail;

  const buildCampaignResourceFocus = React.useCallback(() => {
    if (!campaignId) {
      throw new Error(
        "Campaign focus is unavailable until the draft is saved.",
      );
    }

    return buildCampaignFocus(
      {
        id: campaignId,
        name,
        type: campaignType,
        status,
        subject: subjectLine,
        preview_text: preheaderText,
      },
      undefined,
      {
        segment_name: selectedSegments[0]?.name ?? null,
        projected_recipient_count: audienceCount,
      },
    );
  }, [
    audienceCount,
    campaignId,
    campaignType,
    name,
    preheaderText,
    selectedSegments,
    status,
    subjectLine,
  ]);

  React.useEffect(() => {
    if (!campaignId) {
      return;
    }

    return registerResourceAccessor("campaign", {
      getResourceFocus: (resourceId) => {
        if (resourceId !== campaignId) {
          return null;
        }

        return buildCampaignResourceFocus();
      },
    });
  }, [buildCampaignResourceFocus, campaignId]);

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

  // Steps open as they did before the redesign: design first for a new
  // email, audience first when someone arrives to review and send. Captured
  // once the draft has loaded; the person's own toggles win afterwards.
  const stepDefaultsRef = React.useRef<Record<EditorStepKey, boolean> | null>(null);
  if (!isLoading && !stepDefaultsRef.current) {
    stepDefaultsRef.current = {
      content: !reviewingNewsletter,
      inbox: true,
      audience: campaignType !== "email" || reviewingNewsletter,
      sender: !senderEmail.trim(),
      organize: false,
    };
  }
  const [stepOverrides, setStepOverrides] = React.useState<
    Partial<Record<EditorStepKey, boolean>>
  >({});
  const isStepExpanded = (step: EditorStepKey) =>
    stepOverrides[step] ?? stepDefaultsRef.current?.[step] ?? false;
  const setStepExpanded = React.useCallback(
    (step: EditorStepKey, expanded: boolean) =>
      setStepOverrides((current) => ({ ...current, [step]: expanded })),
    [],
  );

  /**
   * Opens the step that holds a section, scrolls to it and moves focus to the
   * field that fixes it (or the step's first control).
   */
  const openEditorSection = React.useCallback((sectionId: string) => {
    const step = STEP_FOR_SECTION[sectionId];
    if (step) {
      flushSync(() => setStepExpanded(step, true));
    }
    const target = document.getElementById(sectionId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    const fieldId = FOCUS_FIELD_FOR_SECTION[sectionId];
    const field = fieldId ? document.getElementById(fieldId) : null;
    const focusTarget =
      field ??
      target?.querySelector<HTMLElement>(
        `#${sectionId}-body :is(input, textarea, select, button, a[href], [tabindex="0"]):not([disabled])`,
      ) ??
      target?.querySelector<HTMLElement>("[data-campaign-step-toggle]") ??
      target;
    focusTarget?.focus({ preventScroll: true });
  }, [setStepExpanded]);

  const handleReloadDraft = React.useCallback(() => {
    window.location.reload();
  }, []);

  const openStudio = React.useCallback(async (navigationState?: ThemeGenerationNavigationState) => {
    if (campaignType !== "email") {
      return;
    }

    // Until the company is known, a save would fall back to the signed-in
    // user's own company (wrong for admins working in a client account, and
    // refused by the server). The card stays disabled until then.
    if (!isTenantReady) {
      return;
    }

    // Drafts can be created with no subject or preview. Those fields are
    // checked only when the customer reviews or sends the newsletter.
    const nextCampaignId =
      isLocked && campaignId
        ? campaignId
        : await resolveStudioDraftId(null, () => saveDraft({ silent: true }));

    if (!nextCampaignId) {
      toast.error(
        "Could not create your newsletter draft. Check your connection and try Design Studio again. Your content has not been discarded.",
      );
      return;
    }

    navigate(
      `/crm/campaigns/${nextCampaignId}/studio`,
      navigationState ? { state: navigationState } : undefined,
    );
  }, [campaignId, campaignType, isLocked, isTenantReady, navigate, saveDraft]);
  const handleOpenStudio = React.useCallback(() => openStudio(), [openStudio]);

  const handleScheduleForLater = React.useCallback(() => {
    setScheduleOpen(true);
  }, []);

  const openSendConfirmation = React.useCallback(() => {
    if (isLocked || pendingTemplateSave) {
      return;
    }

    setConnectedEventChecking(campaignType === "email" && contentBlocks.some(block => block.visible !== false && block.connectedContent?.type === "event"));
    setSendConfirmOpen(true);
  }, [isLocked, pendingTemplateSave, campaignType, contentBlocks]);

  React.useEffect(() => {
    if (isLoading) return;
    const section = processParams.get("section");
    const targetId = section ? SECTION_PARAM_TARGETS[section] : undefined;
    if (!targetId) return;
    const frame = requestAnimationFrame(() => {
      if (targetId === "campaign-editor-actions") {
        document.getElementById(targetId)?.scrollIntoView({ block: "start" });
        return;
      }
      openEditorSection(targetId);
    });
    return () => cancelAnimationFrame(frame);
  }, [isLoading, openEditorSection, processParams]);

  React.useEffect(() => {
    const action = processParams.get("action");
    if (isLoading || !action || isLocked || !canSendCampaign || pendingTemplateSave) return;
    if (action !== "schedule" && action !== "send") return;
    const nextParams = new URLSearchParams(processParams);
    nextParams.delete("action");
    setProcessParams(nextParams, { replace: true });
    if (action === "schedule") setScheduleOpen(true);
    else {
      updateSchedule({ sendImmediately: true, sendAt: null });
      openSendConfirmation();
    }
  }, [isLoading, isLocked, canSendCampaign, pendingTemplateSave, processParams, setProcessParams, updateSchedule, openSendConfirmation]);

  // Every blocker names the section that fixes it, so the checklist can
  // jump straight there. A campaign name is optional (#8) and not a blocker.
  const sendBlockers = React.useMemo(() => {
    const blockers: CampaignReadinessBlocker[] = [];

    if (campaignType === "email" && !subjectLine.trim()) {
      blockers.push({ message: "Subject line is required.", section: "campaign-editor-inbox", fixLabel: "Add a subject line" });
    }

    if (campaignType === "email" && meaningfulEmailBlockCount === 0) {
      blockers.push({ message: "At least one content block is required before sending.", section: "campaign-editor-content", fixLabel: "Design your newsletter" });
    }

    if (campaignType === "email" && !hasComplianceFooter) {
      blockers.push({ message: "A compliance footer is required before sending.", section: "campaign-editor-content", fixLabel: "Add the footer" });
    }

    if (missingPostalAddress) {
      blockers.push({
        message: MISSING_POSTAL_ADDRESS_MESSAGE,
        section: null,
        fixLabel: "Add your business address",
        href: BUSINESS_ADDRESS_SETTINGS_PATH,
        inlineLink: true,
      });
    }

    if (campaignType === "sms" && !smsMessage.trim()) {
      blockers.push({ message: "SMS message is required before sending.", section: "campaign-editor-content", fixLabel: "Write the message" });
    }

    // Hard sender blockers (paused/failed/no-sender/domain-not-registered).
    // The classifier produces the user-facing copy, so the send dialog and
    // this checklist show the same reason.
    if (campaignType === "email" && senderClassification.status === "blocked") {
      blockers.push({ message: senderClassification.message, section: "campaign-editor-sender", fixLabel: "Fix the sender" });
    } else if (!senderEmail.trim()) {
      blockers.push({ message: "Sender email is required.", section: "campaign-editor-sender", fixLabel: "Add a sender" });
    }

    if (
      !includeAllCustomers &&
      selectedSegments.length === 0 &&
      selectedPersonas.length === 0 &&
      additionalCustomerIds.length === 0
    ) {
      blockers.push({ message: "Choose an audience before sending.", section: "campaign-editor-audience", fixLabel: "Choose an audience" });
    } else if (campaignType === "email") {
      // Email: only the server eligibility check decides. While it runs the
      // send controls say "Checking audience" instead of listing a blocker.
      if (emailGate === "none") {
        blockers.push({ message: NO_ELIGIBLE_RECIPIENTS_MESSAGE, section: "campaign-editor-audience", fixLabel: "Go to Audience", inlineLink: true });
      } else if (emailGate === "error") {
        blockers.push({ message: "We couldn't check who can receive this email. Try again in a moment.", section: "campaign-editor-audience", fixLabel: "Go to Audience", inlineLink: true });
      }
    } else if ((audienceCount ?? 0) <= 0) {
      blockers.push({ message: "At least one eligible recipient is required.", section: "campaign-editor-audience", fixLabel: "Change the audience" });
    }

    if (autoSaveStatus === "conflict") {
      blockers.push({ message: "Resolve the draft conflict before sending.", section: null, fixLabel: "" });
    }

    if (autoSaveStatus === "failed") {
      blockers.push({ message: "Draft changes must save successfully before sending.", section: null, fixLabel: "" });
    }

    if (sendBlockedReason) {
      blockers.push({ message: formatStatusLabel(sendBlockedReason), section: null, fixLabel: "" });
    }

    return blockers;
  }, [
    audienceCount,
    emailGate,
    additionalCustomerIds,
    includeAllCustomers,
    selectedSegments,
    selectedPersonas,
    autoSaveStatus,
    campaignType,
    hasComplianceFooter,
    meaningfulEmailBlockCount,
    missingPostalAddress,
    senderClassification,
    senderEmail,
    sendBlockedReason,
    smsMessage,
    subjectLine,
  ]);
  const sendBlockerLines = React.useMemo(
    () => sendBlockers.map((blocker) => blocker.message),
    [sendBlockers],
  );

  const identityMismatchDetails = React.useMemo(() => {
    const footer = contentBlocks.find((block) => block.type === "footer");
    const website = contentBlocks
      .map((block) => block.connectedContent)
      .find((source) => source?.publicUrl || source?.siteName);
    return findIdentityMismatchDetails({
      senderName,
      senderEmail,
      // A footer with no name is "", which the check reports as a mismatch.
      footerBusinessName: footer ? (footer.businessName ?? "") : undefined,
      websiteName: website?.siteName,
      websiteUrl: website?.publicUrl,
    });
  }, [contentBlocks, senderEmail, senderName]);
  const identityMismatches = React.useMemo(
    () => identityMismatchDetails.map((mismatch) => mismatch.message),
    [identityMismatchDetails],
  );

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

    // Identity check (#15): warn, never block.
    if (campaignType === "email") {
      warnings.push(...identityMismatches);
    }

    return warnings;
  }, [autoSaveStatus, campaignType, identityMismatches, senderClassification, senderEmail]);

  // Pre-send placeholder scan (Flowerhouse scaffold-send incident):
  // detect template scaffold headings and editorial notes in the content
  // blocks so the send confirmation can require an explicit acknowledgment
  // before emailing likely-unfinished content to real customers. Soft
  // warning, never a hard block — false positives are possible.
  const contentReviewIssues = React.useMemo(
    () => reviewCampaignContent(contentBlocks),
    [contentBlocks],
  );
  React.useEffect(() => {
    if (!sendConfirmOpen || campaignType !== "email") {
      setConnectedEventWarnings([]);
      setConnectedEventChecking(false);
      return;
    }
    if (!contentBlocks.some(block => block.visible !== false && block.connectedContent?.type === "event")) {
      setConnectedEventWarnings([]);
      setConnectedEventChecking(false);
      return;
    }
    let active = true;
    setConnectedEventWarnings([]);
    setConnectedEventChecking(true);
    void reviewConnectedEvents(contentBlocks).then(warnings => {
      if (active) { setConnectedEventWarnings(warnings); setConnectedEventChecking(false); }
    }).catch(() => {
      if (active) { setConnectedEventWarnings(["Linked website events could not be checked. Review them before sending."]); setConnectedEventChecking(false); }
    });
    return () => { active = false; };
  }, [sendConfirmOpen, campaignType, contentBlocks]);
  const placeholderWarningLines = React.useMemo(
    () =>
      campaignType === "email"
        ? [
            ...formatPlaceholderFindings(
              scanBlocksForPlaceholders(contentBlocks),
            ),
            // Malformed {{ }} tokens in the subject line pass through the
            // send-time merge engine untouched and reach every recipient
            // literally. Well-formed tokens render per-recipient and are
            // not flagged.
            ...scanSubjectForUnrenderedTokens(subjectLine),
            ...contentReviewIssues.map((issue) => issue.message),
            ...connectedEventWarnings,
          ]
        : [],
    [campaignType, contentBlocks, subjectLine, contentReviewIssues, connectedEventWarnings],
  );

  // Schedule and Send share one gate. For email it waits for the server
  // eligibility check and stays shut when nobody can receive the email.
  const sendControlsDisabled =
    !canSendCampaign ||
    sendBlockers.length > 0 ||
    isLocked ||
    eligibilityChecking ||
    (campaignType === "sms" && isAudienceLoading) ||
    Boolean(pendingTemplateSave);

  const footerBlock = React.useMemo(
    () => contentBlocks.find((block) => block.type === "footer") ?? null,
    [contentBlocks],
  );
  // Same edit Design Studio makes: a typed name is kept, never refilled from
  // the account. It goes through updateContent, so autosave runs as usual.
  const handleFooterBusinessNameChange = React.useCallback(
    (value: string) => {
      updateContent({
        contentBlocks: contentBlocks.map((block) =>
          block.type === "footer"
            ? { ...block, businessName: value, businessNameSource: "custom" as const }
            : block,
        ),
      });
    },
    [contentBlocks, updateContent],
  );

  const organization = useCampaignOrganization(tenant?.id);
  const campaignGroups = React.useMemo(() => {
    if (!campaignId || !organization.data) return [];
    const memberGroupIds = new Set(
      organization.data.memberships
        .filter((membership) => membership.campaign_id === campaignId)
        .map((membership) => membership.group_id),
    );
    return organization.data.groups.filter((group) => memberGroupIds.has(group.id));
  }, [campaignId, organization.data]);

  const [designPickerOpen, setDesignPickerOpen] = React.useState(false);
  const [testSendOpen, setTestSendOpen] = React.useState(false);

  // The sticky header's height, so steps scroll to just below it and the
  // preview column sticks under it.
  const headerRef = React.useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = React.useState(120);
  React.useLayoutEffect(() => {
    const node = headerRef.current;
    if (!node) return;
    const measure = () => setHeaderHeight(Math.round(node.getBoundingClientRect().height) || 120);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoading]);

  // Steps are numbered in the order shown; SMS has no subject step.
  const stepNumber = React.useMemo(() => {
    const order: EditorStepKey[] = [
      "content",
      ...(campaignType === "email" ? (["inbox"] as const) : []),
      "audience",
      "sender",
      "organize",
    ];
    return Object.fromEntries(order.map((key, index) => [key, index + 1])) as Record<
      EditorStepKey,
      number
    >;
  }, [campaignType]);

  // Persona disclosure auto-expands when the campaign already has
  // personas saved on load (#2 of the spec), but the toggle state is
  // user-controlled afterwards.
  const [personaDisclosureOpen, setPersonaDisclosureOpen] = React.useState(
    selectedPersonas.length > 0,
  );

  // Step badges come from the same field values and send checks as the
  // readiness bar; nothing here adds a new check.
  const stepStates = React.useMemo<Record<EditorStepKey, CampaignStepState>>(() => {
    const issuesIn = (section: string) =>
      sendBlockers.filter((blocker) => blocker.section === section).length;
    const withIssues = (count: number): CampaignStepState =>
      count > 0 ? { kind: "attention", count } : { kind: "done" };
    const noAudience =
      !includeAllCustomers &&
      selectedSegments.length === 0 &&
      selectedPersonas.length === 0 &&
      additionalCustomerIds.length === 0;
    const senderIssues =
      campaignType === "email"
        ? (senderClassification.status !== "ready" ? 1 : 0) + identityMismatchDetails.length
        : issuesIn("campaign-editor-sender");
    return {
      content:
        campaignType === "email"
          ? !hasMeaningfulEmailContent
            ? { kind: "required" }
            : withIssues(issuesIn("campaign-editor-content"))
          : !smsMessage.trim()
            ? { kind: "required" }
            : { kind: "done" },
      inbox: !subjectLine.trim()
        ? { kind: "required" }
        : withIssues(scanSubjectForUnrenderedTokens(subjectLine).length),
      audience: noAudience
        ? { kind: "required" }
        : campaignType === "email"
          ? eligibilityChecking
            ? { kind: "checking", label: CHECKING_AUDIENCE_LABEL }
            : withIssues(issuesIn("campaign-editor-audience"))
          : withIssues(isAudienceLoading ? 0 : issuesIn("campaign-editor-audience")),
      sender: !senderEmail.trim() ? { kind: "required" } : withIssues(senderIssues),
      organize: campaignGroups.length > 0 ? { kind: "done" } : { kind: "optional" },
    };
  }, [
    additionalCustomerIds.length,
    campaignGroups.length,
    campaignType,
    eligibilityChecking,
    hasMeaningfulEmailContent,
    identityMismatchDetails.length,
    includeAllCustomers,
    isAudienceLoading,
    selectedPersonas.length,
    selectedSegments.length,
    sendBlockers,
    senderClassification.status,
    senderEmail,
    smsMessage,
    subjectLine,
  ]);

  const senderSummary = React.useMemo(() => {
    const name = senderName.trim();
    const email = senderEmail.trim();
    if (!email) return "No sender yet";
    return name ? `From ${name} <${email}>` : `From ${email}`;
  }, [senderEmail, senderName]);

  const showActiveSendView =
    isQueuedCampaignStatus(status) || status === CAMPAIGN_STATUS.SENDING;
  const showLockedView =
    !showActiveSendView && status !== CAMPAIGN_STATUS.DRAFT;

  // An email started from a locked design is held to it. The database takes
  // the lock when the saved email names the template, then enforces it on
  // every later save. This only records the name once the email exists.
  const lockedTemplateToRecordRef = React.useRef<string | null>(null);
  const templateLock = useCampaignTemplateLock(campaignId);
  const recordTemplateLock = templateLock.record;
  React.useEffect(() => {
    const templateId = lockedTemplateToRecordRef.current;
    if (!campaignId || !templateId || isSaving) return;
    let cancelled = false;
    // The email gets its id before its first save. Keep the template noted
    // until the write lands, and try again after each save.
    void recordTemplateLock(templateId).then((recorded) => {
      if (recorded && !cancelled && lockedTemplateToRecordRef.current === templateId) {
        lockedTemplateToRecordRef.current = null;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, isSaving, recordTemplateLock, contentBlocks, lastSavedAt]);

  const applyTemplateToCampaign = React.useCallback(
    (template: CampaignTemplate) => {
      if (template.id === BLANK_TEMPLATE_ID) {
        setOrigin("blank");
        setSelectedBuiltInTemplateId(null);
        setSelectedIntent("blank");
        setSelectedSavedTemplateId(null);
        setWeeklyThemeApplied(false);
        updateContent({ contentBlocks: template.buildBlocks(designSystem) });
        return;
      }
      const appliedSaved = template.id.startsWith("saved:")
        ? savedTemplates.find((item) => item.id === template.id.slice(6))
        : undefined;
      lockedTemplateToRecordRef.current = appliedSaved?.isLocked ? appliedSaved.id : null;
      setOrigin(
        template.id.startsWith(WEEKLY_THEME_TEMPLATE_PREFIX)
          ? (normalizeCampaignOrigin(
              template.id.slice(WEEKLY_THEME_TEMPLATE_PREFIX.length),
            ) ?? buildCampaignOrigin("weekly_theme"))
          : template.id.startsWith("saved:")
            ? buildCampaignOrigin("saved_template", template.id.slice(6))
            : buildCampaignOrigin("starter_template", template.id),
      );
      setSelectedBuiltInTemplateId(
        template.id.startsWith("botanical-") ? template.id : null,
      );
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
    [campaignId, designSystem, setOrigin, updateContent, updateSetup],
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

  // "Start from this week's theme": the tenant's weekly theme, its copy and
  // photos, applied like any other template (with the same overwrite check).
  const weeklyThemeQuery = useThisWeeksTheme({ enabled: !isLocked });
  const [weeklyThemeApplied, setWeeklyThemeApplied] = React.useState(false);
  const weeklyThemeTemplate = React.useMemo<CampaignTemplate | null>(() => {
    const theme = weeklyThemeQuery.data;
    if (!theme) return null;
    const preview = buildNewsletterIdeaDraftSeed(theme.idea, "block-builder", designSystem);
    return {
      id: `${WEEKLY_THEME_TEMPLATE_PREFIX}${originForNewsletterIdea(theme.idea)}`,
      name: `This week's theme: ${theme.idea.title}`,
      summary: theme.idea.description,
      season: "evergreen",
      tags: ["weekly-theme"],
      accentColor: EDITOR_TEMPLATE_ACCENT_COLOR,
      subjectLine: preview.subjectLine,
      previewText: preview.preheaderText,
      thumbnailBlocks: [],
      buildBlocks: (system) =>
        buildNewsletterIdeaDraftSeed(theme.idea, "block-builder", system).contentBlocks,
    };
  }, [designSystem, weeklyThemeQuery.data]);

  // "Start from this week's theme" applies the clean seed (the fallback),
  // then opens Design Studio, which writes the newsletter with AI. The open
  // waits one render so the saved draft carries the seed, not the old canvas.
  const [pendingThemeStudio, setPendingThemeStudio] =
    React.useState<ThemeGenerationNavigationState | null>(null);
  const handleStartFromTheme = React.useCallback(() => {
    if (!weeklyThemeTemplate) return;
    handleApplyTemplate(weeklyThemeTemplate);
    setSelectedIntent(null);
    setSelectedSavedTemplateId(null);
    setWeeklyThemeApplied(true);
    const theme = weeklyThemeQuery.data;
    if (campaignType === "email" && theme) {
      setPendingThemeStudio({
        themeGeneration: {
          weekNumber: theme.source.weekNumber,
          themeImages: theme.source.images,
        },
      });
    }
  }, [campaignType, handleApplyTemplate, weeklyThemeQuery.data, weeklyThemeTemplate]);
  React.useEffect(() => {
    if (!pendingThemeStudio) return;
    setPendingThemeStudio(null);
    void openStudio(pendingThemeStudio);
  }, [openStudio, pendingThemeStudio]);

  // "Start this week's email" on the campaigns page lands here with
  // ?start=theme. Run the same start-from-theme flow once, on a new draft.
  React.useEffect(() => {
    if (processParams.get("start") !== "theme") return;
    if (isLoading) return;
    const themeReady = Boolean(weeklyThemeTemplate);
    if (!themeReady && !weeklyThemeQuery.isFetched) return;
    const nextParams = new URLSearchParams(processParams);
    nextParams.delete("start");
    setProcessParams(nextParams, { replace: true });
    if (themeReady && !campaignId && !weeklyThemeApplied) handleStartFromTheme();
  }, [
    campaignId,
    handleStartFromTheme,
    isLoading,
    processParams,
    setProcessParams,
    weeklyThemeApplied,
    weeklyThemeQuery.isFetched,
    weeklyThemeTemplate,
  ]);

  const weeklyThemeOption = React.useMemo(() => {
    const theme = weeklyThemeQuery.data;
    if (!theme) return null;
    return {
      title: theme.idea.title,
      weekLabel: `Week ${theme.source.weekNumber}`,
      summary: theme.source.seasonalFocus || theme.idea.description,
      imageUrl: theme.source.images[0]?.url ?? null,
    };
  }, [weeklyThemeQuery.data]);

  const {
    savedTemplates,
    saveTemplate,
    renameTemplate,
    archiveTemplate,
    isSaving: isSavingTemplate,
    isLoading: isSavedTemplatesLoading,
  } = useSavedTemplates();

  // Intents whose tag mapping doesn't match any seasonal template
  // get rendered as "Coming soon". Recomputed when the template
  // catalog changes (it's a module-level constant today, but keeps
  // the picker correct if we hot-swap CAMPAIGN_TEMPLATES later).
  const unavailableIntents = React.useMemo(() => {
    const intents: CampaignIntentKey[] = [
      "newsletter",
      "showcase",
      "sale",
      "new-arrivals",
      "event",
      "thank-you",
    ];
    const missing = new Set<CampaignIntentKey>();
    for (const intent of intents) {
      if (!getTemplateForIntent(intent)) {
        missing.add(intent);
      }
    }
    return missing;
  }, []);

  const handleSelectIntent = React.useCallback(
    (intent: CampaignIntentKey) => {
      if (intent === "blank") {
        // Minimal starter: newsletter header + one empty paragraph.
        // Footer compliance is enforced by updateContent's downstream
        // ensureFooterBlockCompliance, so the user's blank slate
        // still meets CAN-SPAM requirements without us hard-coding it
        // here.
        const blocks = [
          createStudioBlock("newsletter-header", designSystem),
          createStudioBlock("plain-text", designSystem),
        ];
        // Starting over replaces what is there, so ask first, like every
        // other design. Subject and preview text are kept.
        if (hasMeaningfulEmailContent) {
          setTemplateToConfirm({
            id: BLANK_TEMPLATE_ID,
            name: "Blank newsletter",
            summary: "",
            season: "evergreen",
            tags: [],
            accentColor: EDITOR_TEMPLATE_ACCENT_COLOR,
            subjectLine,
            previewText: preheaderText,
            thumbnailBlocks: [],
            buildBlocks: () => blocks,
          });
          return;
        }
        setOrigin("blank");
        updateContent({ contentBlocks: blocks });
        setSelectedIntent("blank");
        setSelectedSavedTemplateId(null);
        return;
      }
      const template = getTemplateForIntent(intent);
      if (!template) {
        return;
      }
      handleApplyTemplate(template);
      setSelectedIntent(intent);
      setSelectedSavedTemplateId(null);
    },
    [designSystem, handleApplyTemplate, hasMeaningfulEmailContent, preheaderText, setOrigin, subjectLine, updateContent],
  );

  const handleApplySavedTemplate = React.useCallback(
    (template: SavedTemplate) => {
      if (hasMeaningfulEmailContent) {
        // Reuse the same overwrite-confirm dialog the seasonal apply
        // path uses, by wrapping the saved template in a synthetic
        // CampaignTemplate-shaped object whose buildBlocks returns
        // the stored layout. Keeps the confirmation UX consistent.
        setTemplateToConfirm({
          id: `saved:${template.id}`,
          name: template.name,
          summary: template.description ?? "",
          season: "evergreen",
          tags: [],
          accentColor: EDITOR_TEMPLATE_ACCENT_COLOR,
          subjectLine: subjectLine,
          previewText: preheaderText,
          thumbnailBlocks: [],
          buildBlocks: () => template.layout_json,
        });
        return;
      }
      setOrigin(buildCampaignOrigin("saved_template", template.id));
      lockedTemplateToRecordRef.current = template.isLocked ? template.id : null;
      updateContent({ contentBlocks: template.layout_json });
      setSelectedSavedTemplateId(template.id);
      setSelectedIntent(null);
    },
    [
      hasMeaningfulEmailContent,
      preheaderText,
      setOrigin,
      subjectLine,
      updateContent,
    ],
  );

  // "Use for a new email" in the Template Library lands here with
  // ?template=<id>. Apply that saved design once, on a new draft only. The
  // email gets its own copy of the blocks, so later template edits do not
  // change it.
  // Removing the URL parameter takes a render, and applying the design
  // changes this effect's inputs, so it would run twice and ask to replace
  // the design it had just applied. Handle each template id once.
  const handledTemplateParamRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const templateId = processParams.get("template");
    if (!templateId) return;
    if (isLoading || isSavedTemplatesLoading) return;
    if (handledTemplateParamRef.current === templateId) return;
    handledTemplateParamRef.current = templateId;
    const nextParams = new URLSearchParams(processParams);
    nextParams.delete("template");
    setProcessParams(nextParams, { replace: true });
    if (campaignId) return;
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) {
      toast.error("That template could not be found. It may have been deleted.");
      return;
    }
    handleApplySavedTemplate(template);
  }, [campaignId, handleApplySavedTemplate, isLoading, isSavedTemplatesLoading, processParams, savedTemplates, setProcessParams]);


  const handleSaveAsTemplate = React.useCallback(
    async (input: { name: string; description: string }) => {
      await saveTemplate({
        name: input.name,
        description: input.description || null,
        contentBlocks,
      });
      toast.success("Saved to My templates");
      setSaveTemplateOpen(false);
    },
    [contentBlocks, saveTemplate],
  );

  const handleRenameSavedTemplate = React.useCallback(
    async (
      template: SavedTemplate,
      name: string,
      description: string | null,
    ) => {
      await renameTemplate(template.id, name, description);
    },
    [renameTemplate],
  );

  const handleArchiveSavedTemplate = React.useCallback(
    async (template: SavedTemplate) => {
      await archiveTemplate(template.id);
    },
    [archiveTemplate],
  );

  // Offered only once the design has real content (not just a header).
  const canSaveAsTemplate = !isLocked && hasContentBlocks(contentBlocks);

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

  const studioDisabledReason = isLocked
    ? "This campaign has already been sent"
    : pendingTemplateSave
      ? "Your template is being saved"
      : !isTenantReady
        ? "Loading your garden centre"
        : undefined;
  const saveStatusText =
    autoSaveStatus === "failed" || autoSaveStatus === "error"
      ? "Your latest changes have not been saved"
      : isSaving
        ? "Saving…"
        : pendingTemplateSave
          ? "Applying template…"
          : isDirty
            ? "Unsaved changes"
            : lastSavedAt
              ? `Saved ${formatSavedTime(lastSavedAt)}`
              : campaignId
                ? "Saved"
                : "New draft · Not saved yet";
  const designName = (() => {
    if (templateLock.lock?.templateName) return templateLock.lock.templateName;
    if (selectedSavedTemplateId) {
      return savedTemplates.find((item) => item.id === selectedSavedTemplateId)?.name ?? "Saved design";
    }
    if (weeklyThemeApplied && weeklyThemeOption) return `This week's theme: ${weeklyThemeOption.title}`;
    if (selectedBuiltInTemplateId) {
      return CAMPAIGN_TEMPLATES.find((item) => item.id === selectedBuiltInTemplateId)?.name ?? "Preset design";
    }
    if (selectedIntent === "blank") return "Blank newsletter";
    if (selectedIntent) return getTemplateForIntent(selectedIntent)?.name ?? "Preset design";
    const originKind = getCampaignOriginKind(origin);
    const originRef = origin?.split(":").slice(1).join(":") ?? "";
    if (originKind === "saved_template") {
      return savedTemplates.find((item) => item.id === originRef)?.name ?? "Saved design";
    }
    if (originKind === "starter_template") {
      return CAMPAIGN_TEMPLATES.find((item) => item.id === originRef)?.name ?? "Preset design";
    }
    if (originKind === "weekly_theme") return "This week's theme";
    if (originKind === "blank") return "Blank newsletter";
    return "Your design";
  })();
  const designBlockCount = meaningfulEmailBlockCount + (hasComplianceFooter ? 1 : 0);
  const showDesignPicker = !hasMeaningfulEmailContent || designPickerOpen;
  const closeDesignPicker = () => setDesignPickerOpen(false);

  return (
    <Box
      data-testid="campaign-editor-page"
      style={{ "--campaign-editor-header-height": `${headerHeight}px` } as React.CSSProperties}
    >
      <Box
        component="header"
        id="campaign-editor-actions"
        ref={headerRef}
        data-testid="campaign-editor-header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          bgcolor: "background.body",
          borderBottom: "1px solid",
          borderColor: "divider",
          pt: { xs: 1.5, md: 2 },
          pb: 1.5,
          mb: 2,
        }}
      >
        <Box
          component={Link}
          to="/crm/campaigns"
          sx={{
            typography: "body-md",
            color: "text.secondary",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            minHeight: 44,
            fontWeight: "lg",
            "&:hover": { color: "text.primary", textDecoration: "underline" },
            "&:focus-visible": { outline: campaignEditorFocusOutline, outlineOffset: 2, borderRadius: "md" },
          }}
        >
          <ArrowLeft size={16} aria-hidden />
          Back to campaigns
        </Box>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 1.5, md: 3 }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "flex-end" }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              component="label"
              htmlFor="campaign-editor-name"
              level="body-xs"
              sx={{ fontWeight: "xl", letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}
            >
              Campaign name
            </Typography>
            {/* The name field is the page heading: Joy's h1 level, set in the
                theme's display font (Inter). The input inherits it. */}
            <Typography
              component="h1"
              level="h1"
              sx={(theme) => ({
                m: 0,
                fontFamily: theme.vars.fontFamily.display,
                fontSize: theme.vars.fontSize.xl3,
                fontWeight: theme.vars.fontWeight.bold,
                lineHeight: 1.25,
                color: "text.primary",
              })}
            >
              <Box
                component="input"
                id="campaign-editor-name"
                type="text"
                value={isUnsetCampaignName(name) ? "" : name}
                placeholder={deriveCampaignDisplayName({ name: "", subjectLine, blocks: contentBlocks })}
                disabled={isLocked}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  updateSetup({ name: event.target.value })
                }
                sx={{
                  all: "unset",
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: 44,
                  px: 0.75,
                  mx: -0.75,
                  borderRadius: "lg",
                  textOverflow: "ellipsis",
                  "&::placeholder": { color: "text.tertiary", opacity: 1 },
                  "&:hover:not(:disabled)": { bgcolor: "neutral.plainHoverBg" },
                  "&:focus-visible": { outline: campaignEditorFocusOutline, outlineOffset: 0, bgcolor: "background.surface" },
                }}
              />
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <JoyStatusChip status={status} />
              <JoyChip variant="soft" color="neutral" size="sm">
                {campaignType === "email" ? "Email" : "SMS"}
              </JoyChip>
              {campaignGroups.map((group) => (
                <Chip
                  key={group.id}
                  variant="outlined"
                  color="neutral"
                  size="sm"
                  data-testid="campaign-editor-group-chip"
                  startDecorator={
                    <Box
                      component="span"
                      aria-hidden
                      sx={{ width: 10, height: 10, borderRadius: "xs", bgcolor: group.colour }}
                    />
                  }
                >
                  {group.name}
                </Chip>
              ))}
              <Typography
                role="status"
                level="body-sm"
                data-testid="campaign-editor-save-status"
                sx={{ color: "text.secondary" }}
              >
                {saveStatusText}
              </Typography>
              {autoSaveStatus === "failed" || autoSaveStatus === "error" ? (
                <JoyButton
                  variant="outlined"
                  color="neutral"
                  size="sm"
                  onClick={() => void saveDraft({ silent: false })}
                >
                  Couldn’t save · Retry
                </JoyButton>
              ) : null}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }} useFlexGap flexWrap="wrap">
            {campaignType === "email" ? (
              <JoyButton
                variant="outlined"
                color="neutral"
                startDecorator={<Send size={18} aria-hidden />}
                data-testid="campaign-editor-send-test-cta"
                disabled={isLocked || !hasMeaningfulEmailContent}
                onClick={() => setTestSendOpen(true)}
                sx={{ flex: { xs: 1, md: "none" }, fontSize: 15, px: 2 }}
              >
                Send test
              </JoyButton>
            ) : null}
            <JoyButton
              data-testid="campaign-editor-schedule-cta"
              startDecorator={<CalendarClock size={18} aria-hidden />}
              disabled={sendControlsDisabled}
              aria-describedby={sendBlockers.length > 0 || eligibilityChecking ? "campaign-editor-readiness" : undefined}
              onClick={handleScheduleForLater}
              sx={{
                flex: { xs: 1, md: "none" },
                fontSize: 15,
                px: 2.5,
                // Disabled until the readiness bar is clear; keep the label legible.
                "&.Mui-disabled": { bgcolor: "neutral.200", color: "text.secondary" },
              }}
            >
              {eligibilityChecking ? CHECKING_AUDIENCE_LABEL : "Schedule"}
            </JoyButton>
          </Stack>
        </Stack>
      </Box>

      <Box id="campaign-editor-readiness" sx={{ mb: sendBlockers.length > 0 || eligibilityChecking ? 2 : 0 }}>
        <CampaignReadinessBar
          blockers={sendBlockers}
          checking={eligibilityChecking}
          checkingLabel={CHECKING_AUDIENCE_LABEL}
          onJump={openEditorSection}
          extraAction={
            autoSaveStatus === "conflict" ? (
              <JoyButton variant="outlined" color="neutral" onClick={handleReloadDraft}>
                Reload draft
              </JoyButton>
            ) : null
          }
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 3,
          alignItems: "start",
          "@media (min-width: 1100px)": {
            gridTemplateColumns:
              campaignType === "email" ? "minmax(0, 1fr) minmax(360px, 440px)" : "minmax(0, 1fr)",
          },
        }}
      >
        <Stack spacing={2} data-testid="campaign-editor-steps" sx={{ minWidth: 0 }}>
          <CampaignEditorStep
            id="campaign-editor-content"
            number={stepNumber.content}
            title={campaignType === "email" ? "Design" : "Message"}
            state={stepStates.content}
            expanded={isStepExpanded("content")}
            onExpandedChange={(next) => setStepExpanded("content", next)}
            summary={
              campaignType === "email"
                ? hasMeaningfulEmailContent
                  ? // Count the footer too, so this matches the number shown in
                    // the studio.
                    `${designName} · ${designBlockCount} blocks`
                  : "No design yet"
                : smsMessage.trim()
                  ? `${smsMessage.length} characters · ${computeSmsSegments(smsMessage)} segment(s)`
                  : "Message not written yet"
            }
          >
            {campaignType === "email" ? (
              <Stack spacing={2.5}>
                {hasMeaningfulEmailContent && !designPickerOpen ? (
                  <CampaignDesignSummary
                    blocks={contentBlocks}
                    subjectLine={subjectLine}
                    previewText={preheaderText}
                    designSystem={designSystem}
                    designName={designName}
                    blockCount={designBlockCount}
                    lastEditedLabel={lastSavedAt ? formatSavedTime(lastSavedAt) : null}
                    lock={templateLock.lock}
                    onEditInStudio={handleOpenStudio}
                    onChangeDesign={() => setDesignPickerOpen(true)}
                    studioDisabled={isLocked || Boolean(pendingTemplateSave) || !isTenantReady}
                    studioDisabledReason={studioDisabledReason}
                    changeDisabled={isLocked || Boolean(pendingTemplateSave)}
                    studioLabel={isLocked ? "View in Design Studio" : "Edit in Design Studio"}
                    extraActions={
                      templateLock.lock?.locked && templateLock.lock.canDesign ? (
                        <JoyButton
                          variant="plain"
                          color="neutral"
                          loading={templateLock.release.isPending}
                          onClick={() => templateLock.release.mutate()}
                        >
                          Unlock this email
                        </JoyButton>
                      ) : null
                    }
                  />
                ) : null}

                {showDesignPicker ? (
                  <Stack spacing={2}>
                    {hasMeaningfulEmailContent ? (
                      <Stack direction="row" justifyContent="flex-end">
                        <JoyButton
                          variant="plain"
                          color="neutral"
                          onClick={closeDesignPicker}
                          data-testid="campaign-design-keep"
                        >
                          Keep the current design
                        </JoyButton>
                      </Stack>
                    ) : null}
                    <IntentPicker
                      savedTemplates={savedTemplates}
                      selectedIntent={selectedIntent}
                      selectedSavedTemplateId={selectedSavedTemplateId}
                      disabled={isLocked || Boolean(pendingTemplateSave)}
                      unavailableIntents={unavailableIntents}
                      onSelectIntent={(intent) => {
                        handleSelectIntent(intent);
                        closeDesignPicker();
                      }}
                      onApplyBuiltInTemplate={(template) => {
                        handleApplyTemplate(template);
                        closeDesignPicker();
                      }}
                      onApplySavedTemplate={(template) => {
                        handleApplySavedTemplate(template);
                        closeDesignPicker();
                      }}
                      onRenameSavedTemplate={() => setManageTemplatesOpen(true)}
                      onArchiveSavedTemplate={() => setManageTemplatesOpen(true)}
                      onOpenManage={() => setManageTemplatesOpen(true)}
                      weeklyTheme={weeklyThemeOption}
                      weeklyThemeLoading={weeklyThemeQuery.isLoading}
                      weeklyThemeSelected={weeklyThemeApplied && !selectedIntent && !selectedSavedTemplateId}
                      onStartFromTheme={() => {
                        handleStartFromTheme();
                        closeDesignPicker();
                      }}
                      selectedBuiltInTemplateId={
                        selectedIntent || selectedSavedTemplateId ? null : selectedBuiltInTemplateId
                      }
                      hasContent={hasMeaningfulEmailContent}
                    />
                    {!hasMeaningfulEmailContent ? (
                      <Stack spacing={0.75} alignItems="flex-start">
                        <JoyButton
                          variant="outlined"
                          color="neutral"
                          startDecorator={<Palette size={18} aria-hidden />}
                          data-testid="campaign-design-open-studio"
                          onClick={handleOpenStudio}
                          disabled={
                            isLocked || Boolean(pendingTemplateSave) || !isTenantReady
                          }
                        >
                          {isLocked ? "View in Design Studio" : "Open Design Studio"}
                        </JoyButton>
                        <Typography level="body-sm" sx={{ color: "text.secondary" }} role="status">
                          {studioDisabledReason ??
                            "Edit text, add images, change colours and arrange every block."}
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}

                {canSaveAsTemplate ? (
                  <Box>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => {
                        if (!canSaveAsTemplate) return;
                        setSaveTemplateOpen(true);
                      }}
                      disabled={!canSaveAsTemplate}
                      data-testid="content-save-as-template-link"
                      sx={{
                        background: "none",
                        border: 0,
                        padding: 0,
                        minHeight: 44,
                        typography: "body-md",
                        color: "primary.plainColor",
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                        cursor: "pointer",
                        "&:focus-visible": {
                          outline: campaignEditorFocusOutline,
                          outlineOffset: "2px",
                          borderRadius: "xs",
                        },
                      }}
                    >
                      Save this design as a template
                    </Box>
                  </Box>
                ) : null}

                <EmptyBlocksNotice
                  blocks={contentBlocks}
                  disabled={isLocked}
                  onRemove={(remaining) => updateContent({ contentBlocks: remaining })}
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
          </CampaignEditorStep>

          {campaignType === "email" ? (
            <CampaignEditorStep
              id="campaign-editor-inbox"
              number={stepNumber.inbox}
              title="Inbox"
              state={stepStates.inbox}
              expanded={isStepExpanded("inbox")}
              onExpandedChange={(next) => setStepExpanded("inbox", next)}
              summary={subjectLine || "Subject and preview text"}
            >
              <NewsletterInboxReview
                campaignId={campaignId}
                blocks={contentBlocks}
                subject={subjectLine}
                preview={preheaderText}
                senderName={senderName}
                onChange={updateSetup}
                disabled={isLocked}
              />
            </CampaignEditorStep>
          ) : null}

          <CampaignEditorStep
            id="campaign-editor-audience"
            number={stepNumber.audience}
            title="Audience"
            state={stepStates.audience}
            expanded={isStepExpanded("audience")}
            onExpandedChange={(next) => setStepExpanded("audience", next)}
            summary={
              campaignType === "email"
                ? emailAudienceSummary
                : isAudienceLoading
                  ? `${audienceDetail} · Calculating audience`
                  : (audienceCount ?? 0) > 0
                    ? `${audienceDetail} · ${asCountLabel(audienceCount)}`
                    : audienceDetail
            }
          >
          <Stack spacing={2}>
            {!isAudienceLoading &&
            !includeAllCustomers &&
            selectedSegments.length === 0 &&
            selectedPersonas.length === 0 &&
            additionalCustomerIds.length === 0 ? (
              <Sheet
                variant="soft"
                color="neutral"
                data-testid="campaign-audience-empty-warning"
                sx={{ borderRadius: "md", p: 1.5 }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Info
                    size={17}
                    style={{
                      flexShrink: 0,
                      marginTop: 2,
                      color: "var(--joy-palette-neutral-600)",
                    }}
                  />
                  <Stack spacing={0.25}>
                    <Typography
                      level="body-sm"
                      fontWeight="lg"
                      sx={{ color: "neutral.800" }}
                    >
                      Choose who will receive this newsletter.
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.700" }}>
                      Select All Contacts or a segment below. You can change your
                      audience before sending.
                    </Typography>
                  </Stack>
                </Stack>
              </Sheet>
            ) : null}

            <SegmentsAudienceSelect
              segments={segmentsQuery.data ?? []}
              selectedSegments={selectedSegments}
              includeAllCustomers={includeAllCustomers}
              disabled={isLocked}
              loading={segmentsQuery.isLoading}
              onChange={(next) => updateAudience(next)}
            />

            {campaignType === "email" && (eligibilityChecking || (eligibility && eligibility.total > 0)) ? (
              <Sheet
                variant="outlined"
                data-testid="audience-consent-breakdown"
                aria-busy={eligibilityChecking}
                sx={{ borderRadius: "md", p: 1.75 }}
              >
                <Stack spacing={1.25}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography
                      level="body-xs"
                      fontWeight="lg"
                      sx={{
                        color: "neutral.500",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Who can receive this campaign
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      {eligibility ? `${eligibility.total.toLocaleString()} total` : CHECKING_AUDIENCE_LABEL}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        sm: "repeat(5, minmax(0, 1fr))",
                      },
                      gap: 1.25,
                    }}
                  >
                    {[
                      { id: "eligible", label: CRM_COPY.optedIn, value: eligibility?.eligible, color: "success.700" },
                      {
                        id: "waiting",
                        label: "Waiting for permission",
                        value: eligibility?.waiting,
                        color: eligibility && eligibility.waiting > 0 ? "warning.700" : "neutral.700",
                      },
                      { id: "asked-to-stop", label: CRM_COPY.optedOutPlural, value: eligibility?.askedToStop, color: "neutral.700" },
                      { id: "never-opted-in", label: CRM_COPY.neverOptedIn, value: eligibility?.neverOptedIn, color: "neutral.700" },
                      { id: "unsendable", label: "Can't be sent to", value: eligibility?.unsendable, color: "neutral.700" },
                    ].map((bucket) => (
                      <Box key={bucket.id} data-testid={`audience-bucket-${bucket.id}`}>
                        <Typography
                          level="title-md"
                          sx={{ color: bucket.color, lineHeight: 1 }}
                        >
                          {bucket.value === undefined ? (
                            <Skeleton variant="text" sx={{ width: 40 }} />
                          ) : (
                            bucket.value.toLocaleString()
                          )}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.600", mt: 0.5 }}
                        >
                          {bucket.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {eligibility && eligibility.duplicates > 0 ? (
                    <Typography
                      level="body-xs"
                      data-testid="audience-duplicate-note"
                      sx={{ color: "neutral.600" }}
                    >
                      {eligibility.duplicates.toLocaleString()} more{" "}
                      {eligibility.duplicates === 1 ? "contact shares" : "contacts share"} an
                      address with someone above. Each address gets one copy.
                    </Typography>
                  ) : null}
                  {eligibility && eligibility.waiting > 0 &&
                  eligibility.waiting / eligibility.total > 0.1 ? (
                    <Sheet
                      variant="soft"
                      color="warning"
                      data-testid="audience-pending-confirmation-warning"
                      sx={{ borderRadius: "md", p: 1.25 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <AlertCircle
                          size={16}
                          style={{
                            flexShrink: 0,
                            marginTop: 2,
                            color: "var(--joy-palette-warning-700)",
                          }}
                        />
                        <Typography level="body-xs" sx={{ color: "neutral.700" }}>
                          {eligibility.waiting.toLocaleString()} of
                          your contacts are waiting for permission to receive
                          email — they won't get this campaign. If you already
                          have permission records for them, contact support and
                          we'll help you restore them.
                        </Typography>
                      </Stack>
                    </Sheet>
                  ) : null}
                </Stack>
              </Sheet>
            ) : null}

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
            ) : !personaTargeting.available && selectedPersonas.length === 0 ? null : (
              <JoyButton
                variant="outlined"
                color="neutral"
                size="sm"
                startDecorator={<UsersRound size={15} aria-hidden />}
                onClick={() => setPersonaDisclosureOpen(true)}
                disabled={isLocked}
                data-testid="audience-add-persona"
                sx={{ alignSelf: "flex-start" }}
              >
                Also target by persona
              </JoyButton>
            )}

            {campaignType === "email" ? (
              <Stack spacing={1.25}>
                <JoyButton
                  variant="outlined"
                  color="neutral"
                  size="sm"
                  startDecorator={<UserPlus size={15} aria-hidden />}
                  onClick={() => setAudienceExpansionOpen(true)}
                  disabled={isLocked}
                  data-testid="audience-add-people"
                  sx={{ alignSelf: "flex-start" }}
                >
                  Add specific people
                </JoyButton>

                {/* The "All Contacts" pseudo-pill inside
                    SegmentsAudienceSelect already communicates the
                    include_all_customers=true state, so we no longer
                    render a separate "All customers included" card
                    here. Only the direct-addition card below stays —
                    it shows specific user-added customer IDs that the
                    pseudo-pill does not describe. */}
                {additionalCustomerIds.length > 0 ? (
                  <Stack spacing={1}>
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
                                {additionalCustomerIds.length === 1
                                  ? ""
                                  : "s"}{" "}
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
                                variant="rectangular"
                                width={176}
                                height={28}
                              />
                              <Skeleton
                                variant="rectangular"
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
                                  endDecorator={
                                    isLocked ? undefined : (
                                      <ChipDelete
                                        aria-label={`Remove ${customer.name}`}
                                        onDelete={() =>
                                          handleRemoveAdditionalCustomer(
                                            customer.id,
                                          )
                                        }
                                      />
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
                              Direct additions are saved, but the customer details
                              are not available right now.
                            </Typography>
                          )}

                          {selectedAdditionalCustomers.length !==
                          additionalCustomerIds.length ? (
                            <Typography
                              level="body-xs"
                              sx={{ color: "neutral.500" }}
                            >
                              Some saved customer IDs are no longer available in
                              this tenant.
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
          </CampaignEditorStep>

          <CampaignEditorStep
            id="campaign-editor-sender"
            number={stepNumber.sender}
            title="Sender"
            state={stepStates.sender}
            expanded={isStepExpanded("sender")}
            onExpandedChange={(next) => setStepExpanded("sender", next)}
            summary={senderSummary}
          >
            <CampaignSenderStep
              campaignType={campaignType}
              senderName={senderName}
              senderEmail={senderEmail}
              replyTo={replyTo}
              footerBusinessName={footerBlock ? (footerBlock.businessName ?? "") : null}
              companyName={designSystem.company.name}
              senderClassification={senderClassification}
              domainStatusLoading={campaignType === "email" && emailDomainsLoading}
              mismatches={identityMismatchDetails}
              disabled={isLocked}
              onSetupChange={updateSetup}
              onFooterBusinessNameChange={handleFooterBusinessNameChange}
              onVerifySender={() => setVerificationOpen(true)}
              onOpenSenderSettings={() => navigate("/crm/settings/email-sending")}
            />
          </CampaignEditorStep>

          <CampaignEditorStep
            id="campaign-editor-organize"
            number={stepNumber.organize}
            title="Organize"
            state={stepStates.organize}
            expanded={isStepExpanded("organize")}
            onExpandedChange={(next) => setStepExpanded("organize", next)}
            summary={
              campaignGroups.length > 0
                ? `Groups: ${campaignGroups.map((group) => group.name).join(", ")}`
                : "Groups, colour and campaign type"
            }
          >
            <Stack spacing={2.5}>
              <Box sx={{ maxWidth: 360 }}>
                <JoySelect
                  label="Campaign type"
                  value={campaignType}
                  disabled={isLocked}
                  options={[
                    { value: "email", label: "Email" },
                    { value: "sms", label: "SMS" },
                  ]}
                  onValueChange={(value) =>
                    updateSetup({
                      campaignType: value === "sms" ? "sms" : "email",
                    })
                  }
                />
              </Box>
              {campaignId ? (
                <CampaignOrganization campaignId={campaignId} disabled={isLocked} />
              ) : (
                <Typography level="body-md" sx={{ color: "text.secondary" }}>
                  Groups and a campaign colour can be added once this draft has saved.
                </Typography>
              )}
            </Stack>
          </CampaignEditorStep>
        </Stack>

        {campaignType === "email" ? (
          <Box
            sx={{
              minWidth: 0,
              "@media (min-width: 1100px)": {
                position: "sticky",
                top: "calc(var(--campaign-editor-header-height, 120px) + 16px)",
              },
            }}
          >
            <CampaignLivePreview
              blocks={contentBlocks}
              subjectLine={subjectLine}
              previewText={preheaderText}
              designSystem={designSystem}
              loading={isDesignSystemLoading}
            />
          </Box>
        ) : null}
      </Box>
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
                      <Skeleton variant="rectangular" height={42} />
                      <Skeleton variant="rectangular" height={42} />
                      <Skeleton variant="rectangular" height={42} />
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
              {templateToConfirm?.id === BLANK_TEMPLATE_ID
                ? "Starting over removes everything in this email and leaves a blank newsletter. Your subject line stays."
                : "This design will replace what is in this email now, including the subject line and preview text."}
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
              {templateToConfirm?.id === BLANK_TEMPLATE_ID ? "Start over" : "Replace with this design"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      <CampaignScheduleDrawer
        initialMode="later"
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
        canConfirm={!sendControlsDisabled}
        checking={eligibilityChecking}
        blockedReason={
          sendBlockers.find((blocker) => blocker.section === "campaign-editor-audience")?.message ?? null
        }
      />
      <CampaignSendConfirmation
        open={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        builderWarnings={sendWarningLines}
        builderBlockers={connectedEventChecking ? [...sendBlockerLines, "Checking linked website events. Please wait."] : sendBlockerLines}
        placeholderWarnings={placeholderWarningLines}
        onEditContent={() => {
          setSendConfirmOpen(false);
          void handleOpenStudio();
        }}
        onSchedule={() => {
          setSendConfirmOpen(false);
          handleScheduleForLater();
        }}
        reviewContent={
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {[
                ["Sender", "campaign-editor-sender"],
                ["Subject", "campaign-editor-inbox"],
                ["Audience", "campaign-editor-audience"],
              ].map(([label, section]) => (
                <JoyButton
                  key={label}
                  variant="outlined"
                  color="neutral"
                  onClick={() => {
                    setSendConfirmOpen(false);
                    // Wait for the dialog to close before moving focus.
                    requestAnimationFrame(() => openEditorSection(section));
                  }}
                >
                  Edit {label.toLowerCase()}
                </JoyButton>
              ))}
            </Stack>
            {campaignType === "email" ? (
              <details>
                <summary
                  style={{
                    cursor: "pointer",
                    padding: "12px 0",
                    fontWeight: 600,
                  }}
                >
                  Review newsletter preview
                </summary>
                <ContentPreviewCard
                  blocks={contentBlocks}
                  subjectLine={subjectLine}
                  previewText={preheaderText}
                  designSystem={designSystem}
                  loading={isDesignSystemLoading}
                  onOpenStudio={() => {
                    setSendConfirmOpen(false);
                    void handleOpenStudio();
                  }}
                />
              </details>
            ) : (
              <Typography>{smsMessage}</Typography>
            )}
            {campaignType === "email" ? (
              <EmptyBlocksNotice
                blocks={contentBlocks}
                disabled={isLocked}
                onRemove={(remaining) => updateContent({ contentBlocks: remaining })}
              />
            ) : null}
            {contentReviewIssues.map((issue) => (
              <JoyButton
                key={`${issue.blockId}-${issue.message}`}
                variant="outlined"
                color="neutral"
                onClick={async () => {
                  setSendConfirmOpen(false);
                  const savedId = await saveDraft({ silent: true });
                  if (savedId)
                    navigate(
                      `/crm/campaigns/${savedId}/studio?block=${encodeURIComponent(issue.blockId)}`,
                    );
                }}
              >
                {issue.message} Fix in Studio
              </JoyButton>
            ))}
          </Stack>
        }
      />
      <SenderVerificationDialog
        open={verificationOpen}
        onClose={() => {
          setVerificationOpen(false);
          // The modal checks DNS; refresh the editor's own domain list too.
          void refetchEmailDomains();
        }}
        campaignSenderEmail={senderEmail}
        onChooseVerifiedSender={(verifiedEmail) => {
          updateSetup({
            senderEmail: verifiedEmail,
            // Keep the chosen sender name and existing reply-to unchanged.
            replyTo: replyTo.trim() || verifiedEmail,
          });
        }}
      />
      <SenderConfigModal
        open={senderConfigOpen}
        onClose={() => setSenderConfigOpen(false)}
        senderName={senderName}
        senderEmail={senderEmail}
        replyTo={replyTo}
        isLocked={isLocked}
        onSave={(next) =>
          updateSetup({
            senderName: next.senderName,
            senderEmail: next.senderEmail,
            replyTo: next.replyTo,
          })
        }
      />
      <SaveAsTemplateModal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        onSave={handleSaveAsTemplate}
        saving={isSavingTemplate}
      />
      <ManageTemplatesModal
        open={manageTemplatesOpen}
        onClose={() => setManageTemplatesOpen(false)}
        templates={savedTemplates}
        onRename={handleRenameSavedTemplate}
        onArchive={handleArchiveSavedTemplate}
      />
    </Box>
  );
}

export default function CRMCampaignEditorPage() {
  const { campaignId } = useParams<{ campaignId: string }>();

  return (
    <DesignSystemProvider>
      <CampaignEditorProvider campaignId={campaignId}>
        {/* The page's own background fills the shell's content padding
            (DashboardShell: px xs 2 / md 4, py xs 3 / md 4). */}
        <Box
          sx={{
            ...campaignEditorPageSx,
            bgcolor: "background.body",
            mx: { xs: -2, md: -4 },
            mt: { xs: -3, md: -4 },
            mb: { xs: -3, md: -4 },
            px: { xs: 2, md: 4 },
            pt: { xs: 1, md: 1.5 },
            pb: { xs: 3, md: 4 },
            minHeight: "100%",
          }}
        >
          <PageContainer sx={{ maxWidth: `${EDITOR_MAX_WIDTH}px`, mx: "auto" }}>
            <CampaignEditorScreen />
          </PageContainer>
        </Box>
      </CampaignEditorProvider>
    </DesignSystemProvider>
  );
}
