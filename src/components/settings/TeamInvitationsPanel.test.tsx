import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, send, resend, revoke, toast } = vi.hoisted(() => ({
  list: vi.fn(),
  send: vi.fn(),
  resend: vi.fn(),
  revoke: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/team/teamInvitations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/team/teamInvitations")>(
    "@/lib/team/teamInvitations",
  );
  return {
    ...actual,
    listPendingInvitations: list,
    sendTeamInvitation: send,
    resendTeamInvitation: resend,
    revokeTeamInvitation: revoke,
  };
});

import { TeamInvitationsPanel } from "@/components/settings/TeamInvitationsPanel";
import { TeamInvitationError } from "@/lib/team/teamInvitations";

const store = { id: "6f1c2c1e-9f6b-4c1a-8003-000000000005", name: "Downtown" };
const pendingInvite = {
  id: "inv-1",
  email: "pat@garden.ca",
  role: "sender" as const,
  location_ids: [],
  expires_at: "2099-01-01T00:00:00Z",
  last_sent_at: "2026-11-25T00:00:00Z",
  send_count: 1,
};

const renderPanel = () =>
  render(<TeamInvitationsPanel tenantId="tenant-1" activeLocations={[store]} />);

const chooseRole = async (label: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: "Role" }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
};

describe("TeamInvitationsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue([]);
  });

  it("sends an invitation with the chosen role", async () => {
    send.mockResolvedValue({ invitationId: "i", emailed: true, inviteUrl: "https://x" });
    renderPanel();
    expect(await screen.findByText("No invitations waiting.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Teammate email"), { target: { value: "sam@garden.ca" } });
    await chooseRole("Designer");
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => expect(send).toHaveBeenCalledWith("sam@garden.ca", "designer", []));
    expect(toast.success).toHaveBeenCalledWith("Invitation sent to sam@garden.ca");
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("requires a store for store-scoped roles and sends it", async () => {
    send.mockResolvedValue({ invitationId: "i", emailed: true, inviteUrl: "https://x" });
    renderPanel();
    await screen.findByText("No invitations waiting.");

    fireEvent.change(screen.getByLabelText("Teammate email"), { target: { value: "sam@garden.ca" } });
    await chooseRole("Staff");
    const sendButton = screen.getByRole("button", { name: "Send invite" });
    expect(sendButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Downtown"));
    expect(sendButton).not.toBeDisabled();
    fireEvent.click(sendButton);
    await waitFor(() => expect(send).toHaveBeenCalledWith("sam@garden.ca", "staff", [store.id]));
  });

  it("offers the link to copy when the email could not be sent", async () => {
    send.mockResolvedValue({
      invitationId: "i",
      emailed: false,
      inviteUrl: "https://bloomsuite.app/invite/accept?token=abc",
    });
    renderPanel();
    await screen.findByText("No invitations waiting.");

    fireEvent.change(screen.getByLabelText("Teammate email"), { target: { value: "sam@garden.ca" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByLabelText("Invite link")).toHaveValue(
      "https://bloomsuite.app/invite/accept?token=abc",
    );
    expect(toast.warning).toHaveBeenCalled();
  });

  it("shows the server's reason when sending fails", async () => {
    send.mockRejectedValue(new TeamInvitationError("That person is already on your team.", "already_member"));
    renderPanel();
    await screen.findByText("No invitations waiting.");

    fireEvent.change(screen.getByLabelText("Teammate email"), { target: { value: "sam@garden.ca" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That person is already on your team."));
  });

  it("resends and cancels pending invitations", async () => {
    list.mockResolvedValue([pendingInvite]);
    resend.mockResolvedValue({ invitationId: "inv-1", emailed: true, inviteUrl: "https://x" });
    revoke.mockResolvedValue({ invitationId: "inv-1" });
    renderPanel();

    const row = (await screen.findByText("pat@garden.ca")).closest("div")?.parentElement?.parentElement;
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText("Sender")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    await waitFor(() => expect(resend).toHaveBeenCalledWith("inv-1"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel invite" }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("inv-1"));
    expect(toast.success).toHaveBeenCalledWith("Invitation to pat@garden.ca cancelled");
  });
});
