import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import SharedEmailBlockPreview from "./SharedEmailBlockPreview";

vi.mock("@/contexts/DesignSystemContext", () => ({
  useDesignSystem: () => ({ designSystem: null }),
}));
vi.mock("./NewsletterDesignContext", () => ({
  useNewsletterDesign: () => ({ settings: undefined }),
}));
vi.mock("../fields/StudioImageUpload", () => ({
  uploadStudioImageFile: vi.fn(),
}));

const emptySocial = {
  ...createStudioBlock("social-follow"),
  id: "social",
  socialLinks: [],
} as StudioBlock;

describe("empty block notice", () => {
  it("shows an amber warning on the canvas with a short, actionable message", () => {
    render(<SharedEmailBlockPreview block={emptySocial} onUpdateBlockField={vi.fn()} />);
    const notice = screen.getByTestId("studio-empty-block-notice");
    expect(notice).toHaveTextContent("This block is empty. Add content or remove it.");
    expect(notice).toHaveAttribute("role", "note");
    // Joy's soft warning Alert (amber palette), not a grey box.
    expect(notice.className).toMatch(/colorWarning/);
    expect(notice.className).toMatch(/variantSoft/);
  });

  it("is never part of the email HTML that is exported or sent", () => {
    const html = generateEmailHtml({
      audience: { previewAll: true },
      blocks: [emptySocial, { ...createStudioBlock("plain-text"), id: "t", body: "<p>Hello</p>" } as StudioBlock],
      subject: "Hi",
      previewText: "",
      footer: null,
      mergeData: {},
      designSystem: buildStudioDesignSystem({} as never),
    });
    expect(html).toContain("Hello");
    expect(html).not.toContain("This block is empty");
    expect(html).not.toContain("studio-empty-block-notice");
    expect(html).not.toContain("Add content or remove it");
  });
});
