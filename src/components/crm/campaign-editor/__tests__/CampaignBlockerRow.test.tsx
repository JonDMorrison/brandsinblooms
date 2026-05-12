import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CampaignBlockerRow } from "@/components/crm/campaign-editor/CampaignBlockerRow";
import { resolveCampaignBlocker } from "@/components/crm/campaign-editor/campaignBlockerLogic";

describe("CampaignBlockerRow", () => {
  it("renders null when there are no blockers", () => {
    const { container } = render(<CampaignBlockerRow />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the sender-unverified message and triggers the verify handler", async () => {
    const onVerifySender = vi.fn();
    const user = userEvent.setup();
    render(
      <CampaignBlockerRow
        senderUnverified
        onVerifySender={onVerifySender}
      />,
    );

    expect(
      screen.getByText("Verify your sender email to send"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /verify sender/i }));
    expect(onVerifySender).toHaveBeenCalledOnce();
  });

  it("prioritizes sender-unverified over every other blocker", () => {
    render(
      <CampaignBlockerRow
        senderUnverified
        audienceEmpty
        contentEmpty
        subjectEmpty
        draftConflict
      />,
    );
    expect(
      screen.getByText("Verify your sender email to send"),
    ).toBeInTheDocument();
  });

  it("prioritizes audience-empty over content/subject/draft", () => {
    render(
      <CampaignBlockerRow
        audienceEmpty
        contentEmpty
        subjectEmpty
        draftConflict
      />,
    );
    expect(screen.getByText("Pick who this is for")).toBeInTheDocument();
  });

  it("prioritizes content-empty over subject/draft", () => {
    render(
      <CampaignBlockerRow contentEmpty subjectEmpty draftConflict />,
    );
    expect(
      screen.getByText("Add some content to your campaign"),
    ).toBeInTheDocument();
  });

  it("prioritizes subject-empty over draft-conflict", () => {
    render(<CampaignBlockerRow subjectEmpty draftConflict />);
    expect(screen.getByText("Add a subject line")).toBeInTheDocument();
  });

  it("shows the draft-conflict message when it is the only blocker", () => {
    render(<CampaignBlockerRow draftConflict />);
    expect(
      screen.getByText(
        "This campaign was edited elsewhere. Reload to continue.",
      ),
    ).toBeInTheDocument();
  });

  it("resolveCampaignBlocker returns null when no signals are set", () => {
    expect(resolveCampaignBlocker({}, {})).toBeNull();
  });

  it("resolveCampaignBlocker exposes the full priority order", () => {
    const handlers = {};
    expect(
      resolveCampaignBlocker(
        {
          senderUnverified: true,
          audienceEmpty: true,
          contentEmpty: true,
          subjectEmpty: true,
          draftConflict: true,
        },
        handlers,
      )?.kind,
    ).toBe("sender-unverified");

    expect(
      resolveCampaignBlocker(
        {
          audienceEmpty: true,
          contentEmpty: true,
          subjectEmpty: true,
          draftConflict: true,
        },
        handlers,
      )?.kind,
    ).toBe("audience-empty");

    expect(
      resolveCampaignBlocker(
        { contentEmpty: true, subjectEmpty: true, draftConflict: true },
        handlers,
      )?.kind,
    ).toBe("content-empty");

    expect(
      resolveCampaignBlocker(
        { subjectEmpty: true, draftConflict: true },
        handlers,
      )?.kind,
    ).toBe("subject-empty");

    expect(
      resolveCampaignBlocker({ draftConflict: true }, handlers)?.kind,
    ).toBe("draft-conflict");
  });
});
