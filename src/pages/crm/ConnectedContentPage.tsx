import * as React from "react";
import Box from "@mui/joy/Box";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CheckCircle2, ExternalLink, Globe2, Link2, Mail, MessageSquare, Megaphone, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/utils/toast";
import { DesignSystemProvider, useDesignSystem } from "@/contexts/DesignSystemContext";
import { JoyDialog, JoyDialogContent } from "@/components/joy/JoyDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { PageContainer } from "@/components/joy/PageContainer";
import { useUserRole } from "@/hooks/useUserRole";
import { ensureFooterBlockCompliance } from "@/lib/studio/footerCompliance";
import { saveConnectedSmsDraft } from "@/lib/sms/campaignDraft";
import { useTenant } from "@/hooks/useTenant";
import { persistCampaignDraft } from "@/lib/crm/campaignEditor";
import {
  buildConnectedContentBlock,
  buildConnectedContentSms,
  connectedContentRequest,
  type ConnectedContentItem,
  type ConnectedContentResponse,
  type ConnectedWebsite,
} from "@/lib/connectedContent";

const categoryOptions=[
  {id:"events",label:"Events"},
  {id:"pages",label:"Pages"},
  {id:"products",label:"Products"},
  {id:"blogs",label:"Blog"},
  {id:"fundraisers",label:"Fundraisers"},
];

const CONNECTED_WEBSITE_CODE_PATTERN=/^[0-9a-f]{64}$/;
const WRONG_CODE_MESSAGE="This is not a Connected websites code. In BloomSites, open Integrations, choose Connect BloomSites and BloomSuite, and generate a new code.";

