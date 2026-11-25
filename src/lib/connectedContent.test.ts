import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { buildConnectedContentBlock, buildConnectedContentSms, reviewConnectedEvents } from "@/lib/connectedContent";
import * as React from "react";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import ConnectedContentPage from "@/pages/crm/ConnectedContentPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The page reads the site's custom domain with React Query.
const renderPage = () =>
  render(
    React.createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      React.createElement(ConnectedContentPage),
    ),
  );
const mockInvoke = vi.hoisted(() => vi.fn());
const persistenceMocks = vi.hoisted(() => ({row: {} as Record<string, unknown>, update: vi.fn(), remove: vi.fn()}));
const pageMocks = vi.hoisted(() => ({save: vi.fn(), saveSms: vi.fn(), params: "", navigate: vi.fn()}));
vi.mock("@/lib/sms/campaignDraft", () => ({saveConnectedSmsDraft: pageMocks.saveSms}));
vi.mock("@/hooks/useTenant", () => ({useTenant: () => ({tenant: {id: "tenant-123"}})}));
vi.mock("@/lib/crm/campaignEditor", () => ({persistCampaignDraft: pageMocks.save}));
vi.mock("react-router-dom", () => ({useNavigate: () => pageMocks.navigate, useSearchParams: () => [new URLSearchParams(pageMocks.params)]}));
vi.mock("@/hooks/useUserRole", () => ({useUserRole: () => ({hasPermission: () => true, isLoading: false})}));
vi.mock("@/utils/toast", () => ({toast: {success: vi.fn()}}));
vi.mock("@/contexts/DesignSystemContext", () => ({
  DesignSystemProvider: ({children}: {children: React.ReactNode}) => children,
  useDesignSystem: () => ({designSystem: design}),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: mockInvoke },
  auth: {getUser: async () => ({data: {user: {id: "writer"}}})},
  rpc: async () => ({data: true, error: null}),
  from: (table: string) => {
    const chain = {select: () => chain, eq: () => chain,
      update: persistenceMocks.update, delete: persistenceMocks.remove,
      maybeSingle: async () => ({data: table === "crm_campaigns" ? persistenceMocks.row : null, error: null})};
    return chain;
  },
} }));
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
    expect(page).toContain("choose Connect BloomSites and BloomSuite");
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
    // Website content never adds a footer and never lands below it (#17).
    expect(source).toContain('block.type !== "footer"');
    expect(source).toContain("placeInsertedBlocks");
    const page=readFileSync("src/pages/crm/CampaignStudioPage.tsx","utf8");
    expect(page).toContain("ConnectedContentPicker");
    expect(page).toContain("insertConnectedContentBlocks");
  });
});

describe("Connected Content text drafts", () => {
  it("keeps the canonical link and source version with readable event details", () => {
    const draft = buildConnectedContentSms({...item, upcomingDateCount: 2});
    expect(draft.smsMessage).toContain(item.title);
    expect(draft.smsMessage).toContain("Multiple dates from Nov 19, 2026");
    expect(draft.smsMessage).toContain(item.description);
    expect(draft.smsMessage.endsWith(item.publicUrl)).toBe(true);
    expect(draft.source).toEqual(buildConnectedContentBlock({...item, upcomingDateCount: 2}, design).connectedContent);
  });
  it("handles every content kind without inventing dates or truncating links", () => {
    for (const type of ["page", "product", "blog", "fundraiser"] as const) {
      const publicUrl = `https://example.org/${type}/${"long".repeat(120)}?source=website`;
      const draft = buildConnectedContentSms({...item, type, publicUrl, description: "d".repeat(500)});
      expect(draft.smsMessage).not.toContain("Nov 19");
      expect(draft.smsMessage).toContain("d".repeat(140));
      expect(draft.smsMessage).not.toContain("d".repeat(141));
      expect(draft.smsMessage.endsWith(publicUrl)).toBe(true);
    }
  });
  it("rejects unavailable events and unsafe links before saving", () => {
    for (const eventStatus of ["cancelled", "sold_out"] as const) {
      expect(() => buildConnectedContentSms({...item, eventStatus})).toThrow("not available");
    }
    expect(() => buildConnectedContentSms({...item, publicUrl: "javascript:alert(1)"})).toThrow("secure public link");
  });
});

