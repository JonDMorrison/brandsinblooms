import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterChipBar } from "./FilterChipBar";
import type { FilterValue } from "./types";

const emptyFilterValue: FilterValue = {
  mode: "include",
  selectedIds: [],
};

describe("FilterChipBar", () => {
  it("renders active chips and clears all filters", () => {
    const onClearAll = vi.fn();

    render(
      <FilterChipBar
        clearAllVisible
        filters={[
          {
            definition: {
              id: "status",
              label: "Status",
              options: [
                { id: "active", label: "Active" },
                { id: "paused", label: "Paused" },
              ],
            },
            onChange: vi.fn(),
            value: {
              mode: "include",
              selectedIds: ["active"],
            },
          },
        ]}
        onClearAll={onClearAll}
        sort={{
          label: "Sort",
          onChange: vi.fn(),
          options: [
            { id: "newest", label: "Newest" },
            { id: "last_modified", label: "Last Modified" },
          ],
          value: "newest",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Active" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("opens the popover and sort menu", async () => {
    const onStatusChange = vi.fn();
    const onSortChange = vi.fn();

    render(
      <FilterChipBar
        filters={[
          {
            definition: {
              id: "status",
              label: "Status",
              options: [
                { id: "active", label: "Active" },
                { id: "completed", label: "Completed" },
              ],
            },
            onChange: onStatusChange,
            value: emptyFilterValue,
          },
        ]}
        sort={{
          label: "Sort",
          onChange: onSortChange,
          options: [
            { id: "newest", label: "Newest" },
            { id: "last_modified", label: "Last Modified" },
          ],
          value: "newest",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(await screen.findByText("Completed"));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        mode: "include",
        selectedIds: ["completed"],
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Newest" }));
    fireEvent.click(await screen.findByText("Last Modified"));

    await waitFor(() => {
      expect(onSortChange).toHaveBeenCalledWith("last_modified");
    });
  });

  it("closes open filter layers on outside click", async () => {
    render(
      <FilterChipBar
        filters={[
          {
            definition: {
              id: "status",
              label: "Status",
              options: [
                { id: "active", label: "Active" },
                { id: "completed", label: "Completed" },
              ],
            },
            onChange: vi.fn(),
            value: emptyFilterValue,
          },
        ]}
        sort={{
          label: "Sort",
          onChange: vi.fn(),
          options: [
            { id: "newest", label: "Newest" },
            { id: "last_modified", label: "Last Modified" },
          ],
          value: "newest",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(await screen.findByText("Completed")).toBeTruthy();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Completed")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Newest" }));
    expect(await screen.findByText("Last Modified")).toBeTruthy();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Last Modified")).toBeNull();
    });
  });
});
