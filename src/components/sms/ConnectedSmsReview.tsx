import * as React from "react";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {useNavigate} from "react-router-dom";
import {JoyDialog, JoyDialogContent} from "@/components/joy/JoyDialog";
import {previewRefreshedSmsDraft, replaceConnectedSmsDraft, type SmsCampaignDraft} from "@/lib/sms/campaignDraft";

export function ConnectedSmsReview({campaign}: {campaign: SmsCampaignDraft}) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [preview, setPreview] = React.useState<Awaited<ReturnType<typeof previewRefreshedSmsDraft>> | null>(null);
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => {mounted.current=true;return () => {mounted.current=false;};}, []);
  const metrics = campaign.metrics && typeof campaign.metrics === "object" && !Array.isArray(campaign.metrics) ? campaign.metrics : {};
  const review = metrics.content_review;
  const reason = review && typeof review === "object" && !Array.isArray(review) && typeof review.reason === "string" ? review.reason : "Linked website content needs review before this campaign can continue.";
  const replacementId = typeof metrics.replacement_campaign_id === "string" ? metrics.replacement_campaign_id : null;
  if (!replacementId && (campaign.status !== "paused" || campaign.source !== "connected_content" || !review || typeof review !== "object" || Array.isArray(review) || review.decision !== "review_required")) return null;
  const load = async () => {
    if(pending.current)return;
    pending.current=true;setOpen(true);setBusy(true);setError("");setPreview(null);
    try {const next=await previewRefreshedSmsDraft(campaign.connected_content_sources);if(mounted.current)setPreview(next);}
    catch(error){if(mounted.current)setError(error instanceof Error ? error.message : "Could not check the website.");}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  };
  const create = async () => {
    if(pending.current||!preview||!campaign.tenant_id)return;
    pending.current=true;setBusy(true);setError("");
    try {
      const draft=await replaceConnectedSmsDraft({tenantId:campaign.tenant_id,campaignId:campaign.id,
        expectedUpdatedAt:campaign.updated_at,name:`Updated ${campaign.name}`.slice(0,180),...preview});
      if(mounted.current)navigate(draft.status==="draft"?`/sms/new?draftId=${draft.id}`:`/sms/${draft.id}`);
    }catch(error){if(mounted.current)setError(error instanceof Error ? error.message : "Unable to create updated draft.");}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  };
  return <>
    <Alert color="warning"><Stack spacing={1}>
      <Typography level="title-md">{replacementId ? "This campaign has been replaced" : "Website content needs review"}</Typography>
      <Typography>{reason}</Typography>
      {replacementId?<Button onClick={()=>navigate(`/sms/${replacementId}`)}>Open replacement campaign</Button>
        :<Button disabled={busy} onClick={()=>void load()}>Review latest website content</Button>}
    </Stack></Alert>
    <JoyDialog open={open} onClose={()=>setOpen(false)} disableClose={busy} title="Review updated text" size="lg">
      <JoyDialogContent><Stack spacing={2}>
        <Typography level="title-sm">Original text</Typography>
        <Typography sx={{whiteSpace:"pre-wrap"}}>{campaign.message}</Typography>
        {busy&&!preview?<Typography>Checking your website…</Typography>:null}
        {error?<Alert color="danger">{error}</Alert>:null}
        {preview?<><Typography level="title-sm">New draft with current website details</Typography>
          <Typography sx={{whiteSpace:"pre-wrap"}}>{preview.message}</Typography>
          <Typography level="body-sm">Creating this draft stops unsent work in the original campaign. Delivered messages stay in its history. You can edit the new text and must choose recipients again before sending.</Typography>
          <Button loading={busy} onClick={()=>void create()}>Create updated text draft</Button></>:null}
      </Stack></JoyDialogContent>
    </JoyDialog>
  </>;
}
