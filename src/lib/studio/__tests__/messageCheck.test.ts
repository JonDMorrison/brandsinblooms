import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import {
  checkImageAddress,
  checkLinkAddress,
  checkMessage,
  findBrokenImages,
  messageImageAddresses,
} from "@/lib/studio/newsletter/messageCheck";
import type { StudioBlock } from "@/types/studioBlocks";

const block = (type: Parameters<typeof createStudioBlock>[0], fields: Partial<StudioBlock>) =>
  ({ ...createStudioBlock(type), id: `b-${type}`, order: 0, visible: true, ...fields }) as StudioBlock;

describe("link addresses", () => {
  it.each([
    ["", "problem"],
    ["#", "problem"],
    ["#website", "problem"],
    ["shop now", "problem"],
    ["https://localhost", "problem"],
    ["https://example.com/shop", "warning"],
    ["https://yourstore.com", "warning"],
    ["http://northfieldgarden.ca", "warning"],
    ["mailto:", "problem"],
    ["https://facebook.com", "warning"],
  ])("%s is a %s", (href, severity) => {
    expect(checkLinkAddress(href)?.severity).toBe(severity);
  });

  it.each(["https://northfieldgarden.ca/shop", "mailto:hello@northfield.ca", "tel:+16045550100", "{{system.unsubscribe_url}}", "#unsubscribe", "#preferences"])(
    "%s is fine",
    (href) => {
      expect(checkLinkAddress(href)).toBeNull();
    },
  );
});

describe("image addresses", () => {
  it.each([
    ["", "problem"],
    ["data:image/png;base64,AAAA", "problem"],
    ["/images/plant.jpg", "problem"],
    ["http://cdn.northfield.ca/plant.jpg", "warning"],
    ["https://placehold.co/600x400/png", "warning"],
  ])("%s is a %s", (src, severity) => {
    expect(checkImageAddress(src)?.severity).toBe(severity);
  });
  it("a normal https image is fine", () => {
    expect(checkImageAddress("https://cdn.northfield.ca/plant.jpg")).toBeNull();
  });
});

describe("checkMessage", () => {
  it("reports a missing image description under the block it belongs to", () => {
    const issues = checkMessage([block("full-width-image", { imageUrl: "https://cdn.northfield.ca/roses.jpg", imageAlt: "", caption: "" })]);
    const alt = issues.find((issue) => issue.kind === "alt-text");
    expect(alt).toMatchObject({ severity: "warning", blockId: "b-full-width-image", blockLabel: "Image" });
  });

  it("reports a button with words but no link, and one with a link but no words", () => {
    const issues = checkMessage([
      block("image-text", { headline: "Fall", buttonText: "Shop now", buttonUrl: "" }),
      block("event", { headline: "Workshop", buttonText: "", buttonUrl: "https://northfield.ca/events" }),
    ]);
    const buttons = issues.filter((issue) => issue.kind === "button");
    expect(buttons.map((issue) => issue.blockId)).toEqual(["b-image-text", "b-event"]);
    expect(buttons[0].message).toContain("Shop now");
  });

  it("reports placeholder links and images", () => {
    const issues = checkMessage([
      block("image-text", {
        headline: "Fall",
        imageUrl: "https://placehold.co/640x360/png",
        imageAlt: "Placeholder",
        buttonText: "Shop now",
        buttonUrl: "https://example.com/shop",
      }),
    ]);
    expect(issues.some((issue) => issue.kind === "image" && issue.severity === "warning")).toBe(true);
    expect(issues.some((issue) => issue.kind === "link" && issue.detail?.includes("example.com"))).toBe(true);
  });

  it("an empty YouTube block and button-group links without addresses are reported", () => {
    const issues = checkMessage([
      block("youtube", { videoUrl: "" }),
      block("button-group", { links: [{ id: "a", label: "Directions", url: "" }] }),
    ]);
    expect(issues.filter((issue) => issue.kind === "button").map((issue) => issue.blockId)).toEqual(["b-youtube", "b-button-group"]);
  });

  it("a finished block has nothing to report", () => {
    const issues = checkMessage([
      block("image-text", {
        headline: "Fall planting",
        body: "<p>Bulbs are in.</p>",
        imageUrl: "https://cdn.northfield.ca/bulbs.jpg",
        imageAlt: "Tulip bulbs in a crate",
        buttonText: "Shop bulbs",
        buttonUrl: "https://northfieldgarden.ca/bulbs",
      }),
    ]);
    expect(issues).toEqual([]);
  });

  it("lists a link shared by a photo and its button once", () => {
    const issues = checkMessage([
      block("product-gallery", {
        galleryProducts: [{ id: "p", name: "Maple", price: "$9", imageUrl: "https://cdn.northfield.ca/maple.jpg", linkUrl: "https://example.com/maples", buttonText: "Shop", buttonUrl: "https://example.com/maples" }],
      }),
    ]);
    expect(issues.filter((issue) => issue.detail === "https://example.com/maples")).toHaveLength(1);
  });

  it("hidden blocks are not checked", () => {
    expect(checkMessage([block("image-text", { visible: false, buttonText: "Shop", buttonUrl: "" })])).toEqual([]);
  });
});

describe("image loading", () => {
  it("reports images that fail to load, once per address", async () => {
    const blocks = [
      block("full-width-image", { id: "one", imageUrl: "https://cdn.northfield.ca/ok.jpg", imageAlt: "ok" }),
      block("full-width-image", { id: "two", imageUrl: "https://cdn.northfield.ca/missing.jpg", imageAlt: "gone" }),
    ];
    const images = messageImageAddresses(blocks);
    expect(images.map((image) => image.src)).toEqual(["https://cdn.northfield.ca/ok.jpg", "https://cdn.northfield.ca/missing.jpg"]);
    const broken = await findBrokenImages(images, async (src) => !src.includes("missing"));
    expect(broken).toEqual([
      expect.objectContaining({ kind: "image", severity: "problem", blockId: "two", detail: "https://cdn.northfield.ca/missing.jpg" }),
    ]);
  });
});
