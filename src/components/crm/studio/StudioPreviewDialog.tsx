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

export default function StudioPreviewDialog({
  open,
  onClose,
  blocks,
  subjectLine,
  previewText,
  campaignId,
}: StudioPreviewDialogProps) {
  const { designSystem } = useDesignSystem();
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

  React.useEffect(() => {
    if (open) {
      setSendStatus(null);
    }
  }, [open]);

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
            py: 1.75,
            borderBottom: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <DialogTitle sx={{ p: 0, fontSize: "16px" }}>
              Preview & Test
            </DialogTitle>
            <Typography level="body-xs" noWrap sx={{ color: "neutral.500" }}>
              {subjectLine || "Untitled Campaign"}
            </Typography>
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

        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{ minHeight: 0, flex: 1, bgcolor: "neutral.50" }}
        >
          <Sheet
            sx={{
              width: { xs: "100%", md: 228 },
              flexShrink: 0,
              borderRight: { md: "1px solid" },
              borderBottom: { xs: "1px solid", md: 0 },
              borderColor: "neutral.200",
              p: 2,
              bgcolor: "background.surface",
            }}
          >
            <Stack spacing={2}>
              <Sheet
                sx={{
                  bgcolor: "neutral.50",
                  borderRadius: "8px",
                  p: "3px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "3px",
                }}
              >
                {(["preview", "test"] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? "solid" : "plain"}
                    color={activeTab === tab ? "primary" : "neutral"}
                    size="sm"
                    onClick={() => setActiveTab(tab)}
                    sx={{
                      minHeight: 30,
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  >
                    {tab === "preview" ? "Preview" : "Send Test"}
                  </Button>
                ))}
              </Sheet>

              <Stack spacing={1}>
                <Typography
                  level="body-xs"
                  fontWeight={700}
                  sx={{ color: "neutral.600" }}
                >
                  Device
                </Typography>
                <Stack direction="row" spacing={0.75}>
                  {DEVICE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = option.value === device;
                    return (
                      <Tooltip
                        key={option.value}
                        title={`${option.label} ${option.width}px`}
                      >
                        <IconButton
                          variant={selected ? "solid" : "outlined"}
                          color={selected ? "primary" : "neutral"}
                          size="sm"
                          aria-label={`${option.label} preview`}
                          onClick={() => setDevice(option.value)}
                          sx={{ borderRadius: "8px", width: 38, height: 34 }}
                        >
                          <Icon size={17} />
                        </IconButton>
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Stack>

              <Stack spacing={1}>
                <Typography
                  level="body-xs"
                  fontWeight={700}
                  sx={{ color: "neutral.600" }}
                >
                  Inbox
                </Typography>
                <Sheet variant="soft" sx={{ p: 1.25, borderRadius: "8px" }}>
                  <Typography level="body-xs" fontWeight={700} noWrap>
                    {subjectLine || "Untitled Campaign"}
                  </Typography>
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ color: "neutral.500" }}
                  >
                    {previewText || "Preview text appears here"}
                  </Typography>
                </Sheet>
              </Stack>

              {activeTab === "test" ? (
                <Stack spacing={1}>
                  <Typography
                    level="body-xs"
                    fontWeight={700}
                    sx={{ color: "neutral.600" }}
                  >
                    Test Recipient
                  </Typography>
                  <Input
                    type="email"
                    size="sm"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    placeholder="you@yourdomain.com"
                    sx={{ borderRadius: "8px" }}
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
                    sx={{ borderRadius: "8px" }}
                  >
                    Send Test
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
                      sx={{ borderRadius: "8px" }}
                    >
                      {sendStatus.message}
                    </Alert>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          </Sheet>

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
                width: selectedDevice.width,
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
                  height: "calc(min(760px, 100vh - 176px))",
                  minHeight: 520,
                  border: 0,
                  bgcolor: "#ffffff",
                }}
              />
            </Box>
          </Box>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
