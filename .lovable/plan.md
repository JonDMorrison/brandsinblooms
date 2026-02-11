

# Milestone 2 -- Segment Existence and Ownership Resolution Logic

## Goal
Create a reliable segment resolution engine that, when loading segments, classifies each one into a clear ownership state: **System Segment**, **User-Created Segment**, or **System Segment Not Yet Created**. This becomes the single source of truth for all segment-related UI and logic.

## Current State
- **`useCRMSegments`** fetches all segments from `crm_segments` but does not distinguish system from user-created.
- **`CRMSegmentsPage`** has a hardcoded `predefinedSegments` array (7 items) that is never cross-referenced against the database.
- **`useAllSegments`** naively concatenates the hardcoded list with DB segments, risking duplicates.
- **`useSegmentCounts`** hardcodes segment IDs and calculates counts independently.
- **`segmentDefinitions.ts`** defines `SYSTEM_SEGMENTS` with names and conditions but this config is not used for resolution.
- The `is_system_segment` column was added in Milestone 1 but no code uses it for classification yet.

## Resolution States

Each segment resolves to one of three states:

| State | Meaning |
|-------|---------|
| `system` | Exists in DB with `is_system_segment = true` |
| `user` | Exists in DB with `is_system_segment = false` |
| `system_pending` | Defined in `SYSTEM_SEGMENTS` config but no matching DB row for this tenant |

## Implementation Steps

### Step 1 -- Create `useSegmentResolution` Hook

New file: `src/hooks/useSegmentResolution.ts`

This hook is the core resolution engine. It:

1. Fetches all `crm_segments` rows for the current tenant (including `is_system_segment`).
2. Compares against `SYSTEM_SEGMENTS` from `segmentDefinitions.ts` using **case-insensitive, trimmed name matching**.
3. Classifies each segment into one of the three states.
4. Detects and flags duplicate system segments (same name, case-insensitive, within one tenant).
5. Returns a structured result with typed arrays for each state.

```text
Interface:

ResolvedSegment {
  id: string | null           // DB id (null if pending)
  definition_id: string       // Config id (e.g. 'perks-members')
  name: string                // Canonical name
  description: string
  state: 'system' | 'user' | 'system_pending'
  is_system_segment: boolean
  customer_count: number
  db_record: DbSegment | null // Full DB row if exists
  duplicates?: string[]       // IDs of duplicate rows
}

Return {
  resolved: ResolvedSegment[]
  systemSegments: ResolvedSegment[]
  userSegments: ResolvedSegment[]
  pendingSystemSegments: ResolvedSegment[]
  duplicateWarnings: { name: string; count: number; ids: string[] }[]
  loading: boolean
  refresh: () => void
}
```

**Name normalization function** (shared utility):
```ts
const normalizeName = (name: string): string =>
  name.trim().toLowerCase();
```

**Resolution algorithm**:
1. Fetch all tenant segments from DB.
2. For each `SYSTEM_SEGMENTS` definition, find DB rows where `normalizeName(db.name) === normalizeName(definition.name)`.
3. If found with `is_system_segment = true` -> state `system`.
4. If found with `is_system_segment = false` -> still state `user` (name collision but not flagged as system).
5. If not found -> state `system_pending`.
6. If multiple rows match the same system name -> record as duplicate warning.
7. All remaining DB rows not matching any system definition -> state `user`.

### Step 2 -- Create `resolveSegmentState` Utility

New file: `src/utils/segmentResolution.ts`

Pure function (no hooks) that performs the resolution logic. The hook wraps this for React usage, but the utility can be used in edge functions or non-React contexts.

```ts
export function resolveSegments(
  dbSegments: DbSegment[],
  systemDefinitions: SegmentDefinition[]
): SegmentResolutionResult
```

This keeps the logic testable and reusable.

### Step 3 -- Add `is_system_segment` to `useCRMSegments` Return Type

Update the `CRMSegment` interface in `src/hooks/useCRMSegments.ts` to include `is_system_segment?: boolean` so the field is available downstream. The `fetchSegments` query already uses `select('*')`, so the data is present -- it just needs typing.

### Step 4 -- Update `useAllSegments` to Use Resolution

Replace the naive concatenation in `src/hooks/useAllSegments.ts` with `useSegmentResolution`. Instead of blindly merging hardcoded + DB segments, it returns the resolved list which guarantees no duplicates and clear ownership.

### Step 5 -- Add Duplicate Detection Guard to `createSegment`

In `src/hooks/useCRMSegments.ts`, before inserting a new segment, check if the name (case-insensitive) matches any `SYSTEM_SEGMENT_NAMES`. If it does, reject the creation with a toast: "This name is reserved for a system segment."

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/segmentResolution.ts` | **New** -- Pure resolution function |
| `src/hooks/useSegmentResolution.ts` | **New** -- React hook wrapping resolution |
| `src/hooks/useCRMSegments.ts` | Add `is_system_segment` to interface; add name guard on create |
| `src/hooks/useAllSegments.ts` | Refactor to use `useSegmentResolution` |

## What This Milestone Does NOT Do
- No UI changes (no badges, no state indicators)
- No auto-creation of missing system segments
- No campaign logic changes
- No changes to `CRMSegmentsPage` rendering (that is a later milestone)

