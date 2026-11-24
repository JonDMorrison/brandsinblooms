import React, {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import type {SupabaseClient} from '@supabase/supabase-js';
import {useTenant} from '@/hooks/useTenant';
import {supabase} from '@/integrations/supabase/client';
import {WebsiteCareFollowupPanel} from '@/components/crm/WebsiteCareFollowupPanel';
import {CareFollowupPanel} from '@/components/crm/CareFollowupPanel';
import {renderCareGuideEmail,type CareGuideBrand,type ReviewedCareGuidePlant} from '@/lib/email/careGuideEmail';

type Design = Pick<CareGuideBrand,'storeName'|'logoUrl'|'primaryColor'|'accentColor'|'headline'|'intro'|'helpHeading'|'helpBody'|'helpUrl'|'helpLinkText'>;
type Version = {version:number; design:Design; published_at:string};
const db = supabase as unknown as SupabaseClient;
const defaultDesign = (storeName:string):Design => ({
  storeName, logoUrl:'',primaryColor:'#173f37',accentColor:'#486d58',
  headline:'A good start for something green.',
  intro:'A little guidance for your new plant. Here are three simple things to help it settle in.',
  helpHeading:"Questions? We're still here.",
  helpBody:'Bring a photo, stop by the shop, or ask us about your plant. Good gardening is something we grow together.',
  helpUrl:'',helpLinkText:'Ask us about your plant',
});
// A known, clearly marked demonstration. No inventory or production claims.
const demoPlant:ReviewedCareGuidePlant = {
  productId:'DEMO-ONLY', name:'Red Prayer Plant',botanicalName:'Maranta leuconeura',careVersion:'sample-v1',
  care:{status:'REVIEWED',sun:'Bright, filtered light away from harsh direct sun.',water:'Check the topsoil. Water as it begins to dry, and let the excess drain.',soil:'Use a loose, well-draining potting mix.',sourceLabel:'Illustrative studio sample only'},
  approvedImageUrl:'https://images.pexels.com/photos/4590439/pexels-photo-4590439.jpeg?auto=compress&cs=tinysrgb&w=900',
};
const fields:ReadonlyArray<{key:keyof Design;label:string;large?:boolean;hint?:string}> = [
  {key:'storeName',label:'Store name',hint:'Shown as the sender brand, not BloomSuite'},
  {key:'logoUrl',label:'Store logo URL',hint:'Optional HTTPS image'},
  {key:'headline',label:'Care guide headline'},
  {key:'intro',label:'Welcome message',large:true},
  {key:'helpHeading',label:'Support heading'},
  {key:'helpBody',label:'Support message',large:true},
  {key:'helpUrl',label:'Help link (HTTPS)'},
  {key:'helpLinkText',label:'Help link label'},
];
function safeDesign(raw:unknown, fallback:string):Design {
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) return defaultDesign(fallback);
  const value=raw as Record<string,unknown>,out=defaultDesign(fallback);
  for(const k of Object.keys(out) as (keyof Design)[]) if(typeof value[k]==='string')out[k]=value[k] as string;
  return out;
}
export default function CareGuideStudioPage(){
  const {tenant,loading:tenantLoading}=useTenant();
  const tenantId=tenant?.id;
  const [design,setDesign]=useState<Design>(()=>defaultDesign('Your garden centre'));
  const [publishedVersion,setPublishedVersion]=useState(0);
  const [published,setPublished]=useState<Design|null>(null);
  const [versions,setVersions]=useState<Version[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState('');
  const [acknowledged,setAcknowledged]=useState(false);
  const [device,setDevice]=useState<'desktop'|'phone'>('desktop');
  const [myEmail,setMyEmail]=useState('');
  const [testBusy,setTestBusy]=useState(false);
  useEffect(()=>{let active=true;void supabase.auth.getUser().then(({data})=>{if(active)setMyEmail(data.user?.email??'');});return()=>{active=false;};},[]);
  useEffect(()=>{
    if(tenantLoading)return;
    if(!tenantId){setLoading(false);return;}
    let active=true;
    (async()=>{
      try{
        const [template,history]=await Promise.all([
          db.from('care_guide_designs').select('draft,published,published_version').eq('tenant_id',tenantId).maybeSingle(),
          db.from('care_guide_design_versions').select('version,design,published_at').eq('tenant_id',tenantId).order('version',{ascending:false}).limit(10),
        ]);
        if(template.error)throw template.error;
        if(history.error)throw history.error;
        if(!active)return;
        const fallback=tenant?.name||'Your garden centre';
        setDesign(safeDesign(template.data?.draft,fallback));
        setPublished(template.data?.published?safeDesign(template.data.published,fallback):null);
        setPublishedVersion(Number(template.data?.published_version||0));
        setVersions((history.data||[]) as Version[]);
      }catch(e){if(active)setError(e instanceof Error?e.message:'Care Guide Studio unavailable');}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[tenantId,tenant?.name,tenantLoading]);
  const preview=useMemo(()=>{
    try{return renderCareGuideEmail({brand:{...design,publishedVersion:String(publishedVersion||'PREVIEW')},plants:[demoPlant],requested:true});}
    catch(e){return {error:e instanceof Error?e.message:'Invalid care guide'};}
  },[design,publishedVersion]);
  const update=(key:keyof Design,value:string)=>{setDesign(old=>({...old,[key]:value}));setAcknowledged(false);setError('');setMessage('');};
  const save=async()=>{if(!tenantId||busy)return;setBusy(true);setError('');setMessage('');
    try{const result=await db.rpc('save_care_guide_design_draft',{p_tenant_id:tenantId,p_draft:design});if(result.error)throw result.error;setMessage('Draft saved. Customers still receive the last published design.');}
    catch(e){setError(e instanceof Error?e.message:'Unable to save draft');}finally{setBusy(false);}
  };
  const sendTest=async()=>{if(!tenantId||busy||testBusy||'error' in preview)return;setTestBusy(true);setError('');setMessage('');
    try{
      const savedDraft=await db.rpc('save_care_guide_design_draft',{p_tenant_id:tenantId,p_draft:design});
      if(savedDraft.error)throw savedDraft.error;
      const {data,error:sendError}=await supabase.functions.invoke('care-guide-test-send',{body:{}});
      if(sendError||!data?.sent)throw Error(typeof data?.error==='string'?data.error:'The test email could not be sent.');
      setMessage('Draft saved and a test sent to '+data.to+'. It uses the sample plant shown here. Customers still receive the last published design.');
    }catch(e){setError(e instanceof Error?e.message:'The test email could not be sent.');}
    finally{setTestBusy(false);}
  };
  const syncConnectedSites=async()=>{
    const {data,error}=await supabase.functions.invoke('care-guide-sync',{body:{}});
    if(error||data?.error||!Array.isArray(data?.synced)||!Array.isArray(data?.failed))
      throw Error('Connected-site synchronization is not available yet. The CRM design stays published.');
    const count=data.synced.length,failed=data.failed.length;
    const posStatus=data.posPending?' POS synchronization needs retry.':data.posUpdated?' Connected POS branding updated.':'';
    return failed?'CRM design published. '+count+' linked sites updated; '+failed+' need another sync attempt.':
      count===0?'CRM design published. Connect a BloomSites website to use it on online orders.':
      'Design synchronized to '+count+' connected BloomSites '+(count===1?'website.':'websites.')+posStatus;
  };
  const retryConnectedSync=async()=>{
    if(busy||!publishedVersion)return;
    setBusy(true);setError('');setMessage('');
    try{setMessage(await syncConnectedSites());}
    catch(e){setError(e instanceof Error?e.message:'Connected-site sync unavailable');}
    finally{setBusy(false);}
  };
  const publish=async()=>{if(!tenantId||busy||!acknowledged||'error' in preview)return;setBusy(true);setError('');setMessage('');
    try{
      const result=await db.rpc('publish_care_guide_design',{p_tenant_id:tenantId,p_expected_version:publishedVersion,p_design:design});
      if(result.error)throw result.error;
      const next=Number(result.data);
      if(!Number.isSafeInteger(next)||next<=publishedVersion)throw Error('Unable to verify new published version');
      setPublishedVersion(next);setPublished({...design});setAcknowledged(false);
      setVersions(old=>[{version:next,design:{...design},published_at:new Date().toISOString()},...old].slice(0,10));
      try {setMessage(await syncConnectedSites());}
      catch {setMessage('Published version '+next+' in CRM. Connected BloomSites sync is pending; retry below once the shared design connection is configured.');}
    }catch(e){setError(e instanceof Error?e.message:'Unable to publish design');}finally{setBusy(false);}
  };
  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-7 text-[#173f37] sm:px-8">
    <div className="mx-auto max-w-[1380px]">
      <Link to="/crm/campaigns" className="text-sm font-medium text-[#527566] hover:underline">← Campaigns</Link>
      <div className="mb-7 mt-4 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.19em] text-[#527566]">BloomSuite CRM</p>
          <h1 className="font-[Georgia] text-4xl tracking-tight">Care Guide Studio</h1>
          <p className="mt-2 max-w-2xl text-[#536475]">Give every plant a thoughtful follow-up. Customize your store’s email design while approved horticultural information stays protected.</p></div>
        <span className="rounded-full border border-[#dbe3df] bg-white px-4 py-2 text-xs font-semibold">Published version: {publishedVersion||'Not yet published'}</span>
      </div>
      {error&&<p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      {message&&<p role="status" className="mb-4 rounded-lg border border-[#dbe3df] bg-white p-3 text-sm text-[#173f37]">{message}</p>}
      {loading?<p role="status">Loading your Care Guide design…</p>:!tenantId?<p role="alert">Choose your garden centre to edit its Care Guide design.</p>:
      <div className="grid gap-6 lg:grid-cols-[minmax(340px,410px)_minmax(0,1fr)]">
        <section aria-label="Care Guide design settings" className="rounded-2xl border border-[#dbe3df] bg-white p-6 shadow-sm">
          <h2 className="font-[Georgia] text-2xl">Make it yours.</h2>
          <p className="mt-1 text-sm text-[#536475]">This changes the presentation, not the reviewed care facts or marketing consent.</p>
          <div className="mt-5 space-y-4">
            {fields.map(field=><label key={field.key} className="block text-sm font-semibold">{field.label}
              {field.large?<textarea rows={3} maxLength={400} value={design[field.key]||''} onChange={e=>update(field.key,e.target.value)} className="mt-1 w-full rounded-lg border border-[#c9d7d1] bg-white p-3 text-sm text-[#173f37]"/>:
                <input type="text" maxLength={field.key==='headline'?100:2048} value={design[field.key]||''} onChange={e=>update(field.key,e.target.value)} className="mt-1 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 py-2.5 text-sm text-[#173f37]" />}
              {field.hint&&<span className="mt-1 block text-xs font-normal text-[#728077]">{field.hint}</span>}
            </label>)}
            <div className="grid grid-cols-2 gap-4">{(['primaryColor','accentColor'] as const).map(key=><label key={key} className="text-sm font-semibold">{key==='primaryColor'?'Primary colour':'Accent colour'}
              <input aria-label={key==='primaryColor'?'Primary colour':'Accent colour'} type="color" value={/^#[a-fA-F0-9]{6}$/.test(design[key]||'')?design[key]||'#173f37':'#173f37'} onChange={e=>update(key,e.target.value)} className="mt-2 block h-10 w-full cursor-pointer rounded-lg border border-[#c9d7d1] p-1" /></label>)}</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>void save()} className="rounded-lg border border-[#a4b9af] px-5 py-3 text-sm font-bold disabled:opacity-50">Save draft</button>
            <button type="button" disabled={busy||!acknowledged||'error' in preview} onClick={()=>void publish()} className="rounded-lg bg-[#173f37] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Publish design</button> <button type="button" disabled={busy||!publishedVersion} onClick={()=>void retryConnectedSync()} className="rounded-lg border border-[#a4b9af] px-5 py-3 text-sm font-bold disabled:opacity-50">Sync to connected BloomSites</button></div>
          <label className="mt-5 flex items-start gap-3 text-sm text-[#536475]"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} className="mt-1" />I reviewed the desktop and mobile preview and understand that changing the design does not approve or generate plant-care facts.</label>
          {published&&<p className="mt-4 text-xs text-[#728077]">A previously published version stays active until you explicitly publish a replacement.</p>}
          {versions.length>0&&<div className="mt-7 border-t border-[#dbe3df] pt-5"><h3 className="font-semibold">Published history</h3><div className="mt-2 space-y-2">
            {versions.map(item=><div key={item.version} className="flex items-center justify-between rounded-lg bg-[#f8f9f6] px-3 py-2 text-sm"><span>Version {item.version}</span><button type="button" onClick={()=>{setDesign(safeDesign(item.design,tenant.name||'Your garden centre'));setAcknowledged(false);setMessage('Version '+item.version+' restored to your draft. Publish when ready.');}} className="font-semibold underline">Restore to draft</button></div>)}
          </div></div>}
        </section>
        <section aria-label="Care Guide email preview" className="rounded-2xl border border-[#dbe3df] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-[Georgia] text-2xl">Live preview</h2><p className="mt-1 text-xs text-[#536475]">Illustrative Red Prayer Plant only. Real messages require an approved product match and care record.</p></div><div className="flex flex-wrap items-center gap-2"><div role="group" aria-label="Preview size" className="inline-flex rounded-full border border-[#dbe3df] bg-[#f8f9f6] p-1 text-xs font-semibold">{(['desktop','phone'] as const).map(size=><button key={size} type="button" aria-pressed={device===size} onClick={()=>setDevice(size)} className={'rounded-full px-3 py-1.5 '+(device===size?'bg-white text-[#173f37] shadow-sm':'text-[#536475]')}>{size==='desktop'?'Desktop':'Phone'}</button>)}</div><button type="button" disabled={busy||testBusy||!myEmail||'error' in preview} onClick={()=>void sendTest()} className="rounded-full border border-[#a4b9af] bg-white px-4 py-2 text-xs font-bold disabled:opacity-50">{testBusy?'Sending…':'Send me a test'}</button></div></div>
          <p className="-mt-2 mb-3 text-xs text-[#536475]">{myEmail?'Tests go only to '+myEmail+', using the sample plant shown. The draft is saved first.':'Sign in to send yourself a test.'}</p>
          {'error' in preview?<p role="alert" className="p-3 text-sm text-rose-900">{preview.error}</p>:
            <div className="flex justify-center rounded-xl bg-[#eeeae0]"><iframe title="Store-branded care guide email preview" sandbox="" srcDoc={preview.html} style={{width:device==='phone'?375:'100%',maxWidth:'100%'}} className={'h-[780px] border border-[#dbe3df] bg-[#eeeae0] '+(device==='phone'?'rounded-[28px]':'rounded-xl')}/></div>}
          <p className="mt-3 text-xs text-[#536475]">Before going live, send yourself a test and check it in Gmail, Apple Mail and Outlook, including with images blocked.</p>
        </section>
      </div>}
      {tenantId&&import.meta.env.VITE_CARE_GUIDE_FOLLOWUPS_ENABLED==='true'&&<CareFollowupPanel key={tenantId} tenantId={tenantId}/>}
      {tenantId&&import.meta.env.VITE_CARE_GUIDE_WEBSITE_FOLLOWUP_ENABLED==='true'&&<WebsiteCareFollowupPanel key={tenantId+':web'} tenantId={tenantId}/>}
    </div>
  </main>;
}
