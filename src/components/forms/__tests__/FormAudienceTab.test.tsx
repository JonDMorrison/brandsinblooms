import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { SegmentListItem } from "@/hooks/useSegments";
import type { FormAudience } from "@/types/formBuilder";

import { FormAudienceTab } from "../FormAudienceTab";

const { segmentsState } = vi.hoisted(() => ({
  segmentsState: { allSegments: [] as unknown[] },
}));

vi.mock("@/hooks/useCRMPersonas", () => ({
  useCRMPersonas: () => ({
    personas: [],
    loading: false,
    error: null,
    fetchPersonas: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCRMTags", () => ({
  useCRMTags: () => ({
    tags: [{ id: "tag-1", name: "Newsletter" }],
    loading: false,
    error: null,
    fetchTags: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSegments", () => ({
  useSegments: () => ({
    allSegments: segmentsState.allSegments,
    segments: segmentsState.allSegments,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

function segment(overrides: Partial<SegmentListItem>): SegmentListItem {
  return {
    id: "segment",
    name: "Segment",
    description: null,
    type: "static",
    status: "active",
    rules: { id: "root", combinator: "and", children: [] },
    includeAllCustomers: false,
    memberCount: 0,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    isSystemSegment: false,
    tenantId: "tenant-1",
    personaId: null,
    source: null,
    sourceId: null,
    autoUpdate: false,
    ...overrides,
  } as SegmentListItem;
}

const retail = segment({ id: "seg-retail", name: "Retail", memberCount: 12 });
const wholesale = segment({ id: "seg-wholesale", name: "Wholesale" });
const bigSpenders = segment({
  id: "seg-dynamic",
  name: "Big spenders",
  type: "dynamic",
  autoUpdate: true,
});

function renderTab(audience: Partial<FormAudience> = {}) {
  const onAudienceChange = vi.fn();
  render(
    <MemoryRouter>
      <FormAudienceTab
        audience={{
          assign_personas: [],
          assign_tags: [],
          segment_ids: [],
          ...audience,
        }}
        onAudienceChange={onAudienceChange}
      />
    </MemoryRouter>,
  );
  return { onAudienceChange };
}

describe("FormAudienceTab automatic segments", () => {
  beforeEach(() => {
    segmentsState.allSegments = [retail, wholesale, bigSpenders];
  });

  it("explains the setting and links to segment management", () => {
    renderTab();

    expect(
      screen.getByText(
        "Everyone who submits this form will automatically be added to the selected segments. This selection is not visible to the customer.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage segments/i }),
    ).toHaveAttribute("href", "/crm/segments");
    expect(
      screen.getByText(/does not give permission to email or text/i),
    ).toBeInTheDocument();
  });

  it("adds a fixed-list segment and keeps rule-based segments unselectable", async () => {
    const user = userEvent.setup();
    const { onAudienceChange } = renderTab({ segment_ids: ["seg-retail"] });

    await user.click(screen.getByPlaceholderText("Search segments"));
    const listbox = await screen.findByRole("listbox");

    expect(
      within(listbox).getByText(
        "Rule-based · people join when they match its rules",
      ),
    ).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", { name: /big spenders/i }),
    ).toHaveAttribute("aria-disabled", "true");

    await user.click(
      within(listbox).getByRole("option", { name: /wholesale/i }),
    );

    expect(onAudienceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        segment_ids: ["seg-retail", "seg-wholesale"],
      }),
    );
  });

  it("removes a selected segment from its chip", async () => {
    const user = userEvent.setup();
    const { onAudienceChange } = renderTab({
      segment_ids: ["seg-retail", "seg-wholesale"],
    });

    await user.click(screen.getByRole("button", { name: "Remove Retail" }));

    expect(onAudienceChange).toHaveBeenCalledWith(
      expect.objectContaining({ segment_ids: ["seg-wholesale"] }),
    );
  });

  it("warns when a saved segment was deleted or became rule-based", () => {
    renderTab({ segment_ids: ["seg-gone", "seg-dynamic"] });

    expect(screen.getByText("Deleted segment:")).toBeInTheDocument();
    expect(
      screen.getByText(/this form cannot add people to it/i),
    ).toBeInTheDocument();
  });

  it("shows a clear empty state when there is no fixed-list segment", () => {
    segmentsState.allSegments = [bigSpenders];
    renderTab();

    expect(
      screen.getByText(/You have no fixed-list segments yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage segments/i }),
    ).toBeInTheDocument();
  });

  it("no longer says tag assignment is unfinished", () => {
    renderTab();

    expect(screen.queryByText(/being finalized/i)).not.toBeInTheDocument();
  });
});
