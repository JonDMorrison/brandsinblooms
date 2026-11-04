import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { ReportProblemDialog } from "@/components/bloomSupport/ReportProblemDialog";
import { TicketConversation } from "@/components/bloomSupport/TicketConversation";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { PublicSupportContact } from "@/pages/PublicSupportPage";
import SupportPage from "@/pages/SupportPage";
import { TestQueryClientProvider } from "@/test/TestQueryClientProvider";
import type { TicketDetail, Whoami } from "@/lib/bloomSupport/api";

const { signOutCompletelyMock } = vi.hoisted(() => ({
  signOutCompletelyMock: vi.fn().mockResolvedValue(undefined),
}));

const supportMocks = vi.hoisted(() => ({
  captureClientContext: vi.fn(() => ({ route: "/campaigns/42" })),
  fileToUpload: vi.fn(async (file: File) => ({
    file_name: file.name,
    content_type: file.type,
    data_base64: "encoded",
  })),
  publicRequest: vi.fn(),
  report: vi.fn(),
  addMessage: vi.fn(),
  getTicket: vi.fn(),
  listTickets: vi.fn(),
  me: vi.fn(),
  uploadAttachment: vi.fn(),
  safeClientPageUrl: vi.fn(() => "https://bloomsuite.app/support/contact"),
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
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("@/hooks/useIsSuperAdmin", () => ({
  useIsSuperAdmin: () => ({
    data: true,
    isLoading: false,
  }),
}));

// DashboardShell tests exercise layout/navigation behavior, not tenant CRM access.
// Keep this suite isolated from AdminProvider hydration so new CRM permission reads
// in DashboardSidebar do not turn an unrelated shell test into an integration test.
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    tenantId: "tenant-1",
    role: "owner_admin",
    locationIds: [],
    permissions: [
      "customers.read",
      "customers.write",
      "segments.manage",
      "campaigns.read",
      "campaigns.write",
      "automations.manage",
      "content.design",
      "reports.read",
      "integrations.manage",
      "access.manage",
    ],
    hasPermission: () => true,
    hasRole: () => true,
    canEditImages: true,
    canUseCanva: true,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1", name: "Bloom Flowers" } }),
}));

vi.mock("@/components/TrialBanner", () => ({
  TrialBanner: () => <div data-testid="trial-banner">Trial banner</div>,
}));

vi.mock("@/components/ui/HelpWidget", () => ({
  HelpWidget: () => <div data-testid="help-widget">Help widget</div>,
}));

vi.mock("@/components/search/CommandPalette", () => ({
  CommandPalette: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Command palette">
        <input
          aria-label="Search across BloomSuite"
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />
      </div>
    ) : null,
}));

vi.mock("@/components/location/LocationBlockingBanner", () => ({
  LocationBlockingBanner: () => (
    <div data-testid="location-blocking-banner">Location blocking banner</div>
  ),
}));

vi.mock("@/lib/bloomSupport/api", () => ({
  KIND_LABEL: {},
  PRODUCT_LABEL: {},
  STATUS_LABEL: {},
  WAITING_LABEL: {},
  bloomSupport: {
    publicRequest: supportMocks.publicRequest,
    report: supportMocks.report,
    addMessage: supportMocks.addMessage,
    getTicket: supportMocks.getTicket,
    listTickets: supportMocks.listTickets,
    me: supportMocks.me,
    uploadAttachment: supportMocks.uploadAttachment,
  },
  captureClientContext: supportMocks.captureClientContext,
  fileToUpload: supportMocks.fileToUpload,
  readBloomDiagnostics: vi.fn(() => null),
  safeClientPageUrl: supportMocks.safeClientPageUrl,
}));

