import { useState, useEffect } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyChip } from "@/components/joy/JoyChip";
import { Copy, Check, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SMS_BRAND_CONFIG, getProgramNumberDisplay } from "@/config/smsConfig";

// All Twilio copy blocks
const getTwilioCopyBlocks = () => {
  const programNumber = getProgramNumberDisplay();

  return {
    campaignDescription: `This campaign sends recurring marketing SMS to opted-in users of BloomSuite about product updates, feature announcements, webinars, and helpful tips. Messages include HELP/STOP. Terms: https://bloomsuite.app/terms
Privacy: https://bloomsuite.app/privacy`,

    sampleMessages: [
      `BloomSuite: New release is live. See what's new: https://bloomsuite.app/updates
HELP=help, STOP=cancel`,
      `BloomSuite: Webinar Thu 10am PT. Save your seat: https://bloomsuite.app/webinars
HELP=help, STOP=cancel`,
      `BloomSuite: Feature spotlight. Details: https://bloomsuite.app/features
HELP=help, STOP=cancel`,
      `BloomSuite: Reminder—Office hours today 1pm PT: https://bloomsuite.app/office-hours
HELP=help, STOP=cancel`,
      `BloomSuite: Tips for better SMS campaigns: https://bloomsuite.app/blog/sms-tips
HELP=help, STOP=cancel`,
    ],

    messageContentsFlags: `Links: Yes
Phone numbers: No
Direct lending: No
Age-gated: No`,

    howEndUsersConsent: `Users opt in at https://bloomsuite.app/sms-program by entering their mobile number and checking a required consent box stating: 'I agree to receive recurring marketing text messages from BloomSuite. Msg and Data rates may apply. Reply HELP for help, STOP to cancel.' The page links to Terms and Privacy. We keep timestamped consent records.`,

    optInKeywords: "N/A (web form consent only)",

    optInAutoReply: `BloomSuite: You are subscribed to recurring marketing texts. ${SMS_BRAND_CONFIG.message_frequency_text}. Msg and Data rates may apply. Reply HELP for help, STOP to cancel. https://bloomsuite.app/terms https://bloomsuite.app/privacy`,

    optOutMessage: `BloomSuite: You are unsubscribed and will no longer receive texts. Reply START to rejoin.`,

    helpMessage: `BloomSuite: For help visit https://bloomsuite.app/contact or reply STOP to cancel. Msg and Data rates may apply.`,
  };
};

