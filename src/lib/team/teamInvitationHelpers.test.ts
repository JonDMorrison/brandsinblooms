import { describe, expect, it } from "vitest";
import {
  createInvitationToken,
  databaseRoleFor,
  exactEmailPattern,
  hashInvitationToken,
  invitationState,
  invitationUrl,
  isPlausibleInvitationToken,
  normalizeInviteEmail,
  parseInviteRole,
  parseLocationIds,
  renderInvitationEmail,
  roleNeedsLocations,
} from "../../../supabase/functions/_shared/teamInvitations.ts";

describe("team invitation helpers", () => {
  it("normalizes emails and rejects implausible ones", () => {
    expect(normalizeInviteEmail("  Sam@Garden.CA ")).toBe("sam@garden.ca");
    expect(normalizeInviteEmail("not-an-email")).toBeNull();
    expect(normalizeInviteEmail("a b@c.d")).toBeNull();
    expect(normalizeInviteEmail(42)).toBeNull();
  });

  it("escapes LIKE wildcards so email lookups are exact", () => {
    expect(exactEmailPattern("first_last%x@garden.ca")).toBe("first\\_last\\%x@garden.ca");
    expect(exactEmailPattern("a\\b@c.ca")).toBe("a\\\\b@c.ca");
  });

  it("accepts only CRM roles and maps owner/admin to the stored role", () => {
    expect(parseInviteRole("designer")).toBe("designer");
    expect(parseInviteRole("owner")).toBeNull();
    expect(parseInviteRole("superuser")).toBeNull();
    expect(databaseRoleFor("owner_admin")).toBe("admin");
    expect(databaseRoleFor("sender")).toBe("sender");
    expect(roleNeedsLocations("staff")).toBe(true);
    expect(roleNeedsLocations("store_manager")).toBe(true);
    expect(roleNeedsLocations("marketing")).toBe(false);
  });

  it("parses location ids as distinct UUIDs", () => {
    const id = "6f1c2c1e-9f6b-4c1a-8003-000000000005";
    expect(parseLocationIds(undefined)).toEqual([]);
    expect(parseLocationIds([id, id.toUpperCase()])).toEqual([id]);
    expect(parseLocationIds(["nope"])).toBeNull();
    expect(parseLocationIds("x")).toBeNull();
  });

  it("creates unguessable tokens and stores only a stable hash", async () => {
    const a = createInvitationToken();
    const b = createInvitationToken();
    expect(a).not.toBe(b);
    expect(isPlausibleInvitationToken(a)).toBe(true);
    expect(isPlausibleInvitationToken("short")).toBe(false);
    const hash = await hashInvitationToken(a);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashInvitationToken(a)).toBe(hash);
    expect(await hashInvitationToken(b)).not.toBe(hash);
  });

  it("reports the invitation state", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(invitationState({ status: "pending", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe("valid");
    expect(invitationState({ status: "pending", expires_at: "2026-11-20T00:00:00Z" }, now)).toBe("expired");
    expect(invitationState({ status: "accepted", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe("accepted");
    expect(invitationState({ status: "revoked", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe("revoked");
  });

  it("builds the accept link on the app", () => {
    expect(invitationUrl("https://bloomsuite.app/", "abc_-")).toBe(
      "https://bloomsuite.app/invite/accept?token=abc_-",
    );
  });

  it("renders the email with the business, role and link, escaping names", () => {
    const email = renderInvitationEmail({
      businessName: "Rose & <Thorn>",
      inviterName: "Jordan",
      role: "designer",
      acceptUrl: "https://bloomsuite.app/invite/accept?token=t",
      expiresAt: "2026-12-02T12:00:00Z",
    });
    expect(email.subject).toBe("Join Rose & <Thorn> on BloomSuite");
    expect(email.html).toContain("Rose &amp; &lt;Thorn&gt;");
    expect(email.html).not.toContain("<Thorn>");
    expect(email.html).toContain("Designer");
    expect(email.html).toContain('href="https://bloomsuite.app/invite/accept?token=t"');
    expect(email.text).toContain("Jordan invited you to join Rose & <Thorn> on BloomSuite.");
    expect(email.text).toContain("December 2, 2026");
  });
});
