import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, signOut, preview, accept, createLogin } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  preview: vi.fn(),
  accept: vi.fn(),
  createLogin: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword, signOut } },
}));
vi.mock("@/lib/profile/businessProfileUserId", () => ({
  clearBusinessProfileUserIdCache: vi.fn(),
}));
vi.mock("@/lib/team/teamInvitations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/team/teamInvitations")>(
    "@/lib/team/teamInvitations",
  );
  return {
    ...actual,
    previewTeamInvitation: preview,
    acceptTeamInvitation: accept,
    createInvitedLogin: createLogin,
  };
});

import { useAuth } from "@/contexts/AuthContext";
import InviteAcceptPage from "@/pages/InviteAcceptPage";
import { TeamInvitationError } from "@/lib/team/teamInvitations";

const validPreview = {
  state: "valid" as const,
  email: "sam@garden.ca",
  businessName: "Rose Garden",
  roleLabel: "Designer",
  hasAccount: false,
};

const setUser = (email: string | null) =>
  vi.mocked(useAuth).mockReturnValue({
    user: email ? { id: "u1", email } : null,
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);

const renderPage = (token = "tok") =>
  render(
    <MemoryRouter initialEntries={[`/invite/accept?token=${token}`]}>
      <InviteAcceptPage />
    </MemoryRouter>,
  );

describe("InviteAcceptPage", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "http://localhost/invite/accept" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("creates a login for a new invitee, signs in and enters the app", async () => {
    setUser(null);
    preview.mockResolvedValue(validPreview);
    createLogin.mockResolvedValue({ email: validPreview.email });
    signInWithPassword.mockResolvedValue({ error: null });

    renderPage();
    expect(await screen.findByText(/Join Rose Garden/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "longenough1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create login and join" }));

    await waitFor(() => expect(window.location.href).toBe("/dashboard"));
    expect(createLogin).toHaveBeenCalledWith("tok", "longenough1", "");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "sam@garden.ca", password: "longenough1" });
  });

  it("refuses mismatched passwords without calling the server", async () => {
    setUser(null);
    preview.mockResolvedValue(validPreview);

    renderPage();
    await screen.findByText(/Join Rose Garden/);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different11" } });
    fireEvent.click(screen.getByRole("button", { name: "Create login and join" }));

    expect(await screen.findByText("The passwords don't match.")).toBeInTheDocument();
    expect(createLogin).not.toHaveBeenCalled();
  });

  it("signs an existing account in and accepts", async () => {
    setUser(null);
    preview.mockResolvedValue({ ...validPreview, hasAccount: true });
    signInWithPassword.mockResolvedValue({ error: null });
    accept.mockResolvedValue({ tenantId: "t1" });

    renderPage();
    await screen.findByText(/Sign in to accept/);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in and join" }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith("tok"));
    await waitFor(() => expect(window.location.href).toBe("/dashboard"));
  });

  it("lets the signed-in invitee join with one click", async () => {
    setUser("Sam@Garden.ca");
    preview.mockResolvedValue({ ...validPreview, hasAccount: true });
    accept.mockResolvedValue({ tenantId: "t1" });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Join the team" }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith("tok"));
  });

  it("tells a different signed-in account who the invitation is for", async () => {
    setUser("other@garden.ca");
    preview.mockResolvedValue({ ...validPreview, hasAccount: true });

    renderPage();
    expect(
      await screen.findByText("You're signed in as other@garden.ca. This invitation is for sam@garden.ca."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join the team" })).not.toBeInTheDocument();
  });

  it("shows the server's reason when joining fails", async () => {
    setUser("sam@garden.ca");
    preview.mockResolvedValue({ ...validPreview, hasAccount: true });
    accept.mockRejectedValue(
      new TeamInvitationError("This email already has its own BloomSuite business.", "other_business"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Join the team" }));
    expect(await screen.findByText("This email already has its own BloomSuite business.")).toBeInTheDocument();
  });

  it("explains an expired invitation", async () => {
    setUser(null);
    preview.mockResolvedValue({ ...validPreview, state: "expired" });

    renderPage();
    expect(
      await screen.findByText("This invitation to Rose Garden has expired. Ask for a new one."),
    ).toBeInTheDocument();
  });

  it("explains an unknown link", async () => {
    setUser(null);
    preview.mockRejectedValue(new TeamInvitationError("This invitation link isn't valid.", "invalid"));

    renderPage("bad");
    expect(await screen.findByText("This invitation link isn't valid.")).toBeInTheDocument();
  });
});
