import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Box from "@mui/joy/Box";
import { Brain, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type { CustomerIntelligenceDetail } from "@/hooks/useCustomerIntelligenceDetail";

const cad=(v:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(v);
const top=(v:Record<string,number>|null|undefined)=>Object.entries(v??{}).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,5);

export function CustomerIntelligenceStory({intelligence,onAskBloom}:{intelligence:CustomerIntelligenceDetail|null|undefined;onAskBloom:()=>void}){
 if(!intelligence) return null;
 const velocity=Number(intelligence.purchase_velocity??0);
 const category=top(intelligence.category_spend);
 const department=top(intelligence.department_spend);
 const isDeclining=velocity<=-20;
 const tier=String(intelligence.customer_tier??"customer");
 const story=[
  tier==="vip"||tier==="loyal"?`A ${tier} customer with ${cad(Number(intelligence.lifetime_value??0))} in recorded lifetime value.`:`${cad(Number(intelligence.lifetime_value??0))} in recorded lifetime value across their purchase history.`,
  category[0]?`Their strongest category is ${category[0][0]} (${cad(Number(category[0][1]))}).`:"",
  department[0]?`They spend most heavily in ${department[0][0]}.`:"",
  isDeclining?`Recent purchase momentum is down ${Math.abs(Math.round(velocity))}% versus the prior 90-day window.`:velocity>20?`Recent purchase momentum is up ${Math.round(velocity)}% versus the prior 90-day window.`:"",
 ].filter(Boolean).join(" ");

 return <JoyCard variant="outlined">
  <JoyCardHeader title="Customer story" description="A grounded summary of what this customer buys, how valuable they are, and whether their behavior is changing." startDecorator={<Sparkles size={18}/>} actions={<JoyButton size="sm" variant="soft" startDecorator={<Brain size={14}/>} onClick={onAskBloom}>Ask Bloom why</JoyButton>}/>
  <JoyCardContent><Stack spacing={2.5}>
   <Sheet variant="soft" color={isDeclining?"warning":"primary"} sx={{borderRadius:"xl",p:{xs:2.5,md:3}}}>
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
     {isDeclining?<TrendingDown size={20}/>:<TrendingUp size={20}/>}
     <Typography level="title-md" sx={{lineHeight:1.55}}>{story}</Typography>
    </Stack>
   </Sheet>
   <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(3,1fr)"},gap:1.25}}>
    <Sheet variant="soft" color="neutral" sx={{borderRadius:"xl",p:2}}><Typography level="body-xs" color="neutral">Purchase frequency</Typography><Typography level="title-lg">{Number(intelligence.purchase_frequency??0).toFixed(1)} / month</Typography></Sheet>
    <Sheet variant="soft" color="neutral" sx={{borderRadius:"xl",p:2}}><Typography level="body-xs" color="neutral">Departments shopped</Typography><Typography level="title-lg">{intelligence.departments_shopped??0}</Typography></Sheet>
    <Sheet variant="soft" color="neutral" sx={{borderRadius:"xl",p:2}}><Typography level="body-xs" color="neutral">Quantity purchased</Typography><Typography level="title-lg">{Math.round(Number(intelligence.total_quantity??0))}</Typography></Sheet>
   </Box>
   {category.length?<Stack spacing={1}><Typography level="title-sm">Category affinity</Typography><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">{category.map(([label,value])=><JoyChip key={label} variant="soft" color="primary">{label} · {cad(Number(value))}</JoyChip>)}</Stack></Stack>:null}
  </Stack></JoyCardContent>
 </JoyCard>;
}
