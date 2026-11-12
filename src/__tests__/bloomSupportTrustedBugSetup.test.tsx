import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NewTicketDialog } from "@/components/bloomSupport/NewTicketDialog";
import { TrustedBugSetupCard } from "@/components/bloomSupport/TrustedBugSetupCard";
const mocks = vi.hoisted(() => ({ create: vi.fn(), setup: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/bloomSupport/api", () => ({ bloomSupport: { createTicket: mocks.create, configureTrustedBug: mocks.setup, settings: mocks.settings } }));
vi.mock("@/components/bloomSupport/ClientPicker", () => ({ ClientPicker: ({ onChange }: { onChange: (x: { id: string; name: string }) => void }) => <button onClick={() => onChange({ id: "client-1", name: "Test client" })}>Choose test client</button> }));
function show(node: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{node}</QueryClientProvider>); }
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.settings.mockResolvedValue({ release_policy: { requiredChecks: { crm: ["verify", "expect"] }, keep: true } }); });
describe("narrow trusted bug setup", () => {
  it("cancel makes no policy write", async () => {
    show(<TrustedBugSetupCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Configure exact bug scope" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Configure exact bug scope" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.setup).not.toHaveBeenCalled();
  });
  it("keeps a conflicted scope visible and never retries automatically", async () => {
    mocks.setup.mockRejectedValue(new Error("conflict: release policy changed")); show(<TrustedBugSetupCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Configure exact bug scope" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Configure exact bug scope" }));
    fireEvent.change(screen.getByLabelText("Engineering issue ID"), { target: { value: "00000000-0000-4000-8000-000000000001" } });
    fireEvent.change(screen.getByLabelText("Recorded GitHub issue number"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("Every linked ticket ID"), { target: { value: "00000000-0000-4000-8000-000000000002" } });
    fireEvent.click(screen.getByRole("button", { name: "Save verification scope" }));
    await screen.findByText(/conflict: release policy changed/);
    expect(mocks.setup).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Recorded GitHub issue number")).toHaveValue("42");
    expect(screen.getByRole("button", { name: "Reload current policy" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.setup).toHaveBeenCalledTimes(1);
  });
  it("submits exact bindings with the reviewed policy and does not approve or dispatch", async () => {
    mocks.setup.mockResolvedValue({ configured: true }); show(<TrustedBugSetupCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Configure exact bug scope" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Configure exact bug scope" }));
    const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
    fireEvent.change(screen.getByLabelText("Engineering issue ID"), { target: { value: ids[0] } });
    fireEvent.change(screen.getByLabelText("Recorded GitHub issue number"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("Every linked ticket ID"), { target: { value: ids[1] } });
    fireEvent.click(screen.getByRole("button", { name: "Save verification scope" }));
    await screen.findByText("Verification scope saved. No repair was started and no release was approved.");
    expect(mocks.setup).toHaveBeenCalledTimes(1);
    expect(mocks.setup).toHaveBeenCalledWith({ issue_id: ids[0], github_issue: 42, ticket_ids: [ids[1]], expected_policy: { requiredChecks: { crm: ["verify", "expect"] }, keep: true } });
  });
});
describe("internal genuine-bug intake", () => {
  it("cancel never creates a request", () => {
    const close = vi.fn(); show(<NewTicketDialog open onClose={close} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(close).toHaveBeenCalledOnce(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("blocks cancel, close, escape and backdrop while creation is pending", async () => {
    let resolve!: (value: { ticket_id: string; number: number }) => void;
    mocks.create.mockReturnValue(new Promise(r => { resolve = r; }));
    const close = vi.fn(), created = vi.fn();
    show(<NewTicketDialog open onClose={close} onCreated={created} />);
    fireEvent.click(screen.getByLabelText("Internal public-contact bug (no client)"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A genuine boundary bug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create request" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(closeButton);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
    fireEvent.click(document.querySelector(".MuiModal-backdrop")!);
    expect(close).not.toHaveBeenCalled();
    expect(created).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledOnce();
    await act(async () => resolve({ ticket_id: "new", number: 1 }));
    await waitFor(() => expect(created).toHaveBeenCalledExactlyOnceWith("new"));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
  it("keeps default client mode and selected client unchanged", async () => {
    mocks.create.mockResolvedValue({ ticket_id: "new", number: 1 }); show(<NewTicketDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByLabelText("Client request")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Choose test client" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Client asked for help" } });
    fireEvent.click(screen.getByRole("button", { name: "Create request" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ account_id: "client-1", body: "Client asked for help", channel: "staff" });
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("context");
  });
  it("internal mode omits all client identifiers and retries the same request key", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Temporary response failure")).mockResolvedValueOnce({ ticket_id: "new", number: 1 });
    show(<NewTicketDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Internal public-contact bug (no client)"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Valid PNG name of 201 characters is incorrectly accepted" } });
    fireEvent.click(screen.getByRole("button", { name: "Create request" }));
    await screen.findByText("Temporary response failure");
    fireEvent.click(screen.getByRole("button", { name: "Create request" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    const first = mocks.create.mock.calls[0][0]; expect(mocks.create.mock.calls[1][0]).toEqual(first);
    expect(first).toMatchObject({ product: "crm", kind: "bug", context: { page_url: "https://bloomsuite.app/support/contact" } });
    for (const key of ["account_id", "requester_id", "conversation_id", "attachments"]) expect(first).not.toHaveProperty(key);
  });
});
