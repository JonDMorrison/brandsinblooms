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
  it("offers refreshed suggestions after content changes without replacing authored text", async () => {
    invoke.mockResolvedValue({
      data: {
        suggestions: [
          { subject: "Winter", preview: "November 14", reason: "Date" },
        ],
      },
    });
    const onChange = vi.fn();
    const { rerender } = render(
      <NewsletterInboxReview
        blocks={blocks}
        subject="My words"
        preview="My preview"
        onChange={onChange}
      />,
    );
    await screen.findByText("Winter");
    rerender(
      <NewsletterInboxReview
        blocks={[{ ...blocks[0], headline: "Christmas trees arrive tomorrow" }]}
        subject="My words"
        preview="My preview"
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Refresh suggestions from updated content",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Winter")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("remembers a content scan across returning from Studio and preserves manual copy", async () => {
    sessionStorage.clear();
    invoke.mockResolvedValue({ data: { suggestions: [{ subject: "Wreaths", preview: "November", reason: "Seasonal" }] } });
    const onChange = vi.fn();
    const first = render(<NewsletterInboxReview campaignId="review-test" blocks={blocks} subject="My subject" preview="My preview" onChange={onChange} />);
    await screen.findByText("Wreaths");
    first.unmount();
    invoke.mockClear();
    render(<NewsletterInboxReview campaignId="review-test" blocks={[{ ...blocks[0], headline: "A completely different sale" }]} subject="My subject" preview="My preview" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Refresh suggestions from updated content" })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    sessionStorage.clear();
  });

});
