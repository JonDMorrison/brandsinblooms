import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { buildConnectedContentBlock, reviewConnectedEvents } from "@/lib/connectedContent";
const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mockInvoke } } }));
import type { ConnectedContentItem } from "@/lib/connectedContent";

const design=buildStudioDesignSystem({} as never);
const item:ConnectedContentItem={
  id:"00000000-0000-4000-8000-000000000001",
  siteId:"00000000-0000-4000-8000-000000000002",
  type:"event",
  title:"Autumn Wreath Workshop",
  description:"Create a beautiful wreath.",
  imageUrl:"https://images.example.org/wreath.jpg",
  publicUrl:"https://example.org/events/autumn-wreath",
  ctaLabel:"Get tickets",
  updatedAt:"2026-10-15T20:00:00Z",
  startAt:"2026-11-19T18:00:00Z",
  timezone:"America/Vancouver",
};
describe("Connected Content newsletter blocks",()=>{
  it("reuses an existing image + text block with actionable live URL",()=>{
    const block=buildConnectedContentBlock(item,design);
    expect(block.type).toBe("image-text");
    expect(block.headline).toBe(item.title);
    expect(block.imageUrl).toBe(item.imageUrl);
    expect(block.buttonText).toBe("Get tickets");
    expect(block.buttonUrl).toBe(item.publicUrl);
    expect(block.connectedContent).toEqual({
      siteId:item.siteId,itemId:item.id,type:"event",
      publicUrl:item.publicUrl,updatedAt:item.updatedAt,startAt:item.startAt,
      sourceTitle:item.title,sourceDescription:item.description,sourceImageUrl:item.imageUrl,upcomingDateCount:undefined,
    });
    expect(block.subheading).toContain("Nov");
  });
  it("labels events with multiple future dates",()=>{
    expect(buildConnectedContentBlock({...item,upcomingDateCount:2},design).subheading).toContain("Multiple dates from");
  });
  it("flags cancelled, sold-out, changed and unavailable linked events",async()=>{
    const block=buildConnectedContentBlock(item,design);
    const invoke=mockInvoke;
    invoke.mockReset();
    const response=(event: unknown)=>({data:{connections:[],sources:[],errors:[],items:event?[event]:[]},error:null} as never);
    try {
      for (const [event,warning] of [
        [{...item,eventStatus:"cancelled"},"cancelled"],
        [{...item,eventStatus:"sold_out"},"sold out"],
        [{...item,eventStatus:"available",capacityCheckRequired:true},"confirm ticket availability"],
        [{...item,eventStatus:"available",startAt:"2026-11-20T18:00:00Z"},"changed"],
        [{...item,eventStatus:"available",imageUrl:"https://images.example.org/new.jpg"},"changed"],
        [null,"no longer available"],
      ] as const) {
        invoke.mockResolvedValueOnce(response(event));
        expect((await reviewConnectedEvents([block])).join(" ")).toContain(warning);
      }
      invoke.mockResolvedValueOnce(response({...item,eventStatus:"available"}));
      expect(await reviewConnectedEvents([block])).toEqual([]);
      invoke.mockRejectedValueOnce(new Error("offline"));
      expect((await reviewConnectedEvents([block])).join(" ")).toContain("could not be checked");
    } finally { invoke.mockReset(); }
  });
  it("rejects javascript and other non-public CTA URLs",()=>{
    expect(()=>buildConnectedContentBlock({
      ...item,publicUrl:"javascript:alert(1)",
    },design)).toThrow("secure public link");
    expect(()=>buildConnectedContentBlock({
      ...item,publicUrl:"http://localhost:3000/events/draft",
    },design)).toThrow("secure public link");
  });
  it("does not make a draft campaign send automatically",()=>{
    const page=readFileSync("src/pages/crm/ConnectedContentPage.tsx","utf8");
    expect(page).toContain('status:"draft"');
    expect(page).toContain('sendImmediately:false');
    expect(page).toContain('segments:[],personas:[]');
    expect(page).toContain('includeAllCustomers:false');
    expect(page).not.toContain("sendEmailCampaign(");
  });
  it("sends owners to the BloomSites page that issues the 64-character connection code",()=>{
    const page=readFileSync("src/pages/crm/ConnectedContentPage.tsx","utf8");
    const edge=readFileSync("supabase/functions/connected-content/index.ts","utf8");
    expect(page).toContain("choose Connect BloomSuite CRM");
    expect(page).toContain("https://bloomsites.app/dashboard/integrations/connected-content");
    expect(page).not.toContain("Integrations → Connected Content");
    // The page precheck must match the edge function's accepted code format.
    expect(edge).toContain("const codePattern = /^[0-9a-f]{64}$/;");
    expect(page).toContain("CONNECTED_WEBSITE_CODE_PATTERN=/^[0-9a-f]{64}$/");
  });
  it("requires explicit CRM tenant permissions for every content request",()=>{
    const edge=readFileSync("supabase/functions/connected-content/index.ts","utf8");
    expect(edge).toContain('authed.rpc("get_current_crm_access")');
    expect(edge).toContain('permissions.includes("integrations.manage")');
    expect(edge).toContain('permissions.includes("campaigns.write")');
    expect(edge).toContain('.eq("tenant_id",tenantId)');
    expect(edge).toContain('return ok({error:"site_not_connected"},404)');
    const migration=readFileSync("supabase/migrations/20261016140100_connected_website_content_links.sql","utf8");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("get_current_crm_access()");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE ON public.crm_connected_websites TO service_role");
    const config=readFileSync("supabase/config.toml","utf8");
    expect(config).toMatch(/\[functions\.connected-content\]\s*verify_jwt = true/);
  });
  it("keeps all older block types while enabling published website insertion",()=>{
    const source=readFileSync("src/components/crm/studio/useStudioState.ts","utf8");
    expect(source).toContain("insertConnectedContentBlocks");
    expect(source).toContain('block.type==="footer"');
    const page=readFileSync("src/pages/crm/CampaignStudioPage.tsx","utf8");
    expect(page).toContain("ConnectedContentPicker");
    expect(page).toContain("insertConnectedContentBlocks");
  });
});


