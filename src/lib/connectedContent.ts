import { supabase } from "@/integrations/supabase/client";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

export type ConnectedContentKind = "event"|"page"|"product"|"blog"|"fundraiser";
export interface ConnectedContentItem {
  id:string;
  siteId:string;
  siteName?:string;
  type:ConnectedContentKind;
  title:string;
  description:string;
  imageUrl:string|null;
  publicUrl:string;
  ctaLabel:string;
  updatedAt:string;
  startAt?:string|null;
  endAt?:string|null;
  timezone?:string|null;
  location?:string|null;
  eventStatus?:"cancelled"|"sold_out"|"available";
  upcomingDateCount?:number;
}
export interface ConnectedWebsite {
  id:string;
  cms_site_id:string;
  site_name:string;
  site_origin:string;
  status:"active"|"disconnected";
  linked_at:string;
}
export type ConnectedContentResponse = {
  connections: ConnectedWebsite[];
  items:ConnectedContentItem[];
  sources: Array<{siteId:string;siteName?:string;hasMore?:boolean;error?:string}>;
  errors:Array<{siteId:string;error:string}>;
};
const safeUrl=(value:string)=>{
  try {const url=new URL(value);return url.protocol==="https:"?url.toString():"";}catch{return "";}
};

export async function connectedContentRequest<T>(input:Record<string,unknown>):Promise<T> {
  // Body is sent only to our authenticated CRM Edge Function.
  const {data,error}=await supabase.functions.invoke("connected-content",{
    body:input,
  });
  if(error)throw new Error("Connected Content is unavailable. Please try again.");
  if(!data||typeof data!=="object"||"error" in data) {
    const failure=typeof data?.error==="string"?data.error:"service_unavailable";
    throw new Error(failure.replaceAll("_"," "));
  }
  return data as T;
}

function campaignDate(item:ConnectedContentItem) {
  if(!item.startAt)return "";
  const time=new Date(item.startAt);
  if(Number.isNaN(time.getTime()))return "";
  try{
    return new Intl.DateTimeFormat("en-US",{
      month:"short",day:"numeric",year:"numeric",
      timeZone:item.timezone||"UTC",
    }).format(time);
  }catch{return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(time);}
}

/**
 * Reuses the existing email-safe image+text block; no parallel renderer.
 * The provenance field travels with the draft for later freshness reviews.
 */
export function buildConnectedContentBlock(
  item: ConnectedContentItem,
  designSystem: StudioDesignSystem,
): StudioBlock {
  const link=safeUrl(item.publicUrl);
  if(!link)throw new Error("This website content has no secure public link.");
  const block=createStudioBlock("image-text",designSystem);
  const formattedDate=campaignDate(item);
  const date=item.type==="event" && (item.upcomingDateCount??0)>1 && formattedDate ? `Multiple dates from ${formattedDate}` : formattedDate;
  const description=item.description?.trim().slice(0,440)??"";
  return {
    ...block,
    headline:item.title.slice(0,180),
    subheading:date||(item.type==="event"?"Upcoming event":""),
    body:description,
    imageUrl:item.imageUrl? safeUrl(item.imageUrl):"",
    imageAlt:item.title.slice(0,130),
    buttonText:(item.ctaLabel||"Learn more").slice(0,70),
    buttonUrl:link,
    // Preserve the source so the owner can see what their campaign promotes.
    connectedContent:{
      siteId:item.siteId,
      itemId:item.id,
      type:item.type,
      updatedAt:item.updatedAt,
      publicUrl:link,
      startAt:item.startAt??null,
    },
  };
}

/** Check source events on opening send review. Draft content is never overwritten. */
export async function reviewConnectedEvents(blocks: StudioBlock[]): Promise<string[]> {
  const events = blocks.filter(block => block.visible !== false && block.connectedContent?.type === "event");
  if (events.length > 50) return ["Too many linked events to check automatically. Review your website event details before sending."];
  const results = await Promise.all(events.map(async block => {
    const source = block.connectedContent!;
    const name = block.headline?.trim() || "Linked event";
    try {
      const response = await connectedContentRequest<ConnectedContentResponse>({ action:"catalog", type:"events", siteId:source.siteId, itemId:source.itemId, limit:1 });
      if (response.sources?.some(entry => entry.error)) return `${name}: website could not be checked. Review this event before sending.`;
      const item = response.items?.find(entry => entry.id === source.itemId && entry.siteId === source.siteId);
      if (!item) return `${name}: this event is no longer available on your website. Review it before sending.`;
      if (item.eventStatus === "cancelled") return `${name}: this event is cancelled on your website.`;
      if (item.eventStatus === "sold_out") return `${name}: this event is marked sold out on your website.`;
      if (!item.eventStatus) return `${name}: booking status could not be checked. Review the event before sending.`;
      if (item.updatedAt !== source.updatedAt || item.publicUrl !== source.publicUrl || (source.startAt != null && item.startAt !== source.startAt)) return `${name}: event details changed on your website. Review the newsletter before sending.`;
      if (source.startAt === undefined) return `${name}: check the date on your website before sending.`;
      return null;
    } catch { return `${name}: website could not be checked. Review this event before sending.`; }
  }));
  return results.filter((line): line is string => line !== null);
}
