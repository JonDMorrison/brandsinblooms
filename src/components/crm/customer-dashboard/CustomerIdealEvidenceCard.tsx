import {useState} from 'react';
import {Stack,Typography,Skeleton} from '@mui/joy';
import {JoyCard,JoyCardContent,JoyCardHeader} from '@/components/joy/JoyCard';
import {JoyButton} from '@/components/joy/JoyButton';
import {JoySelect} from '@/components/joy/JoySelect';
import {useCustomerIdealSources,useCustomerIdealProjection} from '@/hooks/useCustomerIdealEvidence';
import {useTenant} from '@/hooks/useTenant';
import {useAdmin} from '@/contexts/AdminContext';

function formatCents(cents:number,currency:string){
 const value=BigInt(cents),absolute=value<0n?-value:value;
 const symbol=new Intl.NumberFormat('en-CA',{style:'currency',currency}).formatToParts(0).find(part=>part.type==='currency')?.value??currency;
 return `${value<0n?'-':''}${symbol}${(absolute/100n).toLocaleString('en-CA')}.${String(absolute%100n).padStart(2,'0')}`;
}

/** Remount selection on tenant/customer change; queries never reuse another customer's result. */
export function CustomerIdealEvidenceCard(props:{tenantId:string;customerId:string}){
 const {tenant,loading}=useTenant();
 const {isMasterAdmin,activeTenantId,hasHydratedTenantContext,isLoading}=useAdmin();
 if(loading||isLoading||(isMasterAdmin&&(!hasHydratedTenantContext||(activeTenantId??null)!==(tenant?.id??null))))
  return <Typography>Loading company for source evidence…</Typography>;
 if(!tenant?.id||tenant.id!==props.tenantId)return <Typography>Select a customer in the current company to inspect source evidence.</Typography>;
 return <EvidenceCard key={`${props.tenantId}:${props.customerId}`} {...props}/>;
}
function EvidenceCard({tenantId,customerId}:{tenantId:string;customerId:string}){
 const [selected,setSelected]=useState<string|null>(null);
 const sources=useCustomerIdealSources(tenantId);
 const source=sources.isError?undefined:sources.data?.find(row=>row.id===selected);
 const query=useCustomerIdealProjection(tenantId,customerId,source);
 const result=query.data?.tenant_id===tenantId&&query.data?.customer_id===customerId&&query.data?.source_import_id===source?.id?query.data:undefined;
 const money=(cents:number)=>formatCents(cents,result?.currency??'CAD');
 return <JoyCard><JoyCardHeader title="IdealPOS source-period evidence" description="Inspect one original report period for this customer. Separate reports are never added together."/><JoyCardContent><Stack spacing={1.5}>
  {sources.isLoading?<Skeleton height={60}/>:sources.isError?<><Typography color="danger">Report sources are unavailable or not permitted.</Typography><JoyButton variant="plain" onClick={()=>void sources.refetch()}>Retry sources</JoyButton></>:!sources.data?.length?<Typography>No accessible completed sales summaries are available.</Typography>:<>
   <Typography level="body-sm">Reports belong to your company; a selected report may have no evidence for this customer. Missing evidence stays unknown.</Typography>
   <JoySelect label="Original report period" value={selected} placeholder="Choose a report" options={sources.data.map(row=>({value:row.id,label:`${row.source_period_start} to ${row.source_period_end} · ${row.source_filename??row.id}`}))} onValueChange={value=>setSelected(value?String(value):null)}/>
  </>}
  {source&&<>
   <Typography level="body-sm">Selected period: {source.source_period_start} through {source.source_period_end}. Dashboard date filters do not shorten this source period.</Typography>
   {query.isLoading?<Skeleton height={80}/>:query.isError?<><Typography color="danger">This source could not be reconciled or read completely. No totals are shown.</Typography><JoyButton variant="plain" onClick={()=>void query.refetch()}>Retry evidence</JoyButton></>:result?<>
    {!result.records?<Typography>No accessible evidence for this customer in this report. Spending and quantities are unknown.</Typography>:<>
     <Typography level="title-md">Observed report amount: {result.observed_net_cents===null?'Unknown':money(result.observed_net_cents)}</Typography>
     <Typography>Observed quantity: {result.observed_quantity??'Unknown'}</Typography>
     <Typography level="body-sm">{result.records.toLocaleString()} product records · {result.duplicate_records.toLocaleString()} duplicate records excluded.</Typography>
     {Object.entries(result.department_net_cents).map(([name,cents])=><Typography key={`department:${name}`} level="body-sm">Department {name}: {money(cents)}</Typography>)}
     {Object.entries(result.category_net_cents).map(([name,cents])=><Typography key={`category:${name}`} level="body-sm">Category {name}: {money(cents)}</Typography>)}
    </>}
    <Typography level="body-sm">Lifetime value, visits, frequency and receipt average remain unknown from this summary.</Typography>
    <Typography level="body-xs">Evidence checked: {result.cutoff}. Amounts describe observed report records; complete customer history is not established.</Typography>
   </>:null}
   <Typography level="body-xs" sx={{overflowWrap:'anywhere'}}>Source import: {source.id} · SHA-256: {source.source_sha256}</Typography>
  </>}
 </Stack></JoyCardContent></JoyCard>;
}
