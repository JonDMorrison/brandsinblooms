import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import StudioPreviewDialog from "./StudioPreviewDialog";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
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
