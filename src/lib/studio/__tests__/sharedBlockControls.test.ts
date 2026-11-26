import { describe, expect, it } from "vitest";
import type { StudioBlockType } from "@/components/crm/studio/blockLibraryData";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const photo = "https://example.com/photo.jpg";
const make = (type: StudioBlockType, fields: Partial<StudioBlock> = {}) =>
  ({
    ...createStudioBlock(type),
    id: `b-${type}`,
    order: 0,
    visible: true,
    headline: "Spring sale",
    subheading: "This weekend only",
    body: "<p>Everything in the greenhouse.</p>",
    buttonText: "Shop now",
    buttonUrl: "https://example.com/shop",
    ...fields,
  }) as StudioBlock;
const dom = (html: string) => new DOMParser().parseFromString(html, "text/html");
const textAlignOf = (html: string, needle: string) => {
  const el = [...dom(html).querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,div,p,td")]
    .filter((node) => node.textContent?.includes(needle))
    .pop();
  let node: HTMLElement | null = el ?? null;
  while (node) {
    if (node.style?.textAlign) return node.style.textAlign;
    node = node.parentElement;
  }
  return null;
};
const buttonWrapperAlign = (html: string) => {
  let node: HTMLElement | null =
    [...dom(html).querySelectorAll<HTMLElement>("a")].find((a) => a.textContent?.trim() === "Shop now")?.parentElement ?? null;
  while (node) {
    if (node.style?.textAlign) return node.style.textAlign;
    node = node.parentElement;
  }
  return null;
};

describe("shared text alignment", () => {
  const blocks: Array<[StudioBlockType, Partial<StudioBlock>, string]> = [
    ["preheader", { body: "Top line of text" }, "Top line of text"],
    ["headline", {}, "Spring sale"],
    ["announcement", {}, "Spring sale"],
    ["blog", {}, "Spring sale"],
    ["event", {}, "Spring sale"],
    ["coupon", {}, "Spring sale"],
    ["product-card", { productName: "Spring sale" }, "Spring sale"],
  ];

  it.each(blocks.flatMap(([type, fields, needle]) =>
    (["left", "center", "right"] as const).map((align) => [type, align, fields, needle] as const)))(
    "%s honours %s",
    (type, align, fields, needle) => {
      const html = renderNewsletterBlock(make(type, { ...fields, textAlign: align }));
      expect(textAlignOf(html, needle)).toBe(align);
    },
  );

  it.each(blocks)("%s is unchanged while no alignment is picked", (type, fields) => {
    const html = renderNewsletterBlock(make(type, fields));
    expect(html).not.toMatch(/text-align:(left|center|right);font-family/);
  });

  it.each(["announcement", "blog", "event", "coupon"] as const)(
    "%s keeps its button where it was when only the words move",
    (type) => {
      const before = buttonWrapperAlign(renderNewsletterBlock(make(type)));
      const after = buttonWrapperAlign(renderNewsletterBlock(make(type, { textAlign: "right" })));
      expect(after).toBe(before);
    },
  );

  it.each(["announcement", "blog", "event", "coupon"] as const)(
    "%s moves its button without moving the words",
    (type) => {
      const html = renderNewsletterBlock(make(type, { textAlign: "left", buttonAlign: "right" }));
      expect(buttonWrapperAlign(html)).toBe("right");
      expect(textAlignOf(html, "Spring sale")).toBe("left");
    },
  );
});

describe("optional photo and button", () => {
  it.each(["announcement", "blog", "event"] as const)("%s hides the button and keeps its words saved", (type) => {
    const block = make(type, { showButton: false });
    expect(renderNewsletterBlock(block)).not.toContain("Shop now");
    expect(block.buttonText).toBe("Shop now");
    expect(renderNewsletterBlock({ ...block, showButton: true })).toContain("Shop now");
  });

  it.each(["announcement", "blog", "event"] as const)("%s hides the photo and keeps it saved", (type) => {
    const block = make(type, { imageUrl: photo, showImage: false });
    expect(renderNewsletterBlock(block)).not.toContain(photo);
    expect(renderNewsletterBlock({ ...block, showImage: true })).toContain(photo);
  });
});

describe("event photo", () => {
  const img = (html: string) => dom(html).querySelector<HTMLImageElement>(`img[src="${photo}"]`)!;

  it("keeps the original 252px crop when nothing is picked", () => {
    const image = img(renderNewsletterBlock(make("event", { imageUrl: photo })));
    expect(image.style.height).toBe("252px");
    expect(image.style.objectFit).toBe("cover");
  });

  it("shows the whole photo at its own shape", () => {
    const image = img(renderNewsletterBlock(make("event", { imageUrl: photo, imageFit: "contain" })));
    expect(image.style.height).toBe("auto");
    expect(image.getAttribute("height")).toBeNull();
  });

  it("uses the chosen height, including short banners", () => {
    const image = img(renderNewsletterBlock(make("event", { imageUrl: photo, imageFit: "cover", imageHeight: 150 })));
    expect(image.style.height).toBe("150px");
  });

  it("spans the card when the photo is on top", () => {
    const side = Number(img(renderNewsletterBlock(make("event", { imageUrl: photo, imagePosition: "left" }))).getAttribute("width"));
    const top = Number(img(renderNewsletterBlock(make("event", { imageUrl: photo, imagePosition: "top" }))).getAttribute("width"));
    expect(top).toBeGreaterThan(side * 2);
  });

  it.each(["top", "middle", "bottom"] as const)("lines the words up at the %s beside the photo", (verticalAlign) => {
    const html = renderNewsletterBlock(make("event", { imageUrl: photo, imagePosition: "left", appearance: { verticalAlign } }));
    const cell = dom(html).querySelector<HTMLElement>("td.product-card-details")!;
    expect(cell.getAttribute("valign")).toBe(verticalAlign);
  });
});

describe("quote controls", () => {
  const avatar = "https://example.com/avatar.jpg";
  const quote = (fields: Partial<StudioBlock>) =>
    renderNewsletterBlock(make("quote", { quoteText: "<p>Lovely plants.</p>", authorName: "Pat", authorImageUrl: avatar, showAuthorImage: true, ...fields }));
  const layouts = ["classic", "large-centered", "avatar-card"] as const;

  it.each(layouts)("%s: avatar size is used", (layout) => {
    const image = dom(quote({ layout, authorAvatarSize: 72 })).querySelector<HTMLImageElement>(`img[src="${avatar}"]`)!;
    expect(image.getAttribute("width")).toBe("72");
    expect(image.style.height).toBe("72px");
  });

  it.each(layouts)("%s: turning the author photo off removes it, on restores it", (layout) => {
    expect(quote({ layout, showAuthorImage: false })).not.toContain(avatar);
    expect(quote({ layout, showAuthorImage: true })).toContain(avatar);
  });

  it.each(layouts.flatMap((layout) => (["left", "center", "right"] as const).map((align) => [layout, align] as const)))(
    "%s: text alignment %s is used",
    (layout, align) => {
      expect(textAlignOf(quote({ layout, textAlign: align }), "Lovely plants.")).toBe(align);
    },
  );

  it("keeps each layout's own alignment while none is picked", () => {
    expect(textAlignOf(quote({ layout: "large-centered" }), "Lovely plants.")).toBe("center");
    expect(textAlignOf(quote({ layout: "classic" }), "Lovely plants.")).toBe("left");
  });

  it.each(layouts)("%s: content padding changes the space above and below", (layout) => {
    expect(quote({ layout, contentPadding: 16 })).not.toBe(quote({ layout, contentPadding: 48 }));
  });

  it("quote mark size changes the large centred mark", () => {
    expect(quote({ layout: "large-centered", quoteMarkSize: 72 })).toContain("font-size:72px");
  });
});
