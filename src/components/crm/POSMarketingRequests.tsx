import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui-legacy/card';
import {Button} from '@/components/ui-legacy/button';
interface PreferenceRequest{id:string;customerId:string;recipient:string;statement:string;policyVersion:number;observedAt:string;state:'PENDING'|'APPROVED'|'REJECTED';evidenceRef:string}
export function POSMarketingRequests(){
 const [rows,setRows]=useState<PreferenceRequest[]>([]),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){const result=await supabase.rpc('bloomsuite_pos_marketing_workspace' as never);if(result.error)throw Error('POS preference review requires a current owner or marketing staff session.');setRows((result.data??[]) as unknown as PreferenceRequest[]);}
 useEffect(()=>{let active=true;void supabase.rpc('bloomsuite_pos_marketing_workspace' as never).then(result=>{if(!active)return;if(result.error)setError('POS preference review requires a current owner or marketing staff session.');else setRows((result.data??[]) as unknown as PreferenceRequest[]);});return()=>{active=false;};},[]);
 const request=rows.find(r=>r.id===selected);
 async function review(approve:boolean){if(!request||reason.trim().length<20||(approve&&!reviewed))return;setBusy(true);setError('');try{
  const result=await supabase.rpc('review_bloomsuite_pos_marketing' as never,{p_event:request.id,p_approve:approve,p_reason:reason.trim(),p_withdrawals_reviewed:reviewed} as never);if(result.error)throw result.error;
  await load();setSelected('');setReason('');setReviewed(false);
 }catch(e){setError(e instanceof Error?e.message:'Preference could not be reviewed. Refresh and retry the same request.');}finally{setBusy(false);}}
 return <Card><CardHeader><CardTitle>POS store email preferences</CardTitle></CardHeader><CardContent className="space-y-4">
  <p className="text-sm text-muted-foreground">Review the customer's separately captured statement and existing withdrawals. Receiving a POS request never adds a contact to a campaign.</p>
  {error&&<p role="alert" className="text-sm">{error}</p>}<Button variant="outline" disabled={busy} onClick={()=>{setBusy(true);setError('');void load().catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Refresh POS requests</Button>
  {!rows.length&&!error&&<p className="text-sm">No recent requests from connected POS stores.</p>}
  {rows.map(r=><div key={r.id} className="rounded-lg border p-3"><p>{r.recipient} · {r.state==='PENDING'?'Awaiting review':r.state==='APPROVED'?'Approved':'Rejected'}</p><p className="text-xs text-muted-foreground">{new Date(r.observedAt).toLocaleString()} · Policy {r.policyVersion}</p>{r.state==='PENDING'&&<Button variant="outline" disabled={busy} onClick={()=>{setSelected(r.id);setReviewed(false);setReason('');}}>Review preference</Button>}</div>)}
  {request?.state==='PENDING'&&<section className="space-y-3 rounded-lg border p-4" aria-label="Review POS preference"><h3 className="font-semibold">{request.recipient}</h3><blockquote className="rounded-lg bg-muted p-3 text-sm">{request.statement}</blockquote>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>I reviewed this statement, the linked customer and any withdrawals, and confirmed that this request provides express permission.</label>
   <label className="block text-sm" htmlFor="pos-preference-reason">Review notes</label><textarea id="pos-preference-reason" rows={3} className="w-full rounded-lg border p-2" value={reason} maxLength={2000} disabled={busy} onChange={e=>setReason(e.target.value)} placeholder="Record what you verified, or why this request should be rejected."/>
   <div className="flex flex-wrap gap-2"><Button disabled={busy||!reviewed||reason.trim().length<20} onClick={()=>void review(true)}>Approve documented permission</Button><Button variant="outline" disabled={busy||reason.trim().length<20} onClick={()=>void review(false)}>Reject request</Button></div>
  </section>}
 </CardContent></Card>;
}
