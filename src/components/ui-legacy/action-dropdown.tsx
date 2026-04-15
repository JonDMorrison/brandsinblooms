import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  ChevronDown,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui-legacy/badge";
import { Button, type ButtonProps } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";

type TriggerVariant = "primary" | "outline" | "ghost";
type DropdownAlign = "start" | "center" | "end";
type DropdownSide = "top" | "bottom";

export interface ActionDropdownItem {
  id?: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
  onSelect?: () => void;
}

export interface ActionDropdownSection {
  id?: string;
  label?: string;
  items: ActionDropdownItem[];
}

interface SharedDropdownProps {
  label?: string;
  triggerIcon?: LucideIcon;
  variant?: TriggerVariant;
  badge?: React.ReactNode;
  disabled?: boolean;
  align?: DropdownAlign;
  side?: DropdownSide;
  sideOffset?: number;
  triggerClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
  iconOnly?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface ActionDropdownProps extends SharedDropdownProps {
  sections: ActionDropdownSection[];
}

export interface FilterDropdownOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  selected: boolean;
  disabled?: boolean;
  onToggle: (nextSelected: boolean) => void;
}

export interface FilterDropdownInputField {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}

export interface FilterDropdownSection {
  id?: string;
  title: string;
  description?: string;
  options?: FilterDropdownOption[];
  inputs?: FilterDropdownInputField[];
  content?: React.ReactNode;
}

export interface FilterDropdownProps extends SharedDropdownProps {
  sections: FilterDropdownSection[];
  applyLabel?: string;
  clearLabel?: string;
  onApply?: () => void;
  onClear?: () => void;
  applyDisabled?: boolean;
  clearDisabled?: boolean;
  closeOnApply?: boolean;
  closeOnClear?: boolean;
}

function mapTriggerVariant(variant: TriggerVariant): ButtonProps["variant"] {
  switch (variant) {
    case "outline":
      return "outline";
    case "ghost":
      return "ghost";
    default:
      return "default";
  }
}

function useControllableOpen(
  openProp: boolean | undefined,
  onOpenChange?: (open: boolean) => void,
) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = openProp ?? internalOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openProp],
  );

  return { open, setOpen };
}

function useDropdownSurface(
  open: boolean,
  setOpen: (nextOpen: boolean) => void,
) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  return { rootRef };
}

function TriggerBadge({ badge }: { badge?: React.ReactNode }) {
  if (badge === undefined || badge === null || badge === false) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className="ml-1 h-5 min-w-5 justify-center rounded-full bg-brand-navy/10 px-1.5 text-[11px] font-semibold text-brand-navy shadow-none hover:scale-100"
    >
      {badge}
    </Badge>
  );
}

function DropdownTriggerButton({
  label,
  ariaLabel,
  disabled,
  badge,
  triggerClassName,
  variant,
  TriggerIcon,
  iconOnly,
  open,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  disabled?: boolean;
  badge?: React.ReactNode;
  triggerClassName?: string;
  variant: TriggerVariant;
  TriggerIcon?: LucideIcon;
  iconOnly?: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={mapTriggerVariant(variant)}
      disabled={disabled}
      aria-label={ariaLabel || label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl px-3.5 text-sm font-medium shadow-sm",
        variant === "primary" &&
          "bg-brand-teal text-white hover:bg-brand-teal/90 hover:text-white",
        variant === "outline" &&
          "border-border bg-white text-brand-navy hover:border-brand-teal/40 hover:bg-brand-teal/5 hover:text-brand-navy",
        variant === "ghost" &&
          "bg-transparent text-brand-navy hover:bg-brand-navy/5 hover:text-brand-navy shadow-none",
        iconOnly && "w-9 px-0 justify-center",
        triggerClassName,
      )}
    >
      {iconOnly ? (
        <>
          {TriggerIcon ? <TriggerIcon className="h-4 w-4 opacity-80" /> : null}
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-2">
            <span>{label}</span>
            <TriggerBadge badge={badge} />
          </span>
          {TriggerIcon ? <TriggerIcon className="h-4 w-4 opacity-75" /> : null}
        </>
      )}
    </Button>
  );
}

