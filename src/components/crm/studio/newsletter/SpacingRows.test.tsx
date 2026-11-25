import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ButtonPaddingFields, ImageSpacingFields } from "./AppearanceControls";
import type { BlockAppearance } from "@/types/newsletterDesign";

function Harness({ onChange }: { onChange: (next: BlockAppearance) => void }) {
  const [value, setValue] = React.useState<BlockAppearance>({});
  return (
    <ImageSpacingFields
      collapsible={false}
      value={value}
      onChange={(next) => { setValue(next); onChange(next); }}
    />
  );
}

describe("spacing rows: short labels, slider and number on one line", () => {
  it("labels each side Top / Right / Bottom / Left inside the padding group", () => {
    render(<Harness onChange={() => undefined} />);
    expect(screen.getByText("Image padding (px)")).toBeInTheDocument();
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      expect(screen.getAllByText(side)).toHaveLength(2); // padding + margin groups
    }
    expect(screen.queryByText("Image padding top")).toBeNull();
    // The number box keeps the full name for screen readers.
    expect(screen.getByLabelText("Image padding top")).toBeInTheDocument();
  });

  it("the slider and the number box set the same value", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Image padding top slider"), { target: { value: "24" } });
    expect(onChange).toHaveBeenLastCalledWith({ imagePadding: { top: 24 } });
    expect(screen.getByLabelText("Image padding top")).toHaveValue(24);
    fireEvent.change(screen.getByLabelText("Image padding top"), { target: { value: "12" } });
    expect(onChange).toHaveBeenLastCalledWith({ imagePadding: { top: 12 } });
    expect(screen.getByLabelText("Image padding top slider")).toHaveValue("12");
  });

  it("groups the button padding in a fieldset with short labels", () => {
    render(<ButtonPaddingFields collapsible={false} value={{}} onChange={() => undefined} />);
    expect(screen.getByText("Button padding (px)")).toBeInTheDocument();
    expect(screen.getByText("Sides")).toBeInTheDocument();
    expect(screen.getByText("Top / bottom")).toBeInTheDocument();
    expect(screen.getByLabelText("Button horizontal padding")).toBeInTheDocument();
  });
});
