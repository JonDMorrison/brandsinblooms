import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Grid from "@mui/joy/Grid";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlignLeft,
  AlertTriangle,
  ArrowLeftRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Minus,
  Monitor,
  MousePointerClick,
  Pencil,
  Play,
  Plus,
  Send,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CleanEmailBlockEditor } from "@/components/crm/CleanEmailBlockEditor";
import { CampaignActiveSendView } from "@/components/crm/campaign-editor/CampaignActiveSendView";
import { CampaignLockedView } from "@/components/crm/campaign-editor/CampaignLockedView";
import {
  CampaignEditorProvider,
  useCampaignEditor,
} from "@/components/crm/campaign-editor/CampaignEditorContext";
import { CampaignPreviewDialog } from "@/components/crm/campaign-editor/CampaignPreviewDialog";
import { CampaignScheduleDrawer } from "@/components/crm/campaign-editor/CampaignScheduleDrawer";
import { CampaignSendConfirmation } from "@/components/crm/campaign-editor/CampaignSendConfirmation";
import { SenderVerificationDialog } from "@/components/crm/campaign-editor/SenderVerificationDialog";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
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
import { useEmailDomains } from "@/hooks/useEmailDomains";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { SYSTEM_PERSONAS } from "@/config/systemPersonas";
import {
  CAMPAIGN_STATUS,
  isDeliveredCampaignStatus,
  isLockedCampaignStatus,
  isQueuedCampaignStatus,
} from "@/constants/campaignStatuses";
import type {
  CampaignCatalogItem,
  CampaignPersonaSummary,
  CampaignSegmentSummary,
  CampaignStatus,
} from "@/lib/crm/campaignEditor";
import type { ContentBlock } from "@/types/emailBuilder";

type SampleCustomer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type PreviewViewport = "desktop" | "mobile";
type PreflightStatus = "pass" | "warn" | "fail";

type PreflightCheck = {
  id: string;
  label: string;
  detail: string;
  status: PreflightStatus;
};

const EDITOR_MAX_WIDTH = 1200;

function isReadOnlyStatus(status: CampaignStatus) {
  return isLockedCampaignStatus(status);
}

function hasEmailContent(blocks: ContentBlock[]) {
  return blocks.length > 0;
}

function computeSmsSegments(message: string) {
  const length = message.length;
  if (length === 0) {
    return 0;
  }

  if (length <= 160) {
    return 1;
  }

  return Math.ceil(length / 153);
}

function displayName(customer: SampleCustomer) {
  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || customer.email || "Unknown customer";
}

function createBlockId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createManualBlock(kind: string): ContentBlock {
  switch (kind) {
    case "hero_safe":
    case "header":
    case "hero":
      return {
        id: createBlockId("hero"),
        type: "email-safe-hero",
        source: "manual",
        headline: "Hero headline",
        subtitle: "Add a concise supporting message.",
        eyebrow: "Featured",
        textAlign: "center",
        backgroundColor: "#f5f5f7",
        textColor: "#111111",
        padding: "large",
        visible: true,
        collapsed: false,
      };
    case "hero_graphic":
      return {
        id: createBlockId("graphic_hero"),
        type: "graphic-hero",
        source: "manual",
        imageUrl: "",
        altText: "",
        ctaUrl: "",
        shouldFetchImage: false,
        isGeneratingImage: false,
        autoImageMode: false,
        visible: true,
        collapsed: false,
      };
    case "full_image":
      return {
        id: createBlockId("full_image"),
        type: "image",
        source: "manual",
        imageUrl: "",
        altText: "",
        caption: "",
        layout: "full-width",
        alignment: "center",
        visible: true,
        collapsed: false,
      };
    case "image_gallery":
    case "gallery":
      return {
        id: createBlockId("gallery"),
        type: "image-gallery",
        source: "manual",
        headline: "Image gallery",
        body: "Add context for this gallery.",
        galleryImages: [],
        galleryLayout: "3-across",
        galleryGap: "medium",
        galleryImageRadius: "medium",
        visible: true,
        collapsed: false,
      };
    case "product_gallery":
      return {
        id: createBlockId("product_gallery"),
        type: "image-gallery",
        source: "manual",
        headline: "Product gallery",
        body: "Showcase featured products, bundles, or seasonal picks.",
        galleryItems: [],
        ctaText: "Shop now",
        ctaUrl: "",
        visible: true,
        collapsed: false,
      };
    case "cta_button":
    case "button":
      return {
        id: createBlockId("button"),
        type: "button",
        source: "manual",
        heading: "Call to action",
        body: "Explain what happens next.",
        buttonText: "Learn more",
        buttonUrl: "",
        alignment: "center",
        padding: "medium",
        visible: true,
        collapsed: false,
      };
    case "divider":
      return {
        id: createBlockId("divider"),
        type: "divider",
        source: "manual",
        content: "solid",
        dividerThickness: 1,
        margin: "medium",
        visible: true,
        collapsed: false,
      };
    case "footer":
      return {
        id: createBlockId("footer"),
        type: "footer",
        source: "manual",
        title: "Footer",
        content: "Company address, unsubscribe link, and compliance details.",
        visible: true,
        collapsed: false,
      };
    case "plain_text":
    case "image_text":
    case "text":
    default:
      return {
        id: createBlockId("text"),
        type: "image-text",
        source: "manual",
        title: "New section",
        content: "Add your message here.",
        body: "Add your message here.",
        layout: "full-width",
        alignment: "left",
        padding: "medium",
        visible: true,
        collapsed: false,
      };
  }
}

function getStatusBannerColor(status: CampaignStatus) {
  switch (status) {
    case CAMPAIGN_STATUS.SENT:
      return "success" as const;
    case CAMPAIGN_STATUS.SENT_WITH_ERRORS:
      return "warning" as const;
    case CAMPAIGN_STATUS.FAILED:
      return "danger" as const;
    case CAMPAIGN_STATUS.PAUSED:
      return "warning" as const;
    case CAMPAIGN_STATUS.SCHEDULED:
      return "primary" as const;
    default:
      return "neutral" as const;
  }
}