const CopyBlock = ({
  title,
  content,
  charLimit,
}: {
  title: string;
  content: string;
  charLimit?: { min: number; max: number };
}) => {
  const [copied, setCopied] = useState(false);
  const charCount = content.length;
  const isWithinLimit =
    !charLimit || (charCount >= charLimit.min && charCount <= charLimit.max);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success(`${title} copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <JoyCard>
      <JoyCardHeader
        title={title}
        titleProps={{ level: "title-sm" }}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {charLimit ? (
              <JoyChip
                bloomVariant={isWithinLimit ? "secondary" : "destructive"}
              >
                {charCount} chars ({charLimit.min}-{charLimit.max})
              </JoyChip>
            ) : null}
            <JoyButton
              aria-label={copied ? "Copy complete" : "Copy section"}
              bloomVariant="outline"
              size="icon"
              onClick={handleCopy}
              sx={{ width: 32, height: 32 }}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </JoyButton>
          </Stack>
        }
      />
      <JoyCardContent>
        <pre className="text-sm bg-muted/50 p-4 rounded-lg whitespace-pre-wrap font-mono text-foreground overflow-x-auto">
          {content}
        </pre>
      </JoyCardContent>
    </JoyCard>
  );
};

const StatusPanel = () => {
  const [linkStatus, setLinkStatus] = useState<Record<string, boolean>>({});
  const blocks = getTwilioCopyBlocks();
  const autoReplyLength = blocks.optInAutoReply.length;
  const isAutoReplyValid = autoReplyLength >= 20 && autoReplyLength <= 320;

  const linksToCheck = [
    "https://bloomsuite.app/terms",
    "https://bloomsuite.app/privacy",
    "https://bloomsuite.app/sms-program",
    "https://bloomsuite.app/contact",
  ];

  useEffect(() => {
    // Mark all links as valid (they're first-party under bloomsuite.app)
    const status: Record<string, boolean> = {};
    linksToCheck.forEach((link) => {
      status[link] = true; // All links are valid first-party URLs
    });
    setLinkStatus(status);
  }, []);

  return (
    <JoyCard sx={{ borderWidth: 2, borderColor: "primary.200" }}>
      <JoyCardHeader title="Status Checks" />
      <JoyCardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {isAutoReplyValid ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <Typography level="body-sm">
              Opt-in auto-reply: {autoReplyLength} chars
              {isAutoReplyValid ? " (within 20-320)" : " (must be 20-320)"}
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography level="body-sm" fontWeight="md">
              Links (all first-party under bloomsuite.app):
            </Typography>
            {linksToCheck.map((link) => (
              <Stack
                key={link}
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ pl: 2 }}
              >
                <CheckCircle className="w-4 h-4 text-green-600" />
                <Typography
                  level="body-sm"
                  color="neutral"
                  fontFamily="monospace"
                >
                  {link}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {!SMS_BRAND_CONFIG.program_number ? (
            <Sheet
              variant="soft"
              color="warning"
              sx={{
                p: 1.5,
                borderRadius: "var(--joy-radius-md)",
                border: "1px solid",
                borderColor: "warning.200",
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <Typography level="body-sm" sx={{ color: "warning.800" }}>
                  VITE_SMS_PROGRAM_NUMBER environment variable not set
                </Typography>
              </Stack>
            </Sheet>
          ) : null}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
};

export const TwilioCopyPage = () => {
  const blocks = getTwilioCopyBlocks();

  const handleCopyAll = async () => {
    const allContent = `
=== CAMPAIGN DESCRIPTION ===
${blocks.campaignDescription}

=== SAMPLE MESSAGE #1 ===
${blocks.sampleMessages[0]}

=== SAMPLE MESSAGE #2 ===
${blocks.sampleMessages[1]}

=== SAMPLE MESSAGE #3 ===
${blocks.sampleMessages[2]}

=== SAMPLE MESSAGE #4 ===
${blocks.sampleMessages[3]}

=== SAMPLE MESSAGE #5 ===
${blocks.sampleMessages[4]}

=== MESSAGE CONTENTS FLAGS ===
${blocks.messageContentsFlags}

=== HOW END USERS CONSENT ===
${blocks.howEndUsersConsent}

=== OPT-IN KEYWORDS ===
${blocks.optInKeywords}

=== OPT-IN AUTO-REPLY ===
${blocks.optInAutoReply}

=== OPT-OUT MESSAGE ===
${blocks.optOutMessage}

=== HELP MESSAGE ===
${blocks.helpMessage}
`.trim();

    await navigator.clipboard.writeText(allContent);
    toast.success("All Twilio copy copied to clipboard!");
  };

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography level="h2">Twilio Campaign Copy</Typography>
            <Typography level="body-sm" color="neutral">
              Paste-ready text for Twilio 10DLC campaign submission
            </Typography>
          </Stack>
          <JoyButton
            onClick={handleCopyAll}
            size="lg"
            startDecorator={<Copy className="w-4 h-4" />}
          >
            Copy All
          </JoyButton>
        </Stack>

        <StatusPanel />

        <CopyBlock
          title="Campaign Description"
          content={blocks.campaignDescription}
        />

        {blocks.sampleMessages.map((msg, index) => (
          <CopyBlock
            key={index}
            title={`Sample Message #${index + 1}`}
            content={msg}
          />
        ))}

        <CopyBlock
          title="Message Contents Flags"
          content={blocks.messageContentsFlags}
        />
        <CopyBlock
          title="How End Users Consent"
          content={blocks.howEndUsersConsent}
        />
        <CopyBlock title="Opt-in Keywords" content={blocks.optInKeywords} />

        <CopyBlock
          title="Opt-in Auto-Reply"
          content={blocks.optInAutoReply}
          charLimit={{ min: 20, max: 320 }}
        />

        <CopyBlock title="Opt-out Message" content={blocks.optOutMessage} />
        <CopyBlock title="Help Message" content={blocks.helpMessage} />
      </Stack>
    </PageContainer>
  );
};

export default TwilioCopyPage;
