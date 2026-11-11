import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StudioColorPicker from "../fields/StudioColorPicker";
import { ColorField, NumericField } from "./AppearanceControls";

vi.mock("@/contexts/DesignSystemContext", () => ({
  useOptionalDesignSystem: () => ({
    designSystem: {
      colors: {
        primary: "#112233",
        secondary: "#445566",
        accent: "#778899",
      },
      colorPresets: { core: ["#112233", "#445566", "#778899", "#AABBCC"], expanded: ["#CCAA88"] },
    },
  }),
}));


const orderedSwatches = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter(
    (button) => button.getAttribute("aria-label")?.startsWith("Select "),
  );

describe("newsletter colour controls", () => {
  it("places the three configured brand colours directly after None, black and white", () => {
    const { container } = render(
      <StudioColorPicker
        label="Button colour"
        value="#445566"
        presets={["#C0FFEE", "#112233"]}
      />,
    );
    const swatches = orderedSwatches(container);
    expect(swatches.slice(0, 7).map((button) => button.title)).toEqual([
      "None / transparent",
      "#000000",
      "#FFFFFF",
      "Brand primary · #112233",
      "Brand secondary · #445566",
      "Brand accent · #778899",
      "#C0FFEE",
    ]);
    expect(swatches[4]).toHaveAttribute("aria-pressed", "true");
    expect(swatches.filter((button) => button.title === "Brand primary · #112233")).toHaveLength(1);
    const hex = screen.getByRole("textbox", { name: "Button colour hex colour" });
    expect(swatches[5].compareDocumentPosition(hex) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });


  it("puts None, black, and white first, even with a different brand palette", () => {
    const change = vi.fn();
    const { container } = render(
      <StudioColorPicker
        label="Button colour"
        value="#345678"
        presets={["#345678", "#ffffff", "#000000", "#AABBCC"]}
        onChange={change}
      />,
    );
    const swatches = orderedSwatches(container);
    expect(swatches.slice(0, 3).map((button) => button.getAttribute("title"))).toEqual([
      "None / transparent",
      "#000000",
      "#FFFFFF",
    ]);
    expect(swatches.filter((button) => button.title === "#FFFFFF")).toHaveLength(1);
    fireEvent.click(swatches[0]);
    expect(change).toHaveBeenCalledWith("transparent");
    fireEvent.click(swatches[1]);
    expect(change).toHaveBeenCalledWith("#000000");
    fireEvent.change(screen.getByRole("textbox", { name: "Button colour hex colour" }), {
      target: { value: "#abc123" },
    });
    expect(change).toHaveBeenCalledWith("#abc123");
  });

  it("offers the same ordered swatches in the master typography colour fields", () => {
    const change = vi.fn();
    const { container } = render(
      <ColorField label="Block background" transparent value="#345678" onChange={change} />,
    );
    const swatches = orderedSwatches(container);
    expect(swatches.slice(0, 3).map((button) => button.getAttribute("title"))).toEqual([
      "None / transparent",
      "#000000",
      "#FFFFFF",
    ]);
    fireEvent.click(swatches[0]);
    expect(change).toHaveBeenCalledWith("transparent");
    fireEvent.change(screen.getByLabelText("Choose custom colour for Block background"), {
      target: { value: "#123456" },
    });
    expect(change).toHaveBeenCalledWith("#123456");
  });

  it("clears an inherited text colour without making invisible text", () => {
    const change = vi.fn();
    const { container } = render(
      <ColorField label="Text colour" value="#456789" onChange={change} />,
    );
    fireEvent.click(orderedSwatches(container)[0]);
    expect(change).toHaveBeenCalledWith(undefined);
  });
});

describe("newsletter pixel inputs", () => {
  it("does not replace an unfinished font size with the minimum as the user types", () => {
    function Example() {
      const [size, setSize] = React.useState<number | undefined>(16);
      return <NumericField label="Size (px)" min={8} max={96} value={size} onChange={setSize} />;
    }
    render(<Example />);
    const input = screen.getByRole("spinbutton", { name: "Size (px)" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1" } });
    expect(input.value).toBe("1");
    fireEvent.change(input, { target: { value: "12" } });
    expect(input.value).toBe("12");
    fireEvent.blur(input);
    expect(input.value).toBe("12");
  });

  it("allows a complete email width before validating and clamps only on blur", () => {
    function Example() {
      const [width, setWidth] = React.useState<number | undefined>(640);
      return <NumericField label="Email width (px)" min={480} max={800} value={width} onChange={setWidth} />;
    }
    render(<Example />);
    const input = screen.getByRole("spinbutton", { name: "Email width (px)" }) as HTMLInputElement;
    for (const partial of ["7", "70", "700"]) {
      fireEvent.change(input, { target: { value: partial } });
      expect(input.value).toBe(partial);
    }
    fireEvent.blur(input);
    expect(input.value).toBe("700");
    fireEvent.change(input, { target: { value: "999" } });
    expect(input.value).toBe("999");
    fireEvent.blur(input);
    expect(input.value).toBe("800");
  });
});
