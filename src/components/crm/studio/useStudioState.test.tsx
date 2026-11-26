import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import { useStudioState, type StudioCampaignSnapshot } from "./useStudioState";

const designSystem = buildStudioDesignSystem({} as never);

const createSnapshot = (body: string): StudioCampaignSnapshot => ({
  campaignName: "Spring campaign",
  campaignStatus: "Draft",
  subjectLine: "Spring is here",
  previewText: "Fresh ideas for your garden",
  senderName: "Flower House",
  senderEmail: "hello@example.com",
  blocks: [
    {
      id: "text-1",
      type: "plain-text",
      label: "Text",
      order: 0,
      visible: true,
      body,
    } as StudioBlock,
  ],
});

const getBody = (blocks: StudioBlock[]) =>
  blocks.find((block) => block.id === "text-1")?.body;

describe("useStudioState history", () => {
  it("undoes and redoes block content changes", () => {
    const { result } = renderHook(() =>
      useStudioState({ initialCampaignName: "Campaign", designSystem }),
    );

    act(() => result.current.loadCampaign(createSnapshot("Original copy")));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() =>
      result.current.updateBlockField("text-1", "body", "Updated copy"),
    );
    expect(getBody(result.current.blocks)).toBe("Updated copy");
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(getBody(result.current.blocks)).toBe("Original copy");
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(getBody(result.current.blocks)).toBe("Updated copy");
    expect(result.current.canUndo).toBe(true);
  });

  it("updates linked event details in one undoable step", () => {
    const { result } = renderHook(() => useStudioState({ initialCampaignName: "Campaign", designSystem }));
    act(() => result.current.loadCampaign(createSnapshot("Original copy")));
    act(() => result.current.updateBlockFields("text-1", { body: "New copy", headline: "New title", id: "other" }));
    expect(result.current.blocks.find(block => block.id === "text-1")).toMatchObject({ body: "New copy", headline: "New title", type: "plain-text" });
    act(() => result.current.undo());
    expect(getBody(result.current.blocks)).toBe("Original copy");
    expect(result.current.blocks.find(block => block.id === "text-1")?.headline).toBeUndefined();
  });

  it("clears redo history after a new edit", () => {
    const { result } = renderHook(() =>
      useStudioState({ initialCampaignName: "Campaign", designSystem }),
    );

    act(() => result.current.loadCampaign(createSnapshot("Original copy")));
    act(() =>
      result.current.updateBlockField("text-1", "body", "First edit"),
    );
    act(() => result.current.undo());
    act(() =>
      result.current.updateBlockField("text-1", "body", "Replacement edit"),
    );

    expect(getBody(result.current.blocks)).toBe("Replacement edit");
    expect(result.current.canRedo).toBe(false);
  });

  it("starts a fresh history when another campaign is loaded", () => {
    const { result } = renderHook(() =>
      useStudioState({ initialCampaignName: "Campaign", designSystem }),
    );

    act(() => result.current.loadCampaign(createSnapshot("Original copy")));
    act(() =>
      result.current.updateBlockField("text-1", "body", "Unsaved edit"),
    );
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.loadCampaign(createSnapshot("Reloaded copy")));
    expect(getBody(result.current.blocks)).toBe("Reloaded copy");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});

