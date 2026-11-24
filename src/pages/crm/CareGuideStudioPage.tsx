import React, {useEffect,useMemo,useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import Alert from '@mui/joy/Alert';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import Checkbox from '@mui/joy/Checkbox';
import Chip from '@mui/joy/Chip';
import FormControl from '@mui/joy/FormControl';
import FormHelperText from '@mui/joy/FormHelperText';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Link from '@mui/joy/Link';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import Textarea from '@mui/joy/Textarea';
import ToggleButtonGroup from '@mui/joy/ToggleButtonGroup';
import Typography from '@mui/joy/Typography';
import {PageContainer} from '@/components/joy/PageContainer';
import {JoyPageHeaderBand} from '@/components/joy/JoyPageHeaderBand';
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
  const swatch=(key:'primaryColor'|'accentColor')=>/^#[a-fA-F0-9]{6}$/.test(design[key]||'')?design[key] as string:'#173f37';
  return <PageContainer>
    <Stack spacing={3} sx={{pb:4}}>
      <Link component={RouterLink} to="/crm/campaigns" level="body-sm" startDecorator={<ArrowLeft size={14}/>} sx={{alignSelf:'flex-start'}}>Campaigns</Link>
      <JoyPageHeaderBand
        title="Care Guide Studio"
        description="Give every plant a thoughtful follow-up. Customize your store’s email design while approved horticultural information stays protected."
        actions={<Chip variant="outlined" size="md">Published version: {publishedVersion||'Not yet published'}</Chip>}
      />
      {error&&<Alert role="alert" color="danger" variant="soft">{error}</Alert>}
      {message&&<Alert role="status" color="neutral" variant="outlined">{message}</Alert>}
      {loading?<Typography role="status" level="body-sm">Loading your Care Guide design…</Typography>:!tenantId?<Alert role="alert" color="warning" variant="soft">Choose your garden centre to edit its Care Guide design.</Alert>:
      <Box sx={{display:'grid',gap:3,gridTemplateColumns:{xs:'1fr',lg:'minmax(340px,410px) minmax(0,1fr)'}}}>
        <Card component="section" aria-label="Care Guide design settings" variant="outlined" sx={{p:3,gap:0}}>
          <Typography level="title-lg">Make it yours</Typography>
          <Typography level="body-sm" sx={{mt:0.5,color:'neutral.600'}}>This changes the presentation, not the reviewed care facts or marketing consent.</Typography>
          <Stack spacing={2} sx={{mt:2.5}}>
            {fields.map(field=><FormControl key={field.key}>
              <FormLabel>{field.label}</FormLabel>
              {field.large?<Textarea minRows={3} maxRows={6} slotProps={{textarea:{maxLength:400}}} value={design[field.key]||''} onChange={e=>update(field.key,e.target.value)}/>:
                <Input slotProps={{input:{maxLength:field.key==='headline'?100:2048}}} value={design[field.key]||''} onChange={e=>update(field.key,e.target.value)}/>}
              {field.hint&&<FormHelperText>{field.hint}</FormHelperText>}
            </FormControl>)}
            <Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>{(['primaryColor','accentColor'] as const).map(key=><FormControl key={key}>
              <FormLabel>{key==='primaryColor'?'Primary colour':'Accent colour'}</FormLabel>
              <Input type="color" value={swatch(key)} onChange={e=>update(key,e.target.value)} slotProps={{input:{'aria-label':key==='primaryColor'?'Primary colour':'Accent colour'}}} sx={{'& input':{cursor:'pointer',height:28,p:0}}}/>
            </FormControl>)}</Box>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{mt:3}}>
            <Button variant="outlined" color="neutral" disabled={busy} onClick={()=>void save()}>Save draft</Button>
            <Button disabled={busy||!acknowledged||'error' in preview} onClick={()=>void publish()}>Publish design</Button>
            <Button variant="outlined" color="neutral" disabled={busy||!publishedVersion} onClick={()=>void retryConnectedSync()}>Sync to connected BloomSites</Button>
          </Stack>
          <Checkbox sx={{mt:2.5}} size="sm" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} label="I reviewed the desktop and mobile preview and understand that changing the design does not approve or generate plant-care facts."/>
          {published&&<Typography level="body-xs" sx={{mt:2,color:'neutral.500'}}>A previously published version stays active until you explicitly publish a replacement.</Typography>}
          {versions.length>0&&<Box sx={{mt:3,pt:2.5,borderTop:'1px solid',borderColor:'neutral.200'}}><Typography level="title-sm">Published history</Typography><Stack spacing={1} sx={{mt:1}}>
            {versions.map(item=><Sheet key={item.version} variant="soft" color="neutral" sx={{display:'flex',alignItems:'center',justifyContent:'space-between',borderRadius:'sm',px:1.5,py:1}}><Typography level="body-sm">Version {item.version}</Typography><Button size="sm" variant="plain" onClick={()=>{setDesign(safeDesign(item.design,tenant.name||'Your garden centre'));setAcknowledged(false);setMessage('Version '+item.version+' restored to your draft. Publish when ready.');}}>Restore to draft</Button></Sheet>)}
          </Stack></Box>}
        </Card>
        <Card component="section" aria-label="Care Guide email preview" variant="outlined" sx={{p:{xs:2,sm:3},gap:0}}>
          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" justifyContent="space-between" alignItems="center" sx={{mb:1.5}}>
            <Box><Typography level="title-lg">Live preview</Typography><Typography level="body-xs" sx={{mt:0.5,color:'neutral.600'}}>Illustrative Red Prayer Plant only. Real messages require an approved product match and care record.</Typography></Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButtonGroup size="sm" value={device} aria-label="Preview size" onChange={(_e,v)=>{if(v)setDevice(v as 'desktop'|'phone');}}>
                {(['desktop','phone'] as const).map(size=><Button key={size} value={size} variant={device===size?'solid':'outlined'} color={device===size?'primary':'neutral'}>{size==='desktop'?'Desktop':'Phone'}</Button>)}
              </ToggleButtonGroup>
              <Button size="sm" variant="outlined" color="neutral" loading={testBusy} disabled={busy||!myEmail||'error' in preview} onClick={()=>void sendTest()}>Send me a test</Button>
            </Stack>
          </Stack>
          <Typography level="body-xs" sx={{mb:1.5,color:'neutral.600'}}>{myEmail?'Tests go only to '+myEmail+', using the sample plant shown. The draft is saved first.':'Sign in to send yourself a test.'}</Typography>
          {'error' in preview?<Alert role="alert" color="danger" variant="soft">{preview.error}</Alert>:
            <Sheet variant="soft" color="neutral" sx={{display:'flex',justifyContent:'center',borderRadius:'md'}}><Box component="iframe" title="Store-branded care guide email preview" sandbox="" srcDoc={preview.html} sx={{width:device==='phone'?375:'100%',maxWidth:'100%',height:780,border:'1px solid',borderColor:'neutral.200',borderRadius:device==='phone'?'28px':'md',backgroundColor:'#eeeae0'}}/></Sheet>}
          <Typography level="body-xs" sx={{mt:1.5,color:'neutral.600'}}>Before going live, send yourself a test and check it in Gmail, Apple Mail and Outlook, including with images blocked.</Typography>
        </Card>
      </Box>}
      {tenantId&&import.meta.env.VITE_CARE_GUIDE_FOLLOWUPS_ENABLED==='true'&&<CareFollowupPanel key={tenantId} tenantId={tenantId}/>}
      {tenantId&&import.meta.env.VITE_CARE_GUIDE_WEBSITE_FOLLOWUP_ENABLED==='true'&&<WebsiteCareFollowupPanel key={tenantId+':web'} tenantId={tenantId}/>}
    </Stack>
  </PageContainer>;
}
