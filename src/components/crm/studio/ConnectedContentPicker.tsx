import * as React from "react";
import Box from "@mui/joy/Box";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Globe2, ImageOff, Link2, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDialog, JoyDialogActions, JoyDialogContent } from "@/components/joy/JoyDialog";
import {
  connectedContentRequest,
  type ConnectedContentItem,
  type ConnectedContentResponse,
} from "@/lib/connectedContent";

const categories=[
  {value:"events",label:"Events"},
  {value:"pages",label:"Pages"},
  {value:"products",label:"Products"},
  {value:"blogs",label:"Blog"},
  {value:"fundraisers",label:"Fundraisers"},
] as const;

function eventDateLabel(item: ConnectedContentItem): string {
  if (!item.startAt || Number.isNaN(Date.parse(item.startAt))) return "";
  try { return new Date(item.startAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:item.timezone || "UTC" }); }
  catch { return new Date(item.startAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" }); }
}

interface Props {
  open:boolean;
  onClose:()=>void;
  onInsert:(items:ConnectedContentItem[])=>void;
  initialSiteId?:string;
  initialItemId?:string;
}

export function ConnectedContentPicker({
  open,onClose,onInsert,initialSiteId,initialItemId,
}:Props) {
  const navigate=useNavigate();
  const [category,setCategory]=React.useState("events");
  const [search,setSearch]=React.useState("");
  const [result,setResult]=React.useState<ConnectedContentResponse|null>(null);
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState("");
  const [selected,setSelected]=React.useState<string[]>([]);
  React.useEffect(()=>{
    if(!open) return;
    let active=true;
    setLoading(true);
    setError("");
    const task=window.setTimeout(()=>{
      void connectedContentRequest<ConnectedContentResponse>({
        action:"catalog",type:category,
        q:search,limit:50,
        ...(initialSiteId?{siteId:initialSiteId}:{}),
      }).then(data=>{
        if(!active)return;
        setResult(data);
        if(initialItemId && data.items.some(item=>item.id===initialItemId && item.eventStatus!=="cancelled" && item.eventStatus!=="sold_out")){
          setSelected([initialItemId]);
        }
      }).catch(e=>{
        if(active)setError(e instanceof Error?e.message:"Could not load website content.");
      }).finally(()=>{if(active)setLoading(false);});
    },search?280:0);
    return()=>{active=false;window.clearTimeout(task);};
  },[open,category,search,initialSiteId,initialItemId]);
  const selectedItems=(result?.items??[]).filter(item=>selected.includes(item.id) && item.eventStatus!=="cancelled" && item.eventStatus!=="sold_out");
  const hasSites=Boolean(result?.connections?.length);
  const toggle=(id:string)=>setSelected(old=>
    old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const requestInsert=()=>{
    if(selectedItems.length===0)return;
    onInsert(selectedItems);
    setSelected([]);
    onClose();
  };
  return(
    <JoyDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="From my website"
      description="Choose published content. Titles, images, dates and links are added for you."
      startDecorator={<Box sx={{
        width:44,height:44,bgcolor:"neutral.100",color:"neutral.700",
        borderRadius:"lg",display:"grid",placeItems:"center",
      }}><Globe2 size={21} aria-hidden="true"/></Box>}
      dialogSx={{maxHeight:"min(90vh, 880px)",bgcolor:"background.surface"}}
    >
      <JoyDialogContent sx={{pt:0,pb:1}}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {categories.map(type=>(
              <JoyButton key={type.value} size="sm"
                color={category===type.value?"primary":"neutral"}
                variant={category===type.value?"solid":"soft"}
                onClick={()=>{setCategory(type.value);setSelected([]);}}>
                {type.label}
              </JoyButton>
            ))}
          </Stack>
          <Input
            value={search}
            placeholder="Search published website content"
            startDecorator={<Search size={16} aria-hidden="true"/>}
            onChange={event=>setSearch(event.target.value)}
            aria-label="Search website content"
          />
          {loading?<Typography level="body-sm" color="neutral">Loading website content…</Typography>:null}
          {error?<Typography role="alert" level="body-sm" color="danger">{error}</Typography>:null}
          {!loading&&!error&&!hasSites?(
            <Sheet variant="outlined" sx={{p:3,borderRadius:"lg",textAlign:"center"}}>
              <Globe2 size={28} color="var(--joy-palette-neutral-500)"/>
              <Typography level="title-md" sx={{mt:1}}>Connect your BloomSites website</Typography>
              <Typography level="body-sm" color="neutral" sx={{my:1}}>
                An authorized site owner can generate a connection code in BloomSites Integrations.
              </Typography>
              <JoyButton variant="outlined" color="neutral"
                onClick={()=>{onClose();navigate("/crm/connected-content");}}>
                Connect website
              </JoyButton>
            </Sheet>
          ):null}
          {!loading&&!error&&hasSites&&result?.items.length===0?(
            <Typography level="body-sm" color="neutral" sx={{py:3}}>
              No matching published content was found. Try another category or search.
            </Typography>
          ):null}
          {!loading&&!error&&result?.sources.some(source=>source.error)?(
            <Typography level="body-sm" color="neutral">
              One connected website could not be reached. Retry if content seems missing.
            </Typography>
          ):null}
          <Stack spacing={1} sx={{maxHeight:"min(50vh, 430px)",overflowY:"auto"}}>
            {(result?.items??[]).map(item=>(
              <Sheet
                key={item.siteId+":"+item.id}
                component="button"
                type="button"
                variant="outlined"
                aria-pressed={selected.includes(item.id)}
                disabled={item.eventStatus==="cancelled" || item.eventStatus==="sold_out"}
                onClick={()=>toggle(item.id)}
                sx={{
                  width:"100%",textAlign:"left",p:1.5,borderRadius:"lg",
                  borderColor:selected.includes(item.id)?"primary.500":"neutral.200",
                  bgcolor:selected.includes(item.id)?"neutral.50":"background.surface",
                  cursor:"pointer",
                  "&:hover":{borderColor:"neutral.400"},
                  "&:focus-visible":{outline:"2px solid var(--joy-palette-primary-400)",outlineOffset:2},
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{width:66,height:66,flexShrink:0,overflow:"hidden",borderRadius:"md",
                    bgcolor:"neutral.100",display:"grid",placeItems:"center"}}>
                    {item.imageUrl?(
                      <Box component="img" src={item.imageUrl} alt=""
                        sx={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    ):<ImageOff size={21} color="var(--joy-palette-neutral-400)" aria-hidden="true"/>}
                  </Box>
                  <Stack spacing={0.4} sx={{minWidth:0,flex:1}}>
                    <Typography level="title-sm">{item.title}</Typography>
                    {item.type==="event" && item.startAt ? <Typography level="body-xs">{(item.upcomingDateCount??0)>1 ? "Multiple dates · " : ""}{eventDateLabel(item)}</Typography> : null}
                    {item.eventStatus==="cancelled" || item.eventStatus==="sold_out" ? <Typography color="danger" level="body-xs">{item.eventStatus==="cancelled" ? "Cancelled" : "Sold out"}</Typography> : null}
                    {item.description?<Typography level="body-xs" color="neutral"
                      sx={{overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                      {item.description}
                    </Typography>:null}
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Link2 size={12} aria-hidden="true"/>
                      <Typography level="body-xs" color="neutral">
                        {item.ctaLabel} · {item.siteName||"Connected website"}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{width:20,height:20,border:"1px solid",borderColor:"neutral.400",
                    borderRadius:"sm",display:"grid",placeItems:"center",flexShrink:0,
                    bgcolor:selected.includes(item.id)?"primary.600":"transparent",
                    color:selected.includes(item.id)?"white":"transparent"}}>
                    ✓
                  </Box>
                </Stack>
              </Sheet>
            ))}
          </Stack>
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton color="neutral" variant="plain" onClick={onClose}>Cancel</JoyButton>
        <JoyButton disabled={loading || selectedItems.length===0} onClick={requestInsert}>
          Insert {selectedItems.length>0?selectedItems.length:""} into newsletter
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
