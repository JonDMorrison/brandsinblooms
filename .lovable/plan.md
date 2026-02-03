

# Fix: "Schedule" Button and Modal Improvements

## Summary

The current "Send Now" dropdown button will be renamed to **"Schedule"** and the dropdown content will be improved with clearer instructions and a properly clickable calendar.

---

## Changes

### 1. Rename Button from "Send Now" to "Schedule"

Since there's already a primary "Send" button in the action bar, the dropdown button will be renamed to **"Schedule"** to clearly indicate its purpose.

**Current button label logic:**
- "Send Now" → Will become **"Schedule"**  
- "Scheduled: Mar 5, 10:00 AM" → Stays the same (shows scheduled time)

### 2. Add Instructional Text

The dropdown will include a brief explanation at the top to help users understand what they can do:

> **"Choose when to send your campaign"**  
> Send immediately or pick a date and time to deliver your message at the perfect moment.

### 3. Ensure Calendar is Fully Clickable

The Calendar component will be updated to ensure:
- Explicit `pointer-events-auto` class is applied
- The calendar wrapper has proper styling for interactivity
- Date selection triggers the scheduling flow correctly

---

## Visual Preview (Before → After)

| Element | Before | After |
|---------|--------|-------|
| Button Label | "Send Now" | "Schedule" |
| Button Icon | Send icon | Calendar icon |
| Dropdown Header | "When to send" | "Choose when to send your campaign" + explanation |
| Calendar | Plain calendar | Calendar with clear visual feedback |

---

## File Changes

### File: `src/components/crm/ScheduleSelector.tsx`

1. **Update `getButtonLabel()` function** to return "Schedule" instead of "Send Now" for the default state

2. **Change the trigger button icon** to always use a Calendar icon (instead of Send icon)

3. **Add instructional header** at the top of the dropdown content with:
   - Clear heading: "Choose when to send your campaign"
   - Helper text explaining the two options

4. **Simplify the dropdown structure** by removing the "Send immediately" button (since that's handled by the main Send button) and focusing solely on scheduling

5. **Update Calendar wrapper** with explicit interactivity classes:
   - Add `pointer-events-auto` 
   - Add cursor styling for better UX

---

## Updated Dropdown Content Structure

```text
┌─────────────────────────────────────────┐
│  📅 Schedule Campaign                   │
│                                         │
│  Pick a date and time to send your      │
│  campaign automatically.                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     < February 2026 >           │    │
│  │  Su Mo Tu We Th Fr Sa           │    │
│  │                    1            │    │
│  │   2  3  4 [5] 6  7  8           │    │
│  │   9 10 11 12 13 14 15           │    │
│  │  ...                            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  📅 Feb 5          ⏰ [10:00]           │
│                                         │
│  [Pacific (PT)          ▼]              │
│  Times shown in Pacific (PT).           │
│                                         │
│  [      Schedule Campaign      ]        │
└─────────────────────────────────────────┘
```

---

## Technical Details

### Key Code Changes in `ScheduleSelector.tsx`

**1. Update button label (line 122-131):**
```tsx
const getButtonLabel = () => {
  if (schedule.type === 'scheduled' && schedule.date) {
    const displayDate = toZonedTime(schedule.date, schedule.timezone || userTimezone);
    return `Scheduled: ${format(displayDate, 'MMM d, h:mm a')}`;
  }
  return 'Schedule';
};
```

**2. Update trigger button icon to always use Calendar:**
```tsx
<CalendarIcon className="h-4 w-4" />
```

**3. Add instructional header to dropdown content:**
```tsx
<div className="space-y-1 mb-4">
  <h3 className="font-semibold text-sm flex items-center gap-2">
    <CalendarIcon className="h-4 w-4" />
    Schedule Campaign
  </h3>
  <p className="text-xs text-muted-foreground">
    Pick a date and time to send your campaign automatically.
  </p>
</div>
```

**4. Remove "Send immediately" button** (the main Send button handles this)

**5. Ensure Calendar has pointer-events:**
```tsx
<div className="rounded-md border border-border p-2 pointer-events-auto">
  <Calendar
    mode="single"
    selected={selectedDate}
    onSelect={handleDateSelect}
    disabled={isDateInPast}
    initialFocus
    className="pointer-events-auto"
  />
</div>
```

---

## Testing Checklist

After implementation, verify:

1. ✅ Button shows "Schedule" label with calendar icon
2. ✅ When a date is scheduled, button shows "Scheduled: Mar 5, 10:00 AM"
3. ✅ Clicking the button opens the dropdown
4. ✅ Calendar days are clickable and highlight on selection
5. ✅ Selecting a date updates the displayed date below the calendar
6. ✅ Time picker works correctly
7. ✅ Timezone selector functions properly
8. ✅ "Schedule Campaign" button saves the schedule
9. ✅ Primary "Send" button still works for immediate sending
10. ✅ Works correctly in both normal and sticky mode