describe("hero photo editing", () => {
  const photoUrl = "https://images.example.com/wreath.jpg";
  const setupHero = (heroStyle?: StudioBlock["heroStyle"]) => {
    const hook = renderHook(() => useStudioState({ initialCampaignName: "Workshop", designSystem }));
    act(() => hook.result.current.loadCampaign({
      ...createSnapshot(""),
      blocks: [{ id: "hero", type: "email-safe-hero", label: "Hero", order: 0, visible: true,
        heroStyle, headline: "Winter workshops", buttonText: "Book now", buttonUrl: "https://example.com/book",
        backgroundColor: "#f8f9fa", textColor: "#1a1a2e", layoutPreset: "hero-light-minimal" }],
    }));
    return hook;
  };

  it.each([undefined, "solid", "gradient"] as const)("makes an added photo visible from %s and undoes it atomically", (style) => {
    const { result } = setupHero(style);
    act(() => result.current.updateBlockField("hero", "imageUrl", photoUrl));
    expect(result.current.blocks[0]).toMatchObject({ imageUrl: photoUrl, heroStyle: "image-bottom",
      headline: "Winter workshops", buttonText: "Book now", backgroundColor: "#f8f9fa", textColor: "#1a1a2e" });
    expect(result.current.blocks[0].layoutPreset).toBeUndefined();
    act(() => result.current.undo());
    expect(result.current.blocks[0].imageUrl).toBeUndefined();
    expect(result.current.blocks[0].heroStyle).toBe(style);
    act(() => result.current.redo());
    expect(result.current.blocks[0].imageUrl).toBe(photoUrl);
    expect(result.current.blocks[0].heroStyle).toBe("image-bottom");
  });

  it.each(["image-overlay", "image-bottom"] as const)("preserves %s when replacing or removing a photo", (style) => {
    const { result } = setupHero(style);
    act(() => result.current.updateBlockField("hero", "imageUrl", photoUrl));
    expect(result.current.blocks[0].heroStyle).toBe(style);
    act(() => result.current.updateBlockField("hero", "imageUrl", ""));
    expect(result.current.blocks[0].imageUrl).toBe("");
    expect(result.current.blocks[0].headline).toBe("Winter workshops");
    expect(result.current.blocks[0].heroStyle).toBe(style);
  });
});

import { placeInsertedBlocks } from "./useStudioState";

describe("From my website insert position (#17)", () => {
  const b = (id: string, type: string, extra: Record<string, unknown> = {}) =>
    ({ id, type, label: id, order: 0, visible: true, ...extra }) as never;
  const header = b("h", "newsletter-header");
  const text = b("t", "plain-text", { body: "<p>Hello</p>" });
  const emptyCard = b("e", "image-text");
  const footer = b("f", "footer");
  const product = b("p1", "image-text", { headline: "Fern", imageUrl: "https://x.test/f.jpg", buttonText: "Shop", buttonUrl: "https://x.test" });
  const ids = (blocks: Array<{ id: string }>) => blocks.map((block) => block.id);

  it("fills the selected empty block when the type matches", () => {
    const { blocks, focusId } = placeInsertedBlocks([header, emptyCard, text, footer], [product], "e");
    expect(ids(blocks)).toEqual(["h", "e", "t", "f"]);
    expect((blocks[1] as { headline?: string }).headline).toBe("Fern");
    expect(focusId).toBe("e");
  });

  it("inserts right after the selected block when it is not an empty match", () => {
    expect(ids(placeInsertedBlocks([header, text, emptyCard, footer], [product], "t").blocks)).toEqual(["h", "t", "p1", "e", "f"]);
  });

  it("never appends at the bottom: no selection goes after the header", () => {
    expect(ids(placeInsertedBlocks([header, text, footer], [product], null).blocks)).toEqual(["h", "p1", "t", "f"]);
    expect(ids(placeInsertedBlocks([header, text, footer], [product], "f").blocks)).toEqual(["h", "p1", "t", "f"]);
  });
});

import { placeThemeBlocks } from "./useStudioState";
import { themeBlockLabel } from "./themeBlockLabel";
import { buildWeeklyThemeIdea } from "@/lib/studio/weeklyThemeSeed";
import { buildNewsletterIdeaContentBlocks } from "@/lib/studio/newsletterIdeaSeed";
import { createStudioBlock } from "@/lib/studio/blockFactory";