vi.mock("@/components/reportProblem/ReportProblemDialog", () => ({
  ReportProblemDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="report-problem-dialog">Report a Problem Dialog</div> : null,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const supportTicket: TicketDetail = {
  id: "22222222-2222-4222-8222-222222222222",
  number: 1044,
  subject: "Receipt printer is offline",
  status: "working",
  product: "pos",
  kind: "bug",
  priority: "normal",
  created_at: "2026-11-04T16:00:00.000Z",
  updated_at: "2026-11-04T16:00:00.000Z",
  resolved_at: null,
  conversation_id: "33333333-3333-4333-8333-333333333333",
  account: { id: "44444444-4444-4444-8444-444444444444", name: "Greenleaf" },
  requester: { id: "55555555-5555-4555-8555-555555555555", name: "Gail", email: "gail@example.com" },
  resolution_summary: null,
  summary: "Receipt printer is offline after the update.",
  stage: "answering",
  automation: "auto",
  version: 1,
  channel: "pos",
  owner: null,
  executor: "bloom",
  messages: [],
  attachments: [],
  conversation_tickets: [],
  flags: {
    overdue: false,
    due_soon: false,
    stalled: false,
    unassigned: true,
    clock_paused: false,
    response_due_at: null,
    next_due_at: null,
    targets_are_internal: false,
  },
};

const supportAgent: Whoami = {
  id: "66666666-6666-4666-8666-666666666666",
  name: "Sam Support",
  email: "sam@example.com",
  role: "support",
  grants: [],
  permissions: ["tickets.read_all", "tickets.internal"],
  accounts: [],
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

function AdminAuditLogsPage() {
  return <div>Admin audit logs page</div>;
}

function renderShell(initialPath = "/admin") {
  return render(
    <TestQueryClientProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHubPage />} />
            <Route path="bloom-support" element={<div>Support desk page</div>} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </TestQueryClientProvider>,
  );
}

beforeAll(() => {
  const storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() { return storage.size; },
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, String(value)),
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToMock,
    writable: true,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  scrollToMock.mockClear();
  signOutCompletelyMock.mockClear();
  if (typeof window.localStorage.clear === "function") window.localStorage.clear();
  supportMocks.report.mockResolvedValue({
    received: true,
    duplicate_delivery: false,
    ticket_id: "11111111-1111-4111-8111-111111111111",
    number: 1042,
    attachments: { stored: 0, failed: [] },
  });
  supportMocks.publicRequest.mockResolvedValue({
    received: true,
    duplicate_delivery: false,
    number: 1043,
    email_delivery: "pending",
  });
  supportMocks.getTicket.mockResolvedValue(supportTicket);
  supportMocks.listTickets.mockResolvedValue([supportTicket]);
  supportMocks.me.mockResolvedValue(supportAgent);
  supportMocks.addMessage.mockResolvedValue({
    message_id: "77777777-7777-4777-8777-777777777777",
    duplicate: false,
  });
  supportMocks.uploadAttachment.mockResolvedValue({ id: "attachment-1" });
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
    expect(screen.getAllByText("Admin home")).toHaveLength(2);
    expect(screen.getByLabelText("Open command palette")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin home" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Developer tools" }),
    ).toBeInTheDocument();
  });

  it("keeps the floating help button off support pages so it never covers the composer", () => {
    setViewportWidth(1440);

    const { unmount } = renderShell();
    expect(screen.getByTestId("help-widget")).toBeInTheDocument();
    unmount();

    renderShell("/admin/bloom-support");
    expect(screen.getByText("Support desk page")).toBeInTheDocument();
    expect(screen.queryByTestId("help-widget")).not.toBeInTheDocument();
  });

  it("renders the tablet shell with the sidebar collapsed by default", async () => {
    setViewportWidth(900);

    renderShell();

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-shell-sidebar")).toHaveStyle({
        width: "72px",
      });
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

  it("does not render the notification bell until the notifications backend ships", () => {
    setViewportWidth(1440);

    renderShell();

    expect(
      screen.queryByRole("button", { name: "Open notifications" }),
    ).toBeNull();
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

    expect(await screen.findByTestId("report-problem-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Log Out" }));

    await waitFor(() => {
      expect(signOutCompletelyMock).toHaveBeenCalledTimes(1);
    });
  });

  it("opens the command palette from the desktop trigger", async () => {
    setViewportWidth(1440);

    renderShell();

    fireEvent.click(screen.getByLabelText("Open command palette"));

    expect(
      await screen.findByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search across BloomSuite")).toBeInTheDocument();
  });

  it("opens and closes the command palette with the keyboard shortcut", async () => {
    setViewportWidth(1440);

    renderShell();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(
      await screen.findByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText("Search across BloomSuite"), {
      key: "Escape",
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Command palette" }),
      ).not.toBeInTheDocument();
    });
  });

  it("opens the command palette from the mobile search affordance", async () => {
    setViewportWidth(480);

    renderShell();

    fireEvent.click(
      screen.getByRole("button", { name: "Open command palette" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();
  });

  it("resets the content scroll position on admin route changes", () => {
    setViewportWidth(1440);

    renderShell();

    scrollToMock.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "Trial reports" }));

    expect(screen.getByText("Admin reports page")).toBeInTheDocument();
    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  });

  it("marks the active admin sub-item as the current page when its branch is expanded", () => {
    setViewportWidth(1440);

    renderShell("/admin/audit-logs");

    expect(screen.getByRole("link", { name: "Change history" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a tooltip in collapsed mode and opens a flyout for branch items", async () => {
    setViewportWidth(1440);

    renderShell();

    fireEvent.click(screen.getAllByLabelText("Collapse sidebar")[0]);

    const adminToolsButton = screen.getByRole("button", {
      name: "Developer tools",
    });
    fireEvent.mouseEnter(adminToolsButton);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Developer tools");

    fireEvent.click(adminToolsButton);

    expect(screen.getByTestId("dashboard-sidebar-flyout")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change history" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Data pipeline health" })).toBeInTheDocument();
  });
});

