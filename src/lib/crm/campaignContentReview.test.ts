import { describe, expect, it } from "vitest";
import { reviewCampaignContent } from "./campaignContentReview";
import type { StudioBlock } from "@/types/studioBlocks";
const blocks = (items: object[]) => items as StudioBlock[];
describe("campaign content review", () => {
  it("locates unfinished links and images without flagging valid destinations", () => {
    const issues = reviewCampaignContent(
      blocks([
        { id: "a", type: "hero", buttonText: "Book now", buttonUrl: "#" },
        { id: "b", type: "image", imageUrl: "" },
        {
          id: "c",
          type: "hero",
          buttonText: "Shop",
          buttonUrl: "https://garden.ca/shop",
        },
        { id: "d", type: "hero", buttonText: "Register" },
      ]),
    );
    expect(issues.map((i) => i.blockId)).toEqual(["a", "b", "d"]);
  });
  it("ignores hidden blocks and checks nested product buttons", () => {
    expect(
      reviewCampaignContent(
        blocks([
          { id: "hidden", type: "image", visible: false },
          {
            id: "products",
            type: "product-gallery",
            galleryProducts: [
              { buttonText: "Shop", buttonUrl: "https://example.com" },
            ],
          },
        ]),
      ),
    ).toEqual([
      {
        blockId: "products",
        message: "Block 2: Replace the sample link with your destination.",
      },
    ]);
  });
});