describe("Add all theme blocks (qa2 #6)", () => {
  const designSystem = buildStudioDesignSystem({ name: "Northfield Garden Center" });
  const week48 = buildWeeklyThemeIdea({
    weekNumber: 48,
    themeCampaignId: null,
    title: "Year-End Garden Review",
    theme: "Celebrating Garden Successes",
    description: "Encourage documenting successes, learning from challenges, and celebrating the completed growing season.",
    seasonalFocus: "Annual garden evaluation",
    images: [
      { url: "https://images.unsplash.com/photo-1", alt: "a garden filled with lots of different types of flowers", credit: "" },
      { url: "https://images.unsplash.com/photo-2", alt: "a garden filled with lots of purple and white flowers", credit: "" },
    ],
  });
  const themeBlocks = buildNewsletterIdeaContentBlocks(week48, designSystem);
  const blankDraft = () => {
    const header = { ...createStudioBlock("newsletter-header", designSystem), id: "h", logoUrl: "https://cdn.test/logo.png", logoSize: 72 };
    const paragraph = { ...createStudioBlock("plain-text", designSystem), id: "empty" };
    const footer = { ...createStudioBlock("footer", designSystem), id: "f" };
    return [header, paragraph, footer] as StudioBlock[];
  };

  it("keeps a single header, replaced in place with its logo", () => {
    const { blocks } = placeThemeBlocks(blankDraft(), themeBlocks);
    const headers = blocks.filter((block) => block.type === "newsletter-header");
    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatchObject({ id: "h", logoUrl: "https://cdn.test/logo.png", logoSize: 72, headline: "Celebrating Garden Successes" });
    expect(blocks[0].id).toBe("h");
  });

  it("fills the empty placeholder instead of leaving it, and keeps the footer last", () => {
    const { blocks } = placeThemeBlocks(blankDraft(), themeBlocks);
    expect(blocks.some((block) => block.id === "empty")).toBe(false);
    expect(blocks.map((block) => block.type)).toEqual([
      "newsletter-header", "full-width-image", "plain-text", "image-text", "footer",
    ]);
  });

  it("goes right after the header when there is no placeholder", () => {
    const filled = blankDraft().map((block) => block.id === "empty" ? { ...block, body: "<p>Our hours</p>" } : block);
    const { blocks } = placeThemeBlocks(filled, themeBlocks);
    expect(blocks.map((block) => block.id).slice(-2)).toEqual(["empty", "f"]);
    expect(blocks[1].type).toBe("full-width-image");
  });

  it("adding twice still leaves one header", () => {
    const once = placeThemeBlocks(blankDraft(), themeBlocks).blocks;
    const twice = placeThemeBlocks(once, themeBlocks).blocks;
    expect(twice.filter((block) => block.type === "newsletter-header")).toHaveLength(1);
  });

  it("does not add theme content the draft already has", () => {
    const once = placeThemeBlocks(blankDraft(), themeBlocks).blocks;
    const twice = placeThemeBlocks(once, themeBlocks).blocks;
    expect(twice.map((block) => block.type)).toEqual(once.map((block) => block.type));
    expect(twice).toHaveLength(once.length);
  });

  it("labels sidebar items with a title, never photo alt text", () => {
    const labels = themeBlocks.map(themeBlockLabel);
    expect(labels).toEqual([
      "Celebrating Garden Successes",
      "Theme photo",
      expect.stringContaining("Year-End Garden Review"),
      "Annual garden evaluation",
    ]);
    expect(labels.join(" ")).not.toMatch(/a garden filled/);
  });
});

describe("move to top and bottom", () => {
  it("moves a block to the top, and to just above the footer, in one undoable step each", () => {
    const { result } = renderHook(() => useStudioState({ initialCampaignName: "Campaign", designSystem }));
    act(() => { result.current.addBlock("headline"); });
    act(() => { result.current.addBlock("plain-text"); });
    act(() => { result.current.addBlock("divider"); });
    const types = () => result.current.blocks.map((block) => block.type);
    const footerLast = () => expect(types()[types().length - 1]).toBe("footer");
    const start = types();
    const divider = result.current.blocks.find((block) => block.type === "divider")!;

    act(() => { result.current.selectBlock(divider.id); });
    act(() => { result.current.reorderBlock(divider.id, "top"); });
    expect(types()[0]).toBe("divider");
    footerLast();
    expect(result.current.selectedBlockId).toBe(divider.id);

    act(() => { result.current.reorderBlock(divider.id, "bottom"); });
    expect(types()[types().length - 2]).toBe("divider");
    footerLast();

    act(() => { result.current.undo(); });
    expect(types()[0]).toBe("divider");
    act(() => { result.current.undo(); });
    expect(types()).toEqual(start);
  });

  it("never moves the footer", () => {
    const { result } = renderHook(() => useStudioState({ initialCampaignName: "Campaign", designSystem }));
    act(() => { result.current.addBlock("headline"); });
    const footer = result.current.blocks.find((block) => block.type === "footer")!;
    const before = result.current.blocks.map((block) => block.id);
    act(() => { result.current.reorderBlock(footer.id, "top"); });
    expect(result.current.blocks.map((block) => block.id)).toEqual(before);
  });
});
