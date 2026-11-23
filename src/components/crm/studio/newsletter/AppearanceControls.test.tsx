import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StudioColorPicker from "../fields/StudioColorPicker";
import AppearanceControls, { ColorField, NumericField } from "./AppearanceControls";

import { createStudioBlock } from "@/lib/studio/blockFactory";
import { NewsletterDesignContext } from "./NewsletterDesignContext";

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
  it("places the three configured brand colours first, then None, black and white", () => {
    const { container } = render(
      <StudioColorPicker
        label="Button colour"
        value="#445566"
        presets={["#C0FFEE", "#112233"]}
      />,
    );
    const swatches = orderedSwatches(container);
    expect(swatches.slice(0, 7).map((button) => button.title)).toEqual([
      "Brand primary · #112233",
      "Brand secondary · #445566",
      "Brand accent · #778899",
      "None / transparent",
      "#000000",
      "#FFFFFF",
      "#C0FFEE",
    ]);
    expect(swatches[1]).toHaveAttribute("aria-pressed", "true");
    expect(swatches.filter((button) => button.title === "Brand primary · #112233")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Pick any colour, or type a colour code" }));
    const hex = screen.getByRole("textbox", { name: "Button colour hex colour" });
    expect(swatches[5].compareDocumentPosition(hex) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });


  it("puts the brand palette first, then None, black and white", () => {
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
    expect(swatches.slice(0, 6).map((button) => button.getAttribute("title"))).toEqual([
      "Brand primary · #112233",
      "Brand secondary · #445566",
      "Brand accent · #778899",
      "None / transparent",
      "#000000",
      "#FFFFFF",
    ]);
    expect(swatches.filter((button) => button.title === "#FFFFFF")).toHaveLength(1);
    fireEvent.click(swatches[3]);
    expect(change).toHaveBeenCalledWith("transparent");
    fireEvent.click(swatches[4]);
    expect(change).toHaveBeenCalledWith("#000000");
    fireEvent.click(screen.getByRole("button", { name: "Pick any colour, or type a colour code" }));
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
    expect(swatches.slice(0, 6).map((button) => button.getAttribute("title"))).toEqual([
      "Brand primary · #112233",
      "Brand secondary · #445566",
      "Brand accent · #778899",
      "None / transparent",
      "#000000",
      "#FFFFFF",
    ]);
    fireEvent.click(swatches[3]);
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
    // "None" now follows the three brand swatches.
    fireEvent.click(orderedSwatches(container)[3]);
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

describe("block-specific appearance", () => {
  it.each(["divider", "spacer", "full-width-image"] as const)(
    "shows relevant spacing controls for %s",
    (type) => {
      render(<AppearanceControls block={createStudioBlock(type)} onChange={vi.fn()} />);
      expect(screen.getByText("Block Spacing and Margins")).toBeInTheDocument();
      expect(screen.queryByText("Typography & colours")).toBeNull();
      expect(screen.queryByLabelText("Button horizontal padding")).toBeNull();
      if (type !== "full-width-image") expect(screen.queryByText("Border & label")).toBeNull();
    },
  );

  it("keeps body typography and the original sides when one padding edge is changed", () => {
    const update = vi.fn();
    const block = { ...createStudioBlock("plain-text"), contentPadding: 32 };
    render(<AppearanceControls block={block} onChange={update} />);
    expect(screen.queryByLabelText("Text element")).toBeNull();
    expect(screen.queryByLabelText("Image margin left")).toBeNull();
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "700" } });
    expect(update).toHaveBeenCalledWith({ text: { body: { weight: 700 } } });
    fireEvent.change(screen.getByLabelText("Padding left"), { target: { value: "12" } });
    expect(update).toHaveBeenCalledWith({ padding: { top: 32, bottom: 32, left: 12, right: 24 } });
  });

  it("keeps newsletter padding inheritable when editing one edge of a text block", () => {
    const update = vi.fn();
    render(
      <NewsletterDesignContext.Provider value={{
        settings: { version: 1, defaults: { padding: { top: 18, left: 16 } } },
      }}>
        <AppearanceControls block={createStudioBlock("plain-text")} onChange={update} />
      </NewsletterDesignContext.Provider>,
    );
    const field = screen.getByLabelText("Padding left");
    expect(field).toHaveAttribute("placeholder", "16");
    fireEvent.change(field, { target: { value: "12" } });
    expect(update).toHaveBeenCalledWith({ padding: { left: 12 } });
  });

  it("keeps the full typography role list in newsletter settings", () => {
    render(<AppearanceControls master onChange={vi.fn()} />);
    const choices = Array.from(screen.getByLabelText<HTMLSelectElement>("Text element").options);
    expect(choices.map((option) => option.value)).toEqual(
      expect.arrayContaining(["h1", "h6", "body", "button", "smallPrint"]),
    );
  });
});
