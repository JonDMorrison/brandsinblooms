import * as React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { CalendarClock, Check, Circle, Mail, MessageSquare, Send } from "lucide-react";
import type { CampaignCatalogItem } from "@/lib/crm/campaignEditor";
import { campaignReadiness, campaignStage } from "@/lib/crm/campaignCardModel";
import { describeMergeTags } from "@/lib/mergeTagEngine";

interface CampaignCardGridProps {
  campaigns: CampaignCatalogItem[];
  getName: (campaign: CampaignCatalogItem) => string;
  getRecipients: (campaign: CampaignCatalogItem) => number;
  getProgress: (campaign: CampaignCatalogItem) => number;
  getColour?: (campaign: CampaignCatalogItem) => string | null | undefined;
  statsPending?: (campaign: CampaignCatalogItem) => boolean;
  onOpen: (campaign: CampaignCatalogItem) => void;
  renderActions: (campaign: CampaignCatalogItem) => React.ReactNode;
  renderStatus: (campaign: CampaignCatalogItem) => React.ReactNode;
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date : null;
}

/** openRate and clickRate are stored as percentages (0 to 100). */
function percent(value: number, count: number) {
  return value > 0 || count > 0 ? `${value.toFixed(1)}%` : "-";
}

function Thumbnail({ campaign }: { campaign: CampaignCatalogItem }) {
  const [failed, setFailed] = React.useState(false);
  const Icon = campaign.channel === "sms" ? MessageSquare : Mail;
  const showImage = Boolean(campaign.thumbnailUrl) && !failed;
  // With no image, show the email's opening headline so the tile reads as a preview.
  const headline = describeMergeTags(campaign.firstHeadline?.trim() || campaign.subjectLine.trim());
  return (
    <AspectRatio ratio="16/9" sx={{ borderRadius: "md", overflow: "hidden" }}>
      {showImage ? (
        <img
          src={campaign.thumbnailUrl ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            gap: 0.75,
            p: 1.5,
            background:
              "linear-gradient(135deg, var(--joy-palette-primary-100), var(--joy-palette-primary-50) 60%, var(--joy-palette-neutral-100))",
          }}
        >
          <Icon size={18} color="var(--joy-palette-primary-500)" aria-hidden="true" />
          {headline ? (
            <Typography
              level="title-md"
              aria-hidden="true"
              sx={{
                color: "primary.800",
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {headline}
            </Typography>
          ) : null}
        </Box>
      )}
    </AspectRatio>
  );
}

function DraftFooter({ campaign }: { campaign: CampaignCatalogItem }) {
  const readiness = campaignReadiness(campaign);
  const edited = safeDate(campaign.updatedAt);
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {readiness.steps.map((step) => (
          <Chip
            key={step.key}
            size="sm"
            variant="soft"
            color={step.done ? "success" : "neutral"}
            startDecorator={
              step.done ? <Check size={12} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />
            }
          >
            {step.label}
          </Chip>
        ))}
      </Stack>
      <Typography level="body-xs" sx={{ color: readiness.ready ? "success.600" : "warning.700", fontWeight: "md" }}>
        {readiness.ready ? "Ready to send" : `Next: ${readiness.nextStep}`}
      </Typography>
      {edited ? (
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          Edited {formatDistanceToNow(edited, { addSuffix: true })}
        </Typography>
      ) : null}
    </Stack>
  );
}

function ScheduledFooter({ campaign, recipients }: { campaign: CampaignCatalogItem; recipients: number }) {
  const when = safeDate(campaign.scheduledAt);
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <CalendarClock size={14} aria-hidden="true" />
        <Typography level="body-sm" sx={{ fontWeight: "md" }}>
          {when ? format(when, "EEE MMM d, h:mm a") : "Time not set"}
        </Typography>
      </Stack>
      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
        {recipients > 0 ? `${recipients.toLocaleString()} recipients` : "Audience not counted yet"}
      </Typography>
    </Stack>
  );
}

