import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BlockPropertiesPanel from "./BlockPropertiesPanel";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

vi.mock("@/contexts/DesignSystemContext", () => ({
  useOptionalDesignSystem: () => null,
  useDesignSystem: () => ({ designSystem: buildStudioDesignSystem({} as never) }),
}));
vi.mock("./fields/StudioImageUpload", () => ({
  default: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock("./fields/StudioTextField", () => ({
  default: ({ label }: { label: string }) => <label>{label}</label>,
}));

describe("hero photo discoverability", () => {
  it.each([undefined, "solid", "gradient", "image-overlay", "image-bottom"] as const)(
    "shows photo control before text fields for %s", (heroStyle) => {
      const block = { id: "hero", type: "email-safe-hero", label: "Hero", order: 0, visible: true, heroStyle } as StudioBlock;
      render(<BlockPropertiesPanel campaignImageGallery={[]} campaignName="Winter" campaignType="newsletter"
        selectedBlockId="hero" blocks={[block]} open onClose={() => {}} onUpdateBlockField={() => {}} />);
      const photo = screen.getByRole("button", { name: heroStyle === "image-overlay" ? "Background photo" : "Hero photo" });
      const headline = screen.getByText("Headline");
      expect(photo.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );
});
