import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DashboardShell,
  resolveAdminDashboardContentWidth,
} from "@/components/layout/DashboardShell";

const { signOutCompletelyMock } = vi.hoisted(() => ({
  signOutCompletelyMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    loading: false,
    user: {
      email: "admin@bloomsuite.app",
      user_metadata: { full_name: "Admin User" },
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  signOutCompletely: signOutCompletelyMock,
}));

vi.mock("@/hooks/useIsSuperAdmin", () => ({
  useIsSuperAdmin: () => ({
    data: true,
    isLoading: false,
  }),
}));

vi.mock("@/components/TrialBanner", () => ({
  TrialBanner: () => <div data-testid="trial-banner">Trial banner</div>,
}));

vi.mock("@/components/location/LocationBlockingBanner", () => ({
  LocationBlockingBanner: () => (
    <div data-testid="location-blocking-banner">Location blocking banner</div>
  ),
}));

vi.mock("@/components/reportProblem/ReportProblemDialog", () => ({
  ReportProblemDialog: ({ open }: { open: boolean }) =>
    open ? (
      <div data-testid="report-problem-dialog">Report a Problem Dialog</div>
    ) : null,
}));

vi.mock("@/hooks/useLocationBlockingGuard", () => ({
  useLocationBlockingGuard: () => ({
    isBlocked: false,
    isLoading: false,
  }),
}));

const scrollToMock = vi.fn();

const buildMatchMedia = (viewportWidth: number) => (query: string) => {
  const isMobile = viewportWidth <= 767.95;
  const isTablet = viewportWidth >= 768 && viewportWidth <= 1023.95;
  const matches =
    query === "(max-width: 767.95px)"
      ? isMobile
      : query === "(min-width: 768px) and (max-width: 1023.95px)"
        ? isTablet
        : false;

  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
};

const setViewportWidth = (viewportWidth: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: viewportWidth,
    writable: true,
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(buildMatchMedia(viewportWidth)),
    writable: true,
  });
};

function AdminLayout() {
  const location = useLocation();

  return (
    <DashboardShell
      contentWidth={resolveAdminDashboardContentWidth(location.pathname)}
    >
      <Outlet />
    </DashboardShell>
  );
}

function AdminHubPage() {
  return <div>Admin hub page</div>;
}

function AdminReportsPage() {
  return <div>Admin reports page</div>;
}

function renderShell(initialPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHubPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToMock,
    writable: true,
  });
});

beforeEach(() => {
  scrollToMock.mockClear();
  signOutCompletelyMock.mockClear();
  window.localStorage.clear();
});

describe("DashboardShell", () => {
  it("uses the full width layout for admin dashboards and data-heavy routes", () => {
    expect(resolveAdminDashboardContentWidth("/admin")).toBe("full");
    expect(resolveAdminDashboardContentWidth("/admin/reports")).toBe("full");
    expect(
      resolveAdminDashboardContentWidth("/admin/tenants/tenant-1/email"),
    ).toBe("full");
  });

  it("renders the desktop shell with the sidebar expanded by default", () => {
    setViewportWidth(1440);

    renderShell();

    expect(screen.getByTestId("dashboard-shell-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-shell-sidebar")).toHaveStyle({
      width: "260px",
    });
    expect(screen.getByTestId("dashboard-shell-topbar")).toBeInTheDocument();
    expect(screen.getAllByText("Admin Hub")).toHaveLength(2);
    expect(
      screen.getByPlaceholderText("Search something..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin Hub" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Admin Tools" }),
    ).toBeInTheDocument();
  });

  it("renders the tablet shell with the sidebar collapsed by default", () => {
    setViewportWidth(900);

    renderShell();

    expect(screen.getByTestId("dashboard-shell-sidebar")).toHaveStyle({
      width: "72px",
    });
  });

  it("opens and closes the mobile sidebar drawer with a backdrop", () => {
    setViewportWidth(480);

    renderShell();

    const mobileSidebar = screen.getByTestId("dashboard-shell-sidebar-mobile");
    const backdrop = screen.getByTestId("dashboard-shell-backdrop");

    expect(mobileSidebar).toHaveStyle({ transform: "translateX(-100%)" });

    fireEvent.click(screen.getByLabelText("Open sidebar"));

    expect(mobileSidebar).toHaveStyle({ transform: "translateX(0)" });
    expect(backdrop).toHaveStyle({ opacity: "1" });
    expect(
      screen.getByRole("button", { name: "Close sidebar" }),
    ).toBeInTheDocument();

    fireEvent.click(backdrop);

    expect(mobileSidebar).toHaveStyle({ transform: "translateX(-100%)" });
  });

  it("opens the notifications menu from the top bar", async () => {
    setViewportWidth(1440);

    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    expect(await screen.findByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Newsletter ready to review")).toBeInTheDocument();
    expect(screen.getByText("Analytics sync completed")).toBeInTheDocument();
  });

  it("opens the user menu, preserves report problem access, and logs out", async () => {
    setViewportWidth(1440);

    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));

    expect(
      await screen.findByRole("menuitem", { name: "Profile" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Report a Problem" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Log Out" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Report a Problem" }));

    expect(
      await screen.findByTestId("report-problem-dialog"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Log Out" }));

    await waitFor(() => {
      expect(signOutCompletelyMock).toHaveBeenCalledTimes(1);
    });
  });

  it("expands the mobile search overlay when requested", () => {
    setViewportWidth(480);

    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Open search" }));

    expect(
      screen.getByPlaceholderText("Search something..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close search" }),
    ).toBeInTheDocument();
  });

  it("resets the content scroll position on admin route changes", () => {
    setViewportWidth(1440);

    renderShell();

    scrollToMock.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "Reports" }));

    expect(screen.getByText("Admin reports page")).toBeInTheDocument();
    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  });

  it("marks the active admin sub-item as the current page when its branch is expanded", () => {
    setViewportWidth(1440);

    renderShell("/admin/reports");

    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a tooltip in collapsed mode and opens a flyout for branch items", async () => {
    setViewportWidth(1440);

    renderShell();

    fireEvent.click(screen.getAllByLabelText("Collapse sidebar")[0]);

    const adminToolsButton = screen.getByRole("button", {
      name: "Admin Tools",
    });
    fireEvent.mouseEnter(adminToolsButton);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Admin Tools");

    fireEvent.click(adminToolsButton);

    expect(screen.getByTestId("dashboard-sidebar-flyout")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tenants" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reports" })).toBeInTheDocument();
  });
});
