
# Milestone 5 -- Permissions, Editing, and Campaign Integration

## Goal
Enforce strict permission rules for system segments (no rename, confirmation-gated deletion) and wire the "Create Campaign" button to navigate to the campaign creator with the segment pre-selected and locked.

## Current State
- **Name locking**: Already partially implemented -- the edit dialog shows a read-only name field when `is_system_segment` is true (line 664-677 of CRMSegments.tsx). The `saveSegment` function also skips name updates for system segments (line 408-410).
- **Deletion**: The table hides the trash icon for system segments (line 931), but the `deleteSegment` function only shows a toast and returns early -- there is no confirmation dialog for non-system segments either.
- **Campaign integration**: The "Create Campaign" button on `SystemSegmentCard` currently shows a "coming soon" toast (line 831-836). The campaign creator (`CRMCampaignCreator.tsx`) already supports loading a segment from URL via `?segment=<id>` and pre-selecting it, but there is no mechanism to **lock** the segment selection after pre-selection.
- **SegmentDetailsModal**: Does not have any system-segment-aware restrictions -- it shows full customer management UI regardless.

## Implementation Steps

### Step 1 -- Wire "Create Campaign" to Navigate with Segment ID

In `CRMSegments.tsx`, replace the placeholder toast in the `onCreateCampaign` callback of `SystemSegmentsGrid` with a `navigate()` call:

```ts
onCreateCampaign={(seg) => {
  if (seg.id) {
    navigate(`/crm/campaigns/new?segment=${seg.id}&locked=true`);
  }
}}
```

The `locked=true` query param signals the campaign creator to prevent changing the segment.

Also add the same pattern in `SystemSegmentCard` and `SegmentCard` -- both already navigate but `SystemSegmentCard` needs the actual wiring.

### Step 2 -- Lock Segment Selection in Campaign Creator

In `CRMCampaignCreator.tsx`:

1. Read `locked` from `searchParams`: `const isSegmentLocked = searchParams.get('locked') === 'true'`
2. Pass `isSegmentLocked` down to the audience selection UI
3. When locked:
   - Show a `Shield` icon and "Locked" badge next to the selected segment
   - Disable the "Change Audience" / segment removal controls
   - Show a subtle info text: "Segment was pre-selected and cannot be changed for this campaign"

In `AudienceSelector.tsx`:
- Add an optional `lockedSegmentIds?: string[]` prop
- When a segment ID is in `lockedSegmentIds`, hide its remove (X) button and disable toggling it off
- Optionally show a lock icon on the chip

### Step 3 -- Add Confirmation Dialog for System Segment Deletion

Even though the trash icon is hidden in the table, system segments can still be opened via the edit dialog. Add a safety net:

In `CRMSegments.tsx`, update `deleteSegment` to:
1. For system segments: show a `ConfirmationDialog` (already exists in `src/components/ui/confirmation-dialog.tsx`) with a strong warning: "This is a system segment. Removing it will require re-activation. Are you sure?"
2. For non-system segments: show a simpler confirmation dialog before deleting

Add state: `const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null)`

The confirmation dialog renders at the bottom of the component and calls the actual delete logic on confirm.

### Step 4 -- Restrict SegmentDetailsModal for System Segments

In `SegmentDetailsModal.tsx`:
- Accept an optional `isSystemSegment?: boolean` prop (or derive from segment data)
- When true:
  - Hide the "Available Customers" column (manual add/remove is not appropriate for rule-based system segments)
  - Hide the "Import" button
  - Show an info banner: "This is a system segment. Membership is managed automatically based on segment rules."
  - Keep the "Send SMS" and "Close" buttons functional

### Step 5 -- Lock Condition Builder for System Segments (Read-Only Mode)

In the edit dialog within `CRMSegments.tsx`:
- When `editingSegment?.is_system_segment`, render the `ConditionBuilder` in a read-only/disabled state
- Add a `disabled?: boolean` prop to `ConditionBuilder` that prevents adding, editing, or removing conditions
- Show the existing conditions as view-only badges/pills

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/crm/CRMSegments.tsx` | Wire campaign navigation; add confirmation dialog for delete; disable ConditionBuilder for system segments |
| `src/components/crm/CRMCampaignCreator.tsx` | Read `locked` param; pass `lockedSegmentIds` to AudienceSelector |
| `src/components/crm/AudienceSelector.tsx` | Add `lockedSegmentIds` prop; prevent removal of locked segments |
| `src/components/crm/segments/SegmentDetailsModal.tsx` | Add system segment restrictions (hide manual management, show info banner) |
| `src/components/crm/segments/ConditionBuilder.tsx` | Add `disabled` prop for read-only mode |
| `src/components/crm/segments/SystemSegmentCard.tsx` | No changes needed (already has correct buttons) |

## What This Milestone Does NOT Do
- Does not add role-based permissions (admin vs user) -- that is a separate concern
- Does not modify database triggers or RLS policies
- Does not change the segment resolution engine
- Does not add audit logging for permission-gated actions
