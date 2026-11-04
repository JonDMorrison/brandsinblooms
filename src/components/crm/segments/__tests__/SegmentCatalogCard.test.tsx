import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import userEvent from "@testing-library/user-event";
import { PersonaCard } from "@/components/crm/personas/PersonaCard";
import { CatalogViewToggle, type CatalogLayout } from "@/components/crm/catalog/CatalogViewToggle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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


const interactionItem: SegmentCatalogItem = {
  id: "test", name: "Test group", description: "A saved audience",
  isSystemSegment: false, memberCount: 5, averageValue: null, totalValue: null,
};

function renderInteractiveCard(kind: "segment" | "persona", layout: CatalogLayout) {
  const callbacks = {
    onView: vi.fn(), onCreateCampaign: vi.fn(), onEdit: vi.fn(),
    onDuplicate: vi.fn(), onDelete: vi.fn(),
  };
  render(
    <MemoryRouter>
      {kind === "segment" ? (
        <SegmentCatalogCard
          item={interactionItem} layout={layout}
          detailHref="/crm/segments/test" campaignHref="/crm/campaigns/new?segment=test" membersHref="/crm/segments/test/members"
          {...callbacks} onViewMembers={vi.fn()} onExportMembers={vi.fn()} onArchive={callbacks.onDelete}
        />
      ) : (
        <PersonaCard
          persona={{ id: "test", persona_name: "Test group", persona_description: "A saved audience", is_custom: true }}
          layout={layout} detailHref="/crm/personas/test" campaignHref="/crm/campaigns/new?persona=test"
          {...callbacks}
        />
      )}
    </MemoryRouter>,
  );
  return callbacks;
}

for (const kind of ["segment", "persona"] as const) {
  for (const layout of ["grid", "list"] as const) {
    describe(`${kind} ${layout} actions`, () => {
      it("opens the menu without navigating, and performs only the chosen action", async () => {
        const user = userEvent.setup();
        const callbacks = renderInteractiveCard(kind, layout);
        await user.click(screen.getByRole("button", { name: "Actions for Test group" }));
        expect(screen.getByRole("menu")).toBeVisible();
        Object.values(callbacks).forEach((callback) => expect(callback).not.toHaveBeenCalled());
        await user.click(screen.getByRole("menuitem", { name: `Edit ${kind}` }));
        expect(callbacks.onEdit).toHaveBeenCalledTimes(1);
        expect(callbacks.onView).not.toHaveBeenCalled();
        expect(callbacks.onDelete).not.toHaveBeenCalled();
        expect(callbacks.onCreateCampaign).not.toHaveBeenCalled();
      });

      it("supports keyboard opening and Escape without selecting an action", async () => {
        const user = userEvent.setup();
        const callbacks = renderInteractiveCard(kind, layout);
        const trigger = screen.getByRole("button", { name: "Actions for Test group" });
        act(() => trigger.focus());
        await user.keyboard("{ArrowDown}");
        await waitFor(() => expect(screen.getByRole("menu")).toBeVisible());
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
        Object.values(callbacks).forEach((callback) => expect(callback).not.toHaveBeenCalled());
      });

      it("does not double-navigate when View details is selected", async () => {
        const user = userEvent.setup();
        const callbacks = renderInteractiveCard(kind, layout);
        await user.click(screen.getByRole("button", { name: "Actions for Test group" }));
        await user.click(screen.getByRole("menuitem", { name: "View details" }));
        expect(callbacks.onView).toHaveBeenCalledTimes(1);
        expect(callbacks.onDelete).not.toHaveBeenCalled();
      });

      it("requests archive or delete only after an explicit selection", async () => {
        const user = userEvent.setup();
        const callbacks = renderInteractiveCard(kind, layout);
        await user.click(screen.getByRole("button", { name: "Actions for Test group" }));
        expect(callbacks.onDelete).not.toHaveBeenCalled();
        await user.click(screen.getByRole("menuitem", { name: kind === "segment" ? "Archive segment" : "Delete persona" }));
        expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
        expect(callbacks.onView).not.toHaveBeenCalled();
      });
    });
  }
}

describe("compact catalog rows", () => {
  it("preserves missing-data explanations and the original campaign target", () => {
    render(
      <MemoryRouter>
        <SegmentCatalogCard item={{ ...interactionItem, memberCount: 0, emptyReason: REASON }} layout="list"
          detailHref="/crm/segments/test" campaignHref="/crm/campaigns/new?segment=test" membersHref="/crm/segments/test/members"
          onView={vi.fn()} onViewMembers={vi.fn()} onCreateCampaign={vi.fn()} onExportMembers={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("article", { name: "Test group" })).toBeVisible();
    expect(screen.getByText(REASON)).toBeInTheDocument();
    expect(screen.getAllByText("Not available")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Create campaign" })).toHaveAttribute("href", "/crm/campaigns/new?segment=test");
  });

  it.each(["grid", "list"] as const)("does not invent persona metrics in %s view", (layout) => {
    renderInteractiveCard("persona", layout);
    expect(screen.getAllByText("Not available")).toHaveLength(3);
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });
});

function LayoutPreference({ storageKey = "crm:test:layout" }: { storageKey?: string }) {
  const [stored, setStored] = useLocalStorage<CatalogLayout>(storageKey, "grid");
  const layout = stored === "list" ? "list" : "grid";
  return <CatalogViewToggle value={layout} onChange={setStored} label="Catalog view" />;
}

describe("catalog layout preference", () => {
  it("remembers the selected layout after remounting", () => {
    window.localStorage.clear();
    const mounted = render(<LayoutPreference />);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(window.localStorage.getItem("crm:test:layout")).toBe('"list"');
    mounted.unmount();
    render(<LayoutPreference />);
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    window.localStorage.clear();
  });

  it.each(['invalid json', '"unexpected"', 'null'])("falls back to Grid for invalid preference %s", (stored) => {
    window.localStorage.setItem("crm:test:layout", stored);
    render(<LayoutPreference />);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    window.localStorage.clear();
  });

  it("keeps segment and persona preferences separate", () => {
    window.localStorage.setItem("crm:segments:layout", '"list"');
    window.localStorage.removeItem("crm:personas:layout");
    render(<LayoutPreference storageKey="crm:personas:layout" />);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    window.localStorage.clear();
  });
});
