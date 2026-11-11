import {useState} from 'react';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import Sheet from '@mui/joy/Sheet';
import {JoyButton} from '@/components/joy/JoyButton';
import {supabase} from '@/integrations/supabase/client';
import {requireImportTenant} from '../../../supabase/functions/_shared/customer-intelligence/import-access';
import {reviewPreparedIdealSource,type PreparedSourceReview} from '@/lib/customer-intelligence/prepared-source-review';
/** Large originals are prepared locally; reviewing a bundle never imports its candidate rows. */
export function PreparedIdealSourceReview(){
 const [files,setFiles]=useState<File[]>([]),[review,setReview]=useState<PreparedSourceReview|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const inspect=async()=>{setBusy(true);setError(null);setReview(null);try{const tenantId=await requireImportTenant(supabase);setReview(await reviewPreparedIdealSource(files,tenantId));}catch(e){setError(e instanceof Error?e.message:'Prepared report could not be verified.');}finally{setBusy(false);}};
 return <Sheet variant="outlined" sx={{p:2,borderRadius:'md'}}><Stack spacing={1.5}>
  <Typography level="title-md">Large or grouped Ideal reports</Typography>
  <Typography level="body-sm">For reports above 25 MB or with a custom layout, use the prepared report files supplied by your administrator. Preparation preserves the original and checks every worksheet. This review stays on this device and does not import customer records.</Typography>
  <JoyButton component="label" variant="soft" disabled={busy}>Choose prepared report files<input hidden type="file" multiple accept=".json,.jsonl" onChange={event=>{setFiles(Array.from(event.target.files??[]));setReview(null);setError(null);}}/></JoyButton>
  <JoyButton disabled={!files.length||busy} loading={busy} onClick={()=>void inspect()}>Verify prepared report</JoyButton>
  {error?<Typography color="danger" role="alert">{error}</Typography>:null}
  {review?<Stack spacing={1}>
   <Typography level="title-sm">{review.filename}</Typography>
   <Typography level="body-sm">{review.reportFamily.replaceAll('_',' ')} · {review.sourceRows.toLocaleString()} source rows · {review.normalizedRows.toLocaleString()} candidate records · {review.quarantinedRows.toLocaleString()} quarantined records</Typography>
   <Typography level="body-sm">{review.periodStart?`Report period: ${review.periodStart} to ${review.periodEnd} (${review.periodVerified?"verified from printed source":"not verified from printed source"}).`:"No verified report period recorded."}</Typography>
   {review.sheets.map(sheet=><Typography level="body-sm" key={sheet.name}>{sheet.name}: {sheet.sourceRows.toLocaleString()} source rows, {sheet.normalizedRows.toLocaleString()} candidate records</Typography>)}
   <Typography level="body-xs" sx={{overflowWrap:'anywhere'}}>Original fingerprint: {review.sourceSha256}</Typography>
   <Typography color="warning" level="body-sm">{review.status==='quarantined'?'Source reconciliation failed. These records must remain excluded.':'File integrity verified. Customer matching and report semantics still require review before import.'}</Typography>
   {review.failures.map((failure,i)=><Typography key={i} color="danger" level="body-sm">{failure}</Typography>)}
  </Stack>:null}
 </Stack></Sheet>;
}
