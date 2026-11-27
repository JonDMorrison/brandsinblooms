import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CRMCampaignsPage } from "../CRMCampaignsPage";
import { fetchCampaignCatalog, type CampaignCatalogItem } from "@/lib/crm/campaignEditor";

vi.mock("@/hooks/useUserRole", () => ({useUserRole: () => ({hasPermission: () => true})}));
vi.mock("@/lib/crm/campaignOrganization", () => ({campaignOrganizationClient:{rpc:vi.fn()},useCampaignOrganization: () => ({data:{groups:[{id:"december",name:"December",colour:"#795548"},{id:"january",name:"January",colour:"#496A51"}],memberships:[{campaign_id:"campaign-test",group_id:"december"}],colours:[]},mutation:{mutate:vi.fn(),isPending:false}})}));
vi.mock("@/hooks/useThisWeeksTheme", () => ({ useThisWeeksTheme: () => ({ data: null }) }));
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
function openList(record: CampaignCatalogItem, cached?: CampaignCatalogItem, path = "/crm/campaigns?status=all", extra: CampaignCatalogItem[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  if (cached) client.setQueryData(["crm-campaign-catalog", "arts-test"], [cached]);
  vi.mocked(fetchCampaignCatalog).mockResolvedValue([record, ...extra]);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/crm/campaigns" element={<CRMCampaignsPage />} />
    <Route path="/crm/campaigns/:id/studio" element={<p>Designer destination</p>} />
    <Route path="/crm/campaigns/:id" element={<p>Settings destination</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
describe("campaign card view", () => {
  it("shows cards with a next step instead of empty columns", async () => {
    openList(campaign({ hasAudience: false, isEmptyDraft: false }));
    expect(await screen.findByText("Next: Choose who gets it")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open November garden news" })).toBeInTheDocument();
    expect(screen.queryByText("Not scheduled")).toBeNull();
  });

  it("hides empty drafts behind one line, and shows them on request", async () => {
    openList(
      campaign({ isEmptyDraft: false, hasAudience: true }),
      undefined,
      "/crm/campaigns?status=all",
      [campaign({ id: "empty-1", name: "", subjectLine: "", isEmptyDraft: true })],
    );
    expect(await screen.findByText(/1 empty draft hidden/)).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show them" }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("always lists a draft with a custom name, even with no subject or content", async () => {
    openList(
      campaign({ isEmptyDraft: false, hasAudience: true }),
      undefined,
      "/crm/campaigns?status=all",
      [
        campaign({ id: "named-empty", name: "Spring plans", subjectLine: "", isEmptyDraft: true }),
        campaign({ id: "empty-1", name: "", subjectLine: "", isEmptyDraft: true }),
      ],
    );
    expect(await screen.findByRole("link", { name: "Open Spring plans" })).toBeInTheDocument();
    expect(screen.getByText(/1 empty draft hidden/)).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("drops the schedule and rate columns from the drafts table", async () => {
    openList(campaign({ isEmptyDraft: false }), undefined, "/crm/campaigns?status=draft&view=table");
    await screen.findAllByRole("button", { name: "November garden news" });
    const header = screen.getByText("Scheduled date").closest("th");
    expect(header).toHaveStyle({ display: "none" });
  });
});
