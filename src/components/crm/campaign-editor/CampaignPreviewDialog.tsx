import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Mail,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
  User,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailBlockRenderer } from "@/components/crm/EmailBlockRenderer";
import { JoyDialog, JoyDialogContent } from "@/components/joy/JoyDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";
import { isUuidLike } from "@/lib/computeAudienceRecipientCount";
import type {
  ContentBlock,
  EmailBlock,
  GlobalSettings,
} from "@/types/emailBuilder";
import { normalizeBlockForSave } from "@/utils/blockFieldMapping";

const PAGE_SIZE = 1000;

const SAMPLE_PREVIEW_CUSTOMER = {
  first_name: "Jane",
  last_name: "Gardener",
  email: "jane@example.com",
  phone: "(555) 123-4567",
};

type PreviewCustomer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type PreviewDiagnostics = {
  usedTags: string[];
  missingTags: string[];
  emptyResolvedTags: string[];
  legacyTagsConverted: number;
};

type PreviewTab = "preview" | "send-test";
type SendTestState =
  | { tone: "neutral"; message: string }
  | { tone: "success"; message: string }
  | { tone: "danger"; message: string };

type PreviewCompanyInfo = ReturnType<typeof useCompanyInfo>["companyInfo"];

function chunkIds(ids: string[], size = 200) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

async function fetchIdsPaged(
  queryFactory: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: Array<Record<string, unknown>> | null;
    error: Error | null;
  }>,
  rowToId: (row: Record<string, unknown>) => string | null,
) {
  const ids = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) {
      throw error;
    }

    (data ?? []).forEach((row) => {
      const nextId = rowToId(row);
      if (nextId) {
        ids.add(nextId);
      }
    });

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return ids;
}

