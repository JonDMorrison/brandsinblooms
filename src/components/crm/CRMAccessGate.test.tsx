import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUserRole } from "@/hooks/useUserRole";
import { CRMAccessGate } from "./CRMAccessGate";

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: vi.fn() }));

const mockedUseUserRole = vi.mocked(useUserRole);

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/crm/automations"]}>
      <Routes>
        <Route
          path="/crm/automations"
          element={
            <CRMAccessGate requiredPermission="automations.manage">
              <div>Automation builder</div>
            </CRMAccessGate>
          }
        />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CRMAccessGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("waits for canonical access before rendering protected content", () => {
    mockedUseUserRole.mockReturnValue({
      role: null,
      hasPermission: vi.fn(() => false),
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useUserRole>);

    renderGate();
    expect(
      screen.getByRole("status", { name: "Checking workspace access" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Automation builder")).not.toBeInTheDocument();
  });

  it("renders content only when the required permission is present", () => {
    mockedUseUserRole.mockReturnValue({
      role: "marketing",
      hasPermission: vi.fn((permission) =>
        permission === "automations.manage"),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useUserRole>);

    renderGate();
    expect(screen.getByText("Automation builder")).toBeInTheDocument();
  });

  it("redirects a signed-in role that lacks the required permission", () => {
    mockedUseUserRole.mockReturnValue({
      role: "staff",
      hasPermission: vi.fn(() => false),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useUserRole>);

    renderGate();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Automation builder")).not.toBeInTheDocument();
  });
});
