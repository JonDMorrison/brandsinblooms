import { Alert, Box, Button, Sheet, Stack, Typography } from '@mui/joy';
import { Database, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { bloomIntelligenceUrl } from '@/lib/customer-intelligence/intelligenceExperience';

type Report = {id: string; report_type: string; source_filename: string | null; source_period_start: string | null; source_period_end: string | null; reconciliation: unknown; status: string};
interface ReportQuery extends PromiseLike<{data: Report[] | null; error: {message: string} | null}> {
  select(columns: string): ReportQuery;
  eq(column: string, value: string): ReportQuery;
  in(column: string, values: string[]): ReportQuery;
  order(column: string, options: {ascending: boolean}): ReportQuery;
  limit(count: number): ReportQuery;
}
// The deployed report schema is newer than the repository's generated Database type.
const reportClient = supabase as unknown as {from(table: 'customer_intelligence_imports'): ReportQuery};
type Summary = {customers?: number; product_rows?: number; amount?: number; transactions?: number; warnings?: string[]};
const money = (value: number) => new Intl.NumberFormat('en-CA', {style:'currency',currency:'CAD'}).format(value);

/** Reported period totals stay separate from lifetime value and dated transaction metrics. */
export function ImportedReportsPanel({tenantId}: {tenantId: string}) {
  const navigate = useNavigate();
  const query = useQuery({queryKey:['intelligence-imported-reports',tenantId],enabled:Boolean(tenantId),staleTime:60000,
    queryFn: async () => {
      const {data,error} = await reportClient.from('customer_intelligence_imports')
        .select('id,report_type,source_filename,source_period_start,source_period_end,reconciliation,status')
        .eq('tenant_id',tenantId).in('status',['completed','completed_with_errors']).order('created_at',{ascending:false}).limit(20);
      if(error) throw error;
      return data as Report[];
    }});
  if(query.isPending) return null;
  if(query.isError) return <Alert color="neutral">Imported reports could not load. <Button variant="plain" color="neutral" onClick={()=>void query.refetch()}>Retry reports</Button></Alert>;
  const reports = (query.data ?? []).filter(r=>['customer_master','customer_sales_summary','customer_spending'].includes(r.report_type));
  if(!reports.length) return null;
  const latest = (type: string) => reports.find(r=>r.report_type===type);
  const master=latest('customer_master'), sales=latest('customer_sales_summary'), spending=latest('customer_spending');
  const stats = [
    {label:'Imported customer profiles',value:(master?.reconciliation as Summary)?.customers?.toLocaleString()},
    {label:'Reported product sales',value:typeof (sales?.reconciliation as Summary)?.amount==='number'?money((sales!.reconciliation as Summary).amount!):undefined},
    {label:'Reported customer spend',value:typeof (spending?.reconciliation as Summary)?.amount==='number'?money((spending!.reconciliation as Summary).amount!):undefined},
    {label:'Reported transactions',value:(spending?.reconciliation as Summary)?.transactions?.toLocaleString()},
  ];
  const warnings = [...new Set(reports.flatMap(r=>(r.reconciliation as Summary)?.warnings ?? []))];
  const ask = (question: string) => navigate(bloomIntelligenceUrl(question,'explore'));
  return <Sheet variant="outlined" sx={{p:{xs:2,md:3},borderRadius:'lg'}}>
    <Stack spacing={2}>
      <Stack direction="row" gap={1} alignItems="center"><Database size={21}/><Typography level="title-lg">Your imported purchase reports</Typography></Stack>
      <Typography level="body-sm">{sales?.source_period_start ?? spending?.source_period_start} through {sales?.source_period_end ?? spending?.source_period_end}. These are reported period totals, not lifetime spending or a reconstructed receipt history.</Typography>
      <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr 1fr',lg:'repeat(4,1fr)'},gap:2}}>
        {stats.map(s=><Stack key={s.label} spacing={0.5}><Typography level="body-sm">{s.label}</Typography><Typography level="h3" sx={{fontSize:{xs:'1.25rem',md:'1.55rem'}}}>{s.value ?? 'Not available'}</Typography></Stack>)}
      </Box>
      <Typography level="body-sm">Find buyers by product or department, then narrow the same audience with a follow-up question. A summary supports its complete report period; a shorter date window stays unknown until dated receipts are reconciled.</Typography>
      <Stack direction={{xs:'column',sm:'row'}} gap={1} flexWrap="wrap">
        <Button color="neutral" variant="outlined" endDecorator={<ArrowUpRight size={15}/>} onClick={()=>ask('Using the available imported product reports, show the most purchased products by distinct customer count, state the report period, and help me choose an audience. Do not infer individual transaction dates or lifetime spending.')}>Explore what customers bought</Button>
        <Button color="neutral" variant="outlined" onClick={()=>ask('Use explore_customer_reported_spending to show customers with at least $1,000 in the latest reported period, state the period and source, then let me narrow that same group by products. Do not call this lifetime value or change anyone’s classification.')}>Explore higher spending customers</Button>
        <Button color="neutral" variant="outlined" onClick={()=>ask('Use explore_customer_reported_spending to find customers with at least two reported transactions in the latest source period. Show exact included, excluded and unknown counts and help me explore what those same customers bought.')}>Explore repeat purchasers</Button>
        <Button color="neutral" variant="outlined" onClick={()=>navigate('/crm/customers')}>Find a customer profile</Button>
      </Stack>
      {warnings.map(w=><Typography key={w} level="body-sm" color="neutral">{w}</Typography>)}
      <Typography level="body-xs" color="neutral">Sources: {[sales?.source_filename,spending?.source_filename].filter(Boolean).join(' · ')}. Audience membership does not establish permission to email or text.</Typography>
    </Stack>
  </Sheet>;
}