describe("Promote channel choice", () => {
  beforeEach(() => {
    pageMocks.params=""; mockInvoke.mockReset(); pageMocks.save.mockReset(); pageMocks.saveSms.mockReset(); pageMocks.navigate.mockReset();
    mockInvoke.mockResolvedValue({data: {connections: [{id: "link", cms_site_id: "site", site_name: "Garden", site_origin: "https://example.org"}], items: [item], sources: [], errors: []}, error: null});
    pageMocks.save.mockResolvedValue({id: "draft-123"}); pageMocks.saveSms.mockResolvedValue({id: "draft-123"});
  });
  afterEach(cleanup);
  it("requires a channel choice then opens a text draft without selecting recipients", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name: "Promote"}));
    expect(pageMocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Create text message draft"}));
    await waitFor(() => expect(pageMocks.navigate).toHaveBeenCalledWith("/sms/new?draftId=draft-123"));
    expect(pageMocks.saveSms).toHaveBeenCalledTimes(1);
    expect(pageMocks.save).not.toHaveBeenCalled();
    expect(pageMocks.saveSms).toHaveBeenCalledWith({
      tenantId: "tenant-123", name: `Promote ${item.title}`,
      message: expect.stringContaining(item.publicUrl),
      sources: [expect.objectContaining({siteId: item.siteId, itemId: item.id, updatedAt: item.updatedAt})],
    });
  });
  it("opens the channel chooser from an exact CMS event deep link without creating anything", async () => {
    pageMocks.params=`promoteSite=${item.siteId}&promoteId=${item.id}`;
    renderPage();
    expect(await screen.findByRole("button", {name: "Create text message draft"})).toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith("connected-content", {body: expect.objectContaining({itemId: item.id, siteId: item.siteId, type: "events"})});
    expect(pageMocks.save).not.toHaveBeenCalled(); expect(pageMocks.saveSms).not.toHaveBeenCalled();
  });
  it("keeps newsletter blocks and the existing Studio route", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name: "Promote"}));
    fireEvent.click(screen.getByRole("button", {name: "Create email newsletter draft"}));
    await waitFor(() => expect(pageMocks.navigate).toHaveBeenCalledWith("/crm/campaigns/draft-123/studio"));
    expect(pageMocks.save).toHaveBeenCalledWith(expect.objectContaining({
      campaignType: "email", smsMessage: "", status: "draft",
      contentBlocks: expect.arrayContaining([expect.objectContaining({type: "image-text", buttonUrl: item.publicUrl}),expect.objectContaining({type: "footer"})]),
    }));
  });
  it("does not create another draft while the first save is pending", async () => {
    let finish!: (value: {id: string}) => void;
    pageMocks.saveSms.mockReturnValue(new Promise<{id: string}>(resolve => {finish = resolve;}));
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name: "Promote"}));
    const button = screen.getByRole("button", {name: "Create text message draft"});
    fireEvent.click(button); fireEvent.click(button);
    expect(pageMocks.saveSms).toHaveBeenCalledTimes(1);
    expect(pageMocks.navigate).not.toHaveBeenCalled();
    finish({id: "draft-123"});
    await waitFor(() => expect(pageMocks.navigate).toHaveBeenCalledWith("/sms/new?draftId=draft-123"));
  });
  it("closing the channel choice creates nothing", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name: "Promote"}));
    fireEvent.click(screen.getByRole("button", {name: "Close dialog"}));
    expect(pageMocks.save).not.toHaveBeenCalled();
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


describe("authenticated exact content bridge", () => {
  it("supports every concrete content type and rejects all or a foreign site", async () => {
    const ts = await import("typescript");
    const source = readFileSync("supabase/functions/connected-content/index.ts", "utf8")
      .replace(/^import .*;$/gm, "");
    let handler: (request: Request) => Promise<Response> = async () => new Response(null, {status: 500});
    const tenantId = "00000000-0000-4000-8000-000000000003";
    const links = [{cms_site_id: item.siteId, site_name: "Garden", tenant_id: tenantId}];
    const originUpdates: unknown[] = [];
    const client = {
      auth: {getUser: async () => ({data: {user: {id: "owner"}}, error: null})},
      rpc: async () => ({data: {tenantId, permissions: ["campaigns.write"]}, error: null}),
      from: () => {
        const chain = {select: () => chain, eq: () => chain, order: () => chain,
          update: (value: unknown) => {originUpdates.push(value); return chain;},
          limit: async () => ({data: links, error: null})};
        return chain;
      },
    };
    const fetcher = vi.fn(async (url: URL) => Response.json({siteId: item.siteId,
      siteOrigin: "https://example.org", items: [{...item, type: ({events:"event",pages:"page",products:"product",blogs:"blog",fundraisers:"fundraiser"} as Record<string,string>)[url.searchParams.get("type")!]}]}));
    const js = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
    new Function("serve", "createClient", "Deno", "fetch", js)(
      (value: typeof handler) => {handler = value;}, () => client,
      {env: {get: (key: string) => key === "SUPABASE_SERVICE_ROLE_KEY" ? "service" : "configured"}}, fetcher);
    for (const kind of ["events", "pages", "products", "blogs", "fundraisers", "all"]) {
      const result = await handler(new Request("https://crm.example/connected-content", {
        method: "POST", headers: {Authorization: "Bearer owner", "Content-Type": "application/json"},
        body: JSON.stringify({action: "catalog", siteId: item.siteId, itemId: item.id, type: kind}),
      }));
      expect(result.status).toBe(kind === "all" ? 400 : 200);
      if (kind !== "all") expect((await result.json()).items).toHaveLength(1);
    }
    const result = await handler(new Request("https://crm.example/connected-content", {
      method: "POST", headers: {Authorization: "Bearer owner", "Content-Type": "application/json"},
      body: JSON.stringify({action:"catalog",siteId:tenantId,itemId:item.id,type:"pages"}),
    }));
    expect(result.status).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(5);
    // The link had no stored origin, so BloomSites' current one is saved.
    expect(originUpdates).toContainEqual({site_origin: "https://example.org"});
  });
});

