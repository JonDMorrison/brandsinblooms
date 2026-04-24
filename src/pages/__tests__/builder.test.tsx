import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, describe, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { CRMAutomationBuilder } from "../crm/CRMAutomationBuilder";

const mockToast = vi.fn();
const mockCanvas = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/usePersonaSegmentIntegration", () => ({
  usePersonaSegmentIntegration: () => ({
    loadAutomationTargeting: vi.fn(),
    saveAutomationTargeting: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(),
      update: vi.fn(),
    })),
  },
}));

vi.mock("@/components/automation/flow/AutomationFlowCanvas", () => ({
  AutomationFlowCanvas: (props: Record<string, unknown>) => {
    mockCanvas(props);
    return <div data-testid="automation-flow-canvas" />;
  },
}));

describe("CRMAutomationBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
    mockCanvas.mockClear();
  });

  it("renders the premium command bar with builder actions", () => {
    render(
      <MemoryRouter>
        <CRMAutomationBuilder />
      </MemoryRouter>,
    );

    expect(screen.getByText("Back to automations")).toBeVisible();
    expect(screen.getByText("New Automation")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Test" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Activate" })).toBeVisible();
    expect(screen.getByText("Executions →")).toBeVisible();
    expect(screen.getByTestId("automation-flow-canvas")).toBeVisible();
    expect(mockCanvas).toHaveBeenCalled();
  });

  it("updates the builder title through inline editing", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CRMAutomationBuilder />
      </MemoryRouter>,
    );

    await user.click(screen.getByText("New Automation"));

    const input = screen.getByDisplayValue("New Automation");
    await user.clear(input);
    await user.type(input, "VIP Winback Series");
    await user.tab();

    expect(screen.getByText("VIP Winback Series")).toBeVisible();
    expect(mockCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({ automationName: "VIP Winback Series" }),
    );
  });
});
