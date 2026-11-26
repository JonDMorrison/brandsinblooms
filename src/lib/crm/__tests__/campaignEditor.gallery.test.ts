import { describe, expect, it } from "vitest";

import { normalizeLoadedContentBlocks } from "../campaignEditor";
import type { StudioBlock } from "@/types/studioBlocks";

/** A stored block as loaded from older campaigns, which may still carry galleryItems. */
type LoadedStudioBlock = StudioBlock & { galleryItems?: unknown[] };

describe("normalizeLoadedContentBlocks", () => {
  it("retypes legacy product gallery blocks loaded as image-gallery", () => {
    const blocks: LoadedStudioBlock[] = [
      {
        id: "legacy-product-gallery",
        type: "image-gallery",
        label: "Holiday Products",
        order: 0,
        visible: true,
        source: "manual",
        headline: "Holiday Products",
        galleryItems: [],
      },
      {
        id: "image-gallery",
        type: "image-gallery",
        label: "Photo Grid",
        order: 1,
        visible: true,
        source: "manual",
        headline: "Photo Grid",
        galleryImages: [],
      },
    ];

    const result = normalizeLoadedContentBlocks(blocks);

    expect(result[0].type).toBe("product-gallery");
    expect(result[1].type).toBe("image-gallery");
  });
});