function getMenuPositionClasses(
  align: DropdownAlign,
  side: DropdownSide,
  sideOffset: number,
) {
  const sideClass = side === "top" ? "bottom-full" : "top-full";
  const offsetClass =
    side === "top"
      ? `mb-${Math.min(sideOffset, 8)}`
      : `mt-${Math.min(sideOffset, 8)}`;

  const alignClass =
    align === "start"
      ? "left-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "right-0";

  return `${sideClass} ${offsetClass} ${alignClass}`;
}

function ActionMenuRow({ item }: { item: ActionDropdownItem }) {
  const ItemIcon = item.icon;

  return (
    <div className="flex min-w-0 items-start gap-3">
      {ItemIcon ? (
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            item.destructive
              ? "border-red-100 bg-red-50 text-red-600"
              : "border-brand-teal/10 bg-brand-teal/5 text-brand-teal",
          )}
        >
          <ItemIcon className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{item.label}</span>
          {item.shortcut ? (
            <span className="ml-auto text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {item.shortcut}
            </span>
          ) : null}
        </div>
        {item.description ? (
          <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {item.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DropdownShell({
  open,
  rootRef,
  align,
  side,
  sideOffset,
  trigger,
  contentClassName,
  children,
}: {
  open: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  align: DropdownAlign;
  side: DropdownSide;
  sideOffset: number;
  trigger: React.ReactNode;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={rootRef}
      className={cn(
        "relative inline-flex overflow-visible",
        open && "z-[1000020]",
      )}
    >
      {trigger}
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-[1000030] min-w-[8rem] border border-gray-200 bg-white text-brand-navy shadow-lg shadow-brand-navy/10",
            getMenuPositionClasses(align, side, sideOffset),
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ActionDropdown({
  label = "Actions",
  triggerIcon = ChevronDown,
  variant = "outline",
  badge,
  disabled,
  align = "end",
  side = "bottom",
  sideOffset = 2,
  triggerClassName,
  contentClassName,
  ariaLabel,
  iconOnly = false,
  open: openProp,
  onOpenChange,
  sections,
}: ActionDropdownProps) {
  const { open, setOpen } = useControllableOpen(openProp, onOpenChange);
  const { rootRef } = useDropdownSurface(open, setOpen);

  return (
    <DropdownShell
      open={open}
      rootRef={rootRef}
      align={align}
      side={side}
      sideOffset={sideOffset}
      contentClassName={cn(
        "w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-white p-2.5",
        contentClassName,
      )}
      trigger={
        <DropdownTriggerButton
          label={label}
          ariaLabel={ariaLabel}
          disabled={disabled}
          badge={badge}
          triggerClassName={triggerClassName}
          variant={variant}
          TriggerIcon={triggerIcon}
          iconOnly={iconOnly}
          open={open}
          onClick={() => setOpen(!open)}
        />
      }
    >
      {sections.map((section, sectionIndex) => (
        <div key={section.id || `section-${sectionIndex}`} className="contents">
          {sectionIndex > 0 ? (
            <div className="mx-1 my-2 h-px bg-brand-navy/8" />
          ) : null}
          {section.label ? (
            <div className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.label}
            </div>
          ) : null}
          <div className="space-y-1">
            {section.items.map((item, itemIndex) => (
              <button
                key={item.id || `${sectionIndex}-${itemIndex}-${item.label}`}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2",
                  "hover:bg-brand-teal/8",
                  item.destructive
                    ? "text-red-700 hover:bg-red-50"
                    : "text-brand-navy",
                  item.disabled &&
                    "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
              >
                <ActionMenuRow item={item} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </DropdownShell>
  );
}

function FilterSectionBody({ section }: { section: FilterDropdownSection }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {section.title}
        </div>
        {section.description ? (
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {section.description}
          </div>
        ) : null}
      </div>

      {section.options?.length ? (
        <div className="flex flex-wrap gap-2">
          {section.options.map((option) => {
            const OptionIcon = option.icon;

            return (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled}
                aria-pressed={option.selected}
                onClick={() => option.onToggle(!option.selected)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-150 ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2",
                  option.selected
                    ? "border-brand-teal bg-brand-teal text-white shadow-sm"
                    : "border-border bg-white text-brand-navy hover:border-brand-teal/30 hover:bg-brand-teal/5",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {OptionIcon ? <OptionIcon className="h-4 w-4" /> : null}
                <span>{option.label}</span>
                {option.selected ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {section.inputs?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {section.inputs.map((field) => (
            <Input
              key={field.id}
              id={field.id}
              type={field.type || "text"}
              label={field.label}
              value={field.value}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              disabled={field.disabled}
              onChange={(event) => field.onChange(event.target.value)}
              className="h-10 rounded-xl border-border bg-white"
            />
          ))}
        </div>
      ) : null}

      {section.content ? <div>{section.content}</div> : null}
    </div>
  );
}

export function FilterDropdown({
  label = "Filters",
  triggerIcon = SlidersHorizontal,
  variant = "outline",
  badge,
  disabled,
  align = "end",
  side = "bottom",
  sideOffset = 2,
  triggerClassName,
  contentClassName,
  ariaLabel,
  iconOnly = false,
  open: openProp,
  onOpenChange,
  sections,
  applyLabel = "Apply",
  clearLabel = "Clear",
  onApply,
  onClear,
  applyDisabled,
  clearDisabled,
  closeOnApply = true,
  closeOnClear = false,
}: FilterDropdownProps) {
  const { open, setOpen } = useControllableOpen(openProp, onOpenChange);
  const { rootRef } = useDropdownSurface(open, setOpen);

  const handleApply = React.useCallback(() => {
    onApply?.();
    if (closeOnApply) {
      setOpen(false);
    }
  }, [closeOnApply, onApply, setOpen]);

  const handleClear = React.useCallback(() => {
    onClear?.();
    if (closeOnClear) {
      setOpen(false);
    }
  }, [closeOnClear, onClear, setOpen]);

  return (
    <DropdownShell
      open={open}
      rootRef={rootRef}
      align={align}
      side={side}
      sideOffset={sideOffset}
      contentClassName={cn(
        "w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0",
        contentClassName,
      )}
      trigger={
        <DropdownTriggerButton
          label={label}
          ariaLabel={ariaLabel}
          disabled={disabled}
          badge={badge}
          triggerClassName={triggerClassName}
          variant={variant}
          TriggerIcon={triggerIcon || MoreHorizontal}
          iconOnly={iconOnly}
          open={open}
          onClick={() => setOpen(!open)}
        />
      }
    >
      <div className="border-b border-gray-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-brand-navy">{label}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Refine the current view with filters and display options.
            </div>
          </div>
          <TriggerBadge badge={badge} />
        </div>
      </div>

      <div className="max-h-[28rem] space-y-5 overflow-y-auto bg-white px-5 py-4">
        {sections.map((section, index) => (
          <div
            key={section.id || `filter-section-${index}`}
            className="contents"
          >
            {index > 0 ? <div className="h-px bg-brand-navy/8" /> : null}
            <FilterSectionBody section={section} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-gray-200 bg-white px-5 py-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={clearDisabled}
          onClick={handleClear}
          className="text-muted-foreground hover:bg-brand-navy/5 hover:text-brand-navy"
        >
          {clearLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={applyDisabled}
          onClick={handleApply}
          className="rounded-xl bg-brand-teal px-4 text-white hover:bg-brand-teal/90"
        >
          {applyLabel}
        </Button>
      </div>
    </DropdownShell>
  );
}
