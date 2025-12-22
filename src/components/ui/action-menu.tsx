import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, MoreVertical, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  shortcut?: string;
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationActionLabel?: string;
}

export interface ActionMenuSeparator {
  type: 'separator';
}

export interface ActionMenuGroup {
  label?: string;
  items: (ActionMenuItem | ActionMenuSeparator)[];
}

export type ActionMenuItemType = ActionMenuItem | ActionMenuSeparator | ActionMenuGroup;

export interface ActionMenuProps {
  items: ActionMenuItemType[];
  trigger?: 'horizontal' | 'vertical' | ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// ============================================================================
// Type Guards
// ============================================================================

const isSeparator = (item: ActionMenuItemType): item is ActionMenuSeparator => {
  return 'type' in item && item.type === 'separator';
};

const isGroup = (item: ActionMenuItemType): item is ActionMenuGroup => {
  return 'items' in item && Array.isArray(item.items);
};

const isActionItem = (item: ActionMenuItemType): item is ActionMenuItem => {
  return 'label' in item && !('items' in item);
};

// ============================================================================
// Custom Hook: Click Outside Detection (Fixed)
// ============================================================================

function useClickOutside(
  triggerRef: React.RefObject<HTMLElement | null>,
  dropdownRef: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean
) {
  const isJustOpenedRef = useRef(false);

  useEffect(() => {
    if (enabled) {
      // Mark that we just opened - ignore the first click
      isJustOpenedRef.current = true;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      // Skip if we just opened (this prevents immediate close)
      if (isJustOpenedRef.current) {
        isJustOpenedRef.current = false;
        return;
      }

      const target = event.target as Node;
      
      // Check if click is outside both trigger and dropdown
      const isOutsideTrigger = !triggerRef.current || !triggerRef.current.contains(target);
      const isOutsideDropdown = !dropdownRef.current || !dropdownRef.current.contains(target);
      
      if (isOutsideTrigger && isOutsideDropdown) {
        handler();
      }
    };

    // Add listener immediately but skip first click via flag
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [triggerRef, dropdownRef, handler, enabled]);
}

// ============================================================================
// Custom Hook: Dropdown Positioning
// ============================================================================

function useDropdownPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  dropdownRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  align: 'start' | 'center' | 'end',
  side: 'top' | 'right' | 'bottom' | 'left'
) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const dropdown = dropdownRef.current;
      const dropdownWidth = dropdown?.offsetWidth || 200;
      const dropdownHeight = dropdown?.offsetHeight || 200;

      let top = 0;
      let left = 0;

      // Calculate vertical position
      if (side === 'bottom') {
        top = rect.bottom + 4;
        if (top + dropdownHeight > window.innerHeight) {
          top = rect.top - dropdownHeight - 4;
        }
      } else if (side === 'top') {
        top = rect.top - dropdownHeight - 4;
        if (top < 0) {
          top = rect.bottom + 4;
        }
      } else if (side === 'left' || side === 'right') {
        top = rect.top;
      }

      // Calculate horizontal position
      if (side === 'left') {
        left = rect.left - dropdownWidth - 4;
      } else if (side === 'right') {
        left = rect.right + 4;
      } else {
        if (align === 'start') {
          left = rect.left;
        } else if (align === 'end') {
          left = rect.right - dropdownWidth;
        } else {
          left = rect.left + (rect.width - dropdownWidth) / 2;
        }
      }

      // Keep within viewport bounds
      left = Math.max(8, Math.min(left, window.innerWidth - dropdownWidth - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - dropdownHeight - 8));

      setPosition({ top, left });
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      updatePosition();
    });

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, triggerRef, dropdownRef, align, side]);

  return position;
}

