import {customerAnalysisPayload} from '@/lib/customer-intelligence/presentation';
import * as React from 'react';
import {Box,Button,Chip,Sheet,Stack,Table,Typography} from '@mui/joy';
import {Link as RouterLink} from 'react-router-dom';

type Row=Record<string,unknown>;
const isRow=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
const rows=(v:unknown):Row[]=>Array.isArray(v)?v.filter(isRow):[];
const text=(v:unknown)=>v===null||v===undefined?'Unknown':typeof v==='number'?v.toLocaleString('en-CA',{maximumFractionDigits:2}):typeof v==='object'?JSON.stringify(v):String(v);
const label=(value:string)=>value.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
function Details({title,value}:{title:string;value:unknown}) {
  return <Box component="details" sx={{border:'1px solid',borderColor:'neutral.outlinedBorder',borderRadius:'lg',p:1.5}}>
    <Typography component="summary" level="title-sm" sx={{cursor:'pointer'}}>{title}</Typography>
    <Typography component="pre" level="body-sm" sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:320,overflow:'auto',mt:1}}>{JSON.stringify(value,null,2)}</Typography>
  </Box>;
}
export function CustomerAnalysisBlock({data,onAction}:{data:Row;onAction?:(prompt:string)=>void}) {
  const entries=rows(data.rows),trail=rows(data.trail),kind=String(data.kind),setId=typeof data.set_id==='string'?data.set_id:null;
  const titles:Record<string,string>={customer_exploration:'Your customer search',customer_growth:'Customer growth',customer_evidence:'Why this customer?',customer_basket:'What else this group bought',customer_ranking:'Customer ranking',customer_opportunities:'Customer opportunities'};
  const preferred=kind==='customer_growth'?['name','baseline_spend','current_spend','baseline_visits','current_visits','growth_index','growth_change_percent','state']:
    kind==='customer_ranking'?['name','score','missing_factors']:kind==='customer_basket'?['product','customers','percent']:
    kind==='customer_evidence'?['product_name','quantity','net_amount','currency','purchased_at','source']:
    kind==='customer_opportunities'?['first_name','last_name','lifetime_value','purchase_velocity']:['name','reason','evidence_count'];
  const columns=preferred.filter(key=>entries.some(row=>key in row));
  const total=data.total_count??data.scanned_customers??entries.length;
  return <Sheet variant="outlined" sx={{p:{xs:2,sm:3},borderRadius:'xl'}}><Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between" useFlexGap flexWrap="wrap" gap={1}><Typography level="title-lg">{titles[kind]??'Customer analysis'}</Typography><Chip size="sm" variant="soft">Recorded data</Chip></Stack>
    {data.captured_at?<Typography level="body-xs">Source read: {text(data.captured_at)} · {text(data.timezone)}</Typography>:null}
    {kind==='customer_exploration'?<Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>{(['included','excluded','unknown'] as const).map(bucket=><Button key={bucket} size="sm" variant={data.bucket===bucket?'soft':'outlined'} disabled={!onAction} onClick={()=>onAction?.(`Inspect ${bucket} customers from saved result ${setId}. Show page 1 and the reasons.`)}>{label(bucket)}: {text(data[`${bucket}_count`])}</Button>)}</Stack>:null}
    {trail.length?<Stack spacing={1}><Typography level="title-sm">How this group was selected</Typography>{trail.map((step,i)=><Sheet key={String(step.set_id??i)} variant="soft" sx={{p:1.5,borderRadius:'md'}}><Typography level="title-sm">{i+1}. {text(step.label)}</Typography><Typography level="body-sm">{text(step.input)} starting · {text(step.included)} included · {text(step.excluded)} excluded · {text(step.unknown)} unknown</Typography><Details title="Exact rule" value={step.rule}/></Sheet>)}</Stack>:null}
    {isRow(data.summary)?<Details title="All-customer totals and denominators" value={data.summary}/>:null}
    {data.formula?<Typography level="body-sm">{text(data.formula)}</Typography>:null}
    {data.method?<Typography level="body-sm">{text(data.method)}</Typography>:null}
    {data.reason?<Typography level="body-sm">{text(data.reason)}</Typography>:null}
    <Typography level="body-sm">Showing {entries.length} of {text(total)}{data.page?` · page ${text(data.page)}`:''}{data.omitted_by_limit?` · ${text(data.omitted_by_limit)} outside the selected limit`:''}.</Typography>
    {entries.length?<Box sx={{overflowX:'auto'}}><Table size="sm" sx={{minWidth:Math.max(450,columns.length*130),tableLayout:'auto'}}><thead><tr>{columns.map(key=><th key={key}>{label(key)}</th>)}<th>Details</th></tr></thead><tbody>{entries.map((row,i)=><tr key={String(row.customer_id??row.id??i)}>{columns.map(key=><td key={key}>{text(row[key])}</td>)}<td><Details title="Source values" value={row}/>{typeof row.customer_id==='string'?<Button component={RouterLink} to={`/crm/customers/${row.customer_id}`} size="sm" variant="plain">Customer</Button>:null}{setId&&typeof row.customer_id==='string'&&onAction?<Button size="sm" variant="plain" onClick={()=>onAction(`Explain customer ${row.customer_id} in saved result ${setId}. Show the source evidence.`)}>Why?</Button>:null}</td></tr>)}</tbody></Table></Box>:<Typography level="body-md">No customers matched this view. Check excluded and unknown records before changing the rules.</Typography>}
    {data.settings?<Details title="Periods, currency and weights" value={data.settings}/>:null}
    {data.weights?<Details title="Selected ranking weights" value={data.weights}/>:null}
    {data.criteria?<Details title="Search definition" value={data.criteria}/>:null}
    {data.source?<Typography level="body-xs">{text(data.source)}</Typography>:null}
    {[...((Array.isArray(data.notes)?data.notes:[])),...((Array.isArray(data.limitations)?data.limitations:[])),data.note,data.no_hidden_filters].filter(Boolean).map((note,i)=><Typography key={i} level="body-sm" color="neutral">{text(note)}</Typography>)}
    {onAction?<Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
      {kind==='customer_exploration'&&setId?<><Button size="sm" variant="soft" onClick={()=>onAction(`What else did the customers in saved result ${setId} buy?`)}>Explore this group</Button>{Number(data.included_count)>0?<Button size="sm" onClick={()=>onAction(`Help me save the included people in result ${setId} as a static segment. Ask me for the name and show the exact count before confirmation. Do not send any messages.`)}>Save as segment</Button>:null}</>:null}
      {data.has_more?<Button size="sm" variant="outlined" onClick={()=>onAction(`Show page ${Number(data.page??1)+1} of this ${kind.replace('customer_','')} result${setId?` using saved result ${setId}`:''}${data.bucket?`, ${data.bucket} bucket`:''}. Keep the same criteria and periods.`)}>Next page</Button>:null}
    </Stack>:null}
  </Stack></Sheet>;
}