describe("Bloom Support intake in the dashboard shell", () => {
  it("locks one immutable report snapshot in flight and retries that exact payload", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const first = deferred<Awaited<ReturnType<typeof supportMocks.report>>>();
    supportMocks.report
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({
        received: true,
        duplicate_delivery: true,
        ticket_id: "11111111-1111-4111-8111-111111111111",
        number: 1042,
        attachments: { stored: 0, failed: [] },
      });

    render(<ReportProblemDialog open onClose={onClose} />);
    const message = screen.getByRole("textbox", { name: "What's happening?" });
    await user.type(message, "The first immutable request snapshot must be retried.");
    await user.click(screen.getByRole("button", { name: "Send to Bloom" }));

    await waitFor(() => expect(supportMocks.report).toHaveBeenCalledTimes(1));
    expect(message).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close support request" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeDisabled();
    const originalPayload = supportMocks.report.mock.calls[0][0];
    await act(async () => first.reject(new Error("Response lost after commit")));

    const retry = await screen.findByRole("button", { name: "Retry same request" });
    expect(screen.getByRole("button", { name: "Close support request" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(retry).toBeEnabled();
    await user.click(retry);
    await waitFor(() => expect(supportMocks.report).toHaveBeenCalledTimes(2));
    expect(supportMocks.report.mock.calls[1][0]).toBe(originalPayload);
    expect(supportMocks.captureClientContext).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Received by Bloom");
  });

  it("rotates the key only after an explicit request to edit and send as new", async () => {
    const user = userEvent.setup();
    supportMocks.report.mockRejectedValueOnce(new Error("Ambiguous response"));
    render(<ReportProblemDialog open onClose={vi.fn()} />);
    const message = screen.getByRole("textbox", { name: "What's happening?" });
    await user.type(message, "This report may be edited only as a new request.");
    await user.click(screen.getByRole("button", { name: "Send to Bloom" }));
    await screen.findByRole("button", { name: "Retry same request" });
    const firstKey = supportMocks.report.mock.calls[0][0].idempotency_key;

    await user.click(screen.getByRole("button", { name: "Edit and send as new request" }));
    expect(message).toBeEnabled();
    await waitFor(() => expect(message).toHaveFocus());
    await user.clear(message);
    await user.type(message, "This is deliberately a different support request.");
    await user.click(screen.getByRole("button", { name: "Send to Bloom" }));
    await waitFor(() => expect(supportMocks.report).toHaveBeenCalledTimes(2));
    expect(supportMocks.report.mock.calls[1][0].idempotency_key).not.toBe(firstKey);
  });

  it("keeps the report and selected file when the receipt cannot account for it", async () => {
    const user = userEvent.setup();
    supportMocks.report.mockResolvedValueOnce({
      received: true,
      duplicate_delivery: false,
      ticket_id: "11111111-1111-4111-8111-111111111111",
      number: 1044,
      attachments: { stored: 0, failed: [] },
    });
    render(<ReportProblemDialog open onClose={vi.fn()} />);
    const message = screen.getByRole("textbox", { name: "What's happening?" });
    await user.type(message, "The attachment receipt must match the selected evidence.");
    await user.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["image"], "receipt.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Send to Bloom" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not confirm every selected attachment",
    );
    expect(message).toHaveValue("The attachment receipt must match the selected evidence.");
    expect(screen.getByText("receipt.png")).toBeInTheDocument();
  });

  it("freezes and retries the exact public snapshot, then offers an explicit new request", async () => {
    const user = userEvent.setup();
    const first = deferred<Awaited<ReturnType<typeof supportMocks.publicRequest>>>();
    supportMocks.publicRequest
      .mockImplementationOnce(() => first.promise)
      .mockRejectedValueOnce(new Error("still unavailable"));
    render(<PublicSupportContact />);
    const email = screen.getByRole("textbox", { name: "Your email" });
    const message = screen.getByRole("textbox", { name: "How can we help?" });
    await user.type(email, "jamie@example.com");
    await user.type(message, "I cannot sign in after resetting my password.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(supportMocks.publicRequest).toHaveBeenCalledTimes(1));
    expect(email).toBeDisabled();
    expect(message).toBeDisabled();
    const originalPayload = supportMocks.publicRequest.mock.calls[0][0];
    await act(async () => first.reject(new Error("Response lost after commit")));
    await user.click(await screen.findByRole("button", { name: "Retry same request" }));
    await waitFor(() => expect(supportMocks.publicRequest).toHaveBeenCalledTimes(2));
    expect(supportMocks.publicRequest.mock.calls[1][0]).toBe(originalPayload);

    await user.click(screen.getByRole("button", { name: "Edit and send as a new request" }));
    expect(email).toBeEnabled();
    await waitFor(() => expect(email).toHaveFocus());
  });

  it("announces honest pending-email confirmation after public intake", async () => {
    const user = userEvent.setup();
    render(<PublicSupportContact />);
    await user.type(screen.getByRole("textbox", { name: "Your email" }), "jamie@example.com");
    await user.type(screen.getByRole("textbox", { name: "How can we help?" }), "I cannot sign in to my account.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("We'll try to email a tracking link");
    expect(status).not.toHaveTextContent("We've emailed");
  });
});

describe("Bloom Support reply composer", () => {
  const renderTicket = () => render(
    <TestQueryClientProvider>
      <TicketDetailPane
        ticketId={supportTicket.id}
        me={supportAgent}
        onOpenTicket={vi.fn()}
      />
    </TestQueryClientProvider>,
  );

  it("freezes and retries the exact reply after an ambiguous failure", async () => {
    const user = userEvent.setup();
    const first = deferred<{ message_id: string; duplicate: boolean }>();
    supportMocks.addMessage
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({
        message_id: "77777777-7777-4777-8777-777777777777",
        duplicate: true,
      });
    renderTicket();

    const reply = await screen.findByPlaceholderText("Private note — never sent to the client");
    expect(reply).toHaveAccessibleName("Internal note message");
    await user.type(reply, "Keep this exact note until the server confirms it.");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(1));
    expect(reply).toBeDisabled();
    expect(screen.getByRole("button", { name: "Internal note" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reply to client" })).toBeDisabled();
    expect(document.querySelector<HTMLInputElement>('input[type="file"]')).toBeDisabled();
    const originalPayload = supportMocks.addMessage.mock.calls[0][1];

    await act(async () => first.reject(new Error("Response lost after commit")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Response lost after commit");
    expect(reply).toBeDisabled();
    expect(reply).toHaveValue("Keep this exact note until the server confirms it.");

    await user.click(screen.getByRole("button", { name: "Retry same reply" }));
    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(2));
    expect(supportMocks.addMessage.mock.calls[1][1]).toBe(originalPayload);
    await waitFor(() => expect(reply).toHaveValue(""));
    expect(reply).toBeEnabled();
    expect(await screen.findByRole("status")).toHaveTextContent("Internal note saved.");
  });

  it("shows and enforces the reply length before anything is sent", async () => {
    renderTicket();

    const reply = await screen.findByPlaceholderText("Private note — never sent to the client");
    expect(reply).toHaveAttribute("maxlength", "20000");
    expect(screen.getByText("0 / 20,000 characters")).toBeInTheDocument();

    fireEvent.change(reply, { target: { value: "x".repeat(20_001) } });
    expect(screen.getByText("20,001 / 20,000 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled();
    expect(supportMocks.addMessage).not.toHaveBeenCalled();
  });

  it("rotates the key only after explicit edit-and-send-as-new", async () => {
    const user = userEvent.setup();
    supportMocks.addMessage.mockRejectedValueOnce(new Error("Connection ended before confirmation"));
    renderTicket();

    const reply = await screen.findByPlaceholderText("Private note — never sent to the client");
    await user.type(reply, "The first reply may already be saved.");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByRole("button", { name: "Retry same reply" });
    const firstPayload = supportMocks.addMessage.mock.calls[0][1];

    await user.click(screen.getByRole("button", { name: "Edit and send as new reply" }));
    expect(reply).toBeEnabled();
    await waitFor(() => expect(reply).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Reply to client" }));
    expect(reply).toHaveAccessibleName("Reply message");
    await user.clear(reply);
    await user.type(reply, "This is deliberately a new public reply.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(2));
    const newPayload = supportMocks.addMessage.mock.calls[1][1];
    expect(newPayload).toMatchObject({
      body: "This is deliberately a new public reply.",
      visibility: "public",
    });
    expect(newPayload.idempotency_key).not.toBe(firstPayload.idempotency_key);
  });

  it("uploads reply attachments one at a time", async () => {
    const user = userEvent.setup();
    renderTicket();
    await screen.findByPlaceholderText("Private note — never sent to the client");
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    expect(input).not.toHaveAttribute("multiple");
    await user.upload(
      input!,
      new File(["photo"], "printer.png", { type: "image/png" }),
    );

    await waitFor(() => expect(supportMocks.uploadAttachment).toHaveBeenCalledTimes(1));
    expect(supportMocks.uploadAttachment).toHaveBeenCalledWith(
      supportTicket.id,
      expect.objectContaining({ name: "printer.png" }),
      "internal",
    );
  });
});

describe("Bloom Support staff workspace", () => {
  it("waits for the support identity before choosing the staff or client workspace", async () => {
    const meRequest = deferred<Whoami>();
    supportMocks.me.mockImplementationOnce(() => meRequest.promise);
    render(
      <TestQueryClientProvider>
        <MemoryRouter>
          <SupportPage />
        </MemoryRouter>
      </TestQueryClientProvider>,
    );

    expect(screen.getByRole("status", { name: "Loading your support workspace" })).toBeInTheDocument();
    expect(screen.getByText("Loading your support workspace…")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loading support" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Support" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Help & Support" })).not.toBeInTheDocument();
    expect(screen.queryByText("Get help")).not.toBeInTheDocument();
    expect(screen.queryByText("Help centre")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open full support desk" })).not.toBeInTheDocument();
    expect(supportMocks.listTickets).not.toHaveBeenCalled();

    await act(async () => meRequest.resolve(supportAgent));

    expect(await screen.findByRole("heading", { name: "Support" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full support desk" })).toBeInTheDocument();
    expect(screen.queryByText("Get help")).not.toBeInTheDocument();
  });

  it("does not fall back to the client portal when support identity loading fails", async () => {
    const user = userEvent.setup();
    supportMocks.me
      .mockRejectedValueOnce(new Error("Identity unavailable"))
      .mockResolvedValueOnce(supportAgent);
    render(
      <TestQueryClientProvider>
        <MemoryRouter>
          <SupportPage />
        </MemoryRouter>
      </TestQueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Support unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Try again to securely load your support access.");
    expect(screen.queryByText("Get help")).not.toBeInTheDocument();
    expect(screen.queryByText("Help centre")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open full support desk" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Support" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full support desk" })).toBeInTheDocument();
  });

  it("keeps staff on a calm conversation-first support surface", async () => {
    const user = userEvent.setup();
    render(
      <TestQueryClientProvider>
        <MemoryRouter>
          <SupportPage />
        </MemoryRouter>
      </TestQueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Support" })).toBeInTheDocument();
    expect(screen.queryByText("Get help")).not.toBeInTheDocument();
    expect(screen.queryByText("Help centre")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full support desk" })).toHaveAttribute("href", "/admin/bloom-support");

    await user.click(await screen.findByRole("button", { name: `Open request #${supportTicket.number}: ${supportTicket.subject}` }));

    expect(await screen.findByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.queryByText("Captured context")).not.toBeInTheDocument();
  });

  it("preserves the self-service portal for client users", async () => {
    supportMocks.me.mockResolvedValueOnce({ ...supportAgent, role: "client", permissions: [] });
    render(
      <TestQueryClientProvider>
        <MemoryRouter>
          <SupportPage />
        </MemoryRouter>
      </TestQueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Help & Support" })).toBeInTheDocument();
    expect(screen.getByText("Get help")).toBeInTheDocument();
    expect(screen.getByText("Help centre")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open full support desk" })).not.toBeInTheDocument();
  });

  it("restores focus to the originating ticket after the mobile conversation closes", async () => {
    const user = userEvent.setup();
    setViewportWidth(390);
    render(
      <TestQueryClientProvider>
        <MemoryRouter>
          <SupportPage />
        </MemoryRouter>
      </TestQueryClientProvider>,
    );

    const row = await screen.findByRole("button", { name: `Open request #${supportTicket.number}: ${supportTicket.subject}` });
    await user.click(row);
    expect(await screen.findByRole("region", { name: "Request details" })).toHaveFocus();

    await user.click(await screen.findByRole("button", { name: "Back" }));
    await waitFor(() => expect(row).toHaveFocus());
  });

  const renderConversation = () => render(
    <TestQueryClientProvider>
      <TicketConversation
        ticketId={supportTicket.id}
        me={{ ...supportAgent, permissions: [...supportAgent.permissions, "tickets.write"] }}
        onBack={vi.fn()}
        onShowDetails={vi.fn()}
        onOpenTicket={vi.fn()}
      />
    </TestQueryClientProvider>,
  );

  it("freezes and retries the exact conversation reply after an ambiguous failure", async () => {
    const user = userEvent.setup();
    const first = deferred<{ message_id: string; duplicate: boolean }>();
    supportMocks.addMessage
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({
        message_id: "88888888-8888-4888-8888-888888888888",
        duplicate: true,
      });
    renderConversation();

    const reply = await screen.findByRole("textbox", { name: "Message" });
    expect(reply).toHaveAttribute("maxlength", "20000");
    expect(screen.getByText("0 / 20,000 characters")).toBeInTheDocument();
    await user.type(reply, "Please restart the receipt printer and tell us what happens.");
    await user.click(screen.getByRole("button", { name: "Send to client" }));

    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(1));
    const originalPayload = supportMocks.addMessage.mock.calls[0][1];
    expect(reply).toBeDisabled();
    await act(async () => first.reject(new Error("Response lost after commit")));

    expect(await screen.findByRole("alert")).toHaveTextContent("Response lost after commit");
    expect(reply).toBeDisabled();
    expect(reply).toHaveValue("Please restart the receipt printer and tell us what happens.");
    await user.click(screen.getByRole("button", { name: "Retry same reply" }));

    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(2));
    expect(supportMocks.addMessage.mock.calls[1][1]).toBe(originalPayload);
    await waitFor(() => expect(reply).toHaveValue(""));
    expect(await screen.findByText("Reply sent to the client.")).toBeInTheDocument();
  });

  it("blocks both conversation send paths above the body limit", async () => {
    renderConversation();

    const reply = await screen.findByRole("textbox", { name: "Message" });
    fireEvent.change(reply, { target: { value: "x".repeat(20_001) } });

    expect(screen.getByText("20,001 / 20,000 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to client" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Internal note" }));
    expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled();
    expect(supportMocks.addMessage).not.toHaveBeenCalled();
  });

  it("preserves public and private attachment choices in the focused composer", async () => {
    const user = userEvent.setup();
    renderConversation();
    await screen.findByRole("textbox", { name: "Message" });
    const privateInput = document.querySelector<HTMLInputElement>('input[aria-label="Attach a private file"]');

    expect(privateInput).not.toBeNull();
    expect(privateInput).not.toHaveAttribute("multiple");
    await user.upload(
      privateInput!,
      new File(["photo"], "printer.png", { type: "image/png" }),
    );

    await waitFor(() => expect(supportMocks.uploadAttachment).toHaveBeenCalledTimes(1));
    expect(supportMocks.uploadAttachment).toHaveBeenCalledWith(
      supportTicket.id,
      expect.objectContaining({ name: "printer.png" }),
      "internal",
    );
  });

  it("clears stale attachment feedback when a reply starts", async () => {
    const user = userEvent.setup();
    const pendingReply = deferred<{ message_id: string; duplicate: boolean }>();
    supportMocks.uploadAttachment.mockRejectedValueOnce(new Error("Attachment upload failed"));
    supportMocks.addMessage.mockImplementationOnce(() => pendingReply.promise);
    renderConversation();

    const reply = await screen.findByRole("textbox", { name: "Message" });
    const privateInput = document.querySelector<HTMLInputElement>('input[aria-label="Attach a private file"]');
    await user.upload(
      privateInput!,
      new File(["photo"], "printer.png", { type: "image/png" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Attachment upload failed");

    await user.type(reply, "The printer still needs help.");
    await user.click(screen.getByRole("button", { name: "Send to client" }));

    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Attachment upload failed")).not.toBeInTheDocument();
    await act(async () => pendingReply.resolve({ message_id: "88888888-8888-4888-8888-888888888888", duplicate: false }));
  });

  it("rotates the conversation key only after edit and send as new", async () => {
    const user = userEvent.setup();
    supportMocks.addMessage.mockRejectedValueOnce(new Error("Connection ended before confirmation"));
    renderConversation();

    const reply = await screen.findByRole("textbox", { name: "Message" });
    await user.type(reply, "The first reply may already be saved.");
    await user.click(screen.getByRole("button", { name: "Send to client" }));
    await screen.findByRole("button", { name: "Retry same reply" });
    const firstPayload = supportMocks.addMessage.mock.calls[0][1];

    await user.click(screen.getByRole("button", { name: "Edit and send as new" }));
    expect(reply).toBeEnabled();
    await waitFor(() => expect(reply).toHaveFocus());
    await user.clear(reply);
    await user.type(reply, "This is deliberately a new private note.");
    await user.click(screen.getByRole("button", { name: "Internal note" }));
    await user.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(2));
    const newPayload = supportMocks.addMessage.mock.calls[1][1];
    expect(newPayload).toMatchObject({
      body: "This is deliberately a new private note.",
      visibility: "internal",
    });
    expect(newPayload.idempotency_key).not.toBe(firstPayload.idempotency_key);
  });

  it("sends with the keyboard shortcut and keeps internal notes on their own toggle", async () => {
    const user = userEvent.setup();
    renderConversation();

    const reply = await screen.findByRole("textbox", { name: "Message" });
    await user.click(screen.getByRole("button", { name: "Internal note" }));
    await user.type(reply, "Checked the logs, nothing for the client yet.");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => expect(supportMocks.addMessage).toHaveBeenCalledTimes(1));
    expect(supportMocks.addMessage.mock.calls[0][1]).toMatchObject({
      body: "Checked the logs, nothing for the client yet.",
      visibility: "internal",
    });
    expect(await screen.findByText("Internal note added.")).toBeInTheDocument();
  });

  it("shows Bloom's findings and the fix in plain words", async () => {
    supportMocks.getTicket.mockResolvedValueOnce({
      ...supportTicket,
      stage: "investigating",
      engineering: { id: "eng-1", title: "Receipt printer is offline.", status: "open" },
      messages: [{
        id: "note-1",
        ticket_id: supportTicket.id,
        author_kind: "bloom",
        visibility: "internal",
        direction: "internal",
        body: "Triage (model): bug, high, pos-hardware",
        created_at: supportTicket.updated_at,
        author: null,
      }],
    });
    renderConversation();

    expect(await screen.findByText("Bloom read this as a bug, high priority, about pos hardware.")).toBeInTheDocument();
    expect(screen.queryByText(/Triage \(model\)/)).not.toBeInTheDocument();
    expect(screen.getByText("Bloom is investigating")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("Logged for engineering. Work hasn't started yet.")).toBeInTheDocument();
    expect(screen.queryByText(/\.\./)).not.toBeInTheDocument();
  });

  it("keeps operational telemetry collapsed until staff asks for it", async () => {
    const user = userEvent.setup();
    supportMocks.getTicket.mockResolvedValueOnce({
      ...supportTicket,
      jobs: [{ id: "job-1", kind: "triage", status: "succeeded", attempts: 1, last_error: null, run_after: supportTicket.updated_at, updated_at: supportTicket.updated_at }],
      emails: [{ purpose: "acknowledgement", to: "gail@example.com", status: "delivered", created_at: supportTicket.updated_at, error: null }],
      timers: { age_seconds: 3600, our_clock_seconds: 1800, our_clock_business_seconds: 1200 },
      history: [{ kind: "status", from: "new", to: "working", at: supportTicket.updated_at, actor: "Bloom" }],
      activity: [{ action: "ticket.updated", detail: {}, created_at: supportTicket.updated_at, actor: "Bloom" }],
      context: { route: "/dashboard", viewport: "1440x900" },
    });
    render(
      <TestQueryClientProvider>
        <TicketDetailPane ticketId={supportTicket.id} me={supportAgent} onOpenTicket={vi.fn()} />
      </TestQueryClientProvider>,
    );

    const delivery = await screen.findByRole("button", { name: /Automation & delivery/ });
    const history = screen.getByRole("button", { name: "Timing & history" });
    const context = screen.getByRole("button", { name: "Technical context" });
    expect(delivery).toHaveAttribute("aria-expanded", "false");
    expect(history).toHaveAttribute("aria-expanded", "false");
    expect(context).toHaveAttribute("aria-expanded", "false");

    await user.click(delivery);
    expect(delivery).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("acknowledgement → gail@example.com: delivered")).toBeInTheDocument();
  });
});
