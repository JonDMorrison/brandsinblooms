import { useNewsletterDesign } from "./newsletter/NewsletterDesignContext";
import { normalizeNewsletterSettings } from "@/lib/studio/newsletter/settings";
import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import DialogTitle from "@mui/joy/DialogTitle";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  ClipboardCheck,
  Loader2,
  MailCheck,
  Monitor,
  Send,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import { supabase } from "@/integrations/supabase/client";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import {
  checkMessage,
  findBrokenImages,
  messageImageAddresses,
  type MessageCheckIssue,
} from "@/lib/studio/newsletter/messageCheck";
import type { StudioBlock } from "@/types/studioBlocks";

type PreviewDevice = "desktop" | "tablet" | "mobile";
type PreviewTab = "preview" | "test";

type StudioPreviewDialogProps = {
  open: boolean;
  onClose: () => void;
  blocks: StudioBlock[];
  subjectLine: string;
  previewText: string;
  campaignId: string;
  /** When set, the tab shown each time the dialog opens. */
  initialTab?: PreviewTab;
};

const DEVICE_OPTIONS: Array<{
  value: PreviewDevice;
  label: string;
  width: number;
  icon: typeof Monitor;
}> = [
  { value: "desktop", label: "Desktop", width: 640, icon: Monitor },
  { value: "tablet", label: "Tablet", width: 480, icon: Tablet },
  { value: "mobile", label: "Mobile", width: 375, icon: Smartphone },
];

const SAMPLE_CUSTOMER = {
  first_name: "Jane",
  last_name: "Gardener",
  email: "jane@demo-gardens.test",
  phone: "(555) 123-4567",
};

function stripScriptTags(html: string) {
  return html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
}

function buildSampleMergeData(
  designSystem: ReturnType<typeof useDesignSystem>["designSystem"],
) {
  const currentDate = new Date().toLocaleDateString();
  const currentYear = new Date().getFullYear().toString();
  const companyName = designSystem.company.name || "Your Company";
  const companyAddress = designSystem.company.addressLines || "";
  const companyPhone = designSystem.company.phone || "";
  const companyEmail = designSystem.company.email || "";
  const companyWebsite = designSystem.company.websiteUrl || "";

  return {
    first_name: SAMPLE_CUSTOMER.first_name,
    last_name: SAMPLE_CUSTOMER.last_name,
    email: SAMPLE_CUSTOMER.email,
    phone: SAMPLE_CUSTOMER.phone,
    lifetime_value: "0",
    total_spent: "0",
    first_purchase_date: "",
    last_purchase_date: "",
    "customer.first_name": SAMPLE_CUSTOMER.first_name,
    "customer.last_name": SAMPLE_CUSTOMER.last_name,
    "customer.email": SAMPLE_CUSTOMER.email,
    "customer.phone": SAMPLE_CUSTOMER.phone,
    "customer.name": SAMPLE_CUSTOMER.first_name,
    customer_name: SAMPLE_CUSTOMER.first_name,
    customerName: SAMPLE_CUSTOMER.first_name,
    firstName: SAMPLE_CUSTOMER.first_name,
    lastName: SAMPLE_CUSTOMER.last_name,
    "company.name": companyName,
    "company.address": companyAddress,
    "company.phone": companyPhone,
    "company.email": companyEmail,
    "company.website": companyWebsite,
    company_name: companyName,
    companyName: companyName,
    "system.unsubscribe_url": "#",
    "system.preferences_url": "#",
    "system.current_year": currentYear,
    "system.current_date": currentDate,
    unsubscribe_url: "#",
    unsubscribeUrl: "#",
  };
}

// Show the subject and preview text the way a customer sees them, with a
// sample name in place of raw merge tags such as {{ first_name }}.
function fillSampleMergeTags(
  text: string,
  sampleData: Record<string, string | number | undefined>,
) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = sampleData[key];
    return value == null || value === "" ? match : String(value);
  });
}

