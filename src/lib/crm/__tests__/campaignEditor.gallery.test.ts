import { describe, expect, it } from "vitest";

import { normalizeLoadedContentBlocks } from "../campaignEditor";
import type { ContentBlock } from "@/types/emailBuilder";

describe("normalizeLoadedContentBlocks", () => {
  it("retypes legacy product gallery blocks loaded as image-gallery", () => {
    const blocks: ContentBlock[] = [
      {
        id: "legacy-product-gallery",
        type: "image-gallery",
        source: "manual",
        headline: "Holiday Products",
        galleryItems: [],
      } as ContentBlock,
      {
        id: "image-gallery",
        type: "image-gallery",
        source: "manual",
        headline: "Photo Grid",
        galleryImages: [],
      } as ContentBlock,
    ];

    const result = normalizeLoadedContentBlocks(blocks);

    expect(result[0].type).toBe("product-gallery");
    expect(result[1].type).toBe("image-gallery");
  });
});
