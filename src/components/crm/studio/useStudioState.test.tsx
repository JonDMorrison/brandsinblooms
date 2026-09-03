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
