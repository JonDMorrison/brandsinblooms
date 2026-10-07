import {defaultGrowthDates} from '@/lib/customer-intelligence/presentation';
import * as React from 'react';
import {Box,Button,Checkbox,FormControl,FormLabel,Input,Sheet,Stack,Typography} from '@mui/joy';
import {useNavigate} from 'react-router-dom';
import {supabase} from '@/integrations/supabase/client';
import {useTenant} from '@/hooks/useTenant';
import {CustomerAnalysisBlock} from '@/components/bloom/blocks/CustomerAnalysisBlock';
import {compareCustomerGrowth,type GrowthOrder} from '../../../../supabase/functions/_shared/customer-intelligence/customer-growth';
import {localDate} from '../../../../supabase/functions/_shared/customer-intelligence/purchase-exploration';
import {readAllPages} from '../../../../supabase/functions/_shared/customer-intelligence/query-pages';
export function CustomerGrowthWorkspace() {
  const {tenant}=useTenant(),navigate=useNavigate();
  const timezone=typeof tenant?.settings?.timezone==='string'?tenant.settings.timezone:'America/Vancouver';
  const [dates,setDates]=React.useState(()=>defaultGrowthDates()),[currency,setCurrency]=React.useState('CAD');
  const [spend,setSpend]=React.useState(50),[visits,setVisits]=React.useState(50),[perDay,setPerDay]=React.useState(false);
  const [product,setProduct]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const [report,setReport]=React.useState<ReturnType<typeof compareCustomerGrowth>|null>(null),[page,setPage]=React.useState(1);
  const request=React.useRef(0);
  React.useEffect(()=>{request.current++;setReport(null);setError('');setBusy(false);},[tenant?.id]);
  const compare=async()=>{
    if(!tenant?.id)return;const id=++request.current,tenantId=tenant.id,cutoff=new Date().toISOString();setBusy(true);setError('');setReport(null);
    try {
      const [customers,orders]=await Promise.all([
        readAllPages<{id:string}>((a,b)=>supabase.from('crm_customers').select('id').eq('tenant_id',tenantId).is('deleted_at',null).is('merged_into_customer_id',null).lte('created_at',cutoff).order('id').range(a,b)),
        readAllPages<GrowthOrder>((a,b)=>supabase.from('pos_orders').select('id,tenant_id,crm_customer_id,order_date,created_at,total_amount,refund_amount,currency,status').eq('tenant_id',tenantId).lte('created_at',cutoff).order('id').range(a,b)),
      ]);
      const result=compareCustomerGrowth(orders,customers.map(c=>c.id),tenantId,{...dates,currency,timezone,data_cutoff:cutoff,spend_weight:spend,visits_weight:visits,per_day_rates:perDay});
      if(id===request.current){setReport(result);setPage(1);}
    }catch(e){if(id===request.current)setError(e instanceof Error?e.message:'Unable to compare purchase history.');}
    finally{if(id===request.current)setBusy(false);}
  };
  const ask=(prompt:string)=>navigate('/bloom?prompt='+encodeURIComponent(prompt));
  return <Stack spacing={2}>
    <Sheet variant="outlined" sx={{borderRadius:'xl',p:{xs:2,md:3}}}><Stack spacing={2}>
      <Typography level="h3">Explore the records, not just the dashboard</Typography>
      <Typography level="body-md">Ask who bought a product, then keep narrowing the same group. Bloom shows the rules, excluded customers and missing data.</Typography>
      <Stack direction={{xs:'column',sm:'row'}} gap={1}><Input aria-label="Product to explore" placeholder="Hydrangea, fertilizer, moisture meter…" value={product} onChange={e=>setProduct(e.target.value)}/><Button disabled={!product.trim()} onClick={()=>ask(`Find all customers with recorded purchases of ${JSON.stringify(product.trim())}. Show included, excluded and unknown counts and the exact matching rule. Save the group for follow-up questions.`)}>Explore with Bloom</Button></Stack>
    </Stack></Sheet>
    <Sheet variant="outlined" sx={{borderRadius:'xl',p:{xs:2,md:3}}}><Stack spacing={2}>
      <Typography level="h3">Customer Growth Index</Typography>
      <Typography level="body-md">Compare each customer with their own history. Index 100 means unchanged. A missing baseline stays unscored.</Typography>
      <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'repeat(2,1fr)',lg:'repeat(4,1fr)'},gap:2}}>{Object.entries(dates).map(([key,value])=><FormControl key={key}><FormLabel>{key.replace('_',' ')}</FormLabel><Input type="date" value={value} onChange={e=>setDates(d=>({...d,[key]:e.target.value}))}/></FormControl>)}</Box>
      <Stack direction={{xs:'column',sm:'row'}} gap={2}>
        <FormControl><FormLabel>Spending weight</FormLabel><Input type="number" slotProps={{input:{min:0,max:100}}} value={spend} onChange={e=>setSpend(Number(e.target.value))}/></FormControl>
        <FormControl><FormLabel>Visit weight</FormLabel><Input type="number" slotProps={{input:{min:0,max:100}}} value={visits} onChange={e=>setVisits(Number(e.target.value))}/></FormControl>
        <FormControl><FormLabel>Currency</FormLabel><Input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} slotProps={{input:{maxLength:3}}}/></FormControl>
      </Stack>
      <Checkbox label="Compare daily rates when the periods have different lengths" checked={perDay} onChange={e=>setPerDay(e.target.checked)}/>
      <Typography level="body-sm">Based on completed POS orders after recorded refunds. Imported summary totals do not establish visit counts. Check history coverage before treating results as program impact.</Typography>
      {error?<Typography role="alert" color="danger">{error}</Typography>:null}
      <Button loading={busy} disabled={!tenant?.id} onClick={()=>void compare()}>Compare customer growth</Button>
    </Stack></Sheet>
    {report?<><CustomerAnalysisBlock data={{...report,rows:report.rows.slice((page-1)*50,page*50),page,total_count:report.rows.length}}/>
      <Stack direction="row" spacing={1}><Button disabled={page<=1} variant="outlined" onClick={()=>setPage(p=>p-1)}>Previous</Button><Button disabled={page*50>=report.rows.length} variant="outlined" onClick={()=>setPage(p=>p+1)}>Next</Button></Stack></>:null}
  </Stack>;
}
