import * as React from 'react';
import {Alert,Box,Button,Checkbox,FormControl,FormLabel,Input,Sheet,Stack,Table,Typography} from '@mui/joy';
import {Link as RouterLink} from 'react-router-dom';
import {supabase} from '@/integrations/supabase/client';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
import {loadObservedJournalPeriod,compareObservedJournalPeriods,journalCoverage,observedDeclineReview,type ObservedJournalPeriod} from '../../../../supabase/functions/_shared/customer-intelligence/observed-ideal-journal';
import {validateGrowthSettings,type GrowthSettings} from '../../../../supabase/functions/_shared/customer-intelligence/customer-growth';
import {useAdmin} from '@/contexts/AdminContext';
import {programmeCommand} from '@/lib/loyalty/programmeApi';

export function ObservedIdealJournalPanel({tenantId,settings}: {tenantId:string;settings:Omit<GrowthSettings,'data_cutoff'>}){
 const admin=useAdmin();
 const [result,setResult]=React.useState<{before:ObservedJournalPeriod;after:ObservedJournalPeriod;comparison:ReturnType<typeof compareObservedJournalPeriods>}|null>(null);
 const [error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[page,setPage]=React.useState(1);
 const [segmentName,setSegmentName]=React.useState('Recovery · '+settings.baseline_start+' to '+settings.current_start);
 const [confirmed,setConfirmed]=React.useState(false),[saving,setSaving]=React.useState(false);
 const [saved,setSaved]=React.useState<{segmentId:string;name:string;customers:number}|null>(null);
 const version=React.useRef(0);
 React.useEffect(()=>()=>{version.current++;},[]);
 if(admin.isLoading||(admin.isMasterAdmin&&(!admin.hasHydratedTenantContext||admin.activeTenantId!==tenantId)))return null;
 async function compare(){
  const run=++version.current,cutoff=new Date().toISOString(),args={...settings,data_cutoff:cutoff};
  setBusy(true);setError('');setResult(null);setPage(1);setSaved(null);setConfirmed(false);
  try {
   validateGrowthSettings(args);
   const client=supabase as unknown as PersistenceClient;
   const before=await loadObservedJournalPeriod(client,tenantId,{start:args.baseline_start,end:args.baseline_end},args.currency,args.timezone,cutoff);
   if(version.current!==run)return;
   const after=await loadObservedJournalPeriod(client,tenantId,{start:args.current_start,end:args.current_end},args.currency,args.timezone,cutoff);
   const comparison=compareObservedJournalPeriods(before,after,args);
   if(version.current===run)setResult({before,after,comparison});
  }catch(e){if(version.current===run)setError(e instanceof Error?e.message:'Journal evidence could not be read.');}
  finally{if(version.current===run)setBusy(false);}
 }
 async function saveRecovery(){
  if(!result||!confirmed||saving||busy||!segmentName.trim())return;
  const run=version.current;
  setSaving(true);setError('');
  try{
   const {before,after}=result;
   const review=await observedDeclineReview(before,after,{...settings,data_cutoff:before.cutoff});
   if(version.current!==run)return;
   const data=await programmeCommand<{saved:{segmentId:string;name:string;customers:number}}>(tenantId,{action:'save_journal_decline_segment',settings,reviewDigest:review.digest,expectedCount:review.memberIds.length,name:segmentName.trim(),confirmed:true});
   if(version.current===run){
    if(!data.saved?.segmentId||data.saved.customers!==review.memberIds.length)throw Error('The exact saved audience could not be verified.');
    setSaved(data.saved);setConfirmed(false);
   }
  }catch(e){if(version.current===run)setError(e instanceof Error?e.message:'The recovery audience could not be saved.');}
  finally{if(version.current===run)setSaving(false);}
 }
 const money=(v:number|null)=>v===null?'Unknown':new Intl.NumberFormat('en-CA',{style:'currency',currency:settings.currency}).format(v/100);
 const number=(v:number|null)=>v===null?'Unknown':v.toLocaleString('en-CA');
 return <Sheet variant="outlined" sx={{p:{xs:2,md:3},borderRadius:'lg'}}>
  <Stack spacing={1.5}>
   <Typography level="title-lg">Imported IdealPOS journal activity</Typography>
   <Typography level="body-sm">Compare recorded net spending and positive purchase days using the dates and weights above. Multiple paid receipts on the same local calendar day count as one observed purchase day. This is a separate evidence source from native POS orders. Receipt imports are not certified complete store-visit history.</Typography>
   <Typography level="body-xs">{settings.baseline_start} – {settings.baseline_end} versus {settings.current_start} – {settings.current_end}. Use month or season windows (up to 94 days).</Typography>
   <Button variant="outlined" loading={busy} disabled={busy||saving} onClick={()=>void compare()}>Compare imported journal activity</Button>
   {error&&<Alert color="neutral" role="alert">{error}</Alert>}
   {result&&<>
    <Alert color="neutral" variant="soft">Observed journal evidence only. Zero-net and negative-net receipts never count as paid activity. Refunds reduce recorded net spending. Missing receipts remain unknown; this is not a certified retention, reactivation or campaign-lift report.</Alert>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr 1fr',md:'repeat(4,minmax(0,1fr))'},gap:1}}>
     {([['Earlier observed buyers',result.comparison.baselineObservedBuyers],['Current observed buyers',result.comparison.currentObservedBuyers],['Comparable observed customers',result.comparison.comparable],['Observed decline',result.comparison.declining]] as const).map(([label,value])=><Sheet key={label} variant="soft" sx={{p:1.5,borderRadius:'lg'}}><Typography level="body-xs">{label}</Typography><Typography level="h3">{number(value)}</Typography></Sheet>)}
    </Box>
    <Typography level="body-sm">{number(result.comparison.unscored)} observed customers lack a comparable positive baseline or current paid activity. They are not labelled lost or inactive.</Typography>
    {[result.before,result.after].map(p=>{const coverage=journalCoverage(p.source);return <Box key={p.window.start}><Typography level="title-sm">{p.window.start} through {p.window.end}</Typography><Typography level="body-xs">{p.source.source_filename??'Journal source'} · {number(p.positiveReceipts)} positive receipts · {number(p.zeroReceipts)} zero · {number(p.negativeReceipts)} negative · {number(p.excludedReceipts)} excluded for identity or receipt conflicts.</Typography>{coverage.mode==='reconciled_customer_cohort'&&<Alert color="neutral" variant="soft">Partial source: {number(coverage.includedCustomers)} independently reconciled customers and {number(coverage.includedReceipts)} of {number(coverage.sourceReceipts)} receipts across the full imported period. {number(coverage.excludedReceipts)} receipts remain outside this source. The comparison is observed activity only, not a company-wide retention rate.</Alert>}</Box>})}
    {result.comparison.declining>0&&<Sheet variant="soft" sx={{p:2,borderRadius:'lg'}}>
     <Stack spacing={1.5}>
      <Typography level="title-md">Create a recovery audience</Typography>
      <Typography level="body-sm">Review the {number(result.comparison.declining)} customers with observed decline (shown first in the table). Both periods contain observed positive activity for these customers. Unknown or missing activity is excluded. Saving does not grant consent or send a campaign.</Typography>
      <FormControl><FormLabel>Segment name</FormLabel><Input value={segmentName} disabled={saving||busy} onChange={e=>{setSegmentName(e.target.value);setConfirmed(false);setSaved(null);}} slotProps={{input:{maxLength:120}}}/></FormControl>
      <Checkbox checked={confirmed} disabled={saving||busy} onChange={e=>setConfirmed(e.target.checked)} label="Save this exact observed decline group as a static segment. I understand the source coverage is incomplete."/>
      <Button disabled={!confirmed||saving||busy||!segmentName.trim()} loading={saving} onClick={()=>void saveRecovery()}>Save {number(result.comparison.declining)} customers</Button>
      {saved&&<Alert color="success" variant="soft"><Stack gap={0.5}><Typography level="body-sm">Saved {saved.customers} verified members in {saved.name}.</Typography><Button size="sm" variant="plain" component={RouterLink} to={'/crm/segments/'+encodeURIComponent(saved.segmentId)}>Open saved segment</Button></Stack></Alert>}
      <Button size="sm" variant="plain" component={RouterLink} to={saved?'/crm/intelligence?view=data&segment='+encodeURIComponent(saved.segmentId):'/crm/intelligence?view=data'}>IdealPOS export tools</Button>
     </Stack>
    </Sheet>}
    <Box sx={{overflowX:'auto'}}><Table size="sm" aria-label="Observed journal customer comparison" sx={{minWidth:650}}><thead><tr><th>Customer</th><th>Prior spend</th><th>Current spend</th><th>Paid purchase days prior → current</th><th>Observed change</th></tr></thead><tbody>{result.comparison.rows.slice((page-1)*50,page*50).map(r=><tr key={r.id}><td><Button variant="plain" size="sm" component={RouterLink} to={'/crm/customers/'+encodeURIComponent(r.id)}>{r.name}</Button></td><td>{money(r.baselineSpend)}</td><td>{money(r.currentSpend)}</td><td>{number(r.baselinePurchaseDays)} → {number(r.currentPurchaseDays)}</td><td>{r.observedGrowth===null?'Unknown':r.observedGrowth.toFixed(1)+'%'}</td></tr>)}</tbody></Table></Box>
    <Stack direction="row" gap={1} alignItems="center"><Button variant="plain" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</Button><Typography level="body-xs">Page {page} of {Math.max(1,Math.ceil(result.comparison.rows.length/50))}</Typography><Button variant="plain" disabled={page*50>=result.comparison.rows.length} onClick={()=>setPage(p=>p+1)}>Next</Button></Stack>
   </>}
  </Stack>
 </Sheet>;
}
