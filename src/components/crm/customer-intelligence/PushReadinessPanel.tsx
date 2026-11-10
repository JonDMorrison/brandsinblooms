import * as React from "react";
import { Bell, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, Sheet, Stack, Typography } from "@mui/joy";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

type Readiness = {
  linkedSites:number;
  pendingIdentities:number;
  verifiedIdentities:number;
  activeSubscriptions:number;
  optedIn:number;
  queued:number;
  accepted:number;
  failed:number;
  clicks:number;
  vapidConfigured:boolean;
  pilotEnabled:boolean;
  deliveryEnabled:boolean;
  campaignsEnabled:boolean;
};

export function PushReadinessPanel() {
  const {tenant}=useTenant();
  const [health,setHealth]=React.useState<Readiness|null>(null);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState("");

  const refresh=React.useCallback(async()=>{
    if(!tenant?.id) return;
    setBusy(true);setError("");
    try {
      const {data,error:failure}=await supabase.functions.invoke("push-readiness",{
        body:{},
      });
      if(failure || !data || typeof data.linkedSites!=="number"){
        throw Error("Unable to load channel status");
      }
      if(data.tenantId!==tenant.id)throw Error("Tenant switched; try refreshing");
      setHealth(data as Readiness);
    } catch {
      setHealth(null);
      setError("Push channel health is unavailable. Check your CRM admin access and the deployed function.");
    } finally {setBusy(false);}
  },[tenant?.id]);

  React.useEffect(()=>{
    setHealth(null);
    void refresh();
  },[refresh]);

  if(!tenant?.id) return null;
  const stats=health?[
    ["Linked stores",health.linkedSites],
    ["Verified customers",health.verifiedIdentities],
    ["Review required",health.pendingIdentities],
    ["Opted-in devices",health.activeSubscriptions],
    ["Provider accepted",health.accepted],
    ["Notification clicks",health.clicks],
    ["Send errors",health.failed],
    ["Queued",health.queued],
  ] as const : [];

  const configured=Boolean(health?.vapidConfigured && health?.pilotEnabled &&
    health?.deliveryEnabled);
  return <Sheet variant="outlined" sx={{borderRadius:"xl",p:{xs:2,md:3}}}>
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Bell size={20} aria-hidden="true"/>
          <Typography level="h3">Web Push readiness</Typography>
        </Stack>
        <Button size="sm" variant="outlined" color="neutral" loading={busy}
          startDecorator={<RefreshCw size={16}/>} onClick={()=>void refresh()}>
          Refresh
        </Button>
      </Stack>
      <Typography level="body-sm">
        Push is a separate, permission-based channel alongside email and SMS.
        See what is prepared before sending to a real customer.
      </Typography>
      {error&&<Typography role="alert" level="body-sm" color="danger">{error}</Typography>}
      {health&&<>
        <Sheet variant="soft" color="neutral" sx={{p:2,borderRadius:"lg"}}>
          <Stack direction="row" alignItems="center" gap={1}>
            <ShieldCheck size={18} aria-hidden="true"/>
            <Typography level="title-sm">
              {configured?"Push transport configured":"Not yet ready to send"}
            </Typography>
          </Stack>
          <Typography level="body-sm">
            VAPID keys: {health.vapidConfigured?"Configured":"Missing"}.
            {" "}Test pilot: {health.pilotEnabled?"Enabled":"Disabled"}.
            {" "}Delivery: {health.deliveryEnabled?"Enabled":"Disabled"}.
            {" "}Segment campaigns: {health.campaignsEnabled?"Enabled":"Disabled"}.
          </Typography>
        </Sheet>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
          {stats.map(([label,value])=><div key={label}
            style={{border:"1px solid var(--joy-palette-neutral-200)",borderRadius:12,padding:12}}>
            <Typography level="h4">{value}</Typography>
            <Typography level="body-xs" color="neutral">{label}</Typography>
          </div>)}
        </div>
        <Typography level="body-xs" color="neutral">
          Active subscriptions are not the same as installed apps. A push provider's
          acceptance does not guarantee device delivery. No fallback email or SMS is
          sent automatically.
        </Typography>
      </>}
    </Stack>
  </Sheet>;
}
