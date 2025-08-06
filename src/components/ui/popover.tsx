
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
// TODO: re-enable portal + inert once root cause is isolated  
// import { lockBackground, unlockBackground, getOverlayRoot } from "@/lib/overlay-utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  return (
    // TODO: re-enable portal + inert once root cause is isolated
    // <PopoverPrimitive.Portal container={getOverlayRoot()}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "absolute z-[2147483647] w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-lg outline-red-500 outline-2 outline data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 pointer-events-auto",
        className
      )}
      // TODO: re-enable portal + inert once root cause is isolated
      // onOpenAutoFocus={() => {
      //   lockBackground();
      //   console.log('[Popover] Background locked');
      // }}
      // onCloseAutoFocus={() => {
      //   unlockBackground();
      //   console.log('[Popover] Background unlocked');
      // }}
      {...props}
    />
    // </PopoverPrimitive.Portal>
  );
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