// Exercise the same server checker used at enqueue and provider dispatch.
import { checkConnectedContentFreshness, extractConnectedContentSources } from "../../supabase/functions/_shared/connectedContentFreshness";

describe("server publication freshness", () => {
  const tenantId = "00000000-0000-4000-8000-000000000003";
  const source = buildConnectedContentBlock(item, design).connectedContent!;
  function database(links: unknown = [{cms_site_id: item.siteId}], error: unknown = null) {
    const result = Promise.resolve({data: links, error});
    const query = Object.assign(result, {eq: vi.fn(() => query), in: vi.fn(() => query)});
    return {from: vi.fn(() => ({select: vi.fn(() => query)})), query};
  }
  const response = (items: unknown[] = [{...item, eventStatus: "available"}]) =>
    new Response(JSON.stringify({siteId: item.siteId, siteOrigin: "https://example.org", items}));
  it("does not block unrelated campaigns or call the network", async () => {
    const db = database(); const fetcher = vi.fn();
    expect((await checkConnectedContentFreshness(db, tenantId, [], fetcher)).decision).toBe("fresh");
    expect(db.from).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("checks a tenant-scoped active binding and only calls the fixed exact CMS endpoint", async () => {
    const db = database(); const fetcher = vi.fn().mockResolvedValue(response());
    expect((await checkConnectedContentFreshness(db, tenantId, [source, source], fetcher)).decision).toBe("fresh");
    expect(db.query.eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(db.query.eq).toHaveBeenCalledWith("status", "active");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url.origin).toBe("https://bloomsites.app");
    expect(url.searchParams.get("itemId")).toBe(item.id);
    expect(options).toMatchObject({redirect: "error", cache: "no-store"});
  });
  it.each([
    {eventStatus: "cancelled"}, {eventStatus: "sold_out"}, {title: "Changed title"},
    {startAt: "2027-01-01T00:00:00Z"}, {updatedAt: "2026-11-21T00:00:00Z"},
    {publicUrl: "https://example.org/events/changed"},
  ])("requires review when saved source details change: %j", async change => {
    const fetcher = vi.fn().mockResolvedValue(response([{...item,eventStatus:"available",...change}]));
    expect((await checkConnectedContentFreshness(database(),tenantId,[source],fetcher)).decision).toBe("review_required");
  });
  it("requires review for unpublished content and disconnected sites", async () => {
    expect((await checkConnectedContentFreshness(database(),tenantId,[source],vi.fn().mockResolvedValue(response([])))).decision).toBe("review_required");
    const fetcher = vi.fn();
    expect((await checkConnectedContentFreshness(database([]),tenantId,[source],fetcher)).decision).toBe("review_required");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("defers on outages, malformed upstream data and mismatched item scope", async () => {
    for (const value of [new Response("offline",{status:503}),response([{...item,id:tenantId}]),response([{...item,siteId:tenantId}])]) {
      expect((await checkConnectedContentFreshness(database(),tenantId,[source],vi.fn().mockResolvedValue(value))).decision).toBe("retry");
    }
    expect((await checkConnectedContentFreshness(database(),tenantId,[source],vi.fn().mockRejectedValue(new Error("timeout")))).decision).toBe("retry");
    expect((await checkConnectedContentFreshness(database(null,new Error("db")),tenantId,[source],vi.fn())).decision).toBe("retry");
  });
  it.each(["page","blog","product","fundraiser"] as const)("supports a %s without an event date", async type => {
    const current = {...item,type,startAt:undefined};
    const saved = buildConnectedContentBlock(current,design).connectedContent!;
    expect((await checkConnectedContentFreshness(database(),tenantId,[saved],vi.fn().mockResolvedValue(response([current])))).decision).toBe("fresh");
  });
  it("rejects malformed source manifests without network calls", async () => {
    const fetcher = vi.fn();
    for (const bad of [null, {...source,siteId:"bad"}, {...source,publicUrl:"http://localhost/private"}, {...source,type:"constructor"}]) {
      expect((await checkConnectedContentFreshness(database(),tenantId,[bad],fetcher)).decision).toBe("review_required");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("extracts visible email sources and preserves invalid explicit manifests as blockers", () => {
    expect(extractConnectedContentSources({contentBlocks:[{connectedContent:source},{visible:false,connectedContent:source}]})).toEqual([source]);
    expect(extractConnectedContentSources({connectedContentSources:[source]})).toEqual([source]);
    expect(extractConnectedContentSources({connectedContentSources:"broken"})).toEqual([null]);
  });
});
