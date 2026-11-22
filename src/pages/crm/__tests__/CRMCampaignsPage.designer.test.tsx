import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CRMCampaignsPage } from "../CRMCampaignsPage";
import { fetchCampaignCatalog, type CampaignCatalogItem } from "@/lib/crm/campaignEditor";

vi.mock("@/hooks/useUserRole", () => ({useUserRole: () => ({hasPermission: () => true})}));
vi.mock("@/lib/crm/campaignOrganization", () => ({campaignOrganizationClient:{rpc:vi.fn()},useCampaignOrganization: () => ({data:{groups:[{id:"december",name:"December",colour:"#795548"},{id:"january",name:"January",colour:"#496A51"}],memberships:[{campaign_id:"campaign-test",group_id:"december"}],colours:[]},mutation:{mutate:vi.fn(),isPending:false}})}));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenant: { id: "arts-test" }, loading: false }) }));
vi.mock("@/hooks/useCampaignCloning", () => ({ useCampaignCloning: () => ({ cloneCampaign: vi.fn(), isCloning: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn(),
} }));
vi.mock("@/lib/crm/campaignEditor", async (original) => ({
  ...await original<typeof import("@/lib/crm/campaignEditor")>(), fetchCampaignCatalog: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const campaign = (patch: Partial<CampaignCatalogItem> = {}) => ({
  id: "campaign-test", name: "November garden news", subjectLine: "Fresh winter plants",
  preheaderText: "", channel: "email", status: "draft", totalRecipients: 20,
  projectedRecipientCount: 20, messagesSent: 0, messagesFailed: 0,
  messagesSkipped: 0, totalOpens: 0, totalClicks: 0, openRate: 0, clickRate: 0,
  updatedAt: "2026-11-20T12:00:00Z", ...patch,
}) as CampaignCatalogItem;
function openList(record: CampaignCatalogItem, cached?: CampaignCatalogItem) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  if (cached) client.setQueryData(["crm-campaign-catalog", "arts-test"], [cached]);
  vi.mocked(fetchCampaignCatalog).mockResolvedValue([record]);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/crm/campaigns?status=all"]}><Routes>
    <Route path="/crm/campaigns" element={<CRMCampaignsPage />} />
    <Route path="/crm/campaigns/:id/studio" element={<p>Designer destination</p>} />
    <Route path="/crm/campaigns/:id" element={<p>Settings destination</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
describe("campaign list designer access and names", () => {
  it("refreshes a cached campaign name and opens its designer without settings", async () => {
    const record = campaign({ name: "Renamed winter newsletter" });
    openList(record, campaign({ name: "Old name" }));
    await waitFor(() => expect(screen.getAllByText(record.name).length).toBeGreaterThan(0));
    expect(screen.queryByText("Old name")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: `Actions for ${record.name}` })[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Open designer" }));
    expect(screen.getByText("Designer destination")).toBeInTheDocument();
    expect(screen.queryByText("Settings destination")).toBeNull();
  });
  it("filters groups and opens quick editing without navigating away",async()=>{
    openList(campaign());
    const name=await screen.findByRole("button",{name:"November garden news"});
    fireEvent.click(name);
    expect(screen.getByRole("dialog")).toHaveTextContent("Edit campaign name");
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    fireEvent.change(screen.getByLabelText("Group"),{target:{value:"january"}});
    expect(screen.queryByRole("button",{name:"November garden news"})).toBeNull();
    fireEvent.change(screen.getByLabelText("Group"),{target:{value:"december"}});
    expect(screen.getByRole("button",{name:"November garden news"})).toBeVisible();
  });
  it.each([
    ["newsletter", "scheduled", true], ["sms", "draft", false],
    ["email", "sending", false], ["email", "sent", false], ["email", "paused", false],
  ] as const)("offers the shortcut appropriately for %s %s", async (channel, status, available) => {
    const record = campaign({ channel, status });
    openList(record);
    const buttons = await screen.findAllByRole("button", { name: `Actions for ${record.name}` });
    fireEvent.click(buttons[0]);
    expect(Boolean(screen.queryByRole("menuitem", { name: "Open designer" }))).toBe(available);
  });
});
