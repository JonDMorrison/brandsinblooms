import * as React from "react";
import { Button, Sheet, Stack, Typography } from "@mui/joy";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

type Campaign = {
  id:string; title:string; status:"queued"|"paused"|"cancelled";
  queued_count:number; accepted:number; failed:number; pending:number;
  clicks:number; created_at:string;
};

/** Aggregated delivery status, never a raw customer/subscription list. */
export function PushCampaignHistory() {
  const {tenant}=useTenant();
  const [campaigns,setCampaigns]=React.useState<Campaign[]>([]);
  const [busy,setBusy]=React.useState(false);
  const [running,setRunning]=React.useState<string|null>(null);
  const [notice,setNotice]=React.useState("");

  const refresh=React.useCallback(async()=>{
    if(!tenant?.id)return;
    setBusy(true);setNotice("");
    try {
      const {data,error}=await supabase.functions.invoke("queue-push-segment",{
        body:{action:"history"},
      });
      if(error)throw error;
      setCampaigns(Array.isArray(data?.campaigns)?data.campaigns:[]);
    }catch{
      setNotice("Unable to load push campaign history.");
    }finally{setBusy(false);}
  },[tenant?.id]);

  React.useEffect(()=>{setCampaigns([]);void refresh();},[refresh]);

  async function change(campaign:Campaign,action:"pause"|"resume"|"cancel"){
    if(running)return;
    if(action==="cancel"&&!window.confirm(
      `Stop sending campaign "${campaign.title}"? Already accepted notifications cannot be recalled.`
    ))return;
    setRunning(campaign.id);setNotice("");
    try{
      const {error}=await supabase.functions.invoke("queue-push-segment",{
        body:{action,campaignId:campaign.id,confirmed:true},
      });
      if(error)throw error;
      await refresh();
      setNotice(action==="pause"?"Campaign paused.":
        action==="resume"?"Campaign resumed.":"Unsent notifications cancelled.");
    }catch{
      setNotice("The campaign state could not be updated. Refresh and try again.");
    }finally{setRunning(null);}
  }

  return <Sheet variant="outlined" sx={{borderRadius:"lg",p:2.5}}>
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Typography level="title-lg">Push campaign activity</Typography>
        <Button variant="outlined" color="neutral" size="sm" loading={busy}
          onClick={()=>void refresh()}>Refresh</Button>
      </Stack>
      <Typography level="body-sm">
        Track queued messages, push-provider acceptance, delivery errors and
        actual notification clicks. Provider acceptance is not proof the phone displayed it.
      </Typography>
      {campaigns.length===0&&<Typography level="body-sm" color="neutral">
        No segment push campaigns have been queued yet.
      </Typography>}
      {campaigns.map(c=><Sheet key={c.id} variant="soft"
        sx={{borderRadius:"lg",p:2}}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            <Typography level="title-md">{c.title}</Typography>
            <Typography level="body-xs" textTransform="capitalize">{c.status}</Typography>
          </Stack>
          <Typography level="body-sm">
            {c.queued_count} recipients queued · {c.accepted} provider accepted
            {" · "}{c.clicks} clicked · {c.failed} failed · {c.pending} pending
          </Typography>
          <Typography level="body-xs" color="neutral">
            Created {new Date(c.created_at).toLocaleString()}
          </Typography>
          {c.status!=="cancelled"&&<Stack direction="row" gap={1} flexWrap="wrap">
            <Button variant="outlined" color="neutral" size="sm"
              disabled={Boolean(running)} onClick={()=>void change(c,c.status==="paused"?"resume":"pause")}>
              {c.status==="paused"?"Resume":"Pause"}
            </Button>
            <Button variant="outlined" color="danger" size="sm"
              disabled={Boolean(running)} onClick={()=>void change(c,"cancel")}>
              Cancel unsent
            </Button>
          </Stack>}
        </Stack>
      </Sheet>)}
      {notice&&<Typography role="status" level="body-sm">{notice}</Typography>}
    </Stack>
  </Sheet>;
}
