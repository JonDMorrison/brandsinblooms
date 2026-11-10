import * as React from "react";
import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Checkbox from "@mui/joy/Checkbox";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, Database, FileSpreadsheet, PlugZap, Sparkles, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";

import { PreparedIdealSourceReview } from "./PreparedIdealSourceReview";

type Source="bloomsuite-pos"|"ideal-api"|"ideal-import"|"connected-pos";
type Result={success?:boolean;import_id?:string;postprocessing_pending?:boolean;warnings?:string[];preview?:boolean;approved_digest?:string;ready_to_import?:boolean;report_is_aggregate?:boolean;can_measure_visits?:boolean;missing_dated_transactions?:number;notices?:string[];untransformed_rows?:number;report_type?:string;source_rows?:number;accepted?:number;duplicates?:number;rejected?:number;customers_touched?:number;duplicate_file?:boolean;message?:string;errors?:string[]};
const sources=[
 {id:"bloomsuite-pos" as Source,title:"BloomSuite POS",badge:"Best experience",icon:Sparkles,copy:"Native, real-time customer and transaction intelligence with no separate data sync."},
 {id:"connected-pos" as Source,title:"Connected POS",badge:"Automatic",icon:PlugZap,copy:"Use an existing Square, Shopify, Lightspeed, or other supported BloomSuite POS connection."},
 {id:"ideal-api" as Source,title:"Ideal direct connection",badge:"Support verification needed",icon:Database,copy:"Available only if your specific IdealPOS installation supports an authorized customer and transaction API. No live connection is assumed."},
 {id:"ideal-import" as Source,title:"Ideal report import",badge:"Source review required",icon:FileSpreadsheet,copy:"Bring in sales, loyalty and coupon reports after verifying the actual export layout and reconciling the recorded values."},
];

async function importFailure(error:unknown):Promise<Error>{
 let message=error instanceof Error?error.message:"Ideal report request failed.";
 const response=(error as {context?:unknown}|null)?.context;
 if(response instanceof Response){try{const detail=await response.clone().json();if(typeof detail?.error==="string")message=detail.error;if(typeof detail?.import_id==="string")message+=` Import reference: ${detail.import_id}.`;if(typeof detail?.status==="string")message+=` Recorded status: ${detail.status}.`;}catch{/* Keep the transport failure when no structured response is available. */}}
 return new Error(message);
}