function SentFooter({
  campaign,
  recipients,
  pending,
}: {
  campaign: CampaignCatalogItem;
  recipients: number;
  pending: boolean;
}) {
  const sent = safeDate(campaign.sentAt ?? campaign.sendCompletedAt ?? campaign.updatedAt);
  const isSms = campaign.channel === "sms";
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Send size={14} aria-hidden="true" />
        <Typography level="body-xs" sx={{ color: "neutral.600" }}>
          {sent ? `Sent ${format(sent, "MMM d")}` : "Sent"} · {recipients.toLocaleString()} recipients
        </Typography>
      </Stack>
      {!isSms ? (
        <Stack direction="row" spacing={2}>
          <Stack>
            <Typography level="title-md">{pending ? "…" : percent(campaign.openRate, campaign.totalOpens)}</Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>Opened</Typography>
          </Stack>
          <Stack>
            <Typography level="title-md">{pending ? "…" : percent(campaign.clickRate, campaign.totalClicks)}</Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>Clicked</Typography>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

export function CampaignCardGrid({
  campaigns,
  getName,
  getRecipients,
  getProgress,
  getColour,
  statsPending,
  onOpen,
  renderActions,
  renderStatus,
}: CampaignCardGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(3, minmax(0, 1fr))",
          xl: "repeat(4, minmax(0, 1fr))",
        },
      }}
    >
      {campaigns.map((campaign) => {
        const stage = campaignStage(campaign.status);
        const recipients = getRecipients(campaign);
        const colour = getColour?.(campaign);
        const subject = describeMergeTags(campaign.subjectLine.trim());
        const subtitle = subject && subject !== getName(campaign) ? subject : null;
        return (
          <Card
            key={campaign.id}
            variant="outlined"
            onClick={() => onOpen(campaign)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onOpen(campaign);
            }}
            role="link"
            tabIndex={0}
            aria-label={`Open ${getName(campaign)}`}
            sx={{
              p: 1.25,
              gap: 1.25,
              cursor: "pointer",
              borderTop: colour ? `4px solid ${colour}` : undefined,
              transition: "box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease",
              "&:hover, &:focus-visible": {
                boxShadow: "md",
                borderColor: "primary.300",
                transform: "translateY(-2px)",
              },
            }}
          >
            <Thumbnail campaign={campaign} />
            <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
              <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                <Box onClick={(event) => event.stopPropagation()} sx={{ width: "fit-content" }}>
                  {renderStatus(campaign)}
                </Box>
                <Typography level="title-md" sx={{ overflowWrap: "anywhere" }}>
                  {getName(campaign)}
                </Typography>
                {subtitle ? (
                  <Typography level="body-sm" sx={{ color: "neutral.600" }} noWrap>
                    {subtitle}
                  </Typography>
                ) : null}
              </Stack>
              <Box onClick={(event) => event.stopPropagation()} sx={{ flexShrink: 0 }}>
                {renderActions(campaign)}
              </Box>
            </Stack>
            {stage === "draft" ? <DraftFooter campaign={campaign} /> : null}
            {stage === "scheduled" ? <ScheduledFooter campaign={campaign} recipients={recipients} /> : null}
            {stage === "sending" ? (
              <Stack spacing={0.5}>
                <LinearProgress determinate value={getProgress(campaign)} />
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  Sending to {recipients.toLocaleString()} recipients
                </Typography>
              </Stack>
            ) : null}
            {stage === "sent" ? (
              <SentFooter campaign={campaign} recipients={recipients} pending={Boolean(statsPending?.(campaign))} />
            ) : null}
            {stage === "failed" ? (
              <Typography level="body-xs" sx={{ color: "danger.600" }}>
                {campaign.sendBlockedReason
                  ? `Not sent: ${campaign.sendBlockedReason.replace(/_/g, " ")}`
                  : "This send failed. Open it to see why."}
              </Typography>
            ) : null}
          </Card>
        );
      })}
    </Box>
  );
}
