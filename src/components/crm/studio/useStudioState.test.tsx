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
