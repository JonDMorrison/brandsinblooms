import {useState} from 'react';
import {Alert,Button,CircularProgress,Sheet,Stack,Typography} from '@mui/joy';
import {useQuery} from '@tanstack/react-query';
import {useAdmin} from '@/contexts/AdminContext';
import {useTenant} from '@/hooks/useTenant';
import {loadImportHistory,importLedgerExplanation} from '@/lib/customer-intelligence/importHistory';
const count=(value:number)=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString():'Unknown';
export function ImportHistoryPanel(){
 const {tenant,loading}=useTenant();
 const {isMasterAdmin,activeTenantId,hasHydratedTenantContext}=useAdmin();
 if(loading||(isMasterAdmin&&(!hasHydratedTenantContext||(activeTenantId??null)!==(tenant?.id??null))))return <CircularProgress aria-label="Loading company for import history"/>;
 if(!tenant?.id)return <Alert color="neutral">Select a company to view import history.</Alert>;
 return <TenantImportHistory key={tenant.id} tenantId={tenant.id}/>;
}
export function TenantImportHistory({tenantId}:{tenantId:string}){
 const [page,setPage]=useState(0);
 const query=useQuery({queryKey:['intelligence-import-history',tenantId,page],queryFn:({signal})=>loadImportHistory(tenantId,page,undefined,signal),enabled:Boolean(tenantId),staleTime:0});
 return <Sheet id="import-history" variant="outlined" sx={{p:3,borderRadius:'lg'}}><Stack spacing={2}>
 <Typography level="h3">Import history</Typography>
 <Typography level="body-sm">Recorded import attempts for this company. Incomplete imports are not completed reporting evidence. Locally prepared files do not appear until an import creates a ledger entry. A missing entry does not prove an interrupted request made no changes.</Typography>
 <Typography level="body-sm">Ledger completion does not confirm data-health or metric refresh. Those follow-up outcomes are not recorded per import here; verify them before processing more files.</Typography>
 <Button variant="outlined" color="neutral" sx={{alignSelf:'flex-start'}} disabled={query.isFetching} onClick={()=>void query.refetch()}>Refresh history</Button>
 {query.isPending?<CircularProgress aria-label="Loading import history"/>:query.isError?<Alert color="warning">Import history could not load. No outcome is confirmed. Refresh history to check again.</Alert>:<>
 {!query.data?.entries.length?<Typography>No imports visible on this page. Visibility depends on your reports permission.</Typography>:query.data.entries.map(entry=><Sheet key={entry.id} variant="soft" sx={{p:2,borderRadius:'md',overflowWrap:'anywhere'}}><Stack spacing={0.75}>
 <Typography level="title-md">{entry.source_filename??'Filename unavailable'}</Typography>
 <Typography level="body-sm">{entry.source} · {entry.report_type} · {entry.status}</Typography>
 <Typography level="body-sm">{importLedgerExplanation(entry.status)}</Typography>
 <Typography level="body-sm">Source period: {entry.source_period_start??'Unknown'} through {entry.source_period_end??'Unknown'}</Typography>
 <Typography level="body-sm">Rows: {count(entry.source_row_count)} source · {count(entry.accepted_row_count)} accepted · {count(entry.duplicate_row_count)} duplicates · {count(entry.rejected_row_count)} rejected</Typography>
 <Typography level="body-xs">Started: {entry.started_at} · Completed: {entry.completed_at??'Not recorded'}</Typography>
 <Typography level="body-xs">Recorded diagnostics: {entry.diagnosticCount??'Unknown'}. Raw diagnostic text is withheld because it may contain customer details. Request operator review using the import ID.</Typography>
 <Typography level="body-xs">Import ID: {entry.id}</Typography>
 <Typography level="body-xs">Source SHA-256: {entry.source_sha256}</Typography>
 </Stack></Sheet>)}
 <Stack direction="row" spacing={1}><Button variant="outlined" disabled={page===0||query.isFetching} onClick={()=>setPage(p=>p-1)}>Newer imports</Button><Typography>Page {page+1}</Typography><Button variant="outlined" disabled={!query.data?.hasMore||query.isFetching} onClick={()=>setPage(p=>p+1)}>Older imports</Button></Stack>
 </>}
 </Stack></Sheet>;
}
