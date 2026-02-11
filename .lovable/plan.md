

# Milestone 4 -- System Segment Activation Flow

## Goal
Replace the current "open form dialog" behavior of the + button with a direct, one-click creation that inserts the system segment into the database with `is_system_segment = true`, then refreshes the grid so the card flips from pending to active.

## Current State
- The + button on a pending system segment currently opens the segment creation dialog pre-filled with name/conditions. The user must then click "Create Segment" to save.
- The `saveSegment` function inserts into `crm_segments` but does not set `is_system_segment = true` for new rows.
- The `SystemSegmentsGrid` gets its data from `useSegmentResolution`, which is independent of the `loadSegments` call in `CRMSegments.tsx`.

## Implementation Steps

### Step 1 -- Create `activateSystemSegment` function in `CRMSegments.tsx`

Add a new async function that:

1. Fetches the user's `tenant_id`
2. Checks for an existing segment with the same name (case-insensitive) and `tenant_id` to enforce idempotency -- if found, shows an info toast and returns early
3. Inserts a new row with `is_system_segment: true`, the definition's name, description, and conditions
4. Shows a success toast
5. Calls `loadSegments()` to refresh the table

```text
activateSystemSegment(segment: ResolvedSegment, definition: SegmentDefinition)
  -> check existing by name (ilike match) + tenant_id
  -> if exists: toast "Already active" and return
  -> insert { name, description, conditions, is_system_segment: true, tenant_id, user_id }
  -> toast success
  -> loadSegments()
```

### Step 2 -- Update `onAdd` callback in `SystemSegmentsGrid`

Replace the current `onAdd` handler (which opens the form dialog) with a call to `activateSystemSegment`. No dialog is opened -- the segment is created directly on click.

Before (current):
```ts
onAdd={(seg, def) => {
  setFormData({ ... });
  setShowSegmentForm(true);
}}
```

After:
```ts
onAdd={(seg, def) => {
  activateSystemSegment(seg, def);
}}
```

### Step 3 -- Trigger `SystemSegmentsGrid` refresh after activation

The grid uses `useSegmentResolution` which has its own `refresh` function. To ensure the grid updates after activation:

- Lift the resolution hook's `refresh` into `CRMSegments.tsx` by either:
  - (a) Passing a `refreshKey` prop to `SystemSegmentsGrid` (a counter that increments after each activation), or
  - (b) Adding a ref-based `refresh` callback exposed from `SystemSegmentsGrid` via `forwardRef`/`useImperativeHandle`

Option (a) is simpler: add a `refreshKey: number` state to `CRMSegments.tsx`, increment it in `activateSystemSegment`, and pass it to `SystemSegmentsGrid` which passes it as a dependency to `useSegmentResolution`'s `useEffect`.

### Step 4 -- Add `refreshKey` support to `useSegmentResolution`

Add an optional `refreshKey` parameter so external code can trigger a re-fetch:

```ts
useSegmentResolution(refreshKey?: number)
  -> include refreshKey in useEffect dependency array
```

### Step 5 -- Add loading state to + button

While `activateSystemSegment` is running, disable the + button to prevent double-clicks. Use a `activatingId` state (`string | null`) in `CRMSegments.tsx` and pass it through to the grid/card.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/crm/CRMSegments.tsx` | Add `activateSystemSegment` function; replace `onAdd` handler; add `refreshKey` and `activatingId` state |
| `src/hooks/useSegmentResolution.ts` | Accept optional `refreshKey` in dependency array |
| `src/components/crm/segments/SystemSegmentsGrid.tsx` | Accept `refreshKey` and `activatingId` props; pass to hook and cards |
| `src/components/crm/segments/SystemSegmentCard.tsx` | Accept `isActivating` prop to show loading/disabled state on + button |

## Idempotency Guarantee
- Application-level: check for existing segment by `name` (case-insensitive) + `tenant_id` before insert
- Database-level: the `guard_system_segments` trigger from Milestone 1 prevents duplicate system names from being modified/deleted but does not block inserts -- the app-level check handles that

