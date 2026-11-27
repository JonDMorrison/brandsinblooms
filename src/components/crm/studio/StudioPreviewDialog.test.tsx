import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import StudioPreviewDialog from "./StudioPreviewDialog";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "owner@fernhill.com" } }),
}));
vi.mock("@/contexts/DesignSystemContext", () => ({
  useDesignSystem: () => ({ designSystem: buildStudioDesignSystem({} as never) }),
}));
vi.mock("./newsletter/NewsletterDesignContext", () => ({
  useNewsletterDesign: () => ({ settings: undefined }),
}));
// jsdom cannot load images; every image "loads".
vi.mock("@/lib/studio/newsletter/messageCheck", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/studio/newsletter/messageCheck")>();
  return { ...actual, findBrokenImages: async () => [] };
});

const blocks = [
  { ...createStudioBlock("image-text"), id: "it", headline: "Fall", buttonText: "Shop now", buttonUrl: "" },
] as StudioBlock[];

describe("Preview & Test: Check message", () => {
  it("lists problems under the block they belong to", async () => {
    render(
      <StudioPreviewDialog open onClose={() => undefined} blocks={blocks} subjectLine="Fall" previewText="" campaignId="c1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check message" }));
    const report = await screen.findByRole("region", { name: "Message check" });
    await waitFor(() => expect(report).toHaveTextContent(/1 problem and 0 warnings/));
    expect(report).toHaveTextContent("Image + Text");
    expect(report).toHaveTextContent('The button "Shop now" has no web address');
  });

  it("says all clear when there is nothing to fix", async () => {
    render(
      <StudioPreviewDialog
        open
        onClose={() => undefined}
        blocks={[{ ...createStudioBlock("plain-text"), id: "t", body: "<p>Hello</p>" } as StudioBlock]}
        subjectLine="Hi"
        previewText=""
        campaignId="c1"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check message" }));
    expect(await screen.findByText(/All clear/)).toBeInTheDocument();
  });
});

describe("Preview & Test: Send test recipient", () => {
  beforeEach(() => {
    invoke.mockReset();
    window.sessionStorage.clear();
  });

  const renderDialog = (props: Partial<React.ComponentProps<typeof StudioPreviewDialog>> = {}) =>
    render(
      <StudioPreviewDialog
        open
        onClose={() => undefined}
        blocks={blocks}
        subjectLine="Fall"
        previewText=""
        campaignId="c1"
        {...props}
      />,
    );

  it("opens from Studio with the signed-in user's email filled in and sends nothing", () => {
    // Studio's top bar opens the dialog on Preview; the user switches tabs.
    renderDialog();
    fireEvent.click(screen.getByRole("tab", { name: "Send test" }));
    expect(screen.getByRole("textbox", { name: "Test recipient" })).toHaveValue("owner@fernhill.com");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("opens from the campaign editor on Send test with the same email", () => {
    renderDialog({ initialTab: "test" });
    expect(screen.getByRole("tab", { name: "Send test" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Test recipient" })).toHaveValue("owner@fernhill.com");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps the field editable and checks the address format before sending", async () => {
    renderDialog({ initialTab: "test" });
    const field = screen.getByRole("textbox", { name: "Test recipient" });
    fireEvent.change(field, { target: { value: "not-an-email" } });
    expect(field).toHaveValue("not-an-email");
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect(await screen.findByText(/Enter a valid email address/)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fills in the last address used for a test this session next time", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const first = renderDialog({ initialTab: "test" });
    fireEvent.change(screen.getByRole("textbox", { name: "Test recipient" }), {
      target: { value: "manager@fernhill.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect(await screen.findByText("Test email sent.")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      "send-test-email-v2",
      expect.objectContaining({ body: expect.objectContaining({ toEmail: "manager@fernhill.com" }) }),
    );
    first.unmount();

    renderDialog({ initialTab: "test" });
    expect(screen.getByRole("textbox", { name: "Test recipient" })).toHaveValue("manager@fernhill.com");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("does not remember an address whose test failed", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Nope" } });
    const first = renderDialog({ initialTab: "test" });
    fireEvent.change(screen.getByRole("textbox", { name: "Test recipient" }), {
      target: { value: "typo@fernhill.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect(await screen.findByText("Nope")).toBeInTheDocument();
    first.unmount();

    renderDialog({ initialTab: "test" });
    expect(screen.getByRole("textbox", { name: "Test recipient" })).toHaveValue("owner@fernhill.com");
  });
});