function ContentWorkspace() {
  const navigate=useNavigate();
  const {tenant}=useTenant();
  const [params]=useSearchParams();
  const {designSystem}=useDesignSystem();
  const {hasPermission,isLoading:rolesLoading}=useUserRole();
  const canManage=hasPermission("integrations.manage");
  const canPromote=hasPermission("campaigns.write");
  const promoteSite=params.get("promoteSite")??"";
  const promoteId=params.get("promoteId")??"";
  const [code,setCode]=React.useState("");
  const [type,setType]=React.useState("events");
  const [query,setQuery]=React.useState("");
  const [siteId,setSiteId]=React.useState(promoteSite);
  const [data,setData]=React.useState<ConnectedContentResponse|null>(null);
  const [loading,setLoading]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState("");
  const [connections,setConnections]=React.useState<ConnectedWebsite[]>([]);
  const [promotionItem,setPromotionItem]=React.useState<ConnectedContentItem|null>(null);
  const promotionPending=React.useRef(false);
  const handledDeepLink=React.useRef("");
  React.useEffect(()=>{
    const key=`${promoteSite}:${promoteId}`;
    if(rolesLoading||!canPromote||!promoteSite||!promoteId||handledDeepLink.current===key)return;
    let cancelled=false;
    void connectedContentRequest<ConnectedContentResponse>({action:"catalog",type:"events",siteId:promoteSite,itemId:promoteId,limit:1})
      .then(result=>{
        if(cancelled)return;
        const item=result.items.find(item=>item.siteId===promoteSite&&item.id===promoteId);
        handledDeepLink.current=key;
        if(item&&item.eventStatus!=="cancelled"&&item.eventStatus!=="sold_out")setPromotionItem(item);
        else setError("This website event is no longer available to promote.");
      }).catch(()=>{if(!cancelled)setError("Could not load the event from your website. Refresh to try again.");});
    return()=>{cancelled=true;};
  },[canPromote,rolesLoading,promoteSite,promoteId]);
  const refresh=React.useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const next=await connectedContentRequest<ConnectedContentResponse>({
        action:"catalog",type,siteId,q:query,limit:50,
      });
      setConnections(next.connections??[]);
      setData(next);
    }catch(e){setError(e instanceof Error?e.message:"Couldn't load your connected websites.");}
    finally{setLoading(false);}
  },[type,siteId,query]);
  React.useEffect(()=>{
    if(rolesLoading || (!canPromote && !canManage))return;
    const timeout=window.setTimeout(()=>{void refresh();},query?300:0);
    return()=>window.clearTimeout(timeout);
  },[refresh,rolesLoading,canPromote,canManage,query]);
  const connect=async()=>{
    if(!code.trim())return;
    // Mirrors the connected-content edge function check. A non-2xx reply
    // surfaces only as a generic error, so catch the common mix-up with the
    // shorter Store details (Customer Intelligence) code here.
    if(!CONNECTED_WEBSITE_CODE_PATTERN.test(code.trim().toLowerCase())){
      setError(WRONG_CODE_MESSAGE);
      return;
    }
    setBusy(true);setError("");
    try{
      await connectedContentRequest<{connected:boolean}>({action:"connect",code:code.trim()});
      setCode("");
      toast.success("Website connected. Published content is ready to promote.");
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Couldn't connect this website.");}
    finally{setBusy(false);}
  };
  const disconnect=async(connection:ConnectedWebsite)=>{
    if(!window.confirm(`Disconnect ${connection.site_name} from this CRM business? Draft campaigns will not be deleted.`))return;
    setBusy(true);
    try {
      await connectedContentRequest<{disconnected:boolean}>({
        action:"disconnect",siteId:connection.cms_site_id,
      });
      if(siteId===connection.cms_site_id)setSiteId("");
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Couldn't disconnect this website.");}
    finally{setBusy(false);}
  };
  const promote=async(item:ConnectedContentItem,channel:"email"|"sms")=>{
    if(promotionPending.current || !canPromote || item.eventStatus==="cancelled" || item.eventStatus==="sold_out")return;
    promotionPending.current=true;
    setBusy(true);setError("");
    try {
      const content=channel==="email"?buildConnectedContentBlock(item,designSystem):null;
      const blocks=content?ensureFooterBlockCompliance([content],{designSystem}):[];
      const sms=channel==="sms"?buildConnectedContentSms(item):null;
      // Always starts as a DRAFT with no audience and no scheduled send.
      if(sms&&!tenant?.id)throw new Error("Select a business before creating a text draft.");
      const draft=sms?await saveConnectedSmsDraft({
        tenantId:tenant!.id,name:`Promote ${item.title}`.slice(0,180),
        message:sms.smsMessage,sources:[sms.source],
      }):await persistCampaignDraft({
        campaignType:"email",status:"draft",
        name:`Promote ${item.title}`.slice(0,180),
        subjectLine:channel==="sms"?"":item.type==="event"?`Join us for ${item.title}`:`Discover ${item.title}`,
        preheaderText:item.description?.slice(0,150)??"",
        senderName:"",senderEmail:"",replyTo:"",
        contentBlocks:blocks,smsMessage:sms?.smsMessage??"",sendAt:null,
        sendImmediately:false,segments:[],personas:[],
        includeAllCustomers:false,additionalCustomerIds:[],
      });
      setPromotionItem(null);
      toast.success(`${channel==="sms"?"Text message":"Newsletter"} draft created. Review and choose your recipients before sending.`);
      navigate(channel==="sms"?`/sms/new?draftId=${draft.id}`:`/crm/campaigns/${draft.id}/studio`);
    }catch(e){setError(e instanceof Error?e.message:"Couldn't create your draft.");}
    finally{promotionPending.current=false;setBusy(false);}
  };
  if(!rolesLoading&&!canPromote&&!canManage){
    return <PageContainer><Typography role="alert">You don't have permission to manage connected websites or create campaigns.</Typography></PageContainer>;
  }
  return <PageContainer fullWidth>
    <Stack spacing={3} sx={{px:{xs:2,md:3},py:{xs:2,md:3},pb:5}}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box sx={{width:44,height:44,bgcolor:"neutral.100",color:"neutral.700",borderRadius:"lg",display:"grid",placeItems:"center"}}>
            <Globe2 size={22} aria-hidden="true"/>
          </Box>
          <Box>
            <Typography level="h3">Connected websites</Typography>
            <Typography level="body-sm" color="neutral">
              Create on BloomSites. Promote with BloomSuite.
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {canManage?(
        <Sheet variant="outlined" sx={{borderRadius:"lg",p:{xs:2,md:2.5},bgcolor:"background.surface"}}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ShieldCheck size={19} aria-hidden="true"/>
              <Typography level="title-md">Connect BloomSites and BloomSuite</Typography>
            </Stack>
            <Box component="ol" sx={{m:0,pl:2.5,display:"grid",gap:0.5}}>
              <Typography component="li" level="body-sm">
                In BloomSites, open Integrations, choose Connect BloomSites and BloomSuite, and select Generate connection code.
              </Typography>
              <Typography component="li" level="body-sm">In BloomSuite, open Connected websites (this page).</Typography>
              <Typography component="li" level="body-sm">Paste the code within ten minutes and confirm the business.</Typography>
            </Box>
            <Typography level="body-xs" color="neutral">
              The Store details code is for Customer Intelligence and does not work here.
            </Typography>
            <Stack direction={{xs:"column",sm:"row"}} spacing={1}>
              <Input
                aria-label="BloomSites connection code"
                value={code} onChange={event=>setCode(event.target.value)}
                placeholder="Paste your one-time connection code"
                sx={{flex:1,fontFamily:"monospace",fontSize:"13px"}}
              />
              <JoyButton disabled={busy||!code.trim()} onClick={()=>void connect()} sx={{minHeight:44}}>
                Connect website
              </JoyButton>
              <JoyButton color="neutral" variant="outlined"
                onClick={()=>window.open("https://bloomsites.app/dashboard/integrations/connected-content","_blank","noopener,noreferrer")}>
                Open BloomSites connection page <ExternalLink size={15}/>
              </JoyButton>
            </Stack>
          </Stack>
        </Sheet>
      ):null}

      {error?<Typography role="alert" level="body-sm" color="danger">{error}</Typography>:null}
      <Stack spacing={1}>
        <Typography level="title-md">Your website connections</Typography>
        {connections.length===0&&!loading?
          <Typography level="body-sm" color="neutral">No connected websites yet. Generate a code in BloomSites to begin.</Typography>
          :null}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {connections.map(site=><Sheet key={site.id} variant="outlined"
            sx={{p:1.5,borderRadius:"lg",display:"inline-flex",gap:1.5,alignItems:"center"}}>
            <CheckCircle2 size={17} color="var(--joy-palette-success-700)" aria-hidden="true"/>
            <Stack spacing={0.25}>
              <Typography level="title-sm">{site.site_name}</Typography>
              <Typography level="body-xs" color="neutral">{site.site_origin}</Typography>
            </Stack>
            {canManage?<JoyButton size="sm" variant="plain" color="neutral"
              aria-label={`Disconnect ${site.site_name}`}
              onClick={()=>void disconnect(site)}
              disabled={busy}><Trash2 size={15}/></JoyButton>:null}
          </Sheet>)}
        </Stack>
      </Stack>

      {connections.length>0?(
        <Stack spacing={1.75}>
          <Stack direction={{xs:"column",sm:"row"}} spacing={1} alignItems={{xs:"stretch",sm:"center"}}>
            <Typography level="title-lg" sx={{flex:1}}>From your website</Typography>
            <select
              aria-label="Website"
              value={siteId}
              onChange={e=>setSiteId(e.target.value)}
              style={{border:"1px solid #CBD5E1",background:"#FFFFFF",color:"#334155",borderRadius:8,padding:"9px 12px"}}>
              <option value="">All connected websites</option>
              {connections.map(site=><option key={site.id} value={site.cms_site_id}>{site.site_name}</option>)}
            </select>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {categoryOptions.map(option=><JoyButton key={option.id}
              color={type===option.id?"primary":"neutral"}
              variant={type===option.id?"solid":"soft"} size="sm"
              onClick={()=>setType(option.id)}>
              {option.label}
            </JoyButton>)}
          </Stack>
          <Input value={query} onChange={event=>setQuery(event.target.value)}
            aria-label="Search published website content" placeholder="Search published content…"
            startDecorator={<Search size={16} aria-hidden="true"/>}/>
          {loading?<Typography level="body-sm" color="neutral">Loading content…</Typography>:null}
          {!loading&&data?.items?.length===0?
            <Typography level="body-sm" color="neutral">
              Nothing published matches this selection. Try a different category.
            </Typography>:null}
          {data?.errors.length?(
            <Typography level="body-sm" color="neutral">
              One website was temporarily unavailable. Refresh to try again.
            </Typography>
          ):null}
          <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2,minmax(0,1fr))",xl:"repeat(3,minmax(0,1fr))"},gap:2}}>
            {(data?.items??[]).map(item=><Sheet key={item.siteId+item.id} variant="outlined"
              sx={{p:2,borderRadius:"lg",aspectRatio:{xs:"auto",sm:"1 / 1"},minHeight:{xs:360,sm:0},bgcolor:promoteId===item.id?"neutral.50":"background.surface"}}>
              <Stack spacing={1.5} sx={{height:"100%"}}>
                <Box sx={{flex:"1 1 0",minHeight:140,borderRadius:"md",overflow:"hidden",bgcolor:"neutral.100",display:"grid",placeItems:"center"}}>
                  {item.imageUrl?<Box component="img" src={item.imageUrl} alt="" sx={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    :<Globe2 size={32} color="var(--joy-palette-neutral-400)"/>}
                </Box>
                <Stack spacing={0.5}>
                  <Typography level="title-md">{item.title}</Typography>
                  {item.eventStatus==="cancelled" || item.eventStatus==="sold_out" ? <Typography color="danger" level="body-sm">{item.eventStatus==="cancelled" ? "Cancelled" : "Sold out"}</Typography> : null}
                  <Typography level="body-sm" color="neutral" sx={{minHeight:30}}>
                    {item.description?.slice(0,125)||"Published on your website"}
                  </Typography>
                  <Typography level="body-xs" color="neutral">{item.siteName}</Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  {canPromote?<JoyButton
                    color="primary" disabled={busy || item.eventStatus==="cancelled" || item.eventStatus==="sold_out"}
                    startDecorator={<Megaphone size={15}/>}
                    onClick={()=>{setError("");setPromotionItem(item);}} sx={{flex:1}}>
                    Promote
                  </JoyButton>:null}
                  <JoyButton color="neutral" variant="outlined"
                    aria-label={`View ${item.title} on website`}
                    onClick={()=>window.open(item.publicUrl,"_blank","noopener,noreferrer")}>
                    <Link2 size={16}/>
                  </JoyButton>
                </Stack>
              </Stack>
            </Sheet>)}
          </Box>
          {data?.sources.some(source=>source.hasMore)?
            <Typography level="body-sm" color="neutral">
              Showing the first matching published items. Search or choose a specific category to narrow results.
            </Typography>:null}
        </Stack>
      ):null}
    </Stack>
    <JoyDialog open={promotionItem!==null} onClose={()=>setPromotionItem(null)}
      disableClose={busy} title="Promote your website content"
      description="Choose a draft to create. You’ll review it and choose recipients before sending.">
      <JoyDialogContent>
        <Stack spacing={2}>
          <Typography level="title-md">{promotionItem?.title}</Typography>
          {error?<Typography role="alert" color="danger">{error}</Typography>:null}
          <JoyButton disabled={busy} startDecorator={<Mail size={18}/>}
            onClick={()=>{if(promotionItem)void promote(promotionItem,"email");}}>
            Create email newsletter draft
          </JoyButton>
          <JoyButton disabled={busy} variant="outlined" startDecorator={<MessageSquare size={18}/>}
            onClick={()=>{if(promotionItem)void promote(promotionItem,"sms");}}>
            Create text message draft
          </JoyButton>
          <Typography level="body-sm" color="neutral">
            Text messages use your existing SMS setup and recipient preferences.
          </Typography>
        </Stack>
      </JoyDialogContent>
    </JoyDialog>
  </PageContainer>;
}
export default function ConnectedContentPage(){
  return <DesignSystemProvider><ContentWorkspace/></DesignSystemProvider>;
}
