

# Milestone 6 -- Final Validation, Edge Cases, and UX Polish

## Goal
Harden the system segment implementation against edge cases (duplicate names, case mismatches, deleted segment recovery) and add UX polish (tooltips, helper text, clearer indicators).

## Current State Assessment

After reviewing the full codebase, here is what already works well and what needs fixing:

**Working correctly:**
- Name locking in edit dialog (Shield icon + "System" badge)
- Delete button hidden for system segments in table
- ConditionBuilder disabled for system segments (opacity + pointer-events-none + "Read-only" badge)
- Confirmation dialog for deletion
- System badge in table Type column
- Resolution engine handles case-insensitive matching via `normalizeName()`
- Idempotency check in `activateSystemSegment` uses `.ilike()` for case-insensitive matching

**Issues to fix:**

### 1. Duplicate Warning -- No UI surface for duplicates
The resolution engine detects duplicates (`duplicateWarnings`) but neither `SystemSegmentsGrid` nor `CRMSegments` display them. If a user manually created "loyalty members" before activating the system segment, there is no warning shown.

### 2. User-created segment with system name -- Confusing state
If a user manually created a segment called "High-Value Customers" (without `is_system_segment = true`), the resolution engine resolves it as `state: 'user'` (not `system`). The grid card shows it as active but without the "System" badge, and the + button does not appear. However, clicking + in the activation flow would correctly detect the duplicate via `.ilike()` and show "Already Active." This is safe but the card state is confusing -- it appears active but is technically a user segment.

### 3. Deleted system segment recovery
When a system segment is deleted, it correctly reverts to `system_pending` in the grid (the + button reappears). However, there is no toast or visual feedback explaining that the segment can be re-activated. The delete confirmation dialog mentions "will require re-activation" which is good.

### 4. Missing tooltips / helper text
- No tooltip explaining what "System Segments" means in the grid header
- No tooltip on the "System" badge in the table or cards
- The "Available -- click to add" text on pending cards is good but could mention it is a predefined segment

### 5. SystemSegmentsGrid header has no context
The "System Segments" heading has no subtitle or info icon explaining what system segments are.

### 6. SegmentDetailsModal -- system segment passed but not always detected
The `isSystemSegment` prop must be explicitly passed from `CRMSegments.tsx` when opening the modal, but the current `onViewDetails` callback in `SystemSegmentsGrid` calls `openEditSegment()` which opens the edit dialog, not the details modal. The details modal may not receive the `isSystemSegment` prop correctly in all paths.

## Implementation Steps

### Step 1 -- Surface duplicate warnings as a toast

In `SystemSegmentsGrid`, read `duplicateWarnings` from the resolution hook. When duplicates are detected, show an info toast on mount (once per session) warning the user. Also pass duplicate info to the card so a subtle warning icon can appear.

Changes:
- `SystemSegmentsGrid.tsx`: Extract `duplicateWarnings` from the hook; show a toast via a `useEffect` if any exist; pass a `hasDuplicate` prop to `SystemSegmentCard`
- `SystemSegmentCard.tsx`: When `hasDuplicate` is true, show a small warning icon with a tooltip: "Multiple segments share this name. Consider consolidating them."

### Step 2 -- Add helper text and tooltip to System Segments grid header

In `SystemSegmentsGrid.tsx`:
- Add a `ConceptTooltip` or inline `Info` icon next to the "System Segments" heading
- Add a subtitle: "Predefined segments that are automatically maintained. Click + to activate."

### Step 3 -- Add tooltip to "System" badge everywhere

In `SystemSegmentCard.tsx` (active state badge) and `CRMSegments.tsx` (table Type column):
- Wrap the "System" badge in a `Tooltip` explaining: "System segments are predefined and their names cannot be changed."

### Step 4 -- Handle user-created segment with system name gracefully

In `SystemSegmentCard.tsx`:
- When `segment.state === 'user'` (name matches a system definition but `is_system_segment` is false), show a subtle info indicator and tooltip: "This segment was created manually. Activate it as a system segment to enable protection."
- Optionally show a small "Upgrade to System" button that calls `activateSystemSegment` with an update instead of insert (sets `is_system_segment = true` on the existing row)

In `activateSystemSegment` in `CRMSegments.tsx`:
- When the idempotency check finds an existing segment, check if `is_system_segment` is false
- If so, offer to upgrade it (update `is_system_segment = true`) instead of just showing "Already Active"

### Step 5 -- Improve error messages

In `activateSystemSegment`:
- Replace generic "Failed to activate segment" with more specific messages based on error type
- Add a catch for unique constraint violations with a friendly message

In the delete confirmation dialog:
- Add a note below the description for system segments: "You can re-activate this segment anytime from the System Segments area above."

### Step 6 -- Add "System" indicator to the assigned customers list in SegmentDetailsModal

Ensure the `isSystemSegment` prop is correctly passed when opening the details modal from both the table edit button and the grid "View Details" button. Currently `onViewDetails` in the grid calls `openEditSegment()` which opens the edit dialog -- it should instead open the details modal for a better read-only experience.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/crm/segments/SystemSegmentsGrid.tsx` | Add subtitle, info tooltip, duplicate warning toast, pass `hasDuplicate` to cards |
| `src/components/crm/segments/SystemSegmentCard.tsx` | Add duplicate warning icon, tooltip on System badge, handle `state === 'user'` gracefully |
| `src/pages/crm/CRMSegments.tsx` | Upgrade-to-system logic in `activateSystemSegment`; tooltip on System badge in table; improved error messages; extra note in delete dialog; fix `onViewDetails` to open details modal |
| `src/components/crm/segments/SegmentDetailsModal.tsx` | No changes needed (already has system segment banner) |

## What This Milestone Does NOT Do
- Does not add audit logging
- Does not add role-based permissions
- Does not modify database triggers or RLS
- Does not change the segment resolution engine logic (it already handles all edge cases correctly)

