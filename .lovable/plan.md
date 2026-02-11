

# Milestone 1 -- Define System Segments Concept and Guardrails

## Goal
Introduce a database-level `is_system_segment` flag on `crm_segments` and enforce guardrails that prevent users from renaming or deleting system segments. No UI changes.

## Current State
- **Frontend config** (`src/config/segmentDefinitions.ts`) defines system segments with `is_system: true`, but this is purely a frontend concept with no database backing.
- **Database** (`crm_segments` table) has no `is_system_segment` column. There are duplicate rows (e.g., multiple "Loyalty Members", "Perks Program") with no distinction from user-created segments.
- **Existing code** freely allows updates and deletes on any segment row.

## Implementation Steps

### Step 1 -- Add `is_system_segment` Column
Run a migration to add the column with a default of `false`:

```sql
ALTER TABLE crm_segments
  ADD COLUMN is_system_segment BOOLEAN NOT NULL DEFAULT false;
```

### Step 2 -- Mark Existing System Segments
Update existing rows that match known system segment names to set the flag:

```sql
UPDATE crm_segments
SET is_system_segment = true
WHERE name IN (
  'Perks Program',
  'Loyalty Members',
  'High-Value Customers',
  'New Customers',
  'Lapsed Customers',
  'Seasonal Shoppers',
  'Frequent Buyers'
);
```

### Step 3 -- Database Trigger to Prevent Name/Delete Changes
Create a trigger function that blocks `UPDATE` on `name` and `DELETE` when `is_system_segment = true`:

```sql
CREATE OR REPLACE FUNCTION prevent_system_segment_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system_segment = true THEN
      RAISE EXCEPTION 'System segments cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system_segment = true THEN
      IF NEW.name IS DISTINCT FROM OLD.name THEN
        RAISE EXCEPTION 'System segment names cannot be changed';
      END IF;
      IF NEW.is_system_segment IS DISTINCT FROM OLD.is_system_segment THEN
        RAISE EXCEPTION 'System segment flag cannot be changed';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_system_segments
  BEFORE UPDATE OR DELETE ON crm_segments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_segment_modification();
```

This allows updating other fields on system segments (e.g., `customer_count`, `conditions`, `description`) but locks down `name`, `is_system_segment`, and prevents deletion entirely.

### Step 4 -- Update `segmentDefinitions.ts`
Add the `is_system_segment` field to the `SegmentDefinition` interface (aliasing from the existing `is_system` for clarity) and export a helper to check system status:

```ts
export const isSystemSegmentId = (id: string): boolean => {
  return SYSTEM_SEGMENTS.some(s => s.id === id);
};

export const SYSTEM_SEGMENT_NAMES = SYSTEM_SEGMENTS.map(s => s.name);
```

### Step 5 -- Add Application-Level Guards
Update the segment save/delete logic in `CRMSegments.tsx`:
- In the `update` path: check `is_system_segment` before allowing name changes; if system, skip name field in the update payload.
- In the `deleteSegment` function: check `is_system_segment` before calling delete; show an error toast if attempted.
- In the edge function `evaluate-segments/index.ts`: no changes needed (it only updates `customer_count`, which remains allowed).

### Step 6 -- Update TypeScript Types
Add `is_system_segment` to the segment type used across the app so TypeScript catches any future misuse:
- In `src/integrations/supabase/types.ts` (auto-generated, but we note it for the regeneration step).
- In `src/types/segmentation.ts` -- add `is_system_segment?: boolean` to `EnhancedSegment`.

---

## What This Milestone Does NOT Do
- No UI changes (badges, disabled fields, etc.) -- that is a later milestone
- No campaign logic changes
- No permission/role checks
- No deduplication of existing duplicate rows (can be handled separately)

## Files Changed

| File | Change |
|------|--------|
| Database (SQL migration) | Add column, seed flags, create trigger |
| `src/config/segmentDefinitions.ts` | Add helper functions |
| `src/types/segmentation.ts` | Add `is_system_segment` to types |
| `src/pages/crm/CRMSegments.tsx` | Add app-level guards on update/delete |