import {isCampaignContentLocked, persistCampaignRecord} from "@/lib/crm/campaignDraftPersistence";
describe("held campaign persistence", () => {
  it("rejects authoritative review and replacement records before any campaign or block write", async () => {
    const input = {tenantId:"tenant-123", campaignId:"old", campaignType:"email" as const,
      name:"Old", subjectLine:"Subject", preheaderText:"", senderName:"Garden", senderEmail:"garden@example.org", replyTo:"garden@example.org", contentBlocks:[], smsMessage:""};
    for (const row of [
      {send_blocked_reason:"connected_content_review", metadata:{}},
      {send_blocked_reason:null, metadata:{contentReviewReplacementId:"new"}},
    ]) {
      persistenceMocks.row = {id:"old",tenant_id:"tenant-123",status:"paused", ...row};
      persistenceMocks.update.mockClear(); persistenceMocks.remove.mockClear();
      await expect(persistCampaignRecord(input)).rejects.toThrow("locked for website content review");
      expect(persistenceMocks.update).not.toHaveBeenCalled();
      expect(persistenceMocks.remove).not.toHaveBeenCalled();
    }
    expect(isCampaignContentLocked({sendBlockedReason:null,metadata:{contentReviewOriginalId:"old"}})).toBe(false);
  });
  it("routes held Studio records before loading editable state", () => {
    const studio = readFileSync("src/pages/crm/CampaignStudioPage.tsx","utf8");
    expect(studio.indexOf("if (isCampaignContentLocked(record))")).toBeLessThan(studio.indexOf("const snapshot = toStudioSnapshot(record)"));
    expect(studio).toContain("navigate(editorPath, {replace: true})");
  });
});

import { stripProductSizeSuffix, truncateAtWord } from "./connectedContent";

describe("inserted product content (#18)", () => {
  it("strips size suffixes from product headlines", () => {
    expect(stripProductSizeSuffix("Hydrangea · 3 Gallon")).toBe("Hydrangea");
    expect(stripProductSizeSuffix("Boxwood - 1 gal")).toBe("Boxwood");
    expect(stripProductSizeSuffix('Fern (4" pot)')).toBe("Fern");
    expect(stripProductSizeSuffix("Rose Bush")).toBe("Rose Bush");
    expect(stripProductSizeSuffix("3 Gallon Mix")).toBe("3 Gallon Mix");
  });
  it("truncates descriptions at a word boundary with an ellipsis", () => {
    const long = "Bright, long-flowering perennial ".repeat(10);
    const out = truncateAtWord(long, 180);
    expect(out.length).toBeLessThanOrEqual(181);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, -1)).not.toMatch(/\s$/);
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
    expect(truncateAtWord("Short text", 180)).toBe("Short text");
  });
});

describe("product block from the website (#18)", () => {
  it("cleans the headline, keeps the size in alt text, adds the price and caps the heading at 28px", async () => {
    const { renderNewsletterBlock } = await import("@/lib/studio/emailHtmlGenerator");
    const block = buildConnectedContentBlock({
      id: "p1", siteId: "s1", siteName: "Northfield Gardens", type: "product",
      title: "Limelight Hydrangea · 3 Gallon",
      description: "A tough, reliable panicle hydrangea with lime-green blooms that age to pink. ".repeat(4),
      imageUrl: "https://example.org/h.jpg", publicUrl: "https://example.org/p/h", ctaLabel: "Shop now",
      updatedAt: "2026-11-01T00:00:00Z", price: "$39.99",
    }, buildStudioDesignSystem({} as never));
    expect(block.headline).toBe("Limelight Hydrangea");
    expect(block.imageAlt).toBe("Limelight Hydrangea · 3 Gallon");
    expect(block.subheading).toBe("$39.99");
    expect((block.body ?? "").length).toBeLessThanOrEqual(181);
    expect(block.body?.endsWith("…")).toBe(true);
    const html = renderNewsletterBlock(block);
    const size = Number(/data-newsletter-role="heading"[^>]*font-size:(\d+)px/.exec(html)?.[1]);
    expect(size).toBeLessThanOrEqual(28);
  });
});
