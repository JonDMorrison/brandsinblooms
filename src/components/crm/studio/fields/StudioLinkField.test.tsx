import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudioLinkField from "./StudioLinkField";

const ERROR = "Enter a full link, like https://yourstore.com";

function Harness({
  initial = "",
  required = false,
  onValue,
}: {
  initial?: string;
  required?: boolean;
  onValue?: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <StudioLinkField
      label="Link (web address)"
      value={value}
      required={required}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

function linkBox() {
  return screen.getByPlaceholderText("https://...");
}

describe("StudioLinkField", () => {
  it("shows the inline error and aria-invalid for an invalid link after leaving the field", () => {
    render(<Harness />);
    const input = linkBox();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "www shop" } });
    // No error while the person is still typing.
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");

    fireEvent.blur(input);
    const error = screen.getByText(ERROR);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("flags a saved invalid link straight away", () => {
    render(<Harness initial="htp://x" />);
    expect(screen.getByText(ERROR)).toBeInTheDocument();
    expect(linkBox()).toHaveAttribute("aria-invalid", "true");
  });

  it("refuses javascript: links", () => {
    render(<Harness initial="javascript:alert(1)" />);
    expect(screen.getByText(/can't be used in an email/)).toBeInTheDocument();
    expect(linkBox()).toHaveAttribute("aria-invalid", "true");
  });

  it("turns a bare domain into an https:// link on blur", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = linkBox();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "shop.example.com" } });
    fireEvent.blur(input);
    expect(onValue).toHaveBeenLastCalledWith("https://shop.example.com");
    expect(input).toHaveValue("https://shop.example.com");
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("accepts merge tag links", () => {
    render(<Harness initial="{{ system.unsubscribe_url }}" />);
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it("asks for a link only when the button needs one", () => {
    const { unmount } = render(<Harness required />);
    expect(screen.getByText(ERROR)).toBeInTheDocument();
    unmount();
    render(<Harness />);
    expect(screen.queryByText(ERROR)).toBeNull();
  });
});
