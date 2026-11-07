import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { HelpWidget } from "@/components/ui/HelpWidget";

vi.mock("@/components/bloomSupport/ReportProblemDialog", () => ({
  ReportProblemDialog: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Modern support request">Modern support request</div> : null,
}));

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe("HelpWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("contains no legacy intake endpoint or separate call-booking journey", () => {
    const source = readFileSync("src/components/ui/HelpWidget.tsx", "utf8");
    expect(source).not.toContain("submit-support-request");
    expect(source).not.toContain("supabase.functions.invoke");
    expect(source).not.toContain("calendly.com");
  });

  it("routes every contact request through the modern Bloom Support dialog", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><HelpWidget /></MemoryRouter>);

    const trigger = screen.getByRole("button", { name: "Open help and support" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "How can Bloom help?" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Subject")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start a support request" }));
    expect(screen.getByRole("dialog", { name: "Modern support request" })).toBeInTheDocument();
    expect(screen.queryByText("Book a Call")).not.toBeInTheDocument();
  });

  it("has keyboard-safe focus, escape close, and one route to support history", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/dashboard"]}><HelpWidget /><Location /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: "Open help and support" });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Start a support request" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "How can Bloom help?" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Open Help & Support" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/support");
  });
});
