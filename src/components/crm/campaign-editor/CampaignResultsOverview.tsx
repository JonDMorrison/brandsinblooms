import type { ReactNode } from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CheckCircle, Copy, Eye, MailCheck, MousePointerClick, RefreshCw, Send, Users } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";

interface ResultsProps {
  name: string;
  subject: string;
  completedAt: string;
  sent: number;
  delivered: number | null;
  opened: number | null;
  clicked: number | null;
  bounced: number | null;
  failed: number;
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  cloning: boolean;
  onReport: () => void;
  onRecipients: () => void;
  onDuplicate: () => void;
  onRetry: () => void;
}

const count = (value: number | null) => value === null ? "—" : value.toLocaleString();
const rate = (value: number | null) => value === null ? "Updating as results arrive" : `${value.toFixed(1)}%`;

function ResultMetric({ label, value, detail, icon }: { label: string; value: number | null; detail: string; icon: ReactNode }) {
  return <Sheet variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: "lg", minWidth: 0, bgcolor: "background.surface", boxShadow: "0 3px 14px rgb(24 60 83 / 4%)" }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
      <Typography level="body-sm" textColor="text.secondary">{label}</Typography>
      <Box sx={{ color: "neutral.500", display: "flex" }}>{icon}</Box>
    </Stack>
    <Typography level="h2" sx={{ mt: 1.5, mb: .5, fontWeight: 700, letterSpacing: "-.035em", fontVariantNumeric: "tabular-nums" }}>{count(value)}</Typography>
    <Typography level="body-xs" textColor="text.secondary">{detail}</Typography>
  </Sheet>;
}

export function CampaignResultsOverview(props: ResultsProps) {
  const needsReview = props.failed > 0 || (props.bounced ?? 0) > 0;
  return <Stack spacing={2.5} sx={{ width: "100%", maxWidth: 1280, mx: "auto" }}>
    <Sheet variant="outlined" sx={{ borderRadius: "xl", p: { xs: 2.5, md: 4 }, position: "relative", overflow: "hidden", boxShadow: "0 5px 24px rgb(24 60 83 / 5%)", bgcolor: "background.surface", "&::before": { content: '\"\"', position: "absolute", right: -20, top: -45, width: 340, height: 320, background: 'url("/images/dashboard/botanical-corner.svg") center / contain no-repeat', pointerEvents: "none" }, "& > *": { position: "relative" } }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
        <Stack spacing={1.25} sx={{ minWidth: 0, maxWidth: 700 }}>
          <Stack direction="row" gap={1} alignItems="center">
            <CheckCircle size={19} color="var(--joy-palette-success-700)" aria-hidden="true" />
            <Typography level="body-sm" fontWeight="lg">Sending finished</Typography>
          </Stack>
          <Typography level="h2" sx={{ fontWeight: 700, letterSpacing: "-.025em" }}>{props.sent > 0 ? "Your campaign is out in the world." : "Sending finished. Let’s review the results."}</Typography>
          <Typography level="body-md" textColor="text.secondary">
            <strong>{props.sent.toLocaleString()} emails sent.</strong> Here’s how your campaign is doing so far.
          </Typography>
          <Typography level="body-xs" textColor="text.secondary">Completed {props.completedAt} · Results update as activity arrives.</Typography>
        </Stack>
        <JoyButton variant="solid" color="primary" size="lg" startDecorator={<MailCheck size={18} />} onClick={props.onReport} sx={{ flexShrink: 0 }}>Explore full report</JoyButton>
      </Stack>
    </Sheet>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
      <ResultMetric label="Emails sent" value={props.sent} detail="Accepted by the email provider" icon={<Send size={18} />} />
      <ResultMetric label="Delivery confirmed" value={props.delivered} detail={`${rate(props.deliveryRate)}${props.deliveryRate === null ? "" : " of sent emails"}`} icon={<MailCheck size={18} />} />
      <ResultMetric label="People who clicked" value={props.clicked} detail={`${rate(props.clickRate)}${props.clickRate === null ? "" : " click-through rate"}`} icon={<MousePointerClick size={18} />} />
      <ResultMetric label="Reported opens" value={props.opened} detail={`${rate(props.openRate)}${props.openRate === null ? "" : " reported open rate"}`} icon={<Eye size={18} />} />
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.2fr) minmax(0, 1fr)" }, gap: 2 }}>
      <Sheet variant="outlined" sx={{ borderRadius: "lg", p: { xs: 2, md: 2.5 }, bgcolor: "background.surface" }}>
        <Stack spacing={1.25}>
          <Typography level="body-xs" sx={{ textTransform: "uppercase", letterSpacing: ".09em", color: "neutral.500", fontWeight: 700 }}>Campaign details</Typography>
          <Typography level="title-lg" sx={{ overflowWrap: "anywhere" }}>{props.name}</Typography>
          <Typography level="body-sm" textColor="text.secondary" sx={{ overflowWrap: "anywhere" }}>{props.subject}</Typography>
          <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
            <JoyButton variant="outlined" color="neutral" size="sm" startDecorator={<Users size={16} />} onClick={props.onRecipients}>View recipients</JoyButton>
            <JoyButton variant="plain" color="neutral" size="sm" loading={props.cloning} startDecorator={<Copy size={16} />} onClick={props.onDuplicate}>Use this campaign again</JoyButton>
          </Stack>
        </Stack>
      </Sheet>
      <Sheet variant="outlined" sx={{ borderRadius: "lg", p: { xs: 2, md: 2.5 }, bgcolor: "background.surface" }}>
        <Stack spacing={1.25}>
          <Typography level="title-md">{needsReview ? "A little list housekeeping" : "What happens next?"}</Typography>
          {needsReview ? <Typography level="body-sm" textColor="text.secondary">
            {props.failed > 0 ? `${props.failed.toLocaleString()} emails could not be sent. ` : ""}
            {(props.bounced ?? 0) > 0 ? `${props.bounced!.toLocaleString()} sent emails bounced. ` : ""}
            Review these contacts before your next campaign.
          </Typography> : <Typography level="body-sm" textColor="text.secondary">Delivery confirmations, clicks, and reported opens can continue arriving. Your report keeps the latest results in one place.</Typography>}
          {props.failed > 0 ? <JoyButton variant="plain" color="neutral" size="sm" startDecorator={<RefreshCw size={16} />} onClick={props.onRetry} sx={{ alignSelf: "flex-start" }}>Review retry options</JoyButton> : needsReview ? <JoyButton variant="plain" color="neutral" size="sm" onClick={props.onRecipients} sx={{ alignSelf: "flex-start" }}>Review contacts</JoyButton> : null}
        </Stack>
      </Sheet>
    </Box>
    <Typography level="body-xs" textColor="text.secondary">Sent means the provider accepted an email; delivery is confirmed separately. Opens can be inflated by email privacy features. Clicks are a more useful engagement signal.</Typography>
  </Stack>;
}
