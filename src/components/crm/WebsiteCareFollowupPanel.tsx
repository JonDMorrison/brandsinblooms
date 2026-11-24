import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '@/integrations/supabase/client';
import type {SupabaseClient} from '@supabase/supabase-js';
const db=supabase as unknown as SupabaseClient;
type Site={siteId:string;name:string};
type Product={product_id:string;product_name:string;last_purchase:string};
type Preview={count:number;digest:string;asOf:string};
export function WebsiteCareFollowupPanel({tenantId}:{tenantId:string}){
 const [sites,setSites]=useState<Site[]>([]),[site,setSite]=useState(''),[products,setProducts]=useState<Product[]>([]),[product,setProduct]=useState(''),[days,setDays]=useState(30);
 const [busy,setBusy]=useState(false),[review,setReview]=useState<Preview|null>(null),[confirmed,setConfirmed]=useState(false),[requestId,setRequestId]=useState(''),[draft,setDraft]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;void db.rpc('list_care_followup_websites',{p_tenant:tenantId}).then(({data,error})=>{if(active){setSites(Array.isArray(data)?data:[]);if(error)setMessage('Reviewed website connections unavailable.');}});return()=>{active=false;};},[tenantId]);
 const clear=()=>{setReview(null);setConfirmed(false);setDraft('');setMessage('');};
 async function chooseSite(id:string){setSite(id);setProducts([]);setProduct('');clear();if(!id)return;setBusy(true);try{
 const {data,error}=await supabase.functions.invoke('care-followup-website',{body:{action:'catalog',siteId:id}});
 if(error||!Array.isArray(data?.products))throw Error();setProducts(data.products);if(!data.products.length)setMessage('No eligible completed purchases from reviewed customer accounts in the last 90 days.');
 }catch{setMessage('Website purchase evidence is not available or sharing has not been enabled.');}finally{setBusy(false);}}
 async function preview(){if(!site||!product||busy)return;clear();setBusy(true);try{
 const {data,error}=await supabase.functions.invoke('care-followup-website',{body:{action:'preview',siteId:site,productId:product,days}});
 if(error||!Number.isSafeInteger(data?.count))throw Error();setReview(data);setRequestId(crypto.randomUUID());
 }catch{setMessage('Could not verify the audience. Refresh and review again.');}finally{setBusy(false);}}
 async function create(){const plant=products.find(p=>p.product_id===product);if(!plant||!review?.count||!confirmed||busy)return;setBusy(true);try{
 const {data,error}=await supabase.functions.invoke('care-followup-website',{body:{action:'create',siteId:site,productId:product,productName:plant.product_name,days,asOf:review.asOf,digest:review.digest,requestId,confirmed:true}});
 if(error||!data?.campaignId)throw Error();setDraft(data.campaignId);
 }catch{setMessage('Audience or plant identity changed. Refresh the review before creating a draft.');}finally{setBusy(false);}}
 return <section aria-label="Online plant purchase follow-ups" className="mt-6 rounded-2xl border border-[#dbe3df] bg-white p-6 shadow-sm">
 <h2 className="font-[Georgia] text-2xl">Follow up with online customers.</h2><p className="mt-2 text-sm text-[#536475]">Use completed, paid BloomSites purchases and reviewed customer identities. Only current email opt-ins are eligible; guest or unlinked purchases are excluded.</p>
 <div className="mt-4 grid gap-3 sm:grid-cols-3">
 <label className="text-sm font-semibold">Connected website<select disabled={busy} value={site} className="mt-2 w-full rounded-lg border p-3" onChange={e=>void chooseSite(e.target.value)}><option value="">Choose a reviewed website</option>{sites.map(s=><option key={s.siteId} value={s.siteId}>{s.name}</option>)}</select></label>
 <label className="text-sm font-semibold">Purchased plant<select disabled={busy} value={product} className="mt-2 w-full rounded-lg border p-3" onChange={e=>{setProduct(e.target.value);clear();}}><option value="">Choose an exact plant</option>{products.map(p=><option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}</select></label>
 <label className="text-sm font-semibold">Purchase window<select disabled={busy} value={days} className="mt-2 w-full rounded-lg border p-3" onChange={e=>{setDays(Number(e.target.value));clear();}}>{[7,14,30,60,90].map(d=><option key={d} value={d}>Past {d} days (excluding today)</option>)}</select></label></div>
 {!sites.length&&<p className="mt-3 text-sm text-[#536475]">A connected website and reviewed storefront customer identity linkage are required.</p>}
 <button type="button" disabled={!site||!product||busy} onClick={()=>void preview()} className="mt-4 rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Review eligible audience</button>
 {review&&<div className="mt-4 rounded-lg bg-[#f5f7f3] p-4"><p className="font-semibold">{review.count} eligible customers</p><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" disabled={!review.count||busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified the exact plant and reviewed the audience.</label><button type="button" disabled={!confirmed||!review.count||busy||!!draft} onClick={()=>void create()} className="mt-3 rounded-lg bg-[#173f37] px-4 py-2 text-white disabled:opacity-50">Create campaign draft</button></div>}
 {draft&&<p role="status" className="mt-3 text-sm">Draft created. <Link to={'/crm/campaigns/'+draft} className="font-semibold underline">Open campaign</Link></p>}
 {message&&<p role="status" className="mt-3 text-sm text-[#536475]">{message}</p>}
 </section>;
}
