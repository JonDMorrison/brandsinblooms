import { describe, expect, it } from "vitest";
import {
  generateEmailHtml,
  renderFooterBlockToEmailHtml,
  renderStudioBlocksToEmailHtml,
} from "@/lib/studio/emailHtmlGenerator";

const baseBlock = {
  id: "image-test",
  label: "Image",
  order: 0,
  visible: true,
  imageUrl: "https://images.example.com/plant.jpg",
  imageAlt: "Green tomato seedling",
} as const;

describe("emailHtmlGenerator — image crop controls", () => {
  it("renders full-width crop size and focal point into received HTML", () => {
    const html = renderStudioBlocksToEmailHtml([
      {
        ...baseBlock,
        type: "full-width-image",
        maxHeight: 360,
        imageFit: "cover",
        imageFocalX: 25,
        imageFocalY: 80,
      } as any,
    ]);

    expect(html).toContain('height="360"');
    expect(html).toContain("height:360px");
    expect(html).toContain("object-fit:cover");
    expect(html).toContain("object-position:25% 80%");
  });

  it("uses focal points for graphic-hero background crops", () => {
    const html = renderStudioBlocksToEmailHtml([
      {
        ...baseBlock,
        type: "graphic-hero",
        imageFit: "cover",
        imageFocalX: 75,
        imageFocalY: 10,
      } as any,
    ]);

    expect(html).toContain("background-position:75% 10%");
  });

  it("compiles a selected image-text ratio into explicit crop dimensions", () => {
    const html = renderStudioBlocksToEmailHtml([
      {
        ...baseBlock,
        type: "image-text",
        layout: "image-top",
        contentPadding: 24,
        imageRatio: "16:9",
        imageFit: "cover",
        imageFocalX: 30,
        imageFocalY: 65,
      } as any,
    ]);

    expect(html).toContain('width="592"');
    expect(html).toContain('height="333"');
    expect(html).toContain("object-position:30% 65%");
  });

  it("keeps cropped images at a usable mobile height", () => {
    const html = generateEmailHtml({
      blocks: [{ ...baseBlock, type: "full-width-image" } as any],
      subject: "Image test",
      previewText: "",
      footer: null,
    });

    expect(html).toContain(
      ".responsive-crop-image { height:240px !important; }",
    );
  });
});

describe("emailHtmlGenerator — logo sizing", () => {
  it("upgrades legacy 40px header logos to the larger current default", () => {
    const html = renderStudioBlocksToEmailHtml([
      {
        ...baseBlock,
        type: "newsletter-header",
        headline: "The Garden Update",
        logoUrl: "https://images.example.com/logo.png",
        logoSize: 40,
      } as any,
    ]);

    expect(html).toContain("height:56px");
  });

  it("upgrades legacy 40px footer logos to 64px", () => {
    const html = renderFooterBlockToEmailHtml({
      ...baseBlock,
      type: "footer",
      businessName: "Greenhouse",
      logoUrl: "https://images.example.com/logo.png",
      logoSize: 40,
    } as any);

    expect(html).toContain('height="64"');
    expect(html).toContain("height:64px");
  });
});
