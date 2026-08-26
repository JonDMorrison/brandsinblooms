import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  hasPersistedAuthState: () => false,
}));

vi.mock("@/components/OnboardingGuard", () => ({
  OnboardingGuard: ({ children }: { children: React.ReactNode }) => children,
}));

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    } as ReturnType<typeof useAuth>);
  });

  it("preserves the Lightspeed partner connect link through sign-in", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/integrations/lightspeed/connect?source=lightspeed-app-store",
        ]}
      >
        <Routes>
          <Route
            path="/integrations/lightspeed/connect"
            element={
              <ProtectedRoute>
                <div>Connect</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/auth?returnTo=%2Fintegrations%2Flightspeed%2Fconnect%3Fsource%3Dlightspeed-app-store",
    );
  });

  it("does not preserve arbitrary protected destinations", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <div>Settings</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/auth");
    expect(screen.getByTestId("location")).not.toHaveTextContent("returnTo");
  });
});
