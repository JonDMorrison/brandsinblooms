import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CRMAutomationBuilder } from "@/pages/crm/CRMAutomationBuilder";
import { TestQueryClientProvider } from "@/test/TestQueryClientProvider";

const { canvasProps } = vi.hoisted(() => ({ canvasProps: vi.fn() }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "test-tenant" } }),
}));
vi.mock("@/hooks/usePersonaSegmentIntegration", () => ({
  usePersonaSegmentIntegration: () => ({
    loadAutomationTargeting: vi.fn().mockResolvedValue({
      personas: [],
      segments: [],
    }),
    saveAutomationTargeting: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { tenant_id: "test-tenant" },
            error: null,
          }),
        })),
      })),
    })),
  },
}));
vi.mock("@/components/automation/flow/AutomationFlowCanvas", () => ({
  AutomationFlowCanvas: (props: unknown) => {
    canvasProps(props);
    return <div data-testid="automation-flow-canvas">Automation canvas</div>;
  },
}));

function renderBuilder() {
  return render(
    <TestQueryClientProvider>
      <MemoryRouter>
        <CRMAutomationBuilder />
      </MemoryRouter>
    </TestQueryClientProvider>,
  );
}

describe("CRMAutomationBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the current visual automation builder", () => {
    renderBuilder();

    expect(screen.getByText("New Automation")).toBeInTheDocument();
    expect(screen.getByTestId("automation-flow-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Test" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled();
  });

  it("links back to the automation list", () => {
    renderBuilder();

    expect(
      screen.getByRole("link", { name: /back to automations/i }),
    ).toHaveAttribute("href", "/crm/automations");
  });

  it("passes the tenant and empty workflow into the canvas", async () => {
    renderBuilder();

    await vi.waitFor(() =>
      expect(canvasProps).toHaveBeenCalledWith(
        expect.objectContaining({
          automationName: "New Automation",
          initialFlowState: { nodes: [], edges: [] },
          tenantId: "test-tenant",
        }),
      ),
    );
  });
});
