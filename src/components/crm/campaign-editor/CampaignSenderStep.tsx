import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import type { IdentityField, IdentityMismatch } from "@/lib/crm/identityConsistency";
import type { SenderClassification } from "@/lib/crm/senderSeverity";

type SenderField = "senderName" | "senderEmail" | "footerBusinessName";

/** The field a mismatch is shown under: the one a person would change. */
function senderFieldForMismatch(fields: [IdentityField, IdentityField]): SenderField {
  if (fields.includes("footer business name")) return "footerBusinessName";
  if (fields.includes("sender email domain")) return "senderEmail";
  return "senderName";
}

function InlineWarning({
  children,
  action,
  testId,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Box
      role="note"
      data-testid={testId}
      sx={{
        mt: 1,
        p: 1.25,
        borderRadius: "lg",
        bgcolor: "warning.softBg",
        border: "1px solid",
        borderColor: "warning.outlinedBorder",
        color: "warning.softColor",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <AlertTriangle size={18} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Typography level="body-md" sx={{ color: "warning.softColor" }}>
            {children}
          </Typography>
          {action}
        </Stack>
      </Stack>
    </Box>
  );
}

export interface CampaignSenderStepProps {
  campaignType: "email" | "sms";
  senderName: string;
  senderEmail: string;
  replyTo: string;
  /** The footer block's business name, or null when the email has no footer. */
  footerBusinessName: string | null;
  /** Shown as the footer field's hint when it is empty. */
  companyName?: string | null;
  senderClassification: SenderClassification;
  domainStatusLoading?: boolean;
  mismatches: IdentityMismatch[];
  disabled?: boolean;
  onSetupChange: (next: { senderName?: string; senderEmail?: string; replyTo?: string }) => void;
  onFooterBusinessNameChange: (value: string) => void;
  onVerifySender: () => void;
  onOpenSenderSettings: () => void;
}

/**
 * Step 4: who the email is from. Edits go through the editor's own setters,
 * so autosave and the send checks run as they do everywhere else.
 */
export function CampaignSenderStep({
  campaignType,
  senderName,
  senderEmail,
  replyTo,
  footerBusinessName,
  companyName,
  senderClassification,
  domainStatusLoading = false,
  mismatches,
  disabled = false,
  onSetupChange,
  onFooterBusinessNameChange,
  onVerifySender,
  onOpenSenderSettings,
}: CampaignSenderStepProps) {
  const byField = (field: SenderField) =>
    campaignType === "email"
      ? mismatches.filter((mismatch) => senderFieldForMismatch(mismatch.fields) === field)
      : [];
  const fromName = senderName.trim();

  const domainStatus = (() => {
    if (campaignType !== "email") return null;
    if (domainStatusLoading) {
      return (
        <Typography level="body-sm" sx={{ color: "text.secondary", mt: 0.75 }} role="status">
          Checking your sending domain…
        </Typography>
      );
    }
    if (senderClassification.status === "ready") {
      return (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ mt: 0.75, color: "success.plainColor" }}
          data-testid="sender-domain-verified"
        >
          <CheckCircle2 size={18} aria-hidden />
          <Typography level="body-sm" sx={{ color: "success.plainColor", fontWeight: "lg" }}>
            Sending domain verified
          </Typography>
        </Stack>
      );
    }
    return (
      <InlineWarning
        testId={`sender-domain-${senderClassification.status}`}
        action={
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <JoyButton variant="outlined" color="neutral" onClick={onVerifySender} disabled={disabled}>
              Verify sender
            </JoyButton>
            <JoyButton variant="plain" color="neutral" onClick={onOpenSenderSettings}>
              Sender settings
            </JoyButton>
          </Stack>
        }
      >
        {senderClassification.message}
      </InlineWarning>
    );
  })();

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 2.5,
        alignItems: "start",
      }}
    >
      <Box>
        <JoyInput
          id="campaign-editor-sender-name"
          label="From name"
          value={senderName}
          disabled={disabled}
          autoComplete="organization"
          onValueChange={(value) => onSetupChange({ senderName: value })}
        />
        {byField("senderName").map((mismatch) => (
          <InlineWarning key={mismatch.message} testId="sender-mismatch-senderName">
            {mismatch.message}
          </InlineWarning>
        ))}
      </Box>
      <Box>
        <JoyInput
          id="campaign-editor-sender-email"
          label="From email"
          type="email"
          value={senderEmail}
          disabled={disabled}
          autoComplete="email"
          onValueChange={(value) => onSetupChange({ senderEmail: value })}
        />
        {domainStatus}
        {byField("senderEmail").map((mismatch) => (
          <InlineWarning key={mismatch.message} testId="sender-mismatch-senderEmail">
            {mismatch.message}
          </InlineWarning>
        ))}
      </Box>
      <Box>
        <JoyInput
          id="campaign-editor-reply-to"
          label="Reply-to email"
          type="email"
          value={replyTo}
          disabled={disabled}
          autoComplete="email"
          helperText="Replies go here. Leave empty to use the From email."
          onValueChange={(value) => onSetupChange({ replyTo: value })}
        />
      </Box>
      {campaignType === "email" ? (
        <Box>
          <JoyInput
            id="campaign-editor-footer-business-name"
            label="Footer business name"
            value={footerBusinessName ?? ""}
            disabled={disabled || footerBusinessName === null}
            helperText={
              footerBusinessName === null
                ? "The footer is added when your email has content."
                : !footerBusinessName.trim()
                  ? `Empty, so ${companyName?.trim() || "your business name"} is shown.`
                  : "Shown in the email footer. Customers use it to recognise you."
            }
            onValueChange={onFooterBusinessNameChange}
          />
          {byField("footerBusinessName").map((mismatch) => (
            <InlineWarning
              key={mismatch.message}
              testId="sender-mismatch-footerBusinessName"
              action={
                fromName && fromName !== (footerBusinessName ?? "").trim() ? (
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    startDecorator={<Copy size={16} aria-hidden />}
                    disabled={disabled || footerBusinessName === null}
                    onClick={() => onFooterBusinessNameChange(fromName)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Use From name
                  </JoyButton>
                ) : null
              }
            >
              {mismatch.message}
            </InlineWarning>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
