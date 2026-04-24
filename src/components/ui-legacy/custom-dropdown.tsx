import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { Z } from "@/lib/zLayer";

type Align = "start" | "center" | "end";

type TriggerRenderProps = {
  ref: React.RefCallback<HTMLElement>;
  onClick: React.MouseEventHandler;
  onKeyDown: React.KeyboardEventHandler;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
};

export type CustomDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: TriggerRenderProps) => React.ReactNode;
  children: React.ReactNode;
  align?: Align;
  sideOffset?: number;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CustomDropdown({
  open,
  onOpenChange,
  trigger,
  children,
  align = "start",
  sideOffset = 8,
  contentClassName,
  contentStyle,
}: CustomDropdownProps) {
  const triggerElRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => setMounted(true), []);

  const setTriggerRef = useMemo<React.RefCallback<HTMLElement>>(
    () => (node) => {
      triggerElRef.current = node;
    },
    [],
  );

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const triggerEl = triggerElRef.current;
      const contentEl = contentRef.current;
      if (!triggerEl || !contentEl) return;

      const rect = triggerEl.getBoundingClientRect();
      const contentRect = contentEl.getBoundingClientRect();

      let left = rect.left;
      if (align === "center") {
        left = rect.left + rect.width / 2 - contentRect.width / 2;
      } else if (align === "end") {
        left = rect.right - contentRect.width;
      }

      const padding = 8;
      const maxLeft = window.innerWidth - contentRect.width - padding;
      left = clamp(left, padding, Math.max(padding, maxLeft));

      let top = rect.bottom + sideOffset;
      const maxTop = window.innerHeight - contentRect.height - padding;
      if (top > maxTop) {
        // Flip above if it would overflow.
        const above = rect.top - sideOffset - contentRect.height;
        if (above >= padding) top = above;
        else top = clamp(top, padding, Math.max(padding, maxTop));
      }

      setPos({ top, left, width: rect.width });
    };

    updatePosition();

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [align, open, sideOffset]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;

      const triggerEl = triggerElRef.current;
      const contentEl = contentRef.current;
      if (!triggerEl || !contentEl) return;

      if (triggerEl.contains(t)) return;
      if (contentEl.contains(t)) return;

      onOpenChange(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onOpenChange, open]);

  return (
    <>
      {trigger({
        ref: setTriggerRef,
        onClick: () => onOpenChange(!open),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenChange(!open);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onOpenChange(false);
          }
        },
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}

      {mounted && open
        ? createPortal(
            <div
              ref={contentRef}
              data-app-portal
              role="menu"
              className={cn(
                "fixed min-w-[12rem]",
                "rounded-xl border bg-background shadow-lg",
                "p-1",
                "origin-top-left transition-all duration-150 ease-out",
                "animate-in fade-in-0 zoom-in-95",
                contentClassName,
              )}
              style={{
                top: pos.top,
                left: pos.left,
                zIndex: Z.dropdown,
                ...contentStyle,
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function CustomDropdownItem({
  children,
  onSelect,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "w-full text-left",
        "rounded-lg px-3 py-2 text-sm",
        "hover:bg-muted/60 focus:bg-muted/60 focus:outline-none",
        "disabled:opacity-50 disabled:hover:bg-transparent",
        className,
      )}
      onClick={() => onSelect?.()}
    >
      {children}
    </button>
  );
}
