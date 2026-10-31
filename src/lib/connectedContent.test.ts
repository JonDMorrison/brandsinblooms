import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { buildConnectedContentBlock, reviewConnectedEvents } from "@/lib/connectedContent";
import { supabase } from "@/integrations/supabase/client";
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
    });
    expect(block.subheading).toContain("Nov");
  });
  it("labels events with multiple future dates",()=>{
    expect(buildConnectedContentBlock({...item,upcomingDateCount:2},design).subheading).toContain("Multiple dates from");
  });
  it("flags cancelled, sold-out, changed and unavailable linked events",async()=>{
    const block=buildConnectedContentBlock(item,design);
    const invoke=vi.spyOn(supabase.functions,"invoke");
    const response=(event: unknown)=>({data:{connections:[],sources:[],errors:[],items:event?[event]:[]},error:null} as never);
    try {
      for (const [event,warning] of [
        [{...item,eventStatus:"cancelled"},"cancelled"],
        [{...item,eventStatus:"sold_out"},"sold out"],
        [{...item,eventStatus:"available",startAt:"2026-11-20T18:00:00Z"},"changed"],
        [null,"no longer available"],
      ] as const) {
        invoke.mockResolvedValueOnce(response(event));
        expect((await reviewConnectedEvents([block])).join(" ")).toContain(warning);
      }
      invoke.mockResolvedValueOnce(response({...item,eventStatus:"available"}));
      expect(await reviewConnectedEvents([block])).toEqual([]);
      invoke.mockRejectedValueOnce(new Error("offline"));
      expect((await reviewConnectedEvents([block])).join(" ")).toContain("could not be checked");
    } finally { invoke.mockRestore(); }
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
