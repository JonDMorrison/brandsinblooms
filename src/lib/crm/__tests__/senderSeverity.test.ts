import { describe, expect, it } from "vitest";
import type { EmailDomain } from "@/hooks/useEmailDomains";
import { classifySender, resolveTenantSendingReadiness } from "../senderSeverity";

const baseDomain = (
  overrides: Partial<EmailDomain> & Pick<EmailDomain, "status">,
): EmailDomain => ({
  id: "d1",
  tenant_id: "t1",
  domain: "example.com",
  default_from_email: "send@example.com",
  default_from_name: "Example",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

describe("classifySender", () => {
  it("returns ready for an active domain matching the sender", () => {
    const result = classifySender({
      senderEmail: "send@example.com",
      senderName: "Example Garden Centre",
      emailDomains: [baseDomain({ status: "active" })],
      campaignType: "email",
    });
    expect(result).toEqual({ status: "ready" });
  });

  it("blocks NO_SENDER when senderEmail is empty", () => {
    const result = classifySender({
      senderEmail: "",
      senderName: "Example",
      emailDomains: [baseDomain({ status: "active" })],
      campaignType: "email",
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("NO_SENDER");
      expect(result.message).toMatch(/No sender configured/i);
    }
  });

  it("blocks NO_SENDER when senderEmail has no @", () => {
    const result = classifySender({
      senderEmail: "not-an-email",
      senderName: "Example",
      emailDomains: [baseDomain({ status: "active" })],
      campaignType: "email",
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("NO_SENDER");
    }
  });

  it("warns FREE_MAIL when sender uses gmail.com", () => {
    const result = classifySender({
      senderEmail: "owner@gmail.com",
      senderName: "Example",
      emailDomains: [baseDomain({ status: "active" })],
      campaignType: "email",
    });
    expect(result.status).toBe("warning");
    if (result.status === "warning") {
      expect(result.reason).toBe("FREE_MAIL");
      expect(result.message).toMatch(/branded sending domain/i);
    }
  });

  it.each([
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "aol.com",
    "icloud.com",
    "protonmail.com",
    "proton.me",
  ])("warns FREE_MAIL for %s", (domain) => {
    const result = classifySender({
      senderEmail: `owner@${domain}`,
      senderName: "Example",
      emailDomains: [],
      campaignType: "email",
    });
    expect(result.status).toBe("warning");
    if (result.status === "warning") {
      expect(result.reason).toBe("FREE_MAIL");
    }
  });

  it("blocks DOMAIN_NOT_REGISTERED when sender domain is missing from registry", () => {
    const result = classifySender({
      senderEmail: "send@stranger.com",
      senderName: "Example",
      emailDomains: [baseDomain({ status: "active", domain: "example.com" })],
      campaignType: "email",
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("DOMAIN_NOT_REGISTERED");
      expect(result.message).toMatch(/not registered/i);
    }
  });

  it.each(["paused", "blocked"] as const)(
    "blocks PAUSED for status=%s (reputation suspension)",
    (status) => {
      const result = classifySender({
        senderEmail: "send@example.com",
        senderName: "Example",
        emailDomains: [baseDomain({ status })],
        campaignType: "email",
      });
      expect(result.status).toBe("blocked");
      if (result.status === "blocked") {
        expect(result.reason).toBe("PAUSED");
        expect(result.message).toMatch(/paused/i);
        expect(result.message).toMatch(/contact support/i);
      }
    },
  );

  it.each(["failed", "error"] as const)(
    "blocks FAILED for status=%s (DNS verification failed)",
    (status) => {
      const result = classifySender({
        senderEmail: "send@example.com",
        senderName: "Example",
        emailDomains: [baseDomain({ status })],
        campaignType: "email",
      });
      expect(result.status).toBe("blocked");
      if (result.status === "blocked") {
        expect(result.reason).toBe("FAILED");
        expect(result.message).toMatch(/DNS verification failed/i);
      }
    },
  );

  it.each(["pending", "pending_dns", "verifying", "warming_up"] as const)(
    "warns PENDING_VERIFICATION for status=%s",
    (status) => {
      const result = classifySender({
        senderEmail: "send@example.com",
        senderName: "Example",
        emailDomains: [baseDomain({ status })],
        campaignType: "email",
      });
      expect(result.status).toBe("warning");
      if (result.status === "warning") {
        expect(result.reason).toBe("PENDING_VERIFICATION");
        expect(result.message).toMatch(/DNS verification is still propagating/i);
      }
    },
  );

  it("warns GENERIC_NAME when domain is active but display name is 'Your Business'", () => {
    const result = classifySender({
      senderEmail: "send@example.com",
      senderName: "Your Business",
      emailDomains: [baseDomain({ status: "active" })],
      campaignType: "email",
    });
    expect(result.status).toBe("warning");
    if (result.status === "warning") {
      expect(result.reason).toBe("GENERIC_NAME");
      expect(result.message).toMatch(/recipients recognize you/i);
    }
  });

  it("treats 'your business' (lowercase) as generic too", () => {
    const result = classifySender({
      senderEmail: "send@example.com",
      senderName: "your business",
      emailDomains: [baseDomain({ status: "active" })],
      campaignType: "email",
    });
    expect(result.status).toBe("warning");
    if (result.status === "warning") {
      expect(result.reason).toBe("GENERIC_NAME");
    }
  });

  it("returns ready when display name is a real brand", () => {
    const result = classifySender({
      senderEmail: "send@example.com",
      senderName: "Burnett's Garden Centre",
      emailDomains: [baseDomain({ status: "active" })],
      campaignType: "email",
    });
    expect(result).toEqual({ status: "ready" });
  });

  it("matches default_from_email even when senderEmail's local-part differs from domain row", () => {
    const result = classifySender({
      senderEmail: "hello@example.com",
      senderName: "Example",
      emailDomains: [
        baseDomain({
          status: "active",
          domain: "other.com",
          default_from_email: "hello@example.com",
        }),
      ],
      campaignType: "email",
    });
    expect(result).toEqual({ status: "ready" });
  });

  it("always returns ready for SMS campaigns regardless of email domain state", () => {
    const result = classifySender({
      senderEmail: "",
      senderName: "Your Business",
      emailDomains: [baseDomain({ status: "paused" })],
      campaignType: "sms",
    });
    expect(result).toEqual({ status: "ready" });
  });

  it("paused domain takes precedence over generic display name", () => {
    // A user with both problems should see the harder block first;
    // GENERIC_NAME only fires on the active-domain branch.
    const result = classifySender({
      senderEmail: "send@example.com",
      senderName: "Your Business",
      emailDomains: [baseDomain({ status: "paused" })],
      campaignType: "email",
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("PAUSED");
    }
  });
});

describe("resolveTenantSendingReadiness", () => {
  const verified = {
    id: "d1",
    domain: "northfieldgardens.ca",
    default_from_email: "mail@northfieldgardens.ca",
    default_from_name: "Northfield Garden Center",
    status: "active" as const,
    verified_at: "2026-11-22T12:30:07Z",
    manual_pause: false,
    investigation_mode: false,
    resend_status: {
      status: "verified",
      spf_verified: true,
      dkim_verified: true,
      return_path_verified: true,
    },
  };

  it("sends from the default domain's From address", () => {
    expect(
      resolveTenantSendingReadiness({ domains: [verified], defaultDomainId: "d1" }),
    ).toEqual({
      canSend: true,
      domainId: "d1",
      domain: "northfieldgardens.ca",
      fromEmail: "mail@northfieldgardens.ca",
      fromName: "Northfield Garden Center",
    });
  });

  it("falls back to mail@<domain> like the send path", () => {
    const result = resolveTenantSendingReadiness({
      domains: [{ ...verified, default_from_email: null }],
      defaultDomainId: null,
    });
    expect(result.canSend && result.fromEmail).toBe("mail@northfieldgardens.ca");
  });

  it("cannot send without a domain, while paused, or before DNS verifies", () => {
    expect(resolveTenantSendingReadiness({ domains: [], defaultDomainId: null })).toMatchObject({
      canSend: false,
      reason: "NO_DOMAIN",
    });
    expect(
      resolveTenantSendingReadiness({
        domains: [{ ...verified, manual_pause: true }],
        defaultDomainId: "d1",
      }),
    ).toMatchObject({ canSend: false, reason: "DOMAIN_PAUSED" });
    expect(
      resolveTenantSendingReadiness({
        domains: [{ ...verified, resend_status: { status: "verified", spf_verified: true } }],
        defaultDomainId: "d1",
      }),
    ).toMatchObject({ canSend: false, reason: "DOMAIN_NOT_VERIFIED" });
  });
});
