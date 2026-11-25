import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExtendedBlockProperties from "./ExtendedBlockProperties";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioBlock } from "@/types/studioBlocks";

vi.mock("./NewsletterDesignContext", () => ({ useNewsletterDesign: () => ({ settings: {} }) }));

function Harness() {
  const [block, setBlock] = React.useState<StudioBlock>(createStudioBlock("html"));
  return <ExtendedBlockProperties block={block} update={(field, value) => setBlock((b) => ({ ...b, [field]: value }))} />;
}

describe("HTML block panel", () => {
  it("keeps the code as typed and lists what will be left out", () => {
    render(<Harness />);
    const box = screen.getByLabelText("HTML code") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: '<p onclick="x">Hi</p><script>x</script>' } });
    expect(box.value).toBe('<p onclick="x">Hi</p><script>x</script>');
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent('event handler "onclick"');
    expect(note).toHaveTextContent("<script> and its contents");
  });

  it("shows no warning for clean code", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("HTML code"), { target: { value: '<table width="100%"><tr><td>Hi</td></tr></table>' } });
    expect(screen.queryByRole("note")).toBeNull();
  });
});