function SectionCard({
  title,
  children,
  endDecorator,
  headerSx,
  bodySx,
}: {
  title: string;
  children: React.ReactNode;
  endDecorator?: React.ReactNode;
  headerSx?: Record<string, unknown>;
  bodySx?: Record<string, unknown>;
}) {
  return (
    <JoyCard
      variant="outlined"
      sx={{
        borderRadius: "lg",
        boxShadow: "none",
        borderColor: "neutral.200",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "neutral.100",
          backgroundColor: "neutral.50",
          ...headerSx,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography level="title-sm" fontWeight="lg">
            {title}
          </Typography>
          {endDecorator}
        </Stack>
      </Box>
      <Box sx={{ p: 3, ...bodySx }}>{children}</Box>
    </JoyCard>
  );
}

function CampaignTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: "email" | "sms";
  onChange: (next: "email" | "sms") => void;
  disabled: boolean;
}) {
  return (
    <ButtonGroup
      aria-label="campaign type"
      sx={{
        "--ButtonGroup-radius": "40px",
        gap: 2,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <Button
        variant={value === "email" ? "solid" : "outlined"}
        color={value === "email" ? "primary" : "neutral"}
        startDecorator={<Mail size={16} />}
        onClick={() => onChange("email")}
        size="sm"
      >
        Email
      </Button>
      <Button
        variant={value === "sms" ? "solid" : "outlined"}
        color={value === "sms" ? "primary" : "neutral"}
        startDecorator={<MessageSquare size={16} />}
        onClick={() => onChange("sms")}
        size="sm"
      >
        SMS
      </Button>
    </ButtonGroup>
  );
}

function BlockPickerCard({
  icon,
  name,
  description,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <Sheet
      variant="outlined"
      onClick={onClick}
      sx={{
        borderRadius: "lg",
        p: 2,
        cursor: "pointer",
        transition: "all 150ms ease",
        border: "1px solid",
        borderColor: "neutral.200",
        "&:hover": {
          borderColor: "primary.300",
          backgroundColor: "primary.50",
          boxShadow: "sm",
          transform: "translateY(-1px)",
        },
        "&:active": {
          transform: "translateY(0)",
          boxShadow: "none",
        },
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            backgroundColor: "neutral.100",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "neutral.600",
          }}
        >
          {icon}
        </Box>
        {badge ? (
          <JoyChip
            size="sm"
            variant="soft"
            color={badge === "Recommended" ? "primary" : "neutral"}
          >
            {badge}
          </JoyChip>
        ) : null}
      </Stack>
      <Typography level="body-sm" fontWeight="lg">
        {name}
      </Typography>
      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
        {description}
      </Typography>
    </Sheet>
  );
}

const PREVIEW_TOGGLE_BUTTON_SX = {
  borderRadius: "6px",
  px: 1.5,
  minHeight: 28,
  border: "none",
  transition: "all 150ms ease",
  '&[aria-pressed="false"]': {
    backgroundColor: "transparent",
    color: "neutral.500",
    "&:hover": {
      backgroundColor: "neutral.100",
      color: "neutral.700",
    },
  },
  '&[aria-pressed="true"]': {
    backgroundColor: "neutral.800",
    color: "common.white",
    boxShadow: "sm",
    "&:hover": {
      backgroundColor: "neutral.700",
    },
  },
} as const;

const BLOCK_PICKER_SECTIONS = [
  {
    heading: "Hero & Headers",
    items: [
      {
        id: "hero_safe",
        icon: <Sparkles size={20} />,
        name: "Email Safe Hero",
        description: "Text on solid background — works everywhere",
        badge: "Recommended",
      },
      {
        id: "hero_graphic",
        icon: <ImageIcon size={20} />,
        name: "Graphic Hero",
        description: "Full image with baked-in text",
      },
      {
        id: "full_image",
        icon: <ImageIcon size={20} />,
        name: "Full-Width Image",
        description: "Responsive image spanning full width",
      },
    ],
  },
  {
    heading: "Content",
    items: [
      {
        id: "image_text",
        icon: <ArrowLeftRight size={20} />,
        name: "Image + Text",
        description: "Side-by-side image and text layout",
      },
      {
        id: "image_gallery",
        icon: <LayoutGrid size={20} />,
        name: "Image Gallery",
        description: "Grid of 3, 6, or 9 images",
      },
      {
        id: "product_gallery",
        icon: <ShoppingBag size={20} />,
        name: "Product Gallery",
        description: "2×2 product grid with badges",
      },
    ],
  },
  {
    heading: "Elements",
    items: [
      {
        id: "plain_text",
        icon: <AlignLeft size={20} />,
        name: "Plain Text",
        description: "Single column body text",
      },
      {
        id: "cta_button",
        icon: <MousePointerClick size={20} />,
        name: "Call to Action",
        description: "Button with customizable link",
      },
      {
        id: "divider",
        icon: <Minus size={20} />,
        name: "Divider",
        description: "Horizontal line separator",
      },
    ],
  },
] as const;

function PreflightRow({ check }: { check: PreflightCheck }) {
  const Icon =
    check.status === "pass"
      ? CheckCircle2
      : check.status === "warn"
        ? AlertTriangle
        : XCircle;
  const color =
    check.status === "pass"
      ? "success.500"
      : check.status === "warn"
        ? "warning.500"
        : "danger.500";

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ color, display: "inline-flex", alignItems: "center" }}>
        <Icon size={16} />
      </Box>
      <Typography level="body-sm">{check.label}</Typography>
      <Typography
        level="body-xs"
        sx={{ color: "neutral.500", ml: "auto", textAlign: "right" }}
      >
        {check.detail}
      </Typography>
    </Stack>
  );
}

