import * as React from "react";
import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, Database, FileSpreadsheet, PlugZap, Sparkles, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";

type Source="bloomsuite-pos"|"ideal-api"|"ideal-import"|"connected-pos";
const sources=[
 {id:"bloomsuite-pos" as Source,title:"BloomSuite POS",badge:"Best experience",icon:Sparkles,copy:"Native, real-time customer and transaction intelligence with no separate data sync."},
 {id:"connected-pos" as Source,title:"Connected POS",badge:"Automatic",icon:PlugZap,copy:"Use an existing Square, Shopify, Lightspeed, or other supported BloomSuite POS connection."},
 {id:"ideal-api" as Source,title:"Ideal API",badge:"Preferred for Ideal",icon:Database,copy:"Use Ideal's partner API when your Ideal account has API access. BloomSuite can then keep intelligence current automatically."},
 {id:"ideal-import" as Source,title:"Ideal report sync",badge:"Works today",icon:FileSpreadsheet,copy:"Securely process Ideal customer, sales, points, and coupon reports using BloomSuite's idempotent import framework."},
];

export function CustomerIntelligenceSetupWizard(){
 const navigate=useNavigate();
 const [source,setSource]=React.useState<Source>("bloomsuite-pos");
 const [step,setStep]=React.useState(0);
 const next=()=>setStep(v=>Math.min(3,v+1));
 return <Stack spacing={2.5}>
  <Stack spacing=.75}><JoyChip variant="soft" color="primary" size="sm" startDecorator={<Sparkles size={13}/>}>Customer Intelligence setup</JoyChip><Typography level="h2">Turn your POS data into something useful.</Typography><Typography level="body-md" color="neutral">Choose where purchase data comes from. BloomSuite uses the same Customer Intelligence engine regardless of source, so you can change POS systems later without rebuilding your customer history.</Typography></Stack>
  <LinearProgress determinate value={(step+1)*25} sx={{borderRadius:999}}/>
  {step===0?<Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2,1fr)"},gap:1.5}}>{sources.map(item=>{const Icon=item.icon;const active=source===item.id;return <JoyCard key={item.id} interactive onClick={()=>setSource(item.id)} sx={{borderColor:active?"primary.400":"neutral.200",boxShadow:active?"var(--joy-shadow-md)":"var(--joy-shadow-sm)"}}><JoyCardContent sx={{pt:{xs:3,md:3}}}><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Sheet variant="soft" color="primary" sx={{width:40,height:40,borderRadius:"lg",display:"grid",placeItems:"center"}}><Icon size={19}/></Sheet>{active?<JoyChip size="sm" color="success" startDecorator={<Check size={12}/>}>Selected</JoyChip>:<JoyChip size="sm" variant="soft">{item.badge}</JoyChip>}</Stack><Stack spacing=.5><Typography level="title-md">{item.title}</Typography><Typography level="body-sm" color="neutral">{item.copy}</Typography></Stack></Stack></JoyCardContent></JoyCard>})}</Box>:null}
  {step===1?<JoyCard variant="outlined"><JoyCardHeader title={source==="ideal-api"?"Connect Ideal API":source==="ideal-import"?"Prepare your Ideal reports":"Use your existing connection"} description={source==="ideal-api"?"Ideal publicly offers an API product, but access and endpoint coverage are account-dependent. We'll verify credentials and supported data before activating sync.":source==="ideal-import"?"BloomSuite recognizes the six Ideal report families used for Customer Intelligence and safely ignores repeat imports.":"BloomSuite will use your existing POS connection and normalized order/customer data."}/><JoyCardContent><Sheet variant="soft" color="neutral" sx={{borderRadius:"xl",p:2.5}}><Stack spacing={1}>{source==="ideal-import"?["Customer Sales","Customer Sales by Sales Category","Customer Spending","Customer Points","Coupons Issued","Coupons Redeemed"].map(x=><Stack key={x} direction="row" spacing={1} alignItems="center"><Check size={14}/><Typography level="body-sm">{x}</Typography></Stack>):<><Typography level="title-sm">What happens next</Typography><Typography level="body-sm" color="neutral">We validate the source, match customer identities, normalize purchase events, and show a reconciliation summary before Customer Intelligence is activated.</Typography></>}</Stack></Sheet></JoyCardContent></JoyCard>:null}
  {step===2?<JoyCard variant="outlined"><JoyCardHeader title="Validate & reconcile" description="BloomSuite never silently inflates customer value. Every source is reconciled before intelligence is activated."/><JoyCardContent><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(3,1fr)"},gap:1.25}}>{[["Customer identity","Match customers safely"],["Purchase history","Deduplicate transactions"],["Intelligence health","Verify usable coverage"]].map(([a,b])=><Sheet key={a} variant="soft" color="neutral" sx={{borderRadius:"xl",p:2}}><Typography level="title-sm">{a}</Typography><Typography level="body-xs" color="neutral">{b}</Typography></Sheet>)}</Box></JoyCardContent></JoyCard>:null}
  {step===3?<JoyCard variant="outlined"><JoyCardHeader title="You're ready for Customer Intelligence" description="Once data is flowing, BloomSuite turns purchase history into customer stories, audiences, opportunities, and proactive Bloom insights."/><JoyCardContent><Stack spacing={2}><Sheet variant="soft" color="primary" sx={{borderRadius:"xl",p:2.5}}><Stack direction="row" spacing={1.5}><Sparkles size={20}/><Stack><Typography level="title-md">Bloom starts working immediately</Typography><Typography level="body-sm" color="neutral">Bloom can explain customer behavior, rank audiences, identify valuable customers who are slowing down, and surface opportunities proactively.</Typography></Stack></Stack></Sheet><JoyButton onClick={()=>navigate("/crm/intelligence")}>Explore Customer Intelligence</JoyButton></Stack></JoyCardContent></JoyCard>:null}
  <Stack direction="row" justifyContent="space-between"><JoyButton variant="plain" color="neutral" disabled={step===0} onClick={()=>setStep(v=>Math.max(0,v-1))}>Back</JoyButton>{step<3?<JoyButton onClick={next} endDecorator={step===0?<UploadCloud size={14}/>:undefined}>{step===0?"Continue":"Looks good"}</JoyButton>:null}</Stack>
 </Stack>;
}
