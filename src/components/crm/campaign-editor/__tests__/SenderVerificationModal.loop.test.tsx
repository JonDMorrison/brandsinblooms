import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SenderVerificationModal } from "@/components/crm/campaigns/SenderVerificationModal";

const fixture = vi.hoisted(() => ({
  domains: [
    {
      id: "verified-domain-1",
      tenant_id: "garden-centre-1",
      domain: "baltimorevalley.ca",
      default_from_email: "info@baltimorevalley.ca",
      status: "active",
    },
  ],
  refresh: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/useEmailDomains", () => ({
  useEmailDomains: () => ({
    emailDomains: fixture.domains,
    loading: false,
    refetch: fixture.refresh,
    verifyEmailDomain: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/crm/settings/DomainConnectWizard", () => ({
  DomainConnectWizard: () => null,
}));

function renderVerification(
  campaignSenderEmail: string,
  onChooseVerifiedSender?: (email: string) => void,
) {
  const onOpenChange = vi.fn();
  render(
    <MemoryRouter>
      <SenderVerificationModal
        open
        senderConfig={{
          isVerified: true,
          companyName: "Baltimore Valley",
          senderEmail: "info@baltimorevalley.ca",
          fromEmailDomainId: "verified-domain-1",
        }}
        campaignSenderEmail={campaignSenderEmail}
        onChooseVerifiedSender={onChooseVerifiedSender}
        onOpenChange={onOpenChange}
      />
    </MemoryRouter>,
  );
  return onOpenChange;
}

beforeEach(() => {
  fixture.domains = [
    {
      id: "verified-domain-1",
      tenant_id: "garden-centre-1",
      domain: "baltimorevalley.ca",
      default_from_email: "info@baltimorevalley.ca",
      status: "active",
    },
  ];
  fixture.refresh.mockClear();
});

describe("sender verification campaign loop", () => {
  it("chooses the active verified sender before returning to a blank-sender draft", async () => {
    const choose = vi.fn();
    const close = renderVerification("", choose);
    expect(screen.getByText(/your domain is verified.*use info@baltimorevalley.ca/i)).toBeVisible();
    await userEvent.setup().click(
      screen.getByRole("button", { name: /use info@baltimorevalley.ca & continue/i }),
    );
    expect(choose).toHaveBeenCalledExactlyOnceWith("info@baltimorevalley.ca");
    expect(close).toHaveBeenCalledWith(false);
  });

  it("does not discard an explicitly configured, verified campaign sender", async () => {
    const choose = vi.fn();
    const close = renderVerification("events@baltimorevalley.ca", choose);
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Continue with Campaign" }),
    );
    expect(choose).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);
  });

  it("requires explicit selection when the campaign has a different unverified sender", async () => {
    const choose = vi.fn();
    const close = renderVerification("newsletter@unverified.example", choose);
    await userEvent.setup().click(
      screen.getByRole("button", { name: /use info@baltimorevalley.ca & continue/i }),
    );
    expect(choose).toHaveBeenCalledExactlyOnceWith("info@baltimorevalley.ca");
    expect(close).toHaveBeenCalledWith(false);
  });

  it("does not allow closing via Continue if the campaign cannot receive the verified sender", () => {
    renderVerification("");
    expect(screen.getByTestId("sender-verification-continue")).toBeDisabled();
  });

  it("does not claim an unverified DNS domain can be used for sending", () => {
    fixture.domains = fixture.domains.map((domain) => ({ ...domain, status: "pending_dns" }));
    renderVerification("", vi.fn());
    expect(screen.queryByTestId("sender-verification-continue")).not.toBeInTheDocument();
    expect(screen.getByText("Domain Verification Pending")).toBeInTheDocument();
  });
});