async function fetchFirstPreviewCustomer(params: {
  tenantId: string;
  segmentIds: string[];
  personaIds: string[];
}) {
  const { tenantId, segmentIds, personaIds } = params;

  if (segmentIds.length === 0 && personaIds.length === 0) {
    return null;
  }

  let allowedCustomerIds: string[] | null = null;

  if (segmentIds.length > 0) {
    const segmentCustomerIds = await fetchIdsPaged(
      (from, to) =>
        supabase
          .from("customer_segments")
          .select("customer_id")
          .in("segment_id", segmentIds)
          .range(from, to),
      (row) => {
        const customerId = String(row.customer_id || "");
        return isUuidLike(customerId) ? customerId : null;
      },
    );
    allowedCustomerIds = Array.from(segmentCustomerIds);
  }

  if (personaIds.length > 0) {
    const personaCustomerIds = new Set<string>();
    const customPersonaIds = personaIds.filter(isUuidLike);
    const predefinedPersonaIds = personaIds.filter(
      (personaId) => !isUuidLike(personaId),
    );

    if (customPersonaIds.length > 0) {
      const linkedPersonaCustomerIds = await fetchIdsPaged(
        (from, to) =>
          supabase
            .from("customer_personas")
            .select("customer_id")
            .in("persona_id", customPersonaIds)
            .range(from, to),
        (row) => {
          const customerId = String(row.customer_id || "");
          return isUuidLike(customerId) ? customerId : null;
        },
      );

      linkedPersonaCustomerIds.forEach((customerId) => {
        personaCustomerIds.add(customerId);
      });

      const directPersonaCustomerIds = await fetchIdsPaged(
        (from, to) =>
          supabase
            .from("crm_customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .in("persona_id", customPersonaIds)
            .range(from, to),
        (row) => {
          const customerId = String(row.id || "");
          return isUuidLike(customerId) ? customerId : null;
        },
      );

      directPersonaCustomerIds.forEach((customerId) => {
        personaCustomerIds.add(customerId);
      });
    }

    if (predefinedPersonaIds.length > 0) {
      const predefinedMatches = await fetchIdsPaged(
        (from, to) =>
          supabase
            .from("customer_personas")
            .select("customer_id")
            .in("predefined_persona_id", predefinedPersonaIds)
            .range(from, to),
        (row) => {
          const customerId = String(row.customer_id || "");
          return isUuidLike(customerId) ? customerId : null;
        },
      );

      predefinedMatches.forEach((customerId) => {
        personaCustomerIds.add(customerId);
      });
    }

    const nextPersonaCustomerIds = Array.from(personaCustomerIds);
    if (allowedCustomerIds === null) {
      allowedCustomerIds = nextPersonaCustomerIds;
    } else {
      const personaIdSet = new Set(nextPersonaCustomerIds);
      allowedCustomerIds = allowedCustomerIds.filter((customerId) =>
        personaIdSet.has(customerId),
      );
    }
  }

  if (allowedCustomerIds && allowedCustomerIds.length === 0) {
    return null;
  }

  const customerIdChunks = allowedCustomerIds
    ? chunkIds(allowedCustomerIds)
    : [[]];

  for (const customerIdChunk of customerIdChunks) {
    let query = supabase
      .from("crm_customers")
      .select("id, first_name, last_name, email, phone")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (customerIdChunk.length > 0) {
      query = query.in("id", customerIdChunk);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const firstCustomer = data?.[0] as PreviewCustomer | undefined;
    if (firstCustomer) {
      return firstCustomer;
    }
  }

  return null;
}

function formatPreviewRecipient(
  customer: Pick<PreviewCustomer, "first_name" | "last_name" | "email">,
) {
  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName && customer.email) {
    return `${fullName} (${customer.email})`;
  }

  return fullName || customer.email || "Sample customer";
}

function buildPreviewGlobalSettings(
  companyInfo: PreviewCompanyInfo,
): GlobalSettings {
  const fontFamily =
    companyInfo.selectedFont?.fontFamilyCss ||
    companyInfo.bodyFont?.fontFamilyCss ||
    "Arial, sans-serif";

  return {
    fontFamily,
    fontSize: "16px",
    headlineFont: companyInfo.headlineFont?.fontFamilyCss,
    subheadingFont: companyInfo.subheadingFont?.fontFamilyCss,
    bodyFont: companyInfo.bodyFont?.fontFamilyCss,
    buttonFont: companyInfo.buttonFont?.fontFamilyCss,
    buttonStyle: {
      cornerRadius: "6px",
      backgroundColor: companyInfo.brandPrimaryColor || "#22C55E",
      textColor: "#FFFFFF",
    },
    headerStyle: {
      backgroundColor: companyInfo.brandPrimaryColor || "#1F2937",
      textColor: companyInfo.brandTextColor || "#FFFFFF",
    },
    footerStyle: {
      backgroundColor:
        companyInfo.brandFooterColors?.backgroundColor || "#F8F9FA",
      textColor: companyInfo.brandFooterColors?.textColor || "#6B7280",
    },
  };
}

function renderImageTextBlock(
  block: ContentBlock,
  globalSettings: GlobalSettings,
) {
  const title =
    block.title || block.headline || block.heading || "Untitled section";
  const body = block.body || block.content || "";
  const imageUrl = block.imageUrl || block.backgroundImageUrl || "";
  const buttonText = block.buttonText || block.ctaText || "";
  const buttonUrl = block.buttonUrl || block.ctaUrl || "#";
  const reverseLayout = block.layout === "two-column-right";
  const isStacked = block.layout === "full-width" || !imageUrl;
  const textFont = globalSettings.bodyFont || globalSettings.fontFamily;
  const headingFont =
    globalSettings.subheadingFont || globalSettings.fontFamily;

  const imageNode = imageUrl ? (
    <div style={{ flex: isStacked ? undefined : "0 0 46%", minWidth: 0 }}>
      <img
        src={imageUrl}
        alt={block.altText || title}
        style={{
          width: "100%",
          display: "block",
          borderRadius: "12px",
          objectFit: "cover",
        }}
      />
    </div>
  ) : null;

  const copyNode = (
    <div style={{ flex: 1, minWidth: 0 }}>
      {title ? (
        <h2
          style={{
            margin: 0,
            marginBottom: body ? "12px" : 0,
            fontSize: "1.5rem",
            fontWeight: 700,
            fontFamily: headingFont,
            color: "#111827",
          }}
        >
          {title}
        </h2>
      ) : null}
      {body ? (
        <p
          style={{
            margin: 0,
            color: "#374151",
            lineHeight: 1.7,
            fontFamily: textFont,
            whiteSpace: "pre-wrap",
          }}
        >
          {body}
        </p>
      ) : null}
      {buttonText ? (
        <div style={{ marginTop: "16px" }}>
          <a
            href={buttonUrl}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              borderRadius: globalSettings.buttonStyle.cornerRadius,
              backgroundColor: globalSettings.buttonStyle.backgroundColor,
              color: globalSettings.buttonStyle.textColor,
              textDecoration: "none",
              fontWeight: 700,
              fontFamily:
                globalSettings.buttonFont || globalSettings.fontFamily,
            }}
          >
            {buttonText}
          </a>
        </div>
      ) : null}
    </div>
  );

  return renderToStaticMarkup(
    <div
      style={{
        padding: "24px",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isStacked
            ? "column"
            : reverseLayout
              ? "row-reverse"
              : "row",
          gap: "24px",
          alignItems: "center",
        }}
      >
        {imageNode}
        {copyNode}
      </div>
    </div>,
  );
}

