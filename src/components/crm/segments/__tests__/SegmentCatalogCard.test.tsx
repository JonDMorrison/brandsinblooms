import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  SegmentCatalogCard,
  type SegmentCatalogItem,
} from "@/components/crm/segments/SegmentCatalogCard";
import { formatSegmentValue } from "@/lib/crm/systemSegmentDataAvailability";

const REASON =
  "Needs purchase dates from your point of sale. Your imported reports don't include them yet.";

function renderCard(overrides: Partial<SegmentCatalogItem>) {
  const item: SegmentCatalogItem = {
    id: "segment-1",
    name: "New Customers",
    description: "First purchase in the last 30 days",
    isSystemSegment: true,
    memberCount: 0,
    averageValue: null,
    totalValue: null,
    ...overrides,
  };

  return render(
    <MemoryRouter>
      <SegmentCatalogCard
        item={item}
        detailHref="/crm/segments/segment-1"
        campaignHref="/crm/campaigns/new?segment=segment-1"
        membersHref="/crm/segments/segment-1/members"
        onView={vi.fn()}
        onViewMembers={vi.fn()}
        onCreateCampaign={vi.fn()}
        onExportMembers={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("SegmentCatalogCard", () => {
  it("shows the plain reason instead of a bare 0 when data is missing", () => {
    renderCard({ memberCount: 0, emptyReason: REASON });

    expect(screen.getByText(REASON)).toBeInTheDocument();
    expect(screen.queryByText("0 members")).not.toBeInTheDocument();
  });

  it("shows the member count when there is no reason", () => {
    renderCard({ memberCount: 0, emptyReason: null });
    expect(screen.getByText("0 members")).toBeInTheDocument();
  });

  it("ignores the reason when the group has members", () => {
    renderCard({ memberCount: 12, emptyReason: REASON });
    expect(screen.getByText("12 members")).toBeInTheDocument();
    expect(screen.queryByText(REASON)).not.toBeInTheDocument();
  });

  it("never renders $0 for unknown or empty values", () => {
    renderCard({ memberCount: 0, averageValue: 0, totalValue: 0 });
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not available")).toHaveLength(2);
  });
});

describe("formatSegmentValue", () => {
  it("returns Not available for null, empty groups and non-finite values", () => {
    expect(formatSegmentValue(null, 10)).toBe("Not available");
    expect(formatSegmentValue(0, 0)).toBe("Not available");
    expect(formatSegmentValue(Number.NaN, 3)).toBe("Not available");
  });

  it("formats known values for groups with members", () => {
    expect(formatSegmentValue(1250, 3)).toBe(`$${(1250).toLocaleString()}`);
  });
});
