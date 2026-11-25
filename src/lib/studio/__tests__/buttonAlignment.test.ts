import { describe, expect, it } from "vitest";
import type { StudioBlockType } from "@/components/crm/studio/blockLibraryData";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const destination = "https://example.com/shop";
const withButton = (type: StudioBlockType, fields: Partial<StudioBlock> = {}) =>
  ({
    ...createStudioBlock(type),
    id: `b-${type}`,
    order: 0,
    visible: true,
    headline: "Spring sale",
    body: "<p>Everything in the greenhouse.</p>",
    buttonText: "Shop now",
    buttonUrl: destination,
    ...fields,
  }) as StudioBlock;

/** text-align of the closest wrapper around the button. */
function buttonAlign(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let el: Element | null = [...doc.querySelectorAll("a")].find((a) => a.textContent?.trim() === "Shop now" || a.textContent?.trim() === "Watch video")?.parentElement ?? null;
  while (el) {
    // Older renderers place the button table with align="…" (Outlook-safe).
    const align = (el.tagName === "TABLE" && el.getAttribute("align")) || (el as HTMLElement).style?.textAlign;
    if (align) return align;
    el = el.parentElement;
  }
  return null;
}

describe("Button alignment on every block with a button", () => {
  const cases: Array<[StudioBlockType, Partial<StudioBlock>]> = [
    ["image-text", { imageUrl: "https://example.com/p.jpg" }],
    ["call-to-action", {}],
    ["event", {}],
    ["blog", {}],
    ["announcement", {}],
    ["coupon", { showButton: true }],
    ["youtube", { videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", buttonText: "Shop now" }],
  ];

  it.each(cases.flatMap(([type, fields]) => (["left", "center", "right"] as const).map((align) => [type, fields, align] as const)))(
    "%s honours %s",
    (type, fields, align) => {
      const html = renderNewsletterBlock(withButton(type, { ...fields, buttonAlign: align }));
      expect(buttonAlign(html)).toBe(align);
    },
  );

  it("an unset alignment leaves existing blocks unchanged", () => {
    for (const [type, fields] of cases) {
      const block = withButton(type, fields);
      expect(renderNewsletterBlock({ ...block, buttonAlign: undefined })).toBe(renderNewsletterBlock(block));
    }
  });
});

describe("older button renderer margin", () => {
  it.each(["left", "center", "right"] as const)("writes a valid margin for %s", (buttonAlign) => {
    const html = renderNewsletterBlock(withButton("image-text", { imageUrl: "https://example.com/p.jpg", buttonAlign }));
    const margin = html.match(/<table[^>]*align="(?:left|center|right)"[^>]*style="[^"]*margin:([^;]+);/)?.[1] ?? "";
    expect(margin.trim().split(/\s+/).length).toBeLessThanOrEqual(4);
  });
});

describe("YouTube button properties", () => {
  it("uses the button colour, text colour and words, and links to the video", () => {
    const html = renderNewsletterBlock(withButton("youtube", {
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      buttonText: "Watch the tour",
      buttonColor: "#e76f51",
      buttonTextColor: "#ffffff",
      buttonUrl: "",
    }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    const button = [...doc.querySelectorAll("a")].find((a) => a.textContent?.trim() === "Watch the tour")!;
    expect(button.getAttribute("href")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(button.style.backgroundColor).toBe("rgb(231, 111, 81)");
    expect(button.style.color).toBe("rgb(255, 255, 255)");
  });
});
