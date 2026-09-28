import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Skeleton from "@mui/joy/Skeleton";
import { ArrowRight, Brain, Sparkles, TrendingDown, UsersRound, WandSparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyStatCard } from "@/components/joy/JoyStatCard";

type IntelligenceRow={
 customer_id:string; first_name:string|null; last_name:string|null; email:string|null;
 lifetime_value:number|null; purchase_velocity:number|null; days_since_last_purchase:number|null;
 customer_tier:string|null; top_product_categories:string[]|null; total_quantity:number|null;
 departments_shopped:number|null; categories_shopped:number|null;
};
const cad=(v:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(v);
const name=(r:IntelligenceRow)=>[r.first_name,r.last_name].filter(Boolean).join(" ")||r.email||"Customer";

export default function CustomerIntelligencePage(){
 const navigate=useNavigate();
 const { tenant }=useTenant();
 const tenantId=tenant?.id;
 const query=useQuery({
  queryKey:["customer-intelligence-home",tenantId],
  enabled:Boolean(tenantId),
  staleTime:120000,
  queryFn:async()=>{
   const {data,error}=await supabase.from("customer_purchase_intelligence")
    .select("customer_id,first_name,last_name,email,lifetime_value,purchase_velocity,days_since_last_purchase,customer_tier,top_product_categories,total_quantity,departments_shopped,categories_shopped")
    .eq("tenant_id",tenantId!).order("lifetime_value",{ascending:false}).limit(5000);
   if(error) throw error;
   return (data??[]) as IntelligenceRow[];
  }
 });
 const rows=query.data??[];
 const declining=rows.filter(r=>Number(r.purchase_velocity??0)<=-25&&Number(r.lifetime_value??0)>=250);
 const dormant=rows.filter(r=>Number(r.days_since_last_purchase??0)>=120&&Number(r.lifetime_value??0)>=250);
 const vip=rows.filter(r=>["vip","loyal"].includes(String(r.customer_tier??"").toLowerCase()));
 const riskValue=declining.reduce((s,r)=>s+Number(r.lifetime_value??0),0);
 const categoryCounts=new Map<string,number>();
 for(const r of rows) for(const c of r.top_product_categories??[]) categoryCounts.set(c,(categoryCounts.get(c)??0)+1);
 const topCategories=[...categoryCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);

 const askBloom=(prompt:string)=>navigate(`/bloom?prompt=${encodeURIComponent(prompt)}`);
 if(query.isLoading) return <PageContainer sx={{py:3}}><Stack spacing={2}><Skeleton variant="rectangular" sx={{height:180,borderRadius:"2xl"}}/><Skeleton variant="rectangular" sx={{height:420,borderRadius:"2xl"}}/></Stack></PageContainer>;

 return <PageContainer sx={{py:{xs:2,md:3}}}>
  <Stack spacing={3}>
   <Sheet variant="soft" color="primary" sx={{borderRadius:"2xl",p:{xs:3,md:5},overflow:"hidden",position:"relative"}}>
    <Stack spacing={2.5} sx={{maxWidth:850,position:"relative",zIndex:1}}>
     <JoyChip size="sm" variant="soft" color="primary" startDecorator={<Sparkles size={13}/>}>Bloom Intelligence</JoyChip>
     <Stack spacing={1}>
      <Typography level="h1" sx={{fontSize:{xs:"2rem",md:"3rem"},letterSpacing:"-0.04em",maxWidth:760}}>Know what your customers are telling you—before they say it.</Typography>
      <Typography level="body-lg" color="neutral" sx={{maxWidth:720,lineHeight:1.65}}>BloomSuite turns purchase history into clear opportunities: who is growing, who is drifting away, what they care about, and what deserves your attention next.</Typography>
     </Stack>
     <Stack direction={{xs:"column",sm:"row"}} spacing={1.25}>
      <JoyButton startDecorator={<WandSparkles size={16}/>} onClick={()=>askBloom("Review my customer intelligence and tell me the three highest-value opportunities I should focus on right now. Show the evidence behind each one.")}>Ask Bloom what matters</JoyButton>
      <JoyButton variant="soft" color="neutral" onClick={()=>navigate("/crm/segments")}>Explore audiences</JoyButton>
     </Stack>
    </Stack>
   </Sheet>

   <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(2,1fr)",lg:"repeat(4,1fr)"},gap:1.5}}>
    <JoyStatCard icon={<TrendingDown/>} label="Historical value at risk" value={cad(riskValue)} iconColor="warning"/>
    <JoyStatCard icon={<UsersRound/>} label="Customers slowing down" value={declining.length} iconColor="warning"/>
    <JoyStatCard icon={<Sparkles/>} label="Loyal & VIP customers" value={vip.length} iconColor="success"/>
    <JoyStatCard icon={<Brain/>} label="Win-back opportunities" value={dormant.length} iconColor="primary"/>
   </Box>

   <JoyCard variant="outlined">
    <JoyCardHeader title="Opportunities worth your attention" description="These signals come from actual customer purchase behavior. Bloom can explain the evidence and help turn any insight into an audience or campaign." actions={<JoyButton size="sm" variant="plain" onClick={()=>askBloom("Find my strongest customer opportunities. Prioritize by historical customer value and explain why each group matters.")}>Explore with Bloom</JoyButton>}/>
    <JoyCardContent>
     <Stack spacing={1.5}>
      {[
       {title:"Valuable customers are slowing down",count:declining.length,value:riskValue,copy:"Customers with meaningful history whose recent purchase velocity is down at least 25%.",prompt:"Show me high-value customers whose purchasing has declined by at least 25%. Explain the patterns and help me create a win-back audience."},
       {title:"Strong customers have gone quiet",count:dormant.length,value:dormant.reduce((s,r)=>s+Number(r.lifetime_value??0),0),copy:"Historically valuable customers with no purchase in at least 120 days.",prompt:"Show me valuable customers who have not purchased in at least 120 days. Rank them by opportunity and explain what they used to buy."},
      ].map(card=><Sheet key={card.title} variant="soft" color="neutral" sx={{borderRadius:"xl",p:{xs:2.5,md:3}}}>
       <Stack direction={{xs:"column",md:"row"}} spacing={2} justifyContent="space-between" alignItems={{md:"center"}}>
        <Stack spacing=.65>
         <Typography level="title-lg">{card.title}</Typography>
         <Typography level="body-sm" color="neutral">{card.copy}</Typography>
         <Stack direction="row" spacing={1} alignItems="center"><JoyChip size="sm" variant="soft">{card.count} customers</JoyChip><Typography level="body-sm" fontWeight="lg">{cad(card.value)} historical value</Typography></Stack>
        </Stack>
        <JoyButton variant="soft" endDecorator={<ArrowRight size={14}/>} onClick={()=>askBloom(card.prompt)}>Review with Bloom</JoyButton>
       </Stack>
      </Sheet>)}
     </Stack>
    </JoyCardContent>
   </JoyCard>

   <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",lg:"1.15fr .85fr"},gap:2}}>
    <JoyCard variant="outlined"><JoyCardHeader title="Customer momentum" description="A quick read on your highest-value customers whose behavior is changing."/><JoyCardContent><Stack spacing={1}>{declining.slice(0,6).map(r=><Sheet key={r.customer_id} variant="plain" sx={{py:1.25,borderBottom:"1px solid",borderColor:"neutral.100",cursor:"pointer"}} onClick={()=>navigate(`/crm/customers/${r.customer_id}?tab=purchase`)}><Stack direction="row" justifyContent="space-between" spacing={2}><Stack><Typography level="title-sm">{name(r)}</Typography><Typography level="body-xs" color="neutral">{(r.top_product_categories??[]).slice(0,3).join(" · ")||"Purchase history available"}</Typography></Stack><Stack alignItems="flex-end"><Typography level="title-sm">{cad(Number(r.lifetime_value??0))}</Typography><Typography level="body-xs" color="danger">{Math.round(Number(r.purchase_velocity??0))}% momentum</Typography></Stack></Stack></Sheet>)}</Stack></JoyCardContent></JoyCard>
    <JoyCard variant="outlined"><JoyCardHeader title="What customers care about" description="The categories appearing most often among customer purchase affinities."/><JoyCardContent><Stack spacing={1.5}>{topCategories.map(([category,count],i)=><Stack key={category} direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={1.25} alignItems="center"><Sheet variant="soft" color="primary" sx={{width:30,height:30,borderRadius:"lg",display:"grid",placeItems:"center"}}><Typography level="body-xs" fontWeight="lg">{i+1}</Typography></Sheet><Typography level="title-sm">{category}</Typography></Stack><Typography level="body-sm" color="neutral">{count} customers</Typography></Stack>)}</Stack></JoyCardContent></JoyCard>
   </Box>
  </Stack>
 </PageContainer>;
}
