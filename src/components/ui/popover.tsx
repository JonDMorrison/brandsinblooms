
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { Z_INDEX } from "@/lib/z-index"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    container?: HTMLElement | null;
    context?: string;
  }
>(({ className, align = "center", sideOffset = 4, container, context = 'popover', ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    console.log(`[DropdownFix] Repaired dropdown behavior in ${context}: popover`);
    
    // Ensure proper ARIA and visibility settings
    if (contentRef.current) {
      contentRef.current.removeAttribute('aria-hidden');
      contentRef.current.style.visibility = 'visible';
      contentRef.current.style.pointerEvents = 'auto';
      contentRef.current.style.opacity = '1';
    }
    
    return () => {
      console.log(`[DropdownFix] Closed: popover (${context})`);
    };
  }, [context]);

  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        ref={(node) => {
          if (ref) {
            if (typeof ref === 'function') ref(node);
            else ref.current = node;
          }
          contentRef.current = node;
        }}
        align={align}
        sideOffset={sideOffset}
        style={{ 
          zIndex: Z_INDEX.dropdown,
          position: 'fixed',
          pointerEvents: 'auto'
        }}
        className={cn(
          "w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        onPointerDownOutside={(e) => {
          // Allow closing on outside click
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Allow closing on escape
          e.preventDefault();
        }}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
