import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestQueryClientProvider } from "@/test/TestQueryClientProvider";
import type { DomainStats } from "@/hooks/useDomainStats";

// /admin/search ("Find a client") crashed with "Sheet is not defined" once the
// domain reputation table had rows (qa2 #5).
const domain: DomainStats = {
  domain_id: "d1",
  domain_name: "northfieldgardens.ca",
  tenant_id: "t1",
  verification_status: "active",
  emails_sent_30d: 120,
  emails_delivered_30d: 118,
  emails_opened_30d: 50,
  emails_clicked_30d: 9,
  emails_bounced_30d: 2,
  emails_complained_30d: 0,
  open_rate_30d: 42.4,
  click_rate_30d: 7.6,
  bounce_rate_30d: 1.7,
  complaint_rate_30d: 0,
};

vi.mock("@/hooks/useIsSuperAdmin", () => ({
  useIsSuperAdmin: () => ({ data: true, isLoading: false }),
}));
vi.mock("@/hooks/useDomainStats", () => ({
  useDomainStats: () => ({ data: [domain], isLoading: false, error: null }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// The app-wide AdminProvider (main.tsx) owns the tab's admin company.
vi.mock("@/contexts/AdminContext", () => ({
  useAdmin: () => ({ setActiveTenantId: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: null }) })),
  },
}));

import AdminDashboard from "@/pages/admin/AdminDashboard";

describe("Find a client (/admin/search)", () => {
  it("renders with a sending domain in the reputation table", () => {
    render(
      <TestQueryClientProvider>
        <AdminDashboard />
      </TestQueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Find a client" })).toBeInTheDocument();
    expect(screen.getAllByText("northfieldgardens.ca").length).toBeGreaterThan(0);
  });
});
