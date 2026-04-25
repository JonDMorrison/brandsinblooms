import { renderHook, act } from "@testing-library/react";
import { ArrowUpRight, Copy } from "lucide-react";
import type { KeyboardEvent } from "react";

import type { PaletteExecutableAction } from "./searchActionRegistry";
import { useCommandPaletteNavigation } from "./useCommandPaletteNavigation";
import type { SearchResultGroup } from "./types";

function createKeyboardEvent(
  key: string,
  options?: { ctrlKey?: boolean; metaKey?: boolean },
) {
  return {
    key,
    ctrlKey: options?.ctrlKey ?? false,
    metaKey: options?.metaKey ?? false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

const groups: SearchResultGroup[] = [
  {
    category: "pages",
    title: "Pages",
    icon: "pages",
    results: [
      {
        id: "page:dashboard",
        type: "page",
        title: "Dashboard",
        route: "/dashboard",
        categoryIcon: "pages",
        group: "pages",
      },
    ],
  },
];

const rowActions: PaletteExecutableAction[] = [
  {
    id: "page:dashboard:open",
    label: "Open Page",
    icon: ArrowUpRight,
    execution: {
      type: "navigate",
      route: "/dashboard",
    },
  },
  {
    id: "page:dashboard:copy",
    label: "Copy Link",
    icon: Copy,
    keepPaletteOpen: true,
    execution: {
      type: "copy",
      value: "/dashboard",
    },
  },
];

describe("useCommandPaletteNavigation", () => {
  it("opens, navigates, and executes an action submenu with the keyboard", () => {
    const onClose = vi.fn();
    const onOpenInNewTab = vi.fn();
    const onSelect = vi.fn();
    const onSelectAction = vi.fn();

    const { result } = renderHook(() =>
      useCommandPaletteNavigation({
        getItemActions: () => rowActions,
        groups,
        enabled: true,
        onClose,
        onOpenInNewTab,
        onSelect,
        onSelectAction,
      }),
    );

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
    });

    expect(result.current.openActionItemId).toBe("page:dashboard");
    expect(result.current.activeActionIndex).toBe(0);

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.activeActionIndex).toBe(1);

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });

    expect(onSelectAction).toHaveBeenCalledWith(groups[0].results[0], rowActions[1]);
    expect(onSelect).not.toHaveBeenCalled();

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Escape"));
    });

    expect(result.current.openActionItemId).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens the active row in a new tab with ctrl/cmd enter", () => {
    const onClose = vi.fn();
    const onOpenInNewTab = vi.fn();
    const onSelect = vi.fn();
    const onSelectAction = vi.fn();

    const { result } = renderHook(() =>
      useCommandPaletteNavigation({
        getItemActions: () => rowActions,
        groups,
        enabled: true,
        onClose,
        onOpenInNewTab,
        onSelect,
        onSelectAction,
      }),
    );

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter", { ctrlKey: true }));
    });

    expect(onOpenInNewTab).toHaveBeenCalledWith(groups[0].results[0]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onSelectAction).not.toHaveBeenCalled();
  });
});