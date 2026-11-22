import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { buildConnectedContentBlock, buildConnectedContentSms, reviewConnectedEvents } from "@/lib/connectedContent";
import * as React from "react";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import ConnectedContentPage from "@/pages/crm/ConnectedContentPage";
const mockInvoke = vi.hoisted(() => vi.fn());
const pageMocks = vi.hoisted(() => ({save: vi.fn(), navigate: vi.fn()}));
vi.mock("@/lib/crm/campaignEditor", () => ({persistCampaignDraft: pageMocks.save}));
vi.mock("react-router-dom", () => ({useNavigate: () => pageMocks.navigate, useSearchParams: () => [new URLSearchParams("promoteSite=site&promoteId=item")]}));
vi.mock("@/hooks/useUserRole", () => ({useUserRole: () => ({hasPermission: () => true, isLoading: false})}));
vi.mock("@/utils/toast", () => ({toast: {success: vi.fn()}}));
vi.mock("@/contexts/DesignSystemContext", () => ({
  DesignSystemProvider: ({children}: {children: React.ReactNode}) => children,
  useDesignSystem: () => ({designSystem: design}),
}));
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
    mockInvoke.mockReset(); pageMocks.save.mockReset(); pageMocks.navigate.mockReset();
    mockInvoke.mockResolvedValue({data: {connections: [{id: "link", cms_site_id: "site", site_name: "Garden", site_origin: "https://example.org"}], items: [item], sources: [], errors: []}, error: null});
    pageMocks.save.mockResolvedValue({id: "draft-123"});
  });
  afterEach(cleanup);
  it("requires a channel choice then opens a text draft without selecting recipients", async () => {
    render(React.createElement(ConnectedContentPage));
    fireEvent.click(await screen.findByRole("button", {name: "Promote"}));
    expect(pageMocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Create text message draft"}));
    await waitFor(() => expect(pageMocks.navigate).toHaveBeenCalledWith("/crm/campaigns/draft-123/edit"));
    expect(pageMocks.save).toHaveBeenCalledTimes(1);
    expect(pageMocks.save).toHaveBeenCalledWith(expect.objectContaining({
      campaignType: "sms", status: "draft", contentBlocks: [],
      smsMessage: expect.stringContaining(item.publicUrl),
      connectedContentSources: [expect.objectContaining({siteId: item.siteId, itemId: item.id, updatedAt: item.updatedAt})],
      sendAt: null, sendImmediately: false, includeAllCustomers: false,
      segments: [], personas: [], additionalCustomerIds: [],
    }));
  });
  it("keeps newsletter blocks and the existing Studio route", async () => {
    render(React.createElement(ConnectedContentPage));
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
    pageMocks.save.mockReturnValue(new Promise<{id: string}>(resolve => {finish = resolve;}));
    render(React.createElement(ConnectedContentPage));
    fireEvent.click(await screen.findByRole("button", {name: "Promote"}));
    const button = screen.getByRole("button", {name: "Create text message draft"});
    fireEvent.click(button); fireEvent.click(button);
    expect(pageMocks.save).toHaveBeenCalledTimes(1);
    expect(pageMocks.navigate).not.toHaveBeenCalled();
    finish({id: "draft-123"});
    await waitFor(() => expect(pageMocks.navigate).toHaveBeenCalledWith("/crm/campaigns/draft-123/edit"));
  });
  it("closing the channel choice creates nothing", async () => {
    render(React.createElement(ConnectedContentPage));
    fireEvent.click(await screen.findByRole("button", {name: "Promote"}));
    fireEvent.click(screen.getByRole("button", {name: "Close dialog"}));
    expect(pageMocks.save).not.toHaveBeenCalled();
  });
});