function toEmailBlock(block: ContentBlock, index: number): EmailBlock {
  const normalized = normalizeBlockForSave(block, index);

  return {
    id: block.id,
    campaign_id: "preview",
    created_at: undefined,
    updated_at: undefined,
    ...normalized,
  };
}

// Wrap a server-rendered email fragment in the iframe-presentation skeleton
// (gray page background, centered card, drop shadow, hidden preheader).
// The edge-function-rendered fragment is the source of truth for block
// content, merge-tag resolution, and footer; this only adds the visual
// "inbox-like" framing for the dialog's iframe.
function wrapServerRenderedHtml(
  fragment: string,
  preheaderText: string,
): string {
  const safePreheader = preheaderText.trim();
  const hiddenPreheader = safePreheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${safePreheader.replace(/[<>&"']/g, (c) => ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!)}</div>`
    : "";

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#F3F4F6;padding:24px 12px;">
      ${hiddenPreheader}
      <div style="max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(15, 23, 42, 0.08);">
        ${fragment}
      </div>
    </body>
  </html>`;
}

// DEPRECATED for the preview pane (Phase 1 of the preview-vs-send fix).
// Still used by the Send Test path, which posts pre-rendered HTML to
// send-test-email-v2. The preview pane now sends raw contentBlocks to
// render-email-preview and wraps the response with wrapServerRenderedHtml
// above. Kept here so Send Test continues to work; will follow the same
// edge-function migration in a separate change.
function buildPreviewHtml(
  blocks: ContentBlock[],
  preheaderText: string,
  globalSettings: GlobalSettings,
) {
  const hiddenPreheader = preheaderText.trim()
    ? renderToStaticMarkup(
        <div
          style={{
            display: "none",
            fontSize: "1px",
            lineHeight: "1px",
            maxHeight: "0px",
            maxWidth: "0px",
            opacity: 0,
            overflow: "hidden",
            msoHide: "all",
          }}
        >
          {preheaderText}
        </div>,
      )
    : "";

  const sections =
    blocks.length > 0
      ? blocks
          .map((block, index) => {
            if (block.type === "image-text") {
              return renderImageTextBlock(block, globalSettings);
            }

            return renderToStaticMarkup(
              <div style={{ borderBottom: "1px solid #E5E7EB" }}>
                <EmailBlockRenderer
                  block={toEmailBlock(block, index)}
                  globalSettings={globalSettings}
                  isPreview={false}
                />
              </div>,
            );
          })
          .join("")
      : renderToStaticMarkup(
          <div
            style={{
              padding: "24px",
              paddingTop: "48px",
              paddingBottom: "48px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily:
                  globalSettings.bodyFont || globalSettings.fontFamily,
                color: "#4B5563",
              }}
            >
              No email content yet.
            </p>
          </div>,
        );

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#F3F4F6;padding:24px 12px;">
      ${hiddenPreheader}
      <div style="max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(15, 23, 42, 0.08);">
        ${sections}
      </div>
    </body>
  </html>`;
}

export function CampaignPreviewDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const { companyInfo } = useCompanyInfo();
  const {
    campaignType,
    status,
    contentBlocks,
    smsMessage,
    subjectLine,
    preheaderText,
    selectedSegments,
    selectedPersonas,
  } = useCampaignEditor();
  const [viewMode, setViewMode] = React.useState<"desktop" | "mobile">(
    "desktop",
  );
  const [isRendering, setIsRendering] = React.useState(false);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = React.useState<string | null>(null);
  const [renderedSubject, setRenderedSubject] = React.useState<string | null>(
    null,
  );
  const [diagnostics, setDiagnostics] =
    React.useState<PreviewDiagnostics | null>(null);
  const [activeTab, setActiveTab] = React.useState<PreviewTab>("preview");
  const [testEmail, setTestEmail] = React.useState("");
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [sendTestState, setSendTestState] =
    React.useState<SendTestState | null>(null);
  const renderRequestIdRef = React.useRef(0);

  const segmentIds = React.useMemo(
    () => selectedSegments.map((segment) => segment.id),
    [selectedSegments],
  );
  const personaIds = React.useMemo(
    () => selectedPersonas.map((persona) => persona.id),
    [selectedPersonas],
  );
  const hasAudienceSelection = segmentIds.length > 0 || personaIds.length > 0;

  const previewCustomerQuery = useQuery({
    queryKey: ["campaign-preview-customer", tenant?.id, segmentIds, personaIds],
    enabled:
      open &&
      campaignType === "email" &&
      hasAudienceSelection &&
      Boolean(tenant?.id),
    staleTime: 60000,
    queryFn: () =>
      fetchFirstPreviewCustomer({
        tenantId: tenant?.id as string,
        segmentIds,
        personaIds,
      }),
  });

  const previewGlobalSettings = React.useMemo(
    () => buildPreviewGlobalSettings(companyInfo),
    [companyInfo],
  );
  const previewHtml = React.useMemo(() => {
    if (campaignType !== "email") {
      return "";
    }

    return buildPreviewHtml(
      contentBlocks,
      preheaderText,
      previewGlobalSettings,
    );
  }, [campaignType, contentBlocks, preheaderText, previewGlobalSettings]);

  const previewCustomer = previewCustomerQuery.data ?? null;
  const previewRecipientLabel = previewCustomer
    ? formatPreviewRecipient(previewCustomer)
    : formatPreviewRecipient(SAMPLE_PREVIEW_CUSTOMER);
  const hasDiagnosticsWarning =
    (diagnostics?.missingTags.length ?? 0) > 0 ||
    (diagnostics?.emptyResolvedTags.length ?? 0) > 0;
  const canSendTest =
    campaignType === "email" && (status === "draft" || status === "scheduled");

  const validateEmail = React.useCallback((value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }, []);

  const sendTestEmail = React.useCallback(async () => {
    const email = testEmail.trim();

    if (!email) {
      setSendTestState({
        tone: "danger",
        message: "Enter an email address to send a test.",
      });
      return;
    }

    if (!validateEmail(email)) {
      setSendTestState({
        tone: "danger",
        message: "Enter a valid email address.",
      });
      return;
    }

    setIsSendingTest(true);
    setSendTestState(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "send-test-email-v2",
        {
          body: {
            toEmail: email,
            subject: subjectLine || "Test Email Campaign",
            html: previewHtml,
            sampleCustomer: SAMPLE_PREVIEW_CUSTOMER,
          },
        },
      );

      if (error) {
        setSendTestState({
          tone: "danger",
          message: "Unable to reach test email service. Try again.",
        });
        return;
      }

      if (data?.success) {
        setSendTestState({
          tone: "success",
          message: `Test email sent to ${email}.`,
        });
        return;
      }

      setSendTestState({
        tone: "danger",
        message:
          (typeof data?.error === "string" && data.error) ||
          "Test email failed. Check sender configuration and try again.",
      });
    } catch (error) {
      setSendTestState({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unexpected error while sending test email.",
      });
    } finally {
      setIsSendingTest(false);
    }
  }, [previewHtml, subjectLine, testEmail, validateEmail]);

  React.useEffect(() => {
    if (!open || campaignType !== "email") {
      return;
    }

    let cancelled = false;

    const loadSignedInEmail = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user?.email) {
        return;
      }

      setTestEmail((current) =>
        current.trim() ? current : (user.email ?? ""),
      );
    };

    void loadSignedInEmail();

    return () => {
      cancelled = true;
    };
  }, [campaignType, open]);

  const renderPreview = React.useCallback(async () => {
    if (campaignType !== "email") {
      return;
    }

    const requestId = ++renderRequestIdRef.current;
    setIsRendering(true);
    setRenderError(null);

    try {
      // No content yet — skip the edge call and let the renderedHtml-null
      // branch below fall through to the iframe loading-skeleton state. The
      // edge function would 400 on an empty payload anyway.
      if (!Array.isArray(contentBlocks) || contentBlocks.length === 0) {
        if (requestId !== renderRequestIdRef.current) {
          return;
        }
        setRenderedHtml(
          wrapServerRenderedHtml(
            `<div style="padding:48px 24px;font-family:Arial,sans-serif;color:#4B5563;">No email content yet.</div>`,
            preheaderText,
          ),
        );
        setRenderedSubject(null);
        setDiagnostics(null);
        return;
      }

      // Phase 1 of the preview-vs-send fix: send raw contentBlocks to
      // render-email-preview so the edge function uses the SAME renderer
      // (renderContentBlocksToEmailHtml in supabase/functions/_shared/
      // campaignEmailSource.ts) that the send pipeline uses. The edge
      // function then layers merge-tag resolution and the auto-injected
      // compliance footer on top, returning a complete email-body fragment.
      // We wrap that fragment in the iframe-presentation skeleton below
      // so the dialog still looks like an inbox preview.
      const body: Record<string, unknown> = {
        tenantId: tenant?.id,
        contentBlocks,
        subject: subjectLine,
        includeFooter: true,
      };

      if (previewCustomer?.id) {
        body.customerId = previewCustomer.id;
      } else {
        body.sampleCustomer = SAMPLE_PREVIEW_CUSTOMER;
      }

      const { data, error } = await supabase.functions.invoke(
        "render-email-preview",
        {
          body,
        },
      );

      if (error) {
        throw error;
      }

      if (requestId !== renderRequestIdRef.current) {
        return;
      }

      const fragment = (data?.renderedHtml as string | undefined) ?? "";
      setRenderedHtml(
        fragment ? wrapServerRenderedHtml(fragment, preheaderText) : null,
      );
      setRenderedSubject((data?.renderedSubject as string | undefined) ?? null);
      setDiagnostics(
        (data?.diagnostics as PreviewDiagnostics | undefined) ?? null,
      );
    } catch (error) {
      if (requestId !== renderRequestIdRef.current) {
        return;
      }

      setRenderError(
        error instanceof Error
          ? error.message
          : "Preview unavailable. Please save and try again.",
      );
    } finally {
      if (requestId === renderRequestIdRef.current) {
        setIsRendering(false);
      }
    }
  }, [
    campaignType,
    contentBlocks,
    preheaderText,
    previewCustomer?.id,
    subjectLine,
    tenant?.id,
  ]);

  React.useEffect(() => {
    if (!open) {
      renderRequestIdRef.current += 1;
      setIsRendering(false);
      setRenderError(null);
      setRenderedHtml(null);
      setRenderedSubject(null);
      setDiagnostics(null);
      setActiveTab("preview");
      setSendTestState(null);
      setIsSendingTest(false);
      return;
    }

    if (campaignType !== "email") {
      return;
    }

    if (hasAudienceSelection && previewCustomerQuery.isLoading) {
      return;
    }

    void renderPreview();
  }, [
    campaignType,
    contentBlocks,
    hasAudienceSelection,
    open,
    preheaderText,
    previewCustomerQuery.isLoading,
    previewCustomer?.id,
    renderPreview,
    subjectLine,
  ]);

  return (
    <JoyDialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Campaign Preview"
      description={
        campaignType === "sms"
          ? "Preview your SMS message."
          : "Preview the rendered email your recipients will receive."
      }
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <JoyButton
              bloomVariant={viewMode === "desktop" ? "default" : "secondary"}
              onClick={() => setViewMode("desktop")}
              startDecorator={<Monitor size={16} />}
            >
              Desktop
            </JoyButton>
            <JoyButton
              bloomVariant={viewMode === "mobile" ? "default" : "secondary"}
              onClick={() => setViewMode("mobile")}
              startDecorator={<Smartphone size={16} />}
            >
              Mobile
            </JoyButton>
          </Stack>

          {campaignType === "sms" ? (
            <Box
              sx={{
                width: viewMode === "mobile" ? 360 : 520,
                maxWidth: "100%",
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "lg",
                p: 2,
                backgroundColor: "background.level1",
              }}
            >
              <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
                {smsMessage || "No SMS content yet."}
              </Typography>
            </Box>
          ) : (
            <Tabs
              value={activeTab}
              onChange={(_event, value) => setActiveTab(value as PreviewTab)}
            >
              <TabList
                disableUnderline
                sx={{
                  width: "fit-content",
                  alignSelf: "flex-start",
                  p: 0.5,
                  borderRadius: "999px",
                  bgcolor: "neutral.100",
                  gap: 0.5,
                }}
              >
                <Tab
                  value="preview"
                  disableIndicator
                  sx={{
                    borderRadius: "999px",
                    fontWeight: "md",
                    minHeight: 34,
                    px: 2,
                    color: "neutral.600",
                    "&.Mui-selected": {
                      bgcolor: "neutral.200",
                      color: "neutral.800",
                    },
                  }}
                >
                  Preview
                </Tab>
                {canSendTest ? (
                  <Tab
                    value="send-test"
                    disableIndicator
                    sx={{
                      borderRadius: "999px",
                      fontWeight: "md",
                      minHeight: 34,
                      px: 2,
                      color: "neutral.600",
                      "&.Mui-selected": {
                        bgcolor: "neutral.200",
                        color: "neutral.800",
                      },
                    }}
                  >
                    Send Test
                  </Tab>
                ) : null}
              </TabList>

              <TabPanel value="preview" sx={{ px: 0 }}>
                <Stack spacing={2}>
                  <Sheet
                    variant="outlined"
                    sx={{
                      borderRadius: "lg",
                      p: 2,
                      borderColor: "neutral.200",
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                      >
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            Subject
                          </Typography>
                          <Typography level="body-sm" fontWeight="lg">
                            {renderedSubject ||
                              subjectLine ||
                              "No subject line"}
                          </Typography>
                        </Stack>
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            Preview text
                          </Typography>
                          <Typography
                            level="body-sm"
                            sx={{ color: "neutral.700" }}
                          >
                            {preheaderText || "No preview text"}
                          </Typography>
                        </Stack>
                      </Stack>

                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <User size={14} />
                          <Typography level="body-sm">
                            Preview shown for: {previewRecipientLabel}
                          </Typography>
                        </Stack>
                        {diagnostics?.usedTags.length ? (
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            {diagnostics.usedTags.length} merge tags rendered
                          </Typography>
                        ) : null}
                      </Stack>

                      {previewCustomerQuery.error ? (
                        <Typography
                          level="body-xs"
                          sx={{ color: "warning.700" }}
                        >
                          Could not load an audience recipient. Showing the
                          sample customer instead.
                        </Typography>
                      ) : null}

                      {hasDiagnosticsWarning ? (
                        <Sheet
                          variant="soft"
                          color="warning"
                          sx={{ borderRadius: "md", p: 1.25 }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="flex-start"
                          >
                            <AlertTriangle
                              size={14}
                              style={{
                                color: "var(--joy-palette-warning-700)",
                                marginTop: 2,
                                flexShrink: 0,
                              }}
                            />
                            <Typography
                              level="body-xs"
                              sx={{ color: "warning.700" }}
                            >
                              Merge-tag preview found missing or empty
                              personalization values.
                            </Typography>
                          </Stack>
                        </Sheet>
                      ) : null}
                    </Stack>
                  </Sheet>

                  {renderError ? (
                    <Sheet
                      variant="soft"
                      color="danger"
                      sx={{ borderRadius: "lg", p: 2 }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Stack spacing={0.5}>
                          <Typography level="title-sm">
                            Preview failed to render
                          </Typography>
                          <Typography level="body-sm">{renderError}</Typography>
                        </Stack>
                        <JoyButton
                          bloomVariant="secondary"
                          startDecorator={<RefreshCw size={16} />}
                          onClick={() => void renderPreview()}
                        >
                          Retry
                        </JoyButton>
                      </Stack>
                    </Sheet>
                  ) : null}

                  {isRendering ||
                  (hasAudienceSelection && previewCustomerQuery.isLoading) ? (
                    <Stack spacing={1.5}>
                      <Sheet
                        variant="outlined"
                        sx={{
                          borderRadius: "lg",
                          p: 2,
                          borderColor: "neutral.200",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <CircularProgress size="sm" />
                          <Typography level="body-sm">
                            Rendering preview
                            {hasAudienceSelection &&
                            previewCustomerQuery.isLoading
                              ? " and selecting a recipient"
                              : ""}
                            ...
                          </Typography>
                        </Stack>
                      </Sheet>
                      <Sheet
                        variant="outlined"
                        sx={{
                          borderRadius: "lg",
                          p: 2,
                          borderColor: "neutral.200",
                        }}
                      >
                        <Skeleton
                          variant="rectangular"
                          sx={{ borderRadius: "md", height: 560 }}
                        />
                      </Sheet>
                    </Stack>
                  ) : renderedHtml ? (
                    <Box
                      sx={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      {viewMode === "mobile" ? (
                        <Box sx={{ width: "min(420px, 100%)" }}>
                          <Box
                            sx={{
                              borderRadius: "36px",
                              p: 1,
                              backgroundColor: "#111827",
                              boxShadow: "lg",
                            }}
                          >
                            <Box
                              sx={{
                                height: 6,
                                width: 88,
                                borderRadius: 999,
                                backgroundColor: "rgba(255,255,255,0.24)",
                                mx: "auto",
                                my: 1,
                              }}
                            />
                            <Box
                              component="iframe"
                              srcDoc={renderedHtml}
                              title="Mobile campaign preview"
                              sandbox="allow-same-origin allow-scripts"
                              sx={{
                                width: "100%",
                                height: 680,
                                border: 0,
                                borderRadius: "28px",
                                backgroundColor: "common.white",
                              }}
                            />
                          </Box>
                        </Box>
                      ) : (
                        <Box
                          component="iframe"
                          srcDoc={renderedHtml}
                          title="Campaign preview"
                          sandbox="allow-same-origin allow-scripts"
                          sx={{
                            width: "100%",
                            minHeight: 720,
                            border: "1px solid",
                            borderColor: "neutral.200",
                            borderRadius: "lg",
                            backgroundColor: "common.white",
                            boxShadow: "sm",
                          }}
                        />
                      )}
                    </Box>
                  ) : null}
                </Stack>
              </TabPanel>

              {canSendTest ? (
                <TabPanel value="send-test" sx={{ px: 0 }}>
                  <Stack spacing={2}>
                    <Sheet
                      variant="outlined"
                      sx={{
                        borderRadius: "lg",
                        p: 2,
                        borderColor: "neutral.200",
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Typography level="title-sm">
                          Send A Test Email
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.600" }}
                        >
                          Send this campaign to yourself to verify layout,
                          personalization, and links before scheduling.
                        </Typography>
                        <FormControl size="sm">
                          <FormLabel>Email address</FormLabel>
                          <Input
                            type="email"
                            value={testEmail}
                            startDecorator={<Mail size={14} />}
                            placeholder="you@example.com"
                            onChange={(event) => {
                              setTestEmail(event.target.value);
                              if (sendTestState?.tone === "danger") {
                                setSendTestState(null);
                              }
                            }}
                            disabled={isSendingTest}
                          />
                        </FormControl>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            Subject: {subjectLine || "No subject line"}
                          </Typography>
                          <JoyButton
                            onClick={() => void sendTestEmail()}
                            disabled={isSendingTest || !previewHtml.trim()}
                            startDecorator={
                              isSendingTest ? (
                                <CircularProgress size="sm" />
                              ) : (
                                <Send size={14} />
                              )
                            }
                          >
                            {isSendingTest ? "Sending..." : "Send Test"}
                          </JoyButton>
                        </Stack>
                      </Stack>
                    </Sheet>

                    {sendTestState ? (
                      <Alert color={sendTestState.tone} variant="soft">
                        {sendTestState.message}
                      </Alert>
                    ) : null}
                  </Stack>
                </TabPanel>
              ) : null}
            </Tabs>
          )}
        </Stack>
      </JoyDialogContent>
    </JoyDialog>
  );
}
