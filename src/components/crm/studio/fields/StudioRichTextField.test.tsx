import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudioRichTextField from "./StudioRichTextField";

describe("newsletter body personalization", () => {
  it("keeps personalization outside the scrolling toolbar and inserts FNAME into body HTML", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <div style={{ width: 280 }}>
        <StudioRichTextField label="Body Text" value="<p>Hello </p>" onChange={onChange} />
      </div>,
    );
    const personalize = await screen.findByRole("button", { name: "Personalize" });
    // The formatting toolbar scrolls in narrow property panels. Personalize
    // must stay in the field header, where it remains directly discoverable.
    expect(personalize.parentElement?.textContent).toContain("Body Text");
    expect(personalize.parentElement?.querySelector('[aria-label="Bold"]')).toBeNull();
    fireEvent.click(personalize);
    expect(personalize).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: /First name \(FNAME\)/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toContain("{{first_name}}");
    expect(container.querySelector(".tiptap")?.textContent).toContain("{{first_name}}");
    expect(personalize).toHaveAttribute("aria-expanded", "false");
  });
});
