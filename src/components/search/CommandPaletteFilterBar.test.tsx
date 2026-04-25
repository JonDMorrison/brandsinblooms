import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPaletteFilterBar } from "@/components/search/CommandPaletteFilterBar";
import type { SearchFilterValue } from "@/components/search/searchFilters";

const FILTERS: SearchFilterValue[] = ["all", "customers", "campaigns"];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CommandPaletteFilterBar", () => {
  it("renders direct tab buttons without nested button warnings", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <CommandPaletteFilterBar
        activeFilter="all"
        counts={{ all: 7, customers: 4, campaigns: 3 }}
        filterRefs={{ current: [] }}
        filters={FILTERS}
        onFocusFilter={vi.fn()}
        onKeyDownFilter={vi.fn()}
        onSelectFilter={vi.fn()}
        tabListId="command-palette-filter-tabs"
      />,
    );

    const tablist = screen.getByRole("tablist", {
      name: "Search result filters",
    });
    const directChildren = Array.from(tablist.children);
    const tabs = within(tablist).getAllByRole("tab");

    expect(tabs).toHaveLength(FILTERS.length);
    expect(directChildren).toHaveLength(FILTERS.length);

    directChildren.forEach((child) => {
      expect(child.tagName).toBe("BUTTON");
      expect(child).toHaveAttribute("role", "tab");
      expect(child.querySelector("button")).toBeNull();
    });

    expect(
      consoleErrorSpy.mock.calls.some(([message]) => {
        const text = String(message ?? "");
        return (
          text.includes("validateDOMNesting") ||
          text.includes("<button> cannot appear as a descendant of <button>")
        );
      }),
    ).toBe(false);
  });

  it("keeps tab interaction handlers on the actual tab button", () => {
    const onFocusFilter = vi.fn();
    const onKeyDownFilter = vi.fn();
    const onSelectFilter = vi.fn();

    render(
      <CommandPaletteFilterBar
        activeFilter="all"
        counts={{ all: 7, customers: 4, campaigns: 3 }}
        filterRefs={{ current: [] }}
        filters={FILTERS}
        onFocusFilter={onFocusFilter}
        onKeyDownFilter={onKeyDownFilter}
        onSelectFilter={onSelectFilter}
        tabListId="command-palette-filter-tabs"
      />,
    );

    const [, customersTab] = within(
      screen.getByRole("tablist", { name: "Search result filters" }),
    ).getAllByRole("tab");

    fireEvent.focus(customersTab);
    fireEvent.keyDown(customersTab, { key: "ArrowRight" });
    fireEvent.click(customersTab);

    expect(onFocusFilter).toHaveBeenCalledWith(1);
    expect(onKeyDownFilter).toHaveBeenCalledWith(expect.any(Object), 1);
    expect(onSelectFilter).toHaveBeenCalledWith("customers");
  });
});