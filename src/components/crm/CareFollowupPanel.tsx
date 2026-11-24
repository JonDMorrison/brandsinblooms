import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '@/integrations/supabase/client';
import type {SupabaseClient} from '@supabase/supabase-js';
const db=supabase as unknown as SupabaseClient;
type Plant={connection_id:string;variant_id:string;product_name:string;last_purchase:string};
type Review={count:number;asOf:string;digest:string};
export function CareFollowupPanel({tenantId}:{tenantId:string}){
 const [products,setProducts]=useState<Plant[]>([]),[choice,setChoice]=useState(''),[days,setDays]=useState(30);
 const [review,setReview]=useState<Review|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[draft,setDraft]=useState(''),[requestId,setRequestId]=useState('');
 useEffect(()=>{let active=true;setProducts([]);setChoice('');setReview(null);setConfirmed(false);setDraft('');setError('');
 void db.rpc('list_care_followup_products',{p_tenant:tenantId}).then(({data,error})=>{if(!active)return;if(error){setError('Connected purchase history is unavailable.');return;}setProducts(Array.isArray(data)?data:[]);});
 return()=>{active=false;};},[tenantId]);
 const plant=products.find(p=>p.connection_id+':'+p.variant_id===choice);
 const reset=()=>{setReview(null);setConfirmed(false);setDraft('');setError('');};
 async function preview(){if(!plant||busy)return;setBusy(true);reset();try{
 const {data,error}=await db.rpc('preview_care_followup',{p_tenant:tenantId,p_connection:plant.connection_id,p_variant:plant.variant_id,p_days:days});
 if(error||!data||!Number.isSafeInteger(data.count))throw Error();setReview(data);setRequestId(crypto.randomUUID());
 }catch{setError('The audience could not be verified. Choose a shorter window or try again.');}finally{setBusy(false);}}
 async function create(){if(!plant||!review?.count||!confirmed||busy||!requestId)return;setBusy(true);setError('');try{
 const {data,error}=await db.rpc('create_care_followup_draft',{p_tenant:tenantId,p_connection:plant.connection_id,p_variant:plant.variant_id,p_days:days,p_as_of:review.asOf,p_digest:review.digest,p_request_id:requestId,p_product_name:plant.product_name,p_confirmed:true});
 if(error||!data?.campaignId)throw Error();setDraft(data.campaignId);
 }catch{setError('The audience may have changed. Refresh the preview and review again.');}finally{setBusy(false);}}
 return <section className="mt-6 rounded-2xl border border-[#dbe3df] bg-white p-6 shadow-sm" aria-label="Plant care follow-up campaigns">
 <h2 className="font-[Georgia] text-2xl">Keep growing together.</h2><p className="mt-2 text-sm text-[#536475]">Create a marketing follow-up for customers who bought a specific plant and explicitly opted in. This uses linked BloomSuite POS purchase history. It never sends or schedules an email automatically.</p>
 <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Purchased plant<select className="mt-2 w-full rounded-lg border p-3" value={choice} disabled={busy} onChange={e=>{setChoice(e.target.value);reset();}}><option value="">Choose an exact purchased product</option>{products.map(p=><option key={p.connection_id+':'+p.variant_id} value={p.connection_id+':'+p.variant_id}>{p.product_name} · {p.variant_id.slice(-8)}</option>)}</select></label><label className="text-sm font-semibold">Purchase window<select className="mt-2 w-full rounded-lg border p-3" value={days} disabled={busy} onChange={e=>{setDays(Number(e.target.value));reset();}}>{[7,14,30,60,90].map(d=><option key={d} value={d}>Past {d} days (excluding today)</option>)}</select></label></div>
 {!products.length&&<p className="mt-3 text-sm text-[#536475]">No linked native POS purchases available yet. Connect your POS and resolve customer identities first.</p>}
 <button type="button" className="mt-4 rounded-lg border px-4 py-2 font-semibold disabled:opacity-50" disabled={!plant||busy} onClick={()=>void preview()}>Review eligible audience</button>
 {review&&<div className="mt-4 rounded-lg bg-[#f5f7f3] p-4"><p className="font-semibold">{review.count} eligible customers</p><p className="text-xs">Exact purchases, recorded opt-in, current suppression and refund checks.</p><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!review.count||busy} onChange={e=>setConfirmed(e.target.checked)}/>I verified this is the exact plant and reviewed the audience.</label><button type="button" className="mt-3 rounded-lg bg-[#173f37] px-4 py-2 text-white disabled:opacity-50" disabled={!review.count||!confirmed||busy||!!draft} onClick={()=>void create()}>Create campaign draft</button></div>}
 {draft&&<p className="mt-3 text-sm" role="status">Draft created. <Link className="underline font-semibold" to={'/crm/campaigns/'+draft}>Open campaign to review and schedule</Link></p>}
 {error&&<p role="alert" className="mt-3 text-sm text-[#536475]">{error}</p>}
 </section>;
}
