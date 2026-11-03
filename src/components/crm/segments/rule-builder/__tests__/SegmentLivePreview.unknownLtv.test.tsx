import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SegmentLivePreview } from "../SegmentLivePreview";
import type { SegmentPreviewResult } from "@/hooks/useSegmentPreview";

const base: SegmentPreviewResult = {
  audienceMode: "rules",
  count: 0,
  countLabel: "0",
  percentage: 0,
  sampleMembers: [],
  lifecycleBreakdown: [],
  engagementBreakdown: [],
  preferredChannelBreakdown: [],
  averageLifetimeValue: null,
  averageLifetimeValueDelta: null,
  updatedLabel: "Updated just now",
  customFields: [],
  basedOnSample: false,
  sampleSize: 0,
};

describe("segment live preview never shows unknown spending as $0", () => {
  it("says Not available when no customer has a lifetime value", () => {
    render(<SegmentLivePreview preview={base} />);
    expect(screen.getAllByText("Not available")).toHaveLength(2);
    expect(screen.queryByText("$0")).toBeNull();
    expect(screen.queryByText("+$0")).toBeNull();
  });

  it("shows real values when they exist", () => {
    render(<SegmentLivePreview preview={{ ...base, averageLifetimeValue: 412.4, averageLifetimeValueDelta: -20 }} />);
    expect(screen.getByText("$412")).toBeTruthy();
    expect(screen.getByText("$-20")).toBeTruthy();
  });
});
