import { describe, expect, it } from "vitest";
import type { StudioBlock } from "../../../types/studioBlocks";
import { createStudioBlock } from "../blockFactory";
import { renderFooterBlockToEmailHtml, renderNewsletterBlock } from "../emailHtmlGenerator";
import { graphicHeroPresets, heroPresets } from "../layoutPresets";

const block = (type: StudioBlock["type"], fields: Partial<StudioBlock> = {}) => ({
  ...createStudioBlock(type), ...fields,
});
const markup = (value: string) => new DOMParser().parseFromString(value, "text/html");
const picture = "https://example.com/garden.jpg";
const destination = "https://example.com/events";

describe("newsletter block controls", () => {
  it.each(["A paragraph", "<p>A paragraph</p>"])("applies the selected body font weight to %s", (body) => {
    const text = block("plain-text", { body, fontWeightPreset: "medium" });
    const role = '[data-newsletter-role="body"]';
    expect(markup(renderNewsletterBlock(text)).querySelector<HTMLElement>(role)?.style.fontWeight).toBe("500");
    const edited = markup(renderNewsletterBlock({ ...text, appearance: { text: { body: { weight: 800 } } } }));
    expect(edited.querySelector<HTMLElement>(role)?.style.fontWeight).toBe("800");
    if (body.startsWith("<p>")) expect(edited.querySelector("p")?.style.fontWeight).toBe("800");
  });

  it("preserves an explicitly cropped image and applies new contain defaults", () => {
    for (const type of ["image-text", "graphic-hero", "full-width-image"] as const)
      expect(createStudioBlock(type).imageFit).toBe("contain");
    expect(renderNewsletterBlock(block("full-width-image", { imageUrl: picture, imageFit: "cover" }))).toContain("object-fit:cover");
  });

  it("preserves the destination when toggling a portrait image link off and on", () => {
    const portrait = block("image-text", { imageRatio: "9:16", imageUrl: picture, linkUrl: destination });
    for (const active of [undefined, false, true]) {
      const doc = markup(renderNewsletterBlock({ ...portrait, imageLinkEnabled: active }));
      const img = doc.querySelector("img")!;
      expect(img.height).toBe(Math.round(img.width * 16 / 9));
      expect(img.style.objectFit).toBe("contain");
      expect(img.closest("a")?.href).toBe(active === false ? undefined : destination);
    }
  });

  it("honours image caption visibility, colour and alignment", () => {
    const image = block("full-width-image", { imageUrl: picture, caption: "Winter garden", captionColor: "#123456", captionAlignment: "right", showCaption: false });
    expect(markup(renderNewsletterBlock(image)).body.textContent).not.toContain("Winter garden");
    const caption = markup(renderNewsletterBlock({ ...image, showCaption: true })).querySelector<HTMLDivElement>('div[style*="text-align:right"]')!;
    expect(caption.textContent).toBe("Winter garden");
    expect(caption.style.color).toBe("rgb(18, 52, 86)");
  });

  it("shows a full-width standalone button before a URL exists and activates it once supplied", () => {
    const cta = block("call-to-action", { fullWidthButton: true, buttonText: "Visit us", buttonAlign: "right" });
    expect(cta.layout).toBe("inline-button-only");
    for (const editing of [true, false]) {
      const draft = markup(renderNewsletterBlock(cta, null, undefined, { editing }));
      expect(draft.querySelector<HTMLElement>('span[data-newsletter-role="button"]')?.style.width).toBe("100%");
      expect(draft.querySelector("a")).toBeNull();
      expect(draft.body.textContent).toContain("Visit us");
    }
    const enabled = markup(renderNewsletterBlock({ ...cta, buttonUrl: destination }));
    expect(enabled.querySelector("a")?.href).toBe(destination);
    expect(enabled.querySelector("a")?.style.width).toBe("100%");
  });

  it("keeps custom secondary link colour and standalone button alignment independent of legacy copy", () => {
    const legacy = block("call-to-action", { layout: "split", headline: "Visit the nursery", textAlign: "left", buttonAlign: "center", buttonText: "Directions", buttonUrl: destination,
      showSecondaryLink: true, secondaryLinkText: "Schedule", secondaryLinkUrl: "https://example.com/schedule", linkColor: "#123456", textColor: "#ff0000",
      appearance: { linkColor: "#eeeeee", verticalAlign: "bottom" },
    });
    const doc = markup(renderNewsletterBlock(legacy));
    expect(doc.querySelector<HTMLElement>("h1")?.style.textAlign).toBe("left");
    expect(doc.querySelector<HTMLElement>('[data-newsletter-role="button"]')?.parentElement?.style.textAlign).toBe("center");
    expect(doc.querySelector<HTMLAnchorElement>('[href$="/schedule"]')?.style.color).toBe("rgb(18, 52, 86)");
    expect(doc.querySelector('td[valign="bottom"]')).toBeTruthy();
  });

  it("makes old white-on-white navigation readable and respects deliberately chosen colours", () => {
    const old = block("navigation", { buttonTextColor: "#fff", buttonColor: "#214832",
      links: [{ id: "link", label: "Classes", url: destination }] });
    const colour = (item: StudioBlock) => markup(renderNewsletterBlock(item)).querySelector("a")?.style.color;
    expect(colour(old)).toBe("rgb(33, 72, 50)");
    expect(colour({ ...old, appearance: { background: "#111827" } })).toBe("rgb(255, 255, 255)");
    expect(colour({ ...old, linkColor: "#f00" })).toBe("rgb(255, 0, 0)");
  });

  it("previews navigation labels while URLs are entered and preserves safe final links", () => {
    const nav = block("navigation", { links: [{ id: "1", label: "Classes", url: "" }], appearance: { buttonPaddingX: 20, buttonPaddingY: 8 } });
    const draft = markup(renderNewsletterBlock(nav, null, undefined, { editing: true }));
    expect(draft.body.textContent).toContain("Classes");
    expect(draft.querySelector("a")).toBeNull();
    expect(markup(renderNewsletterBlock(nav)).body.textContent).not.toContain("Classes");
    const ready = markup(renderNewsletterBlock({ ...nav, links: [{ ...nav.links![0], url: destination }] }));
    expect(ready.querySelector("a")?.style.padding).toBe("8px 20px");
    expect(ready.querySelector("a")?.style.color).toBe("rgb(31, 67, 65)");
  });

  it.each([
    ["nav-left", "left"],
    ["nav-centered", "center"],
    ["nav-right", "right"],
    ["nav-pills", "center"],
  ] as const)("aligns the entire %s navigation in previews and sent email", (preset, alignment) => {
    const nav = block("navigation", {
      layoutPreset: preset,
      textAlign: alignment,
      buttonStyle: preset === "nav-pills" ? "outlined" : "link",
      links: [
        { id: "classes", label: "Classes", url: destination },
        { id: "shop", label: "Shop", url: "https://example.com/shop" },
      ],
    });
    for (const editing of [true, false]) {
      const doc = markup(renderNewsletterBlock(nav, null, undefined, { editing }));
      const outer = doc.querySelector<HTMLTableCellElement>('td[align="' + alignment + '"]');
      expect(outer?.style.textAlign).toBe(alignment);
      expect(outer?.querySelectorAll("a")).toHaveLength(2);
      expect(outer?.querySelector("a")?.style.display).toBe("inline-block");
      expect(outer?.querySelector("a")?.getAttribute("href")).toBe(destination);
      if (preset === "nav-pills") expect(outer?.querySelector("a")?.style.borderRadius).toBe("999px");
    }
  });

  it("does not rearrange existing navigation without a layout preset", () => {
    const nav = block("navigation", {
      layoutPreset: undefined,
      textAlign: "right",
      links: [{ id: "one", label: "One", url: destination }, { id: "two", label: "Two", url: destination }],
    });
    const doc = markup(renderNewsletterBlock(nav));
    expect(doc.querySelectorAll('td[width="50%"]')).toHaveLength(2);
    expect(doc.querySelectorAll("a")).toHaveLength(2);
  });

  it("gives empty hero presets preview content without adding sample text or photos to email", () => {
    for (const [type, presets] of [["email-safe-hero", heroPresets], ["graphic-hero", graphicHeroPresets]] as const) {
      const previews = presets.map((preset) => {
        const hero = block(type, preset.fields);
        const preview = renderNewsletterBlock(hero, null, undefined, { editing: true });
        const sent = renderNewsletterBlock(hero);
        expect(preview).toMatch(/Your headline|Add a photo/);
        expect(preview).not.toContain("newsletter-fallback");
        expect(sent).not.toMatch(/Your headline|Your subheading|newsletter-fallback|data-editor-placeholder/);
        return preview;
      });
      expect(new Set(previews).size).toBe(presets.length);
    }
  });

  it.each(["classic", "centered", "minimal", "banner"])("aligns the %s header logo independently of the date", (layout) => {
    for (const logoAlignment of ["left", "center", "right"] as const) {
      const header = block("newsletter-header", { layout, logoAlignment, logoUrl: picture, dateLabel: "Nov 14" });
      const doc = markup(renderNewsletterBlock(header));
      const logoCell = doc.querySelector("img")?.closest("td");
      expect(logoCell?.align).toBe(logoAlignment);
      expect(doc.querySelector("img")?.style.marginLeft).toBe(logoAlignment === "left" ? "0px" : "auto");
      expect(logoCell?.parentElement?.textContent).not.toContain("Nov 14");
      expect(doc.body.textContent).toContain("Nov 14");
    }
  });

  it.each(["standard-dark", "centered-branded", "light-minimal"])("places and sizes the %s footer logo across the container and renders escaped hours", (layout) => {
    const footer = block("footer", { layout, logoAlignment: "right", logoWidthPercent: 100, logoUrl: picture, hoursOfOperation: "Mon–Fri 9–5\nSat 10–3 <seasonal>" });
    const doc = markup(renderFooterBlockToEmailHtml(footer));
    const logo = doc.querySelector("img")!;
    expect(logo.style.width).toBe("100%");
    expect(logo.closest("td")?.align).toBe("right");
    expect(logo.style.marginLeft).toBe("auto");
    expect(doc.body.textContent).toContain("Sat 10–3 <seasonal>");
    expect(doc.querySelector("seasonal")).toBeNull();
    expect(doc.body.innerHTML).toMatch(/unsubscribe/i);
  });
});
