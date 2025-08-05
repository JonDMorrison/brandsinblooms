
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { Z } from "@/lib/zLayer"
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock"
import { scrollLockManager, dropdownLogger } from "@/lib/dropdown-utils"
import '@/styles/dropdown-visibility.css'

const Select = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> & {
    debugMode?: boolean;
  }
>(({ debugMode = false, onOpenChange, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Enable body scroll lock when dropdown is open
  useBodyScrollLock({ enabled: isOpen, id: 'select-dropdown' });

  const handleOpenChange = React.useCallback((open: boolean) => {
    console.debug('[SelectDebug] State change:', { 
      open, 
      debugMode,
      timestamp: Date.now() 
    });
    
    setIsOpen(open);
    
    if (open) {
      dropdownLogger.logOpen('select', 'trigger-click');
      scrollLockManager.lock('select');
    } else {
      dropdownLogger.logClose('select', 'selection-made');
      scrollLockManager.unlock('select');
    }
    
    onOpenChange?.(open);
  }, [onOpenChange, debugMode]);

  React.useEffect(() => {
    if (debugMode) {
      document.body.classList.add('dropdown-debug-mode');
      return () => document.body.classList.remove('dropdown-debug-mode');
    }
  }, [debugMode]);

  return (
    <div ref={ref}>
      <SelectPrimitive.Root
        onOpenChange={handleOpenChange}
        {...props}
      />
    </div>
  );
})
Select.displayName = "Select"

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    container?: HTMLElement | null;
    context?: string;
    debugMode?: boolean;
  }
>(({ className, children, position = "popper", container, context = 'select', debugMode = false, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [hiddenAncestor, setHiddenAncestor] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    console.debug('[SelectDebug] Content mounting:', { 
      context,
      debugMode,
      position,
      container: container ? 'custom' : 'body' 
    });
    
    // Fix aria-hidden focus trap
    const triggerElement = document.querySelector('[data-radix-select-trigger]') as HTMLElement;
    if (triggerElement) {
      const hiddenElement = triggerElement.closest('[aria-hidden="true"]') as HTMLElement;
      if (hiddenElement) {
        console.debug('[SelectDebug] Found aria-hidden ancestor, temporarily removing');
        setHiddenAncestor(hiddenElement);
        hiddenElement.removeAttribute('aria-hidden');
      }
    }
    
    // Enhanced visibility and positioning fixes
    if (contentRef.current) {
      const element = contentRef.current;
      
      // Log bounding rect and computed styles
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      
      console.table({
        'Bounding Rect': {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        },
        'Computed Styles': {
          position: styles.position,
          zIndex: styles.zIndex,
          visibility: styles.visibility,
          opacity: styles.opacity,
          display: styles.display,
          pointerEvents: styles.pointerEvents
        }
      });
      
      // Apply CSS classes instead of inline styles
      element.classList.add('dropdown-force-visible', 'dropdown-content-enhanced');
      
      if (debugMode) {
        element.classList.add('dropdown-debug-outline');
      }
      
      // Set z-index using the new Z constants
      element.style.zIndex = Z.dropdown.toString();
      
      console.log(`[SelectDropdown] Enhanced visibility applied via CSS classes`, {
        zIndex: element.style.zIndex,
        classes: element.className,
        debugMode
      });
    }
    
    return () => {
      console.debug('[SelectDebug] Content unmounting:', { context });
      
      // Restore aria-hidden if it was removed
      if (hiddenAncestor) {
        hiddenAncestor.setAttribute('aria-hidden', 'true');
        setHiddenAncestor(null);
      }
    };
  }, [context, debugMode]);

  return (
    <SelectPrimitive.Portal 
      container={container || (typeof document !== 'undefined' ? document.body : undefined)}
    >
      <SelectPrimitive.Content
        ref={(node) => {
          if (ref) {
            if (typeof ref === 'function') ref(node);
            else ref.current = node;
          }
          contentRef.current = node;
        }}
        style={{ 
          zIndex: Z.dropdown,
          position: 'fixed'
        }}
        className={cn(
          "relative max-h-96 min-w-[8rem] overflow-hidden rounded-md border shadow-lg",
          "animate-in fade-in-0 zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        sideOffset={6}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
      "dropdown-item-enhanced",
      className
    )}
    onClick={(e) => {
      console.debug(`[SelectDebug] Item clicked:`, { 
        value: props.value,
        children,
        timestamp: Date.now() 
      });
      
      // Prevent event bubbling issues
      e.stopPropagation();
      
      if (props.onClick) props.onClick(e);
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        console.debug(`[SelectDebug] Item selected via keyboard:`, { 
          value: props.value,
          children,
          key: e.key 
        });
      }
      if (props.onKeyDown) props.onKeyDown(e);
    }}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
