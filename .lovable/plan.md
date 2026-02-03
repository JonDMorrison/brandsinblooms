

# Fix: "Send Now" Button Not Clicking

## Problem Identified

The "Send Now" dropdown button in the Campaign Action Bar is not responding to clicks. After analyzing the code, I found **the button IS functional** - it uses the `ScheduleSelector` component which is a Radix UI Popover that should open on click.

The likely issues are:

### Root Cause 1: Sticky Mode Hides the ScheduleSelector

In `CampaignActionBar.tsx` (lines 180-187):
```tsx
{/* Schedule Selector - visible when not sticky */}
{!isSticky && onScheduleChange && (
  <ScheduleSelector ... />
)}
```

When you scroll down, the action bar becomes "sticky" and the ScheduleSelector **disappears entirely**. This means if the user has scrolled, the button won't be visible at all.

### Root Cause 2: Nested Popover Conflict

Inside `ScheduleSelector.tsx`, there's a **nested Popover** situation:
- The main Popover (for the dropdown)
- A second Popover inside for the Calendar date picker (lines 164-184)

This can cause click propagation issues where the inner Popover's trigger interferes with the outer Popover's state management.

### Root Cause 3: Z-Index/Overlay Interference

The page has multiple overlays and modals that could be blocking clicks:
- The `CampaignSetupWizard` modal
- The `AIWriterDialog` 
- The `FullEmailPreview` component
- The `ScheduledCampaignBanner`

If any of these have backdrop or overlay elements that aren't properly cleaned up, they could be invisibly blocking clicks.

---

## Solution

### 1. Add Debug Logging to ScheduleSelector

Add console logs to verify the click is being registered:

**File: `src/components/crm/ScheduleSelector.tsx`**
```tsx
// Add to the component
useEffect(() => {
  console.log('ScheduleSelector: isOpen =', isOpen);
}, [isOpen]);

// In PopoverTrigger button
onClick={() => console.log('ScheduleSelector button clicked')}
```

### 2. Fix Nested Popover Architecture

Replace the nested Popover structure with a proper modal pattern for the date picker, or use `modal={false}` on the nested Popover to prevent focus trapping conflicts.

**File: `src/components/crm/ScheduleSelector.tsx`** - Update the Calendar Popover:
```tsx
<Popover modal={false}>
  <PopoverTrigger asChild>
    ...
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" side="bottom">
    <Calendar ... />
  </PopoverContent>
</Popover>
```

### 3. Ensure ScheduleSelector Remains Visible in Sticky Mode

Modify `CampaignActionBar.tsx` to show a simplified send button that also opens scheduling options when in sticky mode:

**File: `src/components/crm/CampaignActionBar.tsx`**
```tsx
{/* Schedule Selector - always visible, compact in sticky mode */}
{onScheduleChange && (
  <ScheduleSelector
    schedule={schedule}
    onScheduleChange={onScheduleChange}
    disabled={loading || sending}
    compact={isSticky} // New prop for compact mode
  />
)}
```

### 4. Add Click Safety CSS

Add CSS override to ensure the popover trigger is always clickable:

**File: `src/styles/overrides/component-overrides.css`**
```css
/* Ensure Schedule Selector is always clickable */
[data-radix-popper-content-wrapper] {
  pointer-events: auto !important;
}

button[aria-haspopup="dialog"] {
  pointer-events: auto !important;
  position: relative;
  z-index: 10;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/crm/ScheduleSelector.tsx` | Fix nested Popover with `modal={false}`, add debug logging |
| `src/components/crm/CampaignActionBar.tsx` | Show ScheduleSelector in sticky mode |
| `src/styles/overrides/component-overrides.css` | Add CSS for popover click safety |

---

## Testing Plan

After implementation:
1. Navigate to `/crm/campaigns/new`
2. Click the "Send Now" dropdown button
3. Verify the Popover opens showing "Send immediately" and "Schedule for later" options
4. Test clicking "Schedule for later" → verify calendar picker opens
5. Test in sticky mode (scroll down) → verify button still works
6. Test on mobile viewport → verify button text visibility