export function CustomerIntelligenceSetupWizard(){
 const navigate=useNavigate();const [source,setSource]=React.useState<Source>("bloomsuite-pos");const [step,setStep]=React.useState(0);
 const [files,setFiles]=React.useState<File[]>([]);const [results,setResults]=React.useState<Result[]>([]);const [uploading,setUploading]=React.useState(false);
 const [reviewApproved,setReviewApproved]=React.useState(false);
 const [commitOutcomes,setCommitOutcomes]=React.useState<{filename:string;result:Result}[]>([]);const [commitError,setCommitError]=React.useState<string|null>(null);const [commitAttempted,setCommitAttempted]=React.useState(false);
 const canCommit=!commitAttempted&&results.length===files.length&&results.length>0&&results.every(r=>r.preview&&r.ready_to_import&&typeof r.approved_digest==="string");

 const next=()=>setStep(v=>Math.min(3,v+1));
 const upload=async()=>{
  if(!files.length){toast.error("Choose at least one Ideal report.");return;}
  setUploading(true);setResults([]);setReviewApproved(false);setCommitError(null);setCommitOutcomes([]);setCommitAttempted(false);const nextResults:Result[]=[];
  try{for(const file of files){if(file.size>25*1024*1024)throw new Error("This original exceeds the direct-upload limit. Use the large-report preparation workflow below; keep the original intact.");const form=new FormData();form.append("file",file);form.append("mode","preview");const {data,error}=await supabase.functions.invoke("ideal-intelligence-import",{body:form});if(error)throw await importFailure(error);nextResults.push(data as Result);}setResults(nextResults);setStep(2);toast.success("Source review ready. Nothing has been imported yet.");}
  catch(e){toast.error(e instanceof Error?e.message:"Ideal report import failed.");}finally{setUploading(false);}
 };
 const commit=async()=>{
  if(!canCommit||!reviewApproved){toast.error("Review and approve the exact report diagnostics before importing.");return;}
  setUploading(true);setCommitAttempted(true);setCommitError(null);
  const completed:Result[]=[];
  try {
   for(let i=0;i<files.length;i++){
    const form=new FormData();
    form.append("file",files[i]);form.append("mode","commit");
    form.append("confirmed","true");form.append("approved_digest",results[i].approved_digest!);
    form.append("accept_rejected","true");
    const {data,error}=await supabase.functions.invoke("ideal-intelligence-import",{body:form});
    if(error)throw await importFailure(error);
    if(data?.success!==true)throw new Error("The server did not confirm this import. Check import history before trying again.");
    completed.push(data as Result);
    setCommitOutcomes(previous=>[...previous,{filename:files[i].name,result:data as Result}]);
    if(data.postprocessing_pending)throw new Error("The import was recorded, but data health or metric refresh is pending. Check import history before processing more files.");
    if(data.rejected>0)throw new Error("This report finished with rejected records. Review its import history before processing more files.");
   }
   setResults(completed);setStep(3);toast.success("Import responses recorded. Review reconciliation totals before using customer growth.");
  } catch(e) {const message=e instanceof Error?e.message:"Import could not be confirmed.";setCommitError(message);setResults(completed);setReviewApproved(false);toast.error(message);}
  finally{setUploading(false);}
 };
 return <Stack spacing={2.5}>
  <Stack spacing={0.75}><JoyChip variant="soft" color="primary" size="sm" startDecorator={<Sparkles size={13}/>}>Customer Intelligence setup</JoyChip><Typography level="h2">Turn your POS data into something useful.</Typography><Typography level="body-md" color="neutral">Choose where purchase data comes from. BloomSuite uses the same Customer Intelligence engine regardless of source, so you can change POS systems later without rebuilding your customer history.</Typography></Stack>
  <LinearProgress determinate value={(step+1)*25} sx={{borderRadius:999}}/>
  {step===0?<Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2,1fr)"},gap:1.5}}>{sources.map(item=>{const Icon=item.icon,active=source===item.id;return <JoyCard key={item.id} interactive onClick={()=>setSource(item.id)} sx={{borderColor:active?"primary.400":"neutral.200",boxShadow:active?"var(--joy-shadow-md)":"var(--joy-shadow-sm)"}}><JoyCardContent sx={{pt:{xs:3,md:3}}}><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Sheet variant="soft" color="primary" sx={{width:40,height:40,borderRadius:"lg",display:"grid",placeItems:"center"}}><Icon size={19}/></Sheet>{active?<JoyChip size="sm" color="success" startDecorator={<Check size={12}/>}>Selected</JoyChip>:<JoyChip size="sm" variant="soft">{item.badge}</JoyChip>}</Stack><Stack spacing={0.5}><Typography level="title-md">{item.title}</Typography><Typography level="body-sm" color="neutral">{item.copy}</Typography></Stack></Stack></JoyCardContent></JoyCard>})}</Box>:null}
  {step===1?<JoyCard variant="outlined"><JoyCardHeader title={source==="ideal-api"?"Ideal API access":source==="ideal-import"?"Upload Ideal reports":"Use your existing connection"} description={source==="ideal-api"?"Confirm the exact installed POS product, API entitlement and customer/dated-transaction endpoints with IdealPOS support before enabling a connection.":source==="ideal-import"?"Upload original Ideal exports for review. Crystal Reports summaries require report-specific mapping and reconciliation before their statistics can be trusted.":"BloomSuite uses your existing normalized POS customer and order data."}/><JoyCardContent>{source==="ideal-import"?<Stack spacing={2}><Sheet variant="soft" color="neutral" sx={{borderRadius:"xl",p:2.5}}><Stack spacing={1}>{["Customer Sales","Customer Sales by Sales Category","Customer Spending","Customer Points","Coupons Issued","Coupons Redeemed"].map(x=><Stack key={x} direction="row" spacing={1} alignItems="center"><Check size={14}/><Typography level="body-sm">{x}</Typography></Stack>)}</Stack></Sheet><PreparedIdealSourceReview/><JoyButton component="label" variant="soft" startDecorator={<UploadCloud size={15}/>}>Choose Ideal files<input hidden type="file" multiple accept=".xlsx,.xls,.csv,.txt" onChange={e=>{setFiles(Array.from(e.target.files??[]));setResults([]);setReviewApproved(false);}}/></JoyButton>{files.length?<Typography level="body-sm">{files.length} file{files.length===1?"":"s"} ready: {files.map(f=>f.name).join(", ")}</Typography>:null}</Stack>:<Sheet variant="soft" color="neutral" sx={{borderRadius:"xl",p:2.5}}><Typography level="body-sm">We validate the source, match customer identities, normalize purchase events, and show health before Customer Intelligence is activated.</Typography></Sheet>}</JoyCardContent></JoyCard>:null}
  {step===2?<JoyCard variant="outlined"><JoyCardHeader title={commitAttempted?"Import attempt — review recorded outcomes":"Source review — no data changed"} description={commitAttempted?"Check confirmed responses and import history before reviewing these files again.":"Check the report type, accepted and rejected source records, missing dates and whether the export is a grouped summary. Review does not import anything."}/><JoyCardContent>{results.length?<Stack spacing={1.25}>{results.map((r,i)=><Sheet key={i} variant="soft" color={r.rejected?"warning":"success"} sx={{borderRadius:"xl",p:2}}><Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between"><Stack><Typography level="title-sm">{r.report_type?.replaceAll("_"," ")||"Ideal report"}</Typography><Typography level="body-xs" color="neutral">{r.preview?(r.ready_to_import?"Eligible for reviewed import":"Requires source mapping or dated transactions; not importable as purchase facts"):(r.duplicate_file?r.message:`${r.customers_touched??0} customers touched`)}</Typography></Stack><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><JoyChip size="sm">{r.accepted??0} accepted</JoyChip><JoyChip size="sm" color="neutral">{r.duplicates??0} duplicates</JoyChip><JoyChip size="sm" color={r.rejected?"warning":"neutral"}>{r.rejected??0} rejected</JoyChip></Stack></Stack>{r.notices?.map((n,j)=><Typography key={j} level="body-sm">{n}</Typography>)}{r.errors?.slice(0,5).map((n,j)=><Typography key={j} level="body-xs" color="danger">{n}</Typography>)}</Sheet>)}</Stack>:<Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(3,1fr)"},gap:1.25}}>{[["Customer identity","Match customers safely"],["Purchase history","Deduplicate transactions"],["Intelligence health","Verify usable coverage"]].map(([a,b])=><Sheet key={a} variant="soft" color="neutral" sx={{borderRadius:"xl",p:2}}><Typography level="title-sm">{a}</Typography><Typography level="body-xs" color="neutral">{b}</Typography></Sheet>)}</Box>}</JoyCardContent></JoyCard>:null}
  {step===2&&source==="ideal-import"?<Stack spacing={1}><Checkbox checked={reviewApproved} disabled={!canCommit||uploading} onChange={e=>setReviewApproved(e.target.checked)} label="I reviewed these exact source diagnostics and any rejected rows. Import only reports with verified transaction evidence." />{!canCommit&&!commitAttempted&&<Typography color="warning" level="body-sm">Some reports are grouped or lack dated transactions. They cannot be used to calculate visits or the Customer Growth Index. Keep the originals and request distinct transaction exports or a separately reviewed aggregate mapping.</Typography>}</Stack>:null}
  {step===3?<JoyCard variant="outlined"><JoyCardHeader title={source==="ideal-import"?"Import recorded — review the reconciliation":"Customer Intelligence is ready"} description={source==="ideal-import"?"A completed import does not certify that every report contains individual visits or complete historical coverage. Check row counts, duplicates and rejected records before campaigns or CGI.":"BloomSuite can now turn connected purchase history into customer stories, audiences, opportunities, and proactive Bloom insights."}/><JoyCardContent><Stack spacing={2}><Sheet variant="soft" color="primary" sx={{borderRadius:"xl",p:2.5}}><Stack direction="row" spacing={1.5}><Sparkles size={20}/><Stack><Typography level="title-md">{source==="ideal-import"?"Review your Ideal data first":"Bloom starts working immediately"}</Typography><Typography level="body-sm" color="neutral">Ask Bloom to explain behavior, rank audiences, or identify valuable customers who are slowing down.</Typography></Stack></Stack></Sheet><JoyButton onClick={()=>navigate("/crm/intelligence")}>Explore Customer Intelligence</JoyButton></Stack></JoyCardContent></JoyCard>:null}
  {commitOutcomes.length>0?<Sheet variant="outlined" sx={{p:2,borderRadius:"md"}}><Stack spacing={1}><Typography level="title-md">Recorded import responses</Typography>{commitOutcomes.map((outcome,i)=><Stack key={i}><Typography level="title-sm">{outcome.filename}</Typography><Typography level="body-sm">{outcome.result.duplicate_file?"Already imported; no new totals added.":`${outcome.result.accepted??0} accepted · ${outcome.result.duplicates??0} duplicates · ${outcome.result.rejected??0} rejected`}</Typography>{outcome.result.warnings?.map((warning,j)=><Typography key={j} color="warning" level="body-sm">{warning}</Typography>)}{outcome.result.import_id?<Typography level="body-xs">Import reference: {outcome.result.import_id}</Typography>:null}</Stack>)}</Stack></Sheet>:null}
  {commitError?<Sheet color="warning" variant="soft" sx={{p:2,borderRadius:"md"}}><Typography role="alert">{commitError} Processing stopped. Earlier confirmed imports remain recorded. The last request may have changed data even if its response was interrupted. Check import history before starting a new review; do not blindly resend these files.</Typography></Sheet>:null}
  <Stack direction="row" justifyContent="space-between"><JoyButton variant="plain" color="neutral" disabled={step===0||uploading} onClick={()=>setStep(v=>Math.max(0,v-1))}>Back</JoyButton>{step===0?<JoyButton onClick={next}>Continue</JoyButton>:step===1&&source==="ideal-import"?<JoyButton loading={uploading} disabled={!files.length} onClick={()=>void upload()}>Review reports — no import</JoyButton>:step===2&&source==="ideal-import"?<JoyButton loading={uploading} disabled={!canCommit||!reviewApproved} onClick={()=>void commit()}>Confirm reviewed import</JoyButton>:step<3?<JoyButton onClick={next}>Continue</JoyButton>:null}</Stack>
 </Stack>;
}