export default function StudioPreviewDialog({
  open,
  onClose,
  blocks,
  subjectLine,
  previewText,
  campaignId,
  initialTab,
}: StudioPreviewDialogProps) {
  const { designSystem } = useDesignSystem();
  const { settings } = useNewsletterDesign();
  const [device, setDevice] = React.useState<PreviewDevice>("desktop");
  const [activeTab, setActiveTab] = React.useState<PreviewTab>("preview");
  const [testEmail, setTestEmail] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sendStatus, setSendStatus] = React.useState<{
    type: "success" | "danger";
    message: string;
  } | null>(null);
  const sampleMergeData = React.useMemo(
    () => buildSampleMergeData(designSystem),
    [designSystem],
  );

  const selectedDevice =
    DEVICE_OPTIONS.find((option) => option.value === device) ??
    DEVICE_OPTIONS[0];
  const footerBlock = blocks.find((block) => block.type === "footer") ?? null;
  const html = React.useMemo(
    () =>
      generateEmailHtml({
        audience: { previewAll: true },
        blocks,
        subject: subjectLine || "Untitled Campaign",
        previewText,
        footer: footerBlock,
        mergeData: sampleMergeData,
        designSystem,
      }),
    [
      blocks,
      designSystem,
      footerBlock,
      previewText,
      sampleMergeData,
      subjectLine,
    ],
  );
  const sanitizedHtml = React.useMemo(() => stripScriptTags(html), [html]);

  // Pre-send check: alt text, links, images and buttons. The result is tied
  // to the email it was run on and is marked out of date after any change.
  const [check, setCheck] = React.useState<{
    running: boolean;
    issues: MessageCheckIssue[];
    forHtml: string;
  } | null>(null);
  const runCheck = React.useCallback(async () => {
    const forHtml = html;
    const issues = checkMessage(blocks, designSystem, settings);
    setCheck({ running: true, issues, forHtml });
    const broken = await findBrokenImages(messageImageAddresses(blocks, designSystem, settings));
    setCheck((current) =>
      current && current.forHtml === forHtml
        ? { running: false, issues: [...issues, ...broken], forHtml }
        : current,
    );
  }, [blocks, designSystem, html, settings]);
  const checkIsStale = Boolean(check && check.forHtml !== html);

  React.useEffect(() => {
    if (open) {
      setSendStatus(null);
      setCheck(null);
      if (initialTab) setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  const handleSendTest = React.useCallback(async () => {
    const toEmail = testEmail.trim();

    if (!toEmail) {
      setSendStatus({
        type: "danger",
        message: "Enter an email address first.",
      });
      return;
    }

    setIsSending(true);
    setSendStatus(null);

    const { data, error } = await supabase.functions.invoke(
      "send-test-email-v2",
      {
        body: {
          toEmail,
          subject: subjectLine || "Untitled Campaign",
          previewText,
          contentBlocks: blocks,
          sampleCustomer: SAMPLE_CUSTOMER,
          campaignId: campaignId || undefined,
        },
      },
    );

    setIsSending(false);

    if (error) {
      setSendStatus({
        type: "danger",
        message: error.message || "Test send failed. Please try again.",
      });
      return;
    }

    if (data && data.success === false) {
      setSendStatus({
        type: "danger",
        message: data.error || "Test send failed. Please try again.",
      });
      return;
    }

    setSendStatus({ type: "success", message: "Test email sent." });
  }, [blocks, campaignId, previewText, subjectLine, testEmail]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        variant="outlined"
        sx={{
          width: 940,
          maxWidth: "calc(100vw - 32px)",
          height: "min(860px, calc(100vh - 32px))",
          borderRadius: "16px",
          boxShadow: "xl",
          p: 0,
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2.5,
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <DialogTitle sx={{ p: 0, fontSize: "16px" }}>
              Preview & Test
            </DialogTitle>
          </Stack>
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label="Close preview"
            onClick={onClose}
            sx={{ borderRadius: "8px" }}
          >
            <X size={18} />
          </IconButton>
        </Stack>

        {/* One top bar: Preview/Send test, device, inbox line. The email
            gets the full width of the dialog below it. */}
        <Sheet
          data-testid="preview-top-bar"
          sx={{
            px: 2,
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "neutral.200",
            bgcolor: "background.surface",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ flexWrap: { xs: "wrap", md: "nowrap" }, rowGap: 1 }}
          >
            <Sheet
              role="tablist"
              aria-label="Preview or send a test"
              sx={{
                bgcolor: "neutral.50",
                borderRadius: "8px",
                p: "3px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "3px",
                flexShrink: 0,
              }}
            >
              {(["preview", "test"] as const).map((tab) => (
                <Button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  variant={activeTab === tab ? "solid" : "plain"}
                  color={activeTab === tab ? "primary" : "neutral"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  sx={{
                    minHeight: 30,
                    borderRadius: "6px",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab === "preview" ? "Preview" : "Send test"}
                </Button>
              ))}
            </Sheet>

            <Stack
              direction="row"
              spacing={0.5}
              role="group"
              aria-label="Device"
              sx={{ flexShrink: 0 }}
            >
              {DEVICE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = option.value === device;
                return (
                  <Tooltip
                    key={option.value}
                    title={`See it on a ${option.label === "Desktop" ? "computer" : option.label === "Tablet" ? "tablet" : "phone"}`}
                  >
                    <IconButton
                      variant={selected ? "solid" : "outlined"}
                      color={selected ? "primary" : "neutral"}
                      size="sm"
                      aria-label={`${option.label} preview`}
                      aria-pressed={selected}
                      onClick={() => setDevice(option.value)}
                      sx={{ borderRadius: "8px", width: 36, height: 32 }}
                    >
                      <Icon size={16} />
                    </IconButton>
                  </Tooltip>
                );
              })}
            </Stack>

            <Sheet
              variant="soft"
              data-testid="preview-inbox-line"
              sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: "8px",
                minWidth: 0,
                flex: 1,
                display: "flex",
                alignItems: "baseline",
                gap: 1,
              }}
            >
              <Typography
                level="body-xs"
                fontWeight={700}
                noWrap
                sx={{ flexShrink: 0, maxWidth: "55%" }}
              >
                {subjectLine.trim()
                  ? fillSampleMergeTags(subjectLine, sampleMergeData)
                  : "No subject yet"}
              </Typography>
              <Typography level="body-xs" noWrap sx={{ color: "neutral.500", minWidth: 0 }}>
                {fillSampleMergeTags(previewText || "Preview text appears here", sampleMergeData)}
              </Typography>
            </Sheet>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={check?.running ? <Loader2 size={15} /> : <ClipboardCheck size={15} />}
              disabled={check?.running}
              onClick={() => void runCheck()}
              sx={{ borderRadius: "8px", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {check && !checkIsStale ? "Check again" : "Check message"}
            </Button>
          </Stack>
          {check ? <MessageCheckReport check={check} stale={checkIsStale} /> : null}

          {activeTab === "test" ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              data-testid="preview-test-row"
              sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 1 }}
            >
              <Input
                type="email"
                size="sm"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="you@yourdomain.com"
                slotProps={{ input: { "aria-label": "Test recipient" } }}
                sx={{ borderRadius: "8px", flex: "1 1 260px", maxWidth: 360 }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSendTest();
                  }
                }}
              />
              <Button
                size="sm"
                startDecorator={
                  isSending ? <Loader2 size={15} /> : <Send size={15} />
                }
                disabled={isSending}
                onClick={() => void handleSendTest()}
                sx={{ borderRadius: "8px", whiteSpace: "nowrap" }}
              >
                Send test
              </Button>
              {sendStatus ? (
                <Alert
                  size="sm"
                  color={sendStatus.type}
                  startDecorator={
                    sendStatus.type === "success" ? (
                      <MailCheck size={16} />
                    ) : null
                  }
                  sx={{ borderRadius: "8px", py: 0.5 }}
                >
                  {sendStatus.message}
                </Alert>
              ) : null}
            </Stack>
          ) : null}
        </Sheet>

        <Box sx={{ minHeight: 0, flex: 1, display: "flex", bgcolor: "neutral.50" }}>
          <Box
            sx={{
              minWidth: 0,
              minHeight: 0,
              flex: 1,
              p: { xs: 1.5, md: 2.5 },
              overflow: "auto",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <Box
              sx={{
                width:
                  selectedDevice.value === "desktop"
                    ? normalizeNewsletterSettings(settings).width
                    : selectedDevice.width,
                maxWidth: "100%",
                minHeight: 520,
                bgcolor: "#ffffff",
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "10px",
                boxShadow: "lg",
                overflow: "hidden",
                transition: "width 180ms ease",
              }}
            >
              <Box
                component="iframe"
                title="Campaign email preview"
                srcDoc={sanitizedHtml}
                sandbox="allow-same-origin"
                sx={{
                  display: "block",
                  width: "100%",
                  height: "calc(min(780px, 100vh - 156px))",
                  minHeight: 520,
                  border: 0,
                  bgcolor: "#ffffff",
                }}
              />
            </Box>
          </Box>
        </Box>
      </ModalDialog>
    </Modal>
  );
}

const KIND_LABELS: Record<MessageCheckIssue["kind"], string> = {
  "alt-text": "Image description",
  link: "Link",
  image: "Image",
  button: "Button",
};

function MessageCheckReport({
  check,
  stale,
}: {
  check: { running: boolean; issues: MessageCheckIssue[] };
  stale: boolean;
}) {
  const problems = check.issues.filter((issue) => issue.severity === "problem").length;
  const warnings = check.issues.length - problems;
  const byBlock = check.issues.reduce<Map<string, { label: string; issues: MessageCheckIssue[] }>>(
    (groups, issue) => {
      const group = groups.get(issue.blockId) ?? { label: issue.blockLabel, issues: [] };
      group.issues.push(issue);
      groups.set(issue.blockId, group);
      return groups;
    },
    new Map(),
  );
  const summary = check.running
    ? "Checking images, links, descriptions and buttons…"
    : check.issues.length === 0
      ? "All clear: every image has a description and loads, every link has an address and every button has words and a link."
      : `${problems} ${problems === 1 ? "problem" : "problems"} and ${warnings} ${warnings === 1 ? "warning" : "warnings"} to review before sending.`;
  return (
    <Box data-testid="message-check-report" role="region" aria-label="Message check" sx={{ mt: 1.25 }}>
      <Alert
        size="sm"
        color={stale ? "neutral" : check.running ? "neutral" : check.issues.length === 0 ? "success" : problems ? "danger" : "warning"}
        sx={{ borderRadius: "8px", py: 0.75, alignItems: "flex-start" }}
      >
        <Stack spacing={0.75} sx={{ minWidth: 0, width: "100%" }}>
          <Typography level="body-sm" fontWeight={700}>
            {stale ? "The email changed since this check. Check again." : summary}
          </Typography>
          {!stale && byBlock.size > 0 ? (
            <Box sx={{ maxHeight: 180, overflowY: "auto", pr: 0.5 }}>
              {Array.from(byBlock.entries()).map(([blockId, group]) => (
                <Box key={blockId} sx={{ mb: 0.75 }}>
                  <Typography level="body-xs" fontWeight={700}>{group.label}</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                    {group.issues.map((issue, index) => (
                      <Typography key={index} component="li" level="body-xs" sx={{ color: "text.secondary" }}>
                        <strong>{issue.severity === "problem" ? "Problem" : "Check"} · {KIND_LABELS[issue.kind]}:</strong>{" "}
                        {issue.message}
                        {issue.detail ? <Box component="span" sx={{ display: "block", wordBreak: "break-all", color: "neutral.500" }}>{issue.detail}</Box> : null}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : null}
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Links are checked by their address; the check does not open the pages. Spelling is not checked yet.
          </Typography>
        </Stack>
      </Alert>
    </Box>
  );
}
