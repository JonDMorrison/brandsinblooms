

# Milestone 3 -- Top Segments UI States (Discovery Layer)

## Goal
Add a visual "System Segments" area to the `/crm/segments` page that uses the resolution engine from Milestone 2. Each system segment shows one of two states: **Active** (exists in DB) or **Available** (not yet created, with a + button). No auto-creation; the UI is read-only until the user clicks +.

## Current State
- `CRMSegments.tsx` has no system segments area -- it only renders a table of DB segments and a "Garden Center Templates" section.
- `CustomerSegmentsSection.tsx` (used on the CRM dashboard) renders hardcoded `predefinedSegments` but does not use the resolution engine and has no concept of "not yet created."
- The resolution engine (`useSegmentResolution`) is ready and returns `systemSegments` (active), `pendingSystemSegments` (not yet created), and `userSegments`.

## Implementation Steps

### Step 1 -- Create `SystemSegmentCard` Component

New file: `src/components/crm/segments/SystemSegmentCard.tsx`

A card component that renders differently based on segment state:

**Active state** (`state === 'system'`):
- Shows icon, name (plain text, not editable), description
- Shows customer count
- "View Details" and "Create Campaign" buttons (same as current `SegmentOverviewCard`)
- A subtle "System" badge

**Pending state** (`state === 'system_pending'`):
- Shows icon, name, description in a muted/dashed style
- No customer count (segment does not exist yet)
- A prominent **+ Add Segment** button
- Text like "Available -- click to add"

Props:
```text
segment: ResolvedSegment
icon: string (from SYSTEM_SEGMENTS config)
onAdd: () => void        // called when + is clicked on pending
onViewDetails: () => void
onCreateCampaign: () => void
```

### Step 2 -- Create `SystemSegmentsGrid` Component

New file: `src/components/crm/segments/SystemSegmentsGrid.tsx`

This component:
1. Calls `useSegmentResolution()` to get resolved segments
2. Maps `SYSTEM_SEGMENTS` definitions to their resolved state
3. Renders a grid of `SystemSegmentCard` components
4. Shows active segments first, then pending ones
5. The "onAdd" handler for pending segments opens the existing segment creation dialog, pre-filled with the system segment's name, description, and conditions from `segmentDefinitions.ts` -- but does NOT auto-save

### Step 3 -- Integrate into `CRMSegments.tsx`

Insert the `SystemSegmentsGrid` between the page header and the "Your Segments" table. This becomes the "Top Segments" discovery area.

Changes to `CRMSegments.tsx`:
- Import and render `<SystemSegmentsGrid />` above the existing segments table
- Pass callbacks for `onAdd` (pre-fill the create form and open dialog), `onViewDetails`, and `onCreateCampaign`
- The existing table below continues showing all DB segments (both system and user)

### Step 4 -- Lock Name Field for System Segments in Edit Dialog

In the existing segment form dialog within `CRMSegments.tsx`:
- When `editingSegment?.is_system_segment === true`, render the name as a read-only `<div>` or disabled `<Input>` instead of an editable field
- Remove any rename affordance for system segments
- All other fields (description, conditions, auto-update) remain editable

### Step 5 -- Hide Edit/Delete Actions for System Segments in Table

In the segments table (lines 836-854 of `CRMSegments.tsx`):
- For rows where `segment.is_system_segment === true`:
  - Hide the delete (trash) button entirely
  - The edit button opens details but the name field will be locked (Step 4)
  - Show a "System" badge in the Type column instead of "Custom"

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/crm/segments/SystemSegmentCard.tsx` | **New** -- Card with active/pending states |
| `src/components/crm/segments/SystemSegmentsGrid.tsx` | **New** -- Grid using resolution engine |
| `src/pages/crm/CRMSegments.tsx` | Add grid above table; lock name in edit dialog; hide delete for system rows |

## What This Milestone Does NOT Do
- Does not auto-create segments on page load
- Does not modify campaign logic
- Does not add permissions or roles
- Does not change the CRM dashboard `CustomerSegmentsSection` (that can be updated separately)
