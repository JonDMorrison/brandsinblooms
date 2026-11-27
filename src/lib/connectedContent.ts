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
  capacityCheckRequired?:boolean;
  /** Product price when the website provides one (e.g. "$24.99"). */
  price?:string|number|null;
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

const SIZE_UNIT = '(?:gal(?:lon)?s?|g|qt|quarts?|l|litres?|liters?|ml|in(?:ch(?:es)?)?|"|cm|mm|pots?|pk|packs?|oz|lbs?|kg)';
const SIZE_SUFFIX = new RegExp(`\\s*(?:[·•|]|\\s[-–—])\\s*#?\\d+(?:[.,/]\\d+)?\\s*${SIZE_UNIT}(?![a-z]).*$`, "i");
const SIZE_PARENS = new RegExp(`\\s*\\(\\s*#?\\d+(?:[.,/]\\d+)?\\s*${SIZE_UNIT}[^)]*\\)\\s*$`, "i");

/** "Hydrangea · 3 Gallon" -> "Hydrangea" (the size stays in the alt text). */
export function stripProductSizeSuffix(title:string){
  const stripped=title.replace(SIZE_SUFFIX,"").replace(SIZE_PARENS,"").trim();
  return stripped||title.trim();
}

/** "A", "A and B", "A, B and C". */
function listNames(names:string[]){
  if(names.length<=1)return names[0]??"";
  return `${names.slice(0,-1).join(", ")} and ${names[names.length-1]}`;
}

/**
 * Empty-state text for a website catalogue: says what was searched and where,
 * e.g. No products match "hydrangea" in Northfield Garden Center's catalogue.
 */
export function catalogNoMatchesMessage({query,kindLabel,siteNames}:{
  query:string;
  /** Plural, lower case: "products", "events", "product photos". */
  kindLabel:string;
  siteNames:string[];
}){
  const names=[...new Set(siteNames.map(name=>name.trim()).filter(Boolean))];
  const where=names.length?`${listNames(names)}'s catalogue`:"your website's catalogue";
  const term=query.trim();
  return term
    ? `No ${kindLabel} match "${term}" in ${where}.`
    : `No published ${kindLabel} were found in ${where}.`;
}

/** Cuts at a word boundary near `max` characters and adds an ellipsis. */
export function truncateAtWord(text:string,max=180){
  const clean=text.replace(/\s+/g," ").trim();
  if(clean.length<=max)return clean;
  const cut=clean.slice(0,max+1);
  const lastSpace=cut.lastIndexOf(" ");
  const base=(lastSpace>max*0.6?cut.slice(0,lastSpace):clean.slice(0,max)).replace(/[\s,;:.\-–—]+$/,"");
  return `${base}…`;
}

function formatPrice(price:ConnectedContentItem["price"]){
  if(price===null||price===undefined||price==="")return "";
  if(typeof price==="number"&&Number.isFinite(price))return `$${price.toFixed(2)}`;
  return String(price).trim().slice(0,30);
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
  const isProduct=item.type==="product";
  const description=isProduct
    ? truncateAtWord(item.description??"",180)
    : item.description?.trim().slice(0,440)??"";
  const price=isProduct?formatPrice(item.price):"";
  return {
    ...block,
    headline:(isProduct?stripProductSizeSuffix(item.title):item.title).slice(0,180),
    subheading:price||date||(item.type==="event"?"Upcoming event":""),
    body:description,
    imageUrl:item.imageUrl? safeUrl(item.imageUrl):"",
    // The full title (with any size) stays in the alt text.
    imageAlt:item.title.slice(0,130),
    // Product headlines never render larger than 28px.
    ...(isProduct
      ? { appearance:{ ...(block.appearance??{}), text:{ ...(block.appearance?.text??{}), heading:{ ...(block.appearance?.text?.heading??{}), size:28 } } } }
      : {}),
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
      sourceTitle:item.title,
      sourceDescription:item.description,
      sourceImageUrl:item.imageUrl,
      upcomingDateCount:item.upcomingDateCount,
      siteName:item.siteName,
    },
  };
}

/** Text drafts use the same stable source contract as newsletter blocks. */
export function buildConnectedContentSms(item: ConnectedContentItem): {
  smsMessage: string;
  source: NonNullable<StudioBlock["connectedContent"]>;
} {
  const publicUrl = safeUrl(item.publicUrl);
  if (!publicUrl) throw new Error("This website content has no secure public link.");
  if (item.eventStatus === "cancelled" || item.eventStatus === "sold_out") {
    throw new Error("This event is not available to promote.");
  }
  const title = item.title.trim().slice(0, 180);
  const date = item.type === "event" ? campaignDate(item) : "";
  const dateLabel = date && (item.upcomingDateCount ?? 0) > 1
    ? `Multiple dates from ${date}` : date;
  return {
    // Keep the complete canonical URL. The existing SMS editor shows segments
    // and lets the owner edit before choosing recipients or sending.
    smsMessage: [title, dateLabel, item.description?.trim().slice(0, 140), publicUrl]
      .filter(Boolean).join("\n"),
    source: {
      siteId: item.siteId, itemId: item.id, type: item.type,
      updatedAt: item.updatedAt, publicUrl, startAt: item.startAt ?? null,
      sourceTitle: item.title, sourceDescription: item.description,
      sourceImageUrl: item.imageUrl, upcomingDateCount: item.upcomingDateCount,
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
      if (item.updatedAt !== source.updatedAt || item.publicUrl !== source.publicUrl || (source.startAt != null && item.startAt !== source.startAt) || (source.sourceTitle !== undefined && item.title !== source.sourceTitle) || (source.sourceDescription !== undefined && item.description !== source.sourceDescription) || (source.sourceImageUrl !== undefined && item.imageUrl !== source.sourceImageUrl) || (source.upcomingDateCount !== undefined && item.upcomingDateCount !== source.upcomingDateCount)) return `${name}: event details changed on your website. Review the newsletter before sending.`;
      if (source.startAt === undefined) return `${name}: check the date on your website before sending.`;
      if (item.capacityCheckRequired) return `${name}: confirm ticket availability on the website before sending.`;
      return null;
    } catch { return `${name}: website could not be checked. Review this event before sending.`; }
  }));
  return results.filter((line): line is string => line !== null);
}

/** Explicit review only: refresh source-owned fields while retaining layout and styling. */
export function refreshConnectedContentBlock(block: StudioBlock, item: ConnectedContentItem): StudioBlock {
  const source = block.connectedContent;
  if (!source || source.siteId !== item.siteId || source.itemId !== item.id || source.type !== item.type) {
    throw new Error("The website returned a different item. Review could not continue.");
  }
  if (item.type === "event" && item.eventStatus !== "available") {
    throw new Error("This event is unavailable or its booking status could not be verified.");
  }
  const { source: refreshedSource } = buildConnectedContentSms(item);
  const formattedDate = campaignDate(item);
  const date = item.type === "event" && (item.upcomingDateCount ?? 0) > 1 && formattedDate
    ? `Multiple dates from ${formattedDate}` : formattedDate;
  return {
    ...block,
    headline: item.title.slice(0, 180),
    subheading: date || (item.type === "event" ? "Upcoming event" : ""),
    body: item.description?.trim().slice(0, 440) ?? "",
    imageUrl: item.imageUrl ? safeUrl(item.imageUrl) : "",
    imageAlt: item.title.slice(0, 130),
    buttonText: (item.ctaLabel || "Learn more").slice(0, 70),
    buttonUrl: refreshedSource.publicUrl,
    connectedContent: refreshedSource,
  };
}