// ============================================================================
// Confirmation Modal Component (Fully Custom)
// ============================================================================

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationModal({
  isOpen,
  title,
  description,
  actionLabel,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Focus the cancel button
    const firstButton = modalRef.current?.querySelector('button');
    firstButton?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[1000050] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative z-10 w-full max-w-md mx-4 bg-background border border-border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="p-6">
          <h3 id="confirm-title" className="text-lg font-semibold text-foreground">
            {title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================================
// Menu Item Component
// ============================================================================

interface MenuItemButtonProps {
  item: ActionMenuItem;
  isFocused: boolean;
  onSelect: () => void;
  onFocus: () => void;
}

function MenuItemButton({ item, isFocused, onSelect, onFocus }: MenuItemButtonProps) {
  const Icon = item.icon;
  
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={isFocused ? 0 : -1}
      disabled={item.disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!item.disabled) onSelect();
      }}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-sm rounded-md outline-none transition-colors',
        'focus:bg-accent focus:text-accent-foreground',
        isFocused && 'bg-accent text-accent-foreground',
        item.disabled && 'opacity-50 cursor-not-allowed',
        item.variant === 'destructive' 
          ? 'text-destructive focus:bg-destructive/10 focus:text-destructive hover:bg-destructive/10 hover:text-destructive' 
          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="flex-1 text-left">{item.label}</span>
      {item.shortcut && (
        <span className="ml-auto text-xs text-muted-foreground opacity-60">
          {item.shortcut}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Main ActionMenu Component (Fully Custom - No External Dependencies)
// ============================================================================

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  trigger = 'horizontal',
  triggerClassName,
  contentClassName,
  align = 'end',
  side = 'bottom',
  disabled = false,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: 'Confirm',
    onConfirm: () => {},
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const customTriggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Support controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  
  // Get the active trigger ref
  const activeTriggerRef = typeof trigger === 'string' ? triggerRef : customTriggerRef;

  const setIsOpen = useCallback((value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  }, [isControlled, onOpenChange]);

  // Flatten items for keyboard navigation
  const flattenedItems: ActionMenuItem[] = [];
  items.forEach(item => {
    if (isGroup(item)) {
      item.items.forEach(subItem => {
        if (isActionItem(subItem)) {
          flattenedItems.push(subItem);
        }
      });
    } else if (isActionItem(item)) {
      flattenedItems.push(item);
    }
  });

  // Close dropdown
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, [setIsOpen]);

  // Handle item selection
  const handleItemClick = useCallback((item: ActionMenuItem) => {
    if (item.disabled) return;

    if (item.requiresConfirmation) {
      setConfirmationState({
        isOpen: true,
        title: item.confirmationTitle || 'Are you sure?',
        description: item.confirmationDescription || 'This action cannot be undone.',
        actionLabel: item.confirmationActionLabel || 'Confirm',
        onConfirm: () => {
          item.onClick?.();
          setConfirmationState(prev => ({ ...prev, isOpen: false }));
        },
      });
      setIsOpen(false);
    } else {
      item.onClick?.();
      closeDropdown();
    }
  }, [closeDropdown, setIsOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!isOpen) {
      // Open on arrow down or enter/space when closed
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => (prev < flattenedItems.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : flattenedItems.length - 1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && flattenedItems[focusedIndex]) {
          handleItemClick(flattenedItems[focusedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeDropdown();
        break;
      case 'Tab':
        closeDropdown();
        break;
    }
  }, [isOpen, flattenedItems, focusedIndex, handleItemClick, closeDropdown, setIsOpen]);

  // Click outside detection
  useClickOutside(activeTriggerRef, dropdownRef, closeDropdown, isOpen);

  // Dropdown positioning
  const position = useDropdownPosition(activeTriggerRef, dropdownRef, isOpen, align, side);

  // Toggle dropdown - simplified click handler
  const handleTriggerClick = useCallback(() => {
    if (disabled) return;
    
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState) {
      setFocusedIndex(0);
    } else {
      setFocusedIndex(-1);
    }
  }, [disabled, isOpen, setIsOpen]);

  // Render trigger button for string triggers
  const renderTrigger = () => {
    if (typeof trigger === 'string') {
      const IconComponent = trigger === 'vertical' ? MoreVertical : MoreHorizontal;
      return (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleTriggerClick}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={cn(
            'inline-flex items-center justify-center rounded-md h-8 w-8 p-0 text-sm font-medium transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            triggerClassName
          )}
        >
          <IconComponent className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </button>
      );
    }

    // Custom trigger element
    return (
      <div
        ref={customTriggerRef}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          'cursor-pointer inline-flex',
          disabled && 'pointer-events-none opacity-50',
          triggerClassName
        )}
      >
        {trigger}
      </div>
    );
  };

  // Track flattened index for keyboard navigation
  let currentFlatIndex = -1;

  // Render menu items
  const renderItems = () => {
    return items.map((item, index) => {
      if (isSeparator(item)) {
        return (
          <div
            key={`separator-${index}`}
            className="my-1 h-px bg-border"
            role="separator"
          />
        );
      }

      if (isGroup(item)) {
        return (
          <div key={`group-${index}`} className="py-1">
            {index > 0 && <div className="my-1 h-px bg-border" role="separator" />}
            {item.label && (
              <div className="px-3 py-1.5 text-xs font-normal text-muted-foreground">
                {item.label}
              </div>
            )}
            {item.items.map((subItem, subIndex) => {
              if (isSeparator(subItem)) {
                return <div key={`group-${index}-sep-${subIndex}`} className="my-1 h-px bg-border" role="separator" />;
              }
              if (isActionItem(subItem)) {
                currentFlatIndex++;
                const flatIdx = currentFlatIndex;
                return (
                  <MenuItemButton
                    key={`group-${index}-item-${subIndex}`}
                    item={subItem}
                    isFocused={focusedIndex === flatIdx}
                    onSelect={() => handleItemClick(subItem)}
                    onFocus={() => setFocusedIndex(flatIdx)}
                  />
                );
              }
              return null;
            })}
          </div>
        );
      }

      if (isActionItem(item)) {
        currentFlatIndex++;
        const flatIdx = currentFlatIndex;
        return (
          <MenuItemButton
            key={`item-${index}`}
            item={item}
            isFocused={focusedIndex === flatIdx}
            onSelect={() => handleItemClick(item)}
            onFocus={() => setFocusedIndex(flatIdx)}
          />
        );
      }

      return null;
    });
  };

  return (
    <>
      {renderTrigger()}

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={handleKeyDown}
          className={cn(
            'fixed z-[1000040] min-w-[180px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            contentClassName
          )}
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {renderItems()}
        </div>,
        document.body
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        title={confirmationState.title}
        description={confirmationState.description}
        actionLabel={confirmationState.actionLabel}
        onConfirm={confirmationState.onConfirm}
        onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};

export default ActionMenu;
