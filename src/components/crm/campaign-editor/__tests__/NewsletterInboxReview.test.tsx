import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewsletterInboxReview } from "../NewsletterInboxReview";
import type { StudioBlock } from "@/types/studioBlocks";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
const blocks = [
  {
    type: "hero",
    headline: "Winter wreath workshops",
    body: "Join us November 14.",
  },
] as StudioBlock[];
describe("NewsletterInboxReview", () => {
  it("fills only empty fields from the actual content", async () => {
    const onChange = vi.fn();
    render(
      <NewsletterInboxReview
        blocks={blocks}
        subject="My own subject"
        preview=""
        onChange={onChange}
      />,
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        preheaderText: "Join us November 14.",
      }),
    );
  });
  it("keeps AI suggestions reviewable until a pair is explicitly chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    invoke.mockResolvedValue({
      data: {
        suggestions: [
          {
            subject: "Make a winter wreath",
            preview: "Join us November 14.",
            reason: "A clear invitation with the date in preview text.",
          },
        ],
      },
    });
    render(
      <NewsletterInboxReview
        blocks={blocks}
        subject="My subject"
        preview="My preview"
        onChange={onChange}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Help me improve this" }),
    );
    await screen.findByText("Make a winter wreath");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Use this pair" }));
    expect(onChange).toHaveBeenCalledWith({
      subjectLine: "Make a winter wreath",
      preheaderText: "Join us November 14.",
    });
  });
});
