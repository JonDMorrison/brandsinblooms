import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewsletterInboxReview } from "../NewsletterInboxReview";
import { subjectLengthHint } from "@/lib/crm/newsletterInbox";
import type { StudioBlock } from "@/types/studioBlocks";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
const blocks: StudioBlock[] = [
  {
    id: "hero-1",
    type: "email-safe-hero",
    label: "Hero",
    order: 0,
    visible: true,
    headline: "Winter wreath workshops",
    body: "Join us November 14.",
  },
];
describe("NewsletterInboxReview", () => {
  it("fills an empty subject from the actual content and leaves preview text to the editor", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NewsletterInboxReview
        blocks={blocks}
        subject=""
        preview=""
        onChange={onChange}
      />,
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        subjectLine: "Winter wreath workshops",
      }),
    );
    // Preview text is drafted by usePreviewTextAutoDraft in the editor.
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ preheaderText: expect.anything() }),
    );
    onChange.mockClear();
    rerender(
      <NewsletterInboxReview blocks={blocks} subject="My own subject" preview="" onChange={onChange} />,
    );
    expect(onChange).not.toHaveBeenCalled();
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
    // Only the subject and preview pair is shown, never the model's reasoning.
    expect(
      screen.queryByText("A clear invitation with the date in preview text."),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    // Suggestions are links under the subject; choosing one fills both fields.
    await user.click(
      screen.getByRole("button", { name: /Use suggestion: Make a winter wreath/ }),
    );
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
  it("shows the inbox row with the sender initial, name, subject and preview", () => {
    render(
      <NewsletterInboxReview
        blocks={blocks}
        subject="Winter wreaths are here"
        preview="Join us November 14."
        senderName="Fernhill Gardens"
        onChange={vi.fn()}
      />,
    );
    const row = screen.getByTestId("inbox-preview-row");
    expect(row).toHaveTextContent("F");
    expect(row).toHaveTextContent("Fernhill Gardens");
    expect(row).toHaveTextContent("Winter wreaths are here");
    expect(row).toHaveTextContent("Join us November 14.");
    expect(screen.getByTestId("subject-length-hint")).toHaveTextContent("A little short. Aim for 40 to 60");
  });
  it("explains the subject length in three bands, coloured with warning and success", () => {
    expect(subjectLengthHint(0)).toEqual({ message: "A little short. Aim for 40 to 60", tone: "warning" });
    expect(subjectLengthHint(39)).toEqual({ message: "A little short. Aim for 40 to 60", tone: "warning" });
    expect(subjectLengthHint(40)).toEqual({ message: "Good length", tone: "success" });
    expect(subjectLengthHint(60)).toEqual({ message: "Good length", tone: "success" });
    expect(subjectLengthHint(61)).toEqual({ message: "May be cut off on phones", tone: "warning" });
    const { rerender } = render(
      <NewsletterInboxReview blocks={blocks} subject={"a".repeat(45)} preview="Join us November 14." onChange={vi.fn()} />,
    );
    const hint = screen.getByTestId("subject-length-hint");
    expect(hint).toHaveTextContent("Good length");
    expect(hint).toHaveAttribute("data-tone", "success");
    expect(screen.getByText(/45 characters ·/)).toBeInTheDocument();
    rerender(
      <NewsletterInboxReview blocks={blocks} subject={"a".repeat(70)} preview="Join us November 14." onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("subject-length-hint")).toHaveTextContent("May be cut off on phones");
    expect(screen.getByTestId("subject-length-hint")).toHaveAttribute("data-tone", "warning");
  });
  it("shows only suggestions under 60 characters, with no em dashes or exclamation marks", async () => {
    const user = userEvent.setup();
    invoke.mockResolvedValue({
      data: {
        suggestions: [
          { subject: "Wreath workshops — book your seat!", preview: "Classes start November 14!" },
          { subject: "A".repeat(60), preview: "Too long to keep" },
          { subject: "Winter wreaths are back", preview: "Join us November 14." },
        ],
      },
    });
    render(<NewsletterInboxReview blocks={blocks} subject="My subject" preview="My preview" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Help me improve this" }));
    const list = await screen.findByTestId("subject-suggestions");
    expect(list).toHaveTextContent("Wreath workshops, book your seat");
    expect(list).toHaveTextContent("Classes start November 14");
    expect(list).toHaveTextContent("Winter wreaths are back");
    expect(list.textContent).not.toMatch(/[—!]/);
    expect(list).not.toHaveTextContent("A".repeat(60));
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
