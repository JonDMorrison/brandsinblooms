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
  const date=campaignDate(item);
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
    },
  };
}
