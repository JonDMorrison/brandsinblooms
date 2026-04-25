import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { PaletteExecutableAction } from "@/components/search/searchActionRegistry";
import {
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/search/types";

interface UseCommandPaletteNavigationOptions {
  getItemActions: (item: SearchResultItem) => PaletteExecutableAction[];
  groups: SearchResultGroup[];
  enabled: boolean;
  onClose: () => void;
  onOpenInNewTab: (item: SearchResultItem) => void;
  onSelectAction: (item: SearchResultItem, action: PaletteExecutableAction) => void;
  onSelect: (item: SearchResultItem) => void;
}

export function useCommandPaletteNavigation({
  getItemActions,
  groups,
  enabled,
  onClose,
  onOpenInNewTab,
  onSelectAction,
  onSelect,
}: UseCommandPaletteNavigationOptions) {
  const flatItems = useMemo(
    () => groups.flatMap((group) => group.results),
    [groups],
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [openActionItemId, setOpenActionItemId] = useState<string | null>(null);
  const [activeActionIndex, setActiveActionIndex] = useState(0);

  useEffect(() => {
    if (!enabled || flatItems.length === 0) {
      setActiveIndex(-1);
      setOpenActionItemId(null);
      setActiveActionIndex(0);
      return;
    }

    setActiveIndex((currentIndex) => {
      if (currentIndex < 0 || currentIndex >= flatItems.length) {
        return 0;
      }

      return currentIndex;
    });
  }, [enabled, flatItems]);

  useEffect(() => {
    if (!openActionItemId) {
      return;
    }

    const activeItem = flatItems.find((item) => item.id === openActionItemId);

    if (!activeItem) {
      setOpenActionItemId(null);
      setActiveActionIndex(0);
      return;
    }

    const actions = getItemActions(activeItem);

    if (actions.length === 0) {
      setOpenActionItemId(null);
      setActiveActionIndex(0);
      return;
    }

    setActiveActionIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(actions.length - 1, 0)),
    );
  }, [flatItems, getItemActions, openActionItemId]);

  const moveActiveIndex = useCallback(
    (direction: 1 | -1) => {
      if (flatItems.length === 0) {
        return;
      }

      setActiveIndex((currentIndex) => {
        const baseIndex = currentIndex === -1 ? (direction === 1 ? -1 : 0) : currentIndex;
        return (baseIndex + direction + flatItems.length) % flatItems.length;
      });
      setOpenActionItemId(null);
      setActiveActionIndex(0);
    },
    [flatItems.length],
  );

  const activeItem = activeIndex >= 0 ? flatItems[activeIndex] : null;
  const activeActions = useMemo(
    () => (activeItem ? getItemActions(activeItem) : []),
    [activeItem, getItemActions],
  );
  const isActionMenuOpen = activeItem?.id === openActionItemId;

  const openActionMenu = useCallback(
    (itemId?: string | null) => {
      const targetItem = flatItems.find((item) => item.id === itemId) ?? activeItem;

      if (!targetItem) {
        return;
      }

      const nextActions = getItemActions(targetItem);

      if (nextActions.length === 0) {
        return;
      }

      const nextIndex = flatItems.findIndex((item) => item.id === targetItem.id);

      if (nextIndex !== -1) {
        setActiveIndex(nextIndex);
      }

      setOpenActionItemId(targetItem.id);
      setActiveActionIndex(0);
    },
    [activeItem, flatItems, getItemActions],
  );

  const closeActionMenu = useCallback(() => {
    setOpenActionItemId(null);
    setActiveActionIndex(0);
  }, []);

  const setActiveActionByIndex = useCallback(
    (index: number) => {
      if (!isActionMenuOpen || activeActions.length === 0) {
        return;
      }

      const normalizedIndex =
        (index + activeActions.length) % activeActions.length;
      setActiveActionIndex(normalizedIndex);
    },
    [activeActions.length, isActionMenuOpen],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();

        if (isActionMenuOpen && activeActions.length > 0) {
          setActiveActionByIndex(activeActionIndex + 1);
          return;
        }

        moveActiveIndex(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        if (isActionMenuOpen && activeActions.length > 0) {
          setActiveActionByIndex(activeActionIndex - 1);
          return;
        }

        moveActiveIndex(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        if (activeItem) {
          event.preventDefault();
          openActionMenu(activeItem.id);
        }

        return;
      }

      if (event.key === "ArrowLeft") {
        if (isActionMenuOpen) {
          event.preventDefault();
          closeActionMenu();
        }

        return;
      }

      if (event.key === "Enter") {
        if (activeItem) {
          event.preventDefault();

          if ((event.metaKey || event.ctrlKey) && !isActionMenuOpen) {
            onOpenInNewTab(activeItem);
            return;
          }

          if (isActionMenuOpen && activeActions[activeActionIndex]) {
            onSelectAction(activeItem, activeActions[activeActionIndex]);
            return;
          }

          onSelect(activeItem);
        }

        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        if (isActionMenuOpen) {
          closeActionMenu();
          return;
        }

        onClose();
      }
    },
    [
      activeActionIndex,
      activeActions,
      activeItem,
      closeActionMenu,
      enabled,
      isActionMenuOpen,
      moveActiveIndex,
      onClose,
      onOpenInNewTab,
      onSelect,
      onSelectAction,
      openActionMenu,
      setActiveActionByIndex,
    ],
  );

  const setActiveItemById = useCallback(
    (itemId: string) => {
      const nextIndex = flatItems.findIndex((item) => item.id === itemId);

      if (nextIndex !== -1) {
        setActiveIndex(nextIndex);

        if (openActionItemId && openActionItemId !== itemId) {
          setOpenActionItemId(null);
          setActiveActionIndex(0);
        }
      }
    },
    [flatItems, openActionItemId],
  );

  return {
    activeIndex,
    activeActionIndex,
    activeActions,
    activeItem,
    flatItems,
    handleKeyDown,
    isActionMenuOpen,
    openActionItemId,
    openActionMenu,
    closeActionMenu,
    setActiveActionByIndex,
    setActiveItemById,
  };
}