function EditorLoadingSkeleton() {
  return (
    <Stack spacing={2}>
      <Sheet
        variant="plain"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "background.surface",
          borderBottom: "1px solid",
          borderColor: "neutral.200",
          py: 1.5,
        }}
      >
        <Stack spacing={1.5}>
          <Skeleton variant="text" width={120} height={14} animation="wave" />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="text" width={220} height={28} animation="wave" />
            <Skeleton
              variant="rectangular"
              width={68}
              height={24}
              animation="wave"
              sx={{ borderRadius: 999 }}
            />
            <Skeleton variant="text" width={120} height={14} animation="wave" />
          </Stack>
        </Stack>
      </Sheet>

      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <JoyCard
          key={sectionIndex}
          variant="outlined"
          sx={{ borderRadius: "lg", boxShadow: "none" }}
        >
          <Stack spacing={2} sx={{ p: 3 }}>
            <Skeleton variant="text" width={140} height={18} animation="wave" />
            {sectionIndex === 2 ? (
              <Skeleton
                variant="rectangular"
                height={400}
                animation="wave"
                sx={{ borderRadius: "md" }}
              />
            ) : sectionIndex === 1 ? (
              <Grid container spacing={2}>
                <Grid xs={12} md={7}>
                  <Stack spacing={2}>
                    <Skeleton
                      variant="rectangular"
                      height={36}
                      animation="wave"
                      sx={{ borderRadius: "sm" }}
                    />
                    <Skeleton
                      variant="rectangular"
                      height={36}
                      animation="wave"
                      sx={{ borderRadius: "sm" }}
                    />
                    <Skeleton
                      variant="rectangular"
                      height={80}
                      animation="wave"
                      sx={{ borderRadius: "sm" }}
                    />
                  </Stack>
                </Grid>
                <Grid xs={12} md={5}>
                  <Skeleton
                    variant="rectangular"
                    height={220}
                    animation="wave"
                    sx={{ borderRadius: "md" }}
                  />
                </Grid>
              </Grid>
            ) : sectionIndex === 3 ? (
              <Stack spacing={1.25}>
                {Array.from({ length: 6 }).map((__, index) => (
                  <Skeleton
                    key={index}
                    variant="text"
                    width="100%"
                    height={18}
                    animation="wave"
                  />
                ))}
                <Skeleton
                  variant="rectangular"
                  height={44}
                  animation="wave"
                  sx={{ borderRadius: "md", mt: 1 }}
                />
              </Stack>
            ) : (
              <Stack spacing={2}>
                {Array.from({ length: 6 }).map((__, index) => (
                  <Skeleton
                    key={index}
                    variant="rectangular"
                    height={36}
                    animation="wave"
                    sx={{ borderRadius: "sm" }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </JoyCard>
      ))}
    </Stack>
  );
}

function AISubjectSuggestionsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { name, subjectLine, audienceCount, updateSetup } = useCampaignEditor();

  const suggestions = React.useMemo(() => {
    const campaignLabel = name.trim() || "Your latest update";
    const audienceLabel = audienceCount
      ? `for ${audienceCount.toLocaleString()} subscribers`
      : "for your audience";

    return [
      `${campaignLabel}: a quick update ${audienceLabel}`,
      `${campaignLabel} is here`,
      `Don’t miss ${campaignLabel.toLowerCase()}`,
      `${campaignLabel} starts now`,
      `A thoughtful note ${audienceLabel}`,
    ];
  }, [audienceCount, name]);

  return (
    <JoyDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="AI Subject Suggestions"
      description="Pick a starting point and refine it before sending."
    >
      <JoyDialogContent>
        <Stack spacing={1.5}>
          {suggestions.map((suggestion) => (
            <Sheet
              key={suggestion}
              variant={suggestion === subjectLine ? "soft" : "outlined"}
              color={suggestion === subjectLine ? "primary" : "neutral"}
              sx={{ borderRadius: "lg", p: 1.5 }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography level="body-sm">{suggestion}</Typography>
                <JoyButton
                  size="sm"
                  variant={suggestion === subjectLine ? "solid" : "soft"}
                  color={suggestion === subjectLine ? "primary" : "neutral"}
                  onClick={() => {
                    updateSetup({ subjectLine: suggestion });
                    onClose();
                  }}
                >
                  Use
                </JoyButton>
              </Stack>
            </Sheet>
          ))}
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton variant="plain" color="neutral" onClick={onClose}>
          Close
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}

function CampaignEditorScreen() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { emailDomains } = useEmailDomains();
  const {
    campaignId,
    campaignType,
    status,
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
    sendAt,
    sendImmediately,
    lastSavedAt,
    isSaving,
    isLoading,
    updateSetup,
    updateAudience,
    updateContent,
    updateSchedule,
  } = useCampaignEditor();

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = React.useState(false);
  const [verificationOpen, setVerificationOpen] = React.useState(false);
  const [aiSubjectOpen, setAiSubjectOpen] = React.useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = React.useState(false);
  const [blockInsertIndex, setBlockInsertIndex] = React.useState<number | null>(
    null,
  );
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showExclusions, setShowExclusions] = React.useState(false);
  const [segmentSearch, setSegmentSearch] = React.useState("");
  const [personaSearch, setPersonaSearch] = React.useState("");
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [previewViewport, setPreviewViewport] =
    React.useState<PreviewViewport>("desktop");
  const [sampleCustomers, setSampleCustomers] = React.useState<
    SampleCustomer[]
  >([]);
  const headerNameRef = React.useRef<HTMLDivElement | null>(null);

  const activeDomains = React.useMemo(
    () =>
      emailDomains.filter((domain) =>
        ["active", "warming_up"].includes(domain.status),
      ),
    [emailDomains],
  );
  const segmentOptionsQuery = useQuery({
    queryKey: ["campaign-editor-segment-options", tenant?.id, segmentSearch],
    enabled: Boolean(tenant?.id),
    queryFn: async (): Promise<CampaignSegmentSummary[]> => {
      if (!tenant?.id) {
        return [];
      }

      const searchTerm = segmentSearch.trim();
      let query = supabase
        .from("crm_segments")
        .select("id, name, description, customer_count, created_at")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`).limit(15);
      } else {
        query = query.limit(5);
      }

      const { data, error } = await query;
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
  const personaOptionsQuery = useQuery({
    queryKey: ["campaign-editor-persona-options", tenant?.id, personaSearch],
    enabled: Boolean(tenant?.id),
    queryFn: async (): Promise<CampaignPersonaSummary[]> => {
      if (!tenant?.id) {
        return [];
      }

      const searchTerm = personaSearch.trim();
      let query = supabase
        .from("crm_personas")
        .select("id, persona_name, persona_description, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.ilike("persona_name", `%${searchTerm}%`).limit(15);
      } else {
        query = query.limit(5);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return (data ?? []).map((persona) => ({
        id: persona.id,
        name: persona.persona_name,
        description: persona.persona_description,
      }));
    },
  });
  const isReadOnly = isReadOnlyStatus(status);
  const typeLocked =
    isReadOnly ||
    hasEmailContent(contentBlocks) ||
    smsMessage.trim().length > 0;
  const segmentOptions = segmentOptionsQuery.data ?? [];
  const personaOptions = React.useMemo(() => {
    const searchTerm = personaSearch.trim().toLowerCase();
    const custom = personaOptionsQuery.data ?? [];
    const systemMatches = searchTerm
      ? SYSTEM_PERSONAS.filter((persona) =>
          persona.persona_name.toLowerCase().includes(searchTerm),
        ).map((persona) => ({
          id: persona.id,
          name: persona.persona_name,
          description: persona.persona_description,
        }))
      : [];

    const seen = new Set<string>();
    const merged = [...systemMatches, ...custom].filter((persona) => {
      if (seen.has(persona.id)) {
        return false;
      }
      seen.add(persona.id);
      return true;
    });

    return merged.slice(0, searchTerm ? 15 : 5);
  }, [personaOptionsQuery.data, personaSearch]);
  const segmentReach = React.useMemo(
    () =>
      selectedSegments.reduce(
        (sum, segment) => sum + segment.customer_count,
        0,
      ),
    [selectedSegments],
  );
  const hasAudienceSelection =
    selectedSegments.length > 0 || selectedPersonas.length > 0;
  const overlapRemoved = Math.max(0, segmentReach - (audienceCount ?? 0));
  const suppressedEstimate = 0;

  React.useEffect(() => {
    if (
      !isEditingName &&
      headerNameRef.current &&
      headerNameRef.current.textContent !== (name || "Untitled campaign")
    ) {
      headerNameRef.current.textContent = name || "Untitled campaign";
    }
  }, [isEditingName, name]);

  React.useEffect(() => {
    let cancelled = false;

    const loadSamples = async () => {
      if (!tenant?.id) {
        if (!cancelled) {
          setSampleCustomers([]);
        }
        return;
      }

      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, first_name, last_name, email")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null)
        .limit(5);

      if (error) {
        console.error("Failed to load sample recipients", error);
        if (!cancelled) {
          setSampleCustomers([]);
        }
        return;
      }

      if (!cancelled) {
        setSampleCustomers((data ?? []) as SampleCustomer[]);
      }
    };

    void loadSamples();

    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  const appendBlock = React.useCallback(
    (kind: string) => {
      if (isReadOnly) {
        return;
      }

      const nextBlock = createManualBlock(kind);
      const nextBlocks = [...contentBlocks];
      const insertAt =
        blockInsertIndex === null ? nextBlocks.length : blockInsertIndex + 1;

      nextBlocks.splice(insertAt, 0, nextBlock);

      updateContent({
        contentBlocks: nextBlocks,
      });
      setBlockInsertIndex(null);
      setBlockPickerOpen(false);
    },
    [blockInsertIndex, contentBlocks, isReadOnly, updateContent],
  );

  const openBlockPicker = React.useCallback(
    (afterIndex?: number) => {
      if (isReadOnly) {
        return;
      }

      setBlockInsertIndex(afterIndex ?? null);
      setBlockPickerOpen(true);
    },
    [isReadOnly],
  );

  const handleGenerateStarterContent = React.useCallback(() => {
    if (isReadOnly) {
      return;
    }

    if (campaignType === "sms") {
      const base = name.trim() || "your latest campaign";
      updateContent({
        smsMessage:
          smsMessage.trim() ||
          `Hi {{first_name}}, here’s an update from ${base}. Reply STOP to opt out.`,
      });
      return;
    }

    if (contentBlocks.length > 0) {
      const nextBlocks = contentBlocks.map((block, index) => {
        if (index > 2) {
          return block;
        }

        const fallbackHeadline =
          index === 0 ? name || "Campaign headline" : `Section ${index + 1}`;
        const fallbackBody =
          index === 0
            ? "Introduce the message and set expectations for the rest of the email."
            : "Add concise supporting copy that moves the reader toward the call to action.";

        return {
          ...block,
          headline: block.headline || fallbackHeadline,
          title: block.title || fallbackHeadline,
          body: block.body || fallbackBody,
          content: block.content || fallbackBody,
          buttonText:
            block.buttonText || (index === 2 ? "Learn more" : block.buttonText),
        };
      });
      updateContent({ contentBlocks: nextBlocks });
      toast.success("Starter copy added to existing blocks");
      return;
    }

    updateContent({
      contentBlocks: [
        {
          ...createManualBlock("hero"),
          headline: name || subjectLine || "Campaign headline",
          subtitle:
            preheaderText ||
            "Use this space to frame the message and why it matters.",
        },
        {
          ...createManualBlock("text"),
          title: "Main message",
          content: "Share the most important update and keep the copy concise.",
          body: "Share the most important update and keep the copy concise.",
        },
        {
          ...createManualBlock("button"),
          heading: "Ready to take action?",
          body: "Point people toward the next step with a single clear CTA.",
          buttonText: "Shop now",
        },
      ],
    });
    toast.success("Starter layout created");
  }, [
    campaignType,
    contentBlocks,
    isReadOnly,
    name,
    preheaderText,
    smsMessage,
    subjectLine,
    updateContent,
  ]);

  const preflightChecks = React.useMemo<PreflightCheck[]>(() => {
    const checks: PreflightCheck[] = [
      {
        id: "name",
        label: "Campaign name",
        detail: name.trim() || "Required",
        status: name.trim() ? "pass" : "fail",
      },
      {
        id: "subject",
        label: "Subject line",
        detail:
          campaignType === "sms"
            ? "Not required for SMS"
            : subjectLine.trim() || "Required",
        status:
          campaignType === "sms" || subjectLine.trim().length > 0
            ? "pass"
            : "fail",
      },
      {
        id: "content",
        label: "Content",
        detail:
          campaignType === "sms"
            ? `${smsMessage.length} characters`
            : `${contentBlocks.length} blocks`,
        status:
          campaignType === "sms"
            ? smsMessage.trim().length > 0
              ? "pass"
              : "fail"
            : contentBlocks.length > 0
              ? "pass"
              : "fail",
      },
      {
        id: "audience",
        label: "Audience",
        detail: `~${(audienceCount ?? 0).toLocaleString()} recipients`,
        status: (audienceCount ?? 0) > 0 ? "pass" : "fail",
      },
      {
        id: "sender",
        label: "Sender domain",
        detail: senderEmail || "Verify sender domain",
        status:
          campaignType === "sms"
            ? "pass"
            : activeDomains.length > 0 && senderEmail
              ? "pass"
              : "warn",
      },
      {
        id: "hygiene",
        label: "List hygiene",
        detail: "Suppression and bounce checks run before activation",
        status: "warn",
      },
      {
        id: "suppression",
        label: "Suppression",
        detail: "Deduping and platform suppressions applied",
        status: "pass",
      },
    ];

    return checks;
  }, [
    activeDomains.length,
    audienceCount,
    campaignType,
    contentBlocks.length,
    name,
    senderEmail,
    smsMessage.length,
    subjectLine,
  ]);

  const allChecksPassed = preflightChecks.every(
    (check) => check.status !== "fail",
  );
  const sendButtonLabel = sendImmediately
    ? `Send to ~${(audienceCount ?? 0).toLocaleString()} Recipients`
    : `Schedule for ${sendAt?.toLocaleString() ?? "later"}`;
  const showActiveSendView =
    isQueuedCampaignStatus(status) || status === CAMPAIGN_STATUS.SENDING;
  const showStateLayoutView =
    status === CAMPAIGN_STATUS.SCHEDULED ||
    status === CAMPAIGN_STATUS.PAUSED ||
    status === CAMPAIGN_STATUS.FAILED ||
    isDeliveredCampaignStatus(status);

  const focusNameField = React.useCallback(() => {
    const element = headerNameRef.current;
    if (!element || isReadOnly) {
      return;
    }

    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isReadOnly]);

  const handleNameBlur = React.useCallback(() => {
    const nextName = headerNameRef.current?.textContent ?? "";
    setIsEditingName(false);
    updateSetup({ name: nextName });
  }, [updateSetup]);

  const handleEditNameClick = React.useCallback(() => {
    if (isReadOnly) {
      return;
    }

    if (isEditingName) {
      headerNameRef.current?.blur();
      return;
    }

    setIsEditingName(true);
    window.setTimeout(() => {
      focusNameField();
    }, 0);
  }, [focusNameField, isEditingName, isReadOnly]);

  const handleNameKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isEditingName) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        headerNameRef.current?.blur();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (headerNameRef.current) {
          headerNameRef.current.textContent = name || "Untitled Campaign";
        }
        setIsEditingName(false);
        headerNameRef.current?.blur();
      }
    },
    [isEditingName, name],
  );

  const renderHeaderActions = () => {
    if (status === CAMPAIGN_STATUS.DRAFT) {
      return (
        <Stack
          spacing={1}
          alignItems={{ xs: "flex-start", lg: "flex-end" }}
          sx={{ mt: 0.5 }}
        >
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            {sendImmediately
              ? `Ready to send to ~${(audienceCount ?? 0).toLocaleString()} recipients`
              : `Ready to schedule for ${sendAt?.toLocaleString() ?? "later"}`}
          </Typography>
          <Stack direction="row" spacing={1}>
            <JoyButton
              variant="soft"
              color="neutral"
              size="sm"
              onClick={() => setScheduleOpen(true)}
            >
              Schedule
            </JoyButton>
            <JoyButton
              variant="solid"
              color="primary"
              size="sm"
              startDecorator={<Send size={16} />}
              onClick={() => setSendConfirmOpen(true)}
              disabled={!allChecksPassed}
            >
              Send
            </JoyButton>
          </Stack>
        </Stack>
      );
    }

    if (isDeliveredCampaignStatus(status)) {
      return (
        <Stack
          spacing={1}
          alignItems={{ xs: "flex-start", lg: "flex-end" }}
          sx={{ mt: 0.5 }}
        >
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Completion details and next actions are shown below.
          </Typography>
        </Stack>
      );
    }

    if (status === CAMPAIGN_STATUS.SENDING || isQueuedCampaignStatus(status)) {
      const isQueued = isQueuedCampaignStatus(status);

      return (
        <Stack
          spacing={1}
          alignItems={{ xs: "flex-start", lg: "flex-end" }}
          sx={{ mt: 0.5 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="body-sm">
              {isQueued ? "Queued..." : "Sending..."}
            </Typography>
          </Stack>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Live progress and controls are shown below.
          </Typography>
        </Stack>
      );
    }

    if (status === CAMPAIGN_STATUS.SCHEDULED) {
      return (
        <Stack
          spacing={1}
          alignItems={{ xs: "flex-start", lg: "flex-end" }}
          sx={{ mt: 0.5 }}
        >
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Scheduled for {sendAt?.toLocaleString() ?? "later"}. Controls are
            shown below.
          </Typography>
        </Stack>
      );
    }

    if (status === CAMPAIGN_STATUS.PAUSED) {
      return (
        <Stack
          spacing={1}
          alignItems={{ xs: "flex-start", lg: "flex-end" }}
          sx={{ mt: 0.5 }}
        >
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Campaign is paused. Resume and report options are shown below.
          </Typography>
        </Stack>
      );
    }

    if (status === CAMPAIGN_STATUS.FAILED) {
      return (
        <Stack
          spacing={1}
          alignItems={{ xs: "flex-start", lg: "flex-end" }}
          sx={{ mt: 0.5 }}
        >
          <Typography
            level="body-sm"
            sx={{
              color: "neutral.500",
              maxWidth: 320,
              textAlign: { lg: "right" },
            }}
          >
            Recovery options are shown below.
          </Typography>
        </Stack>
      );
    }

    return null;
  };

  if (isLoading) {
    return <EditorLoadingSkeleton />;
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ mb: 1 }}>
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
            mb: 1.5,
            "&:hover": { color: "neutral.700" },
          }}
        >
          <ArrowLeft size={14} />
          Back to campaigns
        </Typography>

        <Stack
          direction={{ xs: "column", lg: "row" }}
          alignItems={{ xs: "flex-start", lg: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                minWidth: 0,
                width: "fit-content",
                maxWidth: "100%",
                "&:hover .campaign-editor-name-action": {
                  opacity: 1,
                },
              }}
            >
              <Typography
                ref={headerNameRef}
                level="h3"
                fontWeight="bold"
                component="div"
                contentEditable={isEditingName && !isReadOnly}
                suppressContentEditableWarning
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                sx={{
                  outline: "none",
                  cursor: isReadOnly ? "default" : "text",
                  minWidth: 200,
                  maxWidth: "100%",
                  px: 0.5,
                  mx: -0.5,
                  borderRadius: "xs",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  backgroundColor: isEditingName ? "neutral.50" : "transparent",
                  transition: "background-color 150ms ease, color 150ms ease",
                  "&:hover":
                    !isReadOnly && !isEditingName
                      ? { backgroundColor: "neutral.50" }
                      : undefined,
                }}
              >
                {name || "Untitled Campaign"}
              </Typography>
              {!isReadOnly ? (
                <IconButton
                  className="campaign-editor-name-action"
                  variant="plain"
                  color={isEditingName ? "success" : "neutral"}
                  size="sm"
                  onClick={handleEditNameClick}
                  sx={{
                    opacity: isEditingName ? 1 : 0.4,
                    transition: "all 150ms ease",
                    "&:hover": { opacity: 1 },
                  }}
                >
                  {isEditingName ? <Check size={16} /> : <Pencil size={14} />}
                </IconButton>
              ) : null}
            </Stack>

            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Design your campaign content, select your audience, and send when
              ready.
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: 0.5 }}
            >
              <JoyStatusChip status={status} />
              <JoyChip variant="soft" color="neutral" size="sm">
                {campaignType === "email" ? "Email" : "SMS"}
              </JoyChip>
              <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                {isSaving
                  ? "Saving..."
                  : lastSavedAt
                    ? `Last saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}`
                    : "Not saved yet"}
              </Typography>
            </Stack>
          </Stack>

          {renderHeaderActions()}
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {showActiveSendView ? (
        <CampaignActiveSendView onPreview={() => setPreviewOpen(true)} />
      ) : showStateLayoutView ? (
        <CampaignLockedView
          onPreview={() => setPreviewOpen(true)}
          onReschedule={() => setScheduleOpen(true)}
        />
      ) : (
        <Stack
          spacing={2}
          sx={{ maxWidth: EDITOR_MAX_WIDTH, width: "100%", mx: "auto" }}
        >
          <SectionCard title="Campaign Setup">
            <Stack spacing={2.5}>
              <JoyInput
                label="Campaign name"
                value={name}
                disabled={isReadOnly}
                onValueChange={(value) => updateSetup({ name: value })}
                placeholder="e.g., Spring Sale Newsletter"
              />

              <FormControl size="sm">
                <FormLabel sx={{ fontWeight: "md" }}>Campaign type</FormLabel>
                <CampaignTypeToggle
                  value={campaignType}
                  onChange={(value) => updateSetup({ campaignType: value })}
                  disabled={typeLocked}
                />
                {typeLocked ? (
                  <Typography
                    level="body-xs"
                    sx={{ color: "neutral.400", mt: 0.5 }}
                  >
                    Type is locked once content exists.
                  </Typography>
                ) : null}
              </FormControl>

              {campaignType === "email" ? (
                <Stack spacing={0.75}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    alignItems={{ md: "center" }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <JoyInput
                        label="Subject line"
                        value={subjectLine}
                        disabled={isReadOnly}
                        onValueChange={(value) =>
                          updateSetup({ subjectLine: value })
                        }
                        placeholder="What will your recipients see?"
                      />
                    </Box>
                    <JoyButton
                      variant="plain"
                      color="primary"
                      size="sm"
                      startDecorator={<Sparkles size={16} />}
                      onClick={() => setAiSubjectOpen(true)}
                      disabled={isReadOnly}
                    >
                      Suggest
                    </JoyButton>
                  </Stack>
                  <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                    {subjectLine.length} characters
                  </Typography>
                </Stack>
              ) : (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "md", p: 1.5 }}
                >
                  <Typography level="body-sm">
                    SMS campaigns keep setup light. Subject line and preheader
                    aren’t required.
                  </Typography>
                </Sheet>
              )}

              <Box>
                <JoyButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  endDecorator={
                    showAdvanced ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )
                  }
                  onClick={() => setShowAdvanced((current) => !current)}
                  sx={{ px: 0, fontWeight: "md", color: "neutral.600" }}
                >
                  Advanced setup
                </JoyButton>

                <Box
                  sx={{
                    overflow: "hidden",
                    maxHeight: showAdvanced ? 640 : 0,
                    opacity: showAdvanced ? 1 : 0,
                    transition: "max-height 220ms ease, opacity 160ms ease",
                  }}
                >
                  <Stack spacing={2.5} sx={{ pt: showAdvanced ? 2 : 0 }}>
                    {campaignType === "email" ? (
                      <>
                        <Stack spacing={0.75}>
                          <JoyInput
                            label="Preheader"
                            value={preheaderText}
                            disabled={isReadOnly}
                            onValueChange={(value) =>
                              updateSetup({ preheaderText: value })
                            }
                            placeholder="Preview text shown in email clients"
                          />
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.400" }}
                          >
                            Appears after the subject line in the inbox preview.
                          </Typography>
                        </Stack>

                        <Grid container spacing={2}>
                          <Grid xs={12} md={6}>
                            <JoyInput
                              label="Sender name"
                              value={senderName}
                              disabled={isReadOnly}
                              onValueChange={(value) =>
                                updateSetup({ senderName: value })
                              }
                            />
                          </Grid>
                          <Grid xs={12} md={6}>
                            <JoySelect
                              label="Sender email"
                              value={senderEmail}
                              disabled={isReadOnly}
                              onValueChange={(value) =>
                                updateSetup({ senderEmail: value })
                              }
                              options={activeDomains.map((domain) => ({
                                value:
                                  domain.default_from_email ||
                                  `mail@${domain.domain}`,
                                label:
                                  domain.default_from_email ||
                                  `mail@${domain.domain}`,
                              }))}
                              placeholder={
                                activeDomains.length === 0
                                  ? "Select verified domain"
                                  : undefined
                              }
                            />
                            {activeDomains.length === 0 ? (
                              <Typography
                                level="body-xs"
                                sx={{
                                  color: "primary.600",
                                  mt: 0.75,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                onClick={() => setVerificationOpen(true)}
                              >
                                Verify a sender domain
                              </Typography>
                            ) : null}
                          </Grid>
                        </Grid>

                        <JoyInput
                          label="Reply-to"
                          type="email"
                          value={replyTo}
                          disabled={isReadOnly}
                          onValueChange={(value) =>
                            updateSetup({ replyTo: value })
                          }
                          placeholder="Defaults to sender email"
                        />
                      </>
                    ) : null}
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </SectionCard>

          <SectionCard
            title="Audience"
            endDecorator={
              <JoyChip size="sm" variant="soft" color="neutral">
                {isAudienceLoading
                  ? "Calculating"
                  : `~${(audienceCount ?? 0).toLocaleString()}`}
              </JoyChip>
            }
          >
            <Grid container spacing={3} alignItems="start">
              <Grid xs={12} md={7}>
                <Stack spacing={2.5}>
                  <JoyAutocomplete
                    multiple
                    disabled={isReadOnly}
                    loading={segmentOptionsQuery.isLoading}
                    options={segmentOptions}
                    value={selectedSegments}
                    label="Target segments"
                    placeholder="Search segments..."
                    onInputChange={(_event, value) => setSegmentSearch(value)}
                    filterOptions={(options) => options}
                    noOptionsText={
                      segmentSearch.trim()
                        ? "No segments found"
                        : "Type to search..."
                    }
                    getOptionLabel={(option) =>
                      `${option.name} (${option.customer_count.toLocaleString()})`
                    }
                    isOptionEqualToValue={(option, value) =>
                      option.id === value.id
                    }
                    renderTags={(value, getTagProps) =>
                      value.map((segment, index) => (
                        <JoyChip
                          key={segment.id}
                          size="sm"
                          variant="soft"
                          color="neutral"
                          endDecorator={<XCircle size={12} />}
                          {...getTagProps({ index })}
                        >
                          {segment.name}
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.400", ml: 0.5 }}
                          >
                            ({segment.customer_count.toLocaleString()})
                          </Typography>
                        </JoyChip>
                      ))
                    }
                    onChange={(_event, value) =>
                      updateAudience({ selectedSegments: value })
                    }
                  />

                  <JoyAutocomplete
                    multiple
                    disabled={isReadOnly}
                    loading={personaOptionsQuery.isLoading}
                    options={personaOptions}
                    value={selectedPersonas}
                    label="Target personas"
                    placeholder="Search personas..."
                    onInputChange={(_event, value) => setPersonaSearch(value)}
                    filterOptions={(options) => options}
                    noOptionsText={
                      personaSearch.trim()
                        ? "No personas found"
                        : "Type to search..."
                    }
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) =>
                      option.id === value.id
                    }
                    renderTags={(value, getTagProps) =>
                      value.map((persona, index) => (
                        <JoyChip
                          key={persona.id}
                          size="sm"
                          variant="soft"
                          color="neutral"
                          endDecorator={<XCircle size={12} />}
                          {...getTagProps({ index })}
                        >
                          {persona.name}
                        </JoyChip>
                      ))
                    }
                    onChange={(_event, value) =>
                      updateAudience({ selectedPersonas: value })
                    }
                  />

                  <Box>
                    <JoyButton
                      variant="plain"
                      color="neutral"
                      size="sm"
                      endDecorator={
                        showExclusions ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      }
                      onClick={() => setShowExclusions((current) => !current)}
                      sx={{ px: 0 }}
                    >
                      Exclusions
                    </JoyButton>
                    {showExclusions ? (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          Exclusion targeting is preserved for a follow-on
                          milestone. Current sends still respect platform
                          suppressions and opt-outs.
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                </Stack>
              </Grid>

              <Grid xs={12} md={5}>
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{
                    borderRadius: "lg",
                    p: 2.5,
                    position: { md: "sticky" },
                    top: { md: 88 },
                  }}
                >
                  <Stack spacing={2}>
                    <Box>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{ mb: 0.5 }}
                      >
                        <Users
                          size={16}
                          style={{ color: "var(--joy-palette-neutral-500)" }}
                        />
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          Audience Preview
                        </Typography>
                      </Stack>
                      <Typography
                        level="h2"
                        fontWeight="bold"
                        sx={{
                          color:
                            (audienceCount ?? 0) === 0
                              ? "warning.600"
                              : "neutral.800",
                        }}
                      >
                        {isAudienceLoading ? (
                          <Skeleton width={72} height={38} />
                        ) : (
                          `~${(audienceCount ?? 0).toLocaleString()}`
                        )}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        Deduped recipients across selected segments and
                        personas.
                      </Typography>
                    </Box>

                    <Divider />

                    <Stack spacing={0.75}>
                      {[
                        {
                          label: "Segment reach",
                          value: segmentReach.toLocaleString(),
                        },
                        {
                          label: "Personas",
                          value: selectedPersonas.length.toLocaleString(),
                        },
                        {
                          label: "Overlap removed",
                          value: overlapRemoved.toLocaleString(),
                        },
                        {
                          label: "Suppressed",
                          value: suppressedEstimate.toLocaleString(),
                        },
                      ].map(({ label, value }) => (
                        <Stack
                          key={label}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            {label}
                          </Typography>
                          <Typography level="body-xs" fontWeight="md">
                            {value}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>

                    {(audienceCount ?? 0) === 0 &&
                    !isAudienceLoading &&
                    hasAudienceSelection ? (
                      <>
                        <Divider />
                        <Sheet
                          variant="soft"
                          color="warning"
                          sx={{ borderRadius: "md", p: 1.5 }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="flex-start"
                          >
                            <AlertTriangle
                              size={14}
                              style={{
                                color: "var(--joy-palette-warning-600)",
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                            />
                            <Typography
                              level="body-xs"
                              sx={{ color: "warning.700" }}
                            >
                              No recipients currently match this audience.
                            </Typography>
                          </Stack>
                        </Sheet>
                      </>
                    ) : null}

                    {sampleCustomers.length > 0 ? (
                      <>
                        <Divider />
                        <Box>
                          <Typography
                            level="body-xs"
                            fontWeight="md"
                            sx={{ mb: 1 }}
                          >
                            Sample recipients
                          </Typography>
                          <Stack spacing={0.75}>
                            {sampleCustomers.slice(0, 5).map((customer) => {
                              const label = displayName(customer);
                              return (
                                <Stack
                                  key={customer.id}
                                  direction="row"
                                  spacing={1.5}
                                  alignItems="center"
                                >
                                  <Avatar
                                    sx={{
                                      "--Avatar-size": "24px",
                                      fontSize: "0.65rem",
                                    }}
                                  >
                                    {label.charAt(0).toUpperCase() || "?"}
                                  </Avatar>
                                  <Stack spacing={0}>
                                    <Typography
                                      level="body-xs"
                                      fontWeight="md"
                                      sx={{ lineHeight: 1.2 }}
                                    >
                                      {label}
                                    </Typography>
                                    <Typography
                                      level="body-xs"
                                      sx={{
                                        color: "neutral.400",
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {customer.email}
                                    </Typography>
                                  </Stack>
                                </Stack>
                              );
                            })}
                          </Stack>
                        </Box>
                      </>
                    ) : null}
                  </Stack>
                </Sheet>
              </Grid>
            </Grid>
          </SectionCard>

          <JoyCard
            variant="outlined"
            sx={{
              borderRadius: "lg",
              overflow: "hidden",
              borderColor: "neutral.200",
              mt: 2,
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.25,
                borderBottom: "1px solid",
                borderColor: "neutral.100",
                backgroundColor: "neutral.50",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                flexWrap: "nowrap",
                minHeight: 44,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <Typography
                  level="title-sm"
                  fontWeight="lg"
                  sx={{ flexShrink: 0 }}
                >
                  Content
                </Typography>
              </Stack>

              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  flexShrink: 0,
                  minWidth: 0,
                  overflowX: "auto",
                  overflowY: "hidden",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                {campaignType === "email" ? (
                  <JoyButton
                    variant="solid"
                    color="primary"
                    size="sm"
                    startDecorator={<Sparkles size={16} />}
                    onClick={handleGenerateStarterContent}
                    sx={{
                      fontWeight: "lg",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      ml: 0.75,
                      boxShadow: "sm",
                    }}
                    disabled={isReadOnly}
                  >
                    AI Writer
                  </JoyButton>
                ) : null}
                {campaignType === "sms" ? (
                  <JoyButton
                    variant="plain"
                    color="neutral"
                    size="sm"
                    startDecorator={<Eye size={16} />}
                    onClick={() => setPreviewOpen(true)}
                    sx={{
                      fontWeight: "md",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Preview
                  </JoyButton>
                ) : null}
                {campaignType === "email" ? (
                  <ToggleButtonGroup
                    size="sm"
                    value={previewViewport}
                    onChange={(_event, value) =>
                      value && setPreviewViewport(value)
                    }
                    sx={{
                      flexShrink: 0,
                      "--ToggleButtonGroup-radius": "8px",
                      "--ToggleButtonGroup-gap": "0px",
                      backgroundColor: "background.surface",
                      border: "1px solid",
                      borderColor: "neutral.200",
                      p: "2px",
                    }}
                  >
                    <IconButton value="desktop" sx={PREVIEW_TOGGLE_BUTTON_SX}>
                      <Monitor size={14} />
                    </IconButton>
                    <IconButton value="mobile" sx={PREVIEW_TOGGLE_BUTTON_SX}>
                      <Smartphone size={14} />
                    </IconButton>
                  </ToggleButtonGroup>
                ) : null}
              </Stack>
            </Box>

            <Box sx={{ p: 3 }}>
              {campaignType === "email" ? (
                contentBlocks.length === 0 ? (
                  <Box
                    sx={{
                      py: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "12px",
                        backgroundColor: "neutral.100",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LayoutTemplate
                        size={24}
                        style={{ color: "var(--joy-palette-neutral-400)" }}
                      />
                    </Box>
                    <Typography level="body-sm" fontWeight="md">
                      Start building your email
                    </Typography>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: "neutral.500",
                        textAlign: "center",
                        maxWidth: 280,
                      }}
                    >
                      Choose a block layout to begin designing your campaign
                      content.
                    </Typography>
                    <JoyButton
                      variant="solid"
                      color="primary"
                      size="sm"
                      startDecorator={<Plus size={16} />}
                      onClick={() => openBlockPicker()}
                      sx={{ mt: 1 }}
                      disabled={isReadOnly}
                    >
                      Add your first block
                    </JoyButton>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Box
                      sx={{
                        width:
                          previewViewport === "mobile"
                            ? "min(420px, 100%)"
                            : "100%",
                        transition: "width 160ms ease",
                        ...(isReadOnly
                          ? {
                              pointerEvents: "none",
                              opacity: 0.72,
                            }
                          : {}),
                      }}
                    >
                      <CleanEmailBlockEditor
                        blocks={contentBlocks}
                        campaignId={campaignId ?? undefined}
                        campaignName={name}
                        onRequestAddBlock={openBlockPicker}
                        onBlocksChange={(blocks) =>
                          updateContent({ contentBlocks: blocks })
                        }
                      />
                    </Box>
                  </Box>
                )
              ) : (
                <Stack spacing={2}>
                  <JoyTextarea
                    label="SMS message"
                    minRows={8}
                    disabled={isReadOnly}
                    value={smsMessage}
                    onValueChange={(value) =>
                      updateContent({ smsMessage: value })
                    }
                  />
                  <Sheet
                    variant="soft"
                    color="neutral"
                    sx={{ borderRadius: "lg", p: 2 }}
                  >
                    <Stack spacing={0.75}>
                      <Typography level="body-sm">
                        Characters: {smsMessage.length}
                      </Typography>
                      <Typography level="body-sm">
                        SMS segments: {computeSmsSegments(smsMessage)}
                      </Typography>
                      <Typography level="body-sm">
                        Opt-out reminder: include STOP instructions where
                        required.
                      </Typography>
                    </Stack>
                  </Sheet>
                </Stack>
              )}
            </Box>
          </JoyCard>

          <SectionCard title="Review & Send">
            <Stack spacing={1.25}>
              {preflightChecks.map((check) => (
                <PreflightRow key={check.id} check={check} />
              ))}
            </Stack>

            <Divider />

            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              {sendImmediately
                ? "Send immediately"
                : `Scheduled for ${sendAt?.toLocaleString() ?? "later"}`}
            </Typography>

            {!isReadOnly ? (
              <JoyButton
                variant="solid"
                color="primary"
                size="lg"
                fullWidth
                startDecorator={<Send size={18} />}
                onClick={() => setSendConfirmOpen(true)}
                disabled={!allChecksPassed}
              >
                {sendButtonLabel}
              </JoyButton>
            ) : (
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "md", p: 1.5 }}
              >
                <Typography level="body-sm">
                  This campaign is locked for editing while it remains {status}.
                </Typography>
              </Sheet>
            )}
          </SectionCard>
        </Stack>
      )}

      <JoyDialog
        open={blockPickerOpen}
        onClose={() => {
          setBlockPickerOpen(false);
          setBlockInsertIndex(null);
        }}
        size="lg"
        title="Choose a block"
        description="Curated layouts for polished, email-safe campaigns."
        dialogSx={{ maxWidth: 720, width: "calc(100vw - 2rem)" }}
      >
        <JoyDialogContent sx={{ p: 3 }}>
          <Stack spacing={3}>
            {BLOCK_PICKER_SECTIONS.map((section) => (
              <Box key={section.heading}>
                <Typography
                  level="body-xs"
                  fontWeight="lg"
                  sx={{
                    color: "neutral.500",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    mb: 1.5,
                  }}
                >
                  {section.heading}
                </Typography>
                <Grid container spacing={1.5}>
                  {section.items.map((item) => (
                    <Grid key={item.id} xs={12} md={4}>
                      <BlockPickerCard
                        icon={item.icon}
                        name={item.name}
                        description={item.description}
                        badge={item.badge}
                        onClick={() => appendBlock(item.id)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton
            variant="plain"
            color="neutral"
            onClick={() => {
              setBlockPickerOpen(false);
              setBlockInsertIndex(null);
            }}
          >
            Close
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <CampaignPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
      <CampaignScheduleDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        canConfirm={allChecksPassed}
        onSendNow={() => {
          updateSchedule({ sendImmediately: true, sendAt: null });
          setSendConfirmOpen(true);
        }}
        onSchedule={(scheduledDateTime) => {
          updateSchedule({ sendImmediately: false, sendAt: scheduledDateTime });
          setSendConfirmOpen(true);
        }}
      />
      <CampaignSendConfirmation
        open={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
      />
      <SenderVerificationDialog
        open={verificationOpen}
        onClose={() => setVerificationOpen(false)}
      />
      <AISubjectSuggestionsDialog
        open={aiSubjectOpen}
        onClose={() => setAiSubjectOpen(false)}
      />
    </Stack>
  );
}

export default function CRMCampaignEditorPage() {
  const { campaignId } = useParams<{ campaignId: string }>();

  return (
    <CampaignEditorProvider campaignId={campaignId}>
      <PageContainer sx={{ maxWidth: `${EDITOR_MAX_WIDTH}px`, mx: "auto" }}>
        <CampaignEditorScreen />
      </PageContainer>
    </CampaignEditorProvider>
  );
}
